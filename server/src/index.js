import "dotenv/config";
import express from "express";
import cors from "cors";
import { verifyFirebaseToken } from "./auth.js";
import {
  addAlert,
  addDiscussionPost,
  createOrUpdateSession,
  getUserDashboard,
  listDiscussions,
  recordHistory,
  removeAlert,
  saveGeneratedNotifications,
  toggleFavorite
} from "./store.js";
import { getArticleById, getCategoryCatalog, searchArxiv } from "./arxiv.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "scholarly-insight-api" });
});

app.post("/api/auth/verify", verifyFirebaseToken, (req, res) => {
  // If middleware passes, the user is authenticated
  res.json({ success: true, uid: req.user.uid, email: req.user.email });
});

app.get("/api/categories", (_req, res) => {
  res.json(getCategoryCatalog());
});

app.get("/api/articles/search", async (req, res) => {
  try {
    const result = await searchArxiv({
      query: req.query.q || "",
      author: req.query.author || "",
      category: req.query.category || "",
      from: req.query.from || "",
      to: req.query.to || "",
      start: Number(req.query.start || 0),
      maxResults: Math.min(Number(req.query.maxResults || 12), 25)
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/articles/:id", async (req, res) => {
  try {
    const article = await getArticleById(req.params.id);

    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users/session", async (req, res) => {
  try {
    const profile = await createOrUpdateSession(req.body);
    res.status(201).json(profile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/users/:userId/dashboard", async (req, res) => {
  try {
    const dashboard = await getUserDashboard(req.params.userId);

    if (!dashboard) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users/:userId/favorites/toggle", async (req, res) => {
  try {
    const favorites = await toggleFavorite(req.params.userId, req.body.article);
    res.status(201).json(favorites);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/users/:userId/history", async (req, res) => {
  try {
    const history = await recordHistory(req.params.userId, req.body.article);
    res.status(201).json(history);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/users/:userId/alerts", async (req, res) => {
  try {
    const alerts = await addAlert(req.params.userId, req.body);
    res.status(201).json(alerts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/users/:userId/alerts/:alertId", async (req, res) => {
  try {
    const alerts = await removeAlert(req.params.userId, req.params.alertId);
    res.json(alerts);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/users/:userId/notifications/refresh", async (req, res) => {
  try {
    const dashboard = await getUserDashboard(req.params.userId);

    if (!dashboard) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const alertCategories = dashboard.alerts.map((item) => item.category);
    const notificationGroups = await Promise.all(
      alertCategories.map(async (category) => {
        const result = await searchArxiv({ category, maxResults: 3 });
        return result.items.map((article) => ({
          id: `${category}-${article.id}`,
          articleId: article.id,
          title: article.title,
          category,
          published: article.published,
          message: `New paper in ${category}: ${article.title}`
        }));
      })
    );

    const notifications = notificationGroups.flat();
    const saved = await saveGeneratedNotifications(req.params.userId, notifications);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/articles/:id/discussions", async (req, res) => {
  try {
    const posts = await listDiscussions(req.params.id);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/articles/:id/discussions", async (req, res) => {
  try {
    if (!req.body.message?.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const post = await addDiscussionPost(req.params.id, req.body);
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Scholarly Insight API listening on http://0.0.0.0:${port}`);
});
