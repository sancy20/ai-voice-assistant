import { useRef, useEffect } from "react";
import { motion, useMotionValue, AnimatePresence } from "framer-motion";
import { Mic, Loader2 } from "lucide-react";

const SAVED_POS_KEY = "mic_position";

function loadPos(fallback) {
  try {
    const s = localStorage.getItem(SAVED_POS_KEY);
    if (s) {
      const pos = JSON.parse(s);
      const maxX = window.innerWidth  - 64;
      const maxY = window.innerHeight - 96;
      return {
        x: Math.max(8, Math.min(pos.x, maxX)),
        y: Math.max(8, Math.min(pos.y, maxY)),
      };
    }
  } catch {}
  return fallback;
}

export default function FloatingMic({
  status = "idle",
  isHolding = false,
  onHoldStart,
  onHoldEnd,
  wakeEnabled = false,
  audioLevel = 0,
}) {
  const constraintsRef = useRef(null);
  const isDragging     = useRef(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const fallback = {
    x: typeof window !== "undefined" ? window.innerWidth  - 76 : 300,
    y: typeof window !== "undefined" ? window.innerHeight - (isMobile ? 140 : 120) : 500,
  };
  const saved = loadPos(fallback);
  const mx = useMotionValue(saved.x);
  const my = useMotionValue(saved.y);

  useEffect(() => {
    const u1 = mx.on("change", v =>
      localStorage.setItem(SAVED_POS_KEY, JSON.stringify({ x: v, y: my.get() }))
    );
    const u2 = my.on("change", v =>
      localStorage.setItem(SAVED_POS_KEY, JSON.stringify({ x: mx.get(), y: v }))
    );
    return () => { u1(); u2(); };
  }, [mx, my]);

  const isListening  = isHolding || status === "listening" || status === "awake";
  const isProcessing = status === "processing";

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40" />

      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.04}
        dragMomentum={false}
        style={{ x: mx, y: my, position: "fixed", zIndex: 55, touchAction: "none" }}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={() => { setTimeout(() => { isDragging.current = false; }, 80); }}
        whileDrag={{ scale: 0.9 }}
      >
        {/* Outer ambient ring */}
        <AnimatePresence>
          {isListening && (
            <>
              <motion.span key="ring1"
                className="absolute rounded-full"
                style={{ inset: -4, background: "rgba(139,92,246,0.10)" }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.1, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span key="ring2"
                className="absolute rounded-full"
                style={{ inset: -4, background: "rgba(99,102,241,0.08)" }}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.7, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Audio level reactive ring */}
        {isListening && audioLevel > 8 && (
          <motion.span
            className="absolute rounded-full"
            style={{ inset: -2 }}
            animate={{ scale: 1 + (audioLevel / 100) * 0.28 }}
            transition={{ duration: 0.08 }}
            style={{ background: "rgba(139,92,246,0.12)", borderRadius: "50%", position: "absolute", inset: -2 }}
          />
        )}

        {/* Button */}
        <motion.button
          whileHover={{ scale: isDragging.current ? 1 : 1.06 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
          onMouseDown={() => !isDragging.current && onHoldStart?.()}
          onMouseUp={() => !isDragging.current && onHoldEnd?.()}
          onMouseLeave={() => isHolding && !isDragging.current && onHoldEnd?.()}
          onTouchStart={e => { e.preventDefault(); if (!isDragging.current) onHoldStart?.(); }}
          onTouchEnd={() => !isDragging.current && onHoldEnd?.()}
          onClick={() => { if (isDragging.current) return; }}
          className="relative grid h-14 w-14 place-items-center rounded-full select-none"
          style={{
            background: isListening
              ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
              : isProcessing
              ? "var(--bg-subtle)"
              : "var(--bg-subtle)",
            border: `1px solid ${
              isListening ? "rgba(139,92,246,0.4)" : isProcessing ? "var(--border)" : "var(--border)"
            }`,
            boxShadow: isListening
              ? "0 4px 24px rgba(139,92,246,0.4), 0 0 0 1px rgba(139,92,246,0.2)"
              : "0 4px 12px rgba(0,0,0,0.35)",
            transition: "background 0.2s, box-shadow 0.2s, border-color 0.2s",
            cursor: "grab",
          }}>

          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.span key="p"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}>
                <Loader2 className="h-5 w-5 spin-slow" style={{ color: "var(--amber)" }} />
              </motion.span>
            ) : (
              <motion.span key="m"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}>
                <Mic className="h-5 w-5" style={{ color: isListening ? "#fff" : "var(--fg-3)" }} />
              </motion.span>
            )}
          </AnimatePresence>

          {/* Wake dot */}
          <AnimatePresence>
            {wakeEnabled && !isListening && (
              <motion.span
                key="dot"
                initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full"
                style={{
                  background: "var(--green)",
                  border: "2px solid var(--bg)",
                  boxShadow: "0 0 6px rgba(16,185,129,0.5)",
                }}
              />
            )}
          </AnimatePresence>
        </motion.button>

        {/* Label */}
        <div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] pointer-events-none font-medium"
          style={{ color: isListening ? "#a78bfa" : isProcessing ? "var(--amber)" : "var(--fg-4)" }}>
          {isProcessing ? "Processing" : isListening ? "Listening" : "Hold"}
        </div>
      </motion.div>
    </>
  );
}
