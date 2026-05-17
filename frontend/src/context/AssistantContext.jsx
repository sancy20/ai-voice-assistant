import { createContext, useContext, useRef, useState, useEffect, useCallback } from "react";
import { emitAction, emitMedia, emitMediaControl, emitResults, emitSearchControl } from "../components/actionBus";
import { API_BASE, AUDIO_WS_URL } from "../config/api";
import { useAuth } from "./AuthContext";

const Ctx = createContext(null);

const SAFE_SITES = {
  chatgpt:   "https://chat.openai.com/",
  youtube:   "https://www.youtube.com/",
  google:    "https://www.google.com/",
  github:    "https://github.com/",
  wikipedia: "https://www.wikipedia.org/",
  twitter:   "https://twitter.com/",
  x:         "https://x.com/",
  reddit:    "https://www.reddit.com/",
  netflix:   "https://www.netflix.com/",
  spotify:   "https://open.spotify.com/",
  gmail:     "https://mail.google.com/",
  discord:   "https://discord.com/",
  facebook:  "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
  tiktok:    "https://www.tiktok.com/",
  twitch:    "https://www.twitch.tv/",
  amazon:    "https://www.amazon.com/",
  linkedin:  "https://www.linkedin.com/",
};

export function AssistantProvider({ children }) {
  const { user, token, refreshUser } = useAuth();
  const sessionId = useRef(crypto?.randomUUID?.() || `sess_${Date.now()}`);

  const [connStatus, setConnStatus] = useState("Disconnected");
  const [status, setStatus]         = useState("idle");
  const [isHolding, setIsHolding]   = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [partial, setPartial]       = useState("");
  const [finalText, setFinalText]   = useState("");
  const [conversation, setConversation] = useState([]);
  const [liveNoteText, setLiveNoteText] = useState("");
  const [noteModeActive, setNoteModeActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const holdRef        = useRef(false);
  const wakeRef        = useRef(false);
  const noteModeRef    = useRef(false);
  const recordingRef   = useRef(false);
  const micStartedRef  = useRef(false);
  const audioCtxRef    = useRef(null);
  const processorRef   = useRef(null);
  const sourceRef      = useRef(null);
  const mediaRef       = useRef(null);
  const zeroGainRef    = useRef(null);
  const pendingRef     = useRef(null);
  const flushRef       = useRef(null);
  const levelRef       = useRef(0);
  const rafRef         = useRef(null);
  const wsRef          = useRef(null);
  const reconnectRef   = useRef(null);
  const reconnectDelay = useRef(1000);
  const unmountedRef   = useRef(false);

  const setStatusSafe = useCallback((s) => setStatus(p => p === s ? p : s), []);

  const addMsg = useCallback((type, text) => {
    setConversation(prev => [...prev.slice(-49), {
      id: `${Date.now()}-${Math.random()}`,
      type, text,
      time: new Date().toLocaleTimeString(),
    }]);
  }, []);

  const openTab = (url) => {
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  useEffect(() => {
    setConversation([]);
    setPartial("");
    setFinalText("");
    emitResults(null);

    sessionId.current = crypto?.randomUUID?.() || `sess_${Date.now()}`;
  }, [user?.id]);

  const doIntent = useCallback(([type, value, amount]) => {
    if (type === "scroll") {
      const px = Number.isFinite(amount) ? amount : 420;
      window.scrollBy({ top: value === "up" ? -px : px, behavior: "smooth" });
    } else if (type === "navigate") {
      if (value === "back") window.history.back();
      else if (value === "home") window.location.href = "/";
    } else if (type === "open") {
      const rawTarget = String(value || "") .toLowerCase() .replace(/^open\s+/i, "") .trim();
      const siteAliases = { git: "github", "git hub": "github", openai: "chatgpt", };
      const target = siteAliases[rawTarget] || rawTarget;
      const url = SAFE_SITES[(value || "").toLowerCase().trim()];
      if (url) openTab(url);
    } else if (type === "search") {
      const q = String(value || "").trim();
      if (q) openTab(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
    }
  }, []);

  const handleMsg = useCallback((data) => {
    if (!data || typeof data !== "object") return;

    if (data.token_usage) {
      refreshUser?.();
    }

    if (data.type === "partial") {
      if (holdRef.current || wakeRef.current || noteModeRef.current) {
        setPartial(data.text || "");
        setStatusSafe("listening");
      }
      return;
    }
    if (data.type === "wake") { setStatusSafe("awake"); return; }
    if (data.type === "sleep") { setStatusSafe("idle"); return; }
    if (data.type === "listening" || data.type === "armed_after_wake") { setStatusSafe("listening"); return; }
    if (data.type === "idle" || data.type === "awake_idle") return;

    if (data.type === "note_mode_started") {
      noteModeRef.current = true;
      setNoteModeActive(true);
      setLiveNoteText("");
      const message = data.message || "Note mode is now on. I am listening continuously.";
      setFinalText(message);
      setPartial("");
      setStatusSafe("listening");
      addMsg("assistant", message);
      emitAction({ text: message, kind: "say", durationMs: 5000 });
      try {
        if (!recordingRef.current) {
          ensureMic();
        }
        sendConfig("ptt");
      } catch {}

      return;
    }
    if (data.type === "note_mode_update") {
      const noteText = data.text || "";
      setLiveNoteText(noteText);
      setFinalText(noteText);
      setPartial("");
      setStatusSafe("listening");
      return;
    }
    if (data.type === "note_mode_stopped") {
      noteModeRef.current = false;
      setNoteModeActive(false);
      const finalNote = data.note_text || liveNoteText || "";
      setLiveNoteText(finalNote);
      setFinalText(finalNote);
      setPartial("");
      setStatusSafe("idle");
      addMsg("assistant", finalNote ? `Note saved: ${finalNote}` : "Note mode stopped.");
      emitAction({
        text: finalNote ? "Note saved successfully." : "Note mode stopped.",
        kind: "say",
        durationMs: 5000,
      });
      setTimeout(async () => {
        if (!wakeRef.current && !holdRef.current) {
          await stopAudio();
        }
      }, 300);
      return;
    }

    if (data.type === "reminder_created") {
      const reminder = data.reminder || {};
      const task = reminder.task || reminder.text || "your reminder";
      const time = reminder.time_text || reminder.time || "";

      const message = data.message || `Reminder set: ${task}${time ? ` at ${time}` : ""}`;

      setFinalText(message);
      setPartial("");
      setStatusSafe("idle");

      addMsg("assistant", message);
      emitAction({
        text: message,
        kind: "say",
        durationMs: 6000,
      });

      setTimeout(async () => {
        if (!wakeRef.current && !noteModeRef.current && !holdRef.current) {
          await stopAudio();
        }
      }, 300);

      return;
    }

    if (data.type === "assistant_response") {
      const text    = data.transcript || "";
      const message = data.message || "";
      const action  = data.action || {};
      const kind    = action.kind;
      const aData   = action.data || {};

      setFinalText(text || message);
      setPartial("");
      setStatusSafe("processing");

      if (text && !data.fromTextInput) addMsg("user", text);
      if (message) {
        addMsg("assistant", message);
        emitAction({ text: message, kind: "say", durationMs: 12000 });
      }

      if (kind === "search_preview") {
        emitResults({
          kind: "search_results",
          title: "Search Results",
          subtitle: aData?.query ? `Top results for "${aData.query}"` : "Top search results",
          items: aData?.results || [],
        });
      } else if (kind === "media_search") {
        if (aData?.results?.length) {
          emitMedia({
            provider: aData.provider || "youtube",
            query: aData.query || "",
            results: aData.results,
            selectedIndex: 0
          });
          emitAction({
            text: message || "Opening media results",
            kind: "say",
            durationMs: 6000
          });
        } else {
          const msg = "No YouTube results found. Please check YOUTUBE_API_KEY or try another command.";
          addMsg("assistant", msg);
          emitAction({ text: msg, kind: "warning", durationMs: 6000 });
        }
      } else if (kind === "media_pause")   { emitMediaControl({ type: "pause" });  emitAction({ text: "Media paused",          kind: "say", durationMs: 2500 }); }
        else if (kind === "media_resume")  { emitMediaControl({ type: "resume" }); emitAction({ text: "Media resumed",         kind: "say", durationMs: 2500 }); }
        else if (kind === "media_next")    { emitMediaControl({ type: "next" });   emitAction({ text: "Playing next",          kind: "say", durationMs: 2500 }); }
        else if (kind === "media_prev")    { emitMediaControl({ type: "prev" });   emitAction({ text: "Playing previous",      kind: "say", durationMs: 2500 }); }
        else if (kind === "media_select")  { emitMediaControl({ type: "select", index: aData.index || 1 }); emitAction({ text: `Playing result ${aData.index || 1}`, kind: "say", durationMs: 2500 }); }
        else if (kind === "search_next")   { emitSearchControl({ type: "next" });  emitAction({ text: "Next result",           kind: "search", durationMs: 2500 }); }
        else if (kind === "search_prev")   { emitSearchControl({ type: "prev" });  emitAction({ text: "Previous result",       kind: "search", durationMs: 2500 }); }
        else if (kind === "search_open_result") { emitSearchControl({ type: "open", index: aData.index || 1 }); emitAction({ text: `Opening result ${aData.index || 1}`, kind: "search", durationMs: 2500 }); }
        else if (kind === "open") {
          const rawTarget = String(aData.target || "") .toLowerCase() .replace(/^open\s+/i, "") .trim(); if ( rawTarget.includes("result") || ["first", "second", "third", "fourth", "fifth"].includes(rawTarget) ) { emitAction({ text: "Please use the search result command again.", kind: "warning", durationMs: 4000, }); return; }
          const siteAliases = { git: "github", "git hub": "github", openai: "chatgpt", };
          const target = siteAliases[rawTarget] || rawTarget;
          const url = SAFE_SITES[target] 
            || (target.includes(".") ? `https://${target}` : `https://www.${target}.com`);
          emitAction({ text: `Open ${target}`, kind: "open_url", url, durationMs: 14000, });
        }
        else if (kind === "scroll")  { setTimeout(() => doIntent(["scroll", aData.direction || "down"]), 650); }
        else if (kind === "navigate"){ setTimeout(() => doIntent(["navigate", aData.direction || "back"]), 650); }

      setTimeout(() => {
        if (!holdRef.current && !noteModeRef.current) { setPartial(""); setStatusSafe("idle"); }
      }, 1200);
      return;
    }

    if (data.type === "assistant_clarification") {
      const message = data.message || "";
      setFinalText(message);
      setPartial("");
      setStatusSafe("processing");
      if (message) { addMsg("assistant", message); emitAction({ text: message, kind: "say", durationMs: 12000 }); }
      setTimeout(() => { if (!holdRef.current) { setPartial(""); setStatusSafe("idle"); } }, 1200);
      return;
    }

    if (data.type === "no_speech" || data.type === "empty") {
      if (noteModeRef.current) {
        setStatusSafe("listening");
        return;
      }

      if (!holdRef.current) {
        setStatusSafe("idle");
      }
    }
  }, [setStatusSafe, addMsg, doIntent, refreshUser]);

  const connectWS = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }

    const ws = new WebSocket(AUDIO_WS_URL);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }

      reconnectDelay.current = 1000;
      setConnStatus("Connected");

      ws.send(JSON.stringify({
        type: "config",
        session_id: sessionId.current,
        sample_rate: audioCtxRef.current?.sampleRate || 16000,
        model_key: "base",
        wake_mode: wakeRef.current ? "wake" : "ptt",
        token,
      }));
    };

    ws.onmessage = (e) => { try { handleMsg(JSON.parse(e.data)); } catch {} };
    ws.onerror   = () => {};
    ws.onclose   = () => {
      if (unmountedRef.current) return;
      setConnStatus("Reconnecting");
      const delay = Math.min(reconnectDelay.current, 30000);
      reconnectDelay.current = Math.min(delay * 2, 30000);
      reconnectRef.current = setTimeout(() => connectWS(), delay);
    };

    wsRef.current = ws;
  }, [handleMsg]);

  const sendConfig = (wake_mode) => {
    wsRef.current?.send(JSON.stringify({
      type: "config", session_id: sessionId.current,
      sample_rate: audioCtxRef.current?.sampleRate || 16000,
      model_key: "base", wake_mode, token,
    }));
  };

  const startLevelLoop = () => {
    const tick = () => {
      setAudioLevel(p => Math.max(0, Math.min(100, Math.round(p * 0.85 + levelRef.current * 0.15))));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  const stopLevelLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null; levelRef.current = 0; setAudioLevel(0);
  };

  const stopAudio = async () => {
    if (flushRef.current) { clearTimeout(flushRef.current); flushRef.current = null; }
    pendingRef.current = null;
    try { processorRef.current?.port && (processorRef.current.port.onmessage = null); processorRef.current?.disconnect(); } catch {}
    processorRef.current = null;
    try { sourceRef.current?.disconnect(); } catch {}; sourceRef.current = null;
    try { zeroGainRef.current?.disconnect(); } catch {}; zeroGainRef.current = null;
    try { mediaRef.current?.getTracks().forEach(t => t.stop()); } catch {}; mediaRef.current = null;
    try { if (audioCtxRef.current) { await audioCtxRef.current.close(); audioCtxRef.current = null; } } catch {}
    recordingRef.current = false; micStartedRef.current = false; levelRef.current = 0; setAudioLevel(0);
    stopLevelLoop();
  };

  const startAudio = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true, channelCount: 1 },
    });
    mediaRef.current = stream;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    await ctx.audioWorklet.addModule("/pcm-processor.js");
    const src = ctx.createMediaStreamSource(stream);
    sourceRef.current = src;
    const worklet = new AudioWorkletNode(ctx, "pcm-processor");
    processorRef.current = worklet;
    startLevelLoop();
    worklet.port.onmessage = (e) => {
      if (!recordingRef.current) return;
      const chunk = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : new Uint8Array(e.data.buffer);
      let maxAbs = 0;
      for (let i = 0; i < Math.min(chunk.byteLength, 4000); i += 2) {
        const s = ((chunk[i] | (chunk[i + 1] << 8)) << 16) >> 16;
        const a = Math.abs(s); if (a > maxAbs) maxAbs = a;
      }
      levelRef.current = Math.max(levelRef.current, (maxAbs / 32768) * 100);
      if (!pendingRef.current) { pendingRef.current = chunk; }
      else {
        const merged = new Uint8Array(pendingRef.current.byteLength + chunk.byteLength);
        merged.set(pendingRef.current, 0); merged.set(chunk, pendingRef.current.byteLength);
        pendingRef.current = merged;
      }
      if (!flushRef.current) {
        flushRef.current = setTimeout(() => {
          flushRef.current = null;
          const toSend = pendingRef.current; pendingRef.current = null;
          if (toSend?.byteLength && (holdRef.current || wakeRef.current || noteModeRef.current)) {
            if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(toSend);
          }
          levelRef.current *= 0.35;
        }, 200);
      }
    };
    src.connect(worklet);
    const zg = ctx.createGain(); zg.gain.value = 0;
    zeroGainRef.current = zg;
    worklet.connect(zg); zg.connect(ctx.destination);
    sendConfig(wakeRef.current ? "wake" : "ptt");
  };

  const ensureMic = async () => {
    if (micStartedRef.current) return;
    micStartedRef.current = true;
    try { await startAudio(); } catch { micStartedRef.current = false; throw new Error("Mic failed"); }
  };

  const onHoldStart = async () => {
    holdRef.current = true; wakeRef.current = false;
    setIsHolding(true); setWakeEnabled(false);
    try { await ensureMic(); } catch { setIsHolding(false); holdRef.current = false; return; }
    sendConfig("ptt");
    setStatusSafe("listening");
  };

  const onHoldEnd = async () => {
    setIsHolding(false);
    holdRef.current = false;
    try {
      setStatusSafe("processing");
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: "flush" }));
    } catch {
      emitAction({ text: "Not connected", kind: "disconnect", durationMs: 2500 });
      setStatusSafe("idle");
    } finally {
      if (wakeRef.current) {
        sendConfig("wake");
      } else {
        setTimeout(async () => {
          if (!wakeRef.current && !noteModeRef.current) {
            await stopAudio();
          } else {
            sendConfig(noteModeRef.current ? "ptt" : "wake");
          }
        }, 1500);
      }
    }
  };

  const onWakeToggle = async () => {
    if (wakeRef.current) {
      wakeRef.current = false; setWakeEnabled(false);
      setStatusSafe("idle");
      if (!holdRef.current) await stopAudio();
    } else {
      try {
        await ensureMic();
        wakeRef.current = true; setWakeEnabled(true);
        sendConfig("wake");
        setStatusSafe("idle");
        emitAction({ text: "Wake mode enabled", kind: "wake", durationMs: 1800 });
      } catch {
        emitAction({ text: "Mic unavailable", kind: "disconnect", durationMs: 2500 });
      }
    }
  };

  const clearConversation = () => {
    setPartial(""); setFinalText(""); setConversation([]); emitResults(null);
  };

  const sendText = useCallback(async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    addMsg("user", trimmed);
    setStatusSafe("processing");
    try {
      const res = await fetch(`${API_BASE}/assistant/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        handleMsg({ ...data, fromTextInput: true });
      } else {
        let message = "Sorry, I couldn't process that request.";

        try {
          const err = await res.json();
          message = err.detail || message;
        } catch {}

        addMsg("assistant", message);
        emitAction({ text: message, kind: "warning", durationMs: 6000 });
        setStatusSafe("idle");
      }
    } catch {
      addMsg("assistant", "Connection error. Please check the server.");
      setStatusSafe("idle");
    }
  }, [addMsg, setStatusSafe, handleMsg, token]);

  useEffect(() => {
    unmountedRef.current = false;
    connectWS();
    return () => {
      unmountedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  return (
    <Ctx.Provider value={{
      connStatus, status, isHolding, wakeEnabled,
      partial, finalText, conversation, audioLevel,
      noteModeActive, liveNoteText,
      onHoldStart, onHoldEnd, onWakeToggle, clearConversation, sendText,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAssistant = () => useContext(Ctx);
