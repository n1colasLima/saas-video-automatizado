export type JobStatus = "queued" | "running" | "done" | "failed";
export type VideoType = "narrated" | "fashion";
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
  numScenes: number;
  style: NarratedStyle;
  videoFormat: VideoFormat;
  imageProvider: ImageProvider;
  voice: string;
  burnSubtitles: boolean;
  referenceUrl?: string;
}

export interface FashionJobParams {
  videoType: "fashion";
  modelImagePath: string; // Storage path (gs:// resolved)
  outfitImagePaths: string[];
  sceneIdea: string;
  numShots: number;
  shotDuration: number;
  bgmPath?: string;
  title: string;
}

export type JobParams = NarratedJobParams | FashionJobParams;

export interface SceneScript {
  narration: string;
  visual: string;
}

export interface ScriptResult {
  title: string;
  scenes: SceneScript[];
}

export interface ReferenceAnalysis {
  title: string;
  transcript: string;
  narrativeStyle: string;
  visualStyle: string;
  tone: string;
  themes: string[];
  suggestedTopic: string;
}

export interface Job {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  progress: number;
  progressMsg: string;
  params: JobParams;
  result?: JobResult;
  error?: string;
  videoPath?: string;
  videoUrl?: string;
  title?: string;
}

export interface JobResult {
  videoPath: string;
  videoUrl: string;
  title: string;
  videoType: VideoType;
  scenes?: SceneScript[];
  shotPaths?: string[];
  referenceApplied?: boolean;
}
