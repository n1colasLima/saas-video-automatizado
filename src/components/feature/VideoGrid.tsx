"use client";

import { Play } from "lucide-react";

import { formatDateTime } from "@/lib/utils/time";
import type { Job } from "@/lib/types/jobs";

export function VideoGrid({ jobs }: { jobs: Job[] }) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
      {jobs.map((j) => {
        const url = j.videoUrl ?? "";
        const title = j.title || "Sem título";
        const when = formatDateTime(j.updatedAt);
        const vertical = j.params.videoType === "narrated"
          ? j.params.videoFormat === "9:16"
          : true;
        return (
          <article
            key={j.id}
            className="overflow-hidden rounded-[14px] border border-white/[0.08] bg-[rgba(15,15,35,0.5)] transition-all duration-250 hover:-translate-y-0.5 hover:border-accent/40"
          >
            <div
              className={`flex items-center justify-center bg-black ${
                vertical ? "aspect-[9/16]" : "aspect-video"
              }`}
            >
              {url ? (
                <video
                  src={url}
                  controls
                  preload="metadata"
                  poster={j.thumbnailUrl}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Play className="h-8 w-8 text-ink-deep" />
              )}
            </div>
            <div className="px-4 py-3">
              <div className="truncate text-[14px] font-semibold text-ink">
                {title}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-dim">
                #{j.id.slice(-6)} · {when}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
