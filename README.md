# 🎙️ AI Voice Assistant for Web

A **real-time, local AI voice assistant** that listens from the browser, detects a wake word, converts speech to text, predicts intent using a trained ML model, and executes actions directly in the browser.

> **Pipeline:**  
> **Audio → Wake Word → Speech-to-Text → Intent Model → Browser Action**

---

## 📌 Project Objectives

- Build a voice-controlled web assistant using **open-source AI**
- Train and deploy a **custom intent classification model**
- Perform **local speech-to-text inference** (no cloud APIs)
- Execute browser actions based on user voice commands
- Deliver a complete AI system for **Semester 1 practicum**

---

## 📌 Key Features

- 🎤 Real-time microphone streaming (Web Audio API)
- 🧠 Wake word detection (local model)
- 🗣️ Speech-to-text using Whisper (`whisper.cpp`)
- 🤖 Custom trained intent classification model
- 🌐 Browser action execution (search, scroll, open site)
- ⚡ WebSocket streaming (low latency)
- 🔒 Fully local (no cloud APIs)

---

## 🧠 AI Models Used

### 1️⃣ Speech Recognition (Pretrained Model)

- **Model:** Whisper (via `whisper.cpp`)
- **Type:** Open-source pretrained speech-to-text model
- **Execution:** Local CPU inference
- **Supported models:** `tiny.en`, `base.en` (dynamic selection)

Whisper converts raw microphone audio into text in real time.

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
        ↓  (WebSocket)
Backend (FastAPI)
        ├── Wake Word Detection
        ├── VAD + Audio Pipeline
        ├── Whisper (Speech-to-Text)
        └── Intent Classifier
```

---

## ⚙️ Requirements

## System

- Python 3.10+
- Node.js 18+
- Modern browser (Chrome recommended)
- Microphone enabled

---

## 🚀 Setup Guide

## 1️⃣ Clone project

```bash
git clone https://github.com/sancy20/ai-voice-assistant
cd ai-voice-assistant
```

---

## 2️⃣ Setup Python environment

```bash
cd backend
python -m venv venv

venv\Scripts\activate.ps1

pip install -r requirements.txt
```

---

## 3️⃣ Add required models (MANDATORY)

Place Whisper models in:
```
models/
├── ggml-base.en.bin
├── ggml-tiny.en.bin
```

---

## 4️⃣ Run backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

Server will run at:

http://127.0.0.1:8000

---

## 5️⃣ Run frontend

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

---

## 🔄 System Flow

Wake Mode:
Sleep → Detect Wake → Arm → Capture → Process → Execute → Sleep

Hold Mode:
Press → Capture → Process → Execute → Stop

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
