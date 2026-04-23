import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let auth = null;
let db = null;
let googleProvider = null;

if (firebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
}

export async function signInWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error("Firebase is not configured.");
  }

  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signInWithEmail(email, password) {
  if (!auth) {
    throw new Error("Firebase is not configured.");
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function registerWithEmail({ name, email, password }) {
  if (!auth) {
    throw new Error("Firebase is not configured.");
  }

  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (name?.trim()) {
    await updateProfile(credential.user, {
      displayName: name.trim()
    });
  }

  return credential.user;
}

export async function signOutUser() {
  if (!auth) {
    throw new Error("Firebase is not configured.");
  }

  await signOut(auth);
}

export function watchAuthState(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export { auth, db, firebaseConfigured };
