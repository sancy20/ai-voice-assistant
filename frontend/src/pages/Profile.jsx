import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Mail, Lock, Eye, EyeOff, Save, Loader2,
  Sun, Moon, LogOut, Camera, Bell, BellOff,
  Volume2, VolumeX, Zap, ChevronRight, Shield, CreditCard,
} from "lucide-react";
import { useAuth }  from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { API_URL as API } from "../config/api"

const PLAN_LIMITS = { free: 10, pro: 500, business: 2000, unlimited: Infinity };
const PLAN_COLORS = { free: "#6b7280", pro: "#6366f1", business: "#f59e0b", unlimited: "#a78bfa" };
const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#22c55e","#3b82f6"];

const pwStrength = (p) => p.length === 0 ? 0 : p.length < 8 ? 1 : p.length < 12 ? 2 : 3;
const strengthColor = ["transparent", "#ef4444", "#f59e0b", "#22c55e"];
const strengthLabel = ["", "Weak", "Fair", "Strong"];

function resizeToBase64(file, maxPx = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Toast({ msg, ok }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] rounded-lg border px-4 py-2.5 text-sm font-medium whitespace-nowrap shadow-lg"
      style={{
        background: ok ? "var(--green-2)" : "var(--rose-2)",
        borderColor: ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
        color: ok ? "var(--green)" : "var(--rose)",
      }}>
      {msg}
    </motion.div>
  );
}

function Section({ title, desc, delay = 0, children }) {
  return (
    <motion.section initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border overflow-hidden relative"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.4), transparent)" }} />
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-s)"}}>
        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{title}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: "var(--fg-4)" }}>{desc}</p>}
      </div>
      <div className="p-5 space-y-0">{children}</div>
    </motion.section>
  );
}

function InputField({ label, icon: Icon, type = "text", value, onChange, placeholder, right }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--fg-3)" }}>
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </label>
      <div className="relative">
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
          style={{
            background: "var(--surface-h)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
            paddingRight: right ? "2.75rem" : undefined,
          }}
        />
        {right}
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, value, onChange, iconColor, first }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="w-full flex items-center gap-3 py-3 text-left"
      style={{ borderTop: first ? "none" : "1px solid var(--border-s)" }}>
      <div className="h-7 w-7 rounded-lg grid place-items-center shrink-0"
        style={{ background: "var(--surface-h)" }}>
        <Icon className="h-3.5 w-3.5" style={{ color: iconColor ?? "var(--fg-3)" }} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium" style={{ color: "var(--fg-2)" }}>{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: "var(--fg-4)" }}>{desc}</p>}
      </div>
      <div className="h-5 w-9 rounded-full shrink-0 relative transition-colors duration-200"
        style={{ background: value ? "var(--accent-fg)" : "rgba(255,255,255,0.12)" }}>
        <motion.div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
          animate={{ left: value ? "calc(100% - 18px)" : "2px" }}
          transition={{ type: "spring", stiffness: 500, damping: 38 }} />
      </div>
    </button>
  );
}

