import requests
import re
import chromadb
import pandas as pd

session = requests.Session()

CHROMA_PATH = "chroma_store"
COLLECTION_NAME = "teaching_assistant"

client = chromadb.PersistentClient(path=CHROMA_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)

def create_embedding(text):
    r = session.post(
        "http://localhost:11434/api/embeddings",
        json={
            "model": "nomic-embed-text",
            "prompt": text
        },
        timeout=60
    )

    if r.status_code != 200:
        raise Exception(f"Embedding failed:\n{r.text}")

    return r.json()["embedding"]

def inference(prompt):
    r = session.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "tinyllama",
            "prompt": prompt,
            "stream": False
        },
        timeout=120
    )

    if r.status_code != 200:
        raise Exception(f"Inference failed:\n{r.text}")

    return r.json()["response"]

def extract_video_number(title):
    match = re.match(r"(\d+)", str(title))
    if match:
        return match.group(1)
    return "Unknown"

def retrieve_chunks(query, top_k=3):
    query_embedding = create_embedding(query)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k
    )

    rows = []

    for i in range(len(results["ids"][0])):
        metadata = results["metadatas"][0][i]
        text = results["documents"][0][i]
        chunk_id = results["ids"][0][i]

        rows.append({
            "chunk_id": chunk_id,
            "title": metadata.get("title", "Unknown"),
            "video_number": metadata.get("video_number", "Unknown"),
            "start": metadata.get("start", 0),
            "end": metadata.get("end", 0),
            "text": text
        })

    return pd.DataFrame(rows)

def build_prompt(top_results, query):
    chunk_text = ""

    for _, row in top_results.iterrows():
        chunk_text += f"""Title: {row['title']}
Video Number: {row['video_number']}
Start: {row['start']}
End: {row['end']}
Text: {row['text']}

"""

    prompt = f"""Use only the subtitle chunks below to answer the student's course question.

Subtitle Chunks:
{chunk_text}

Question:
{query}

Answer exactly in this format:

Topic Explanation:
...

Where It Is Taught:
- Video Number: ...
- Title: ...
- Timestamp: ... to ...
- Coverage Level: Introduction / Partial / Detailed

Best Place To Start:
...

What You Will Learn There:
...

Confidence:
High / Medium / Low

Rules:
- Use only the given chunks
- Do not invent anything
- If incomplete, say so briefly
- If not found, say it is not confidently found
"""

    return prompt

query = input("Ask your question: ")

top_results = retrieve_chunks(query, top_k=3)

print("\nTop retrieved chunks:\n")

for _, row in top_results.iterrows():
    print(f"Title        : {row['title']}")
    print(f"Video Number : {row['video_number']}")
    print(f"Chunk ID     : {row['chunk_id']}")
    print(f"Start        : {row['start']}")
    print(f"End          : {row['end']}")
    print(f"Text         : {row['text']}")
    print("-" * 80)

prompt = build_prompt(top_results, query)

with open("prompt.txt", "w", encoding="utf-8") as f:
    f.write(prompt)

print("\nprompt.txt generated successfully!")

response = inference(prompt)

print("\nFinal Answer:\n")
print(response)