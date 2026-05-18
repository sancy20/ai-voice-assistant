import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Send, Copy, Check } from "lucide-react";
import { API_URL } from "../config/api";

const MIC_SVG = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="4.5" y="1" width="3" height="6" rx="1.5" fill="white"/>
    <path d="M2 6.5C2 8.98 3.79 11 6 11s4-2.02 4-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6" y1="11" x2="6" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default function ForgotPassword() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [token,   setToken]   = useState(null);
  const [copied,  setCopied]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Request failed");
      setToken(data.token);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/reset-password?token=${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg)", color: "var(--fg)" }}>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8" style={{marginBottom: "5px"}}>
          <div className="h-6 w-6 rounded-md grid place-items-center shrink-0"
            style={{ background: "var(--accent)", marginBottom: "10px"}}>
            {MIC_SVG}
          </div>
          <span className="text-sm font-semibold">VoiceAI</span>
        </div>

        <div className="rounded-2xl border p-6"
          style={{ background: "var(--bg-subtle)", borderColor: "var(--border)" }}>

          <h1 className="text-lg font-bold mb-1" style={{ color: "var(--fg)" }}>Reset password</h1>
          <p className="text-sm mb-6" style={{ color: "var(--fg-3)", marginBottom: "24px" }}>
            Enter your email and we'll generate a reset link.
          </p>

          {!token ? (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                    style={{ color: "var(--fg-4)" }} />
                  <input
                    type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm outline-none transition-colors"
                    style={{
                      background: "var(--surface)", borderColor: "var(--border)",
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

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
                style={{ background: "var(--accent)", marginTop: "25px"}}>
                <Send className="h-3.5 w-3.5" />
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }} className="space-y-4">
              <div className="rounded-xl border p-4"
                style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.2)", marginBottom: "16px" }}>
                <p className="text-xs font-semibold mb-1" style={{ color: "#34d399" }}>Reset link generated</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  In production this would be emailed. For now, copy the link below.
                </p>
              </div>

              <div className="rounded-xl border px-3 py-2.5 flex items-center gap-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", marginBottom: "16px"}}>
                <code className="flex-1 text-[11px] truncate" style={{ color: "var(--fg-3)" }}>
                  /reset-password?token={token.slice(0, 12)}…
                </code>
                <button onClick={copy}
                  className="shrink-0 h-6 w-6 grid place-items-center rounded-lg transition-colors"
                  style={{ background: "var(--surface-h)", color: "var(--fg-3)" }}>
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              <Link to={`/reset-password?token=${token}`}
                className="block w-full text-center rounded-xl py-2.5 text-sm font-semibold text-white"
                style={{ background: "var(--accent)" }}>
                Go to reset page
              </Link>
            </motion.div>
          )}
        </div>

        <Link to="/login"
          className="mt-5 flex items-center gap-1.5 text-xs transition-colors"
          style={{ color: "var(--fg-4)", marginTop: "10px"}}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
