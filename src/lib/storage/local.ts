import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

/**
 * Storage local. Substitui R2/Firebase Storage por filesystem.
 *
 * Layout:
 *   ./output/<jobId>/video.mp4         — vídeo final
 *   ./output/<jobId>/thumbnail.jpg     — thumbnail
 *   ./uploads/<kind>/<id>.<ext>        — uploads de assets do modo fashion
 *
 * URLs públicas: /api/files/<storagePath>  (servido por src/app/api/files/[...path]/route.ts).
 */

export function getOutputRoot(): string {
  return resolve(process.cwd(), "./output");
}

export function getUploadsRoot(): string {
  return resolve(process.cwd(), "./uploads");
}

/**
 * Resolve um "storagePath" lógico para o path absoluto do disco.
 *
 * storagePath é separado por "/" e sempre relativo às raízes acima.
 * Prefixo "output/..." ou "uploads/..." define o root.
 *
 * Throws se a resolução cair fora dos roots permitidos (path traversal).
 */
export function resolveStoragePath(storagePath: string): string {
  if (!storagePath || storagePath.includes("..") || isAbsolute(storagePath)) {
    throw new Error(`storagePath inválido: ${storagePath}`);
  }
  const norm = normalize(storagePath).replace(/^[\\/]+/, "");
  const [rootName, ...rest] = norm.split(/[\\/]/);
  let root: string;
  if (rootName === "output") root = getOutputRoot();
  else if (rootName === "uploads") root = getUploadsRoot();
  else throw new Error(`storagePath deve começar com output/ ou uploads/: ${storagePath}`);

  const abs = resolve(root, rest.join(sep));
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`storagePath fora do diretório permitido: ${storagePath}`);
  }
  return abs;
}

export function publicUrlForStoragePath(storagePath: string): string {
  const norm = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/api/files/${norm}`;
}

export async function uploadFile(
  localPath: string,
  storagePath: string,
  _contentType: string,
): Promise<{ storagePath: string; publicUrl: string }> {
  const dest = resolveStoragePath(storagePath);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(localPath, dest);
  return { storagePath, publicUrl: publicUrlForStoragePath(storagePath) };
}

export async function uploadBuffer(
  buffer: Buffer,
  storagePath: string,
  _contentType: string,
): Promise<{ storagePath: string; publicUrl: string }> {
  const dest = resolveStoragePath(storagePath);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  return { storagePath, publicUrl: publicUrlForStoragePath(storagePath) };
}

/**
 * No modo local, "download" é apenas resolver o caminho — o arquivo já está em disco.
 * Para compatibilidade com a API antiga (que copiava do storage remoto pro tmp local),
 * mantemos a função e devolvemos o path resolvido.
 */
export async function downloadToFile(storagePath: string, _localPath: string): Promise<void> {
  // No modo local não precisamos copiar — o arquivo já está acessível.
  // Mas mantemos `mkdir` no destino caso o chamador precise.
  await mkdir(dirname(_localPath), { recursive: true });
  const src = resolveStoragePath(storagePath);
  await copyFile(src, _localPath);
}

/**
 * No modo local, "URL assinada" é só a URL pública do /api/files.
 * Mantém a assinatura para compat.
 */
export async function getSignedReadUrl(storagePath: string, _ttlSec?: number): Promise<string> {
  return publicUrlForStoragePath(storagePath);
}

export async function healthCheck(): Promise<{ ok: boolean; error?: string }> {
  try {
    await mkdir(getOutputRoot(), { recursive: true });
    await mkdir(getUploadsRoot(), { recursive: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
