import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, QrCode, Building2, Lock, Check,
  Loader2, ShieldCheck, Copy, Zap, ArrowLeft,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config/api";

const PLAN_DATA = {
  pro:      { label: "Pro Plan",      price: 9.99,  period: "/ month", tokens: 500  },
  business: { label: "Business Plan", price: 29.99, period: "/ month", tokens: 2000 },
};
const TAX_RATE = 0.09;

const METHODS = [
  { id: "card", label: "Credit Card", icon: CreditCard },
  { id: "qr",   label: "QR / Mobile", icon: QrCode   },
  // { id: "bank", label: "Bank Transfer", icon: Building2 },
];

const CARD_BRANDS = {
  visa:       { label: "VISA",   color: "#1a3a6e" },
  mastercard: { label: "MC",     color: "#6e1a1a" },
  amex:       { label: "AMEX",   color: "#1a3d6e" },
  discover:   { label: "DISC",   color: "#5a3a0a" },
  unknown:    { label: "",       color: "#1a1a1a" },
};

function getBrand(v) {
  const n = v.replace(/\s/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]|^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6/.test(n)) return "discover";
  return "unknown";
}

function fmtCard(v) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
}
function fmtExpiry(v) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/* ── Credit card visual ── */
function CardPreview({ num, expiry, holder, cvv, flipped }) {
  const brand = getBrand(num);
  const bg = `linear-gradient(135deg, ${CARD_BRANDS[brand].color} 0%, #0c0c0c 100%)`;

  return (
    <div style={{ perspective: "900px", height: "clamp(130px, 22vw, 160px)", marginBottom: 4 }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformStyle: "preserve-3d", width: "100%", height: "100%", position: "relative" }}>

        {/* Front */}
        <div className="absolute inset-0 rounded-2xl p-5 flex flex-col justify-between select-none"
          style={{ background: bg, backfaceVisibility: "hidden", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          <div className="flex items-start justify-between">
            <div className="h-5 w-8 rounded-sm"
              style={{ background: "linear-gradient(135deg, #f0c030, #d4a000)" }} />
            <span className="text-[11px] font-bold tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>
              {CARD_BRANDS[brand].label}
            </span>
          </div>
          <div>
            <p className="font-mono text-sm tracking-widest text-white mb-3 tabular-nums">
              {num || "•••• •••• •••• ••••"}
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Card Holder
                </p>
                <p className="text-xs font-medium text-white truncate max-w-[130px]">
                  {holder || "FULL NAME"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Expires
                </p>
                <p className="text-xs font-medium text-white font-mono">{expiry || "MM/YY"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden select-none"
          style={{ background: bg, backfaceVisibility: "hidden", transform: "rotateY(180deg)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
          <div className="h-10 mt-5 w-full" style={{ background: "rgba(0,0,0,0.5)" }} />
          <div className="px-5 mt-4 flex items-center justify-end gap-2">
            <div className="flex-1 h-7 rounded-l" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="w-14 h-7 rounded-r flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.92)" }}>
              <span className="font-mono text-sm font-bold text-gray-900">{cvv || "•••"}</span>
            </div>
          </div>
          <p className="text-right px-5 mt-1 text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            CVV
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ── QR code visual (decorative) ── */
function QRVisual({ accent = "#818cf8" }) {
  const N = 15;
  const cells = Array.from({ length: N * N }, (_, i) => {
    const r = Math.floor(i / N), c = i % N;
    const inFinder = (
      (r < 5 && c < 5) || (r < 5 && c >= N - 5) || (r >= N - 5 && c < 5)
    );
    if (inFinder) {
      const fr = r >= N - 5 ? r - (N - 5) : r;
      const fc = c >= N - 5 ? c - (N - 5) : c;
      return fr === 0 || fr === 4 || fc === 0 || fc === 4 || (fr === 2 && fc === 2);
    }
    return ((r * 11 + c * 7 + r * c * 3) % 4) === 0;
  });

  return (
    <div className="p-4 rounded-2xl border"
      style={{ background: "var(--surface)", borderColor: "var(--border)", display: "inline-block" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${N}, 10px)`, gap: 2 }}>
        {cells.map((filled, i) => (
          <div key={i} style={{
            width: 10, height: 10,
            background: filled ? accent : "transparent",
            borderRadius: 2,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ── Input field ── */
function Field({ label, value, onChange, placeholder, type = "text", maxLength, inputMode, hint, right }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>{label}</label>
      <div className="relative">
        <input
          type={type} value={value} onChange={onChange}
          placeholder={placeholder} maxLength={maxLength} inputMode={inputMode}
          autoComplete="off"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm font-mono"
          style={{
            background: "var(--surface-h)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
            paddingRight: right ? "2.5rem" : undefined,
          }}
        />
        {right}
      </div>
      {hint && <p className="text-[11px] mt-1" style={{ color: "var(--fg-4)" }}>{hint}</p>}
    </div>
  );
}

const BANK = {
  "Account Name": "VoiceAI Ltd.",
  "Bank": "Chase Bank, N.A.",
  "Account No.": "•••• •••• 4291",
  "Routing No.": "021 000 021",
  "Reference": `VOICEAI-PRO-${new Date().getFullYear()}`,
};

export default function Payment() {
  const [params] = useSearchParams();
  const planKey  = params.get("plan") ?? "pro";
  const plan     = PLAN_DATA[planKey] ?? PLAN_DATA.pro;
  const tax      = +(plan.price * TAX_RATE).toFixed(2);
  const total    = +(plan.price + tax).toFixed(2);

  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();

  const [method,  setMethod]  = useState("card");
  const [cardNum, setCardNum] = useState("");
  const [expiry,  setExpiry]  = useState("");
  const [cvv,     setCvv]     = useState("");
  const [holder,  setHolder]  = useState((user?.username ?? "").toUpperCase());
  const [flipped, setFlipped] = useState(false);
  const [paying,  setPaying]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState("");

  const copy = (k, v) => {
    navigator.clipboard.writeText(v.replace(/•/g, "")).catch(() => {});
    setCopied(k); setTimeout(() => setCopied(""), 1500);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setError("");

    if (method === "card") {
      if (cardNum.replace(/\s/g, "").length < 16) {
        return setError("Enter a valid 16-digit card number");
      }
      if (expiry.length < 5) {
        return setError("Enter a valid expiry date (MM/YY)");
      }
      if (cvv.length < 3) {
        return setError("Enter the CVV code");
      }
    }

    setPaying(true);

    try {
      const res = await fetch(`${API_URL}/subscription/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planKey }),
      });

      await new Promise((r) => setTimeout(r, 1200));

      if (!res.ok) {
        let message = "Payment failed. Please try again.";
        try {
          const data = await res.json();
          message = data.detail || message;
        } catch {}

        setError(message);
        setSuccess(false);
        return;
      }

      await refreshUser();
      setSuccess(true);
    } catch (err) {
      setError("Cannot connect to server. Please check backend is running.");
      setSuccess(false);
    } finally {
      setPaying(false);
    }
  };

  /* ── Success screen ── */
  if (success) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-16">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="max-w-sm w-full text-center space-y-6">

          <div style={{ display: "flex", justifyContent: "center", width: "100%", marginBottom: "28px" }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.15 }}
              className="grid place-items-center rounded-full"
              style={{
                width: "72px",
                height: "72px",
                background: "var(--green-2)",
                border: "1px solid rgba(34,197,94,0.3)",
                boxShadow: "0 0 32px rgba(34,197,94,0.2)",
              }}
            >
              <Check style={{ width: "36px", height: "36px", color: "var(--green)" }} />
            </motion.div>
          </div>

          <div>
            <p className="text-2xl font-bold tracking-tight" style={{ color: "var(--fg)", marginTop: "20px"}}>Payment successful</p>
            <p className="text-sm mt-2" style={{ color: "var(--fg-4)" }}>
              You're now on the <span className="font-medium" style={{ color: "var(--fg-2)" }}>{plan.label}</span>.
              Enjoy {plan.tokens} tokens/month.
            </p>
          </div>

          <div className="rounded-xl border divide-y overflow-hidden text-left"
            style={{ background: "var(--surface)", borderColor: "var(--border)", marginTop: "20px"}}>
            {[
              ["Plan", plan.label],
              ["Billing", plan.period.replace("/", "").trim()],
              ["Amount charged", `$${total.toFixed(2)}`],
              ["Status", "✓ Paid"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm" style={{ color: "var(--fg-4)" }}>{k}</span>
                <span className="text-sm font-medium" style={{ color: k === "Status" ? "var(--green)" : "var(--fg)" }}>{v}</span>
              </div>
            ))}
          </div>

          <button onClick={() => navigate("/")}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white"
            style={{ background: "var(--accent)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)", marginTop: "20px"}}>
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Main payment UI ── */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-5xl mx-auto">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-3 mb-7" style={{marginBottom: "10px"}}>
        <button onClick={() => navigate(-1)}
          className="h-8 w-8 grid place-items-center rounded-lg border transition-colors hover:bg-[var(--surface-h)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--fg-3)" }}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--fg)" }}>Checkout</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Lock className="h-3 w-3" style={{ color: "var(--green)" }} />
            <p className="text-xs" style={{ color: "var(--fg-4)" }}>256-bit SSL encrypted</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_min(288px,40%)] gap-4 sm:gap-6 xl:gap-8">

        {/* ── Left: Payment form ── */}
        <div className="space-y-5">

          {/* Method tabs */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-3 gap-2">
            {METHODS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setMethod(id)}
                className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-all"
                style={{
                  background: method === id ? "var(--accent-2)" : "var(--surface)",
                  color: method === id ? "var(--accent-fg)" : "var(--fg-3)",
                  borderColor: method === id ? "rgba(99,102,241,0.3)" : "var(--border)",
                }}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </motion.div>

          {/* Form panels */}
          <AnimatePresence mode="wait">

            {/* ── Credit card ── */}
            {method === "card" && (
              <motion.div key="card"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="space-y-5" style={{marginTop: "15px"}}>

                <CardPreview num={cardNum} expiry={expiry} holder={holder} cvv={cvv} flipped={flipped} />

                <form onSubmit={handlePay} className="space-y-4" style={{marginTop: "15px"}}>
                  <Field label="Card number"
                    value={cardNum}
                    onChange={e => setCardNum(fmtCard(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric" />

                  <div className="grid grid-cols-2 gap-2 sm:gap-3" style={{marginTop: "15px", marginBottom: "10px"}}>
                    <Field label="Expiry"
                      value={expiry}
                      onChange={e => setExpiry(fmtExpiry(e.target.value))}
                      placeholder="MM/YY"
                      inputMode="numeric" />
                    <Field label="CVV"
                      value={cvv}
                      onChange={e => { setCvv(e.target.value.replace(/\D/g, "").slice(0, 4)); setFlipped(true); }}
                      type="password"
                      placeholder="•••"
                      maxLength={4}
                      hint="3–4 digits on card back" />
                  </div>

                  <Field label="Cardholder name"
                    value={holder}
                    onChange={e => setHolder(e.target.value.toUpperCase())}
                    placeholder="FIRST LAST" />

                  <AnimatePresence>
                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-xs px-3.5 py-2.5 rounded-xl border"
                        style={{ background: "var(--rose-2)", borderColor: "rgba(239,68,68,0.2)", color: "var(--rose)", marginTop: "15px"}}>
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit" disabled={paying}
                    onMouseLeave={() => setFlipped(false)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--accent)", boxShadow: "0 4px 20px rgba(99,102,241,0.3)", marginTop: "20px",}}> 
                    {paying
                      ? <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                      : <><Lock className="h-3.5 w-3.5" />Pay ${total.toFixed(2)}</>}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── QR / Mobile ── */}
            {method === "qr" && (
              <motion.div key="qr"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col items-center gap-5 py-4">

                <QRVisual accent="var(--accent-fg)" />

                <div className="text-center max-w-xs">
                  <p className="text-sm font-semibold" style={{ color: "var(--fg-2)" }}>
                    Scan to pay ${total.toFixed(2)}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--fg-4)" }}>
                    Open any payment app — PayPal, Apple Pay, Google Pay, PromptPay, or any crypto wallet
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--fg-4)" }}>
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--green)", animation: "pulse-dot 2s ease-in-out infinite" }} />
                  QR refreshes automatically
                </div>

                <button onClick={() => setSuccess(true)}
                  className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                  <Check className="h-4 w-4" /> I've completed payment
                </button>
              </motion.div>
            )}

            {/* ── Bank transfer ── */}
            {/* {method === "bank" && (
              <motion.div key="bank"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="space-y-4">

                <p className="text-sm leading-relaxed" style={{ color: "var(--fg-3)" }}>
                  Transfer exactly <span className="font-semibold" style={{ color: "var(--fg-2)" }}>${total.toFixed(2)}</span> to
                  the account below. Your plan activates within 1 business day after confirmation.
                </p>

                <div className="rounded-xl border overflow-hidden"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  {Object.entries(BANK).map(([label, value]) => (
                    <div key={label}
                      className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                      style={{ borderColor: "var(--border-s)" }}>
                      <div>
                        <p className="text-[11px] font-medium" style={{ color: "var(--fg-4)" }}>{label}</p>
                        <p className="text-sm font-mono mt-0.5" style={{ color: "var(--fg-2)" }}>{value}</p>
                      </div>
                      <button onClick={() => copy(label, value)}
                        className="h-7 w-7 grid place-items-center rounded-lg transition-colors hover:bg-[var(--surface-h)]"
                        style={{ color: copied === label ? "var(--green)" : "var(--fg-4)" }}>
                        {copied === label
                          ? <Check className="h-3.5 w-3.5" />
                          : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={() => setSuccess(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white"
                  style={{ background: "var(--accent)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}>
                  <Check className="h-4 w-4" /> I've sent the transfer
                </button>
              </motion.div>
            )} */}
          </AnimatePresence>
        </div>

        {/* ── Right: Order summary ── */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
          className="space-y-3 lg:sticky lg:top-6 h-fit">

          {/* Summary card */}
          <div className="rounded-xl border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)", marginTop: "10px", marginBottom: "15px"}}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-s)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--fg-4)" }}>
                Order summary
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{plan.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-4)" }}>Billed {plan.period}</p>
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>${plan.price.toFixed(2)}</p>
              </div>
              <div className="flex justify-between text-xs pt-1" style={{ color: "var(--fg-4)" }}>
                <span>Tax (9%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t"
                style={{ borderColor: "var(--border-s)" }}>
                <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Total due</span>
                <span className="text-lg font-bold" style={{ color: "var(--fg)" }}>
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Included features */}
          <div className="rounded-xl border p-4 space-y-2.5"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--fg-4)" }}>
              Included
            </p>
            {[
              `${plan.tokens} AI tokens/month`,
              "Priority processing",
              "Full history access",
              "Media & YouTube search",
              "Wake-word mode",
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--fg-3)" }}>
                <Zap className="h-3 w-3 shrink-0" style={{ color: "var(--accent-fg)" }} />
                {f}
              </div>
            ))}
          </div>

          {/* Trust badge */}
          <div className="flex items-center justify-center gap-2 py-2"
            style={{ color: "var(--fg-4)" }}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="text-xs">Payments never stored on our servers</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
