import os
import json
import re
import requests
import pandas as pd
import chromadb

session = requests.Session()

JSON_FOLDER = "jsons"
CHROMA_PATH = "chroma_store"
COLLECTION_NAME = "teaching_assistant"
DEBUG_CSV = "embedded_chunks_debug.csv"

client = chromadb.PersistentClient(path=CHROMA_PATH)

try:
    client.delete_collection(COLLECTION_NAME)
except:
    pass

collection = client.get_or_create_collection(name=COLLECTION_NAME)

def create_embedding(text):
    try:
        r = session.post(
            "http://localhost:11434/api/embeddings",
            json={
                "model": "nomic-embed-text",
                "prompt": text
            },
            timeout=120
        )

        if r.status_code != 200:
            print("Embedding failed:", r.text)
            return None

        return r.json().get("embedding", None)

    except Exception as e:
        print("Error while creating embedding:", e)
        return None

def extract_video_number(title):
    match = re.match(r"(\d+)", str(title))
    if match:
        return match.group(1)
    return "Unknown"

print("Starting vector DB build...\n")

if not os.path.exists(JSON_FOLDER):
    print(f"Folder '{JSON_FOLDER}' not found.")
    exit()

json_files = sorted(os.listdir(JSON_FOLDER))

all_rows = []
total_chunks = 0

for json_file in json_files:
    if not json_file.endswith(".json"):
        continue

    file_path = os.path.join(JSON_FOLDER, json_file)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = json.load(f)
    except Exception as e:
        print(f"Failed to read {json_file}: {e}")
        continue

    if "chunks" not in content:
        print(f"Skipping {json_file} -> No 'chunks' key found")
        continue

    chunks = content["chunks"]

    print(f"\nProcessing: {json_file} | Total chunks: {len(chunks)}")

    ids = []
    documents = []
    embeddings = []
    metadatas = []

    for chunk in chunks:
        text = str(chunk.get("text", "")).strip()

        if not text:
            continue

        text = re.sub(r"\s+", " ", text).strip()

        title = str(chunk.get("title", json_file.replace(".json", ""))).strip()
        start = float(chunk.get("start", 0))
        end = float(chunk.get("end", 0))
        chunk_id = str(chunk.get("chunk_id", total_chunks))
        video_number = chunk.get("video_number", extract_video_number(title))

        print(f"Embedding chunk: {chunk_id}")

        embedding = create_embedding(text)

        if embedding is None:
            print(f"Skipping chunk {chunk_id} due to embedding failure")
            continue

        unique_id = f"{title}_{chunk_id}"

        ids.append(unique_id)
        documents.append(text)
        embeddings.append(embedding)
        metadatas.append({
            "title": title,
            "video_number": str(video_number),
            "start": start,
            "end": end,
            "chunk_id": str(chunk_id)
        })

        all_rows.append({
            "id": unique_id,
            "title": title,
            "video_number": video_number,
            "start": start,
            "end": end,
            "chunk_id": chunk_id,
            "text": text
        })

        total_chunks += 1

    if ids:
        collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )

df = pd.DataFrame(all_rows)
df.to_csv(DEBUG_CSV, index=False)

print("\nDone!")
print(f"Total chunks stored: {total_chunks}")
print(f"Chroma DB saved in: {CHROMA_PATH}")
print(f"Debug CSV saved as: {DEBUG_CSV}")