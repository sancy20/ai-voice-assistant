import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function AssistantWidget() {
  const socketRef = useRef(null);

  const [status, setStatus] = useState("Disconnected");
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [logs, setLogs] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoExecute, setAutoExecute] = useState(true);

  // Models (loaded dynamically)
  const [models, setModels] = useState([]); // [{ key, label }]
  const [selectedModel, setSelectedModel] = useState("");

  // Mic meter
  const [micLevel, setMicLevel] = useState(0); // 0..1
  const micLevelRef = useRef(0);
  const rafRef = useRef(null);

  // Audio refs
  const recordingRef = useRef(false);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRef = useRef(null);
  const zeroGainRef = useRef(null);

  // batching
  const pendingBytesRef = useRef(null);
  const flushTimerRef = useRef(null);

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

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [`${ts} — ${msg}`, ...prev].slice(0, 40));
  };

  const clearUI = () => {
    setPartial("");
    setFinalText("");
    setLogs([]);
  };

  const startMeterLoop = () => {
    const tick = () => {
      const v = micLevelRef.current;
      setMicLevel((prev) => {
        const next = Math.max(0, Math.min(1, Math.max(v, prev * 0.85)));
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopMeterLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    micLevelRef.current = 0;
    setMicLevel(0);
  };

  // -------- Models --------
  const loadModels = async () => {
    try {
      const res = await fetch("http://localhost:3000/models");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data.models) ? data.models : [];
      setModels(list);

      const defaultKey =
        (typeof data.defaultKey === "string" && data.defaultKey) ||
        (list[0] && list[0].key) ||
        "base";

      setSelectedModel((prev) => prev || defaultKey);
      addLog(`Models loaded (${list.length || 1})`);
    } catch (e) {
      // fallback if endpoint not ready
      setModels([{ key: "base", label: "base" }]);
      setSelectedModel((prev) => prev || "base");
      addLog("Models endpoint not found; using base only");
    }
  };

  // -------- Intent execution --------
  const executeIntent = (intentTuple) => {
    if (!intentTuple || !Array.isArray(intentTuple) || intentTuple.length < 1) {
      addLog("No intent to execute");
      return;
    }
    const [type, value] = intentTuple;
    addLog(`Intent: ${type}${value ? ` (${value})` : ""}`);

    if (type === "scroll") {
      const amount = 420;
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
      if (!url) return addLog(`Blocked open target: ${value}`);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) addLog("Popup blocked: allow popups for this site.");
      return;
    }

    if (type === "help") {
      alert(
        'Commands:\n- "open youtube"\n- "open chatgpt"\n- "scroll down/up"\n- "go back"\n- "go home"\n- "search for ..."\n'
      );
      return;
    }
  };

  // -------- Socket wiring --------
  useEffect(() => {
    const socket = io("http://localhost:3000");
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected");
      addLog("Connected to gateway");
      loadModels();
    });

    socket.on("disconnect", () => {
      setStatus("Disconnected");
      addLog("Disconnected");
    });

    socket.on("partial_transcript", (payload) => {
      setPartial(payload?.text || "");
    });

    socket.on("final_transcript", (payload) => {
      const text = payload?.text || "";
      const intent = payload?.intent || null;

      setFinalText(text);
      setPartial("");
      setIsProcessing(false);

      if (!intent) return addLog("No intent to execute");
      if (autoExecute) executeIntent(intent);
      else
        addLog(
          `Intent ready (auto-exec OFF): ${intent[0]}${
            intent[1] ? `(${intent[1]})` : ""
          }`
        );
    });

    return () => {
      try {
        socket.disconnect();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExecute]);

  // -------- Recording --------
  const startRecording = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;

    setIsSpeaking(true);
    setIsProcessing(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;

      // send sampleRate + modelKey
      socketRef.current?.emit("audio_meta", {
        sampleRate: ctx.sampleRate,
        modelKey: selectedModel || "base",
      });

      await ctx.audioWorklet.addModule("/pcm-processor.js");

      const src = ctx.createMediaStreamSource(stream);
      sourceRef.current = src;

      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      processorRef.current = worklet;

      startMeterLoop();

      worklet.port.onmessage = (e) => {
        if (!recordingRef.current) return;

        const buf = e.data;
        const chunk =
          buf instanceof ArrayBuffer
            ? new Uint8Array(buf)
            : new Uint8Array(buf.buffer);

        // mic level estimate
        let maxAbs = 0;
        for (let i = 0; i < Math.min(chunk.byteLength, 4000); i += 2) {
          const s = ((chunk[i] | (chunk[i + 1] << 8)) << 16) >> 16; // int16
          const a = Math.abs(s);
          if (a > maxAbs) maxAbs = a;
        }
        micLevelRef.current = Math.max(micLevelRef.current, maxAbs / 32768);

        // batch
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
            if (toSend?.byteLength && socketRef.current?.connected)
              socketRef.current.emit("audio_chunk", toSend);
          }, 50);
        }
      };

      src.connect(worklet);

      // silent output
      const zeroGain = ctx.createGain();
      zeroGain.gain.value = 0.0;
      zeroGainRef.current = zeroGain;
      worklet.connect(zeroGain);
      zeroGain.connect(ctx.destination);

      addLog(
        `Mic active (sr=${ctx.sampleRate}, model=${selectedModel || "base"})`
      );
    } catch (err) {
      recordingRef.current = false;
      setIsSpeaking(false);
      stopMeterLoop();
      addLog(`Mic error: ${err?.message || String(err)}`);
    }
  };

  const stopRecording = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;

    setIsSpeaking(false);
    setIsProcessing(true);
    stopMeterLoop();

    try {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      const toSend = pendingBytesRef.current;
      pendingBytesRef.current = null;
      if (toSend?.byteLength && socketRef.current?.connected)
        socketRef.current.emit("audio_chunk", toSend);
    } catch (_) {}

    try {
      processorRef.current?.disconnect?.();
      sourceRef.current?.disconnect?.();
      zeroGainRef.current?.disconnect?.();
    } catch (_) {}

    try {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    } catch (_) {}

    try {
      mediaRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (_) {}

    processorRef.current = null;
    sourceRef.current = null;
    zeroGainRef.current = null;
    audioContextRef.current = null;
    mediaRef.current = null;

    if (socketRef.current?.connected)
      setTimeout(() => socketRef.current.emit("audio_end"), 80);

    // safety: clear processing if backend doesn't reply
    setTimeout(() => setIsProcessing(false), 8000);
  };

  // -------- UI helpers --------
  const dotColor = status === "Connected" ? "bg-emerald-400" : "bg-rose-400";

  const stateText = isSpeaking
    ? "Listening"
    : isProcessing
    ? "Processing"
    : "Idle";
  const stateColor = isSpeaking
    ? "text-sky-200"
    : isProcessing
    ? "text-amber-200"
    : "text-slate-300";

  return (
    <div className='fixed bottom-6 right-6 z-50'>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className='flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-slate-100 shadow-2xl backdrop-blur hover:bg-slate-950'
        >
          <div className='grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500/40 to-indigo-500/40 ring-1 ring-white/10'>
            🎙️
          </div>
          <div className='text-left'>
            <div className='text-sm font-semibold leading-tight'>
              Voice Assistant
            </div>
            <div className={`text-xs ${stateColor}`}>{stateText}</div>
          </div>
          <span className={`ml-2 h-2 w-2 rounded-full ${dotColor}`} />
        </button>
      ) : null}

      {isOpen ? (
        <div className='relative w-[420px] h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur'>
          <div className='flex h-full flex-col'>
            {/* Header */}
            <div className='px-5 pt-5'>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500/40 to-indigo-500/40 ring-1 ring-white/10'>
                    ✨
                  </div>
                  <div className='min-w-0'>
                    <div className='text-sm font-semibold text-white truncate'>
                      Web Voice Assistant
                    </div>
                    <div className='mt-1 flex items-center gap-2 text-xs text-slate-300'>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${dotColor}`}
                      />
                      <span>{status}</span>
                      <span className='text-slate-500'>•</span>
                      <span className={stateColor}>{stateText}</span>
                      <span className='text-slate-500'>•</span>
                    </div>
                  </div>
                </div>

                {/* Buttons always visible */}
                <div className='flex shrink-0 items-center gap-2'>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className='rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-medium text-slate-100 hover:bg-white/10'
                  >
                    Settings
                  </button>
                  <button
                    onClick={clearUI}
                    className='rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-medium text-slate-100 hover:bg-white/10'
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className='rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-bold text-slate-100 hover:bg-white/10'
                    title='Minimize'
                  >
                    —
                  </button>
                </div>
              </div>
            </div>

            {/* Mic meter */}
            <div className='px-5 pt-4'>
              <div className='flex items-center justify-between'>
                <div className='text-xs font-semibold text-slate-200'>
                  Microphone
                </div>
                <div className='text-xs text-slate-400'>
                  {isSpeaking ? "Live" : "Hold to talk"}
                </div>
              </div>
              <div className='mt-2 h-3 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10'>
                <div
                  className='h-full bg-gradient-to-r from-emerald-400/70 via-sky-400/70 to-indigo-400/70 transition-[width] duration-75'
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            </div>

            {/* Transcript */}
            <div className='px-5 pt-4'>
              <div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
                <div className='flex items-center justify-between'>
                  <div className='text-xs font-semibold text-slate-200'>
                    Transcript
                  </div>
                  <div className='text-xs text-slate-400'>
                    Realtime captions
                  </div>
                </div>

                <div className='mt-3 min-h-[92px] space-y-2'>
                  {partial ? (
                    <div className='rounded-xl bg-sky-500/10 px-3 py-2 text-sm text-sky-200 ring-1 ring-sky-400/20'>
                      <span className='mr-2 text-xs text-sky-300/80'>
                        (partial)
                      </span>
                      {partial}
                    </div>
                  ) : null}

                  {finalText ? (
                    <div className='rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 ring-1 ring-emerald-400/20'>
                      <span className='mr-2 text-xs text-emerald-200/80'>
                        (final)
                      </span>
                      {finalText}
                    </div>
                  ) : null}

                  {!partial && !finalText ? (
                    <div className='rounded-xl bg-white/5 px-3 py-3 text-sm text-slate-300 ring-1 ring-white/10'>
                      Try:{" "}
                      <span className='font-medium text-slate-100'>
                        “open youtube”, “scroll down”, “what time is it”
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className='px-5 pt-4'>
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={() => {
                  if (isSpeaking) stopRecording();
                }}
                className={[
                  "w-full rounded-2xl px-4 py-3 text-sm font-semibold transition select-none",
                  "border border-white/10 shadow-lg",
                  isSpeaking
                    ? "bg-gradient-to-r from-indigo-500 to-sky-500 text-white"
                    : "bg-white/5 text-slate-100 hover:bg-white/10",
                ].join(" ")}
              >
                {isSpeaking ? "Release to Stop" : "Hold to Speak"}
              </button>

              <div className='mt-3 flex items-center justify-between'>
                <label className='flex cursor-pointer items-center gap-2 text-xs text-slate-300'>
                  <input
                    type='checkbox'
                    checked={autoExecute}
                    onChange={(e) => setAutoExecute(e.target.checked)}
                    className='h-4 w-4 rounded border-white/20 bg-white/10'
                  />
                  Auto-execute intents
                </label>
                <div className='text-[11px] text-slate-400'>
                  STT local (whisper.cpp)
                </div>
              </div>
            </div>

            {/* Action log (contained) */}
            <div className='flex-1 px-5 py-5'>
              <div className='flex items-center justify-between'>
                <div className='text-xs font-semibold text-slate-200'>
                  Action log
                </div>
                <div className='text-xs text-slate-400'>
                  Latest {Math.min(40, logs.length)}
                </div>
              </div>

              <div className='mt-2 h-full max-h-[120px] overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3'>
                {logs.length === 0 ? (
                  <div className='text-sm text-slate-400'>No actions yet.</div>
                ) : (
                  <ul className='space-y-2'>
                    {logs.map((l, i) => (
                      <li
                        key={i}
                        className='rounded-xl bg-slate-900/40 px-3 py-2 text-xs text-slate-200 ring-1 ring-white/5'
                      >
                        {l}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Settings Modal */}
          {isSettingsOpen ? (
            <div className='absolute inset-0 z-50 grid place-items-center bg-black/55 p-5'>
              <div className='w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <div className='text-sm font-semibold text-white'>
                      Settings
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className='shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10'
                  >
                    Close
                  </button>
                </div>

                <div className='mt-4 space-y-4'>
                  <div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
                    <div className='text-xs font-semibold text-slate-200'>
                      Whisper model
                    </div>
                    <div className='mt-2 flex items-center gap-3'>
                      <select
                        value={selectedModel || ""}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className='w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-400/30'
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
                        className='shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10'
                        title='Reload models'
                      >
                        Reload
                      </button>
                    </div>
                    <div className='mt-2 text-[11px] text-slate-400'>
                      Model applies next time you hold-to-speak.
                    </div>
                  </div>

                  <div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='text-xs font-semibold text-slate-200'>
                          Auto execute
                        </div>
                        <div className='mt-1 text-xs text-slate-400'>
                          If OFF, intents are logged only
                        </div>
                      </div>
                      <input
                        type='checkbox'
                        checked={autoExecute}
                        onChange={(e) => setAutoExecute(e.target.checked)}
                        className='h-5 w-5 rounded border-white/20 bg-white/10'
                      />
                    </div>
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
