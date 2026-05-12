/**
 * Smoke test: enfileira um job narrado pequeno (3 cenas) e aguarda o worker
 * processar até o fim. Imprime progresso em tempo real lendo o Firestore.
 *
 * Uso:
 *   npx tsx scripts/smoke-test.ts
 */

import "dotenv/config";
import { adminDb } from "@/lib/firebase/admin";
import { resolveStoragePath } from "@/lib/storage/local";
import { stat } from "node:fs/promises";

const JOBS = "jobs";

async function main() {
  const params = {
    videoType: "narrated" as const,
    topic: "Três curiosidades surpreendentes sobre o oceano",
    numScenes: 3,
    style: "curiosidades" as const,
    videoFormat: "16:9" as const,
    imageProvider: "pollinations" as const, // grátis, evita custo no smoke
    voice: "Kore",
    burnSubtitles: true,
  };

  console.log("→ enfileirando job de smoke test...");
  const ref = await adminDb.collection(JOBS).add({
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "queued",
    progress: 0,
    progressMsg: "Aguardando worker",
    params,
  });
  const id = ref.id;
  console.log(`✓ job criado: ${id}`);

  let lastPct = -1;
  let lastMsg = "";
  const startedAt = Date.now();

  return new Promise<void>((resolve, reject) => {
    const unsub = adminDb
      .collection(JOBS)
      .doc(id)
      .onSnapshot(
        async (snap) => {
          if (!snap.exists) return;
          const data = snap.data()!;
          const pct = data.progress ?? 0;
          const msg = data.progressMsg ?? "";

          if (pct !== lastPct || msg !== lastMsg) {
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
            console.log(
              `  [${elapsed.padStart(3)}s] [${String(pct).padStart(5)}%] ${data.status} · ${msg}`,
            );
            lastPct = pct;
            lastMsg = msg;
          }

          if (data.status === "done") {
            console.log("\n✓ Job concluído!");
            console.log(`  title:     ${data.title}`);
            console.log(`  videoPath: ${data.videoPath}`);
            console.log(`  videoUrl:  ${data.videoUrl}`);
            try {
              const abs = resolveStoragePath(data.videoPath);
              const s = await stat(abs);
              console.log(`  arquivo:   ${abs} (${(s.size / 1024 / 1024).toFixed(2)} MB)`);
            } catch (err) {
              console.log(`  ⚠ não conseguiu localizar o MP4: ${(err as Error).message}`);
            }
            unsub();
            resolve();
          } else if (data.status === "failed") {
            console.log("\n✗ Job falhou:");
            console.log(data.error);
            unsub();
            reject(new Error("job failed"));
          }
        },
        reject,
      );
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
