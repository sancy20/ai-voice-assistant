import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config/api";

const PLANS = [
  {
    key: "free",
    label: "Free",
    price: "$0",
    tokens: 10,
    features: ["10 AI tokens / 7 days", "Hold-to-speak voice assistant", "Basic voice commands", "Basic notes & reminders", "Limited history",],
  },
  {
    key: "pro",
    label: "Pro",
    price: "$9.99",
    period: "/mo",
    tokens: 500,
    popular: true,
    features: ["500 AI tokens / month", "Unlimited notes", "Unlimited reminders, tasks & alarms", "Full history access", "Search & media commands", "Priority processing", "Data export",],
  },
  {
    key: "business",
    label: "Business",
    price: "$29.99",
    period: "/mo",
    tokens: 2000,
    features: ["2,000 AI tokens / month", "Everything in Pro", "Admin dashboard", "User management", "Usage analytics", "Export reports", "API access", "Business priority support"],
  },
];

const PACKS = [
  { tokens: 50,   price: "$0.99", label: "Starter",  desc: "Try it out" },
  { tokens: 200,  price: "$2.99", label: "Plus",      desc: "Most popular", popular: true },
  { tokens: 500,  price: "$5.99", label: "Power",     desc: "Heavy users" },
  { tokens: 1000, price: "$9.99", label: "Max",       desc: "Best value" },
];

