import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, Search } from "lucide-react";
import {
  subscribeResults,
  subscribeMedia,
  subscribeSearchControl,
} from "./actionBus";

export default function CenterSearchResults({ setCenterPanelActive }) {
  const [panel, setPanel] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef([]);

  useEffect(() => {
    return subscribeResults((payload) => {
      if (!payload) {
        setPanel(null);
        setCenterPanelActive?.(false);
        return;
      }

      if (payload.kind === "search_results") {
        setPanel({
          ...payload,
          items: payload.items || [],
        });
        setSelectedIndex(0);
        setCenterPanelActive?.(true);
      }
    });
  }, [setCenterPanelActive]);

  useEffect(() => {
    return subscribeMedia((payload) => {
      if (payload?.results?.length) {
        setPanel(null);
        setCenterPanelActive?.(true);
      }
    });
  }, [setCenterPanelActive]);

  const openInNewTab = (url) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    return subscribeSearchControl((payload) => {
      if (!payload || !panel?.items?.length) return;

      if (payload.type === "next") {
        setSelectedIndex((prev) => Math.min(prev + 1, panel.items.length - 1));
        return;
      }

      if (payload.type === "prev") {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (payload.type === "open") {
        const idx = Math.max(1, Number(payload.index || 1)) - 1;
        const safeIdx = Math.min(idx, panel.items.length - 1);
        const item = panel.items[safeIdx];
        if (item?.url) {
          openInNewTab(item.url);
        }
      }
    });
  }, [panel]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedIndex]);

  const closePanel = () => {
    setPanel(null);
    setCenterPanelActive?.(false);
  };

  return (
    <AnimatePresence>
      {panel?.items?.length ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed top-0 right-0 bottom-[92px] left-0 md:left-[220px] z-[60] flex items-center justify-center px-4 py-6 md:px-6"
          style={{ background: "transparent" }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex max-h-full h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border"
            style={{ background: "var(--bg-subtle)", borderColor: "var(--border)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "var(--border-s)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <Search className="h-4 w-4" style={{ color: "var(--fg-3)" }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--fg)" }}>
                    {panel.title || "Search Results"}
                  </p>
                  <p className="truncate text-xs mt-0.5" style={{ color: "var(--fg-4)" }}>
                    {panel.subtitle || "Top results"}
                  </p>
                </div>
              </div>

              <button
                onClick={closePanel}
                title="Close"
                className="h-7 w-7 grid place-items-center rounded-md border transition-colors ml-3 shrink-0"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  color: "var(--fg-3)",
                }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Results list */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
              <div className="space-y-2">
                {panel.items.map((item, idx) => {
                  const active = idx === selectedIndex;
                  return (
                    <a
                      key={item.url || idx}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      ref={(el) => (itemRefs.current[idx] = el)}
                      onClick={() => setSelectedIndex(idx)}
                      className="block rounded-lg border p-3.5 transition-colors"
                      style={{
                        background: active ? "var(--accent-2)" : "var(--surface)",
                        borderColor: active ? "var(--accent-fg)" : "var(--border)",
                      }}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Number badge */}
                        <span className="shrink-0 text-xs font-mono mt-0.5 tabular-nums"
                          style={{ color: active ? "var(--accent-fg)" : "var(--fg-4)" }}>
                          #{idx + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug"
                            style={{ color: "var(--fg)" }}>
                            {item.title}
                          </p>

                          {item.source ? (
                            <p className="mt-0.5 text-xs truncate"
                              style={{ color: "var(--accent-fg)" }}>
                              {item.source}
                            </p>
                          ) : null}

                          {item.snippet ? (
                            <p className="mt-2 text-xs leading-relaxed line-clamp-3"
                              style={{ color: "var(--fg-3)" }}>
                              {item.snippet}
                            </p>
                          ) : null}

                          <div className="mt-2 inline-flex items-center gap-1 text-xs"
                            style={{ color: "var(--fg-4)" }}>
                            <ExternalLink className="h-3 w-3" />
                            Open result
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
