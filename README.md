# 🎙️ AI Voice Assistant for Web (Semester 1 Project)

A **local, web-based AI voice assistant** that performs real-time speech recognition and executes browser actions using a **trained intent recognition model**.

This project demonstrates a complete **AI pipeline**:

> **Speech → Text → Intent (trained ML model) → Action**

Built with **open-source models**, **local inference**, and a real working system suitable for academic evaluation.

---

## 📌 Project Objectives

- Build a voice-controlled web assistant using **open-source AI**
- Train and deploy a **custom intent classification model**
- Perform **local speech-to-text inference** (no cloud APIs)
- Execute browser actions based on user voice commands
- Deliver a complete AI system for **Semester 1 practicum**

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

## 🗂️ Supported Intent Classes (Semester 1)

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
Browser (React + AudioWorklet)
        ↓
Socket.IO Gateway (Node.js)
        ↓
AI Service (FastAPI)
        ├── Whisper.cpp (Speech-to-Text)
        └── Intent Classifier (Trained ML Model)
```

---

## 🖥️ Tech Stack

### Frontend

- React
- Tailwind CSS
- Web Audio API + AudioWorklet
- Socket.IO Client

### Backend

- Node.js (Gateway Server)
- FastAPI (AI Service)
- whisper.cpp (local inference)
- scikit-learn (intent model)
- joblib (model persistence)

---

## 📁 Project Structure

```
ai-voice-assistant/
│
├── frontend/                 # React app
│   ├── src/
│   │   ├── AssistantWidget.jsx
│   │   └── App.jsx
│   └── public/
│       └── pcm-processor.js
│
├── gateway/
│   └── server.js             # Socket.IO gateway
│
├── ai_service/
│   ├── app.py                # FastAPI AI service
│   ├── intent_pipeline.joblib
│   ├── intent_dataset.csv    # Intent training dataset
│   └── sessions/
│
├── models/
│   ├── ggml-base.en.bin
│   └── ggml-tiny.en.bin
│
└── README.md
```

---

## 🚀 How to Run

### 1️⃣ Install dependencies

```bash
# Gateway
cd gateway
npm install

# AI service
cd ../ai_service
pip install -r requirements.txt
```

---

### 2️⃣ Download Whisper models

Place Whisper models in the `models/` directory:

```
models/
├── ggml-base.en.bin
└── ggml-tiny.en.bin
```

---

### 3️⃣ Start backend services

```bash
# AI service
cd ai_service
uvicorn app:app --host 0.0.0.0 --port 8000

# Gateway
cd ../gateway
node server.js
```

---

### 4️⃣ Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open in browser:

```
http://localhost:5173
```

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

## 🎓 Academic Context

This project is developed for **Semester 1 – AI Project Practicum**.

It demonstrates:

- Training and deployment of an AI model
- Integration of open-source AI systems
- A complete working AI application
- Real-time AI inference in a web environment

---

## 🔮 Future Work (Semester 2)

- Improve intent classification accuracy
- Add confidence-based execution
- Add text-to-speech (TTS)
- Context-aware conversation
- Multilingual support
- Mobile-friendly UI

---
