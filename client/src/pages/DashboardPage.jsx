import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context";
import { useToast } from "../context";
import {
  toggleFavorite,
  deleteAlert,
  addAlert,
  refreshNotifications,
} from "../firestore";
import { api } from "../api";

const TABS = [
  { id: "favorites", label: "Favorites", icon: "★" },
  { id: "history",   label: "History",   icon: "🕐" },
  { id: "alerts",    label: "Alerts",    icon: "🔔" },
  { id: "notifs",    label: "Inbox",     icon: "📨" },
];

const categoryFallbackLabels = {
  "cs.CR": "Cryptography & Security", "cs.DB": "Databases",
  "cs.DC": "Distributed Computing", "cs.DS": "Data Structures",
  "cs.AI": "Artificial Intelligence", "cs.LG": "Machine Learning",
  "cs.CV": "Computer Vision", "cs.CL": "Computation & Language",
  "cs.RO": "Robotics", "math.CO": "Combinatorics",
  "physics.data-an": "Data Analysis", "q-bio.BM": "Biomolecules",
  "stat.ML": "Statistics ML", "quant-ph": "Quantum Physics",
};

function getCategoryLabel(code) {
  return categoryFallbackLabels[code] || code || "General";
}

function formatDate(v) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, dashboard } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("favorites");
  const [alertCategory, setAlertCategory] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [categories] = useState(Object.entries(categoryFallbackLabels).map(([code, label]) => ({ code, label })));

  if (!user) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-icon">🔐</div>
        <h3>Sign in to access your dashboard</h3>
        <p>Your favorites, history, alerts, and notifications will appear here.</p>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/profile")}
          style={{ marginTop: "1rem" }}
          type="button"
        >
          Sign in
        </button>
      </div>
    );
  }

  const favorites = dashboard?.favorites || [];
  const history = dashboard?.history || [];
  const alerts = dashboard?.alerts || [];
  const notifications = dashboard?.notifications || [];

  const tabCounts = {
    favorites: favorites.length,
    history: history.length,
    alerts: alerts.length,
    notifs: notifications.length,
  };

  async function handleRemoveFav(article) {
    try {
      await toggleFavorite(user.uid, article);
      addToast("Removed from favorites.", "info");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handleAddAlert() {
    if (!alertCategory) { addToast("Select a category first.", "info"); return; }
    try {
      const label = getCategoryLabel(alertCategory);
      await addAlert(user.uid, { category: alertCategory, label });
      setAlertCategory("");
      addToast(`Alert added for ${label}.`, "success");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handleDeleteAlert(alertId) {
    try {
      await deleteAlert(user.uid, alertId);
      addToast("Alert removed.", "info");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handleRefreshNotifications() {
    setRefreshing(true);
    try {
      await refreshNotifications(user.uid, alerts);
      addToast("Notifications refreshed!", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <span className="eyebrow">Your Research Space</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", marginTop: "0.25rem" }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: "0.4rem" }}>
          Manage your saved papers, reading history, topic alerts, and notifications.
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tabCounts[tab.id] > 0 && (
              <span className="tab-count">{tabCounts[tab.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Favorites ─── */}
      {activeTab === "favorites" && (
        favorites.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">★</div>
            <h3>No saved papers yet</h3>
            <p>Search for articles and click "Save Favorite" to bookmark them here.</p>
            <button className="btn btn-primary" onClick={() => navigate("/")} style={{ marginTop: "1rem" }} type="button">
              Browse Papers
            </button>
          </div>
        ) : (
          <div className="favorites-grid">
            {favorites.map(item => (
              <div key={item.id} className="favorite-card">
                <div>
                  <span className="category-chip">{getCategoryLabel(item.primaryCategory)}</span>
                </div>
                <div className="favorite-card-title">{item.title}</div>
                <div className="favorite-card-meta">
                  {item.authors?.join(", ") || "Unknown authors"}
                </div>
                <div className="favorite-card-meta">
                  Saved {formatDate(item.savedAt)}
                </div>
                <div className="favorite-card-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/article/${encodeURIComponent(item.id)}`)}
                    type="button"
                  >
                    View →
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemoveFav(item)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ─── History ─── */}
      {activeTab === "history" && (
        history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🕐</div>
            <h3>No reading history yet</h3>
            <p>Open articles and click "Mark as Read" to track your reading here.</p>
          </div>
        ) : (
          <div className="card">
            <div className="history-list">
              {history.map((item, i) => (
                <div
                  key={`${item.id}-${item.viewedAt}`}
                  className="history-item"
                  onClick={() => navigate(`/article/${encodeURIComponent(item.id)}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && navigate(`/article/${encodeURIComponent(item.id)}`)}
                >
                  <div className="history-dot" />
                  <div className="history-content">
                    <div className="history-title">{item.title}</div>
                    <div className="history-date">
                      {item.authors?.join(", ")} · Viewed {formatDate(item.viewedAt)}
                    </div>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* ─── Alerts ─── */}
      {activeTab === "alerts" && (
        <div>
          {/* Add alert */}
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Add Topic Alert</h3>
            <div className="add-alert-row">
              <select
                value={alertCategory}
                onChange={e => setAlertCategory(e.target.value)}
                id="alert-category-select"
              >
                <option value="">Choose a category…</option>
                {categories.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={handleAddAlert} type="button">
                + Add Alert
              </button>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
              We'll find new papers in selected categories when you refresh your inbox.
            </p>
          </div>

          {/* Alert list */}
          {alerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <h3>No alerts configured</h3>
              <p>Add topic categories above to get notified about new papers.</p>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map(alert => (
                <div key={alert.id} className="alert-item">
                  <div>
                    <div className="alert-item-label">
                      <span className="category-chip">{alert.label || getCategoryLabel(alert.category)}</span>
                    </div>
                    <div className="alert-item-meta">Added {formatDate(alert.createdAt)}</div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteAlert(alert.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Notifications / Inbox ─── */}
      {activeTab === "notifs" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <button
              className="btn btn-primary"
              onClick={handleRefreshNotifications}
              disabled={refreshing || alerts.length === 0}
              type="button"
            >
              {refreshing ? "Refreshing…" : "🔄 Refresh Inbox"}
            </button>
          </div>

          {alerts.length === 0 && (
            <div
              style={{
                padding: "1rem",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "var(--radius-lg)",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                color: "var(--accent-warm)"
              }}
            >
              ⚠ Add topic alerts first to generate notifications.
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>Inbox is empty</h3>
              <p>Add alerts and click "Refresh Inbox" to pull the latest papers for your topics.</p>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className="notif-item"
                  style={{ cursor: "pointer" }}
                  onClick={() => notif.articleId && navigate(`/article/${encodeURIComponent(notif.articleId)}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && notif.articleId && navigate(`/article/${encodeURIComponent(notif.articleId)}`)}
                >
                  <div className="notif-icon">📄</div>
                  <div className="notif-content">
                    <div className="notif-title">{notif.categoryLabel || getCategoryLabel(notif.category)}</div>
                    <div className="notif-message">{notif.title}</div>
                    {notif.published && (
                      <div className="notif-date">{formatDate(notif.published)}</div>
                    )}
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
