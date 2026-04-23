import { useEffect, useState } from "react";
import { api } from "./api";
import {
  firebaseConfigured,
  registerWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  watchAuthState
} from "./firebase";
import {
  addAlert,
  addDiscussionPost,
  deleteAlert,
  recordHistory,
  refreshNotifications,
  seedFirestoreIndexes,
  subscribeToDashboard,
  subscribeToDiscussion,
  toggleFavorite,
  upsertUserProfile
} from "./firestore";

const defaultFilters = {
  q: "",
  author: "",
  category: "",
  from: "",
  to: ""
};

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  return new Date(value).toLocaleDateString();
}

const categoryFallbackLabels = {
  "cs.CR": "Cryptography and Security",
  "cs.DB": "Databases",
  "cs.DC": "Distributed Computing",
  "cs.DS": "Data Structures and Algorithms",
  "cs.HC": "Human-Computer Interaction",
  "cs.IR": "Information Retrieval",
  "cs.NE": "Neural and Evolutionary Computing",
  "cs.NI": "Networking and Internet Architecture",
  "cs.PL": "Programming Languages",
  "cs.SE": "Software Engineering",
  "econ.EM": "Econometrics",
  "eess.AS": "Audio and Speech Processing",
  "eess.IV": "Image and Video Processing",
  "eess.SP": "Signal Processing",
  "hep-th": "High Energy Physics - Theory",
  "math.OC": "Optimization and Control",
  "quant-ph": "Quantum Physics"
};

function getCategoryLabel(code, categories) {
  if (!code) {
    return "General";
  }

  const knownLabel = categories.find((category) => category.code === code)?.label;
  if (knownLabel) {
    return knownLabel;
  }

  return categoryFallbackLabels[code] || code;
}

function openExternalLink(url) {
  if (!url) {
    return;
  }

  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (!newWindow) {
    window.location.href = url;
  }
}

