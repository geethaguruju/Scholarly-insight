const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

export const api = {
  verifyToken: (idToken) =>
    request("/api/auth/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }),
  getCategories: () => request("/api/categories"),
  searchArticles: (params) => {
    const url = new URL(`${API_BASE}/api/articles/search`);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });

    return request(url.pathname + url.search);
  },
  getArticle: (id) => request(`/api/articles/${encodeURIComponent(id)}`),
  createSession: (payload) =>
    request("/api/users/session", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getDashboard: (userId) => request(`/api/users/${userId}/dashboard`),
  toggleFavorite: (userId, article) =>
    request(`/api/users/${userId}/favorites/toggle`, {
      method: "POST",
      body: JSON.stringify({ article })
    }),
  recordHistory: (userId, article) =>
    request(`/api/users/${userId}/history`, {
      method: "POST",
      body: JSON.stringify({ article })
    }),
  addAlert: (userId, payload) =>
    request(`/api/users/${userId}/alerts`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  deleteAlert: (userId, alertId) =>
    request(`/api/users/${userId}/alerts/${alertId}`, {
      method: "DELETE"
    }),
  refreshNotifications: (userId) =>
    request(`/api/users/${userId}/notifications/refresh`, {
      method: "POST"
    }),
  getDiscussions: (articleId) => request(`/api/articles/${encodeURIComponent(articleId)}/discussions`),
  addDiscussion: (articleId, payload) =>
    request(`/api/articles/${encodeURIComponent(articleId)}/discussions`, {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
