import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (inline) {
    return JSON.parse(inline);
  }
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH ?? "./serviceAccountKey.json";
  const resolved = resolve(process.cwd(), path);
  const raw = readFileSync(resolved, "utf8");
  return JSON.parse(raw);
}

function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!;
  const serviceAccount = loadServiceAccount();
  return initializeApp({ credential: cert(serviceAccount) });
}

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