function AuthPanel({ user, busy, authMode, authForm, onAuthModeChange, onAuthFormChange, onEmailAuth, onGoogleAuth, onSignOut }) {
  return (
    <section className="panel accent">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h2>Your research space</h2>
        </div>
        <span className={`badge ${firebaseConfigured ? "success" : "warning"}`}>
          {firebaseConfigured ? "Firebase connected" : "Firebase not configured"}
        </span>
      </div>

      {user ? (
        <div className="auth-summary">
          <div>
            <strong>{user.displayName || "Research User"}</strong>
            <p className="muted">{user.email}</p>
          </div>
          <button className="secondary" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : (
        <>
          <p className="muted">
            Sign in with Firebase Auth so favorites, history, alerts, and discussions persist in Firestore.
          </p>
          <div className="auth-switch">
            <button
              className={authMode === "signin" ? "" : "secondary"}
              onClick={() => onAuthModeChange("signin")}
            >
              Sign in
            </button>
            <button
              className={authMode === "signup" ? "" : "secondary"}
              onClick={() => onAuthModeChange("signup")}
            >
              Create account
            </button>
          </div>
          <form
            className="session-form"
            onSubmit={(event) => {
              event.preventDefault();
              onEmailAuth();
            }}
          >
            <input
              placeholder="Name"
              value={authForm.name}
              onChange={(event) => onAuthFormChange("name", event.target.value)}
            />
            <input
              placeholder="Email"
              type="email"
              value={authForm.email}
              onChange={(event) => onAuthFormChange("email", event.target.value)}
            />
            <input
              placeholder="Password"
              type="password"
              value={authForm.password}
              onChange={(event) => onAuthFormChange("password", event.target.value)}
            />
            <button type="submit" disabled={busy || !firebaseConfigured}>
              {busy ? "Working..." : authMode === "signin" ? "Sign in with email" : "Create account"}
            </button>
          </form>
          <button className="secondary full-width" disabled={busy || !firebaseConfigured} onClick={onGoogleAuth}>
            Continue with Google
          </button>
        </>
      )}
    </section>
  );
}

function SearchPanel({ filters, categories, onChange, onSearch, loading }) {
  const hasActiveFilters = Boolean(
    filters.q.trim() || filters.author.trim() || filters.category || filters.from || filters.to
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Discovery</p>
          <h2>Smart search for scholarly articles</h2>
        </div>
      </div>
      <div className="filters">
        <label>
          <span className="field-label">Keywords</span>
          <input value={filters.q} placeholder="Keywords" onChange={(event) => onChange("q", event.target.value)} />
        </label>
        <label>
          <span className="field-label">Author</span>
          <input value={filters.author} placeholder="Author" onChange={(event) => onChange("author", event.target.value)} />
        </label>
        <label>
          <span className="field-label">Category</span>
          <select value={filters.category} onChange={(event) => onChange("category", event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Published after</span>
          <input type="date" value={filters.from} onChange={(event) => onChange("from", event.target.value)} />
        </label>
        <label>
          <span className="field-label">Published before</span>
          <input type="date" value={filters.to} onChange={(event) => onChange("to", event.target.value)} />
        </label>
        <label className="search-action">
          <span className="field-label">Run search</span>
          <button type="button" onClick={onSearch} disabled={loading}>
            {loading ? "Searching..." : "Search papers"}
          </button>
        </label>
      </div>
      <p className="muted">
        {hasActiveFilters
          ? "Active filters are applied. Smart search boosts close title, author, and category matches before showing results."
          : "No filters applied. This is showing the newest arXiv papers. Add keywords, author, category, or dates to trigger smart matching and ranking."}
      </p>
    </section>
  );
}

function ArticleList({
  results,
  selectedId,
  onSelect,
  categories,
  totalResults,
  currentPage,
  totalPages,
  onPageChange
}) {
  const resultsHeading =
    totalResults >= 50
      ? "Showing top 50 results"
      : `${totalResults} papers found`;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Results</p>
          <h2>{resultsHeading}</h2>
        </div>
        {totalPages > 1 ? (
          <div className="pagination-summary">Page {currentPage} of {totalPages}</div>
        ) : null}
      </div>
      <div className="results">
        {results.length === 0 ? (
          <div className="empty-state">
            <h2>No matching papers</h2>
            <p>Try a broader keyword, remove one filter, or widen the date range.</p>
          </div>
        ) : null}
        {results.map((article) => (
          <button
            key={article.id}
            className={`article-card ${selectedId === article.id ? "selected" : ""}`}
            onClick={() => onSelect(article)}
          >
            <span className="article-category">{getCategoryLabel(article.primaryCategory, categories)}</span>
            <h3>{article.title}</h3>
            <p>{article.authors.join(", ") || "Unknown authors"}</p>
            <small>Published {formatDate(article.published)}</small>
          </button>
        ))}
      </div>
      {totalPages > 1 ? (
        <div className="pagination-controls">
          <button
            type="button"
            className="secondary"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className="secondary"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ArticleDetail({ article, isFavorite, signedIn, onToggleFavorite, onTrackHistory, categories }) {
  if (!article) {
    return (
      <section className="panel">
        <div className="empty-state">
          <h2>Select a paper</h2>
          <p>Search for articles, then open one here to view metadata, abstract, and discussion.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel article-detail">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Article details</p>
          <h2>{article.title}</h2>
        </div>
        <div className="header-actions">
          <button className="secondary" disabled={!signedIn} onClick={() => onTrackHistory(article)}>
            Mark as read
          </button>
          <button disabled={!signedIn} onClick={() => onToggleFavorite(article)}>
            {isFavorite ? "Remove favorite" : "Save favorite"}
          </button>
        </div>
      </div>
      <div className="meta-grid">
        <div>
          <span>Authors</span>
          <strong>{article.authors.join(", ") || "Unknown authors"}</strong>
        </div>
        <div>
          <span>Primary category</span>
          <strong>{getCategoryLabel(article.primaryCategory, categories)}</strong>
        </div>
        <div>
          <span>Published</span>
          <strong>{formatDate(article.published)}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{formatDate(article.updated)}</strong>
        </div>
      </div>
      <p className="abstract">{article.abstract}</p>
      <div className="link-row">
        <button className="secondary" onClick={() => openExternalLink(article.entryId)} disabled={!article.entryId}>
          View abstract page
        </button>
        <button onClick={() => openExternalLink(article.pdfUrl)} disabled={!article.pdfUrl}>
          Open PDF
        </button>
      </div>
    </section>
  );
}

function Sidebar({
  dashboard,
  categories,
  signedIn,
  onAddAlert,
  onDeleteAlert,
  onRefreshNotifications,
  onSelectFavorite,
  onSelectHistoryItem
}) {
  const [alertCategory, setAlertCategory] = useState("");

  return (
    <aside className="sidebar">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Favorites</p>
            <h2>Saved papers</h2>
          </div>
        </div>
        <div className="stack">
          {dashboard?.favorites?.length ? (
            dashboard.favorites.map((item) => (
              <button key={item.id} className="mini-card sidebar-card" onClick={() => onSelectFavorite(item)}>
                <strong>{item.title}</strong>
                <small>{getCategoryLabel(item.primaryCategory, categories)}</small>
              </button>
            ))
          ) : (
            <p className="muted">No favorites yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2>Reading timeline</h2>
          </div>
        </div>
        <div className="stack">
          {dashboard?.history?.length ? (
            dashboard.history.map((item) => (
              <button
                key={`${item.id}-${item.viewedAt}`}
                className="mini-card sidebar-card"
                onClick={() => onSelectHistoryItem(item)}
              >
                <strong>{item.title}</strong>
                <small>Viewed {formatDate(item.viewedAt)}</small>
              </button>
            ))
          ) : (
            <p className="muted">Reading history will appear here.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Alerts</p>
            <h2>Topic tracking</h2>
          </div>
          <button className="secondary" disabled={!signedIn} onClick={onRefreshNotifications}>
            Refresh
          </button>
        </div>
        <div className="alert-form">
          <select
            value={alertCategory}
            disabled={!signedIn}
            onChange={(event) => setAlertCategory(event.target.value)}
          >
            <option value="">Choose category</option>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.label}
              </option>
            ))}
          </select>
          <button
            disabled={!signedIn}
            onClick={() => {
              if (!alertCategory) {
                return;
              }

              const category = categories.find((item) => item.code === alertCategory);
              onAddAlert({
                category: alertCategory,
                label: category ? category.label : alertCategory
              });
              setAlertCategory("");
            }}
          >
            Add alert
          </button>
        </div>
        <div className="stack">
          {dashboard?.alerts?.length ? (
            dashboard.alerts.map((alert) => (
              <div key={alert.id} className="mini-card inline">
                <div>
                  <strong>{alert.label || getCategoryLabel(alert.category, categories)}</strong>
                </div>
                <button className="ghost" onClick={() => onDeleteAlert(alert.id)}>
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="muted">No alerts configured.</p>
          )}
        </div>
        <div className="stack">
          {(dashboard?.notifications || []).slice(0, 5).map((item) => (
            <div key={item.id} className="mini-card">
              <strong>{item.categoryLabel || getCategoryLabel(item.category, categories)}</strong>
              <small>{item.message}</small>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function DiscussionPanel({ article, signedIn, discussionPosts, onSubmit }) {
  const [message, setMessage] = useState("");
  const [author, setAuthor] = useState("Research Teammate");

  if (!article) {
    return null;
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Discussion forum</p>
          <h2>Share insights on this paper</h2>
        </div>
      </div>
      <form
        className="discussion-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!message.trim() || !signedIn) {
            return;
          }

          onSubmit({ author, message });
          setMessage("");
        }}
      >
        <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Display name" />
        <textarea
          rows="3"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={signedIn ? "What stood out in this paper?" : "Sign in to join the discussion"}
        />
        <button type="submit" disabled={!signedIn}>
          Post insight
        </button>
      </form>
      <div className="stack">
        {discussionPosts.length ? (
          discussionPosts.map((post) => (
            <article key={post.id} className="mini-card">
              <strong>{post.author}</strong>
              <small>{formatDate(post.createdAt?.toDate ? post.createdAt.toDate() : post.createdAt)}</small>
              <p>{post.message}</p>
            </article>
          ))
        ) : (
          <p className="muted">Start the first discussion thread for this article.</p>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [filters, setFilters] = useState(defaultFilters);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [resultMeta, setResultMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1
  });
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [user, setUser] = useState(null);
  const [discussionPosts, setDiscussionPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function showSuccess(message) {
    setSuccessMessage(message);
    window.clearTimeout(window.__scholarlyInsightSuccessTimer);
    window.__scholarlyInsightSuccessTimer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 2500);
  }

  async function loadArticleIntoDetail(articleId) {
    setError("");

    try {
      const existing = results.find((item) => item.id === articleId);
      const article = existing || (await api.getArticle(articleId));
      setSelectedArticle(article);
      showSuccess("Paper loaded.");
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function runSearch(page = 1) {
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const data = await api.searchArticles({
        ...filters,
        start: (page - 1) * 10,
        maxResults: 10
      });
      setResults(data.items);
      setResultMeta({
        total: data.total ?? data.items.length,
        page: data.page ?? page,
        pageSize: data.pageSize ?? 10,
        totalPages: data.totalPages ?? 1
      });
      if (data.items[0]) {
        setSelectedArticle(data.items[0]);
      } else {
        setSelectedArticle(null);
      }
    } catch (searchError) {
      setError(searchError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.getCategories().then(setCategories).catch((loadError) => setError(loadError.message));
    runSearch(1);
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }

    return watchAuthState(async (nextUser) => {
      setUser(nextUser);
      setDashboard(null);

      if (!nextUser) {
        return;
      }

      try {
        await upsertUserProfile(nextUser);
        await seedFirestoreIndexes(nextUser.uid);
      } catch (syncError) {
        setError(syncError.message);
      }
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    return subscribeToDashboard(user.uid, (nextDashboard) => {
      setDashboard(nextDashboard);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!selectedArticle?.id || !firebaseConfigured) {
      setDiscussionPosts([]);
      return;
    }

    return subscribeToDiscussion(selectedArticle.id, setDiscussionPosts);
  }, [selectedArticle?.id]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Scholarly Insight</p>
          <h1>Research discovery, tracking, and discussion in one place.</h1>
          <p className="hero-copy">
            Search arXiv intelligently, save papers that matter, track reading history, configure alerts,
            and build collaborative context around each article.
          </p>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {successMessage ? <div className="success-banner">{successMessage}</div> : null}

      <main className="layout">
        <div className="content">
          <AuthPanel
            user={user}
            busy={authBusy}
            authMode={authMode}
            authForm={authForm}
            onAuthModeChange={setAuthMode}
            onAuthFormChange={(field, value) => setAuthForm((current) => ({ ...current, [field]: value }))}
            onEmailAuth={async () => {
              setAuthBusy(true);
              setError("");

              try {
                if (authMode === "signin") {
                  await signInWithEmail(authForm.email, authForm.password);
                } else {
                  await registerWithEmail(authForm);
                }
              } catch (authError) {
                setError(authError.message);
              } finally {
                setAuthBusy(false);
              }
            }}
            onGoogleAuth={async () => {
              setAuthBusy(true);
              setError("");

              try {
                await signInWithGoogle();
              } catch (authError) {
                setError(authError.message);
              } finally {
                setAuthBusy(false);
              }
            }}
            onSignOut={async () => {
              try {
                await signOutUser();
              } catch (authError) {
                setError(authError.message);
              }
            }}
          />

          <SearchPanel
            filters={filters}
            categories={categories}
            loading={loading}
            onChange={(field, value) => setFilters((current) => ({ ...current, [field]: value }))}
            onSearch={runSearch}
          />

          <div className="main-grid">
            <ArticleList
              results={results}
              selectedId={selectedArticle?.id}
              onSelect={setSelectedArticle}
              categories={categories}
              totalResults={resultMeta.total}
              currentPage={resultMeta.page}
              totalPages={resultMeta.totalPages}
              onPageChange={runSearch}
            />

            <ArticleDetail
              article={selectedArticle}
              signedIn={Boolean(user)}
              categories={categories}
              isFavorite={Boolean(dashboard?.favorites?.some((item) => item.id === selectedArticle?.id))}
              onToggleFavorite={async (article) => {
                if (!user?.uid) {
                  setError("Sign in first to save favorites.");
                  return;
                }

                try {
                  await toggleFavorite(user.uid, article);
                  showSuccess("Favorites updated.");
                } catch (favoriteError) {
                  setError(favoriteError.message);
                }
              }}
              onTrackHistory={async (article) => {
                if (!user?.uid) {
                  setError("Sign in first to track reading history.");
                  return;
                }

                try {
                  await recordHistory(user.uid, article);
                  showSuccess(`Added "${article.title}" to reading history.`);
                } catch (historyError) {
                  setError(historyError.message);
                }
              }}
            />
          </div>

          <DiscussionPanel
            article={selectedArticle}
            signedIn={Boolean(user)}
            discussionPosts={discussionPosts}
            onSubmit={async (payload) => {
              if (!selectedArticle) {
                return;
              }

              try {
                await addDiscussionPost(selectedArticle.id, payload);
                showSuccess("Discussion post added.");
              } catch (discussionError) {
                setError(discussionError.message);
              }
            }}
          />
        </div>

        <Sidebar
          dashboard={dashboard}
          categories={categories}
          signedIn={Boolean(user)}
          onSelectFavorite={(item) => loadArticleIntoDetail(item.id)}
          onSelectHistoryItem={(item) => loadArticleIntoDetail(item.id)}
          onAddAlert={async (payload) => {
            if (!user?.uid) {
              setError("Sign in first to create alerts.");
              return;
            }

            try {
              await addAlert(user.uid, payload);
              showSuccess(`Alert added for ${payload.category}.`);
            } catch (alertError) {
              setError(alertError.message);
            }
          }}
          onDeleteAlert={async (alertId) => {
            if (!user?.uid) {
              return;
            }

            try {
              await deleteAlert(user.uid, alertId);
              showSuccess("Alert removed.");
            } catch (alertError) {
              setError(alertError.message);
            }
          }}
          onRefreshNotifications={async () => {
            if (!user?.uid) {
              setError("Sign in first to refresh notifications.");
              return;
            }

            try {
              await refreshNotifications(user.uid, dashboard?.alerts || []);
              showSuccess("Notifications refreshed.");
            } catch (notificationError) {
              setError(notificationError.message);
            }
          }}
        />
      </main>
    </div>
  );
}
