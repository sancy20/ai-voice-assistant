import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider }         from "./context/ThemeContext";
import { AssistantProvider }     from "./context/AssistantContext";
import { ToastProvider }         from "./context/ToastContext";
import ProtectedRoute            from "./components/ProtectedRoute";
import Layout                    from "./components/Layout";

const Landing        = lazy(() => import("./pages/Landing"));
const Auth           = lazy(() => import("./pages/Auth"));
const Dashboard      = lazy(() => import("./pages/Dashboard"));
const Assistant      = lazy(() => import("./pages/Assistant"));
const History        = lazy(() => import("./pages/History"));
const Notes          = lazy(() => import("./pages/Notes"));
const Subscription   = lazy(() => import("./pages/Subscription"));
const Profile        = lazy(() => import("./pages/Profile"));
const Payment        = lazy(() => import("./pages/Payment"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="h-7 w-7 rounded-full border-2 border-white/15 border-t-white/70 animate-spin" />
    </div>
  );
}

function ProtectedLayout({ children, adminOnly = false }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) {
    if (user.is_admin) return <ProtectedLayout><Dashboard /></ProtectedLayout>;
    return <Navigate to="/assistant" replace />;
  }
  return <Landing />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AssistantProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/"                 element={<HomeRoute />} />
                  <Route path="/login"            element={<Auth mode="login" />} />
                  <Route path="/register"         element={<Auth mode="register" />} />
                  <Route path="/forgot-password"  element={<ForgotPassword />} />
                  <Route path="/reset-password"   element={<ResetPassword />} />

                  <Route path="/dashboard"    element={<ProtectedLayout adminOnly><Dashboard /></ProtectedLayout>} />
                  <Route path="/assistant"    element={<ProtectedLayout><Assistant /></ProtectedLayout>} />
                  <Route path="/history"      element={<ProtectedLayout><History /></ProtectedLayout>} />
                  <Route path="/notes"        element={<ProtectedLayout><Notes /></ProtectedLayout>} />
                  <Route path="/subscription" element={<ProtectedLayout><Subscription /></ProtectedLayout>} />
                  <Route path="/payment"      element={<ProtectedLayout><Payment /></ProtectedLayout>} />
                  <Route path="/profile"      element={<ProtectedLayout><Profile /></ProtectedLayout>} />
                  <Route path="/admin"        element={<ProtectedLayout adminOnly><AdminDashboard /></ProtectedLayout>} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AssistantProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
