export const ARTIFACT_SLOTS = ["story", "hook", "delivery", "plan", "board", "video"] as const;
export type ArtifactSlot = typeof ARTIFACT_SLOTS[number];

export type CharacterCanon = {
  id: string;
  role: "primary_subject" | "supporting_subject";
  kind: string;
  identityReferenceId: string;
  visibleTraits: string[];
  voice?: string;
};

export type ReferenceCanon = {
  id: string;
  path: string;
  characterIds: string[];
};

export type SubjectCanon = {
  createdAt: string;
  characters: CharacterCanon[];
  references: ReferenceCanon[];
  continuity: string[];
};

export type ProductionPlan = {
  title: string;
  durationSeconds: number;
  aspectRatio: "9:16";
  voiceProfiles: Array<{ speaker: string; voice: string }>;
  continuity: string;
  music: string;
  shots: Array<{
    id: string;
    startSeconds: number;
    endSeconds: number;
    storyEvent: string;
    frame: string;
    action: string;
    camera: string;
    sound: string;
    spokenLines: Array<{ speaker: string; line: string; performance: string }>;
    onScreenText: string;
    subjects: Array<{ characterId: string; wardrobe: string; pose: string; relation: string }>;
  }>;
};

export type VideoArtifact = {
  id: string;
  slot: ArtifactSlot;
  version: number;
  path: string;
  content: string;
  inputArtifactIds: string[];
  skill?: string;
  mediaIds?: string[];
  createdAt: string;
};

export type MediaRecord = {
  id: string;
  kind: "reference" | "frame" | "video";
  path: string;
  parentMediaId?: string;
  createdAt: string;
};

export type SessionTrace = {
  id: string;
  owner: "director" | "session" | "visual" | "tool";
  operation: string;
  status: "running" | "accepted" | "rejected" | "failed";
  inputArtifactIds: string[];
  outputArtifactId?: string;
  models: string[];
  reason?: string;
  startedAt: string;
  completedAt?: string;
};

export type SpendGrant = {
  id: string;
  purpose: "seedance";
  status: "available" | "consumed";
  createdAt: string;
  consumedAt?: string;
};

export type VideoProject = {
  id: string;
  outputDir: string;
  sourcePath: string;
  request: { text: string; createdAt: string };
  canon?: SubjectCanon;
  artifacts: VideoArtifact[];
  current: Partial<Record<ArtifactSlot, string>>;
  media: MediaRecord[];
  traces: SessionTrace[];
  spendGrants: SpendGrant[];
  imageBudget: { limit: number; used: number };
};
