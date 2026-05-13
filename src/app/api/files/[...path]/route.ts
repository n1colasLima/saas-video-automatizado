import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolveStoragePath } from "@/lib/storage/local";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

function nodeToWeb(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(nodeStream as Readable) as unknown as ReadableStream<Uint8Array>;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const storagePath = path.join("/");

  let absPath: string;
  try {
    absPath = resolveStoragePath(storagePath);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  let fileStat;
  try {
    fileStat = await stat(absPath);
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  if (!fileStat.isFile()) {
    return NextResponse.json({ error: "Não é um arquivo" }, { status: 400 });
  }

  const total = fileStat.size;
  const contentType = mimeFor(absPath);
  const range = request.headers.get("range");

  // Range request — essencial pro <video controls> fazer seek
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new NextResponse("Range inválido", { status: 416 });
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : total - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
      return new NextResponse("Range fora dos limites", {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    const chunkLen = end - start + 1;
    const stream = createReadStream(absPath, { start, end });
    return new NextResponse(nodeToWeb(stream), {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(chunkLen),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Resposta normal — stream completo
  const stream = createReadStream(absPath);
  return new NextResponse(nodeToWeb(stream), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
