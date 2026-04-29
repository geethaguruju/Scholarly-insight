import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context";
import { useToast } from "../context";
import { toggleFavorite } from "../firestore";

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

function getCategoryLabel(code, categories = []) {
  if (!code) return "General";
  const known = categories.find(c => c.code === code);
  if (known) return known.label;
  return categoryFallbackLabels[code] || code;
}

function formatDate(value) {
  if (!value) return "Unknown";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ height: "1rem", width: "40%", borderRadius: "8px" }} />
      <div className="skeleton" style={{ height: "1rem", width: "90%", borderRadius: "8px" }} />
      <div className="skeleton" style={{ height: "0.75rem", width: "60%", borderRadius: "8px" }} />
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, dashboard } = useAuth();
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [resultMeta, setResultMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    q: "", author: "", category: "", from: "", to: ""
  });

  // Load categories on mount
  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
    runSearch(1);
  }, []);

  const isFavorite = useCallback(
    (articleId) => dashboard?.favorites?.some(f => f.id === articleId) ?? false,
    [dashboard]
  );

  async function runSearch(page = 1) {
    setLoading(true);
    try {
      const data = await api.searchArticles({
        ...filters,
        start: (page - 1) * 10,
        maxResults: 10,
      });
      setResults(data.items || []);
      setResultMeta({
        total: data.total ?? data.items?.length ?? 0,
        page: data.page ?? page,
        totalPages: data.totalPages ?? 1,
      });
      if (data.items?.[0] && !selectedArticle) {
        setSelectedArticle(data.items[0]);
      }
    } catch (err) {
      addToast(err.message || "Search failed. arXiv may be rate-limiting requests.", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(field, value) {
    setFilters(prev => ({ ...prev, [field]: value }));
  }

  async function handleToggleFavorite(e, article) {
    e.stopPropagation();
    if (!user?.uid) {
      addToast("Sign in to save favorites.", "info");
      return;
    }
    try {
      await toggleFavorite(user.uid, article);
      addToast(
        isFavorite(article.id) ? "Removed from favorites." : "Saved to favorites!",
        "success"
      );
    } catch (err) {
      addToast(err.message, "error");
    }
  }

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      {/* Hero */}
      <div className="hero">
        <div className="science-particles">
          <div className="particle p1">⚛</div>
          <div className="particle p2">λ</div>
          <div className="particle p3">∑</div>
          <div className="particle p4">{"{ }"}</div>
          <div className="particle p5">Δ</div>
          <div className="particle p6">∫</div>
          <div className="particle p7">∞</div>
          <div className="particle p8">Ω</div>
        </div>
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span>🔬</span>
            <span>Powered by arXiv API</span>
          </div>
          <h1>
            Discover the latest{" "}
            <span className="gradient-text">research</span>
          </h1>
          <p className="hero-description">
            Search and browse scholarly articles across AI, physics, mathematics, and more.
            Save favorites, set alerts, and join discussions.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <strong>2M+</strong>
              Papers indexed
            </div>
            <div className="hero-stat">
              <strong>Free</strong>
              Open access
            </div>
            <div className="hero-stat">
              <strong>Live</strong>
              Daily updates
            </div>
          </div>
        </div>
      </div>

      {/* Search panel */}
      <div className="search-panel">
        <div className="search-main">
          <input
            id="search-keywords"
            value={filters.q}
            onChange={e => handleFilterChange("q", e.target.value)}
            placeholder="Search papers by keyword, topic, or concept…"
            onKeyDown={e => e.key === "Enter" && runSearch(1)}
          />
          <button
            className="btn btn-primary"
            onClick={() => runSearch(1)}
            disabled={loading}
            type="button"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        <button
          className="filters-toggle"
          onClick={() => setFiltersOpen(o => !o)}
          type="button"
        >
          {filtersOpen ? "▲" : "▼"} {filtersOpen ? "Hide" : "Show"} advanced filters
          {hasActiveFilters && !filtersOpen && (
            <span className="badge badge-indigo" style={{ marginLeft: "0.5rem" }}>Active</span>
          )}
        </button>

        {filtersOpen && (
          <div className="search-filters">
            <div className="form-group">
              <label className="form-label" htmlFor="filter-author">Author</label>
              <input
                id="filter-author"
                value={filters.author}
                onChange={e => handleFilterChange("author", e.target.value)}
                placeholder="e.g. Yann LeCun"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filter-category">Category</label>
              <select
                id="filter-category"
                value={filters.category}
                onChange={e => handleFilterChange("category", e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filter-from">Published after</label>
              <input
                id="filter-from"
                type="date"
                value={filters.from}
                onChange={e => handleFilterChange("from", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="filter-to">Published before</label>
              <input
                id="filter-to"
                type="date"
                value={filters.to}
                onChange={e => handleFilterChange("to", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="home-layout">
        {/* Results list */}
        <div className="results-panel">
          <div className="results-header">
            <span className="results-count">
              <strong>{resultMeta.total.toLocaleString()}</strong>{" "}
              {resultMeta.total === 1 ? "paper" : "papers"} found
            </span>
            {resultMeta.totalPages > 1 && (
              <span className="results-count">
                Page {resultMeta.page} / {resultMeta.totalPages}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No papers found</h3>
              <p>Try a broader keyword or remove a filter. arXiv may also be rate-limiting — wait a moment and try again.</p>
            </div>
          ) : (
            <div className="article-grid">
              {results.map(article => (
                <button
                  key={article.id}
                  className={`article-card ${selectedArticle?.id === article.id ? "selected" : ""}`}
                  onClick={() => setSelectedArticle(article)}
                  type="button"
                >
                  <div className="article-card-meta">
                    <span className="category-chip">
                      {getCategoryLabel(article.primaryCategory, categories)}
                    </span>
                    <span className="article-card-date">{formatDate(article.published)}</span>
                  </div>
                  <h3 className="article-card-title">{article.title}</h3>
                  <div className="article-card-authors">
                    {article.authors?.join(", ") || "Unknown authors"}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {resultMeta.totalPages > 1 && !loading && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={resultMeta.page === 1}
                onClick={() => runSearch(resultMeta.page - 1)}
                type="button"
              >
                ← Prev
              </button>
              <span className="pagination-info">
                {resultMeta.page} / {resultMeta.totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={resultMeta.page === resultMeta.totalPages}
                onClick={() => runSearch(resultMeta.page + 1)}
                type="button"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Article detail */}
        <div className="detail-panel">
          {!selectedArticle ? (
            <div className="detail-empty">
              <div className="detail-empty-icon">📖</div>
              <h3 style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Select a paper</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Choose an article from the list to see its details, abstract, and discussion.
              </p>
            </div>
          ) : (
            <ArticleDetail
              article={selectedArticle}
              categories={categories}
              isFav={isFavorite(selectedArticle.id)}
              onToggleFav={handleToggleFavorite}
              onOpenFull={() => navigate(`/article/${encodeURIComponent(selectedArticle.id)}`)}
              user={user}
            />
          )}
        </div>
      </div>
    </div>
  );
}


function ArticleDetail({ article, categories, isFav, onToggleFav, onOpenFull, user }) {
  function getCategoryLabel(code) {
    return categoryFallbackLabels[code] || code || "General";
  }

  return (
    <div>
      <span className="eyebrow">Article Preview</span>
      <h2 className="detail-title">{article.title}</h2>

      <div className="detail-actions">
        <button
          className="btn btn-primary"
          onClick={onOpenFull}
          type="button"
        >
          📖 Open Full Page
        </button>
        <button
          className={`btn ${isFav ? "btn-success" : "btn-secondary"}`}
          onClick={e => onToggleFav(e, article)}
          disabled={!user}
          type="button"
        >
          {isFav ? "★ Saved" : "☆ Save"}
        </button>
        {article.pdfUrl && (
          <a
            className="btn btn-secondary"
            href={article.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            PDF ↗
          </a>
        )}
      </div>

      <div className="meta-grid">
        <div className="meta-item">
          <span className="meta-item-label">Authors</span>
          <span className="meta-item-value" style={{ fontSize: "0.82rem" }}>
            {article.authors?.join(", ") || "Unknown"}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-item-label">Category</span>
          <span className="meta-item-value">
            {getCategoryLabel(article.primaryCategory)}
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-item-label">Published</span>
          <span className="meta-item-value">{formatDate(article.published)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-item-label">Updated</span>
          <span className="meta-item-value">{formatDate(article.updated)}</span>
        </div>
      </div>

      <div className="abstract-section">
        <h3>Abstract</h3>
        <p className="abstract-text">{article.abstract || "No abstract available."}</p>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          💬 Open the full page to read discussions and post your own insights.
        </p>
      </div>
    </div>
  );
}