function Toast({ toast }) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] rounded-full border px-5 py-2.5 text-sm font-semibold"
          style={{
            background: toast.ok ? "var(--green-2)" : "var(--rose-2)",
            borderColor: toast.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
            color: toast.ok ? "var(--green)" : "var(--rose)",
            backdropFilter: "blur(12px)",
          }}>
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Subscription() {
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const [planLoading, setPlanLoading] = useState(null);
  const [packLoading, setPackLoading] = useState(null);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const upgradePlan = async (planKey) => {
    if (planKey === user?.plan) return;
    if (planKey !== "free") {
      navigate(`/payment?plan=${planKey}`);
      return;
    }
    setPlanLoading(planKey);
    try {
      const res = await fetch(`${API_URL}/api/subscription/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planKey }),
      });
      if (res.ok) { await refreshUser(); showToast("Switched to free plan"); }
      else showToast("Downgrade failed", false);
    } catch { showToast("Downgrade failed", false); }
    setPlanLoading(null);
  };

  const buyPack = async (tokens) => {
    setPackLoading(tokens);
    try {
      const res = await fetch(`${API_URL}/api/subscription/credits/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tokens }),
      });
      if (res.ok) { await refreshUser(); showToast(`+${tokens} tokens added`); }
      else showToast("Purchase failed", false);
    } catch { showToast("Purchase failed", false); }
    setPackLoading(null);
  };

  const currentPlan = user?.plan    ?? "free";
  const credits     = user?.credits ?? 0;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-14 py-5 sm:py-6">
      <Toast toast={toast} />

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10" style={{ marginBottom: "20px" }}>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "var(--fg)" }}>
          Plans &amp; Tokens
        </h1>
        <p className="text-sm" style={{ color: "var(--fg-4)" }}>
          You have{" "}
          <span className="font-semibold" style={{ color: "#a78bfa" }}>{credits} tokens</span>{" "}
          on the{" "}
          <span className="font-medium capitalize" style={{ color: "var(--fg-2)" }}>{currentPlan}</span> plan
        </p>
      </motion.div>

      {/* ── Plans ── */}
      <section className="mb-12" style={{ marginBottom: "30px" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "var(--fg-4)", marginBottom: "5px"}}>
          Monthly plans
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan, i) => {
            const isCurrent = currentPlan === plan.key;
            const isPopular = plan.popular;
            return (
              <motion.div key={plan.key}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative rounded-2xl border p-4 sm:p-6 flex flex-col overflow-hidden"
                style={{
                  background: isPopular
                    ? "linear-gradient(145deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.06) 100%)"
                    : "var(--surface)",
                  borderColor: isCurrent
                    ? "rgba(139,92,246,0.5)"
                    : isPopular
                    ? "rgba(139,92,246,0.3)"
                    : "var(--border)",
                  boxShadow: isPopular
                    ? "0 0 0 1px rgba(139,92,246,0.08) inset, 0 8px 32px rgba(139,92,246,0.1)"
                    : "none",
                }}>

                {/* Popular top glow line */}
                {isPopular && (
                  <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.7) 50%, transparent 100%)" }} />
                )}

                {/* Badge row */}
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--fg)" }}>
                    {plan.label}
                    {isPopular && <Sparkles className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />}
                  </p>
                  {isCurrent ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                      ✓ Current
                    </span>
                  ) : isPopular ? (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa",
                        border: "1px solid rgba(139,92,246,0.2)" }}>
                      Popular
                    </span>
                  ) : null}
                </div>

                {/* Price */}
                <div className="mb-2" style={{ marginBottom: "20px" }}>
                  <span className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: "var(--fg)", }}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm ml-1 font-medium" style={{ color: "var(--fg-4)" }}>{plan.period}</span>
                  )}
                </div>
                <p className="text-xs mb-5" style={{ color: "var(--fg-4)", marginBottom: "5px"}}>
                  {plan.key === "free" ? `${plan.tokens} tokens / 7 days` : `${plan.tokens} tokens/month`}
                </p>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-6" style={{ marginBottom: "50px" }}>
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-xs" style={{ color: "var(--fg-3)", marginBottom: "5px"}}>
                      <div className="h-4 w-4 rounded-full grid place-items-center shrink-0"
                        style={{ background: "var(--green-2)" }}>
                        <Check className="h-2.5 w-2.5" style={{ color: "var(--green)" }} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => upgradePlan(plan.key)}
                  disabled={isCurrent || planLoading === plan.key}
                  className="w-full rounded-full py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  style={isCurrent ? {
                    background: "transparent",
                    border: "1px solid var(--border-s)",
                    color: "var(--fg-4)",
                  } : isPopular ? {
                    background: "var(--accent-grad)",
                    color: "#fff",
                    boxShadow: "0 6px 20px rgba(139,92,246,0.35)",
                  } : {
                    background: "var(--surface-a)",
                    border: "1px solid var(--border)",
                    color: "var(--fg-2)",
                  }}>
                  {planLoading === plan.key
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : isCurrent
                    ? "Current plan"
                    : plan.key === "free"
                    ? "Downgrade"
                    : <><span>Get {plan.label}</span><ArrowRight className="h-3.5 w-3.5" /></>}
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Token packs ── */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-4)", marginBottom: "5px" }}>
            Buy tokens
          </p>
          <p className="text-xs" style={{ color: "var(--fg-4)" }}>One-time purchase, never expires</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PACKS.map((pack, i) => (
            <motion.button key={pack.tokens}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.025, y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={() => buyPack(pack.tokens)}
              disabled={packLoading === pack.tokens}
              className="relative rounded-2xl border p-5 text-left transition-all disabled:opacity-60 overflow-hidden group"
              style={{
                background: pack.popular
                  ? "linear-gradient(145deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.04) 100%)"
                  : "var(--surface)",
                borderColor: pack.popular ? "rgba(139,92,246,0.25)" : "var(--border)",
              }}>
              {pack.popular && (
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), transparent)" }} />
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: pack.popular ? "#a78bfa" : "var(--fg-3)" }}>
                    {pack.label}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--fg-4)" }}>{pack.desc}</p>
                </div>
                {pack.popular && <Zap className="h-4 w-4 shrink-0" style={{ color: "#a78bfa" }} />}
              </div>
              <p className="text-3xl font-black tracking-tight" style={{ color: "var(--fg)" }}>
                {packLoading === pack.tokens
                  ? <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent-fg)" }} />
                  : `+${pack.tokens}`}
              </p>
              <p className="text-xs mt-1 font-medium" style={{ color: "var(--fg-3)" }}>{pack.price}</p>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
  );
}
