import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { API_URL } from "../config/api";

const MIC_SVG = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="4.5" y="1" width="3" height="6" rx="1.5" fill="white"/>
    <path d="M2 6.5C2 8.98 3.79 11 6 11s4-2.02 4-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6" y1="11" x2="6" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function strength(pw) {
  let s = 0;
  if (pw.length >= 8)         s++;
  if (/[A-Z]/.test(pw))       s++;
  if (/[0-9]/.test(pw))       s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = ["", "#f87171", "#fbbf24", "#34d399", "#818cf8"];

export default function ResetPassword() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const token      = params.get("token") || "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [done,      setDone]      = useState(false);

  const pw_strength = strength(password);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (pw_strength < 2)      { setError("Password is too weak");   return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reset failed");
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg)", color: "var(--fg)" }}>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm">

        <div className="flex items-center gap-2 mb-8">
          <div className="h-6 w-6 rounded-md grid place-items-center shrink-0"
            style={{ background: "var(--accent)" }}>
            {MIC_SVG}
          </div>
          <span className="text-sm font-semibold">VoiceAI</span>
        </div>

        <div className="rounded-2xl border p-6"
          style={{ background: "var(--bg-subtle)", borderColor: "var(--border)" }}>

          {done ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl mx-auto"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <CheckCircle2 className="h-6 w-6" style={{ color: "#34d399" }} />
              </div>
              <p className="text-sm font-semibold">Password updated!</p>
              <p className="text-xs" style={{ color: "var(--fg-3)" }}>Redirecting to sign in…</p>
            </motion.div>
          ) : (
            <>
              <h1 className="text-lg font-bold mb-1">Set new password</h1>
              <p className="text-sm mb-6" style={{ color: "var(--fg-3)" }}>
                Choose a strong password for your account.
              </p>

              {!token && (
                <div className="mb-4 rounded-xl border px-3 py-2 text-xs"
                  style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                  Missing or invalid reset token.
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
                {/* Password */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                      style={{ color: "var(--fg-4)" }} />
                    <input
                      type={showPw ? "text" : "password"} required value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full rounded-xl border pl-9 pr-10 py-2.5 text-sm outline-none"
                      style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--fg)" }} />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--fg-4)" }}>
                      {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ background: i <= pw_strength ? STRENGTH_COLOR[pw_strength] : "rgba(255,255,255,0.08)" }} />
                        ))}
                      </div>
                      <p className="text-[10px]" style={{ color: STRENGTH_COLOR[pw_strength] }}>
                        {STRENGTH_LABEL[pw_strength]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                      style={{ color: "var(--fg-4)" }} />
                    <input
                      type={showPw ? "text" : "password"} required value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className="w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm outline-none"
                      style={{
                        background: "var(--surface)",
                        borderColor: confirm && confirm !== password ? "rgba(239,68,68,0.4)" : "var(--border)",
                        color: "var(--fg)",
                      }} />
                  </div>
                </div>

                {error && (
                  <p className="text-xs rounded-lg px-3 py-2 border"
                    style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                    {error}
                  </p>
                )}

                <button type="submit" disabled={loading || !token}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
                  style={{ background: "var(--accent)" }}>
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>

        <Link to="/login"
          className="mt-5 flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: "var(--fg-4)" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
