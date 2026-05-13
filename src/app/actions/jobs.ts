"use server";

import { adminDb } from "@/lib/firebase/admin";
import { uploadBuffer } from "@/lib/storage/local";
import type { FashionJobParams, NarratedJobParams } from "@/lib/types/jobs";
import { randomBytes } from "node:crypto";

const JOBS_COLLECTION = "jobs";

export async function enqueueNarrated(params: NarratedJobParams): Promise<string> {
  if (!params.topic.trim()) throw new Error("Informe um tema");
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");

  const docRef = await adminDb.collection(JOBS_COLLECTION).add({
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "queued",
    progress: 0,
    progressMsg: "Aguardando worker",
    params,
  });
  return docRef.id;
}

interface UploadedFile {
  storagePath: string;
}

export async function uploadFashionAsset(
  formData: FormData,
): Promise<UploadedFile> {
  const file = formData.get("file") as File | null;
  const kind = formData.get("kind") as string | null;
  if (!file) throw new Error("Arquivo ausente");
  if (!kind) throw new Error("Tipo (kind) ausente");
  if (!/^[a-z0-9_-]+$/.test(kind)) throw new Error("Kind inválido");

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "bin";
  const id = randomBytes(8).toString("hex");
  const storagePath = `uploads/${kind}/${Date.now()}_${id}.${safeExt}`;

  const buf = Buffer.from(await file.arrayBuffer());
  await uploadBuffer(buf, storagePath, file.type || "application/octet-stream");
  return { storagePath };
}

export async function enqueueFashion(params: FashionJobParams): Promise<string> {
  if (!params.modelImagePath) throw new Error("Foto da modelo ausente");
  if (!params.outfitImagePaths || params.outfitImagePaths.length === 0) {
    throw new Error("Ao menos uma foto da roupa é necessária");
  }
  if (!params.sceneIdea.trim()) throw new Error("Descreva o cenário");
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");

  const docRef = await adminDb.collection(JOBS_COLLECTION).add({
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "queued",
    progress: 0,
    progressMsg: "Aguardando worker",
    params,
  });
  return docRef.id;
}
