import { useAuth } from "../context";
import { useToast } from "../context";

export default function NotificationDrawer({ onClose }) {
  const { dashboard } = useAuth();
  const { addToast } = useToast();
  const notifications = dashboard?.notifications || [];

  return (
    <>
      {/* Overlay */}
      <div className="drawer-overlay" onClick={onClose} />

      {/* Drawer */}
      <aside className="drawer">
        <div className="drawer-header">
          <h2>🔔 Notifications</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="drawer-body">
          {notifications.length === 0 ? (
            <div className="empty-state" style={{ padding: "3rem 0" }}>
              <div className="empty-state-icon">📭</div>
              <h3>No notifications yet</h3>
              <p>Add topic alerts on your Dashboard and click Refresh to generate notifications.</p>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map(notif => (
                <div key={notif.id} className="notif-item">
                  <div className="notif-icon">📄</div>
                  <div className="notif-content">
                    <div className="notif-title">{notif.categoryLabel || notif.category}</div>
                    <div className="notif-message">{notif.title}</div>
                    {notif.published && (
                      <div className="notif-date">
                        {new Date(notif.published).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
