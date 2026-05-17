import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Mic2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const MIC = (
  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
    <rect x="4.5" y="1" width="3" height="6" rx="1.5" fill="currentColor" />
    <path d="M2 6.5C2 8.98 3.79 11 6 11s4-2.02 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6" y1="11" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function pwStrength(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8)           s++;
  if (/[A-Z]/.test(p))         s++;
  if (/[0-9]/.test(p))         s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const STR_COLOR = ["", "#ef4444", "#f59e0b", "#22c55e", "#818cf8"];
const STR_LABEL = ["", "Weak", "Fair", "Good", "Strong"];

const field = (delay = 0) => ({
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0  },
  transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1], delay },
});

export default function Auth({ mode: initial = "login" }) {
  const { login, register } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();

  const [mode,     setMode]     = useState(initial);
  const [email,    setEmail]    = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const isLogin = mode === "login";
  const pw      = pwStrength(password);

  const switchTo = (m) => {
    if (m === mode) return;
    setMode(m); setError(""); setPassword(""); setShow(false);
    navigate(`/${m}`, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isLogin && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) await login(email, password);
      else         await register(email, username, password);
      toast.success(isLogin ? "Welcome back!" : "Account created!", undefined, 3000);
      navigate("/");
    } catch (err) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "var(--bg)" }}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ zIndex: 0 }}>
        <div style={{
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)",
        }} />
      </div>
      <div className="relative z-10 w-full max-w-[360px]">
        <motion.div
          initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 mb-10 select-none"
          style={{ marginBottom: "10px" }}>
          <div className="h-7 w-7 rounded-lg grid place-items-center text-white shrink-0"
            style={{ background: "var(--accent)" }}>
            {MIC}
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--fg)" }}>VoiceAI</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="rounded-2xl border p-6"
          style={{ background: "var(--bg-subtle)", borderColor: "var(--border)" }}>
          <AnimatePresence mode="wait">
            <motion.div key={mode}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
              className="mb-6"
              style={{ marginBottom: "24px" }}>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>
                {isLogin ? "Welcome back" : "Create account"}
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--fg-3)" }}>
                {isLogin ? "Sign in to your VoiceAI account." : "Start your AI voice assistant journey."}
              </p>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {error && (
              <motion.div key="err"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 14 }}
                exit={{    opacity: 0, height: 0,    marginBottom: 0  }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden">
                <div className="rounded-xl border px-3.5 py-2.5 text-xs flex items-center justify-between gap-2"
                  style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                  <span>{error}</span>
                  <button onClick={() => setError("")} className="opacity-60 hover:opacity-100 transition">✕</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.form key={mode}
              initial={{ opacity: 0, x: isLogin ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: isLogin ? 12 : -12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSubmit}
              className="space-y-3.5">
              <motion.div {...field(0)}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)"}}>Email</label>
                <input type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-white/20"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }} />
              </motion.div>
              <AnimatePresence initial={false}>
                {!isLogin && (
                  <motion.div key="username-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{    opacity: 0, height: 0    }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden">
                    <div className="pt-0.5">
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)", marginTop: "15px"}}>Username</label>
                      <input type="text" required autoComplete="username"
                        value={username} onChange={e => setUsername(e.target.value)}
                        placeholder="yourname"
                        className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-white/20"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)" }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div {...field(0.06)}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--fg-3)" , marginTop: "15px"}}>Password</label>
                  {isLogin && (
                    <Link to="/forgot-password"
                      className="text-[11px] transition-colors hover:text-white/70"
                      style={{ color: "var(--fg-4)" }}>
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"} required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={isLogin ? "••••••••" : "Min. 8 characters"}
                    className="w-full rounded-xl px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-white/20"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--fg)"}}/>
                  <button type="button" onClick={() => setShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 outline-none transition-opacity hover:opacity-80"
                    style={{ color: "var(--fg-4)" }}>
                    {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <AnimatePresence>
                  {!isLogin && password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}
                      className="overflow-hidden">
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {[1,2,3,4].map(i => (
                          <motion.div key={i} className="h-1 flex-1 rounded-full"
                            animate={{ backgroundColor: i <= pw ? STR_COLOR[pw] : "rgba(255,255,255,0.07)" }}
                            transition={{ duration: 0.25 }} />
                        ))}
                        <span className="text-[10px] w-10 text-right" style={{ color: STR_COLOR[pw] }}>
                          {STR_LABEL[pw]}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              <motion.button {...field(0.1)}
                type="submit" disabled={loading}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-55 mt-1"
                style={{ background: "var(--accent)", marginTop: "25px"}}>
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {isLogin ? "Signing in…" : "Creating…"}</>
                  : isLogin ? "Sign in" : "Create account"
                }
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="text-center text-xs mt-5"
          style={{ color: "var(--fg-4)", marginTop: "10px" }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => switchTo(isLogin ? "register" : "login")}
            className="font-medium transition-colors hover:text-white/80"
            style={{ color: "var(--fg-2)" }}>
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </motion.p>
      </div>
    </div>
  );
}
