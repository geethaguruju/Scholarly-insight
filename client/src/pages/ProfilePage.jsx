import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context";
import { useToast } from "../context";
import {
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  firebaseConfigured,
} from "../firebase";
import { updateProfile } from "firebase/auth";
import { auth } from "../firebase";

function getInitials(user) {
  if (!user) return "?";
  if (user.displayName) {
    return user.displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  }
  return (user.email || "?")[0].toUpperCase();
}

export default function ProfilePage() {
  const { user, dashboard } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    if (!form.email || !form.password) { addToast("Please fill in all fields.", "info"); return; }
    setBusy(true);
    try {
      if (authMode === "signin") {
        await signInWithEmail(form.email, form.password);
        addToast("Welcome back!", "success");
        navigate("/dashboard");
      } else {
        await registerWithEmail(form);
        addToast("Account created! Welcome to Scholarly Insight.", "success");
        navigate("/dashboard");
      }
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setBusy(true);
    try {
      await signInWithGoogle();
      addToast("Signed in with Google!", "success");
      navigate("/dashboard");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOutUser();
      addToast("Signed out.", "info");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handleUpdateName(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await updateProfile(auth.currentUser, { displayName: newName.trim() });
      addToast("Display name updated!", "success");
      setEditingName(false);
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  /* ── SIGNED IN VIEW ─────────────────────────────────── */
  if (user) {
    const favCount = dashboard?.favorites?.length ?? 0;
    const histCount = dashboard?.history?.length ?? 0;
    const alertCount = dashboard?.alerts?.length ?? 0;

    const provider = user.providerData?.[0]?.providerId || "password";
    const providerLabel = provider === "google.com" ? "Google" : "Email / Password";

    return (
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <span className="eyebrow">Account</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", marginTop: "0.25rem", marginBottom: "2rem" }}>
          Your Profile
        </h1>

        {/* Profile header */}
        <div className="profile-header">
          <div className="profile-avatar-lg">{getInitials(user)}</div>
          <div>
            <div className="profile-name">
              {user.displayName || user.email?.split("@")[0] || "Researcher"}
            </div>
            <div className="profile-email">{user.email}</div>
            <span className="badge badge-indigo" style={{ marginTop: "0.4rem" }}>
              {providerLabel}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="meta-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="meta-item" style={{ textAlign: "center" }}>
            <span className="meta-item-label">Saved Papers</span>
            <span className="meta-item-value" style={{ fontSize: "1.5rem" }}>{favCount}</span>
          </div>
          <div className="meta-item" style={{ textAlign: "center" }}>
            <span className="meta-item-label">Papers Read</span>
            <span className="meta-item-value" style={{ fontSize: "1.5rem" }}>{histCount}</span>
          </div>
          <div className="meta-item" style={{ textAlign: "center" }}>
            <span className="meta-item-label">Active Alerts</span>
            <span className="meta-item-value" style={{ fontSize: "1.5rem" }}>{alertCount}</span>
          </div>
        </div>

        {/* Edit display name */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Display Name</h3>
          {editingName ? (
            <form onSubmit={handleUpdateName} style={{ display: "flex", gap: "0.75rem" }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Enter display name"
                autoFocus
              />
              <button className="btn btn-primary btn-sm" type="submit">Save</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditingName(false)}>Cancel</button>
            </form>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--text-secondary)" }}>
                {user.displayName || <em style={{ color: "var(--text-muted)" }}>Not set</em>}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setNewName(user.displayName || ""); setEditingName(true); }}
                type="button"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Quick Actions</h3>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/dashboard")}
              type="button"
            >
              📊 Go to Dashboard
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate("/")}
              type="button"
            >
              🔍 Search Papers
            </button>
          </div>
        </div>

        {/* Sign out */}
        <div className="card" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Danger Zone</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
            Sign out of your account on this device.
          </p>
          <button className="btn btn-danger" onClick={handleSignOut} type="button">
            ↩ Sign Out
          </button>
        </div>
      </div>
    );
  }

  /* ── SIGN IN / REGISTER VIEW ────────────────────────── */
  return (
    <div className="auth-container">
      <div className="auth-card">
        <span className="eyebrow">Welcome</span>
        <h1>{authMode === "signin" ? "Sign in" : "Create account"}</h1>
        <p>
          {authMode === "signin"
            ? "Access your saved papers, alerts, and discussions."
            : "Join Scholarly Insight to save papers and join discussions."}
        </p>

        {!firebaseConfigured ? (
          <div style={{
            padding: "1rem",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: "var(--radius-md)",
            color: "var(--accent-warm)",
            fontSize: "0.875rem",
          }}>
            ⚠ Firebase is not configured. Please set up the environment variables.
          </div>
        ) : (
          <>
            <form className="auth-form" onSubmit={handleEmailAuth}>
              {authMode === "signup" && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-name">Full Name</label>
                  <input
                    id="auth-name"
                    type="text"
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={e => setField("name", e.target.value)}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setField("email", e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setField("password", e.target.value)}
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                />
              </div>
              <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ width: "100%" }}>
                {busy ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="auth-divider">or</div>

            <button
              className="btn btn-secondary btn-lg"
              onClick={handleGoogleAuth}
              disabled={busy}
              style={{ width: "100%" }}
              type="button"
            >
              <span>G</span>
              Continue with Google
            </button>

            <div className="auth-switch">
              {authMode === "signin" ? (
                <>Don't have an account?{" "}
                  <a onClick={() => setAuthMode("signup")}>Create one</a></>
              ) : (
                <>Already have an account?{" "}
                  <a onClick={() => setAuthMode("signin")}>Sign in</a></>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
