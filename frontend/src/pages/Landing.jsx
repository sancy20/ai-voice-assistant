import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Mic2, Search, Music, Bell, StickyNote, Globe,
  Zap, Check, Sparkles, Menu, X as XIcon, Sun, Moon,
  Play, BookOpen, Shield, Activity, Clock,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

function ParticleCanvas({ isDark }) {
  const ref   = useRef(null);
  const raf   = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = ref.current;
    const ctx    = canvas.getContext("2d");
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onMove = e => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    const N = 48;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
      r: Math.random() * 1.1 + 0.3, a: Math.random() * 0.15 + 0.04,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my } = mouse.current;
      const pc = isDark ? "167,139,250" : "124,58,237";
      const lc = isDark ? "139,92,246"  : "109,40,217";
      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        if (d < 110 && d > 0) { const f = ((110-d)/110)*0.07; p.vx += (dx/d)*f; p.vy += (dy/d)*f; }
        p.vx = p.vx*0.978+(Math.random()-0.5)*0.01;
        p.vy = p.vy*0.978+(Math.random()-0.5)*0.01;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W+10; if (p.x > W+10) p.x = -10;
        if (p.y < -10) p.y = H+10; if (p.y > H+10) p.y = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(${pc},${p.a * (isDark ? 1 : 0.6)})`; ctx.fill();
      }
      for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) {
        const dx = pts[i].x-pts[j].x, dy = pts[i].y-pts[j].y, d = Math.hypot(dx,dy);
        if (d < 80) { ctx.beginPath(); ctx.strokeStyle=`rgba(${lc},${0.04*(1-d/80)*(isDark?1:0.5)})`; ctx.lineWidth=0.5; ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
      }
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf.current); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, [isDark]);

  return <canvas ref={ref} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, opacity: isDark ? 0.55 : 0.4 }} />;
}

function DotGrid({ isDark }) {
  const cols = 26, rows = 22, gap = 18;
  const isFilled = (r, c) => {
    const cx = cols*0.44, cy = rows*0.38;
    const dx = c-cx, dy = r-cy, d = Math.hypot(dx, dy);
    if (Math.abs(dx) < 3.5 && r > cy-6 && r < cy+3.5) return "solid";
    if (r > cy+3 && r < cy+7 && Math.abs(d-5) < 1.0 && dy > 0) return "solid";
    if (r > cy+6 && r < cy+8 && Math.abs(dx) < 2) return "solid";
    if (Math.abs(d-8)  < 0.75 && c > cx-2) return "ring";
    if (Math.abs(d-12) < 0.75 && c > cx-4) return "ring";
    if (Math.abs(d-15) < 0.75 && c > cx-7) return "ring";
    return false;
  };
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = isFilled(r, c);
      const sparse = (r * 29 + c * 13) % 9 === 0;
      if (type || sparse) dots.push({ r, c, type: type || "dot" });
    }
  }
  const solidColor = isDark ? "#a78bfa" : "#8b5cf6";
  const ringColor  = isDark ? "#c4b5fd" : "#7c3aed";
  const dotColor   = isDark ? "rgba(167,139,250,0.22)" : "rgba(124,58,237,0.2)";
  const solidGlow  = isDark ? "0 0 6px rgba(167,139,250,0.45)" : "0 0 4px rgba(124,58,237,0.3)";
  const ringGlow   = isDark ? "0 0 5px rgba(196,181,253,0.35)" : "0 0 4px rgba(124,58,237,0.2)";
  return (
    <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none hidden lg:flex items-center justify-center overflow-hidden" style={{ zIndex: 1}}>
      <div style={{ position: "relative", width: cols*gap, height: rows*gap, flexShrink: 0, transform: "translate(120px, 70px)" }}>
        {dots.map(({ r, c, type }, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: (r*cols+c)*0.0008, ease: "easeOut" }}
            style={{
              position: "absolute", left: c*gap, top: r*gap,
              width:  type === "dot" ? 3 : 5,
              height: type === "dot" ? 3 : 5,
              borderRadius: "50%",
              background: type === "solid" ? solidColor : type === "ring" ? ringColor : dotColor,
              boxShadow:   type === "solid" ? solidGlow  : type === "ring" ? ringGlow  : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const MSGS = [
  { role: "user",      text: "play lofi beats",                        ms: 400  },
  { role: "assistant", text: "Opening YouTube — lofi hip hop radio 🎵", ms: 1600 },
  { role: "user",      text: "remind me to call mom at 5pm",           ms: 3000 },
  { role: "assistant", text: "Reminder set for 5:00 PM ✓",             ms: 4300 },
  { role: "user",      text: "search best coffee shops nearby",        ms: 5700 },
  { role: "assistant", text: "Here are the top results nearby.",       ms: 7000 },
];

const MIC_SVG = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="4.5" y="1" width="3" height="6" rx="1.5" fill="white"/>
    <path d="M2 6.5C2 8.98 3.79 11 6 11s4-2.02 4-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="6" y1="11" x2="6" y2="12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function DemoChat() {
  const [vis, setVis] = useState([]);
  const [cyc, setCyc] = useState(0);
  const bodyRef = useRef(null);
  useEffect(() => {
    const ts   = MSGS.map((m, i) => setTimeout(() => setVis(v => [...v, i]), m.ms));
    const loop = setTimeout(() => { setVis([]); setCyc(c => c+1); }, MSGS[MSGS.length-1].ms + 2000);
    return () => { ts.forEach(clearTimeout); clearTimeout(loop); };
  }, [cyc]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [vis.length]);
  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: "rgba(8,7,18,0.96)", border: "1px solid rgba(139,92,246,0.18)" }}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(5,5,12,0.7)" }}>
        <div className="flex gap-1.5">{["#ef4444","#f59e0b","#22c55e"].map(c => <div key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />)}</div>
        <span className="text-[11px] ml-2 select-none" style={{ color: "rgba(255,255,255,0.2)" }}>VoiceAI — Assistant</span>
      </div>
      <div ref={bodyRef} className="p-3 sm:p-4 h-[160px] sm:h-[200px] overflow-y-auto flex flex-col gap-2">
        <div className="flex-1" />
        <AnimatePresence>
          {MSGS.filter((_, i) => vis.includes(i)).map((m, idx) => (
            <motion.div key={`${cyc}-${idx}`}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%] px-3.5 py-2 text-xs leading-snug"
                style={{
                  background: m.role === "user" ? "linear-gradient(135deg,#8b5cf6,#6366f1)" : "rgba(255,255,255,0.07)",
                  color: m.role === "user" ? "#fff" : "rgba(255,255,255,0.6)",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                }}>
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {vis.length === 0 && <p className="text-[11px] text-center animate-pulse" style={{ color: "rgba(255,255,255,0.14)" }}>Starting demo…</p>}
      </div>
      <div className="px-4 py-2.5 border-t flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(5,5,12,0.7)" }}>
        <div className="flex-1 rounded-xl px-3 py-1.5 text-xs" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.2)" }}>Hold Space to speak…</div>
        <div className="h-7 w-7 rounded-xl grid place-items-center shrink-0" style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>{MIC_SVG}</div>
      </div>
    </div>
  );
}

const USE_CASES = [
  { icon: Search,     title: "Web search",      desc: "Get instant answers without typing a single character.", tag: "Search"  },
  { icon: Music,      title: "Media control",   desc: "Play, pause, skip — hands-free music and video control.", tag: "Media"   },
  { icon: Bell,       title: "Smart reminders", desc: "Set reminders and alarms with a natural sentence.",       tag: "Alarms"  },
  { icon: StickyNote, title: "Quick notes",     desc: "Capture ideas by voice — no app switching needed.",       tag: "Notes"   },
  { icon: Globe,      title: "Open any site",   desc: "Navigate the web by name, instantly.",                   tag: "Browse"  },
  { icon: Clock,      title: "Time & date",     desc: "Ask what time, day, or date it is at any moment.",        tag: "Utility" },
];

const PLANS = [
  { key:"free",     label:"Free",     price:"$0",     period:null,  tokens:"10 tokens / month",    desc:"Perfect for trying out VoiceAI.",    features: [ "10 AI tokens / 7 days", "Hold-to-speak voice assistant", "Basic voice commands", "Basic notes & reminders", "Limited history", ],                                          cta:"Get started free",  ctaTo:"/register" },
  { key:"pro",      label:"Pro",      price:"$9.99",  period:"/mo", tokens:"500 tokens / month",   desc:"For power users who talk a lot.",    features: [ "500 AI tokens / month", "Unlimited notes", "Unlimited reminders, tasks & alarms", "Full history access", "Search & media commands", "Priority processing", "Data export", ], popular:true, cta:"Start free trial",  ctaTo:"/register" },
  { key:"business", label:"Business", price:"$29.99", period:"/mo", tokens:"2,000 tokens / month", desc:"For teams and heavy workloads.",     features: [ "2,000 AI tokens / month", "Everything in Pro", "Admin dashboard", "User management", "Usage analytics", "Export reports", "API access", "Business priority support", ],                      cta:"Contact us",        ctaTo:"/register" },
];

const BLOG_POSTS = [
  { tag:"Product",  title:"Introducing wake-word mode for always-on listening",      excerpt:"Say 'Hey VoiceAI' to start a session without touching your keyboard.", date:"May 2025", readMin:3 },
  { tag:"Use Case", title:"How developers use VoiceAI to stay in flow state",        excerpt:"Search docs, open GitHub, and take notes — all without breaking concentration.", date:"Apr 2025", readMin:5 },
  { tag:"Tips",     title:"10 voice commands you didn't know you could use",          excerpt:"From scrolling the page to setting multi-step reminders, voice can do more than you think.", date:"Mar 2025", readMin:4 },
];

const STATS = [
  { value:"6+",   label:"Voice actions", icon:Zap      },
  { value:"< 1s", label:"Response time", icon:Activity  },
  { value:"100%", label:"Hands-free",    icon:Shield    },
];

const NAV_LINKS = [
  { label:"Product",   href:"#product"   },
  { label:"Use Cases", href:"#use-cases" },
  { label:"Pricing",   href:"#pricing"   },
  { label:"Blog",      href:"#blog"      },
];

export default function Landing() {
  const { theme, toggle } = useTheme();
  const isDark = theme !== "light";

  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const scrollTo = (href) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const bg          = isDark ? "#07080f"                   : "#ffffff";
  const fg          = isDark ? "#eef0ff"                   : "#0d0e17";
  const fgDim       = isDark ? "rgba(238,240,255,0.36)"    : "rgba(13,14,23,0.45)";
  const fgFaint     = isDark ? "rgba(238,240,255,0.2)"     : "rgba(13,14,23,0.22)";
  const navBgS      = isDark ? "rgba(7,8,15,0.95)"         : "rgba(255,255,255,0.95)";
  const navBgT      = isDark ? "rgba(7,8,15,0.25)"         : "rgba(255,255,255,0.25)";
  const navBorder   = isDark ? "rgba(255,255,255,0.07)"    : "rgba(0,0,0,0.08)";
  const navLink     = isDark ? "rgba(238,240,255,0.5)"     : "rgba(13,14,23,0.5)";
  const navSignin   = isDark ? "rgba(238,240,255,0.38)"    : "rgba(13,14,23,0.38)";
  const divider     = isDark ? "rgba(255,255,255,0.06)"    : "rgba(0,0,0,0.08)";
  const cardBg      = isDark ? "rgba(255,255,255,0.025)"   : "rgba(0,0,0,0.025)";
  const cardBorder  = isDark ? "rgba(255,255,255,0.06)"    : "rgba(0,0,0,0.08)";
  const cardHoverBg = isDark ? "rgba(139,92,246,0.08)"     : "rgba(139,92,246,0.05)";
  const cardHoverBd = isDark ? "rgba(139,92,246,0.24)"     : "rgba(139,92,246,0.2)";
  const kbdStyle    = isDark
    ? { bg:"rgba(255,255,255,0.07)", border:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.55)" }
    : { bg:"rgba(0,0,0,0.06)",       border:"rgba(0,0,0,0.1)",        color:"rgba(0,0,0,0.5)"       };
  const tagStyle    = { bg: isDark ? "rgba(139,92,246,0.1)"  : "rgba(139,92,246,0.07)",
                        color: isDark ? "rgba(167,139,250,0.75)" : "#7c3aed"             };
  const badgeStyle  = { bg: isDark ? "rgba(139,92,246,0.18)" : "rgba(139,92,246,0.1)",
                        color: isDark ? "#a78bfa" : "#7c3aed",
                        border: isDark ? "rgba(139,92,246,0.28)" : "rgba(139,92,246,0.2)" };
  const grad = isDark
    ? { backgroundImage:"linear-gradient(135deg,#c4b5fd 0%,#a78bfa 50%,#818cf8 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }
    : { backgroundImage:"linear-gradient(135deg,#8b5cf6 0%,#6366f1 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" };

  const sectionTitle = { fontSize:"clamp(1.5rem,4vw,2.8rem)", fontWeight:800, letterSpacing:"-0.025em", color:fg, lineHeight:1.15 };
  const sectionLabel = { fontSize:"10px", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(167,139,250,0.65)" };
  const WRAP = "w-full max-w-[1920px] mx-auto px-5 sm:px-8 lg:px-14 xl:px-20 2xl:px-24";

  return (
    <div style={{ background: bg, color: fg, minHeight: "100vh", transition: "background 0.25s, color 0.25s", overflowX: "hidden" }}>
      <ParticleCanvas isDark={isDark} />

      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled || mobileOpen ? navBgS : navBgT,
          borderBottom: `1px solid ${scrolled || mobileOpen ? navBorder : "transparent"}`,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
        <div className={`flex items-center h-[60px] gap-6 ${WRAP}`}>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="h-7 w-7 rounded-lg grid place-items-center" style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)" }}>{MIC_SVG}</div>
            <span className="text-sm font-bold tracking-tight" style={{ color: fg }}>VoiceAI</span>
          </Link>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV_LINKS.map(l => (
              <button key={l.label} onClick={() => scrollTo(l.href)}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/5"
                style={{ color: navLink }}>
                {l.label}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto md:ml-0">
            <button onClick={toggle}
              className="h-9 w-9 grid place-items-center rounded-xl transition-colors hover:bg-black/5"
              style={{ color: navLink }}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className="hidden md:block px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/5" style={{ color: navSignin }}>Sign in</Link>
            <Link to="/register"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)", boxShadow:"0 4px 14px rgba(139,92,246,0.35)" }}>
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button className="md:hidden h-9 w-9 grid place-items-center rounded-xl" style={{ color: navLink }}
              onClick={() => setMobileOpen(o => !o)}>
              {mobileOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
              exit={{ opacity:0, height:0 }} transition={{ duration:0.2, ease:[0.16,1,0.3,1] }}
              className="md:hidden overflow-hidden border-t" style={{ borderColor: navBorder }}>
              <div className="px-5 py-4 flex flex-col gap-1">
                {NAV_LINKS.map(l => (
                  <button key={l.label} onClick={() => scrollTo(l.href)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium"
                    style={{ color: navLink }}>
                    {l.label}
                  </button>
                ))}
                <div className="h-px my-1" style={{ background: divider }} />
                <Link to="/login" onClick={() => setMobileOpen(false)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium" style={{ color: navSignin }}>Sign in</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-sm font-semibold text-white mt-1"
                  style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)" }}>
                  Get started <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ── */}
      <section id="product" className="relative z-10 overflow-x-hidden"
        style={{ paddingTop: "clamp(96px, 4vh, 150px)", paddingBottom: "clamp(24px, 3vh, 48px)" }}>
        <DotGrid isDark={isDark} />

        <div className={`relative ${WRAP}`}>
          <div className="max-w-4xl mx-auto lg:mx-0 text-center lg:text-left">

            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.4 }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4 sm:mb-5 text-xs font-semibold"
              style={{ border:`1px solid rgba(139,92,246,0.3)`, background:"rgba(139,92,246,0.08)", color:"#a78bfa" }}>
              <Zap className="h-3 w-3 shrink-0" /> AI-powered voice assistant
            </motion.div>

            <motion.h1 initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.58, delay:0.06, ease:[0.16,1,0.3,1] }}
              style={{ fontSize:"clamp(1.65rem,5.5vw,5.5rem)", fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.1, color:fg }}>
              Voice commands that{" "}<span style={grad}>just work.</span>
            </motion.h1>

            <motion.p initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.14, ease:[0.16,1,0.3,1] }}
              className="mt-5 sm:mt-6 text-sm sm:text-base lg:text-lg leading-relaxed max-w-4xl mx-auto lg:mx-0"
              style={{ color: fgDim, marginTop: "20px"}}>
              Search, play music, set reminders, take notes — without touching your keyboard.
            </motion.p>

            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, delay:0.2, ease:[0.16,1,0.3,1] }}
              className="mt-10 sm:mt-12 lg:mt-14 flex flex-col min-[480px]:flex-row flex-wrap items-center gap-3 sm:gap-4 justify-center lg:justify-start"
              style={{ marginTop: "20px", marginBottom: "30px" }}>
              <Link to="/register"
                className="w-full min-[480px]:w-auto inline-flex items-center justify-center gap-2 rounded-full px-4 sm:px-5 py-3 sm:py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)", boxShadow:"0 4px 20px rgba(139,92,246,0.4)" }}>
                Start for free <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={() => scrollTo("#use-cases")}
                className="w-full min-[480px]:w-auto inline-flex items-center justify-center gap-1.5 rounded-full px-5 sm:px-4 py-3 sm:py-3.5 text-sm font-medium transition-all"
                style={{ border:`1px solid ${cardBorder}`, background: cardBg, color: fgDim }}>
                <Play className="h-3.5 w-3.5" /> See it in action
              </button>
            </motion.div>

            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              transition={{ delay:0.38, duration:0.5 }}
              className="mt-10 sm:mt-12 grid grid-cols-3 gap-3 sm:gap-6 max-w-md mx-auto lg:mx-0">
              {STATS.map(({ value, label, icon: Icon }) => (
                <div key={label} className="flex flex-col sm:flex-row items-center sm:items-start gap-1.5 sm:gap-2.5">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl grid place-items-center shrink-0"
                    style={{ background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.18)" }}>
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color:"#a78bfa" }} />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-base sm:text-lg font-bold leading-none" style={grad}>{value}</p>
                    <p className="text-[10px] sm:text-[11px] mt-0.5" style={{ color: fgFaint }}>{label}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Demo window ── */}
      <section className="relative z-10 pb-12 sm:pb-16 overflow-x-hidden">
        <div className={WRAP}>
          <motion.div initial={{ opacity:0, y:20, scale:0.97 }} whileInView={{ opacity:1, y:0, scale:1 }}
            viewport={{ once:true }} transition={{ duration:0.55, ease:[0.16,1,0.3,1] }}
            className="rounded-2xl sm:rounded-3xl overflow-hidden border w-full mx-auto"
            style={{ borderColor:"rgba(139,92,246,0.14)", maxWidth:980,
              background: isDark ? "rgba(8,7,18,0.9)" : "rgba(10,8,22,0.92)",
              backdropFilter:"blur(24px)" }}>
            <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor:"rgba(255,255,255,0.05)", background:"rgba(5,5,12,0.6)" }}>
              <div className="flex gap-1.5">{["#ef4444","#f59e0b","#22c55e"].map(c => <div key={c} className="h-2.5 w-2.5 rounded-full" style={{ background:c }} />)}</div>
              <span className="text-[11px] ml-2 select-none" style={{ color:"rgba(255,255,255,0.2)" }}>VoiceAI — live demo</span>
            </div>
            <div className="p-5 sm:p-7">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color:"rgba(167,139,250,0.6)" }}>See it in action</p>
              <DemoChat />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className={WRAP}><div className="my-6" style={{ borderTop:`1px solid ${divider}` }} /></div>

      {/* ── Use Cases ── */}
      <section id="use-cases" className="relative z-10 py-12 sm:py-16 lg:py-20 overflow-x-hidden">
        <div className={WRAP}>
          <motion.div initial={{ opacity:0, y:12 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ duration:0.45 }}
            className="mb-5 sm:mb-7"
            style={{marginBottom: "15px"}}>
            <p className="mb-2.5" style={sectionLabel}>Use Cases</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <h2 style={sectionTitle}>Everything, <span style={grad}>hands-free.</span></h2>
              <p className="text-sm max-w-s" style={{ color: fgDim }}>From web searches to media control — all with one voice command.</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {USE_CASES.map(({ icon: Icon, title, desc, tag }, i) => (
              <motion.div key={title}
                initial={{ opacity:0, y:14 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true, margin:"-40px" }}
                transition={{ duration:0.38, ease:[0.16,1,0.3,1], delay:i*0.05 }}
                className="rounded-2xl p-6 min-h-[145px] transition-all duration-200 cursor-default"
                style={{ background: cardBg, border:`1px solid ${cardBorder}` }}
                onMouseEnter={e => { e.currentTarget.style.background = cardHoverBg; e.currentTarget.style.borderColor = cardHoverBd; }}
                onMouseLeave={e => { e.currentTarget.style.background = cardBg;      e.currentTarget.style.borderColor = cardBorder; }}>
                <div className="flex items-start justify-between mb-3.5">
                  <div className="h-10 w-10 rounded-xl grid place-items-center"
                    style={{ background:"rgba(139,92,246,0.1)", border:"1px solid rgba(139,92,246,0.2)" }}>
                    <Icon className="h-[18px] w-[18px]" style={{ color:"#a78bfa" }} />
                  </div>
                  <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                    style={{ background: tagStyle.bg, color: tagStyle.color }}>{tag}</span>
                </div>
                <p className="text-sm font-semibold mb-1" style={{ color: fg }}>{title}</p>
                <p className="text-[13px] leading-relaxed" style={{ color: fgDim }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className={WRAP}><div className="my-2" style={{ borderTop:`1px solid ${divider}` }} /></div>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-12 sm:py-16 lg:py-20 overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <div style={{ width:900, height:600, borderRadius:"50%", background:`radial-gradient(ellipse, ${isDark ? "rgba(139,92,246,0.04)" : "rgba(139,92,246,0.03)"} 0%, transparent 65%)` }} />
        </div>
        <div className={`relative ${WRAP}`}>
          <motion.div initial={{ opacity:0, y:12 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ duration:0.45 }}
            className="mb-5 sm:mb-7"
            style={{marginBottom: "15px"}}>
            <p className="mb-2.5" style={sectionLabel}>Pricing</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <h2 style={sectionTitle}>Simple, transparent <span style={grad}>pricing.</span></h2>
              <p className="text-sm max-w-s" style={{ color: fgDim }}>Start free. Upgrade when you're ready. No hidden fees.</p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {PLANS.map((plan, i) => (
              <motion.div key={plan.key}
                initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true, margin:"-40px" }}
                transition={{ duration:0.42, ease:[0.16,1,0.3,1], delay:i*0.07 }}
                className="relative rounded-2xl p-7 min-h-[330px] flex flex-col overflow-hidden"
                style={{
                  background: plan.popular
                    ? isDark ? "linear-gradient(160deg, rgba(139,92,246,0.13) 0%, rgba(99,102,241,0.07) 100%)" : "rgba(139,92,246,0.05)"
                    : cardBg,
                  border: plan.popular ? "1px solid rgba(139,92,246,0.28)" : `1px solid ${cardBorder}`,
                  boxShadow: plan.popular ? `0 0 40px rgba(139,92,246,${isDark?0.1:0.06}) inset` : "none",
                }}>
                {plan.popular && <div className="absolute top-0 left-0 right-0 h-px" style={{ background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.7),transparent)" }} />}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: fg }}>{plan.label}</p>
                    {plan.popular && <Sparkles className="h-3.5 w-3.5" style={{ color:"#a78bfa" }} />}
                  </div>
                  {plan.popular && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background:badgeStyle.bg, color:badgeStyle.color, border:`1px solid ${badgeStyle.border}` }}>
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-xs mb-5" style={{ color: fgDim }}>{plan.desc}</p>
                <div className="mb-5">
                  <span style={{ fontSize:"2.3rem", fontWeight:800, letterSpacing:"-0.04em", color:fg }}>{plan.price}</span>
                  {plan.period && <span className="text-sm ml-1" style={{ color: fgDim }}>{plan.period}</span>}
                  <p className="text-xs mt-1" style={{ color: fgFaint }}>{plan.tokens}</p>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-xs" style={{ color: fgDim }}>
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: plan.popular ? "#a78bfa" : "#10b981" }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={plan.ctaTo}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all hover:opacity-90"
                  style={plan.popular
                    ? { background:"linear-gradient(135deg,#8b5cf6,#6366f1)", color:"#fff", boxShadow:"0 4px 16px rgba(139,92,246,0.35)" }
                    : { background: cardBg, border:`1px solid ${cardBorder}`, color: isDark ? "rgba(238,240,255,0.65)" : "rgba(13,14,23,0.6)", marginTop:"30px",}}>
                  {plan.cta} {plan.popular && <ArrowRight className="h-3 w-3" />}
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.p initial={{ opacity:0 }} whileInView={{ opacity:1 }}
            viewport={{ once:true }} transition={{ delay:0.3 }}
            className="text-xs mt-7" style={{ color: fgFaint,marginTop: "10px"}}>
            Need more? Token top-up packs from $0.99 — pay only for what you use.
          </motion.p>
        </div>
      </section>

      <div className={WRAP}><div className="my-2" style={{ borderTop:`1px solid ${divider}` }} /></div>

      {/* ── Blog ── */}
      <section id="blog" className="relative z-10 py-12 sm:py-16 lg:py-20 overflow-x-hidden">
        <div className={WRAP}>
          <motion.div initial={{ opacity:0, y:12 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ duration:0.45 }}
            className="mb-5 sm:mb-7"
            style={{marginBottom: "15px"}}>
            <p className="mb-2.5" style={sectionLabel}>Blog</p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <h2 style={sectionTitle}>Latest from <span style={grad}>VoiceAI.</span></h2>
              <Link to="/register" className="text-sm font-medium flex items-center gap-1.5 self-start sm:self-auto"
                style={{ color:"#a78bfa" }}>
                View all posts <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {BLOG_POSTS.map((post, i) => (
              <motion.article key={post.title}
                initial={{ opacity:0, y:14 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true, margin:"-40px" }}
                transition={{ duration:0.38, ease:[0.16,1,0.3,1], delay:i*0.06 }}
                className="group rounded-2xl p-6 min-h-[165px] cursor-pointer transition-all duration-200"
                style={{ background: cardBg, border:`1px solid ${cardBorder}` }}
                onMouseEnter={e => { e.currentTarget.style.background = cardHoverBg; e.currentTarget.style.borderColor = cardHoverBd; }}
                onMouseLeave={e => { e.currentTarget.style.background = cardBg;      e.currentTarget.style.borderColor = cardBorder; }}>
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                    style={{ background: tagStyle.bg, color: tagStyle.color }}>{post.tag}</span>
                  <span className="text-[11px]" style={{ color: fgFaint }}>{post.date}</span>
                </div>
                <h3 className="text-sm font-semibold mb-2 leading-snug transition-colors"
                  style={{ color: fg }}>{post.title}</h3>
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: fgDim }}>{post.excerpt}</p>
                <div className="flex items-center gap-1.5 text-xs" style={{ color:"rgba(167,139,250,0.65)" }}>
                  <BookOpen className="h-3 w-3" /> {post.readMin} min read
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <div className={WRAP}><div className="my-2" style={{ borderTop:`1px solid ${divider}` }} /></div>

      {/* ── Final CTA ── */}
      <section className="relative z-10 py-20 sm:py-24 lg:py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div style={{ width:520, height:420, maxWidth:"100%", borderRadius:"50%", background:`radial-gradient(ellipse, ${isDark?"rgba(139,92,246,0.08)":"rgba(139,92,246,0.05)"} 0%, transparent 70%)` }} />
        </div>
        <div className={`relative z-10 ${WRAP}`}>
          <motion.div initial={{ opacity:0, y:16 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ duration:0.5 }}
            className="max-w-2xl">
            <p className="mb-5" style={sectionLabel}>Get started today</p>
            <h2 style={{ fontSize:"clamp(2rem,5vw,3.8rem)", fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.08, marginBottom:"1rem", color:fg }}>
              Start talking to<br /><span style={grad}>your computer.</span>
            </h2>
            <p className="mb-7 text-sm" style={{ color: fgDim }}>Free to start. No credit card required.</p>
            <div className="flex flex-col min-[480px]:flex-row flex-wrap items-center gap-2.5 sm:gap-3" style={{marginTop: "15px"}}>
              <Link to="/register"
                className="w-full min-[480px]:w-auto inline-flex items-center justify-center gap-2 rounded-full px-7 sm:px-5 py-2 sm:py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)", boxShadow:"0 4px 28px rgba(139,92,246,0.4)" }}>
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login"
                className="w-full min-[480px]:w-auto inline-flex items-center justify-center gap-1.5 rounded-full px-6 py-2 sm:py-3.5 text-sm font-medium transition-all"
                style={{ border:`1px solid ${cardBorder}`, background: cardBg, color: fgDim }}>
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <div style={{ borderTop:`1px solid ${divider}` }}>
        <div className={`${WRAP} py-6 sm:py-8`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-5">

            {/* Logo + copyright row on mobile */}
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-6 w-6 rounded-md grid place-items-center shrink-0" style={{ background:"linear-gradient(135deg,#8b5cf6,#6366f1)" }}>{MIC_SVG}</div>
                <span className="text-sm font-semibold" style={{ color: fgDim }}>VoiceAI</span>
              </div>
              <span className="text-xs sm:hidden" style={{ color: fgFaint }}>© {new Date().getFullYear()}</span>
            </div>

            {/* Nav links — hidden on mobile, visible sm+ */}
            <div className="hidden sm:flex flex-wrap items-center gap-x-5 gap-y-2">
              {NAV_LINKS.map(l => (
                <button key={l.label} onClick={() => scrollTo(l.href)} className="text-xs transition-colors hover:opacity-60" style={{ color: fgFaint }}>{l.label}</button>
              ))}
              <Link to="/login"    className="text-xs transition-colors hover:opacity-60" style={{ color: fgFaint }}>Sign in</Link>
              <Link to="/register" className="text-xs transition-colors hover:opacity-60" style={{ color: fgFaint }}>Register</Link>
            </div>

            {/* Right side: theme + copyright */}
            <div className="flex items-center gap-4">
              <button onClick={toggle} className="text-xs flex items-center gap-1.5 transition-colors hover:opacity-60" style={{ color: fgFaint }}>
                {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                {isDark ? "Light mode" : "Dark mode"}
              </button>
              <span className="text-xs hidden sm:block" style={{ color: fgFaint }}>© {new Date().getFullYear()} VoiceAI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
