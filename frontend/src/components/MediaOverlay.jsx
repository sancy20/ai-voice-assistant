import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { subscribeMedia, subscribeMediaControl } from "./actionBus";

export default function MediaOverlay() {
  const [workspace,      setWorkspace]      = useState(null);
  const [selectedIndex,  setSelectedIndex]  = useState(0);
  const [iframeKey,      setIframeKey]      = useState(0);
  const itemRefs = useRef([]);

  useEffect(() => {
    return subscribeMedia((payload) => {
      if (!payload?.results?.length) return;
      setWorkspace(payload);
      setSelectedIndex(payload.selectedIndex ?? 0);
      setIframeKey(k => k + 1);
    });
  }, []);

  const results      = workspace?.results ?? [];
  const selectedItem = results[selectedIndex] ?? null;

  useEffect(() => {
    return subscribeMediaControl((payload) => {
      if (!payload || !results.length) return;
      if (payload.type === "next")   setSelectedIndex(p => Math.min(p + 1, results.length - 1));
      if (payload.type === "prev")   setSelectedIndex(p => Math.max(p - 1, 0));
      if (payload.type === "select") {
        const idx = Math.max(0, Number(payload.index ?? 1) - 1);
        setSelectedIndex(Math.min(idx, results.length - 1));
      }
    });
  }, [results]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setIframeKey(k => k + 1);
  }, [selectedIndex]);

  const close = () => { setWorkspace(null); setSelectedIndex(0); };

  const relatedItems = useMemo(() =>
    results.map((item, idx) => ({ ...item, _idx: idx })),
  [results]);

  const embedUrl = selectedItem?.video_id
    ? `https://www.youtube.com/embed/${selectedItem.video_id}?autoplay=1&rel=0&modestbranding=1`
    : selectedItem?.embed_url ?? null;

  return (
    <AnimatePresence>
      {workspace && selectedItem && (
        <motion.div
          key="media-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 right-0 bottom-[92px] left-0 md:left-[220px] z-[60] flex items-center justify-center p-3 sm:p-4"
          style={{ background: "transparent" }}>

          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex h-full max-h-full w-full max-w-[1450px] flex-col overflow-hidden">

            <div className="flex flex-col h-full rounded-2xl overflow-hidden border"
              style={{ background: "rgb(14,14,14)", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {selectedItem.title || "Media"}
                  </p>
                  <p className="text-xs mt-0.5 text-white/40 truncate">
                    {workspace.query ? `YouTube · "${workspace.query}"` : "YouTube"}
                    {results.length > 1 && ` · ${selectedIndex + 1} of ${results.length}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setSelectedIndex(p => Math.max(p - 1, 0))}
                    disabled={selectedIndex === 0}
                    className="h-8 w-8 grid place-items-center rounded-lg transition-colors disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setSelectedIndex(p => Math.min(p + 1, results.length - 1))}
                    disabled={selectedIndex === results.length - 1}
                    className="h-8 w-8 grid place-items-center rounded-lg transition-colors disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {selectedItem.watch_url && (
                    <a href={selectedItem.watch_url} target="_blank" rel="noopener noreferrer"
                      className="h-8 w-8 grid place-items-center rounded-lg transition-colors hover:bg-white/10"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                      title="Open in YouTube">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <button onClick={close}
                    className="h-8 w-8 grid place-items-center rounded-lg transition-colors hover:bg-white/10"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
                    title="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex flex-col min-h-0 p-3 sm:p-4 lg:overflow-y-auto">
                  <div className="relative w-full rounded-xl overflow-hidden bg-black"
                    style={{ aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {embedUrl ? (
                      <iframe
                        key={iframeKey}
                        src={embedUrl}
                        title={selectedItem.title}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        style={{ border: "none" }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <PlayCircle className="h-10 w-10 text-white/20" />
                        <p className="text-sm text-white/40">No video available</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex-1">
                    <p className="text-base font-semibold text-white leading-snug">
                      {selectedItem.title}
                    </p>
                    {selectedItem.channel_title && (
                      <p className="text-sm mt-1 text-white/50">{selectedItem.channel_title}</p>
                    )}
                    {selectedItem.snippet && (
                      <p className="text-sm mt-2.5 leading-relaxed text-white/40 line-clamp-3">
                        {selectedItem.snippet}
                      </p>
                    )}
                  </div>
                </div>
                <div className="border-t lg:border-t-0 lg:border-l flex flex-col min-h-0"
                  style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <p className="text-xs font-semibold uppercase tracking-widest px-4 pt-4 pb-2.5 shrink-0"
                    style={{ color: "rgba(255,255,255,0.35)" }}>
                    Results
                  </p>
                  <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
                    {relatedItems.map((item) => {
                      const active = item._idx === selectedIndex;
                      return (
                        <button
                          key={item.video_id || item._idx}
                          type="button"
                          onClick={() => setSelectedIndex(item._idx)}
                          ref={(el) => (itemRefs.current[item._idx] = el)}
                          className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-all"
                          style={{
                            background: active ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${active ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.06)"}`,
                            transform: active ? "scale(1.01)" : "scale(1)",
                          }}>
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt={item.title}
                              className="h-16 w-28 rounded-lg object-cover shrink-0"
                              style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
                          ) : (
                            <div className="h-16 w-28 rounded-lg grid place-items-center shrink-0"
                              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <PlayCircle className="h-5 w-5 text-white/30" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug line-clamp-2"
                              style={{ color: active ? "#fff" : "rgba(255,255,255,0.8)" }}>
                              {item.title}
                            </p>
                            {item.channel_title && (
                              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                                {item.channel_title}
                              </p>
                            )}
                            <p className="text-[10px] mt-1 font-medium"
                              style={{ color: active ? "rgba(129,140,248,0.9)" : "rgba(255,255,255,0.2)" }}>
                              #{item._idx + 1}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
