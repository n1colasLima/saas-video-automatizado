export type JobStatus = "queued" | "running" | "done" | "failed";

export type VideoFormat = "16:9" | "9:16";
export type ImageProvider = "gemini" | "pollinations";
export type NarratedStyle =
  | "curiosidades"
  | "misterios"
  | "historia"
  | "ciencia"
  | "tops";

export interface NarratedJobParams {
  videoType: "narrated";
  topic: string;
  style: NarratedStyle;
  videoFormat: VideoFormat;
  imageProvider: ImageProvider;
  voice: string;
  numScenes: number;
  burnSubtitles: boolean;
  referenceUrl?: string;
}

export interface FashionJobParams {
  videoType: "fashion";
  modelImagePath: string;
  outfitImagePaths: string[];
  sceneIdea: string;
  numShots: number;
  shotDuration: number;
  bgmPath?: string;
  title?: string;
}

export type JobParams = NarratedJobParams | FashionJobParams;

export interface JobResult {
  title?: string;
  videoPath?: string;
  videoUrl?: string;
  [k: string]: unknown;
}

export interface Job {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  progress: number;
  progressMsg: string;
  params: JobParams;
  title?: string;
  videoPath?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  result?: JobResult;
}
