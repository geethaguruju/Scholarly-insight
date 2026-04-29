import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOutUser, firebaseConfigured } from "../firebase";
import { useAuth, useTheme, useToast } from "../context";

function getInitials(user) {
  if (!user) return "?";
  if (user.displayName) {
    return user.displayName
      .split(" ")
      .map(w => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (user.email || "?")[0].toUpperCase();
}

export default function NavBar({ notifCount = 0, onNotifClick }) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleSignOut() {
    try {
      await signOutUser();
      setDropdownOpen(false);
      navigate("/");
      addToast("Signed out successfully.", "info");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  return (
    <nav className="navbar">
      {/* Brand */}
      <NavLink to="/" className="navbar-brand">
        <span className="brand-icon">🔬</span>
        <span className="brand-name">Scholarly Insight</span>
      </NavLink>

      {/* Nav links */}
      <ul className="navbar-nav">
        <li>
          <NavLink to="/" end>
            Home
          </NavLink>
        </li>
        {user && (
          <li>
            <NavLink to="/dashboard">
              Dashboard
            </NavLink>
          </li>
        )}
      </ul>

      {/* Right actions */}
      <div className="navbar-actions">
        {/* Theme Toggle */}
        <button
          className="notif-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          type="button"
          style={{ marginRight: "0.5rem" }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        {/* Notification bell — only when signed in */}
        {user && (
          <button
            className="notif-btn"
            onClick={onNotifClick}
            title="Notifications"
            type="button"
          >
            🔔
            {notifCount > 0 && (
              <span className="notif-badge">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>
        )}

        {/* User menu */}
        {user ? (
          <div className="user-menu" ref={dropdownRef}>
            <button
              className="user-avatar-btn"
              onClick={() => setDropdownOpen(v => !v)}
              type="button"
            >
              <div className="user-avatar">{getInitials(user)}</div>
              <span>{user.displayName || user.email?.split("@")[0] || "User"}</span>
              <span style={{ fontSize: "0.7rem" }}>{dropdownOpen ? "▲" : "▼"}</span>
            </button>

            {dropdownOpen && (
              <div className="user-dropdown">
                <NavLink to="/profile" onClick={() => setDropdownOpen(false)}>
                  👤 Profile
                </NavLink>
                <NavLink to="/dashboard" onClick={() => setDropdownOpen(false)}>
                  📊 Dashboard
                </NavLink>
                <div className="divider" />
                <button className="signout-btn" onClick={handleSignOut}>
                  ↩ Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          firebaseConfigured && (
            <NavLink to="/profile" className="signin-btn">
              Sign in
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
