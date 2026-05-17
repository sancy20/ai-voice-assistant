const DEFAULT_API_BASE = "http://127.0.0.1:8000";
const DEFAULT_WS_BASE = "ws://127.0.0.1:8000";

export const API_BASE = (
  import.meta.env.VITE_API_URL || DEFAULT_API_BASE
).replace(/\/$/, "");

export const API_URL = `${API_BASE}/api`;

export const WS_BASE = (import.meta.env.VITE_WS_URL || DEFAULT_WS_BASE).replace(
  /\/$/,
  "",
);
export const AUDIO_WS_URL = `${WS_BASE}/ws/audio`;
