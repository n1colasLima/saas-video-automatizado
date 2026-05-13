import { join, resolve } from "node:path";

export function getCacheDir(): string {
  const env = process.env.WORKER_CACHE_DIR;
  return resolve(process.cwd(), env ?? "./cache");
}

export function getOutputDir(): string {
  return resolve(process.cwd(), "./output");
}

export function jobCacheDir(jobId: string): string {
  return join(getCacheDir(), `job_${jobId}`);
}

export function fashionCacheDir(jobId: string): string {
  return join(getCacheDir(), `fashion_${jobId}`);
}

export function ytCacheDir(slug: string): string {
  return join(getCacheDir(), "yt", slug);
}
