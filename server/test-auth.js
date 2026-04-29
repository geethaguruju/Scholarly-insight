import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

const projectId = process.env.FIREBASE_PROJECT_ID;
initializeApp({ projectId });

async function run() {
  try {
    console.log("Verifying bad token...");
    await getAuth().verifyIdToken("bad_token");
  } catch (e) {
    console.error("Caught error:", e.message);
  }
}
run();
