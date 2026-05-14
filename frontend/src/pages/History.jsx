import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Search, CheckCircle2, XCircle, Clock, Cpu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API = "http://127.0.0.1:8000";

const FILTERS = [
  { key: "all",     label: "All" },
  { key: "success", label: "Success" },
  { key: "failed",  label: "Failed" },
];

const INTENT_COLORS = {
  web_search:       "#6366f1",
  media_search:     "#8b5cf6",
  open_url:         "#06b6d4",
  open:             "#06b6d4",
  alarm:            "#f59e0b",
  reminder:         "#ec4899",
  note:             "#10b981",
  general_response: "#a78bfa",
  current_time:     "#f59e0b",
  search:           "#6366f1",
  media:            "#8b5cf6",
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl border p-4 space-y-3"
      style={{ background: "var(--surface)", borderColor: "var(--border-s)" }}>
      <div className="flex items-center justify-between">
        <div className="skeleton h-2 w-2 rounded-full" />
        <div className="skeleton h-2.5 w-16 rounded" />
      </div>
      <div className="skeleton h-3.5 w-full rounded" />
      <div className="skeleton h-3 w-3/4 rounded" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-20 rounded-full" />
        <div className="skeleton h-3 w-12 rounded" />
      </div>
    </div>
  );
}

function IntentBadge({ intent }) {
  const color = INTENT_COLORS[intent] ?? "var(--fg-4)";
  const label = (intent ?? "unknown").replace(/_/g, " ");
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}>
      {label}
    </span>
  );
}

export default function History() {
  const { token } = useAuth();
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");
  const [search,  setSearch]  = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/assistant/logs?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setLogs(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [token]);

  const filtered = logs.filter(log => {
    if (filter === "success" && log.status !== "success") return false;
    if (filter === "failed"  && log.status === "success") return false;
    const q = search.toLowerCase();
    if (q && !((log.transcript ?? "") + (log.intent ?? "")).toLowerCase().includes(q)) return false;
    return true;
  });

  const successCount = logs.filter(l => l.status === "success").length;
  const failCount    = logs.length - successCount;

  return (
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-14 py-5 sm:py-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>History</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--fg-4)" }}>
              {loading ? "Loading…" : `${logs.length} commands recorded`}
            </p>
          </div>
          <button onClick={fetchLogs} disabled={loading}
            className="h-9 w-9 grid place-items-center rounded-xl border transition-all hover:bg-[var(--surface-h)] disabled:opacity-40"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--fg-3)" }}>
            <RefreshCw className={`h-4 w-4 ${loading ? "spin-slow" : ""}`} />
          </button>
        </div>

        {/* Stats row */}
        {!loading && logs.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            {[
              { label: "Total",   value: logs.length,   icon: Cpu,          color: "var(--accent-fg)" },
              { label: "Success", value: successCount,   icon: CheckCircle2, color: "var(--green)" },
              { label: "Failed",  value: failCount,      icon: XCircle,      color: "var(--rose)" },
            ].map(s => (
              <div key={s.label} className="relative rounded-2xl border p-3 sm:p-4 overflow-hidden"
                style={{ background: "var(--surface)", borderColor: "var(--border-s)" }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                  style={{ background: s.color }} />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: "var(--fg-4)" }}>{s.label}</span>
                  <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                </div>
                <p className="text-xl sm:text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
              style={{ color: "var(--fg-4)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search commands…"
              className="w-full rounded-2xl pl-9 pr-4 py-2.5 text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="rounded-full px-4 py-2.5 text-xs font-bold transition-all border"
                style={{
                  background: filter === f.key ? "var(--accent-2)" : "var(--surface)",
                  color: filter === f.key ? "var(--accent-fg)" : "var(--fg-3)",
                  borderColor: filter === f.key ? "rgba(139,92,246,0.3)" : "var(--border)",
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <div className="h-16 w-16 grid place-items-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.06))", border: "1px solid rgba(99,102,241,0.2)" }}>
            <Clock className="h-7 w-7" style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <p className="text-base font-bold mb-1.5" style={{ color: "var(--fg-2)" }}>
              {search || filter !== "all" ? "No matching commands" : "No history yet"}
            </p>
            <p className="text-sm" style={{ color: "var(--fg-4)" }}>
              {search || filter !== "all" ? "Try adjusting your filters" : "Start by speaking a command"}
            </p>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((log, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.035, 0.3), duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="card-lift rounded-2xl border p-4 space-y-3"
                style={{ background: "var(--surface)", borderColor: "var(--border-s)" }}>

                {/* Status + time row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {log.status === "success"
                      ? <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--green)" }} />
                      : <XCircle className="h-3.5 w-3.5" style={{ color: "var(--rose)" }} />}
                    <span className="text-[11px] font-medium"
                      style={{ color: log.status === "success" ? "var(--green)" : "var(--rose)" }}>
                      {log.status === "success" ? "Success" : "Failed"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: "var(--fg-4)" }}>
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                </div>

                {/* Transcript */}
                <p className="text-sm leading-snug line-clamp-2" style={{ color: "var(--fg-2)" }}>
                  {log.transcript || <span style={{ color: "var(--fg-4)" }}>No transcript</span>}
                </p>

                {/* Intent badge */}
                <div className="flex items-center justify-between">
                  <IntentBadge intent={log.intent} />
                  {log.timestamp && (
                    <span className="text-[10px]" style={{ color: "var(--fg-4)" }}>
                      {new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-xs mt-4 text-center" style={{ color: "var(--fg-4)" }}>
          Showing {filtered.length} of {logs.length} commands
        </p>
      )}
    </div>
  );
}
