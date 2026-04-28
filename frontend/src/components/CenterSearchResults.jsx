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
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
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
          className='fixed inset-0 z-30 bg-[rgb(18,18,18)] px-4 py-6 md:px-6'
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className='mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[rgb(20,20,20)] shadow-2xl'
          >
            <div className='flex items-center justify-between border-b border-white/10 px-5 py-4'>
              <div className='min-w-0 flex items-center gap-3'>
                <div className='grid h-10 w-10 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10'>
                  <Search className='h-5 w-5 text-white/90' />
                </div>

                <div className='min-w-0'>
                  <div className='truncate text-sm font-semibold text-white'>
                    {panel.title || "Search Results"}
                  </div>
                  <div className='mt-1 truncate text-xs text-white/50'>
                    {panel.subtitle || "Top results"}
                  </div>
                </div>
              </div>

              <button
                onClick={closePanel}
                className='rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 hover:bg-white/10'
                title='Close'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto p-4 md:p-5'>
              {panel.items.length ? (
                <div className='space-y-3'>
                  {panel.items.map((item, idx) => {
                    const active = idx === selectedIndex;

                    return (
                      <a
                        key={item.url || idx}
                        href={item.url}
                        target='_blank'
                        rel='noopener noreferrer'
                        ref={(el) => (itemRefs.current[idx] = el)}
                        onClick={() => setSelectedIndex(idx)}
                        className={`block rounded-2xl border p-4 transition ${
                          active
                            ? "border-sky-400 bg-sky-400/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className='min-w-0'>
                          <div className='flex items-start gap-3'>
                            <div className='mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80'>
                              {idx + 1}
                            </div>

                            <div className='min-w-0 flex-1'>
                              <div className='text-base font-semibold text-white'>
                                {item.title}
                              </div>

                              {item.source ? (
                                <div className='mt-1 text-xs text-sky-300/80'>
                                  {item.source}
                                </div>
                              ) : null}

                              {item.snippet ? (
                                <div className='mt-3 text-sm leading-6 text-white/65'>
                                  {item.snippet}
                                </div>
                              ) : null}

                              <div className='mt-3 inline-flex items-center gap-1 text-xs text-white/45'>
                                <ExternalLink className='h-3.5 w-3.5' />
                                Open result
                              </div>
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className='grid h-full min-h-60 place-items-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/55'>
                  No search results found.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
