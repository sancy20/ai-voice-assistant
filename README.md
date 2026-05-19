# AI Voice Assistant Web App

VoiceAI is a web-based AI voice assistant built with **React**, **FastAPI**, **WebSocket audio streaming**, **faster-whisper speech recognition**, intent routing, wake mode, note mode, search preview, YouTube media overlay, reminders, alarms, tasks, user authentication, token usage, payment checkout, assistant history, and admin analytics.

---

## Project Overview

The AI Voice Assistant Web App allows users to control assistant features using voice or text commands. The assistant can listen to user speech, transcribe audio, detect command intent, and perform actions such as:

- Searching the web
- Opening websites
- Playing YouTube media inside an overlay
- Creating reminders
- Setting alarms
- Creating tasks
- Taking notes through continuous note mode
- Showing assistant history
- Tracking command analytics for admin users
- Managing token usage and subscription plans

---

## Main Features

### 1. Voice Assistant

- Real-time microphone capture
- WebSocket-based audio streaming
- Push-to-talk voice command mode
- Wake mode support
- Partial transcript display
- Final transcript processing
- Assistant response messages
- Voice activity detection
- Audio level handling
- Automatic sleep/listening state management

### 2. Speech Recognition

The project uses **Whisper through faster-whisper** for speech-to-text transcription.

Supported configuration through environment variables:

```env
ASR_BACKEND=faster_whisper
ASR_MODEL_SIZE=small
ASR_DEVICE=cpu
ASR_COMPUTE_TYPE=int8
ASR_LANGUAGE=en
```

Default local demo configuration:

```text
Model: small
Device: CPU
Compute type: int8
Language: English
```

This setup is suitable for local CPU testing. For better performance, the model size, device, and compute type can be changed using `.env`.

### 3. Text Command Support

The assistant supports both voice and typed commands.

Typed commands use the same backend assistant pipeline as voice commands, so features like note mode, reminders, alarms, tasks, media search, and search preview work from both input methods.

Example text commands:

```text
Search AI news
Play YouTube lofi music
What time is it?
Open GitHub
Remind me to call mom at 5 pm
Start note mode
```

### 4. Search Assistant

The assistant can search the web and show results inside a center preview UI.

Features:

- Search by voice or text
- Center search result preview
- Open selected search result
- Result navigation support
- Opens selected result in a new browser tab

Example commands:

```text
Search AI news
Search for machine learning
Open first result
Open second result
Next result
Previous result
```

### 5. Website Opening

The assistant can open websites directly.

Example commands:

```text
Open GitHub
Open YouTube
Open ChatGPT
Open Google
```

If the user says something that looks more like a search phrase, such as:

```text
Search for machine learning
```

the assistant should treat it as a search-style request instead of trying to open an invalid domain.

### 6. YouTube Media Assistant

The assistant supports YouTube media search and media overlay.

Features:

- Search YouTube by command
- Display media overlay inside the app
- Show video result list
- Select media result
- Navigate next/previous media result
- Open or play selected media

Example commands:

```text
Play YouTube lofi music
Search YouTube study music
Play second
Next
Previous
Pause
Resume
```

### 7. Note Mode

Note mode allows continuous listening for note taking.

Flow:

```text
Start note mode
Speak note content
Stop note mode
Save note
```

Example commands:

```text
Start note mode
Today I need to finish my project report
Stop note mode
```

The note is saved and can be viewed from the Notes page.

### 8. Reminder System

Users can create reminders with natural language commands.

Features:

- Create reminders
- Parse reminder task and time
- Show reminder icon in the assistant header
- Show reminder popup notification when time is reached

Example commands:

```text
Remind me to study at 6 pm
Remind me to call mom at 5 pm
Set reminder meeting at 3 pm
Show reminders
```

### 9. Alarm System

Users can set alarms from voice or text commands.

Features:

- Create alarm
- Show alarm icon in assistant header
- Show alarm popup notification when time is reached

Example commands:

```text
Set alarm 6 am
Set alarm clock 7:30 pm
Show alarms
Delete alarm 1
```

### 10. Task System

Users can create and manage tasks.

Features:

- Add task
- Show task list
- Delete task
- Task icon in assistant header

Example commands:

```text
Add task finish report
Create task buy groceries
Show my tasks
Delete task 1
```

### 11. In-App Notifications

The assistant can notify the user when a reminder or alarm time is reached.

Notification behavior:

- Appears as an in-app popup
- Shows reminder/alarm title and time

### 12. Assistant History

The system records assistant activities such as:

- Transcript
- Intent
- Confidence
- Status
- Action type
- Message
- Timestamp

History helps users review past assistant commands and helps admins analyze assistant performance.

### 13. Admin Dashboard

