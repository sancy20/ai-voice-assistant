import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Settings as SettingsIcon, Mic, Wifi, WifiOff } from "lucide-react";
import { emitAction } from "./actionBus";

const SOCKET_URL = import.meta.env.VITE_GATEWAY_URL;

// display durations (ms)
const SHOW_SPEECH_MS = 12000;
const SHOW_ACTION_MS = 10000; // action label / result
const SHOW_SCROLL_MS = 10000;

export default function AssistantWidget() {
  const socketRef = useRef(null);

  const [connStatus, setConnStatus] = useState("Disconnected");
  const [assistantStatus, setAssistantStatus] = useState("Sleeping");
  const [isOpen, setIsOpen] = useState(true);

  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");

  const [isHolding, setIsHolding] = useState(false);
  const holdForceActiveRef = useRef(false);

  const awakeUntilRef = useRef(0);

  const micStartedOnceRef = useRef(false);
  const recordingRef = useRef(false);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRef = useRef(null);
  const zeroGainRef = useRef(null);

  const pendingBytesRef = useRef(null);
  const flushTimerRef = useRef(null);

  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelRef = useRef(0);
  const rafRef = useRef(null);

  const SAFE_OPEN_SITES = useMemo(
    () => ({
      chatgpt: "https://chat.openai.com/",
      youtube: "https://www.youtube.com/",
      google: "https://www.google.com/",
      github: "https://github.com/",
      wikipedia: "https://www.wikipedia.org/",
    }),
    []
  );

  const wakeStatus = useMemo(() => {
    if (connStatus !== "Connected") return "Disconnected";
    return Date.now() < awakeUntilRef.current ? "Awake" : "Sleeping";
  }, [connStatus, assistantStatus, partial, finalText]);

  const wakeStatusPill =
    wakeStatus === "Disconnected"
      ? "bg-white/5 text-white/70 ring-white/10"
      : wakeStatus === "Awake"
      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
      : "bg-sky-500/10 text-sky-200 ring-sky-400/20";

  const wakeStatusText =
    wakeStatus === "Disconnected"
      ? "Wake Word: Disconnected"
      : wakeStatus === "Awake"
      ? "Wake Word: Awake"
      : "Wake Word: Sleeping";

  const loadModels = async () => {
    try {
      const res = await fetch("http://localhost:3000/models");
      const data = await res.json();
      const list = Array.isArray(data.models) ? data.models : [];
      setModels(list);

      const defaultKey =
        (typeof data.defaultKey === "string" && data.defaultKey) ||
        (list[0] && list[0].key) ||
        "base";

      setSelectedModel((prev) => prev || defaultKey);
    } catch {
      setModels([{ key: "base", label: "base" }]);
      setSelectedModel((prev) => prev || "base");
    }
  };

  const sendAudioMeta = (ctxSampleRate, wakeMode) => {
    socketRef.current?.emit("audio_meta", {
      sampleRate: ctxSampleRate,
      modelKey: selectedModel || "base",
      wakeMode,
    });
  };

  const executeIntent = (intentTuple) => {
    if (!intentTuple || !Array.isArray(intentTuple) || intentTuple.length < 1)
      return;
    const [type, value, maybeAmount] = intentTuple;

    if (type === "scroll") {
      const amount = Number.isFinite(maybeAmount) ? maybeAmount : 420;
      if (value === "down")
        window.scrollBy({ top: amount, behavior: "smooth" });
      if (value === "up") window.scrollBy({ top: -amount, behavior: "smooth" });
      return;
    }

    if (type === "navigate") {
      if (value === "back") return window.history.back();
      if (value === "home") return (window.location.href = "/");
      return;
    }

    if (type === "open") {
      const key = (value || "").toLowerCase().trim();
      const url = SAFE_OPEN_SITES[key];
      if (!url) return;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const clearUI = () => {
    setPartial("");
    setFinalText("");
    emitAction({ text: "Cleared", kind: "ptt", durationMs: 1800 });
  };

  // audio level loop
  const startAudioLevelLoop = () => {
    const tick = () => {
      const v = audioLevelRef.current;
      setAudioLevel((prev) =>
        Math.max(0, Math.min(100, Math.round(prev * 0.85 + v * 0.15)))
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopAudioLevelLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioLevelRef.current = 0;
    setAudioLevel(0);
  };

  const startAudioPipeline = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRef.current = stream;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;

    sendAudioMeta(ctx.sampleRate, "wake");
    await ctx.audioWorklet.addModule("/pcm-processor.js");

    const src = ctx.createMediaStreamSource(stream);
    sourceRef.current = src;

    const worklet = new AudioWorkletNode(ctx, "pcm-processor");
    processorRef.current = worklet;

    startAudioLevelLoop();

    worklet.port.onmessage = (e) => {
      if (!recordingRef.current) return;

      const buf = e.data;
      const chunk =
        buf instanceof ArrayBuffer
          ? new Uint8Array(buf)
          : new Uint8Array(buf.buffer);

      let maxAbs = 0;
      for (let i = 0; i < Math.min(chunk.byteLength, 4000); i += 2) {
        const s = ((chunk[i] | (chunk[i + 1] << 8)) << 16) >> 16;
        const a = Math.abs(s);
        if (a > maxAbs) maxAbs = a;
      }
      audioLevelRef.current = Math.max(
        audioLevelRef.current,
        (maxAbs / 32768) * 100
      );

      if (!pendingBytesRef.current) pendingBytesRef.current = chunk;
      else {
        const a = pendingBytesRef.current;
        const merged = new Uint8Array(a.byteLength + chunk.byteLength);
        merged.set(a, 0);
        merged.set(chunk, a.byteLength);
        pendingBytesRef.current = merged;
      }

      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null;
          const toSend = pendingBytesRef.current;
          pendingBytesRef.current = null;
          if (toSend?.byteLength && socketRef.current?.connected) {
            socketRef.current.emit("audio_chunk", toSend);
          }
          audioLevelRef.current *= 0.35;
        }, 50);
      }
    };

    src.connect(worklet);

    const zeroGain = ctx.createGain();
    zeroGain.gain.value = 0.0;
    zeroGainRef.current = zeroGain;
    worklet.connect(zeroGain);
    zeroGain.connect(ctx.destination);

    setAssistantStatus("Sleeping");
  };

  const ensureMicStarted = async () => {
    if (micStartedOnceRef.current) return;
    micStartedOnceRef.current = true;
    try {
      await startAudioPipeline();
    } catch {
      micStartedOnceRef.current = false;
    }
  };

  // socket connect
  useEffect(() => {
    if (socketRef.current) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 300,
      reconnectionDelayMax: 2000,
      timeout: 8000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnStatus("Connected");
      loadModels();
      emitAction({ text: "Connected", kind: "wake", durationMs: 1800 });
    });

    socket.on("disconnect", () => {
      setConnStatus("Disconnected");
      setAssistantStatus("Sleeping");
      emitAction({
        text: "Disconnected",
        kind: "disconnect",
        durationMs: 2500,
      });
    });

    socket.on("wake_event", (payload) => {
      if (payload?.type === "detected") {
        const awakeMs = Math.max(
          1200,
          Math.round((payload?.awake_for_sec ?? 9) * 1000)
        );
        awakeUntilRef.current = Date.now() + awakeMs;
        emitAction({ text: "Awake", kind: "wake", durationMs: 2000 });
        if (!holdForceActiveRef.current) setAssistantStatus("Listening");
      }
    });

    socket.on("partial_transcript", (payload) => {
      const allow =
        holdForceActiveRef.current || Date.now() < awakeUntilRef.current;
      if (!allow) return;
      setPartial(payload?.text || "");
      setAssistantStatus("Listening");
    });

    socket.on("final_transcript", (payload) => {
      const text = payload?.text || "";
      const intent = payload?.intent || null;

      setFinalText(text);
      setPartial("");
      setAssistantStatus("Processing");
      if (text) emitAction({ text, kind: "say", durationMs: SHOW_SPEECH_MS });

      if (Array.isArray(intent) && intent.length) {
        const [type, value] = intent;

        if (type === "scroll") {
          emitAction({
            text: value === "up" ? "Scroll up" : "Scroll down",
            kind: value === "up" ? "scroll_up" : "scroll_down",
            durationMs: SHOW_SCROLL_MS,
          });
        } else if (type === "navigate") {
          emitAction({
            text:
              value === "home"
                ? "Go home"
                : value === "back"
                ? "Go back"
                : `Navigate: ${value || ""}`,
            kind: "action",
            durationMs: SHOW_ACTION_MS,
          });
        } else if (type === "open") {
          emitAction({
            text: `Open: ${value || ""}`.trim(),
            kind: "action",
            durationMs: SHOW_ACTION_MS,
          });
        } else if (type === "search") {
          emitAction({
            text: `Search: ${value || ""}`.trim(),
            kind: "search",
            durationMs: SHOW_ACTION_MS,
          });
        } else if (type === "time") {
          const t = (value || "").trim();
          emitAction({
            text: t ? `Time: ${t}` : "Time",
            kind: "action",
            durationMs: SHOW_ACTION_MS,
          });
        } else if (type === "help") {
          emitAction({
            text: "Help / Commands",
            kind: "action",
            durationMs: SHOW_ACTION_MS,
          });
        } else if (type === "none") {
        } else {
          emitAction({
            text: "Action",
            kind: "action",
            durationMs: SHOW_ACTION_MS,
          });
        }

        setTimeout(() => executeIntent(intent), 650);
      }

      setTimeout(() => setAssistantStatus("Sleeping"), 750);

      if (holdForceActiveRef.current) {
        holdForceActiveRef.current = false;
        setIsHolding(false);
        const ctx = audioContextRef.current;
        if (ctx) sendAudioMeta(ctx.sampleRate, "wake");
      }
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
    };
  }, [SAFE_OPEN_SITES]);

  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx || connStatus !== "Connected") return;
    const mode = holdForceActiveRef.current ? "ptt" : "wake";
    sendAudioMeta(ctx.sampleRate, mode);
  }, [selectedModel]);

  const onHoldStart = async () => {
    setIsHolding(true);
    holdForceActiveRef.current = true;

    emitAction({ text: "Listening…", kind: "ptt", durationMs: 2000 });

    await ensureMicStarted();

    const ctx = audioContextRef.current;
    if (ctx && socketRef.current?.connected) {
      socketRef.current.emit("ptt_start");
      sendAudioMeta(ctx.sampleRate, "ptt");
    }

    setAssistantStatus("Listening");
  };

  const onHoldEnd = () => {
    setIsHolding(false);
    setAssistantStatus("Processing");

    if (socketRef.current?.connected) {
      socketRef.current.emit("audio_end");
    } else {
      emitAction({
        text: "Not connected",
        kind: "disconnect",
        durationMs: 2500,
      });
      setAssistantStatus("Sleeping");
    }
  };

  return (
    <div className='fixed bottom-6 right-6 z-50'>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className='flex items-center gap-3 rounded-2xl border border-white/10 bg-black/90 px-4 py-3 text-white shadow-2xl backdrop-blur hover:bg-black'
        >
          <div className='grid h-10 w-10 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10'>
            <Mic className='h-5 w-5 text-white/90' />
          </div>
          <div className='text-left'>
            <div className='text-sm font-semibold leading-tight'>
              Voice Assistant
            </div>
            <div className='text-xs text-white/70'>{assistantStatus}</div>
          </div>
          <span
            className={[
              "ml-2 h-2 w-2 rounded-full",
              connStatus === "Connected" ? "bg-emerald-400" : "bg-rose-400",
            ].join(" ")}
          />
        </button>
      ) : null}

      {isOpen ? (
        <div className='relative w-[420px] overflow-hidden rounded-3xl border border-white/10 bg-black/90 text-white shadow-2xl backdrop-blur'>
          <div className='flex items-center justify-between px-5 py-4'>
            <div className='flex items-center gap-3'>
              <div className='grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10'>
                <Mic className='h-5 w-5 text-white/90' />
              </div>
              <div>
                <div className='text-sm font-semibold'>Web Voice Assistant</div>
                <div className='mt-1 flex items-center gap-2 text-xs text-white/70'>
                  {connStatus === "Connected" ? (
                    <span className='inline-flex items-center gap-1'>
                      <Wifi className='h-3.5 w-3.5' /> Connected
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-1'>
                      <WifiOff className='h-3.5 w-3.5' /> Disconnected
                    </span>
                  )}
                  <span className='text-white/30'>•</span>
                  <span className='text-white/80'>{assistantStatus}</span>
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className='rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-medium text-white/90 hover:bg-white/10'
                title='Settings'
              >
                <SettingsIcon className='h-4 w-4' />
              </button>
              <button
                onClick={clearUI}
                className='rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10'
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className='rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/90 hover:bg-white/10'
                title='Minimize'
              >
                —
              </button>
            </div>
          </div>

          <div className='px-5 pb-4'>
            <div className='flex items-center justify-between gap-3'>
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1",
                  wakeStatusPill,
                ].join(" ")}
              >
                {wakeStatusText}
              </span>

              <div className='inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/80 ring-1 ring-white/10'>
                <span className='text-white/60'>Audio</span>
                <span className='font-semibold tabular-nums'>
                  {Math.max(0, Math.min(100, audioLevel))}
                </span>
              </div>
            </div>
          </div>

          <div className='px-5 pb-4'>
            <div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
              <div className='flex items-center justify-between'>
                <div className='text-xs font-semibold text-white/90'>
                  Transcript
                </div>
                <div className='text-xs text-white/50'>
                  Model:{" "}
                  <span className='text-white/80'>
                    {selectedModel || "base"}
                  </span>
                </div>
              </div>

              <div className='mt-3 min-h-[92px] space-y-2'>
                {partial ? (
                  <div className='rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10'>
                    <span className='mr-2 text-xs text-white/60'>
                      (partial)
                    </span>
                    {partial}
                  </div>
                ) : null}

                {finalText ? (
                  <div className='rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10'>
                    <span className='mr-2 text-xs text-white/60'>(final)</span>
                    {finalText}
                  </div>
                ) : null}

                {!partial && !finalText ? (
                  <div className='rounded-xl bg-white/5 px-3 py-3 text-sm text-white/70 ring-1 ring-white/10'>
                    Say your wake word, then speak. Or hold the button below.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className='px-5 pb-5'>
            <button
              onMouseDown={onHoldStart}
              onMouseUp={onHoldEnd}
              onMouseLeave={() => {
                if (isHolding) onHoldEnd();
              }}
              className={[
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition select-none",
                "border border-white/10 shadow-lg",
                isHolding
                  ? "bg-white text-black"
                  : "bg-white/5 text-white/90 hover:bg-white/10",
              ].join(" ")}
            >
              {isHolding ? "Release to Stop" : "Hold to Speak"}
            </button>
          </div>

          {isSettingsOpen ? (
            <div className='absolute inset-0 z-50 grid place-items-center bg-black/60 p-5'>
              <div className='w-full max-w-md rounded-3xl border border-white/10 bg-black p-5 shadow-2xl'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <div className='text-sm font-semibold text-white'>
                      Settings
                    </div>
                    <div className='mt-1 text-xs text-white/50'>
                      Switch Whisper model only.
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className='shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10'
                  >
                    Close
                  </button>
                </div>

                <div className='mt-4 rounded-2xl border border-white/10 bg-white/5 p-4'>
                  <div className='text-xs font-semibold text-white/90'>
                    Whisper model
                  </div>
                  <div className='mt-2 flex items-center gap-3'>
                    <select
                      value={selectedModel || ""}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className='w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none'
                    >
                      {(models.length
                        ? models
                        : [{ key: "base", label: "base" }]
                      ).map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label || m.key}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={loadModels}
                      className='shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/10'
                    >
                      Reload
                    </button>
                  </div>
                  <div className='mt-2 text-[11px] text-white/45'>
                    Model changes apply immediately.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
