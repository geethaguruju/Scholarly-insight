import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { api } from "./api";

function ensureFirestore() {
  if (!db) {
    throw new Error("Firestore is not configured.");
  }
}

function userDoc(userId) {
  return doc(db, "users", userId);
}

function discussionCollection(articleId) {
  return collection(db, "articles", articleId, "discussionPosts");
}

export async function upsertUserProfile(user) {
  ensureFirestore();

  const ref = userDoc(user.uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? snapshot.data() : {};

  await setDoc(
    ref,
    {
      profile: {
        id: user.uid,
        email: user.email || "",
        displayName: user.displayName || existing.profile?.displayName || "",
        photoURL: user.photoURL || "",
        authProvider: user.providerData?.[0]?.providerId || "password"
      },
      favorites: existing.favorites || [],
      history: existing.history || [],
      alerts: existing.alerts || [],
      notifications: existing.notifications || [],
      createdAt: existing.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export function subscribeToDashboard(userId, callback) {
  ensureFirestore();

  return onSnapshot(userDoc(userId), (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    callback(snapshot.data());
  });
}

export async function toggleFavorite(userId, article) {
  ensureFirestore();

  const ref = userDoc(userId);
  const snapshot = await getDoc(ref);
  const data = snapshot.data();
  const favorites = data?.favorites || [];
  const nextFavorites = favorites.some((item) => item.id === article.id)
    ? favorites.filter((item) => item.id !== article.id)
    : [
        {
          id: article.id,
          title: article.title,
          authors: article.authors,
          primaryCategory: article.primaryCategory,
          published: article.published,
          pdfUrl: article.pdfUrl,
          savedAt: new Date().toISOString()
        },
        ...favorites
      ];

  await updateDoc(ref, {
    favorites: nextFavorites,
    updatedAt: serverTimestamp()
  });
}

export async function recordHistory(userId, article) {
  ensureFirestore();

  const ref = userDoc(userId);
  const snapshot = await getDoc(ref);
  const data = snapshot.data();
  const history = data?.history || [];
  const nextHistory = [
    {
      id: article.id,
      title: article.title,
      authors: article.authors,
      viewedAt: new Date().toISOString(),
      pdfUrl: article.pdfUrl
    },
    ...history.filter((item) => item.id !== article.id)
  ].slice(0, 25);

  await updateDoc(ref, {
    history: nextHistory,
    updatedAt: serverTimestamp()
  });
}

export async function addAlert(userId, alert) {
  ensureFirestore();

  const ref = userDoc(userId);
  const snapshot = await getDoc(ref);
  const data = snapshot.data();
  const alerts = data?.alerts || [];
  const nextAlerts = [
    {
      id: crypto.randomUUID(),
      category: alert.category,
      label: alert.label || alert.category,
      createdAt: new Date().toISOString()
    },
    ...alerts.filter((item) => item.category !== alert.category)
  ];

  await updateDoc(ref, {
    alerts: nextAlerts,
    updatedAt: serverTimestamp()
  });
}

export async function deleteAlert(userId, alertId) {
  ensureFirestore();

  const ref = userDoc(userId);
  const snapshot = await getDoc(ref);
  const data = snapshot.data();
  const alerts = data?.alerts || [];

  await updateDoc(ref, {
    alerts: alerts.filter((item) => item.id !== alertId),
    updatedAt: serverTimestamp()
  });
}

export async function refreshNotifications(userId, alerts = []) {
  ensureFirestore();

  const groups = await Promise.all(
    alerts.map(async (alert) => {
      const response = await api.searchArticles({
        category: alert.category,
        maxResults: 3
      });

      return response.items.map((article) => ({
        id: `${alert.category}-${article.id}`,
        articleId: article.id,
        title: article.title,
        category: alert.category,
        published: article.published,
        message: `New paper in ${alert.category}: ${article.title}`
      }));
    })
  );

  const notifications = groups.flat();
  await updateDoc(userDoc(userId), {
    notifications,
    updatedAt: serverTimestamp()
  });
}

export function subscribeToDiscussion(articleId, callback) {
  ensureFirestore();

  const postsQuery = query(discussionCollection(articleId), orderBy("createdAt", "desc"));
  return onSnapshot(postsQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  });
}

export async function addDiscussionPost(articleId, post) {
  ensureFirestore();

  const postRef = doc(discussionCollection(articleId));
  await setDoc(postRef, {
    author: post.author || "Anonymous Researcher",
    message: post.message,
    createdAt: serverTimestamp()
  });
}

export async function seedFirestoreIndexes(userId) {
  ensureFirestore();

  const batch = writeBatch(db);
  batch.set(
    userDoc(userId),
    {
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
  await batch.commit();
}

export async function clearDiscussionPost(articleId, postId) {
  ensureFirestore();
  await deleteDoc(doc(db, "articles", articleId, "discussionPosts", postId));
}
