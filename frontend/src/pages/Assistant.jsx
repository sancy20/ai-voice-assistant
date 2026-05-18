import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic2, Wifi, WifiOff, Trash2, Radio, Volume2, VolumeX,
  Download, Send, Keyboard, Sparkles, Bell, AlarmClock, CheckSquare,
} from "lucide-react";
import { useAssistant } from "../context/AssistantContext";
import { useAuth } from "../context/AuthContext";
import {
  loadAssistantItems,
  saveAssistantItems,
  clearAssistantItemsByType,
  removeAssistantItem,
  isItemDue,
} from "../components/assistantItems";

const EXAMPLES = [
  "Search for AI news",
  "Play youTube lofi music",
  "What time is it?",
  "Start note mode",
  "Remind me to call mom at 5 pm",
  "Open GitHub",
];

function exportChat(conversation) {
  if (!conversation.length) return;
  const lines = conversation
    .map(m => `[${m.time}] ${m.type === "user" ? "You" : "Assistant"}: ${m.text}`)
    .join("\n");
  const blob = new Blob([lines], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `chat-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 0.2, 0.4].map((delay, i) => (
        <motion.span key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent-fg)" }}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.75, 1.15, 0.75] }}
          transition={{ duration: 1.2, repeat: Infinity, delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function MicOrb({ isListening, isProcessing }) {
  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Ambient radial glow */}
      <div className="absolute pointer-events-none"
        style={{
          width: 280, height: 280,
          borderRadius: "50%",
          background: isListening
            ? "radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 68%)"
            : isProcessing
            ? "radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 68%)"
            : "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 68%)",
          transition: "background 0.6s",
        }} />

      {/* Pulsing rings */}
      {isListening && [0, 1, 2].map(i => (
        <motion.div key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            width:  156 + i * 44,
            height: 156 + i * 44,
            border: "1px solid rgba(139,92,246,0.28)",
          }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 2.0 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.38 }}
        />
      ))}

      <motion.div
        className="relative h-36 w-36 grid place-items-center rounded-full z-10"
        animate={isListening ? { scale: [1, 1.055, 1] } : { scale: 1 }}
        transition={{ duration: 1.8, repeat: isListening ? Infinity : 0, ease: "easeInOut" }}
        style={{
          background: isListening
            ? "linear-gradient(135deg, #7c3aed 0%, #6366f1 60%, #8b5cf6 100%)"
            : isProcessing
            ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))"
            : "linear-gradient(145deg, rgba(99,102,241,0.1), rgba(139,92,246,0.05))",
          border: isListening
            ? "2px solid rgba(255,255,255,0.13)"
            : isProcessing
            ? "2px solid rgba(245,158,11,0.4)"
            : "1.5px solid rgba(139,92,246,0.2)",
          boxShadow: isListening
            ? "0 0 0 1px rgba(139,92,246,0.3), 0 8px 60px rgba(139,92,246,0.5), 0 0 100px rgba(99,102,241,0.2)"
            : isProcessing
            ? "0 4px 32px rgba(245,158,11,0.22)"
            : "0 4px 32px rgba(139,92,246,0.08)",
          transition: "background 0.4s, border 0.4s, box-shadow 0.5s",
        }}>

        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div key="listening"
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
              className="flex items-end gap-[3px]">
              {[0.65, 1.1, 0.55, 1.35, 0.48, 1.05, 0.75].map((h, i) => (
                <motion.div key={i}
                  className="rounded-full bg-white"
                  style={{ width: "3px" }}
                  animate={{ height: [`${h * 5}px`, `${h * 22}px`, `${h * 5}px`] }}
                  transition={{ duration: 0.65 + i * 0.07, repeat: Infinity, delay: i * 0.09, ease: "easeInOut" }}
                />
              ))}
            </motion.div>
          ) : isProcessing ? (
            <motion.div key="processing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}>
                <Sparkles className="h-9 w-9" style={{ color: "#f59e0b" }} />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="idle"
              initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.75 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" fill="var(--accent-fg)" />
                <path d="M5 12c0 3.866 3.134 7 7 7s7-3.134 7-7"
                  stroke="var(--accent-fg)" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="22" stroke="var(--accent-fg)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

const AiAvatar = () => (
  <div className="h-8 w-8 rounded-xl shrink-0 grid place-items-center mt-0.5"
    style={{ background: "var(--accent-grad)", boxShadow: "0 3px 12px rgba(139,92,246,0.3)" }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
      <path d="M5 12c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </div>
);

export default function Assistant() {
  const { user } = useAuth();
  const assistantUserId = user?.id || user?.email || "guest";
  const {
    connStatus, status, isHolding, wakeEnabled,
    partial, conversation, audioLevel,
    noteModeActive, liveNoteText,
    onHoldStart, onHoldEnd, onWakeToggle, clearConversation, sendText,
  } = useAssistant();

  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [textInput,  setTextInput]  = useState("");
  const [inputMode,  setInputMode]  = useState(false);
  const [items, setItems] = useState(() => loadAssistantItems(assistantUserId));
  const [notify, setNotify] = useState(null);
  const [activeItemsType, setActiveItemsType] = useState(null);
  const bottomRef  = useRef(null);
  const holdingRef = useRef(false);
  const inputRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, partial]);

  useEffect(() => {
    if (!ttsEnabled || !conversation.length) return;
    const last = conversation[conversation.length - 1];
    if (last.type !== "assistant") return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(last.text);
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }, [conversation, ttsEnabled]);

  useEffect(() => {
  const refresh = () => {
    const current = loadAssistantItems(assistantUserId);
    setItems(current);

    const dueItem = current.find(isItemDue);

    if (dueItem) {
      setNotify(dueItem);

      const updated = removeAssistantItem(dueItem.id, assistantUserId);
      setItems(updated);

      setTimeout(() => {
        setNotify(null);
      }, 30000);
    }
  };

  refresh();

  const interval = setInterval(refresh, 5000);
  window.addEventListener("storage", refresh);
  window.addEventListener("voiceai-items-updated", refresh);

  return () => {
    clearInterval(interval);
    window.removeEventListener("storage", refresh);
    window.removeEventListener("voiceai-items-updated", refresh);
  };
}, [assistantUserId]);

  const handleKeyDown = useCallback((e) => {
    if (inputMode) return;
    if (e.code !== "Space" || e.repeat) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    e.preventDefault();
    if (!holdingRef.current) { holdingRef.current = true; onHoldStart(); }
  }, [onHoldStart, inputMode]);

  const handleKeyUp = useCallback((e) => {
    if (inputMode) return;
    if (e.code !== "Space") return;
    if (holdingRef.current) { holdingRef.current = false; onHoldEnd(); }
  }, [onHoldEnd, inputMode]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup",   handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup",   handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleSendText = useCallback(async () => {
    const t = textInput.trim();
    if (!t) return;
    setTextInput("");
    await sendText(t);
  }, [textInput, sendText]);

  const handleTextKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); }
  };

  const toggleInputMode = () => {
    setInputMode(v => !v);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const isListening  = isHolding || status === "listening" || status === "awake";
  const isProcessing = status === "processing";
  const statusLabel  = { idle: "Ready", listening: "Listening…", processing: "Thinking…", awake: "Awake" }[status] ?? "Ready";
  const statusColor  = { idle: "var(--fg-4)", listening: "#a78bfa", processing: "#f59e0b", awake: "#10b981" }[status] ?? "var(--fg-4)";

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden" style={{ background: "var(--bg)", }} >
      <AnimatePresence>
          {notify && !activeItemsType && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              className="fixed top-[118px] sm:top-[96px] left-1/2 lg:left-[calc(224px+((100vw-224px)/2))] -translate-x-1/2 z-[220] w-[calc(100%-32px)] max-w-md rounded-2xl border px-4 py-3"
              style={{
                background: "#11121a",
                borderColor: "rgba(139,92,246,0.85)",
                boxShadow: "0 24px 90px rgba(0,0,0,0.95)",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
                  style={{ background: "rgba(139,92,246,0.15)" }}
                >
                  {notify.type === "alarm" ? (
                    <AlarmClock className="h-4 w-4" style={{ color: "var(--accent-fg)" }} />
                  ) : (
                    <Bell className="h-4 w-4" style={{ color: "var(--accent-fg)" }} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>
                    {notify.type === "alarm" ? "Alarm time" : "Reminder"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-3)" }}>
                    {notify.title}
                    {notify.timeText ? ` • ${notify.timeText}` : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setNotify(null)}
                  className="text-xs"
                  style={{ color: "var(--fg-4)" }}
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 border-b"
        style={{ borderColor: "var(--border-s)", background: "var(--bg)" }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-xl shrink-0"
            style={{ background: "var(--accent-grad)", boxShadow: "0 4px 16px rgba(139,92,246,0.35)" }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none tracking-tight" style={{ color: "var(--fg)" }}>VoiceAI</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <motion.div
                className="h-1.5 w-1.5 rounded-full"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: connStatus === "Connected" ? "#10b981" : "#f43f5e" }} />
              <motion.span key={status}
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                className="text-[10px] font-semibold"
                style={{ color: statusColor }}>
                {statusLabel}
              </motion.span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="relative flex items-center gap-2 sm:gap-3 mr-1">
            {[
              { type: "reminder", icon: Bell,        count: items.filter((x) => x.type === "reminder").length,  label: "Reminders", },
              { type: "alarm",    icon: AlarmClock,  count: items.filter((x) => x.type === "alarm").length,     label: "Alarms", },
              { type: "task",     icon: CheckSquare, count: items.filter((x) => x.type === "task").length,      label: "Tasks", },
            ].map(({ type, icon: Icon, count, label }) => (
              <button key={type} type="button" title={label}
                onClick={() =>
                  setActiveItemsType((current) => (current === type ? null : type))
                }
                className="relative h-8 w-8 sm:w-10 grid place-items-center rounded-xl transition-all"
                style={{
                  background: activeItemsType === type || count ? "rgba(139,92,246,0.12)" : "transparent",
                  color:      activeItemsType === type || count ? "#a78bfa" : "var(--fg-4)",
                  border:     activeItemsType === type || count ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                }}
              >
                <Icon className="h-5 w-5" />

                {count > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold grid place-items-center" style={{ background: "var(--accent-fg)", color: "#fff",}}>
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            ))}
            {activeItemsType && (
              <div
                className="fixed sm:absolute top-[118px] sm:top-14 right-4 sm:right-auto sm:left-0 w-[calc(100vw-32px)] sm:w-[320px] rounded-2xl border p-3 z-[300]"
                style={{ background: "#11121a", borderColor: "var(--border)", boxShadow: "0 18px 60px rgba(0,0,0,0.85)", }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--fg-4)" }} >
                    {activeItemsType === "reminder" ? "Reminders" : activeItemsType === "alarm" ? "Alarms" : "Tasks"}
                  </p>

                  <button type="button"
                    onClick={() => {
                      const updated = clearAssistantItemsByType(activeItemsType, assistantUserId);
                      setItems(updated);
                      setActiveItemsType(null);
                    }}
                    className="text-[11px]"
                    style={{ color: "var(--rose)" }} >
                    Clear
                  </button>
                </div>

                {items.filter((x) => x.type === activeItemsType).length === 0 ? (
                  <p className="text-xs py-3" style={{ color: "var(--fg-4)" }}>
                    No {activeItemsType === "reminder" ? "reminders" : activeItemsType === "alarm" ? "alarms" : "tasks"} yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto">
                    {items .filter((x) => x.type === activeItemsType) .slice() .reverse()
                      .map((item) => {
                        const Icon = item.type === "reminder" ? Bell : item.type === "alarm" ? AlarmClock : CheckSquare;

                        return (
                          <div key={`${item.type}-${item.id}`} className="flex items-start gap-2 rounded-xl p-2" style={{ background: "var(--surface-h)", marginBottom: "5px"}} >
                            <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--accent-fg)" }}/>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}> {item.title}</p>
                              <p className="text-xs truncate" style={{ color: "var(--fg-3)" }} >
                                {item.timeText ? item.timeText: item.type === "task" ? "Task" : ""}
                              </p>
                            </div>

                            <button type="button"
                              onClick={() => {
                                const updated = removeAssistantItem(item.id, assistantUserId);
                                setItems(updated);
                              }}
                              className="text-xs px-1" style={{ color: "var(--fg-4)" }} title="Remove">
                              ✕
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
          {[
            { icon: Keyboard,                       active: inputMode,  onClick: toggleInputMode,                                                         title: inputMode ? "Voice mode" : "Type mode" },
            { icon: ttsEnabled ? Volume2 : VolumeX, active: ttsEnabled, onClick: () => { setTtsEnabled(v => !v); window.speechSynthesis.cancel(); },        title: ttsEnabled ? "Mute TTS" : "Enable TTS" },
            { icon: Download,                       active: false,      onClick: () => exportChat(conversation), title: "Export chat", disabled: !conversation.length },
            { icon: Trash2,                         active: false,      onClick: () => { clearConversation(); window.speechSynthesis.cancel(); },            title: "Clear chat", disabled: !conversation.length },
          ].map(({ icon: Icon, active, onClick, title, disabled }) => (
            <button key={title} onClick={onClick} disabled={disabled} title={title}
              className="h-8 w-10 grid place-items-center rounded-xl transition-all disabled:opacity-25"
              style={{
                background:  active ? "rgba(139,92,246,0.12)" : "transparent",
                color:       active ? "#a78bfa"               : "var(--fg-4)",
                border:      active ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
              }}>
               <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0" style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", }} >
        <div className="w-full px-4 sm:px-6 flex flex-col gap-4" style={{ minHeight: "100%", maxWidth: "760px", marginLeft: "auto", marginRight: "auto", paddingTop: conversation.length === 0 ? "24px" : "28px", paddingBottom: "24px", }} >
          {conversation.length === 0 && !partial && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center gap-6 text-center" style={{ minHeight: "calc(100vh - 220px)", paddingTop: "20px", paddingBottom: "20px", }}>

              <MicOrb isListening={isListening} isProcessing={isProcessing} />

              <AnimatePresence mode="wait">
                <motion.div key={`${status}-${inputMode}`}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>
                    {inputMode
                      ? "Type a command"
                      : isListening
                      ? "I'm listening…"
                      : isProcessing
                      ? "Thinking…"
                      : "Say something"}
                  </h2>
                  <p className="text-sm max-w-xs" style={{ color: "var(--fg-4)" }}>
                    {inputMode
                      ? "Press Enter or click Send"
                      : isListening
                      ? "Release when you're done speaking"
                      : <>Hold <kbd className="mx-1 px-1.5 py-0.5 rounded border text-[11px] font-mono"
                          style={{ borderColor: "var(--border)", background: "var(--surface-h)", color: "var(--fg-3)" }}>Space</kbd>
                          to speak, or use the button below</>}
                  </p>
                </motion.div>
              </AnimatePresence>

              {!isListening && !isProcessing && (
                <div className="grid grid-cols-2 gap-2 w-full max-w-xs sm:max-w-sm">
                  {EXAMPLES.map((ex, i) => (
                    <motion.button key={ex}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (inputMode) { setTextInput(ex); inputRef.current?.focus(); }
                        else { sendText(ex); }
                      }}
                      className="rounded-2xl px-3 py-2.5 text-xs text-left transition-all"
                      style={{ background: "var(--surface)", color: "var(--fg-3)", border: "1px solid var(--border-s)" }}>
                      <span className="line-clamp-1">{ex}</span>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
          {/* {conversation.length > 0 && <div className="flex-1" />} */}

          <AnimatePresence>
            {noteModeActive && (
              <motion.div
                key="live-note"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.22 }}
                className="rounded-2xl border px-4 py-3"
                style={{
                  background: "rgba(139,92,246,0.08)",
                  borderColor: "rgba(139,92,246,0.25)",
                  color: "var(--fg)",
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>
                    Live Note Mode
                  </p>
                  <span className="text-[10px] font-semibold" style={{ color: "#10b981" }}>
                    Listening…
                  </span>
                </div>

                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--fg-2)" }}>
                  {liveNoteText || "Start speaking. Your note will appear here..."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {conversation.length > 0 && (
            <div style={{ height: "12px", flexShrink: 0 }} />
          )}
          <AnimatePresence initial={false}>
            {conversation.map((msg) => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className={`flex gap-2.5 ${msg.type === "user" ? "justify-end" : "justify-start"}`}>

                {msg.type === "assistant" && <AiAvatar />}

                <div className="max-w-[80%] sm:max-w-md">
                  <div className="px-4 py-3 text-sm leading-relaxed"
                    style={msg.type === "user"
                      ? {
                          background: "var(--accent-grad)",
                          color: "#fff",
                          borderRadius: "18px 18px 4px 18px",
                          boxShadow: "0 4px 18px rgba(139,92,246,0.28)",
                          fontWeight: 500,
                        }
                      : {
                          background: "var(--surface)",
                          color: "var(--fg-2)",
                          border: "1px solid var(--border-s)",
                          borderRadius: "4px 18px 18px 18px",
                        }}>
                    {msg.text}
                  </div>
                  <p className={`text-[10px] mt-1 px-1.5 ${msg.type === "user" ? "text-right" : ""}`}
                    style={{ color: "var(--fg-4)" }}>
                    {msg.time}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <AnimatePresence>
            {partial && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex justify-end">
                <div className="max-w-[80%] sm:max-w-md">
                  <div className="px-4 py-3 text-sm italic"
                    style={{
                      background: "rgba(139,92,246,0.08)",
                      color: "var(--fg-3)",
                      border: "1px solid rgba(139,92,246,0.18)",
                      borderRadius: "18px 18px 4px 18px",
                    }}>
                    {partial}…
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isProcessing && !partial && conversation.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-start gap-2.5"
              >
                <AiAvatar />
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-s)",
                    borderRadius: "4px 18px 18px 18px",
                  }}
                >
                  <ThinkingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>
      <div className="shrink-0 border-t" style={{ borderColor: "var(--border-s)", background: "var(--bg)", zIndex: 20, }} >
        <div className="w-full px-4 sm:px-5 space-y-2" style={{ maxWidth: "760px", marginLeft: "auto", marginRight: "auto", paddingTop: "14px", paddingBottom: "14px", }} >

          <AnimatePresence>
            {inputMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}
                className="overflow-hidden">
                <div className="flex gap-2 pt-0.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    onKeyDown={handleTextKeyDown}
                    placeholder="Type a command…"
                    className="flex-1 rounded-2xl px-4 py-2.5 text-sm outline-none"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)",marginBottom: "15px" }}
                  />
                  <motion.button
                    onClick={handleSendText}
                    disabled={!textInput.trim() || isProcessing}
                    whileTap={{ scale: 0.93 }}
                    className="h-10 w-10 grid place-items-center rounded-2xl disabled:opacity-30 shrink-0"
                    style={{ background: "var(--accent-grad)", boxShadow: "0 4px 14px rgba(139,92,246,0.32)" }}>
                    <Send className="h-4 w-4 text-white" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2">
            <button
              onClick={onWakeToggle}
              title={wakeEnabled ? "Disable wake word" : "Enable wake word"}
              className="flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 text-xs font-semibold transition-all shrink-0"
              style={{
                background:   wakeEnabled ? "rgba(16,185,129,0.1)" : "var(--surface)",
                color:        wakeEnabled ? "#10b981"              : "var(--fg-3)",
                borderColor:  wakeEnabled ? "rgba(16,185,129,0.3)" : "var(--border)",
              }}>
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{wakeEnabled ? "Wake on" : "Wake"}</span>
            </button>

            <motion.button
              onMouseDown={onHoldStart}
              onMouseUp={onHoldEnd}
              onMouseLeave={() => isHolding && onHoldEnd()}
              onTouchStart={e => { e.preventDefault(); onHoldStart(); }}
              onTouchEnd={onHoldEnd}
              whileTap={{ scale: 0.98 }}
              className="flex-1 relative flex items-center justify-center gap-2.5 rounded-2xl py-2.5 text-sm font-bold transition-all select-none overflow-hidden"
              style={{
                background:  isHolding  ? "var(--accent-grad)" : isProcessing ? "rgba(245,158,11,0.1)" : "var(--surface)",
                color:       isHolding  ? "#fff"               : isProcessing ? "#f59e0b"              : "var(--fg-2)",
                border:      isHolding  ? "none"               : isProcessing
                             ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border)",
                boxShadow:   isHolding  ? "0 6px 28px rgba(139,92,246,0.42)" : "none",
              }}>
              {isHolding && (
                <motion.div className="absolute inset-0"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08), transparent)", borderRadius: "inherit" }}
                />
              )}
              <Mic2 className="h-4 w-4 shrink-0 relative z-10" />
              <span className="relative z-10">
                {isHolding ? "Release to send" : isProcessing ? "Processing…" : "Hold to speak"}
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
