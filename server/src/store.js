import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");
const dataFile = path.join(dataDir, "data.json");

const baseState = {
  users: {},
  discussions: {}
};

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, JSON.stringify(baseState, null, 2));
  }
}

async function readState() {
  await ensureDataFile();
  const content = await readFile(dataFile, "utf8");
  return JSON.parse(content);
}

async function writeState(state) {
  await writeFile(dataFile, JSON.stringify(state, null, 2));
}

function normalizeUserRecord(userId, seed = {}) {
  return {
    profile: {
      id: userId,
      email: seed.email || "",
      displayName: seed.displayName || "",
      authProvider: seed.authProvider || "demo"
    },
    favorites: [],
    history: [],
    alerts: [],
    notifications: []
  };
}

function createUserId(email) {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export async function createOrUpdateSession({ email, displayName, authProvider = "demo" }) {
  if (!email) {
    throw new Error("Email is required");
  }

  const userId = createUserId(email);
  const state = await readState();
  const existing = state.users[userId] || normalizeUserRecord(userId, { email, displayName, authProvider });

  existing.profile = {
    ...existing.profile,
    email,
    displayName: displayName || existing.profile.displayName || email.split("@")[0],
    authProvider
  };

  state.users[userId] = existing;
  await writeState(state);

  return existing.profile;
}

export async function getUserDashboard(userId) {
  const state = await readState();
  return state.users[userId] || null;
}

export async function toggleFavorite(userId, article) {
  const state = await readState();
  const user = state.users[userId];

  if (!user) {
    throw new Error("User not found");
  }

  const existingIndex = user.favorites.findIndex((item) => item.id === article.id);

  if (existingIndex >= 0) {
    user.favorites.splice(existingIndex, 1);
  } else {
    user.favorites.unshift({
      id: article.id,
      title: article.title,
      authors: article.authors,
      primaryCategory: article.primaryCategory,
      published: article.published,
      pdfUrl: article.pdfUrl,
      savedAt: new Date().toISOString()
    });
  }

  await writeState(state);
  return user.favorites;
}

export async function recordHistory(userId, article) {
  const state = await readState();
  const user = state.users[userId];

  if (!user) {
    throw new Error("User not found");
  }

  user.history = user.history.filter((item) => item.id !== article.id);
  user.history.unshift({
    id: article.id,
    title: article.title,
    authors: article.authors,
    viewedAt: new Date().toISOString(),
    pdfUrl: article.pdfUrl
  });
  user.history = user.history.slice(0, 25);

  await writeState(state);
  return user.history;
}

export async function addAlert(userId, alert) {
  const state = await readState();
  const user = state.users[userId];

  if (!user) {
    throw new Error("User not found");
  }

  const record = {
    id: crypto.randomUUID(),
    category: alert.category,
    label: alert.label || alert.category,
    createdAt: new Date().toISOString()
  };

  user.alerts = [record, ...user.alerts.filter((item) => item.category !== alert.category)];
  await writeState(state);
  return user.alerts;
}

export async function removeAlert(userId, alertId) {
  const state = await readState();
  const user = state.users[userId];

  if (!user) {
    throw new Error("User not found");
  }

  user.alerts = user.alerts.filter((item) => item.id !== alertId);
  await writeState(state);
  return user.alerts;
}

export async function saveGeneratedNotifications(userId, notifications) {
  const state = await readState();
  const user = state.users[userId];

  if (!user) {
    throw new Error("User not found");
  }

  user.notifications = notifications;
  await writeState(state);
  return user.notifications;
}

export async function listDiscussions(articleId) {
  const state = await readState();
  return state.discussions[articleId] || [];
}

export async function addDiscussionPost(articleId, post) {
  const state = await readState();
  const comments = state.discussions[articleId] || [];

  const record = {
    id: crypto.randomUUID(),
    author: post.author || "Anonymous Researcher",
    message: post.message,
    createdAt: new Date().toISOString()
  };

  comments.unshift(record);
  state.discussions[articleId] = comments;
  await writeState(state);

  return record;
}
