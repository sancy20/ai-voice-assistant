import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StickyNote, RefreshCw, X, Mic2, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config/api";

const NOTE_PALETTES = [
  { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.22)",  dot: "#6366f1",  text: "#a5b4fc" },
  { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.22)", dot: "#8b5cf6", text: "#c4b5fd" },
  { bg: "rgba(236,72,153,0.10)", border: "rgba(236,72,153,0.20)", dot: "#ec4899", text: "#f9a8d4" },
  { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.20)", dot: "#f59e0b", text: "#fcd34d" },
  { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.20)", dot: "#10b981", text: "#6ee7b7" },
  { bg: "rgba(6,182,212,0.10)",  border: "rgba(6,182,212,0.20)",  dot: "#06b6d4",  text: "#67e8f9"  },
];

function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border-s)" }}>
      <Skeleton className="h-2.5 w-24 mb-3" />
      <Skeleton className="h-3.5 w-full mb-2" />
      <Skeleton className="h-3.5 w-4/5 mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export default function Notes() {
  const { token } = useAuth();
  const [notes,    setNotes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState("");

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notes`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setNotes(Array.isArray(data.notes) ? data.notes : []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, [token]);

  const preview = (text = "", max = 120) =>
    text.length > max ? text.slice(0, max) + "…" : text;

  const filtered = search
    ? notes.filter(n => (n.content ?? n.text ?? "").toLowerCase().includes(search.toLowerCase()))
    : notes;

  return (
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-14 py-5 sm:py-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>Notes</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--fg-4)", marginBottom: "10px"}}>
              {loading ? "Loading…" : `${notes.length} note${notes.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={fetchNotes} disabled={loading}
            className="h-9 w-9 grid place-items-center rounded-xl border transition-all hover:bg-[var(--surface-h)] disabled:opacity-40"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--fg-3)" }}>
            <RefreshCw className={`h-4 w-4 ${loading ? "spin-slow" : ""}`} />
          </button>
        </div>

        {/* Search */}
        {notes.length > 0 && (
          <div className="relative" style={{ marginBottom: "20px" }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: "var(--fg-4)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full rounded-2xl pl-9 pr-4 py-2.5 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </div>
        )}
      </motion.div>

      {/* Voice prompt */}
      <div className="mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, transparent 100%)",
          borderColor: "rgba(139,92,246,0.18)", marginBottom: "20px"
        }}>
        <div className="h-7 w-7 grid place-items-center rounded-lg shrink-0"
          style={{ background: "var(--accent-2)" }}>
          <Mic2 className="h-3.5 w-3.5" style={{ color: "var(--accent-fg)" }} />
        </div>
        <p className="text-sm" style={{ color: "var(--fg-3)" }}>
          Say{" "}
          <span className="font-mono text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "var(--accent-2)", color: "var(--accent-fg)" }}>
            "note: your text"
          </span>
          {" "}to capture a new note via voice
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <div className="h-16 w-16 grid place-items-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.06))", border: "1px solid rgba(139,92,246,0.2)" }}>
            <StickyNote className="h-7 w-7" style={{ color: "var(--accent-fg)" }} />
          </div>
          <div>
            <p className="text-base font-bold mb-1.5" style={{ color: "var(--fg-2)" }}>
              {search ? "No matching notes" : "No notes yet"}
            </p>
            <p className="text-sm" style={{ color: "var(--fg-4)" }}>
              {search ? "Try a different search term" : "Say \"note: your text\" to the assistant"}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filtered.map((note, i) => {
            const palette = NOTE_PALETTES[i % NOTE_PALETTES.length];
            return (
              <motion.button key={note.id ?? i}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.35), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.015, y: -2 }} whileTap={{ scale: 0.985 }}
                onClick={() => setSelected({ note, palette })}
                className="rounded-2xl border p-4 text-left overflow-hidden relative group transition-shadow"
                style={{
                  background: palette.bg,
                  borderColor: palette.border,
                }}>
                {/* Color strip */}
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                  style={{ background: palette.dot }} />

                <div className="flex items-center gap-1.5 mb-2.5 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: palette.dot }} />
                  <p className="text-[10px] font-mono" style={{ color: palette.text, opacity: 0.75 }}>
                    {note.created_at
                      ? new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "Note"}
                  </p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--fg-2)" }}>
                  {preview(note.content ?? note.text ?? "")}
                </p>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)" }}
            onClick={() => setSelected(null)}>
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border overflow-hidden"
              style={{
                background: selected.palette.bg,
                borderColor: selected.palette.border,
              }}>
              <div className="h-0.5 w-full" style={{ background: selected.palette.dot }} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: selected.palette.dot }} />
                    <p className="text-xs font-mono" style={{ color: selected.palette.text, opacity: 0.75 }}>
                      {selected.note.created_at
                        ? new Date(selected.note.created_at).toLocaleString()
                        : "Note"}
                    </p>
                  </div>
                  <button onClick={() => setSelected(null)}
                    className="h-7 w-7 grid place-items-center rounded-lg transition-colors hover:bg-[var(--surface-h)]"
                    style={{ color: "var(--fg-3)" }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--fg)" }}>
                  {selected.note.content ?? selected.note.text ?? ""}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
