import "server-only";
import { mkdir, copyFile, stat, access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

const ROOT = process.cwd();
const ALLOWED_PREFIXES = ["output", "uploads", "cache"];

export function resolveStoragePath(p: string): string {
  if (!p) throw new Error("storagePath vazio");
  if (isAbsolute(p)) return p;
  return resolve(ROOT, p);
}

export function isPathAllowed(p: string): boolean {
  const abs = resolveStoragePath(p);
  const rel = abs.startsWith(ROOT + sep) ? abs.slice(ROOT.length + 1) : abs;
  const first = rel.split(sep)[0];
  return ALLOWED_PREFIXES.includes(first);
}

export async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

export interface UploadResult {
  storagePath: string;
  publicUrl: string;
  absPath: string;
}

export async function uploadFile(
  sourceAbsPath: string,
  storagePath: string,
  _contentType?: string,
): Promise<UploadResult> {
  const dest = resolveStoragePath(storagePath);
  await ensureDir(dirname(dest));
  await copyFile(sourceAbsPath, dest);
  return {
    storagePath,
    publicUrl: `/api/files/${storagePath.replace(/^\/+/, "")}`,
    absPath: dest,
  };
}

export async function healthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    for (const dir of ALLOWED_PREFIXES) {
      const abs = resolve(ROOT, dir);
      await mkdir(abs, { recursive: true });
      await access(abs, constants.W_OK);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function statSafe(absPath: string) {
  try {
    return await stat(absPath);
  } catch {
    return null;
  }
}

export function joinUploads(...parts: string[]): string {
  return join("uploads", ...parts);
}
