import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit as limitFn,
  where,
  addDoc,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./client";
import type { Job, JobParams } from "@/lib/types/jobs";

export const JOBS_COLLECTION = "jobs";

interface JobDoc {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: Job["status"];
  progress: number;
  progressMsg: string;
  params: JobParams;
  result?: Job["result"];
  error?: string;
  videoPath?: string;
  videoUrl?: string;
  title?: string;
}

function toJob(id: string, data: JobDoc): Job {
  return {
    id,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
    status: data.status,
    progress: data.progress ?? 0,
    progressMsg: data.progressMsg ?? "",
    params: data.params,
    result: data.result,
    error: data.error,
    videoPath: data.videoPath,
    videoUrl: data.videoUrl,
    title: data.title,
  };
}

export async function enqueueJob(params: JobParams): Promise<string> {
  const docRef = await addDoc(collection(db, JOBS_COLLECTION), {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: "queued",
    progress: 0,
    progressMsg: "Aguardando worker",
    params,
  });
  return docRef.id;
}

export function subscribeJobs(
  cb: (jobs: Job[]) => void,
  options: { limit?: number; statusFilter?: Job["status"][] } = {},
): () => void {
  const constraints: QueryConstraint[] = [];
  if (options.statusFilter && options.statusFilter.length > 0) {
    constraints.push(where("status", "in", options.statusFilter));
  }
  constraints.push(orderBy("createdAt", "desc"));
  if (options.limit) constraints.push(limitFn(options.limit));
  const q = query(collection(db, JOBS_COLLECTION), ...constraints);
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => toJob(d.id, d.data() as JobDoc)));
  });
}

export function subscribeJob(id: string, cb: (job: Job | null) => void): () => void {
  return onSnapshot(doc(db, JOBS_COLLECTION, id), (snap) => {
    if (!snap.exists()) return cb(null);
    cb(toJob(snap.id, snap.data() as JobDoc));
  });
}
