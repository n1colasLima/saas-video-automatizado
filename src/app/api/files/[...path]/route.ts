import { NextResponse, type NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { extname } from "node:path";
import { Readable } from "node:stream";

import { isPathAllowed, resolveStoragePath, statSafe } from "@/lib/storage/local";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".srt": "text/plain; charset=utf-8",
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const storagePath = path.join("/");
  if (!isPathAllowed(storagePath)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const abs = resolveStoragePath(storagePath);
  const stats = await statSafe(abs);
  if (!stats || !stats.isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const mime = MIME[extname(abs).toLowerCase()] || "application/octet-stream";
  const size = stats.size;
  const range = req.headers.get("range");

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : size - 1;
      const chunkSize = end - start + 1;
      const stream = createReadStream(abs, { start, end });
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": mime,
          "Cache-Control": "no-cache",
        },
      });
    }
  }

  const stream = createReadStream(abs);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(size),
      "Content-Type": mime,
      "Cache-Control": "no-cache",
    },
  });
}
