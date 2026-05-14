import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mic2, Zap, Search, Music, Globe, Clock, StickyNote,
  ArrowRight, Activity, CheckCircle2, TrendingUp, Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API = "http://127.0.0.1:8000";

const PLAN_LIMITS = { free: 10, pro: 500, business: 2000 };

const INTENT_LABELS = {
  web_search:       "Web Search",
  media_search:     "Media",
  open_url:         "Open URL",
  alarm:            "Alarm",
  reminder:         "Reminder",
  note:             "Note",
  general_response: "General",
  current_time:     "Time",
};

const QUICK = [
  { icon: Search,     label: "Web search", cmd: '"search for …"',  color: "#6366f1" },
  { icon: Music,      label: "Play media",  cmd: '"play lofi"',     color: "#8b5cf6" },
  { icon: Globe,      label: "Open site",   cmd: '"open youtube"',  color: "#06b6d4" },
  { icon: Clock,      label: "Time & date", cmd: '"what time?"',    color: "#f59e0b" },
  { icon: StickyNote, label: "Take note",   cmd: '"note: …"',       color: "#22c55e" },
  { icon: Mic2,       label: "Reminder",    cmd: '"remind me…"',    color: "#ec4899" },
];

function timeAgo(ts) {
  if (!ts) return "";
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

function CountUp({ to, duration = 900 }) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  const t0  = useRef(null);
  useEffect(() => {
    if (typeof to !== "number") return;
    t0.current = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0.current) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);
  return <>{val}</>;
}

function ProgressBar({ pct, color, delay = 0 }) {
  return (
    <div className="h-1 rounded-full overflow-hidden mt-3" style={{ background: "var(--border)" }}>
      <motion.div className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay }}
        style={{ background: color }} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "var(--fg)", loading, delay = 0, sub, bar, accentColor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay }}
      className="relative rounded-2xl border p-3 sm:p-5 overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: accentColor ?? color }} />
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--fg-4)" }}>{label}</p>
        {Icon && (
          <div className="h-7 w-7 grid place-items-center rounded-lg"
            style={{ background: accentColor ? `${accentColor}18` : "var(--surface-h)" }}>
            <Icon className="h-3.5 w-3.5" style={{ color: accentColor ?? "var(--fg-3)" }} />
          </div>
        )}
      </div>
      {loading
        ? <Skeleton className="h-9 w-20" />
        : <p className="text-xl sm:text-3xl font-bold tabular-nums tracking-tight" style={{ color }}>
            {typeof value === "number" ? <CountUp to={value} /> : (value ?? "—")}
          </p>}
      {sub && !loading && (
        <p className="text-[11px] mt-1.5" style={{ color: "var(--fg-4)" }}>{sub}</p>
      )}
      {bar && !loading && <ProgressBar {...bar} />}
    </motion.div>
  );
}

