# 🧑‍🏫 RAG AI Assistant

A Retrieval-Augmented Generation (RAG) based AI Teaching Assistant that answers student questions using lecture/course content processed from video and audio resources.

This project converts educational media into searchable knowledge, stores the processed content, retrieves the most relevant chunks for a user query, and generates context-aware answers.

---

## Overview

This project is built to simulate an AI-powered learning assistant for educational content.

It follows a standard RAG pipeline:

1. **Video / audio input**
2. **Speech-to-text conversion**
3. **Text chunking and JSON storage**
4. **Vector embedding generation**
5. **Retrieval of relevant chunks**
6. **Answer generation based on retrieved context**

---

## Features

- Converts lecture videos into usable learning content
- Extracts/transcribes spoken content
- Stores processed chunks in JSON format
- Uses retrieval to fetch relevant information for a user query
- Backend server support for answering questions
- Frontend interface for user interaction
- Structured pipeline for future scaling

---

## Project Structure

```bash
rag-based-ai-teaching-assistant/
│
├── Scripts/
│   ├── Build_VectorDB.py
│   ├── Retrieval.py
│   ├── SpeechToText.py
│   └── Video_to_mp3.py
│
├── audios/
│   └── **sample_audios**
│
├── jsons/
│   └── **sample_jsons files**
│
├── src/
│   └── ...
│
├── videos_inMP4/
│   └── **sample_videos**
│
├── .gitignore
├── README.md
├── index.html
├── package-lock.json
├── package.json
├── requirements.txt
├── requirements_serve.txt
├── server.py
├── vite.config.js
```

---

## Scripting Description

### `Scripts/`
Contains the main preprocessing and retrieval scripts.

- **`Video_to_mp3.py`**  
  Converts video files into audio format.

- **`SpeechToText.py`**  
  Transcribes extracted audio into text.

- **`Build_VectorDB.py`**  
  Processes text chunks and builds the vector database for retrieval.

- **`Retrieval.py`**  
  Handles retrieval of relevant chunks based on user queries.

---

## How the System Works

The project follows a Retrieval-Augmented Generation (RAG) pipeline integrated with a full-stack application.

1. **Data Ingestion**  
   Educational video/audio content is processed and converted into text.

2. **Preprocessing & Chunking**  
   The extracted text is cleaned and divided into smaller chunks, which are stored in structured JSON format.

3. **Vector Embedding & Storage**  
   Text chunks are converted into embeddings and stored in a vector database for efficient semantic search.

4. **User Query (Frontend)**  
   The user interacts through the frontend interface and submits a question.

5. **Retrieval (Backend)**  
   The backend retrieves the most relevant chunks from the vector database based on the query.

6. **Response Generation**  
   The system generates a context-aware answer using only the retrieved information.

7. **Response Display**  
   The generated answer is sent back to the frontend and displayed to the user.

---

## Installation & Setup

## 1) Clone the repository

```bash
git clone https://github.com/Uday-1001/RAG-AI-Assistant.git
cd RAG-AI-Assistant
```

---

## 2) Install Python dependencies

```bash
pip install -r requirements.txt
pip install -r requirements_serve.txt
```

---

## 3) Install frontend dependencies

```bash
npm install
```

---

## Running the Project

### Start the frontend

```bash
npm run dev
```

This will start the frontend development server.

---

### Start the backend

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

This will start the backend API server locally.

---

## Access the Application

- **Frontend:** Open the local URL shown in the terminal after running `npm run dev`
- **Backend API:** `http://127.0.0.1:8000`

---

---

## Tech Stack

### Backend
- Python

### Frontend
- HTML
- JavaScript
- Vite

### AI / RAG Components
- Speech-to-text pipeline
- Chunking / preprocessing
- Vector retrieval
- Context-based answer generation

---

## Use Cases

This project can be extended for:

- AI Teaching Assistants
- Course Q&A systems
- Subtitle-based search assistants
- Educational video summarization systems
- Smart lecture search tools

---

## Future Improvements

- Better frontend UI/UX
- PDF / PPT / notes ingestion
- Multi-course support
- Chat history
- Answer citations from retrieved chunks
- Better retrieval ranking
- Cloud deployment

---

## Notes

- Some folders such as `audios/` and `videos_inMP4/` are included because they are part of the content processing pipeline.
- Generated / cache / environment-specific files should be excluded using `.gitignore`.
- Large media files may be removed or replaced with sample files if needed for lightweight sharing.

---

## Author

**Uday**
<br>
-- star if you like it!
