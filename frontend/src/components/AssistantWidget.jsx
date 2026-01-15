import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function AssistantWidget() {
  const socketRef = useRef(null);

  const [status, setStatus] = useState("Disconnected");
  const [partial, setPartial] = useState("");
  const [finalText, setFinalText] = useState("");
  const [logs, setLogs] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Audio refs
  const recordingRef = useRef(false);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaRef = useRef(null);
  const pendingBytesRef = useRef(null);
  const flushTimerRef = useRef(null);

  const addLog = (msg) => {
    setLogs((prev) =>
      [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 12)
    );
  };

  const executeIntent = (intentTuple, intentDetails) => {
    if (!intentTuple || !Array.isArray(intentTuple) || intentTuple.length < 1) {
      addLog("No intent to execute");
      return;
    }

    const [type, value] = intentTuple;

    addLog(`Intent: ${type} ${value ? `(${value})` : ""}`);

    // SCROLL
    if (type === "scroll") {
      const amount = 400;
      if (value === "down")
        window.scrollBy({ top: amount, left: 0, behavior: "smooth" });
      if (value === "up")
        window.scrollBy({ top: -amount, left: 0, behavior: "smooth" });
      return;
    }

    // SEARCH
    if (type === "search") {
      const query = (value || "").trim();
      if (!query) {
        addLog("Search has empty query");
        return;
      }

      const candidates = [
        ...document.querySelectorAll('input[type="search"]'),
        ...document.querySelectorAll('input[name*="search" i]'),
        ...document.querySelectorAll('input[id*="search" i]'),
        ...document.querySelectorAll('input[class*="search" i]'),
      ];

      const input =
        candidates.find(
          (el) => el && !el.disabled && el.offsetParent !== null
        ) || candidates[0];

      if (!input) {
        addLog("No search input found on this page");
        return;
      }

      input.focus();
      input.value = query;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      // submit if in a form
      const form = input.closest("form");
      if (form) {
        form.requestSubmit ? form.requestSubmit() : form.submit();
        addLog(`Search submitted: "${query}"`);
      } else {
        // otherwise press Enter
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            key: "Enter",
            code: "Enter",
          })
        );
        addLog(`Search entered: "${query}"`);
      }
      return;
    }

    // NAVIGATE
    if (type === "navigate") {
      if (value === "back") {
        window.history.back();
        return;
      }
      if (value === "home") {
        window.location.href = "/";
        return;
      }
      if (value === "settings") {
        window.location.href = "/settings";
        return;
      }
      addLog(`Unknown navigate target: ${value}`);
      return;
    }

    // TIME
    if (type === "time") {
      const t = (value || "").trim();
      if (t) {
        addLog(`Time: ${t}`);
      } else {
        addLog("Time intent received");
      }
      return;
    }

    addLog(`Unhandled intent: ${type}`);
  };

  useEffect(() => {
    const socket = io("http://localhost:3000");
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("Connected");
      addLog("Connected to gateway");
    });

    socket.on("disconnect", () => {
      setStatus("Disconnected");
      addLog("Disconnected");
    });

    socket.on("partial_transcript", (payload) => {
      const text = payload?.text || "";
      setPartial(text);
    });

    socket.on("final_transcript", (payload) => {
      const text = payload?.text || "";
      const intent = payload?.intent || null;
      const intentDetails = payload?.intent_details || null;

      setFinalText(text);
      setPartial("");
      setIsProcessing(false);
      executeIntent(intent, intentDetails);
    });

    return () => {
      try {
        socket.disconnect();
      } catch (_) {}
    };
  }, []);

  const startRecording = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;

    setIsSpeaking(true);
    setIsProcessing(false);
    setPartial("");
    setFinalText("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;

      // send sample rate
      socketRef.current?.emit("audio_meta", { sampleRate: ctx.sampleRate });

      // Load your pcm-processor as AudioWorklet
      await ctx.audioWorklet.addModule("/pcm-processor.js");

      const src = ctx.createMediaStreamSource(stream);
      sourceRef.current = src;

      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      processorRef.current = worklet;

      worklet.port.onmessage = (e) => {
        if (!recordingRef.current) return;

        const buf = e.data;
        const chunk =
          buf instanceof ArrayBuffer
            ? new Uint8Array(buf)
            : new Uint8Array(buf.buffer);

        // Batch chunks
        if (!pendingBytesRef.current) {
          pendingBytesRef.current = chunk;
        } else {
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

            if (
              toSend &&
              toSend.byteLength > 0 &&
              socketRef.current?.connected
            ) {
              socketRef.current.emit("audio_chunk", toSend);
            }
          }, 50);
        }
      };

      src.connect(worklet);
      const zeroGain = ctx.createGain();
      zeroGain.gain.value = 0.0;
      worklet.connect(zeroGain);
      zeroGain.connect(ctx.destination);
      addLog(`Audio started (sr=${ctx.sampleRate})`);
    } catch (err) {
      recordingRef.current = false;
      setIsSpeaking(false);
      addLog(`Mic error: ${err?.message || String(err)}`);
    }
  };

  const stopRecording = () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    try {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      const toSend = pendingBytesRef.current;
      pendingBytesRef.current = null;
      if (toSend && toSend.byteLength > 0 && socketRef.current?.connected) {
        socketRef.current.emit("audio_chunk", toSend);
      }
    } catch (_) {}

    if (socketRef.current?.connected) {
      setIsProcessing(true);
      setTimeout(() => socketRef.current.emit("audio_end"), 80);
    }

    try {
      const proc = processorRef.current;
      if (proc) {
        try {
          proc.port.onmessage = null;
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
      if (stream?.getTracks) stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
    } catch (_) {}

    setIsSpeaking(false);
  };

  const clearUI = () => {
    setPartial("");
    setFinalText("");
    setLogs([]);
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        width: 360,
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          background: "#0b1220",
          color: "#fff",
          padding: 16,
          borderRadius: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 700 }}>Web Voice Assistant</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Status: {status} {status === "Connected" ? "🟢" : "🔴"}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            minHeight: 64,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
          }}
        >
          {partial ? (
            <div>
              <span style={{ opacity: 0.6 }}>(partial)</span>{" "}
              <span style={{ color: "#6aa7ff" }}>{partial}</span>
            </div>
          ) : null}
          {finalText ? (
            <div style={{ marginTop: 6 }}>
              <span style={{ opacity: 0.6 }}>(final)</span>{" "}
              <span>{finalText}</span>
            </div>
          ) : null}
          {!partial && !finalText ? (
            <div style={{ opacity: 0.5 }}>
              Say: “scroll down”, “go home”, “search for cats”
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={() => {
              if (isSpeaking) stopRecording();
            }}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: isSpeaking ? "#233a6b" : "#13213e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {isSpeaking ? "Release to Stop" : "Hold to Speak"}
          </button>

          <button
            onClick={clearUI}
            style={{
              width: 72,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#13213e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          Wake: Sleeping ·{" "}
          {isSpeaking ? "Speaking…" : isProcessing ? "Processing…" : "Idle"}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          <div style={{ fontWeight: 650, marginBottom: 6 }}>Action log</div>
          <div
            style={{
              maxHeight: 120,
              overflow: "auto",
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ opacity: 0.6 }}>No actions yet.</div>
            ) : null}
            {logs.map((l, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
