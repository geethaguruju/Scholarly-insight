import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context";
import { useToast } from "../context";
import {
  toggleFavorite,
  recordHistory,
  subscribeToDiscussion,
  addDiscussionPost,
  clearDiscussionPost,
} from "../firestore";

const categoryFallbackLabels = {
  "cs.CR": "Cryptography & Security",
  "cs.DB": "Databases",
  "cs.DC": "Distributed Computing",
  "cs.DS": "Data Structures",
  "cs.HC": "HCI",
  "cs.IR": "Information Retrieval",
  "cs.NE": "Neural Computing",
  "cs.NI": "Networking",
  "cs.PL": "Programming Languages",
  "cs.SE": "Software Engineering",
  "econ.EM": "Econometrics",
  "eess.AS": "Audio Processing",
  "eess.IV": "Image Processing",
  "eess.SP": "Signal Processing",
  "hep-th": "High Energy Physics",
  "math.OC": "Optimization",
  "quant-ph": "Quantum Physics",
};

function getCategoryLabel(code) {
  return categoryFallbackLabels[code] || code || "General";
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric"
  });
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// External links use plain <a target="_blank"> — no window.open fallback needed

export default function ArticlePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, dashboard } = useAuth();
  const { addToast } = useToast();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [discussionPosts, setDiscussionPosts] = useState([]);
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [markedRead, setMarkedRead] = useState(false);

  const isFav = dashboard?.favorites?.some(f => f.id === article?.id) ?? false;

  const decodedId = decodeURIComponent(id);

  // Load article
  useEffect(() => {
    setLoading(true);
    api.getArticle(decodedId)
      .then(setArticle)
      .catch(err => addToast("Could not load article: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, [decodedId]);

  // Real-time discussion subscription
  useEffect(() => {
    if (!decodedId) return;
    const unsub = subscribeToDiscussion(decodedId, setDiscussionPosts);
    return unsub;
  }, [decodedId]);

  async function handleToggleFav() {
    if (!user?.uid) { addToast("Sign in to save favorites.", "info"); return; }
    try {
      await toggleFavorite(user.uid, article);
      addToast(isFav ? "Removed from favorites." : "Saved to favorites!", "success");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handleMarkRead() {
    if (!user?.uid) { addToast("Sign in to track reading history.", "info"); return; }
    try {
      await recordHistory(user.uid, article);
      setMarkedRead(true);
      addToast('Added to reading history.', "success");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  async function handlePostDiscussion(e) {
    e.preventDefault();
    if (!message.trim() || !user) return;
    setPosting(true);
    try {
      await addDiscussionPost(decodedId, {
        message: message.trim(),
        author: user.displayName || user.email?.split("@")[0] || "Researcher",
        userId: user.uid,
      });
      setMessage("");
      addToast("Comment posted!", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setPosting(false);
    }
  }

  async function handleDeletePost(postId) {
    try {
      await clearDiscussionPost(decodedId, postId);
      addToast("Comment deleted.", "info");
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        <div className="skeleton-card" style={{ height: "200px", marginBottom: "1.5rem" }} />
        <div className="skeleton-card" style={{ height: "400px" }} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-icon">😕</div>
        <h3>Article not found</h3>
        <p>This article could not be loaded from arXiv.</p>
        <button className="btn btn-secondary" onClick={() => navigate("/")} style={{ marginTop: "1rem" }}>
          ← Back to Search
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "880px", margin: "0 auto" }}>
      {/* Back */}
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          color: "var(--text-muted)",
          textDecoration: "none",
          fontSize: "0.875rem",
          marginBottom: "1.5rem",
          transition: "var(--transition)",
        }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--text-secondary)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
      >
        ← Back to Search
      </Link>

      {/* Article header card */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <span className="category-chip">{getCategoryLabel(article.primaryCategory)}</span>
        </div>

        <h1 className="detail-title" style={{ fontSize: "1.6rem" }}>{article.title}</h1>

        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          {article.authors?.join(", ") || "Unknown authors"}
        </p>

        {/* Action bar */}
        <div className="detail-actions">
          <button
            className={`btn ${isFav ? "btn-success" : "btn-primary"}`}
            onClick={handleToggleFav}
            disabled={!user}
            type="button"
          >
            {isFav ? "★ Saved" : "☆ Save Favorite"}
          </button>
          <button
            className={`btn ${markedRead ? "btn-success" : "btn-secondary"}`}
            onClick={handleMarkRead}
            disabled={!user || markedRead}
            type="button"
          >
            {markedRead ? "✓ Read" : "Mark as Read"}
          </button>
          {article.pdfUrl && (
            <a
              className="btn btn-secondary"
              href={article.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              📄 Open PDF ↗
            </a>
          )}
          {article.entryId && (
            <a
              className="btn btn-ghost"
              href={article.entryId}
              target="_blank"
              rel="noopener noreferrer"
            >
              arXiv Page ↗
            </a>
          )}
        </div>

        {/* Metadata grid */}
        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-item-label">Published</span>
            <span className="meta-item-value">{formatDate(article.published)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-item-label">Updated</span>
            <span className="meta-item-value">{formatDate(article.updated)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-item-label">Category</span>
            <span className="meta-item-value">{getCategoryLabel(article.primaryCategory)}</span>
          </div>
          {article.doi && (
            <div className="meta-item">
              <span className="meta-item-label">DOI</span>
              <span className="meta-item-value" style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>
                {article.doi}
              </span>
            </div>
          )}
        </div>

        {/* All categories */}
        {article.categories?.length > 1 && (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "-0.5rem", marginBottom: "1rem" }}>
            {article.categories.map(c => (
              <span key={c} className="category-chip" style={{ opacity: 0.7 }}>
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Abstract */}
        <div className="abstract-section">
          <h3>Abstract</h3>
          <p className="abstract-text">{article.abstract || "No abstract available."}</p>
        </div>

        {article.comment && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
            💬 Author note: {article.comment}
          </p>
        )}
      </div>

      {/* Discussion Forum */}
      <div className="card">
        <div className="discussion-section">
          <h3>
            💬 Discussion
            <span className="badge badge-indigo" style={{ marginLeft: "0.5rem" }}>
              {discussionPosts.length}
            </span>
          </h3>

          {/* Post form */}
          {user ? (
            <form className="discussion-form" onSubmit={handlePostDiscussion}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "0.25rem"
              }}>
                <div className="post-avatar">{getInitials(user.displayName || user.email)}</div>
                <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 600 }}>
                  {user.displayName || user.email?.split("@")[0]}
                </span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Share your thoughts on this paper…"
                rows={3}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-primary btn-sm"
                  type="submit"
                  disabled={!message.trim() || posting}
                >
                  {posting ? "Posting…" : "Post Comment"}
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              padding: "1rem",
              background: "var(--bg-elevated)",
              borderRadius: "var(--radius-lg)",
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Sign in to join the discussion.
              </p>
              <Link to="/profile" className="btn btn-primary btn-sm">
                Sign in
              </Link>
            </div>
          )}

          {/* Posts list */}
          {discussionPosts.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem 0" }}>
              <div className="empty-state-icon">💭</div>
              <h3>No comments yet</h3>
              <p>Be the first to share an insight about this paper.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {discussionPosts.map(post => (
                <div key={post.id} className="discussion-post">
                  <div className="post-avatar">
                    {getInitials(post.author)}
                  </div>
                  <div className="post-body">
                    <div className="post-header">
                      <span className="post-author">{post.author}</span>
                      <span className="post-date">
                        {formatDate(post.createdAt?.toDate ? post.createdAt.toDate() : post.createdAt)}
                      </span>
                    </div>
                    <p className="post-message">{post.message}</p>
                  </div>
                  {/* Delete own posts */}
                  {user?.uid === post.userId && (
                    <button
                      className="btn btn-ghost btn-icon btn-sm post-delete"
                      onClick={() => handleDeletePost(post.id)}
                      title="Delete comment"
                      type="button"
                      style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                    >
                      🗑
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
