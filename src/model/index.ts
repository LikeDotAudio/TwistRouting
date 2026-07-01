// src/model — the typed domain shapes the app reads.
//
// These are the real-TS form of the contracts that the legacy app kept only in
// comments (see docs/TYPESCRIPT-WASM-REPORT.md §A.2). Every layer above depends
// on these and nothing else for "what the data looks like".

export type Hex = `#${string}`;

/** A source/device is faulted when status is set and isn't "OK". */
export type Status = 'OK' | (string & {});

// ---- Sources (Routes/Sources/**) -------------------------------------------

export interface StageBox {
  id: string;
  name: string;
  prefix: string;
  count: number;
  extraClass: string;
  color?: Hex;
  floor?: string;
  level?: number;
  items?: string[];        // audio: explicit channel labels
  status?: Status;
}

export interface Production {
  id: string;
  name: string;
  color?: Hex;
  parentName?: string;
  status?: Status;
  outputs?: { video?: string[]; audio?: string[]; intercom?: string[] };
  twists?: Array<string | TwistConfig>;
}

// ---- Source leaves (the *.json under Routes/Sources/**) ----------------------
// The ingress panel infers a renderer from the SHAPE of each leaf (see
// inferPoolKind): a StageBox (video/audio), a playout (players[]), a production
// (outputs{}/boxes[]), or a stream set (streams[]). One permissive shape covers
// all of them so discovery can stay untyped-at-the-edge and narrow on read.

/** One embedded video in a playout player: a video feed + its audio stack. */
export interface PlayoutVideo {
  id: string;
  name: string;
  stack?: { video?: string; audio?: string[] };
}
export interface PlayoutPlayer {
  id: string;
  name: string;
  videos?: PlayoutVideo[];
}

/** A production source box: a video feed with embedded audio + control feeds. */
export interface ProductionBox {
  name: string;
  video?: boolean;
  audio?: string[];
  control?: string[];
}

/** One YouTube/stream source: a URL carrying a picture + stereo L/R pair. */
export interface StreamDef {
  id: string;
  name: string;
  url?: string;
  left?: string;
  right?: string;
}

/** The permissive union every Sources/** leaf conforms to. */
export interface SourceLeaf {
  id: string;
  name: string;
  color?: Hex;
  status?: Status;
  origin?: string;
  // stage box (video/audio)
  prefix?: string;
  count?: number;
  extraClass?: string;
  items?: string[];
  // playout
  players?: PlayoutPlayer[];
  // production
  outputs?: { video?: string[]; audio?: string[]; intercom?: string[] };
  boxes?: ProductionBox[];
  // streams
  streams?: StreamDef[];
}

// ---- Destinations & twists (Routes/Destinations/**) -------------------------

export type Accepts = 'video' | 'audio' | 'both' | 'camera';

export interface TwistConfig {
  name: string;
  accepts?: Accepts;
  inputs?: string[];
  monitor?: boolean;
  row?: string;
  maxVideo?: number;
  maxAudio?: number;
  cameraInput?: boolean;   // "CAM N" twists fed into a destination
}

/** A folder manifest (index.json): entries ending "/" are directories. */
export type Manifest = string[];

export type PoolKind = 'video' | 'audio' | 'playout' | 'productions' | 'streams';

// ---- Access / capabilities (legacy js/auth.js) ------------------------------

export type Capability =
  | 'admin' | 'switch' | 'route' | 'signal' | 'shade'
  | 'gfx' | 'comms' | 'audio' | 'book' | 'view';

export interface Role {
  id: string;
  name: string;
  sub?: string;
  tier: string;
  color: Hex;
  task: string;
  caps: Partial<Record<Capability, 1>>;
}
