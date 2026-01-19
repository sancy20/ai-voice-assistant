import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Mic, Wifi, WifiOff, Search } from "lucide-react";
import { subscribeAction } from "./actionBus";

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
        durationMs: Math.max(800, payload.durationMs ?? 12000),
      };

      setItem(next);
      timerRef.current = setTimeout(() => setItem(null), next.durationMs);
    });
  }, []);

  const ScrollArrows = ({ dir }) => {
    const Icon = dir === "up" ? ArrowUp : ArrowDown;
    return (
      <div className='flex items-center justify-center gap-4'>
        {[0, 0.18, 0.36].map((d, i) => (
          <motion.div
            key={i}
            animate={{
              y: dir === "up" ? [-2, -14, -2] : [2, 14, 2],
              opacity: [0.35, 1, 0.35],
            }}
            transition={{
              duration: 0.95,
              repeat: Infinity,
              ease: "easeInOut",
              delay: d,
            }}
            className='text-white'
          >
            <Icon
              className={
                i === 0 ? "h-12 w-12" : i === 1 ? "h-10 w-10" : "h-9 w-9"
              }
            />
          </motion.div>
        ))}
      </div>
    );
  };

  const IconFor = ({ kind }) => {
    if (kind === "wake") return <Wifi className='h-7 w-7 text-white/90' />;
    if (kind === "disconnect")
      return <WifiOff className='h-7 w-7 text-white/80' />;
    if (kind === "ptt") return <Mic className='h-7 w-7 text-white/90' />;
    if (kind === "search") return <Search className='h-7 w-7 text-white/90' />;
    return <Mic className='h-7 w-7 text-white/70' />;
  };

  return (
    <div className='pointer-events-none fixed inset-0 z-40 flex items-center justify-center'>
      <AnimatePresence mode='wait'>
        {item ? (
          <motion.div
            key={item.id}
            initial={{ x: -70, opacity: 0, filter: "blur(8px)" }}
            animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ x: 70, opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className='mx-6 max-w-4xl text-center'
          >
            {item.kind === "scroll_up" ? (
              <div className='space-y-3'>
                <ScrollArrows dir='up' />
                <div className='text-4xl font-semibold tracking-tight text-white/95 drop-shadow'>
                  {item.text}
                </div>
              </div>
            ) : item.kind === "scroll_down" ? (
              <div className='space-y-3'>
                <ScrollArrows dir='down' />
                <div className='text-4xl font-semibold tracking-tight text-white/95 drop-shadow'>
                  {item.text}
                </div>
              </div>
            ) : (
              <div className='flex items-center justify-center gap-3'>
                <IconFor kind={item.kind} />
                <div className='text-4xl font-semibold tracking-tight text-white/95 drop-shadow'>
                  {item.text}
                </div>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
