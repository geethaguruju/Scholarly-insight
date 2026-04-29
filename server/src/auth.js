import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  console.warn("FIREBASE_PROJECT_ID is not defined in server/.env, Firebase Admin is disabled.");
} else {
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  initializeApp({ projectId });
}

export async function verifyFirebaseToken(req, res, next) {
  if (!projectId) {
    return res.status(500).json({ error: "Firebase Admin is not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing Authorization header" });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}
