import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic, LayoutDashboard, LogOut, ShieldCheck, UserCircle, Sun, Moon, Zap, Search, Music, Clock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import AssistantWidget from "../components/AssistantWidget";
import ActionScreen from "../components/ActionScreen";
import MediaOverlay from "../components/MediaOverlay";
import CenterSearchResults from "../components/CenterSearchResults";

const COMMANDS = [
  { icon: Search, label: "Search", example: '"search for cats"', color: "text-blue-400", bg: "bg-blue-500/10" },
  { icon: Music,  label: "Media",  example: '"play lofi music"', color: "text-purple-400", bg: "bg-purple-500/10" },
  { icon: Clock,  label: "Time",   example: '"what time is it"', color: "text-amber-400", bg: "bg-amber-500/10" },
  { icon: Zap,    label: "Open",   example: '"open youtube"',    color: "text-emerald-400", bg: "bg-emerald-500/10" },
];

export default function Home() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [centerPanelActive, setCenterPanelActive] = useState(false);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen t-bg t-fg">
      {!centerPanelActive && <ActionScreen />}
      <CenterSearchResults setCenterPanelActive={setCenterPanelActive} />
      <MediaOverlay setCenterPanelActive={setCenterPanelActive} />
      <nav className="sticky top-0 z-40 border-b t-border-sm t-bg-nav backdrop-blur px-5 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/25">
              <Mic className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <span className="text-sm font-semibold t-fg-90">VoiceAI</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.is_admin && (
              <Link to="/admin"
                className="flex items-center gap-1.5 rounded-xl border t-border t-bg-item px-3 py-1.5 text-xs font-medium t-fg-70 hover:t-bg-hover transition">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
            <Link to="/profile"
              className="flex items-center gap-2 rounded-xl border t-border t-bg-item px-3 py-1.5 hover:t-bg-hover transition">
              {user?.is_admin
                ? <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                : <UserCircle className="h-3.5 w-3.5 t-fg-50" />}
              <span className="text-xs font-medium t-fg-70">{user?.username}</span>
            </Link>
            <button onClick={toggleTheme}
              className="grid h-8 w-8 place-items-center rounded-xl border t-border t-bg-item hover:t-bg-hover transition"
              title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark"
                ? <Sun className="h-3.5 w-3.5 text-amber-400" />
                : <Moon className="h-3.5 w-3.5 text-indigo-400" />}
            </button>
            <button onClick={handleLogout}
              className="grid h-8 w-8 place-items-center rounded-xl border t-border t-bg-item hover:t-bg-hover transition"
              title="Sign out">
              <LogOut className="h-3.5 w-3.5 t-fg-50" />
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-3xl px-6 pt-20 pb-40 text-center">
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 h-72 w-72 rounded-full bg-indigo-500/8 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border t-border t-bg-card px-4 py-1.5 text-xs t-fg-50 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected · Ready to listen
          </div>
          <h1 className="text-5xl font-bold t-fg tracking-tight leading-tight mb-4">
            Your voice,<br />
            <span className="text-indigo-400">your command.</span>
          </h1>
          <p className="text-base t-fg-50 mb-12 max-w-md mx-auto leading-relaxed">
            Hold the button to speak, or say the wake word to go hands-free.
            Search, play media, set reminders and more.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-10 text-left">
            {COMMANDS.map(({ icon: Icon, label, example, color, bg }) => (
              <div key={label} className="rounded-2xl border t-border t-bg-card p-4 hover:t-bg-item transition">
                <div className={`inline-grid h-8 w-8 place-items-center rounded-xl ${bg} mb-3`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-xs font-semibold t-fg-80 mb-0.5">{label}</p>
                <p className="text-xs t-fg-40 font-mono">{example}</p>
              </div>
            ))}
          </div>
          <p className="text-xs t-fg-30">
            Wake word: <span className="t-fg-50 font-mono">"hey assistant"</span>
            {" · "}Push-to-Talk via the widget below
          </p>
        </div>
      </main>

      <AssistantWidget />
    </div>
  );
}
