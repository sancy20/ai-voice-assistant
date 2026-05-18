import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Mic2, History, StickyNote, CreditCard,
  Settings, LogOut, Sun, Moon, Zap, ChevronLeft, Menu, X, ShieldCheck,
} from "lucide-react";
import { useAuth }      from "../context/AuthContext";
import { useTheme }     from "../context/ThemeContext";
import { useAssistant } from "../context/AssistantContext";
import ActionScreen        from "./ActionScreen";
import MediaOverlay        from "./MediaOverlay";
import CenterSearchResults from "./CenterSearchResults";
import { loadAssistantItems, isItemDue } from "./assistantItems";

const NAV = [
  { to: "/assistant",  icon: Mic2,       label: "Assistant" },
  { to: "/history",    icon: History,    label: "History"   },
  { to: "/notes",      icon: StickyNote, label: "Notes"     },
];
const NAV_ADMIN = { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" };
const NAV_BOTTOM = [
  { to: "/subscription", icon: CreditCard, label: "Plans"    },
  { to: "/profile",      icon: Settings,   label: "Settings" },
];
const MOBILE_NAV_BASE = [
  { to: "/assistant",    icon: Mic2,       label: "Assistant" },
  { to: "/history",      icon: History,    label: "History"   },
  { to: "/notes",        icon: StickyNote, label: "Notes"     },
  { to: "/subscription", icon: CreditCard, label: "Plans"     },
  { to: "/profile",      icon: Settings,   label: "Me"        },
];

const MIC_SVG = (
  <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
    <rect x="4.5" y="1" width="3" height="6" rx="1.5" fill="white"/>
    <path d="M2 6.5C2 8.98 3.79 11 6 11s4-2.02 4-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6" y1="11" x2="6" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function NavItem({ to, icon: Icon, label, collapsed, onClick, badgeCount = 0 }) {
  return (
    <NavLink to={to} end={to === "/"} onClick={onClick}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 select-none${isActive ? "" : " hover:bg-[var(--surface-h)]"}`
      }>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div layoutId="nav-pill"
              className="absolute inset-0 rounded-lg"
              style={{
                background: "var(--accent-2)",
                boxShadow: "inset 2.5px 0 0 var(--accent)",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            />
          )}
          <div className="relative shrink-0">
            <Icon
              className="relative h-4 w-4 transition-colors"
              style={{ color: isActive ? "var(--accent-fg)" : "var(--fg-3)" }}
            />

            {badgeCount > 0 && collapsed && (
              <span
                className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold grid place-items-center"
                style={{
                  background: "var(--accent-fg)",
                  color: "#fff",
                }}
              >
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </div>

          <AnimatePresence>
            <span
              className="relative whitespace-nowrap flex-1"
              style={{
                color: isActive ? "var(--fg)" : "var(--fg-3)",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {label}
            </span>

            {badgeCount > 0 && !collapsed && (
              <span
                className="relative ml-auto min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center"
                style={{
                  background: "var(--accent-fg)",
                  color: "#fff",
                }}
              >
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </AnimatePresence>
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { user, logout }    = useAuth();
  const { theme, toggle }   = useTheme();
  const { connStatus } = useAssistant();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [assistantItemCount, setAssistantItemCount] = useState(0);

  useEffect(() => {
    const refreshAssistantCount = () => {
      const count = loadAssistantItems(user?.id || user?.email || "guest").filter((item) => {
        return (
          (item.type === "reminder" || item.type === "alarm") &&
          isItemDue(item)
        );
      }).length;

      setAssistantItemCount(count);
    };

    refreshAssistantCount();

    const timer = setInterval(refreshAssistantCount, 5000);

    window.addEventListener("storage", refreshAssistantCount);
    window.addEventListener("voiceai-items-updated", refreshAssistantCount);

    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", refreshAssistantCount);
      window.removeEventListener("voiceai-items-updated", refreshAssistantCount);
    };
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const credits     = user?.credits ?? 0;
  const plan        = user?.plan    ?? "free";
  const isUnlimited = plan === "unlimited";
  const isConnected    = connStatus === "Connected";
  const isReconnecting = connStatus === "Reconnecting";
  const initials    = user?.username?.[0]?.toUpperCase() ?? "?";
  const handleLogout = () => { logout(); navigate("/login"); };

  const PLAN_COLORS = { free: "var(--fg-4)", pro: "#10b981", business: "#f59e0b", unlimited: "#a78bfa" };
  const planColor = PLAN_COLORS[plan] ?? "var(--fg-4)";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <motion.aside
        animate={{ width: collapsed ? 56 : 224 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="hidden lg:flex flex-col shrink-0 h-full border-r overflow-hidden"
        style={{ borderColor: "var(--border-s)", background: "var(--bg-subtle)" }}>
        <div className="flex items-center gap-2.5 px-3 py-4 border-b"
          style={{ borderColor: "var(--border-s)" }}>
          <div className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-grad)" }}>
            {MIC_SVG}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: "var(--fg)" }}>
                  VoiceAI
                </span>
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  title={connStatus}
                  style={{
                    background: isConnected ? "var(--green)" : isReconnecting ? "#fbbf24" : "var(--rose)",
                    animation: isConnected ? "pulse-dot 2.4s ease-in-out infinite" : isReconnecting ? "pulse-dot 0.9s ease-in-out infinite" : "none",
                  }}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {user?.is_admin && <NavItem {...NAV_ADMIN} collapsed={collapsed} />}
          {NAV.map(n => ( <NavItem key={n.to} {...n} collapsed={collapsed} badgeCount={n.to === "/assistant" ? assistantItemCount : 0} /> ))}
          <div className="my-2 border-t" style={{ borderColor: "var(--border-s)" }} />
          {NAV_BOTTOM.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          {user?.is_admin && (
            <NavItem to="/admin" icon={ShieldCheck} label="Admin" collapsed={collapsed} />
          )}
        </nav>

        <AnimatePresence>
          {!collapsed && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => navigate("/subscription")}
              className="mx-2 mb-2 rounded-xl px-3 py-2.5 text-left border transition-colors hover:bg-[var(--surface-h)]"
              style={{ background: "var(--surface)", borderColor: "var(--border-s)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest capitalize"
                  style={{ color: planColor }}>
                  {plan}
                </span>
                <Zap className="h-3 w-3" style={{ color: planColor }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                {isUnlimited ? "∞" : credits}{" "}
                <span className="text-xs font-normal" style={{ color: "var(--fg-3)" }}>tokens</span>
              </p>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="p-2 border-t space-y-0.5" style={{ borderColor: "var(--border-s)" }}>
          <button onClick={toggle}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--surface-h)]"
            style={{ color: "var(--fg-3)" }}>
            {theme === "dark"
              ? <Sun className="h-4 w-4 shrink-0 text-amber-400" />
              : <Moon className="h-4 w-4 shrink-0 text-indigo-400" />}
            <AnimatePresence>
              {!collapsed && (
                <span className="text-sm whitespace-nowrap overflow-hidden">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              )}
            </AnimatePresence>
          </button>

          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--rose-2)] group"
            style={{ color: "var(--fg-3)" }}>
            <LogOut className="h-4 w-4 shrink-0 group-hover:text-[var(--rose)] transition-colors" />
            <AnimatePresence>
              {!collapsed && (
                <span className="text-sm whitespace-nowrap overflow-hidden group-hover:text-[var(--rose)] transition-colors">
                  Sign out
                </span>
              )}
            </AnimatePresence>
          </button>

          <button onClick={() => setCollapsed(v => !v)}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--surface-h)]"
            style={{ color: "var(--fg-4)" }}>
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronLeft className="h-4 w-4 shrink-0" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <span className="text-sm whitespace-nowrap overflow-hidden">
                  Collapse
                </span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>
      <div className="lg:hidden fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 border-b"
        style={{
          height: "var(--topbar-h)",
          background: theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(7,8,15,0.92)",
          borderColor: "var(--border-s)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-grad)" }}>
            {MIC_SVG}
          </div>
          <span className="text-sm font-bold tracking-tight" style={{ color: "var(--fg)" }}>VoiceAI</span>
          <span className="h-1.5 w-1.5 rounded-full shrink-0"
            title={connStatus}
            style={{ background: isConnected ? "var(--green)" : isReconnecting ? "#fbbf24" : "var(--rose)" }} />
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
            style={{ background: "var(--accent-2)", color: "var(--accent-fg)", border: "1px solid rgba(139,92,246,0.18)" }}>
            <Zap className="h-3 w-3" />
            {isUnlimited ? "∞" : credits}
          </span>
          <button onClick={() => setMobileOpen(v => !v)}
            className="h-8 w-8 grid place-items-center rounded-lg transition-colors hover:bg-[var(--surface-h)]"
            style={{ color: "var(--fg-2)" }}>
            <AnimatePresence mode="wait">
              {mobileOpen
                ? <motion.div key="x" initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.12 }}><X className="h-4 w-4" /></motion.div>
                : <motion.div key="m" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }} transition={{ duration: 0.12 }}><Menu className="h-4 w-4" /></motion.div>}
            </AnimatePresence>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[55]" style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="lg:hidden fixed left-0 bottom-0 z-[60] w-[min(256px,80vw)] flex flex-col border-r overflow-y-auto"
              style={{
                top: "var(--topbar-h)",
                background: "var(--bg-subtle)",
                borderColor: "var(--border-s)",
                paddingBottom: "calc(var(--bottomnav-h) + env(safe-area-inset-bottom, 0px) + 12px)",
              }}>
              {/* User info */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "var(--border-s)" }}>
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="avatar"
                      className="h-10 w-10 rounded-xl object-cover shrink-0"
                      style={{ border: "1px solid var(--border)" }} />
                  : <div className="grid h-10 w-10 place-items-center rounded-xl text-sm font-bold text-white shrink-0"
                      style={{ background: "var(--accent-grad)" }}>{initials}</div>}
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--fg)" }}>{user?.username}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider capitalize"
                      style={{ color: planColor }}>
                      {plan}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--fg-4)" }}>·</span>
                    <span className="text-xs" style={{ color: "var(--fg-3)" }}>
                      {isUnlimited ? "∞" : credits} tokens
                    </span>
                  </div>
                </div>
              </div>

              <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {[
                  ...(user?.is_admin ? [NAV_ADMIN] : []),
                  ...NAV,
                  ...NAV_BOTTOM,
                  ...(user?.is_admin ? [{ to: "/admin", icon: ShieldCheck, label: "Admin" }] : []),
                ].map(n => (
                  <NavItem key={n.to} {...n} collapsed={false} onClick={() => setMobileOpen(false)} badgeCount={n.to === "/assistant" ? assistantItemCount : 0} />
                ))}
              </nav>

              <div className="p-2 border-t space-y-0.5" style={{ borderColor: "var(--border-s)" }}>
                <button onClick={toggle}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--surface-h)]"
                  style={{ color: "var(--fg-3)" }}>
                  {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--rose-2)]"
                  style={{ color: "var(--rose)" }}>
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <main className={`flex-1 min-w-0 pt-[var(--topbar-h)] ${ location.pathname === "/assistant" ? "pb-[var(--bottomnav-h)]" : "pb-[calc(var(--bottomnav-h)+env(safe-area-inset-bottom,0px)+32px)]" } lg:pt-0 lg:pb-0 relative ${ location.pathname === "/assistant" ? "overflow-hidden" : "overflow-y-auto" }`} >
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={location.pathname === "/assistant" ? "h-full" : "min-h-full"}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 flex border-t"
        style={{
          height: "var(--bottomnav-h)",
          background: theme === "light" ? "rgba(255,255,255,0.94)" : "rgba(7,8,15,0.94)",
          borderColor: "var(--border-s)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
        {MOBILE_NAV_BASE.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === "/"}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium relative">
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div layoutId="bottom-pill"
                    className="absolute top-0 inset-x-4 h-px rounded-full"
                    style={{ background: "var(--accent-fg)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <div className="relative">
                  <Icon
                    className="h-5 w-5 transition-colors"
                    style={{ color: isActive ? "var(--accent-fg)" : "var(--fg-4)" }}
                  />

                  {to === "/assistant" && assistantItemCount > 0 && (
                    <span
                      className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold grid place-items-center"
                      style={{
                        background: "var(--accent-fg)",
                        color: "#fff",
                      }}
                    >
                      {assistantItemCount > 9 ? "9+" : assistantItemCount}
                    </span>
                  )}
                </div>
                <span className="transition-colors" style={{ color: isActive ? "var(--accent-fg)" : "var(--fg-4)" }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <ActionScreen />
      <MediaOverlay />
      <CenterSearchResults />

    </div>
  );
}
