import "server-only";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try {
      return JSON.parse(raw) as ServiceAccount;
    } catch {
      // fallthrough to file
    }
  }
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || "./serviceAccountKey.json";
  const abs = resolve(process.cwd(), path);
  const json = readFileSync(abs, "utf-8");
  return JSON.parse(json) as ServiceAccount;
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}

export const adminDb = getFirestore();
