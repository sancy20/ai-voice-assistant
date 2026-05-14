import { useEffect, useState, useCallback } from "react";
import { useToast } from "../context/ToastContext";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Mic, ArrowLeft, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Activity, ShieldCheck, Users, Search,
  Ban, Unlock, Trash2, Crown, ChevronDown, Zap, ScrollText,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const API = "http://127.0.0.1:8000";
const COLORS = ["#6ee7b7","#93c5fd","#fde68a","#f9a8d4","#a5b4fc","#fb923c","#34d399","#60a5fa"];
const PLANS  = ["free","pro","business"];
const ROLES  = ["user","admin"];

const TooltipStyle = {
  contentStyle: { background:"rgb(14,14,14)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, fontSize:12 },
  labelStyle:   { color:"rgba(255,255,255,0.6)" },
  itemStyle:    { color:"#fff" },
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-2xl border t-border t-bg-card p-5">
      <div className="mb-3">
        <div className="grid h-8 w-8 place-items-center rounded-xl t-bg-item t-border ring-1">
          <Icon className="h-3.5 w-3.5 t-fg-60" />
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color ?? "t-fg"}`}>{value ?? "—"}</p>
      <p className="text-xs t-fg-50 mt-0.5">{label}</p>
      {sub && <p className="text-xs t-fg-30 mt-0.5">{sub}</p>}
    </div>
  );
}

function Badge({ children, color = "default" }) {
  const map = {
    default: "bg-white/5 text-white/50",
    green:   "bg-emerald-500/10 text-emerald-300",
    red:     "bg-rose-500/10 text-rose-300",
    amber:   "bg-amber-500/10 text-amber-300",
    indigo:  "bg-indigo-500/12 text-indigo-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${map[color]}`}>
      {children}
    </span>
  );
}

function Select({ value, onChange, options, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 pr-7 text-xs text-white outline-none focus:border-white/20 cursor-pointer">
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: "#111" }}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
    </div>
  );
}

