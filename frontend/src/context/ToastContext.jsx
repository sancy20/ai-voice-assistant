import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastCtx = createContext(null);

const STYLES = {
  success: { bg:"rgba(16,185,129,0.1)",  border:"rgba(16,185,129,0.22)", icon:"#34d399", text:"#a7f3d0", Icon: CheckCircle2 },
  error:   { bg:"rgba(239,68,68,0.1)",   border:"rgba(239,68,68,0.22)",  icon:"#f87171", text:"#fca5a5", Icon: XCircle      },
  warning: { bg:"rgba(245,158,11,0.1)",  border:"rgba(245,158,11,0.22)", icon:"#fbbf24", text:"#fde68a", Icon: AlertTriangle },
  info:    { bg:"rgba(99,102,241,0.1)",  border:"rgba(99,102,241,0.22)", icon:"#818cf8", text:"#c7d2fe", Icon: Info          },
};

function ToastItem({ id, type = "info", title, message, onRemove }) {
  const s = STYLES[type] ?? STYLES.info;
  const { Icon } = s;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 32, scale: 0.96 }}
      animate={{ opacity: 1, x: 0,  scale: 1    }}
      exit={{    opacity: 0, x: 32, scale: 0.94, transition: { duration: 0.14 } }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="w-72 rounded-xl border shadow-2xl overflow-hidden"
      style={{ background: s.bg, borderColor: s.border, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
      <div className="flex items-start gap-3 px-3.5 py-3">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: s.icon }} />
        <div className="flex-1 min-w-0">
          {title   && <p className="text-xs font-semibold leading-snug" style={{ color: s.text }}>{title}</p>}
          {message && <p className="text-xs mt-0.5 leading-relaxed" style={{ color: s.text, opacity: 0.78 }}>{message}</p>}
        </div>
        <button onClick={() => onRemove(id)}
          className="shrink-0 transition-opacity hover:opacity-100 opacity-50"
          style={{ color: s.text }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const add = useCallback((type, title, message, duration = 4500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(t => [...t.slice(-5), { id, type, title, message }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const toast = {
    success: (title, msg, d) => add("success", title, msg, d),
    error:   (title, msg, d) => add("error",   title, msg, d),
    warning: (title, msg, d) => add("warning", title, msg, d),
    info:    (title, msg, d) => add("info",    title, msg, d),
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[300] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: "288px", width: "100%" }}>
        <AnimatePresence mode="sync">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem {...t} onRemove={remove} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
