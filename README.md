# 🎙️ AI Voice Assistant for Web

A **real-time, local AI voice assistant** that listens from the browser, detects a wake word, converts speech to text, predicts intent using a trained ML model, and executes actions directly in the browser.

> **Pipeline:**  
> **🎤 Audio → 🔊 Wake Word → 🧠 VAD → 🗣️ Speech-to-Text → 🤖 Intent Model → 🌐 Browser Actions**

---

## 📌 Project Objectives

- Web Audio API (frontend)
- WebSocket streaming (real-time communication)
- Faster-Whisper (speech recognition)
- Custom intent classification model
- Fully local processing (no cloud APIs)

---

## 📌 Key Features

- 🎤 Real-time microphone streaming (Web Audio API)
- 🧠 Wake word detection (local model)
- 🗣️ Speech-to-text using Whisper (`faster-whisper`)
- 🤖 Custom trained intent classification model
- 🌐 Browser action execution (search, scroll, open site)
- ⚡ WebSocket streaming (low latency)
- 🔒 Fully local (no cloud APIs)

---

## 🧠 AI Models Used

### 1️⃣ Speech Recognition (Pretrained Model)

- **Model:** Whisper (via `faster-whisper`)
- **Type:** Open-source pretrained speech-to-text model
- **Execution:** Local CPU

---

### 2️⃣ Intent Recognition (Trained Model)

- **Type:** Supervised machine learning classifier
- **Training data:** Custom dataset (`intent_dataset.csv`)
- **Technique:** TF-IDF vectorization + lightweight classifier
- **Output:** Command intent + extracted slots

This model satisfies the requirement to **train and deploy an AI model**.

---

## 🗂️ Supported Intent Classes

| Intent      | Description                                         |
| ----------- | --------------------------------------------------- |
| `open_site` | Open safe websites (YouTube, ChatGPT, Google, etc.) |
| `search`    | Search for spoken queries                           |
| `scroll`    | Scroll page up or down                              |
| `navigate`  | Go back or go home                                  |
| `get_time`  | Get current system time                             |
| `help`      | Show available commands                             |
| `unknown`   | Fallback for unrecognized input                     |

---

## 🏗️ System Architecture

```
Frontend (React + AudioWorklet)
        ↓  WebSocket (PCM audio)
Backend (FastAPI)
        ├── Wake Word Detection
        ├── VAD + Audio Pipeline
        ├── Partial Transcription (faster-whisper)
        ├── Final Transcription
        ├── Intent Prediction
        └── Action Response
```

---

## 🔄 System Flow

### Wake Mode

Sleep → Wake Word → Armed → Capture → Process → Execute → Sleep

### Hold Mode

Press → Capture → Process → Execute → Stop

---

## ⚙️ Requirements

### System

- Python 3.10+
- Node.js 18+
- Modern browser (Chrome recommended)
- Microphone enabled

---

## 🚀 Setup Guide

### 1️⃣ Clone project

```bash
git clone https://github.com/sancy20/ai-voice-assistant
cd ai-voice-assistant
```

---

### 2️⃣ Setup Python environment

```bash
cd backend
python -m venv venv

venv\Scripts\activate.ps1

pip install -r requirements.txt
```

---

### 3️⃣ Run backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Server will run at:

http://127.0.0.1:8000

---

### 5️⃣ Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

http://localhost:5173

---

## 🎤 Example Voice Commands

- "Open YouTube"
- "Open ChatGPT"
- "Scroll down"
- "Go back"
- "Search for machine learning"
- "What time is it?"
- "Help"

---

## 📊 AI Training Details

- Dataset: `intent_dataset.csv`
- Each sample contains:
  - Spoken command text
  - Corresponding intent label
- Model trained offline and saved as:
  - `intent_pipeline.joblib`
- Loaded automatically by the AI service at runtime

---

## 📈 Improvements

- faster-whisper replaces whisper.cpp
- real-time streaming added
- partial captions added
- improved noise handling

---
