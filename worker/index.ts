/**
 * Worker local do Tomada.
 *
 * - Faz polling no Firestore por jobs em status "queued".
 * - Pega 1 job por vez (FIFO), marca como "running" via transação.
 * - Roda o pipeline TS, atualizando progresso no documento.
 * - Move o MP4 final para output/<jobId>/video.mp4 e gera thumbnail.
 * - Em caso de erro, marca como "failed" com traceback.
 */

import "dotenv/config";
import { adminDb } from "@/lib/firebase/admin";
import { runPipeline } from "@/lib/pipeline/pipeline";
import type { Job, JobParams } from "@/lib/types/jobs";
import {
  uploadFile,
  healthCheck as storageHealthCheck,
  resolveStoragePath,
} from "@/lib/storage/local";
import { mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { sleep } from "@/lib/utils/time";
import { spawn } from "node:child_process";

const JOBS_COLLECTION = "jobs";
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

async function generateThumbnail(videoPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), [
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-ss",
      "0.5",
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outPath,
    ]);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg thumbnail: ${stderr}`));
    });
  });
}

/**
 * Reagenda jobs em "running" para "queued" — recuperação após crash do worker.
 */
async function rescueOrphans() {
  const orphans = await adminDb
    .collection(JOBS_COLLECTION)
    .where("status", "==", "running")
    .get();
  if (orphans.empty) return;
  const batch = adminDb.batch();
  orphans.docs.forEach((d) => {
    batch.update(d.ref, {
      status: "queued",
      progress: 0,
      progressMsg: "Reagendado após reinício do worker",
      updatedAt: Date.now(),
    });
  });
  await batch.commit();
  console.log(`[worker] reagendou ${orphans.size} job(s) órfãos`);
}

/**
 * Pega o próximo job em "queued" e transiciona para "running" atomicamente.
 */
async function claimNextJob(): Promise<Job | null> {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(
      adminDb
        .collection(JOBS_COLLECTION)
        .where("status", "==", "queued")
        .orderBy("createdAt", "asc")
        .limit(1),
    );
    if (snap.empty) return null;
    const docSnap = snap.docs[0]!;
    const data = docSnap.data();
    tx.update(docSnap.ref, {
      status: "running",
      updatedAt: Date.now(),
      progressMsg: "Worker iniciou o job",
    });
    return {
      id: docSnap.id,
      createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
      updatedAt: Date.now(),
      status: "running",
      progress: 0,
      progressMsg: "",
      params: data.params as JobParams,
      result: data.result,
      title: data.title,
    };
  });
}

async function updateProgress(jobId: string, pct: number, msg: string) {
  await adminDb.collection(JOBS_COLLECTION).doc(jobId).update({
    progress: pct,
    progressMsg: msg,
    updatedAt: Date.now(),
  });
}

async function markDone(jobId: string, payload: Record<string, unknown>) {
  await adminDb
    .collection(JOBS_COLLECTION)
    .doc(jobId)
    .update({
      status: "done",
      progress: 100,
      progressMsg: "Concluído",
      updatedAt: Date.now(),
      ...payload,
    });
}

async function markFailed(jobId: string, err: unknown) {
  const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  await adminDb.collection(JOBS_COLLECTION).doc(jobId).update({
    status: "failed",
    error: message,
    updatedAt: Date.now(),
  });
}

/**
 * Os assets enviados via Server Action já ficam em uploads/<kind>/...
 * Aqui apenas convertemos para path absoluto antes de passar para o pipeline.
 */
function materializeFashionInputs(params: JobParams): JobParams {
  if (params.videoType !== "fashion") return params;
  return {
    ...params,
    modelImagePath: resolveStoragePath(params.modelImagePath),
    outfitImagePaths: params.outfitImagePaths.map((p) => resolveStoragePath(p)),
    bgmPath: params.bgmPath ? resolveStoragePath(params.bgmPath) : undefined,
  };
}

async function processJob(job: Job) {
  console.log(`[worker] ▶ job ${job.id} (${job.params.videoType})`);

  const materializedParams = materializeFashionInputs(job.params);
  const jobWithInputs = { ...job, params: materializedParams };

  const result = await runPipeline(jobWithInputs, async (msg, pct) => {
    await updateProgress(job.id, pct, msg);
  });

  await updateProgress(job.id, 99, "Finalizando...");

  // Move o MP4 do output/ raiz para output/<jobId>/video.mp4 (storagePath canônico)
  const ext = extname(result.videoPath) || ".mp4";
  const videoStoragePath = `output/${job.id}/video${ext}`;
  const { publicUrl } = await uploadFile(result.videoPath, videoStoragePath, "video/mp4");

  // Thumbnail
  let thumbUrl: string | undefined;
  try {
    const thumbLocal = join(tmpdir(), `tomada_thumb_${job.id}.jpg`);
    await generateThumbnail(result.videoPath, thumbLocal);
    const thumbStorage = `output/${job.id}/thumbnail.jpg`;
    const thumb = await uploadFile(thumbLocal, thumbStorage, "image/jpeg");
    thumbUrl = thumb.publicUrl;
  } catch (err) {
    console.warn(`[worker] thumbnail falhou (não crítico): ${(err as Error).message}`);
  }

  await markDone(job.id, {
    title: result.title,
    videoPath: videoStoragePath,
    videoUrl: publicUrl,
    thumbnailUrl: thumbUrl,
    result: {
      ...result,
      videoPath: videoStoragePath,
      videoUrl: publicUrl,
    },
  });
  console.log(`[worker] ✓ job ${job.id} concluído`);
}

async function loop() {
  try {
    const job = await claimNextJob();
    if (!job) {
      await sleep(POLL_MS);
      return;
    }
    try {
      await processJob(job);
    } catch (err) {
      console.error(`[worker] ✗ job ${job.id} falhou:`, err);
      await markFailed(job.id, err);
    }
  } catch (err) {
    console.error("[worker] erro no loop:", err);
    await sleep(2000);
  }
}

async function main() {
  const health = await storageHealthCheck();
  if (!health.ok) {
    console.error(`[worker] storage local indisponível: ${health.error}`);
    process.exit(1);
  }
  await mkdir(process.env.WORKER_CACHE_DIR || "./cache", { recursive: true });

  console.log(`[worker] storage: filesystem local (./output, ./uploads)`);
  console.log(`[worker] poll: ${POLL_MS}ms`);

  await rescueOrphans();

  // Loop infinito
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await loop();
  }
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
