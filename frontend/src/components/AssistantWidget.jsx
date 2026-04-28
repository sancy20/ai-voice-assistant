import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings as SettingsIcon, Mic, Wifi, WifiOff } from "lucide-react";
import {
  emitAction,
  emitMedia,
  emitMediaControl,
  emitResults,
  emitSearchControl,
} from "./actionBus";

// display durations (ms)
const SHOW_SPEECH_MS = 12000;
const SHOW_ACTION_MS = 10000; // action label / result
const SHOW_SCROLL_MS = 10000;

export default function AssistantWidget() {
  const sessionIdRef = useRef(crypto?.randomUUID?.() || `sess_${Date.now()}`);

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
  const wsRef = useRef(null);

  const wakeEnabledRef = useRef(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);

  const [isAwake, setIsAwake] = useState(false);

  const [isNoteMode, setIsNoteMode] = useState(false);
  const isNoteModeRef = useRef(false);

  const [searchPreview, setSearchPreview] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);

  useEffect(() => {
    isNoteModeRef.current = isNoteMode;
  }, [isNoteMode]);

  const SAFE_OPEN_SITES = useMemo(
    () => ({
      chatgpt: "https://chat.openai.com/",
      youtube: "https://www.youtube.com/",
      google: "https://www.google.com/",
      github: "https://github.com/",
      wikipedia: "https://www.wikipedia.org/",
    }),
    [],
  );

  const wakeStatus =
    connStatus !== "Connected"
      ? "Disconnected"
      : isAwake
        ? "Awake"
        : "Sleeping";

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
    setModels([{ key: "base", label: "base" }]);
    setSelectedModel("base");
  };

  const setStatusSafe = (status) => {
    setAssistantStatus((prev) => (prev === status ? prev : status));
  };

  const openMediaWorkspace = (payload) => {
    if (!payload?.results?.length) return;

    emitMedia({
      provider: payload.provider || "youtube",
      query: payload.query || "",
      results: payload.results,
      selectedIndex: 0,
    });
  };

  const handleBackendResponse = (data) => {
    if (!data || typeof data !== "object") return;

    if (data.type === "partial") {
      const allowPartial =
        holdForceActiveRef.current ||
        wakeEnabledRef.current ||
        isNoteModeRef.current;

      if (allowPartial) {
        setPartial(data.text || "");
        setStatusSafe("Listening");
      } else {
        setPartial("");
      }
      return;
    }

    if (data.type === "wake") {
      awakeUntilRef.current = Date.now() + 9000;
      setIsAwake(true);
      setStatusSafe("Listening");
      return;
    }

    if (data.type === "sleep") {
      awakeUntilRef.current = 0;
      setIsAwake(false);
      setStatusSafe("Sleeping");
      return;
    }

    if (data.type === "listening" || data.type === "armed_after_wake") {
      if (assistantStatus === "Processing") return;
      setStatusSafe("Listening");
      return;
    }

    if (data.type === "idle" || data.type === "awake_idle") {
      return;
    }

    if (data.type === "assistant_response") {
      const text = data.transcript || "";
      const message = data.message || "";
      const action = data.action || {};
      const kind = action.kind;
      const actionData = action.data || {};

      setFinalText(text || message);
      setPartial("");
      setStatusSafe("Processing");
      awakeUntilRef.current = 0;
      setIsAwake(false);

      if (message) {
        emitAction({ text: message, kind: "say", durationMs: SHOW_SPEECH_MS });
      }

      if (kind === "search_preview") {
        setSearchPreview(null);
        setMediaPreview(null);

        emitResults({
          kind: "search_results",
          title: "Search Results",
          subtitle: actionData?.query
            ? `Top results for "${actionData.query}"`
            : "Top search results",
          items: actionData?.results || [],
        });
      } else if (kind === "media_search") {
        setMediaPreview(null);
        setSearchPreview(null);

        openMediaWorkspace(actionData);

        emitAction({
          text: message || "Opening media results",
          kind: "say",
          durationMs: 6000,
        });
      } else if (kind === "media_pause") {
        emitMediaControl({ type: "pause" });
        emitAction({ text: "Media paused", kind: "say", durationMs: 2500 });
      } else if (kind === "media_resume") {
        emitMediaControl({ type: "resume" });
        emitAction({ text: "Media resumed", kind: "say", durationMs: 2500 });
      } else if (kind === "media_next") {
        emitMediaControl({ type: "next" });
        emitAction({
          text: "Playing next result",
          kind: "say",
          durationMs: 2500,
        });
      } else if (kind === "media_prev") {
        emitMediaControl({ type: "prev" });
        emitAction({
          text: "Playing previous result",
          kind: "say",
          durationMs: 2500,
        });
      } else if (kind === "media_select") {
        emitMediaControl({ type: "select", index: actionData.index || 1 });
        emitAction({
          text: `Playing result number ${actionData.index || 1}`,
          kind: "say",
          durationMs: 2500,
        });
      } else if (kind === "search_open_result") {
        emitSearchControl({ type: "open", index: actionData.index || 1 });
        emitAction({
          text: `Opening result number ${actionData.index || 1}`,
          kind: "say",
          durationMs: 2500,
        });
      } else if (kind === "search_next") {
        emitSearchControl({ type: "next" });
        emitAction({
          text: "Moving to next result",
          kind: "say",
          durationMs: 2500,
        });
      } else if (kind === "search_prev") {
        emitSearchControl({ type: "prev" });
        emitAction({
          text: "Moving to previous result",
          kind: "say",
          durationMs: 2500,
        });
      } else if (kind === "open") {
        setTimeout(() => executeIntent(["open", actionData.target || ""]), 650);
      } else if (kind === "scroll") {
        setTimeout(
          () => executeIntent(["scroll", actionData.direction || "down"]),
          650,
        );
      } else if (kind === "navigate") {
        setTimeout(
          () => executeIntent(["navigate", actionData.direction || "back"]),
          650,
        );
      } else if (kind === "show_time") {
        setTimeout(() => executeIntent(["time", actionData.time || ""]), 650);
      }

      setTimeout(() => {
        if (!holdForceActiveRef.current && !isNoteModeRef.current) {
          setPartial("");
          setStatusSafe("Sleeping");
        }
      }, 1200);

      return;
    }

    if (data.type === "assistant_clarification") {
      setFinalText(data.transcript || "");
      setPartial("");
      setStatusSafe("Processing");
      awakeUntilRef.current = 0;
      setIsAwake(false);
      setSearchPreview(null);
      setMediaPreview(null);

      if (data.message) {
        emitAction({
          text: data.message,
          kind: "say",
          durationMs: SHOW_SPEECH_MS,
        });
      }

      setTimeout(() => {
        if (!holdForceActiveRef.current && !isNoteModeRef.current) {
          setPartial("");
          setStatusSafe("Sleeping");
        }
      }, 1200);

      return;
    }

    if (data.type === "no_speech" || data.type === "empty") {
      if (holdForceActiveRef.current) return;
      awakeUntilRef.current = 0;
      setIsAwake(false);
      setStatusSafe("Sleeping");
      return;
    }

    console.log("Unhandled WS type:", data.type, data);
  };

  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://127.0.0.1:8000/ws/audio");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setConnStatus("Connected");

      ws.send(
        JSON.stringify({
          type: "config",
          session_id: sessionIdRef.current,
          sample_rate: audioContextRef.current?.sampleRate || 16000,
          model_key: selectedModel || "base",
          wake_mode: holdForceActiveRef.current
            ? "ptt"
            : wakeEnabledRef.current
              ? "wake"
              : "ptt",
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WS MESSAGE:", data);

        if (data.type === "note_mode_started") {
          isNoteModeRef.current = true;
          setIsNoteMode(true);
          setFinalText(
            data.message || "Note mode is now on. I am listening continuously.",
          );
          setPartial("");
          setStatusSafe("Listening");
          ensureMicStarted();
          recordingRef.current = true;
          return;
        }

        if (data.type === "note_mode_update") {
          setIsNoteMode(true);
          setFinalText(data.text || "");
          setPartial("(listening...)");
          setStatusSafe("Listening");
          return;
        }

        if (data.type === "note_mode_stopped") {
          isNoteModeRef.current = false;
          setIsNoteMode(false);
          setFinalText(data.note_text || "");
          setPartial("");
          setStatusSafe("Sleeping");
          setIsAwake(false);
          awakeUntilRef.current = 0;

          if (!wakeEnabledRef.current && !holdForceActiveRef.current) {
            stopAudioPipeline();
          }
          return;
        }
        handleBackendResponse(data);
      } catch (err) {
        console.error("ws message parse error", err);
      }
    };

    ws.onerror = (err) => {
      console.error("ws error", err);
      setConnStatus("Disconnected");
    };

    ws.onclose = () => {
      setConnStatus("Disconnected");
    };

    wsRef.current = ws;
  };

  const stopAudioPipeline = async () => {
    try {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      pendingBytesRef.current = null;

      if (processorRef.current) {
        try {
          processorRef.current.port.onmessage = null;
          processorRef.current.disconnect();
        } catch {}
        processorRef.current = null;
      }

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {}
        sourceRef.current = null;
      }

      if (zeroGainRef.current) {
        try {
          zeroGainRef.current.disconnect();
        } catch {}
        zeroGainRef.current = null;
      }

      if (mediaRef.current) {
        try {
          mediaRef.current.getTracks().forEach((t) => t.stop());
        } catch {}
        mediaRef.current = null;
      }

      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch {}
        audioContextRef.current = null;
      }

      recordingRef.current = false;
      micStartedOnceRef.current = false;
      audioLevelRef.current = 0;
      setAudioLevel(0);
      stopAudioLevelLoop();
    } catch (err) {
      console.error("stopAudioPipeline error", err);
    }
  };

  const sendChunkToBackend = (bytes) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(bytes);
  };

  const flushBackend = async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "flush" }));
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

    if (type === "search") {
      const query = String(value || "").trim();
      if (!query) return;

      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (type === "time") {
      return;
    }
  };

  const clearUI = () => {
    setPartial("");
    setFinalText("");
    setSearchPreview(null);
    setMediaPreview(null);
    emitAction({ text: "Cleared", kind: "ptt", durationMs: 1800 });
    emitResults(null);
  };

  // audio level loop
  const startAudioLevelLoop = () => {
    const tick = () => {
      const v = audioLevelRef.current;
      setAudioLevel((prev) =>
        Math.max(0, Math.min(100, Math.round(prev * 0.85 + v * 0.15))),
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

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    mediaRef.current = stream;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;

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
        (maxAbs / 32768) * 100,
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
          const shouldSend =
            holdForceActiveRef.current ||
            wakeEnabledRef.current ||
            isNoteModeRef.current;

          if (toSend?.byteLength && shouldSend) {
            sendChunkToBackend(toSend);
          }
          audioLevelRef.current *= 0.35;
        }, 200);
      }
    };

    src.connect(worklet);

    const zeroGain = ctx.createGain();
    zeroGain.gain.value = 0.0;
    zeroGainRef.current = zeroGain;
    worklet.connect(zeroGain);
    zeroGain.connect(ctx.destination);

    wsRef.current?.send(
      JSON.stringify({
        type: "config",
        session_id: sessionIdRef.current,
        sample_rate: audioContextRef.current?.sampleRate || 16000,
        model_key: selectedModel || "base",
        wake_mode: holdForceActiveRef.current
          ? "ptt"
          : wakeEnabledRef.current
            ? "wake"
            : "ptt",
      }),
    );
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

  const enableWakeMode = async () => {
    try {
      await ensureMicStarted();

      wakeEnabledRef.current = true;
      setWakeEnabled(true);

      wsRef.current?.send(
        JSON.stringify({
          type: "config",
          session_id: sessionIdRef.current,
          sample_rate: audioContextRef.current?.sampleRate || 16000,
          model_key: selectedModel || "base",
          wake_mode: "wake",
        }),
      );

      setStatusSafe("Sleeping");
      emitAction({ text: "Wake mode enabled", kind: "wake", durationMs: 1800 });
    } catch {
      emitAction({
        text: "Mic start failed",
        kind: "disconnect",
        durationMs: 2500,
      });
    }
  };

  const disableWakeMode = async () => {
    wakeEnabledRef.current = false;
    setWakeEnabled(false);
    awakeUntilRef.current = 0;
    setStatusSafe("Sleeping");

    if (!holdForceActiveRef.current) {
      await stopAudioPipeline();
    }
  };

  useEffect(() => {
    setConnStatus("Connecting");
    loadModels();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        type: "config",
        session_id: sessionIdRef.current,
        sample_rate: audioContextRef.current?.sampleRate || 16000,
        model_key: selectedModel || "base",
        wake_mode: holdForceActiveRef.current
          ? "ptt"
          : wakeEnabledRef.current
            ? "wake"
            : "ptt",
      }),
    );
  }, [selectedModel]);

  const onHoldStart = async () => {
    holdForceActiveRef.current = true;
    wakeEnabledRef.current = false;
    setWakeEnabled(false);
    awakeUntilRef.current = 0;
    setIsHolding(true);

    await ensureMicStarted();

    wsRef.current?.send(
      JSON.stringify({
        type: "config",
        session_id: sessionIdRef.current,
        sample_rate: audioContextRef.current?.sampleRate || 16000,
        model_key: selectedModel || "base",
        wake_mode: "ptt",
      }),
    );

    setStatusSafe("Listening");
  };

  const onHoldEnd = async () => {
    setIsHolding(false);

    try {
      setStatusSafe("Processing");
      await flushBackend();
    } catch {
      emitAction({
        text: "Not connected",
        kind: "disconnect",
        durationMs: 2500,
      });
      setStatusSafe("Sleeping");
    } finally {
      holdForceActiveRef.current = false;

      if (wakeEnabledRef.current) {
        wsRef.current?.send(
          JSON.stringify({
            type: "config",
            session_id: sessionIdRef.current,
            sample_rate: audioContextRef.current?.sampleRate || 16000,
            model_key: selectedModel || "base",
            wake_mode: "wake",
          }),
        );
      } else {
        setTimeout(async () => {
          if (!wakeEnabledRef.current && !isNoteModeRef.current) {
            await stopAudioPipeline();
          }
        }, 800);
      }
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
        <div className='relative w-105 overflow-hidden rounded-3xl border border-white/10 bg-black/90 text-white shadow-2xl backdrop-blur'>
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

              <div className='mt-3 min-h-23 space-y-2'>
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
                    Say your wake word or hold to speak. Partial captions appear
                    while listening.
                  </div>
                ) : null}

                {mediaPreview?.results?.length ? (
                  <div className='pt-3'>
                    <div className='rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70'>
                      Found {mediaPreview.results.length} media results for “
                      {mediaPreview.query}”.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className='px-5 pb-5'>
            <button
              onClick={wakeEnabled ? disableWakeMode : enableWakeMode}
              className='mb-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10'
            >
              {wakeEnabled ? "Disable Wake Mode" : "Enable Wake Mode"}
            </button>
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