const stagger = { show: { transition: { staggerChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
};

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate        = useNavigate();
  const [overview,   setOverview]   = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API}/admin/assistant/overview`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/admin/assistant/logs?limit=8`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([ov, logs]) => {
      setOverview(ov);
      setRecentLogs(Array.isArray(logs) ? logs : []);
      setLoading(false);
    });
  }, [token]);

  const credits    = user?.credits ?? 0;
  const plan       = user?.plan    ?? "free";
  const limit      = PLAN_LIMITS[plan] ?? 10;
  const usedPct    = Math.round(((limit - credits) / limit) * 100);
  const rate       = overview?.success_rate ?? 0;
  const rateColor  = rate >= 80 ? "var(--green)" : rate >= 50 ? "#f59e0b" : "var(--rose)";
  const tokenColor = usedPct > 80 ? "var(--rose)" : usedPct > 50 ? "#f59e0b" : "#a78bfa";

  const intentBreakdown = useMemo(() => {
    const counts = {};
    recentLogs.forEach(log => {
      const k = log.intent || "other";
      counts[k] = (counts[k] || 0) + 1;
    });
    const total = recentLogs.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([intent, count]) => ({ intent, count, pct: Math.round((count / total) * 100) }));
  }, [recentLogs]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-14 py-5 sm:py-6">

      {/* ── Hero Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-2xl overflow-hidden mb-6 p-4 sm:p-6 lg:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.06) 100%)",
          border: "1px solid rgba(139,92,246,0.18)",
        }}>
        {/* Ambient glow */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--accent-fg)" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--fg)" }}>
              {greeting()}{user?.username ? `, ${user.username}` : ""}
            </h1>
            <p className="text-sm" style={{ color: "var(--fg-3)" }}>
              You have{" "}
              <span className="font-semibold" style={{ color: tokenColor }}>{credits} tokens</span>{" "}
              remaining on your{" "}
              <span className="capitalize font-medium" style={{ color: "var(--fg-2)" }}>{plan}</span> plan
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
              style={{ background: "var(--accent-2)", border: "1px solid rgba(139,92,246,0.3)", color: "var(--accent-fg)" }}>
              {plan}
            </span>
            {plan !== "business" && (
              <button onClick={() => navigate("/subscription")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: "var(--accent-grad)",
                  color: "#fff",
                  boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                }}>
                <Sparkles className="h-3 w-3" />
                Upgrade
              </button>
            )}
            <button onClick={() => navigate("/assistant")}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--surface-h)]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg-2)" }}>
              <Mic2 className="h-3 w-3" />
              Open assistant
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <StatCard
          label="Tokens left" value={credits} icon={Zap} delay={0} loading={false}
          accentColor={tokenColor}
          color={tokenColor}
          sub={`${Math.max(0, limit - credits)} used of ${limit}`}
          bar={{ pct: usedPct, color: tokenColor, delay: 0.3 }}
        />
        <StatCard
          label="Commands" value={overview?.total_commands ?? null} icon={Activity}
          delay={0.06} loading={loading}
          accentColor="#8b5cf6"
          color="var(--fg)"
          sub="all time"
        />
        <StatCard
          label="Success rate" value={overview ? `${rate}%` : null} icon={TrendingUp}
          delay={0.12} loading={loading} color={rateColor} accentColor={rateColor}
          sub={overview ? `${overview.success_commands ?? 0} successful` : undefined}
        />
        <StatCard
          label="Failed" value={overview ? ((overview.total_commands ?? 0) - (overview.success_commands ?? 0)) : null}
          icon={CheckCircle2} delay={0.18} loading={loading}
          accentColor="var(--rose)" color="var(--fg)"
          sub={plan !== "business" ? "Upgrade for more" : "Max plan"}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-6 xl:gap-8">
        <div className="space-y-6">
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-4)" }}>
                Quick commands
              </p>
              <button onClick={() => navigate("/assistant")}
                className="flex items-center gap-1 text-xs transition hover:underline"
                style={{ color: "var(--accent-fg)" }}>
                Open assistant <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <motion.div variants={stagger} initial="hidden" animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {QUICK.map(({ icon: Icon, label, cmd, color }) => (
                <motion.button key={label} variants={item}
                  onClick={() => navigate("/assistant")}
                  whileHover={{ scale: 1.015, y: -1 }} whileTap={{ scale: 0.985 }}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all group"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="h-8 w-8 rounded-xl grid place-items-center shrink-0 transition-all group-hover:scale-110"
                    style={{ background: `${color}1a` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--fg-2)" }}>{label}</p>
                    <p className="text-xs font-mono truncate" style={{ color: "var(--fg-4)" }}>{cmd}</p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </motion.section>
          {!loading && intentBreakdown.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--fg-4)" }}>
                Command breakdown
              </p>
              <div className="rounded-2xl border p-5 space-y-4"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                {intentBreakdown.map(({ intent, count, pct }, i) => (
                  <div key={intent} className="flex items-center gap-3">
                    <span className="text-xs w-24 shrink-0 truncate font-medium"
                      style={{ color: "var(--fg-3)" }}>
                      {INTENT_LABELS[intent] ?? intent}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <motion.div className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.38 + i * 0.06 }}
                        style={{ background: "var(--accent-grad)" }} />
                    </div>
                    <span className="text-xs w-8 text-right shrink-0 tabular-nums font-mono font-semibold"
                      style={{ color: "var(--fg-3)" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </div>
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-4)" }}>
              Recent activity
            </p>
            <button onClick={() => navigate("/history")}
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: "var(--accent-fg)" }}>
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="rounded-2xl border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {loading ? (
              <div className="divide-y" style={{ borderColor: "var(--border-s)" }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                    <Skeleton className="h-2 w-2 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <div className="h-12 w-12 grid place-items-center rounded-2xl"
                  style={{ background: "var(--accent-2)" }}>
                  <Mic2 className="h-5 w-5" style={{ color: "var(--accent-fg)" }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium mb-1" style={{ color: "var(--fg-2)" }}>No commands yet</p>
                  <p className="text-xs mb-3" style={{ color: "var(--fg-4)" }}>Try saying something to the assistant</p>
                  <button onClick={() => navigate("/assistant")}
                    className="text-xs font-semibold px-4 py-2 rounded-full transition-all"
                    style={{ background: "var(--accent-grad)", color: "#fff", boxShadow: "0 4px 12px rgba(139,92,246,0.25)" }}>
                    Open assistant
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border-s)" }}>
                {recentLogs.map((log, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.22 + i * 0.03 }}
                    className="flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--surface-h)] transition-colors">
                    <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                      log.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate font-medium" style={{ color: "var(--fg-2)" }}>
                        {log.transcript || "—"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {log.intent && (
                          <span className="text-[10px] px-1.5 py-px rounded-full font-medium"
                            style={{ background: "var(--accent-2)", color: "var(--accent-fg)" }}>
                            {INTENT_LABELS[log.intent] ?? log.intent}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: "var(--fg-4)" }}>
                          {timeAgo(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
