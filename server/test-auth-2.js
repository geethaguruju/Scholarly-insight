import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
process.env.GOOGLE_CLOUD_PROJECT = "scholarly-insight-leetco-b6a46";
initializeApp({ projectId: "scholarly-insight-leetco-b6a46" });

async function run() {
  try {
    const header = Buffer.from(JSON.stringify({alg:"RS256",kid:"abc"})).toString('base64');
    const payload = Buffer.from(JSON.stringify({aud:"scholarly-insight-leetco-b6a46",exp:2000000000})).toString('base64');
    const token = header + "." + payload + ".signature";
    console.log("Verifying token...");
    await getAuth().verifyIdToken(token);
  } catch (e) {
    console.error("Caught error:", e);
  }
}
run();
