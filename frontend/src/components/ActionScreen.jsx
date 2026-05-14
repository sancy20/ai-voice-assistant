import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Wifi, WifiOff, Search, ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { subscribeAction } from "./actionBus";

// Per-kind color accent (left border + icon tint). Background is always var(--bg-subtle).
const KIND = {
  wake:        { color: "var(--green)",     border: "rgba(34,197,94,0.35)"   },
  disconnect:  { color: "var(--rose)",      border: "rgba(239,68,68,0.35)"   },
  say:         { color: "var(--fg-3)",      border: "var(--border)"          },
  ptt:         { color: "var(--fg-3)",      border: "var(--border)"          },
  search:      { color: "#38bdf8",          border: "rgba(56,189,248,0.35)"  },
  scroll_up:   { color: "var(--fg-4)",      border: "var(--border)"          },
  scroll_down: { color: "var(--fg-4)",      border: "var(--border)"          },
  open_url:    { color: "var(--accent-fg)", border: "rgba(99,102,241,0.35)"  },
};

const ICON = {
  wake:        <Wifi className="h-3.5 w-3.5" />,
  disconnect:  <WifiOff className="h-3.5 w-3.5" />,
  ptt:         <Mic className="h-3.5 w-3.5" />,
  search:      <Search className="h-3.5 w-3.5" />,
  say:         <Mic className="h-3.5 w-3.5" />,
  scroll_up:   <ArrowUp className="h-3.5 w-3.5" />,
  scroll_down: <ArrowDown className="h-3.5 w-3.5" />,
  open_url:    <ExternalLink className="h-3.5 w-3.5" />,
};

export default function ActionScreen() {
  const [item, setItem] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return subscribeAction((payload) => {
      if (!payload?.text) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      const next = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        text: payload.text,
        kind: payload.kind || "say",
        url: payload.url || null,
        durationMs: Math.max(800, payload.durationMs ?? 8000),
      };
      setItem(next);
      timerRef.current = setTimeout(() => setItem(null), next.durationMs);
    });
  }, []);

  if (!item) return null;

  const s    = KIND[item.kind] ?? KIND.say;
  const icon = ICON[item.kind] ?? ICON.say;
  const isScroll  = item.kind === "scroll_up" || item.kind === "scroll_down";
  const isOpenUrl = item.kind === "open_url" && item.url;

  const inner = (
    <>
      <span
        className="absolute left-0 inset-y-0 w-0.5 rounded-l-xl"
        style={{ background: s.color, opacity: 0.7 }}
      />

      <span className="shrink-0 ml-1" style={{ color: s.color }}>
        {isScroll ? (
          <motion.span
            animate={{ y: item.kind === "scroll_down" ? [0, 3, 0] : [0, -3, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}>
            {icon}
          </motion.span>
        ) : icon}
      </span>

      <p className="text-xs flex-1 leading-snug truncate" style={{ color: "var(--fg-2)" }}>
        {item.text}
        {isOpenUrl && (
          <span className="ml-1.5 opacity-50">— tap to open</span>
        )}
      </p>

      <motion.div
        className="absolute bottom-0 left-0 h-px"
        style={{ background: s.color, opacity: 0.25 }}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: item.durationMs / 1000, ease: "linear" }}
      />
    </>
  );

  const sharedStyle = {
    background: "var(--bg-subtle)",
    borderColor: "var(--border)",
  };

  return (
    <div className={`fixed inset-x-0 bottom-20 lg:bottom-6 z-[70] flex justify-center px-4 ${isOpenUrl ? "pointer-events-auto" : "pointer-events-none"}`}>
      <AnimatePresence mode="wait">
        {item && (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{   opacity: 0, y: -6,  scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-sm w-full">
            {isOpenUrl ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setItem(null)}
                className="relative flex items-center gap-2.5 rounded-lg border px-4 py-2.5 overflow-hidden w-full cursor-pointer transition-opacity hover:opacity-85"
                style={{ ...sharedStyle, display: "flex" }}>
                {inner}
              </a>
            ) : (
              <div
                className="relative flex items-center gap-2.5 rounded-lg border px-4 py-2.5 overflow-hidden"
                style={sharedStyle}>
                {inner}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
