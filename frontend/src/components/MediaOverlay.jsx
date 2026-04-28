import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, PlayCircle } from "lucide-react";
import { subscribeMedia, subscribeMediaControl } from "./actionBus";

export default function MediaOverlay({ setCenterPanelActive }) {
  const [workspace, setWorkspace] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const playerHostRef = useRef(null);
  const playerInstanceRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);

  const itemRefs = useRef([]);

  useEffect(() => {
    return subscribeMedia((payload) => {
      if (!payload?.results?.length) return;
      setWorkspace(payload);
      setSelectedIndex(payload.selectedIndex ?? 0);
      setCenterPanelActive?.(true);
    });
  }, []);

  const results = workspace?.results || [];
  const selectedItem = results[selectedIndex] || null;

  useEffect(() => {
    return subscribeMediaControl((payload) => {
      if (!payload || !results.length) return;

      if (payload.type === "next") {
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }

      if (payload.type === "prev") {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (payload.type === "select") {
        const idx = Math.max(1, Number(payload.index || 1)) - 1;
        setSelectedIndex(Math.min(idx, results.length - 1));
        return;
      }

      if (payload.type === "pause") {
        try {
          playerInstanceRef.current?.pauseVideo?.();
        } catch {}
        return;
      }

      if (payload.type === "resume") {
        try {
          playerInstanceRef.current?.playVideo?.();
        } catch {}
      }
    });
  }, [results]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!selectedItem?.video_id || !playerHostRef.current) return;

    setIsLoading(true);

    const loadApi = () =>
      new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          resolve(window.YT);
          return;
        }

        const existing = document.getElementById("youtube-iframe-api");
        if (!existing) {
          const tag = document.createElement("script");
          tag.id = "youtube-iframe-api";
          tag.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(tag);
        }

        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (typeof prev === "function") prev();
          resolve(window.YT);
        };
      });

    let cancelled = false;

    loadApi().then((YT) => {
      if (cancelled || !playerHostRef.current) return;

      try {
        if (playerInstanceRef.current?.destroy) {
          playerInstanceRef.current.destroy();
        }
      } catch {}

      playerInstanceRef.current = null;

      playerHostRef.current.innerHTML = "";

      const mountNode = document.createElement("div");
      mountNode.className = "h-full w-full";
      playerHostRef.current.appendChild(mountNode);

      playerInstanceRef.current = new YT.Player(mountNode, {
        videoId: selectedItem.video_id,
        events: {
          onReady: () => setIsLoading(false),
          onError: (e) => {
            console.error("YouTube player error:", e);
            setIsLoading(false);
          },
        },
        playerVars: {
          autoplay: 1,
          rel: 0,
        },
      });
    });

    return () => {
      cancelled = true;

      try {
        if (playerInstanceRef.current?.destroy) {
          playerInstanceRef.current.destroy();
        }
      } catch {}

      playerInstanceRef.current = null;

      if (playerHostRef.current) {
        playerHostRef.current.innerHTML = "";
      }
    };
  }, [selectedItem?.video_id]);

  const closeOverlay = () => {
    try {
      if (playerInstanceRef.current?.destroy) {
        playerInstanceRef.current.destroy();
      }
    } catch {}

    playerInstanceRef.current = null;

    if (playerHostRef.current) {
      playerHostRef.current.innerHTML = "";
    }

    setWorkspace(null);
    setSelectedIndex(0);
    setIsLoading(false);
    setCenterPanelActive?.(false);
  };

  const relatedResults = useMemo(() => {
    return results.map((item, idx) => ({ ...item, _idx: idx }));
  }, [results]);

  return (
    <AnimatePresence>
      {workspace && selectedItem ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className='fixed inset-0 z-40 bg-[rgb(18,18,18)] px-4 py-6 md:px-6'
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className='mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[rgb(20,20,20)] shadow-2xl'
          >
            <div className='flex items-center justify-between border-b border-white/10 px-5 py-4'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-semibold text-white'>
                  {selectedItem.title || "Media Workspace"}
                </div>
                <div className='mt-1 truncate text-xs text-white/50'>
                  {workspace.query
                    ? `Top YouTube results for "${workspace.query}"`
                    : "YouTube results"}
                </div>
              </div>

              <div className='flex items-center gap-2'>
                {selectedItem.watch_url ? (
                  <a
                    href={selectedItem.watch_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 hover:bg-white/10'
                    title='Open in YouTube'
                  >
                    <ExternalLink className='h-4 w-4' />
                  </a>
                ) : null}

                <button
                  onClick={closeOverlay}
                  className='rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 hover:bg-white/10'
                  title='Close'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
            </div>

            <div className='grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]'>
              <div className='min-h-0 overflow-y-auto p-4 md:p-5'>
                <div className='overflow-hidden rounded-2xl border border-white/10 bg-black'>
                  <div className='aspect-video w-full relative'>
                    {isLoading && (
                      <div className='absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-white/70 text-sm'>
                        Loading video...
                      </div>
                    )}
                    <div ref={playerHostRef} className='h-full w-full' />
                  </div>
                </div>

                <div className='mt-4'>
                  <div className='text-xl font-semibold text-white'>
                    {selectedItem.title}
                  </div>

                  {selectedItem.channel_title ? (
                    <div className='mt-2 text-sm text-white/50'>
                      {selectedItem.channel_title}
                    </div>
                  ) : null}

                  {selectedItem.snippet ? (
                    <div className='mt-3 text-sm leading-6 text-white/65'>
                      {selectedItem.snippet}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className='min-h-0 border-t border-white/10 lg:border-l lg:border-t-0'>
                <div className='px-4 py-4 text-sm font-semibold text-white/85'>
                  Related Results
                </div>

                <div className='max-h-full space-y-3 overflow-y-auto px-4 pb-4'>
                  {relatedResults.map((item) => {
                    const active = item._idx === selectedIndex;

                    return (
                      <button
                        key={item.video_id || item.watch_url || item._idx}
                        type='button'
                        onClick={() => setSelectedIndex(item._idx)}
                        ref={(el) => (itemRefs.current[item._idx] = el)}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
                          active
                            ? "border-sky-400 bg-sky-400/20 scale-[1.02]"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title}
                            className='h-20 w-32 rounded-xl object-cover ring-1 ring-white/10'
                          />
                        ) : (
                          <div className='grid h-20 w-32 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10 text-white/40'>
                            <PlayCircle className='h-6 w-6' />
                          </div>
                        )}

                        <div className='min-w-0 flex-1'>
                          <div className='line-clamp-2 text-sm font-medium text-white'>
                            {item.title}
                          </div>

                          {item.channel_title ? (
                            <div className='mt-1 text-xs text-white/45'>
                              {item.channel_title}
                            </div>
                          ) : null}

                          {item.snippet ? (
                            <div className='mt-2 line-clamp-2 text-xs text-white/55'>
                              {item.snippet}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