export default function Profile() {
  const { user, token, logout, refreshUser } = useAuth();
  const { theme, toggle: toggleTheme }       = useTheme();
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [username,    setUsername]    = useState(user?.username ?? "");
  const [email,       setEmail]       = useState(user?.email    ?? "");
  const [oldPw,       setOldPw]       = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [showOld,     setShowOld]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [changingPw,  setChangingPw]  = useState(false);
  const [uploadingAv, setUploadingAv] = useState(false);
  const [toast,       setToast]       = useState(null);

  const [notifSound,  setNotifSound]  = useState(() => localStorage.getItem("notif_sound")  !== "false");
  const [notifBanner, setNotifBanner] = useState(() => localStorage.getItem("notif_banner") !== "false");

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const plan        = user?.plan    ?? "free";
  const credits     = user?.credits ?? 0;
  const isUnlimited = plan === "unlimited";
  const limit       = PLAN_LIMITS[plan] ?? 10;
  const planColor   = PLAN_COLORS[plan] ?? "#6b7280";
  const usedPct     = isUnlimited ? 0 : Math.round(Math.max(0, ((limit - credits) / limit) * 100));
  const tokenColor  = isUnlimited ? "#a78bfa" : usedPct > 80 ? "var(--rose)" : usedPct > 50 ? "#f59e0b" : "var(--accent-fg)";
  const avatarBg    = AVATAR_COLORS[(user?.username?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  const pw         = pwStrength(newPw);

  const handleSound  = (v) => { setNotifSound(v);  localStorage.setItem("notif_sound",  String(v)); };
  const handleBanner = (v) => { setNotifBanner(v); localStorage.setItem("notif_banner", String(v)); };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username, email }),
      });
      if (res.ok) { await refreshUser(); showToast("Profile saved"); }
      else { const d = await res.json(); showToast(d.detail || "Save failed", false); }
    } catch { showToast("Save failed", false); }
    setSaving(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) { showToast("Password must be at least 8 characters", false); return; }
    setChangingPw(true);
    try {
      const res = await fetch(`${API}/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: oldPw, new_password: newPw }),
      });
      if (res.ok) { setOldPw(""); setNewPw(""); showToast("Password changed"); }
      else { const d = await res.json(); showToast(d.detail || "Failed", false); }
    } catch { showToast("Failed", false); }
    setChangingPw(false);
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Please select an image file", false); return; }
    setUploadingAv(true);
    try {
      const b64 = await resizeToBase64(file, 256);
      const res = await fetch(`${API}/auth/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: b64 }),
      });
      if (res.ok) { await refreshUser(); showToast("Avatar updated"); }
      else { const d = await res.json(); showToast(d.detail || "Upload failed", false); }
    } catch { showToast("Upload failed", false); }
    setUploadingAv(false);
    e.target.value = "";
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 2xl:px-12 py-5 sm:py-8 max-w-5xl mx-auto">

      <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>

      {/* Account card */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-6 mb-7 flex flex-col sm:flex-row sm:items-center gap-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)", marginBottom: "10px" }}>

        {/* Avatar */}
        <div className="relative shrink-0 self-start sm:self-center">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="avatar"
                className="h-16 w-16 rounded-2xl object-cover"
                style={{ border: "2px solid var(--border)" }} />
            : <div className="h-16 w-16 rounded-2xl grid place-items-center font-bold text-2xl text-white"
                style={{ background: avatarBg }}>
                {user?.username?.[0]?.toUpperCase()}
              </div>}
          <button onClick={() => fileRef.current?.click()} disabled={uploadingAv}
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border grid place-items-center transition-colors hover:bg-[var(--surface-h)]"
            style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
            {uploadingAv
              ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: "var(--fg-4)" }} />
              : <Camera className="h-3 w-3" style={{ color: "var(--fg-3)" }} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-base font-semibold" style={{ color: "var(--fg)" }}>{user?.username}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
              style={{ background: `${planColor}22`, color: planColor }}>
              {plan}
            </span>
            {user?.is_admin && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--accent-2)", color: "var(--accent-fg)" }}>
                <Shield className="h-2.5 w-2.5" /> Admin
              </span>
            )}
          </div>
          <p className="text-sm mb-3" style={{ color: "var(--fg-4)" }}>{user?.email}</p>

          {/* Token bar */}
          {isUnlimited ? (
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
              <span className="text-sm font-semibold" style={{ color: "#a78bfa" }}>Unlimited tokens</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, usedPct)}%` }}
                  transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                  style={{ background: tokenColor }} />
              </div>
              <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--fg-4)" }}>
                <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>{credits}</span>
                <span>/{limit} tokens</span>
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 items-start">

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Profile */}
          <Section title="Profile" desc="Your display name and email address." delay={0.04} >
            <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <InputField label="Username" icon={User}
                value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname" />
              <InputField label="Email" icon={Mail} type="email"
                value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                style={{ background: "var(--accent-grad)", boxShadow: "0 4px 16px rgba(139,92,246,0.3)", marginTop: "20px" }}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save changes
              </button>
            </form>
          </Section>

          {/* Appearance */}
          <Section title="Appearance" desc="Customize how VoiceAI looks." delay={0.1}>
            <ToggleRow
              first
              icon={theme === "dark" ? Sun : Moon}
              label={theme === "dark" ? "Light mode" : "Dark mode"}
              desc="Switch the interface color scheme"
              value={theme === "light"}
              onChange={() => toggleTheme()}
              iconColor={theme === "dark" ? "#f59e0b" : "#818cf8"}
            />
          </Section>

          {/* Notifications */}
          <Section title="Notifications" desc="Control alerts and audio feedback." delay={0.16}>
            <ToggleRow
              first
              icon={notifSound ? Volume2 : VolumeX}
              label="Sound effects"
              desc="Audio cues on assistant events"
              value={notifSound}
              onChange={handleSound}
              iconColor="var(--accent-fg)"
            />
            <ToggleRow
              icon={notifBanner ? Bell : BellOff}
              label="In-app banners"
              desc="Toast notifications for actions"
              value={notifBanner}
              onChange={handleBanner}
              iconColor="var(--accent-fg)"
            />
          </Section>

        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Security */}
          <Section title="Security" desc="Update your account password." delay={0.07}>
            <form onSubmit={changePassword} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <InputField label="Current password" icon={Lock}
                type={showOld ? "text" : "password"}
                value={oldPw} onChange={e => setOldPw(e.target.value)}
                placeholder="••••••••"
                right={
                  <button type="button" onClick={() => setShowOld(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--fg-4)"}}>
                    {showOld ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                }
              />
              <div>
                <InputField label="New password" icon={Lock}
                  type={showNew ? "text" : "password"}
                  value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  right={
                    <button type="button" onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--fg-4)" }}>
                      {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  }
                />
                <AnimatePresence>
                  {newPw.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="flex items-center gap-1.5 mt-2">
                        {[1,2,3].map(i => (
                          <motion.div key={i} className="h-0.5 flex-1 rounded-full"
                            animate={{ backgroundColor: i <= pw ? strengthColor[pw] : "rgba(255,255,255,0.07)" }}
                            transition={{ duration: 0.2 }} />
                        ))}
                        <span className="text-[11px] w-9 text-right" style={{ color: strengthColor[pw] }}>
                          {strengthLabel[pw]}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button type="submit" disabled={changingPw || !oldPw || !newPw}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: "var(--accent-grad)", boxShadow: "0 4px 16px rgba(139,92,246,0.3)", marginTop: "20px"}}>
                {changingPw ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                Change password
              </button>
            </form>
          </Section>

          {/* Plan & Usage */}
          <Section title="Plan & Usage" desc="Your current subscription and token usage." delay={0.13}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Plan badge row */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: `${planColor}12`, border: `1px solid ${planColor}28` }}>
                <div className="flex items-center gap-2.5">
                  <Zap className="h-4 w-4" style={{ color: planColor }} />
                  <div>
                    <p className="text-sm font-semibold capitalize" style={{ color: "var(--fg)" }}>
                      {plan === "unlimited" ? "Unlimited" : `${plan.charAt(0).toUpperCase() + plan.slice(1)}`} Plan
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
                      {isUnlimited ? "No token limits" : `${credits} of ${limit} tokens remaining`}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${planColor}22`, color: planColor }}>
                  {isUnlimited ? "∞" : `${usedPct}%`}
                </span>
              </div>

              {/* Progress bar — only for non-unlimited */}
              {!isUnlimited && (
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <motion.div className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, usedPct)}%` }}
                      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                      style={{ background: tokenColor }} />
                  </div>
                  <div className="flex justify-between text-[11px]" style={{ color: "var(--fg-4)" }}>
                    <span>{credits} remaining</span>
                    <span>{usedPct}% used</span>
                  </div>
                </div>
              )}

              <button onClick={() => navigate("/subscription")}
                className="w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--surface-h)]"
                style={{ background: "var(--surface-h)", borderColor: "var(--border-s)", color: "var(--fg-2)" }}>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5" style={{ color: "var(--fg-4)" }} />
                  Manage subscription
                </div>
                <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--fg-4)" }} />
              </button>
            </div>
          </Section>

          {/* Sign out */}
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <button onClick={() => { logout(); navigate("/"); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors hover:bg-[var(--rose-2)]"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--rose)" }}>
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