function AnalyticsTab({ token }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [sessionId, setSessionId] = useState("");
  const [logFilter, setLogFilter] = useState("all");

  const fetch_ = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
      const res = await fetch(`${API}/admin/assistant/dashboard${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, sessionId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const overview    = data?.overview ?? {};
  const intentStats = data?.intent_statistics ?? [];
  const actionStats = data?.action_statistics ?? [];
  const recentLogs  = data?.recent_logs ?? [];
  const failedLogs  = data?.failed_commands ?? [];
  const lowLogs     = data?.low_confidence_commands ?? [];
  const filteredLogs = logFilter === "failed" ? failedLogs : logFilter === "low" ? lowLogs : recentLogs;

  return (
    <div className="space-y-8">
      {/* Session filter */}
      <div className="flex items-center gap-2">
        <input
          value={sessionId} onChange={e => setSessionId(e.target.value)}
          placeholder="Filter by session ID…"
          className="w-52 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/20" />
        <button onClick={fetch_}
          className="flex items-center gap-1.5 rounded-xl border t-border t-bg-item px-3 py-1.5 text-xs t-fg-70 hover:t-bg-hover transition">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-400">{error}</div>
      )}

      <section>
        <h2 className="text-xs font-semibold t-fg-40 uppercase tracking-widest mb-4">Overview</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Activity}      label="Total Commands"   value={overview.total_commands} />
          <StatCard icon={CheckCircle2}  label="Successful"       value={overview.success_commands}  color="text-emerald-400"
            sub={overview.success_rate != null ? `${overview.success_rate}% rate` : undefined} />
          <StatCard icon={XCircle}       label="Failed"           value={overview.failed_commands}   color="text-rose-400" />
          <StatCard icon={AlertTriangle} label="Low Confidence"   value={overview.low_confidence_commands} color="text-amber-400" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border t-border t-bg-card p-5">
          <h2 className="text-sm font-semibold t-fg-80 mb-5">Intent Distribution</h2>
          {intentStats.length === 0
            ? <p className="text-sm text-white/30 py-8 text-center">No data yet</p>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={intentStats} layout="vertical" margin={{ left:8, right:16 }}>
                  <XAxis type="number" tick={{ fill:"rgba(255,255,255,0.4)", fontSize:11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="intent" type="category" tick={{ fill:"rgba(255,255,255,0.6)", fontSize:11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip {...TooltipStyle} />
                  <Bar dataKey="count" radius={[0,6,6,0]}>
                    {intentStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>
        <div className="rounded-2xl border t-border t-bg-card p-5">
          <h2 className="text-sm font-semibold t-fg-80 mb-5">Action Types</h2>
          {actionStats.length === 0
            ? <p className="text-sm text-white/30 py-8 text-center">No data yet</p>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={actionStats} dataKey="count" nameKey="action_kind"
                    cx="50%" cy="50%" outerRadius={85} innerRadius={50} paddingAngle={3}>
                    {actionStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TooltipStyle} formatter={(v,n) => [v,n]} />
                  <Legend iconType="circle" iconSize={8}
                    formatter={v => <span style={{ color:"rgba(255,255,255,0.6)", fontSize:11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold t-fg-40 uppercase tracking-widest">Command Logs</h2>
          <div className="flex gap-2">
            {[{ key:"all", label:"Recent" }, { key:"failed", label:"Failed" }, { key:"low", label:"Low Confidence" }].map(({ key, label }) => (
              <button key={key} onClick={() => setLogFilter(key)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  logFilter === key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border t-border t-bg-card overflow-hidden">
          {filteredLogs.length === 0
            ? <p className="text-sm text-white/30 py-10 text-center">No logs found</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b t-border-sm t-fg-40">
                      <th className="px-5 py-3 text-left font-medium">Transcript</th>
                      <th className="px-5 py-3 text-left font-medium">Intent</th>
                      <th className="px-5 py-3 text-left font-medium">Action</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                      <th className="px-5 py-3 text-left font-medium">Confidence</th>
                      <th className="px-5 py-3 text-left font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log, i) => (
                      <tr key={i} className="border-b t-border-sm hover:t-bg-item transition">
                        <td className="px-5 py-3 t-fg-80 max-w-xs truncate">{log.transcript || "—"}</td>
                        <td className="px-5 py-3 t-fg-60">{log.intent || "—"}</td>
                        <td className="px-5 py-3 t-fg-60">{log.action_kind || "—"}</td>
                        <td className="px-5 py-3">
                          <Badge color={log.status === "success" ? "green" : log.is_failed ? "red" : "default"}>
                            {log.status || "—"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          {log.confidence != null ? (
                            <span className={log.is_low_confidence ? "text-amber-400" : "text-white/60"}>
                              {(log.confidence * 100).toFixed(0)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3 text-white/40">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </section>
    </div>
  );
}

function UsersTab({ token, selfId }) {
  const toast = useToast();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");
  const [planF,   setPlanF]   = useState("");
  const [roleF,   setRoleF]   = useState("");
  const [bannedF, setBannedF] = useState("");
  const [pending, setPending] = useState({});

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(""), 5000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (planF)  params.set("plan",   planF);
      if (roleF)  params.set("role",   roleF);
      if (bannedF !== "") params.set("banned", bannedF);
      const res = await fetch(`${API}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Error ${res.status}`);
      }
      setUsers(await res.json());
    } catch (e) { showError(e.message); }
    finally { setLoading(false); }
  }, [token, search, planF, roleF, bannedF, showError]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const patch = async (userId, body) => {
    setPending(p => ({ ...p, [userId]: true }));
    try {
      const res = await fetch(`${API}/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Error ${res.status}`);
      }
      const updated = await res.json();
      setUsers(us => us.map(u => u.id === userId ? updated : u));
      toast.success("User updated");
    } catch (e) { showError(e.message); }
    finally { setPending(p => ({ ...p, [userId]: false })); }
  };

  const deleteUser = async (userId, username) => {
    if (!confirm(`Delete "${username}"? This cannot be undone.`)) return;
    setPending(p => ({ ...p, [userId]: true }));
    try {
      const res = await fetch(`${API}/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Error ${res.status}`);
      }
      setUsers(us => us.filter(u => u.id !== userId));
      toast.success("User deleted");
    } catch (e) { showError(e.message); }
    finally { setPending(p => ({ ...p, [userId]: false })); }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search username or email…"
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-white/20" />
        </div>
        <Select value={planF} onChange={setPlanF}
          options={[{ value:"", label:"All plans" }, ...PLANS.map(p => ({ value:p, label:p }))]}
          className="w-32" />
        <Select value={roleF} onChange={setRoleF}
          options={[{ value:"", label:"All roles" }, ...ROLES.map(r => ({ value:r, label:r }))]}
          className="w-28" />
        <Select value={bannedF} onChange={setBannedF}
          options={[{ value:"", label:"All status" }, { value:"false", label:"Active" }, { value:"true", label:"Banned" }]}
          className="w-32" />
        <button onClick={fetchUsers}
          className="flex items-center gap-1.5 rounded-xl border t-border t-bg-item px-3 py-1.5 text-xs t-fg-70 hover:t-bg-hover transition">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-2.5 text-xs text-rose-400">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-3 text-rose-400/60 hover:text-rose-300 transition">✕</button>
        </div>
      )}

      <div className="rounded-2xl border t-border t-bg-card overflow-hidden">
        {users.length === 0 && !loading ? (
          <p className="text-sm text-white/30 py-10 text-center">No users found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[860px]">
              <thead>
                <tr className="border-b t-border-sm t-fg-40">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Credits</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const busy   = pending[user.id];
                  const isSelf = user.id === selfId;
                  return (
                    <tr key={user.id}
                      className={`border-b t-border-sm transition ${isSelf ? "opacity-60" : "hover:t-bg-item"}`}>
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg grid place-items-center shrink-0 text-[11px] font-bold text-white"
                            style={{ background: user.is_admin ? "#6366f1" : "#374151" }}>
                            {user.username?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium t-fg-80 truncate max-w-[130px]">{user.username}</p>
                              {isSelf && (
                                <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1 py-0.5"
                                  style={{ background:"rgba(99,102,241,0.15)", color:"#818cf8" }}>You</span>
                              )}
                            </div>
                            <p className="text-[10px] t-fg-40 truncate max-w-[150px]">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        {isSelf
                          ? <Badge color="indigo">{user.role}</Badge>
                          : <Select value={user.role} onChange={v => patch(user.id, { role:v })}
                              options={ROLES.map(r => ({ value:r, label:r }))} className="w-24" />
                        }
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3">
                        {isSelf
                          ? <Badge>{user.plan}</Badge>
                          : <Select value={user.plan} onChange={v => patch(user.id, { plan:v })}
                              options={PLANS.map(p => ({ value:p, label:p }))} className="w-28" />
                        }
                      </td>

                      {/* Credits */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-amber-400 shrink-0" />
                          {isSelf
                            ? <span className="t-fg-60">{user.credits}</span>
                            : (
                              <input type="number" min="0"
                                key={`${user.id}-${user.credits}`}
                                defaultValue={user.credits}
                                onBlur={e => {
                                  const v = parseInt(e.target.value, 10);
                                  if (!isNaN(v) && v !== user.credits) patch(user.id, { credits:v });
                                }}
                                className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-white/20" />
                            )
                          }
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge color={user.is_banned ? "red" : "green"}>
                          {user.is_banned ? "Banned" : "Active"}
                        </Badge>
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3 t-fg-40 whitespace-nowrap">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : <span className="t-fg-30">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isSelf ? (
                          <span className="text-[10px] t-fg-30 italic">cannot edit self</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button disabled={busy}
                              onClick={() => patch(user.id, { is_banned: !user.is_banned })}
                              title={user.is_banned ? "Unban user" : "Ban user"}
                              className={`h-7 w-7 grid place-items-center rounded-lg border transition disabled:opacity-40 ${
                                user.is_banned
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                  : "border-rose-500/30 bg-rose-500/8 text-rose-400 hover:bg-rose-500/15"
                              }`}>
                              {user.is_banned ? <Unlock className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                            </button>

                            <button disabled={busy}
                              onClick={() => patch(user.id, { role: user.role === "admin" ? "user" : "admin" })}
                              title={user.role === "admin" ? "Demote to user" : "Promote to admin"}
                              className="h-7 w-7 grid place-items-center rounded-lg border border-indigo-500/25 bg-indigo-500/8 text-indigo-400 hover:bg-indigo-500/15 transition disabled:opacity-40">
                              <Crown className="h-3.5 w-3.5" />
                            </button>

                            <button disabled={busy}
                              onClick={() => deleteUser(user.id, user.username)}
                              title="Delete user"
                              className="h-7 w-7 grid place-items-center rounded-lg border border-white/8 bg-white/4 text-white/35 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 transition disabled:opacity-40">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs t-fg-30 text-right">{users.length} user{users.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ── Audit Log tab ─────────────────────────────────────────────────────────────
function AuditTab({ token }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/admin/users/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Error ${res.status}`);
      }
      setLogs(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const ACTION_COLOR = {
    update_user: "indigo",
    delete_user: "red",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs t-fg-30">{logs.length} entr{logs.length !== 1 ? "ies" : "y"}</p>
        <button onClick={fetchLogs}
          className="flex items-center gap-1.5 rounded-xl border t-border t-bg-item px-3 py-1.5 text-xs t-fg-70 hover:t-bg-hover transition">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-2.5 text-xs text-rose-400">{error}</div>
      )}

      <div className="rounded-2xl border t-border t-bg-card overflow-hidden">
        {logs.length === 0 && !loading ? (
          <p className="text-sm text-white/30 py-10 text-center">No audit entries yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="border-b t-border-sm t-fg-40">
                  <th className="px-4 py-3 text-left font-medium">Admin</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">Target</th>
                  <th className="px-4 py-3 text-left font-medium">Details</th>
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b t-border-sm hover:t-bg-item transition">
                    <td className="px-4 py-3 font-medium t-fg-80">{log.admin_username}</td>
                    <td className="px-4 py-3">
                      <Badge color={ACTION_COLOR[log.action] ?? "default"}>
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 t-fg-60">{log.target_username ?? "—"}</td>
                    <td className="px-4 py-3 t-fg-40 max-w-xs truncate">{log.details ?? "—"}</td>
                    <td className="px-4 py-3 t-fg-30 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState("analytics");

  const TABS = [
    { key: "analytics", label: "Analytics",       icon: Activity    },
    { key: "users",     label: "Users",            icon: Users       },
    { key: "audit",     label: "Audit Log",        icon: ScrollText  },
  ];

  return (
    <div className="min-h-screen t-bg t-fg">
      <nav className="sticky top-0 z-40 flex items-center justify-between border-b t-border-sm t-bg-nav backdrop-blur px-6 py-3">
        <div className="flex items-center gap-3">
          <Link to="/"
            className="flex items-center gap-1.5 rounded-xl border t-border t-bg-item px-3 py-1.5 text-xs t-fg-60 hover:t-fg-90 hover:t-bg-hover transition">
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold">Admin Dashboard</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl border t-border t-bg-item p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="px-4 sm:px-6 lg:px-8 2xl:px-14 py-8">
        {tab === "analytics" && <AnalyticsTab token={token} />}
        {tab === "users"     && <UsersTab     token={token} selfId={user?.id} />}
        {tab === "audit"     && <AuditTab     token={token} />}
      </div>

      <footer className="flex items-center justify-center gap-2 pt-4 pb-10">
        <Mic className="h-3.5 w-3.5 text-white/20" />
        <span className="text-xs text-white/20">AI Voice Assistant — Admin Panel</span>
      </footer>
    </div>
  );
}
