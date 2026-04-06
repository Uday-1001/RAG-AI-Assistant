import os
import re
import json
import uuid
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List

import requests
import chromadb
import whisper
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


OLLAMA_BASE        = "http://localhost:11434"
EMBED_MODEL        = "nomic-embed-text"
LLM_MODEL          = "tinyllama"
WHISPER_MODEL_SIZE = "small"                    
CHROMA_PATH        = "chroma_store"
COLLECTION_NAME    = "teaching_assistant"
WHISPER_MODEL_DIR  = "models"                   


app = FastAPI(title="LectureLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


_whisper_model  = None
_chroma_client  = None
_collection     = None
_ollama_session = requests.Session()


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        os.makedirs(WHISPER_MODEL_DIR, exist_ok=True)
        _whisper_model = whisper.load_model(WHISPER_MODEL_SIZE, download_root=WHISPER_MODEL_DIR)
    return _whisper_model


def get_collection():
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection    = _chroma_client.get_or_create_collection(name=COLLECTION_NAME)
    return _collection


def create_embedding(text: str) -> List[float]:
    """Call Ollama nomic-embed-text and return the embedding vector."""
    r = _ollama_session.post(
        f"{OLLAMA_BASE}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=120,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Embedding failed ({r.status_code}): {r.text[:300]}")
    return r.json()["embedding"]


def llm_generate(prompt: str) -> str:
    """Call Ollama tinyllama (non-streaming) and return the response text."""
    r = _ollama_session.post(
        f"{OLLAMA_BASE}/api/generate",
        json={"model": LLM_MODEL, "prompt": prompt, "stream": False},
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"LLM inference failed ({r.status_code}): {r.text[:300]}")
    return r.json()["response"]


def video_to_mp3(video_path: str, out_path: str) -> None:
    """Extract audio to mp3 via ffmpeg. Raises RuntimeError on failure."""
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", video_path, "-vn",
         "-acodec", "libmp3lame", "-q:a", "4", out_path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\n{result.stderr[-500:]}")


def transcribe_audio(audio_path: str) -> dict:
    """Whisper transcription → returns full Whisper result dict."""
    model = get_whisper()
    return model.transcribe(
        audio=audio_path,
        task="transcribe",       
        word_timestamps=False,
        fp16=False,
    )


def build_chunks(whisper_result: dict, title: str) -> List[dict]:
    """Convert Whisper segments → chunk dicts ready for ChromaDB."""
    chunks = []
    for i, seg in enumerate(whisper_result["segments"]):
        text = re.sub(r"\s+", " ", seg["text"]).strip()
        if not text:
            continue
        chunks.append({
            "chunk_id":     str(i),
            "title":        title,
            "start":        float(seg["start"]),
            "end":          float(seg["end"]),
            "text":         text,
        })
    return chunks


def store_chunks(chunks: List[dict], title: str) -> int:
    """Embed and upsert chunks into ChromaDB. Returns number stored."""
    collection = get_collection()

    # Remove any previous segments for this title so re-uploads are clean.
    try:
        existing = collection.get(where={"title": title})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    ids, docs, embeddings, metadatas = [], [], [], []

    for chunk in chunks:
        emb = create_embedding(chunk["text"])
        unique_id = f"{title}_{chunk['chunk_id']}_{uuid.uuid4().hex[:6]}"

        ids.append(unique_id)
        docs.append(chunk["text"])
        embeddings.append(emb)
        metadatas.append({
            "title":    chunk["title"],
            "start":    chunk["start"],
            "end":      chunk["end"],
            "chunk_id": chunk["chunk_id"],
        })

    if ids:
        collection.add(ids=ids, documents=docs, embeddings=embeddings, metadatas=metadatas)

    return len(ids)


def retrieve_chunks(query: str, top_k: int = 3) -> List[dict]:
    """Embed query and fetch top_k closest chunks from ChromaDB."""
    collection = get_collection()
    q_emb      = create_embedding(query)

    results = collection.query(query_embeddings=[q_emb], n_results=top_k)

    rows = []
    for i in range(len(results["ids"][0])):
        meta = results["metadatas"][0][i]
        rows.append({
            "chunk_id": results["ids"][0][i],
            "title":    meta.get("title", "Unknown"),
            "start":    meta.get("start", 0),
            "end":      meta.get("end", 0),
            "text":     results["documents"][0][i],
        })
    return rows


def build_rag_prompt(chunks: List[dict], question: str) -> str:
    context = ""
    for c in chunks:
        context += (
            f"Title: {c['title']}\n"
            f"Timestamp: {c['start']:.1f}s – {c['end']:.1f}s\n"
            f"Text: {c['text']}\n\n"
        )

    return f"""You are a helpful teaching assistant. Use ONLY the transcript excerpts below to answer the student's question.
If the answer is not in the excerpts, say you could not find it in the provided content.

Transcript Excerpts:
{context}
Student Question:
{question}

Answer the question clearly and concisely. If relevant, mention which timestamp(s) cover the topic.
Answer:"""


@app.get("/health")
def health():
    """Returns backend status and total chunk count in ChromaDB."""
    try:
        n = get_collection().count()
    except Exception:
        n = 0
    return {"status": "ok", "chroma_chunks": n}


@app.post("/process-video")
async def process_video(file: UploadFile = File(...)):
    """
    Pipeline:
      1. Save uploaded video to a temp file
      2. ffmpeg → mp3
      3. Whisper → segments
      4. Embed segments → ChromaDB
    Returns { title, chunks_processed, duration_seconds }
    """
    title = Path(file.filename).stem  # filename without extension

    with tempfile.TemporaryDirectory() as tmp:
        video_path = os.path.join(tmp, file.filename)
        audio_path = os.path.join(tmp, f"{title}.mp3")

        # 1. Save upload
        with open(video_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # 2. Extract audio
        try:
            video_to_mp3(video_path, audio_path)
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=f"Audio extraction failed: {e}")

        # 3. Transcribe
        try:
            result = transcribe_audio(audio_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

        # Duration = end time of last segment (or 0)
        duration = 0.0
        if result["segments"]:
            duration = float(result["segments"][-1]["end"])

        # 4. Chunk + embed + store
        chunks = build_chunks(result, title)
        if not chunks:
            raise HTTPException(status_code=422, detail="No speech detected in video.")

        try:
            n_stored = store_chunks(chunks, title)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Embedding/storage failed: {e}")

    return {
        "title":            title,
        "chunks_processed": n_stored,
        "duration_seconds": duration,
    }


class AskRequest(BaseModel):
    question: str
    top_k:    int = 3


@app.post("/ask")
def ask(req: AskRequest):
    """
    RAG query:
      1. Embed question → retrieve top_k chunks
      2. Build prompt → tinyllama → answer
    Returns { answer, chunks: [...] }
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        chunks = retrieve_chunks(req.question, top_k=req.top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {e}")

    if not chunks:
        return {"answer": "No relevant content found in the video transcript.", "chunks": []}

    prompt = build_rag_prompt(chunks, req.question)

    try:
        answer = llm_generate(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM inference failed: {e}")

    # Return chunks without raw text (frontend only needs title + timestamps)
    safe_chunks = [
        {"title": c["title"], "start": c["start"], "end": c["end"]}
        for c in chunks
    ]

    return {"answer": answer.strip(), "chunks": safe_chunks}
