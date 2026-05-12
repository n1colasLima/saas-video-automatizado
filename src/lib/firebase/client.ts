"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let dbInstance: Firestore | undefined;

export function getClientApp(): FirebaseApp {
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function getClientDb(): Firestore {
  if (!dbInstance) dbInstance = getFirestore(getClientApp());
  return dbInstance;
}
