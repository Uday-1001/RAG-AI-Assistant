# RAG-Based AI Teaching Assistant

An AI-powered teaching assistant that converts lecture videos into a searchable knowledge base and answers student questions using Retrieval-Augmented Generation (RAG).

---

## Overview

Students often struggle to revisit long lecture videos just to find one concept or explanation. This project solves that problem by transforming course videos into an AI assistant that can answer questions directly from the lecture content.

The system processes educational videos, converts them into text, stores the information in a vector database, and retrieves relevant context to generate grounded answers.

---

## Features

- Converts lecture videos into audio
- Transcribes speech into text
- Splits transcripts into chunks
- Generates embeddings for semantic search
- Stores embeddings in ChromaDB
- Retrieves relevant transcript chunks for user queries
- Generates answers using lecture-based context

---

## Problem Statement

Educational videos contain a lot of valuable information, but students often find it difficult to search through long lectures to locate specific concepts quickly.

This project addresses that problem by building a **course-specific AI assistant** that allows users to ask questions in natural language and receive answers based on the lecture content.

---

## How It Works

The pipeline follows these steps:

```text
Lecture Videos
      ↓
Audio Extraction
      ↓
Speech-to-Text
      ↓
Transcript Chunking
      ↓
Embedding Generation
      ↓
ChromaDB Vector Store
      ↓
User Query
      ↓
Similarity Search
      ↓
Relevant Chunks
      ↓
LLM Response
```

---

## Project Structure

```text
RAG-AI-Assistant/
│
├── scripts/
│   ├── Build_VectorDB.py
│   ├── Retrieval.py
│   ├── SpeechToText.py
│   └── Video_to_mp3.py
│ 
├── jsons/
├── audios/
├── videos_inMP4/
├── .gitignore
├── requirements.txt
└── README.md
```

---

## File Description

### `Video_to_mp3.py`
Extracts audio from lecture videos.

### `SpeechToText.py`
Converts extracted audio into transcript text.

### `Build_VectorDB.py`
Processes transcript chunks, generates embeddings, and stores them in ChromaDB.

### `Retrieval.py`
Accepts user queries, retrieves relevant chunks, and generates responses using the retrieved context.

### `prompt.txt`
Contains the instruction prompt used by the assistant during response generation.

---

## Tech Stack

- **Python**
- **ChromaDB**
- **Ollama**
- **Whisper / Speech-to-Text**
- **Embedding Model**
- **Local LLM**

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Uday-1001/RAG-AI-Assistant.git
cd RAG-AI-Assistant
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

---

## How to Use?

### Step 1: Add lecture videos

Place your lecture videos inside:

```text
sample_data/videos_inMP4/
```

### Step 2: Convert videos to audio

```bash
python scripts/Video_to_mp3.py
```

### Step 3: Convert audio to transcript

```bash
python scripts/SpeechToText.py
```

### Step 4: Build the vector database

```bash
python scripts/Build_VectorDB.py
```

### Step 5: Ask questions using retrieval

```bash
python scripts/Retrieval.py
```

---

## Example Questions

You can ask questions like:

- What is the span element?
- What did the instructor say about vector databases?
- Summarize the lecture topic
- What is the difference between div and span?

---

## Example Use Case

A student can upload lecture videos, process them into a searchable knowledge base, and ask topic-specific questions without rewatching the entire lecture.

This makes lecture content more accessible, searchable, and student-friendly.

---

## Challenges Faced

- Handling large lecture files on low-end hardware
- Managing local LLM inference efficiently
- Reducing prompt size for faster generation
- Ensuring useful transcript chunking for better retrieval

---

## Limitations

- Transcription quality depends on audio clarity
- Retrieval quality depends on chunking strategy
- Local LLM inference may be slow on low-resource systems
- Large models may require higher RAM/compute

---

## Future Improvements

- Add timestamp-based answer citations
- Add lecture-wise filtering
- Add a web frontend using Streamlit or Gradio
- Add quiz generation from lecture content
- Add summarization for each lecture
- Improve retrieval using hybrid search (semantic + keyword)

---

## Why RAG?

A standard language model may generate generic answers, but a RAG-based system retrieves relevant information directly from the lecture content before generating a response.

This makes the assistant:

- More grounded
- More accurate
- More course-specific
- More useful for students

---

## Author

**Uday**

---

## License

This project is open-source and available under the MIT License.
