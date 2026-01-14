import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { createWakeWord } from "../wakeword";

const SERVER_WS = "http://localhost:3000";

export default function AssistantWidget() {
  const [connected, setConnected] = useState(false);
  const [captions, setCaptions] = useState("");
  const [partial, setPartial] = useState("");
  const [isWakeTriggered, setIsWakeTriggered] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const socketRef = useRef(null);
  const mediaRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const recordingRef = useRef(false);
  const wakeEngineRef = useRef(null);
  const lastFinalRef = useRef("");
  const pendingBytesRef = useRef(null);
  const flushTimerRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SERVER_WS);
    socketRef.current.on("connect", () => {
      setConnected(true);
      console.log("Connected to gateway");
    });

    // Initialize wake-word once on mount
    (async () => {
      try {
        const detector = await createWakeWord(() => {
          setIsWakeTriggered(true);
          startRecording();
        });
        wakeEngineRef.current = detector;
        console.log("Wake-word engine ready");
      } catch (err) {
        console.error("Wake-word init failed", err);
      }
    })();

    // Listen for final transcripts from gateway
    socketRef.current.on("final_transcript", ({ text, intent }) => {
      if (intent) {
        executeIntent(intent);
      }
    });

    function executeIntent(intent) {
      const [type, value] = intent;

      if (type === "scroll") {
        window.scrollBy({
          top: value === "down" ? 300 : -300,
          behavior: "smooth",
        });
      }

      if (type === "search") {
        const box = document.querySelector("input[type='search']");
        if (box) {
          box.value = value;
          box.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      if (type === "navigate" && value === "home") {
        window.location.href = "/";
      }

      if (type === "time") {
        const label = value ? `Time: ${value}` : "Time request";
        setCaptions((p) => (p ? p + " " : "") + label);
      }
    }

    const cleanTranscript = (txt) => {
      if (!txt) return "";
      const lines = String(txt).split(/\r?\n/);
      const kept = [];
      for (let s of lines) {
        const t = s.trim();
        if (!t) continue;
        if (t.startsWith("system_info")) continue;
        if (t.startsWith("whisper") || t.startsWith("whisper_")) continue;
        if (t.includes("[BLANK_AUDIO]")) continue;
        if (t.startsWith("main:")) {
          const ellIdx = t.lastIndexOf(" ... ");
          if (ellIdx !== -1 && ellIdx + 5 < t.length) {
            const maybeText = t.slice(ellIdx + 5).trim();
            if (maybeText) {
              kept.push(maybeText);
              continue;
            }
          }
          const parenIdx = t.lastIndexOf(")");
          if (parenIdx !== -1 && parenIdx + 1 < t.length) {
            const after = t
              .slice(parenIdx + 1)
              .replace(/^,\s*/, "")
              .trim();
            if (after) {
              kept.push(after);
              continue;
            }
          }
          continue;
        }
        const tsIdx = t.indexOf("] ");
        const candidate =
          tsIdx !== -1 && t.includes("[") && t.includes("-->")
            ? t.slice(tsIdx + 2)
            : t;
        if (candidate.trim()) kept.push(candidate.trim());
      }
      return kept.join(" ").trim();
    };

    socketRef.current.on("partial_transcript", (data) => {
      console.log("partial_transcript (raw):", data?.text?.slice?.(0, 120));
      const cleaned = cleanTranscript(data.text);
      if (!cleaned) return;
      if (
        lastFinalRef.current &&
        cleaned.trim() === lastFinalRef.current.trim()
      ) {
        return;
      }
      setPartial(cleaned);
      setIsSpeaking(true);
      setIsProcessing(false);
    });

    socketRef.current.on("final_transcript", (data) => {
      console.log("final_transcript (raw):", data?.text?.slice?.(0, 200));
      const cleaned = cleanTranscript(data.text);
      if (!cleaned) {
        setPartial("");
        return;
      }
      const trimmed = cleaned.trim();
      const lastFinal = lastFinalRef.current.trim();
      const currentPartial = partial.trim();
      if (trimmed && (trimmed === currentPartial || trimmed === lastFinal)) {
        setPartial("");
        return;
      }
      setCaptions((p) => {
        const pTrim = (p || "").trim();
        if (pTrim.endsWith(trimmed)) {
          return p;
        }
        return (pTrim ? pTrim + " " : "") + trimmed;
      });
      lastFinalRef.current = trimmed;
      setPartial("");
      setIsSpeaking(false);
      setIsProcessing(false);
    });

    return () => {
      socketRef.current.disconnect();
      try {
        if (wakeEngineRef.current) {
          wakeEngineRef.current.terminate?.();
          wakeEngineRef.current = null;
        }
      } catch (_) {}
    };
  }, []);

  const startRecording = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    mediaRef.current = stream;
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    try {
      await audioContextRef.current.resume();
    } catch (_) {}
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    try {
      const sr = audioContextRef.current.sampleRate || 48000;
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("audio_meta", { sampleRate: sr });
      }
      console.log("AudioContext sampleRate=", sr);
    } catch (_) {}

    try {
      if (audioContextRef.current.audioWorklet) {
        try {
          await audioContextRef.current.audioWorklet.addModule(
            new URL("../audio/pcm-processor.js", import.meta.url)
          );
          const node = new AudioWorkletNode(
            audioContextRef.current,
            "pcm-processor"
          );
          processorRef.current = node;
          const silent = audioContextRef.current.createGain();
          silent.gain.value = 0;
          sourceRef.current.connect(node);
          node.connect(silent);
          silent.connect(audioContextRef.current.destination);
          node.port.onmessage = (event) => {
            const buffer = event.data;
            const chunk = new Uint8Array(buffer);
            const prev = pendingBytesRef.current;
            if (prev && prev.length) {
              const merged = new Uint8Array(prev.length + chunk.length);
              merged.set(prev, 0);
              merged.set(chunk, prev.length);
              pendingBytesRef.current = merged;
            } else {
              pendingBytesRef.current = chunk;
            }
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(() => {
                try {
                  const toSend = pendingBytesRef.current;
                  pendingBytesRef.current = null;
                  if (
                    toSend &&
                    toSend.length &&
                    socketRef.current &&
                    socketRef.current.connected
                  ) {
                    socketRef.current.emit("audio_chunk", toSend);
                  }
                } finally {
                  flushTimerRef.current = null;
                }
              }, 50);
            }
            if (recordingRef.current && !partial) {
              setIsProcessing(true);
            }
          };
        } catch (workletErr) {
          console.warn("AudioWorklet init failed, falling back:", workletErr);
          const bufferSize = 4096;
          const node = audioContextRef.current.createScriptProcessor(
            1024,
            1,
            1
          );
          processorRef.current = node;
          sourceRef.current.connect(node);
          node.connect(audioContextRef.current.destination);
          node.onaudioprocess = (e) => {
            const channelData = e.inputBuffer.getChannelData(0);
            const int16 = floatTo16BitPCM(channelData);
            let rms = 0;
            for (let i = 0; i < channelData.length; i++)
              rms += channelData[i] * channelData[i];
            rms = Math.sqrt(rms / Math.max(1, channelData.length));
            if (Math.random() < 0.01)
              console.log(
                "client rms=",
                rms.toFixed(4),
                "bytes=",
                int16.byteLength
              );
            const chunk = new Uint8Array(int16);
            const prev = pendingBytesRef.current;
            if (prev && prev.length) {
              const merged = new Uint8Array(prev.length + chunk.length);
              merged.set(prev, 0);
              merged.set(chunk, prev.length);
              pendingBytesRef.current = merged;
            } else {
              pendingBytesRef.current = chunk;
            }
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(() => {
                try {
                  const toSend = pendingBytesRef.current;
                  pendingBytesRef.current = null;
                  if (
                    toSend &&
                    toSend.length &&
                    socketRef.current &&
                    socketRef.current.connected
                  ) {
                    socketRef.current.emit("audio_chunk", toSend);
                  }
                } finally {
                  flushTimerRef.current = null;
                }
              }, 50);
            }
            if (recordingRef.current && !partial) {
              setIsProcessing(true);
            }
          };
        }
      } else {
        console.warn("AudioWorklet not supported, using ScriptProcessor");
        const bufferSize = 2048;
        const node = audioContextRef.current.createScriptProcessor(1024, 1, 1);
        processorRef.current = node;
        sourceRef.current.connect(node);
        node.connect(audioContextRef.current.destination);
        node.onaudioprocess = (e) => {
          const channelData = e.inputBuffer.getChannelData(0);
          const int16 = floatTo16BitPCM(channelData);
          let rms = 0;
          for (let i = 0; i < channelData.length; i++)
            rms += channelData[i] * channelData[i];
          rms = Math.sqrt(rms / Math.max(1, channelData.length));
          if (Math.random() < 0.01)
            console.log(
              "client rms=",
              rms.toFixed(4),
              "bytes=",
              int16.byteLength
            );
          const chunk = new Uint8Array(int16);
          const prev = pendingBytesRef.current;
          if (prev && prev.length) {
            const merged = new Uint8Array(prev.length + chunk.length);
            merged.set(prev, 0);
            merged.set(chunk, prev.length);
            pendingBytesRef.current = merged;
          } else {
            pendingBytesRef.current = chunk;
          }
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              try {
                const toSend = pendingBytesRef.current;
                pendingBytesRef.current = null;
                if (
                  toSend &&
                  toSend.length &&
                  socketRef.current &&
                  socketRef.current.connected
                ) {
                  socketRef.current.emit("audio_chunk", toSend);
                }
              } finally {
                flushTimerRef.current = null;
              }
            }, 50);
          }
          if (recordingRef.current && !partial) {
            setIsProcessing(true);
          }
        };
      }
    } catch (e) {
      console.error("Audio graph init failed:", e);
    }
  };

  const stopRecording = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    try {
      const proc = processorRef.current;
      if (proc) {
        try {
          if (proc.port && typeof proc.port.onmessage === "function")
            proc.port.onmessage = null;
          if (proc.onaudioprocess) proc.onaudioprocess = null;
        } catch (_) {}
        try {
          proc.disconnect();
        } catch (_) {}
        processorRef.current = null;
      }
      const src = sourceRef.current;
      if (src) {
        try {
          src.disconnect();
        } catch (_) {}
        sourceRef.current = null;
      }
      const ctx = audioContextRef.current;
      if (ctx && ctx.state !== "closed") {
        Promise.resolve(ctx.close()).catch(() => {});
      }
      audioContextRef.current = null;
      const stream = mediaRef.current;
      if (stream && stream.getTracks) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
      }
    } catch (err) {}
    try {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const toSend = pendingBytesRef.current;
      pendingBytesRef.current = null;
      if (
        toSend &&
        toSend.length &&
        socketRef.current &&
        socketRef.current.connected
      ) {
        socketRef.current.emit("audio_chunk", toSend);
      }
    } catch (_) {}
    setIsSpeaking(false);
    setIsProcessing(false);
  };

  function floatTo16BitPCM(float32Array) {
    const l = float32Array.length;
    const buffer = new ArrayBuffer(l * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < l; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        width: 320,
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: "#111827",
          color: "#fff",
          padding: 12,
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        <h4>Web Voice Assistant</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>
            Status: {connected ? "Connected" : "Disconnected"}
          </div>
          {(isWakeTriggered || recordingRef.current) && (
            <div className='mic-pulse' title='Listening' />
          )}
        </div>
        <div
          style={{
            height: 80,
            overflow: "auto",
            background: "#0b1220",
            padding: 8,
            borderRadius: 8,
          }}
        >
          <div style={{ color: "#9CA3AF" }}>
            {captions} <span style={{ color: "#60A5FA" }}>{partial}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            style={{ flex: 1, padding: 8, borderRadius: 8 }}
          >
            Hold to Speak
          </button>
          <button
            onClick={() => {
              setCaptions("");
              setPartial("");
              setIsSpeaking(false);
              setIsProcessing(false);
            }}
            style={{ padding: 8, borderRadius: 8 }}
          >
            Clear
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
          Wake: {isWakeTriggered ? "Listening…" : "Sleeping"}
          {" · "}
          {isSpeaking ? (
            <span style={{ color: "#34D399" }}>Speaking…</span>
          ) : isProcessing ? (
            <span style={{ color: "#F59E0B" }}>Processing…</span>
          ) : (
            <span>Idle</span>
          )}
        </div>
      </div>
    </div>
  );
}