The admin dashboard provides analytics for assistant usage.

Admin features:

- Total command count
- Successful command count
- Failed command count
- Low-confidence command count
- Intent distribution
- Action type chart
- Command logs
- User management
- Audit log view

This is useful for monitoring assistant behavior and evaluating command accuracy.

### 14. Authentication

The project includes user authentication features:

- Sign up
- Sign in
- Protected routes
- Current user profile
- Admin role support
- Password update
- Forgot password

### 15. Subscription and Token System

The project includes token-based usage and subscription plans.

Supported plans: **Free**, **Pro** and **Business**

Users consume tokens when using assistant commands.

### 16. Payment Checkout

The project includes a payment checkout flow for demonstration.

payment features:

- Checkout session
- Payment confirmation
- Plan upgrade after payment confirmation
- Token purchase after payment confirmation
- Friendly card checkout UI

Payment flow:

```text
User selects plan or token package
→ Checkout page
→ Payment confirmation
→ Backend validates package
→ User plan or token balance updates
```
---

## Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- WebSocket client

### Backend

- FastAPI
- Python
- WebSocket
- SQLAlchemy
- PyMySQL
- faster-whisper

### Database

- MySQL

### AI / ML

- faster-whisper for speech recognition
- Custom intent classification pipeline
- Rule-based assistant routing
- Wake model support
- Voice activity detection

---

## System Architecture

```text
User Voice
   ↓
Frontend Microphone Capture
   ↓
WebSocket Audio Streaming
   ↓
FastAPI Backend
   ↓
Speech-to-Text using faster-whisper
   ↓
Intent Detection and Assistant Pipeline
   ↓
Assistant Action
   ↓
Frontend UI Update
   ↓
MySQL Storage / Local User Item Storage
```

---

## Assistant Processing Flow

### Push-to-Talk Flow

```text
Hold button
→ Capture audio
→ Send audio chunks by WebSocket
→ Transcribe speech
→ Detect intent
→ Execute action
→ Show response
→ Return to ready state
```

### Wake Mode Flow

```text
Sleep
→ Wake detection
→ Listen for command
→ Capture command audio
→ Process command
→ Execute action
→ Return to sleep
```

### Text Command Flow

```text
User types command
→ /assistant/query API
→ finalize_utterance pipeline
→ Detect intent
→ Execute action
→ Show response
```

---

## Supported Commands

### General Commands

```text
What time is it?
Open GitHub
Open YouTube
Search AI news
Go back
Go home
Scroll down
Scroll up
```

### Media Commands

```text
Play YouTube lofi music
Search YouTube relaxing music
Play second
Next
Previous
Pause
Resume
```

### Note Commands

```text
Start note mode
Stop note mode
Finish Writing
Save note
```

### Reminder Commands

```text
Remind me to call mom at 5 pm
Set reminder meeting at 3 pm
Show reminders
```

### Alarm Commands

```text
Set alarm 6 am
Set alarm clock 7:30 pm
Show alarms
Delete alarm 1
```

### Task Commands

```text
Add task finish report
Create task buy groceries
Show my tasks
Delete task 1
```

### Search Result Commands

```text
Open first result
Open second result
Next result
Previous result
```

---

## Requirements

### System Requirements

- Python 3.10+
- Node.js 18+
- MySQL
- Modern browser
- Microphone permission enabled
- Recommended browser: Google Chrome

### Optional

- GPU support for faster ASR performance

---

## Backend Setup

### 1. Clone Repository

```bash
git clone https://github.com/sancy20/ai-voice-assistant.git
cd ai-voice-assistant
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv

venv\Scripts\activate.ps1

pip install -r requirements.txt
```

---

## MySQL Setup

Create database:

```sql
CREATE DATABASE voice_assistant_db;
```

---

## Run Backend

From the `backend` folder:

```bash
python -m uvicorn app.main:app --reload
```

---

## Frontend Setup

```bash
cd frontend
npm install
```

Run frontend:

```bash
npm run dev
```

---

## AI Model Details

### Speech Recognition Model

```text
Model: Whisper through faster-whisper
Purpose: Convert speech audio into text
Default model size: small
Default device: CPU
Default compute type: int8
```

### Intent Detection

The assistant uses a combination of:

- Rule-based intent routing
- Custom command parsers
- Context-aware command handling
- TF-IDF vectorization + lightweight classifier
- Intent model pipeline
- Slot extraction for tasks, alarms, reminders, media, and search

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

## Token Usage

The system supports token usage per assistant command.

Token behavior:

- User starts with a free token balance
- Commands can consume tokens
- Token balance is refreshed after assistant usage
- Token packages can be purchased through mock payment

---

## Responsive UI

The frontend is designed for both desktop and mobile.

