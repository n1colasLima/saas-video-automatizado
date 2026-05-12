"use server";

import { adminDb } from "@/lib/firebase/admin";
import { joinUploads, resolveStoragePath, ensureDir } from "@/lib/storage/local";
import type {
  FashionJobParams,
  NarratedJobParams,
} from "@/lib/types/jobs";
import { writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { randomUUID } from "node:crypto";

const JOBS = "jobs";

function deriveTitle(params: NarratedJobParams | FashionJobParams): string {
  if (params.videoType === "narrated") return params.topic.slice(0, 80);
  return (
    params.title?.trim() ||
    `Fashion · ${params.sceneIdea.slice(0, 40)}`
  );
}

export async function enqueueNarratedJob(
  params: NarratedJobParams,
): Promise<{ id: string }> {
  if (!params.topic?.trim()) throw new Error("Informe um tema.");
  const now = Date.now();
  const ref = await adminDb.collection(JOBS).add({
    createdAt: now,
    updatedAt: now,
    status: "queued",
    progress: 0,
    progressMsg: "Aguardando worker",
    title: deriveTitle(params),
    params,
  });
  return { id: ref.id };
}

async function persistUpload(
  file: File,
  kind: "models" | "outfits" | "bgm",
): Promise<string> {
  const ext = extname(file.name) || "";
  const safeBase = randomUUID();
  const storagePath = joinUploads(kind, `${safeBase}${ext}`).replaceAll("\\", "/");
  const abs = resolveStoragePath(storagePath);
  await ensureDir(dirname(abs));
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buf);
  return storagePath;
}

export interface FashionFormPayload {
  modelFile: File;
  outfitFiles: File[];
  bgmFile?: File | null;
  sceneIdea: string;
  numShots: number;
  shotDuration: number;
  title?: string;
}

export async function enqueueFashionJob(
  payload: FashionFormPayload,
): Promise<{ id: string }> {
  if (!payload.modelFile) throw new Error("Envie a foto da modelo.");
  if (!payload.outfitFiles?.length)
    throw new Error("Envie ao menos uma foto da roupa.");
  if (!payload.sceneIdea?.trim()) throw new Error("Descreva o cenário.");

  const modelImagePath = await persistUpload(payload.modelFile, "models");
  const outfitImagePaths: string[] = [];
  for (const f of payload.outfitFiles.slice(0, 5)) {
    outfitImagePaths.push(await persistUpload(f, "outfits"));
  }
  const bgmPath = payload.bgmFile
    ? await persistUpload(payload.bgmFile, "bgm")
    : undefined;

  const params: FashionJobParams = {
    videoType: "fashion",
    modelImagePath,
    outfitImagePaths,
    bgmPath,
    sceneIdea: payload.sceneIdea.trim(),
    numShots: Math.round(payload.numShots),
    shotDuration: Number(payload.shotDuration),
    title: payload.title?.trim() || undefined,
  };

  const now = Date.now();
  const ref = await adminDb.collection(JOBS).add({
    createdAt: now,
    updatedAt: now,
    status: "queued",
    progress: 0,
    progressMsg: "Aguardando worker",
    title: deriveTitle(params),
    params,
  });
  return { id: ref.id };
}

export async function enqueueFashionFromForm(form: FormData): Promise<{ id: string }> {
  const modelFile = form.get("modelFile") as File | null;
  const outfits = form.getAll("outfitFiles").filter((v): v is File => v instanceof File);
  const bgm = form.get("bgmFile") as File | null;
  const sceneIdea = String(form.get("sceneIdea") ?? "");
  const numShots = Number(form.get("numShots") ?? 6);
  const shotDuration = Number(form.get("shotDuration") ?? 2.2);
  const title = String(form.get("title") ?? "");
  if (!modelFile) throw new Error("Envie a foto da modelo.");
  return enqueueFashionJob({
    modelFile,
    outfitFiles: outfits,
    bgmFile: bgm,
    sceneIdea,
    numShots,
    shotDuration,
    title,
  });
}
