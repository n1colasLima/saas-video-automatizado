"use client";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as limitFn,
  type Unsubscribe,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { getClientDb } from "@/lib/firebase/client";
import type { Job } from "@/lib/types/jobs";

const JOBS = "jobs";

function toJob(id: string, data: Record<string, unknown>): Job {
  return {
    id,
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
    status: (data.status as Job["status"]) ?? "queued",
    progress: Number(data.progress ?? 0),
    progressMsg: String(data.progressMsg ?? ""),
    params: data.params as Job["params"],
    title: data.title as string | undefined,
    videoPath: data.videoPath as string | undefined,
    videoUrl: data.videoUrl as string | undefined,
    thumbnailUrl: data.thumbnailUrl as string | undefined,
    error: data.error as string | undefined,
    result: data.result as Job["result"],
  };
}

export function useJobs(max = 50): { jobs: Job[]; loading: boolean; error: Error | null } {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      setLoading(false);
      setError(new Error("Firebase não configurado (.env.local ausente)"));
      return;
    }
    let unsub: Unsubscribe | null = null;
    try {
      const q = query(
        collection(getClientDb(), JOBS),
        orderBy("createdAt", "desc"),
        limitFn(max),
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const next = snap.docs.map((d) => toJob(d.id, d.data()));
          setJobs(next);
          setLoading(false);
        },
        (err) => {
          setError(err as Error);
          setLoading(false);
        },
      );
    } catch (err) {
      setError(err as Error);
      setLoading(false);
    }
    return () => {
      if (unsub) unsub();
    };
  }, [max]);

  return { jobs, loading, error };
}

export interface QueueMetrics {
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
}

export function deriveMetrics(jobs: Job[]): QueueMetrics {
  const m: QueueMetrics = { total: jobs.length, queued: 0, running: 0, done: 0, failed: 0 };
  for (const j of jobs) {
    if (j.status === "queued") m.queued++;
    else if (j.status === "running") m.running++;
    else if (j.status === "done") m.done++;
    else if (j.status === "failed") m.failed++;
  }
  return m;
}

export function completedVideos(jobs: Job[]): Job[] {
  return jobs.filter((j) => j.status === "done" && j.videoUrl);
}
