# AI Voice Assistant Web App

A web-based AI voice assistant built with React, FastAPI, WebSocket audio streaming, speech-to-text, intent routing, wake mode, note mode, search preview, YouTube media control, tasks, alarms, reminders, assistant history, admin analytics logs, and MySQL database storage.

---

## Project Overview

The AI Voice Assistant Web App allows users to control web-based assistant features through voice commands. The system listens to user speech, transcribes audio, detects intent, and performs actions such as:

* Searching the web
* Playing YouTube media
* Creating tasks
* Setting alarms
* Saving reminders
* Entering note mode
* Logging assistant activity

The project also includes an **admin analytics backend** that tracks assistant behavior and performance.

---

## Main Features

### Voice Interaction

* Real-time microphone input
* WebSocket-based audio streaming
* Push-to-talk mode
* Wake mode
* Partial transcript display
* Final transcript processing

---

### Speech Recognition

* Voice Activity Detection (VAD)
* Audio chunk streaming
* Speech-to-text transcription
* Partial + final transcript

---

### Intent Detection

* Rule-based intent routing
* Context-aware assistant behavior
* Unknown intent handling
* Low-confidence detection
* Clarification responses

---

## Search Assistant (Siri-style)

* Voice search
* Top results preview (center UI)
* Select result by number or voice
* Next / previous navigation
* Opens result in **new browser tab**

### Example Commands

```text
search ai assistant
open first result
open second
next result
previous result
```

---

## YouTube Media Assistant

* Search YouTube
* Mini player inside web app
* Related videos list (right/below)
* Voice navigation

### Example Commands

```text
play youtube lofi music
play second
next
previous
pause
resume
```

---

## Note Mode

* Continuous listening mode
* Saves full note until stopped

### Commands

```text
start note mode
this is my project idea
save note
```

---

## Tasks System

* Add tasks
* Show tasks
* Delete tasks

### Commands

```text
add task finish capstone report
show my tasks
delete task 1
```

---

## Alarm System

* Set alarms
* List alarms
* Delete alarms

### Commands

```text
set alarm 6 am
show alarms
delete alarm 1
```

---

## Reminder System

* Smart parsing of time + task
* Stored in database

### Commands

```text
remind me to study at 6 pm
set reminder meeting at 3 pm
show reminder
```

---

## Assistant History & Logs

Tracks every assistant action:

* Transcript
* Intent
* Confidence
* Status (success / failed)
* Action type
* Timestamp

---

## Admin Analytics Backend

Provides monitoring APIs:

### Metrics:

* Total commands
* Success rate
* Failed commands
* Low-confidence commands
* Intent statistics
* Action statistics

---

## Other Features

- Real-time microphone streaming (Web Audio API)
- Wake word detection (local model)
- Speech-to-text using Whisper (`faster-whisper`)
- Custom trained intent classification model

---

## AI Models Used

### Speech Recognition (Pretrained Model)

- **Model:** Whisper (via `faster-whisper`)
- **Type:** Open-source pretrained speech-to-text model
- **Execution:** Local CPU

---

### Intent Recognition (Trained Model)

- **Type:** Supervised machine learning classifier
- **Training data:** Custom dataset (`intent_dataset.csv`)
- **Technique:** TF-IDF vectorization + lightweight classifier
- **Output:** Command intent + extracted slots

This model satisfies the requirement to **train and deploy an AI model**.

---

## Supported Intent Classes

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

## Tech Stack

### Frontend

* React
* Vite
* Tailwind CSS
* WebSocket API

### Backend

* FastAPI
* Python
* WebSocket
* SQLAlchemy
* PyMySQL
* faster-whisper (ASR)

### Database

* MySQL

---

## System Architecture

```
User Voice → Frontend (Mic Capture) → WebSocket Streaming → FastAPI Backend → Speech-to-Text → Intent Detection → Assistant Action → Frontend UI Update → MySQL Storage
```

---

## System Flow

### Wake Mode

```
Sleep → Wake Word → Armed → Capture → Process → Execute → Sleep
```

### Hold Mode

```
Press → Capture → Process → Execute → Stop
```

---

## System

- Python 3.10+
- Node.js 18+
- Modern browser (Chrome recommended)
- Microphone enabled

---

## Setup Guide

### Clone project

```bash
git clone https://github.com/sancy20/ai-voice-assistant
cd ai-voice-assistant
```

---

### Backend Setup

```bash
cd backend
python -m venv venv

venv\Scripts\activate.ps1

pip install -r requirements.txt
```

---

### MySQL Setup

```sql
CREATE DATABASE voice_assistant_db;
```

---

### Run Backend

```bash
python -m uvicorn app.main:app --reload
```

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## Example Voice Commands

- "Open YouTube"
- "Open ChatGPT"
- "Scroll down"
- "Go back"
- "Search for machine learning"
- "What time is it?"
- "Help"

---

## AI Training Details

- Dataset: `intent_dataset.csv`
- Each sample contains:
  - Spoken command text
  - Corresponding intent label
- Model trained offline and saved as:
  - `intent_pipeline.joblib`
- Loaded automatically by the AI service at runtime

---
