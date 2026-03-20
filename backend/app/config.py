import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_DIR = os.path.join(BASE_DIR, "app")
ROOT_DIR = os.path.dirname(BASE_DIR)

SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")
MODELS_DIR = os.path.join(ROOT_DIR, "models")
APP_MODELS_DIR = os.path.join(APP_DIR, "models")
WHISPER_DIR = os.path.join(ROOT_DIR, "whisper.cpp")
WHISPER_BIN = os.path.join(WHISPER_DIR, "whisper_bin", "whisper-cli.exe")

TARGET_SR = int(os.getenv("TARGET_SR", "16000"))

WAKE_SR = 16000
WAKE_DURATION_SEC = float(os.getenv("WAKE_DURATION_SEC", "1.0"))
WAKE_N_MFCC = int(os.getenv("WAKE_N_MFCC", "20"))
WAKE_PROB_THRESHOLD = float(os.getenv("WAKE_PROB_THRESHOLD", "0.70"))
WAKE_ARM_DELAY_SEC = float(os.getenv("WAKE_ARM_DELAY_SEC", "1.0"))
WAKE_COMMAND_SILENCE_TIMEOUT_MS = float(os.getenv("WAKE_COMMAND_SILENCE_TIMEOUT_MS", "1400"))
PTT_SILENCE_TIMEOUT_MS = float(os.getenv("PTT_SILENCE_TIMEOUT_MS", "800"))
WAKE_AWAKE_WINDOW_SEC = float(os.getenv("WAKE_AWAKE_WINDOW_SEC", "9.0"))
WAKE_COOLDOWN_SEC = float(os.getenv("WAKE_COOLDOWN_SEC", "1.2"))

VOICE_ON_RMS = float(os.getenv("VOICE_ON_RMS", "0.00025"))
VOICE_OFF_RMS = float(os.getenv("VOICE_OFF_RMS", "0.00018"))
VOICE_PEAK_ON = int(os.getenv("VOICE_PEAK_ON", "140"))
VOICE_PEAK_OFF = int(os.getenv("VOICE_PEAK_OFF", "90"))