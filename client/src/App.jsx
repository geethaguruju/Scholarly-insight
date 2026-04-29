import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { api } from "./api";
import { watchAuthState } from "./firebase";
import { upsertUserProfile, seedFirestoreIndexes, subscribeToDashboard, markNotificationsRead } from "./firestore";
import { useAuth } from "./context";
import { useToast } from "./context";
import NavBar from "./components/NavBar";
import NotificationDrawer from "./components/NotificationDrawer";
import HomePage from "./pages/HomePage";
import ArticlePage from "./pages/ArticlePage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  const { user, setUser, dashboard, setDashboard } = useAuth();
  const { addToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Watch Firebase auth state
  useEffect(() => {
    return watchAuthState(async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setDashboard(null);
        return;
      }

      try {
        const idToken = await nextUser.getIdToken();
        const verification = await api.verifyToken(idToken);
        
        if (verification.success) {
          setUser(nextUser);
          await upsertUserProfile(nextUser);
          await seedFirestoreIndexes(nextUser.uid);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Backend auth verification failed", err);
        setUser(null);
        addToast("Authentication failed: " + err.message, "error");
      }
    });
  }, []);

  // Subscribe to Firestore dashboard in real-time
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToDashboard(user.uid, setDashboard);
  }, [user?.uid]);

  const readAt = dashboard?.notificationsReadAt?.toDate?.() ?? new Date(0);
  const notifCount = (dashboard?.notifications || [])
    .filter(n => new Date(n.published || n.fetchedAt || 0) > readAt).length;

  function handleNotifClick() {
    setDrawerOpen(true);
    if (user?.uid) {
      markNotificationsRead(user.uid).catch(err => console.error(err));
    }
  }

  return (
    <div className="app-shell">
      <NavBar
        notifCount={notifCount}
        onNotifClick={handleNotifClick}
      />

      <main className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/article/:id" element={<ArticlePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* 404 fallback */}
          <Route path="*" element={
            <div className="empty-state" style={{ minHeight: "60vh" }}>
              <div className="empty-state-icon">🔭</div>
              <h3>Page not found</h3>
              <p>The page you're looking for doesn't exist.</p>
              <a href="/" className="btn btn-primary" style={{ marginTop: "1rem", textDecoration: "none" }}>
                Go Home
              </a>
            </div>
          } />
        </Routes>
      </main>

      {drawerOpen && (
        <NotificationDrawer onClose={() => setDrawerOpen(false)} />
      )}
    </div>
  );
}
