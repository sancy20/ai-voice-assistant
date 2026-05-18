import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

const strengthOf = (p) =>
  p.length === 0 ? 0 : p.length < 8 ? 1 : p.length < 12 ? 2 : 3;
const strengthColor = ["transparent", "#ef4444", "#f59e0b", "#22c55e"];
const strengthLabel = ["", "Weak", "Fair", "Strong"];

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow]         = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const strength = strengthOf(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try { await register(email, username, password); navigate("/"); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}>

      <motion.div className="w-full max-w-[360px]"
        variants={stagger} initial="hidden" animate="show">

        {/* Wordmark */}
        <motion.div variants={item} className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-6 w-6 rounded-md flex items-center justify-center"
              style={{ background: "var(--accent)" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="4.5" y="1" width="3" height="6" rx="1.5" fill="white"/>
                <path d="M2 6.5C2 8.98 3.79 11 6 11s4-2.02 4-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="6" y1="11" x2="6" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>VoiceAI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>Create account</h1>
          <p className="text-sm mt-1" style={{ color: "var(--fg-3)" }}>
            First user gets admin access
          </p>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-lg border px-3.5 py-2.5 text-sm"
            style={{ background: "var(--rose-2)", borderColor: "rgba(239,68,68,0.2)", color: "var(--rose)" }}>
            {error}
          </motion.div>
        )}

        {/* Form */}
        <motion.form variants={item} onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg px-3.5 py-2.5 text-sm"
              style={{ background: "var(--surface-h)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>Username</label>
            <input type="text" required value={username} onChange={e => setUsername(e.target.value)}
              placeholder="yourname"
              className="w-full rounded-lg px-3.5 py-2.5 text-sm"
              style={{ background: "var(--surface-h)", border: "1px solid var(--border)", color: "var(--fg)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>Password</label>
            <div className="relative">
              <input type={show ? "text" : "password"} required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm"
                style={{ background: "var(--surface-h)", border: "1px solid var(--border)", color: "var(--fg)" }}
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--fg-4)" }}>
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map(i => (
                    <motion.div key={i} className="h-0.5 flex-1 rounded-full"
                      animate={{ backgroundColor: i <= strength ? strengthColor[strength] : "rgba(255,255,255,0.07)" }}
                      transition={{ duration: 0.2 }}
                    />
                  ))}
                </div>
                <span className="text-[11px] w-8 text-right" style={{ color: strengthColor[strength] }}>
                  {strengthLabel[strength]}
                </span>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity"
            style={{ background: "var(--accent)", opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
          </button>
        </motion.form>

        <motion.p variants={item} className="mt-5 text-xs text-center" style={{ color: "var(--fg-4)" }}>
          Already have an account?{" "}
          <Link to="/login" className="font-medium hover:underline" style={{ color: "var(--fg-2)" }}>
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
