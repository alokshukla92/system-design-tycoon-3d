// Lesson / scene data model — mirrors reverse-engineering/11-lesson-authoring-schema.md §1–§4 exactly.
// Lessons are plain JSON. Each step holds a complete scene snapshot; the engine diffs by id.

import type { IconName } from "../icons";

// ── Course structure ─────────────────────────────────────────────────────────
export type ModuleColor = "sand" | "green" | "violet" | "orange" | "blue" | "teal" | "rose" | "olive" | "slate";

export interface LessonRef {
  id: string;
  title: string;
}

export interface Module {
  id: string;
  num: string; // "01"
  part: string; // Part id
  title: string;
  color: ModuleColor;
  lessons: LessonRef[];
}

export type Course = Module[];

export interface Part {
  id: string;
  title: string;
}

/** Flattened lesson ref (doc 11 §1: derived at runtime). index is 1-based within its module. */
export interface FlatLessonRef extends LessonRef {
  module: Module;
  index: number;
  of: number;
}

// ── Lesson ───────────────────────────────────────────────────────────────────
export type Level = "beginner" | "intermediate" | "advanced";
export type Chapter = "setup" | "problem" | "solution" | "technique" | "tradeoff" | "insight" | "recap";
export type CalloutKind = "warn" | "tip" | "insight" | "next";

export type LegendKey =
  | "req" | "res" | "slow" | "queue" | "heavy" | "mine" | "write" | "kill" | "msg"
  | "poison" | "push" | "empty" | "retry" | "telemetry" | "attack" | "ping" | "fail";

export type MetricValue = number | string | null;

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: Level;
  metrics: string[]; // keys of the metric registry (content/metrics.ts)
  legend: (LegendKey | [LegendKey, string])[];
  goals: { text: string; step: number }[]; // step is 0-based
  steps: Step[];
}

export interface Step {
  short: string;
  chapter: Chapter;
  title: string;
  body: string[]; // HTML
  callout?: { kind: CalloutKind; text: string };
  changes?: string[]; // 2-char prefix: "+ ", "- "/"− ", "~ "
  metrics: Record<string, MetricValue>;
  scene: Scene;
  /** Original architecture for "Open in Design Lab" (absent → no button). */
  lab?: StepLab;
}

/** Source-lesson graph: ComponentKind ids (src/lab/sim/types) + traffic, converted from lessons.ts. */
export interface StepLab {
  users: number;
  rps: number;
  nodes: { id: string; kind: string; label: string; sub?: string; status?: "warn" | "crit" | "muted" }[];
  edges: { from: string; to: string }[];
}

// ── Scene ────────────────────────────────────────────────────────────────────
export interface Scene {
  entities: Record<string, Entity>;
  links?: Record<string, Link>;
  flows?: Flow[];
}

export type BlockColor = "orange" | "green" | "blue" | "yellow" | "purple" | "slab" | "store";
export type Tone = "paper" | "red" | "green" | "amber" | "violet" | "gray";
export interface Tag {
  text: string;
  tone?: Tone;
  icon?: IconName;
}

interface EntityBase {
  opacity?: number;
  lift?: number;
}

export interface Block extends EntityBase {
  type: "block";
  x: number;
  y: number;
  s?: number;
  h?: number;
  radius?: number;
  color?: BlockColor;
  glyph?: "server" | "balancer" | IconName | "";
  label?: string[];
  sub?: string;
  heat?: number;
  dead?: number;
  dim?: number;
  cpu?: number;
  tags?: Tag[];
  pills?: "above" | "below";
}

export interface Crowd extends EntityBase {
  type: "crowd";
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  count?: number;
  label?: string;
}

export interface Ghost extends EntityBase {
  type: "ghost";
  x: number;
  y: number;
  s?: number;
  h?: number;
  label?: string;
}

export interface Device extends EntityBase {
  type: "device";
  x: number;
  y: number;
  w?: number;
  d?: number;
  form?: "laptop" | "phone";
  label?: string;
  tags?: Tag[];
}

export interface Db extends EntityBase {
  type: "db";
  x: number;
  y: number;
  r?: number;
  h?: number;
  glyph?: IconName;
  label?: string;
  tags?: Tag[];
  heat?: number;
  cpu?: number;
}

export interface Zone extends EntityBase {
  type: "zone";
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  label?: string;
}

export interface Queue extends EntityBase {
  type: "queue";
  x: number;
  y: number;
  n?: number;
  gap?: number;
  dir?: [number, number];
  color?: string;
}

export type PanelBarTone = "green" | "amber" | "red" | "gray" | "violet" | "blue";
export interface PanelBar {
  label: string;
  note?: string;
  from?: number;
  to?: number;
  tone?: PanelBarTone;
  bold?: boolean;
}

export interface Panel extends EntityBase {
  type: "panel";
  title?: string;
  icon?: IconName;
  lines?: string[]; // prefixes "= ", "! ", "# "; inline **bold**
  chart?: "hockey" | "bars" | null;
  marker?: number;
  bars?: PanelBar[];
  w?: number;
  x?: number;
  y?: number;
  z?: number;
  dx?: number;
  dy?: number;
}

export interface Ring extends EntityBase {
  type: "ring";
  x: number;
  y: number;
  r?: number;
  nodes?: { a: number; color: BlockColor; mark?: boolean }[];
  keys?: number[];
  moved?: number[];
  label?: string;
}

export type Entity = Block | Crowd | Ghost | Device | Db | Zone | Queue | Panel | Ring;
export type EntityType = Entity["type"];

// ── Links ────────────────────────────────────────────────────────────────────
export type PointRef = string | [number | string, number | string];
export type LinkStyle = "solid" | "dashed" | "off" | "beat" | "cut";

export interface Link {
  from: string;
  to?: string;
  pts: PointRef[];
  heads?: "end" | "both" | "none";
  label?: string;
  labelAt?: number;
  labelTone?: Tone;
  style?: LinkStyle;
  fail?: number;
}

// ── Flows / packets ─────────────────────────────────────────────────────────
export type PacketKind =
  | "req" | "slow" | "heavy" | "ping" | "kill" | "write" | "msg" | "poison" | "push" | "empty" | "mine";
export type RouteStep = string | string[];

interface FlowBase {
  rate: number;
  speed?: number;
  kind?: PacketKind;
  pattern?: PacketKind[];
  bounce?: boolean;
  hold?: number;
}
export interface RouteFlow extends FlowBase {
  route: RouteStep[];
  pick?: "weights";
  weights?: number[];
}
export interface RoutesFlow extends FlowBase {
  routes: { path: string[]; kind?: PacketKind; weight?: number }[];
  pick?: "weights";
  fanout?: boolean;
}
export type Flow = RouteFlow | RoutesFlow;
