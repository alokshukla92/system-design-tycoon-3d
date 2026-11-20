// Graph + live runtime → replica Scene (doc 12 §5 mapping), auto-arranged in BFS layers from the users.
import type { Block, Db, Entity, Flow, Link, PacketKind, Scene, Tag } from "../types/lesson";
import { CATALOG } from "./sim/catalog/components";
import type { ComponentKind, NodeRuntime } from "./sim/types";
import { fmtNum, type LabEdge, type LabNode } from "./model";
import { render, resolve } from "../engine/entities";
import { overlapArea, polyHitsRect } from "../engine/labels";
import { measureText, pillHalfWidth } from "../engine/prims";
import { bboxOf, iso, type Box, type Pt } from "../engine/projection";

/** Iso grid spacing per layer (col → y) and per sibling (row → x), as in the lesson converter. */
export const COL_GAP = 12;
export const ROW_GAP = 9;
/** Wider spacings tried, smallest first, where the defaults would make labels/pills collide. */
const ROW_GAPS = [9, 10.5, 12, 13.5, 15];
const COL_GAPS = [12, 13.5, 15, 16.5, 18, 20, 22];
const MAX_ROUTES = 24;
const MAX_TAGS = 3;

/**
 * Engine-safe entity id for a node. Link points are parsed as `<id>[±offset]`, so an id such as
 * `start-users-0` would read as entity `start-users` offset −0; dashes become `_` (`.` would also clash).
 */
export const entityId = (nodeId: string): string => nodeId.replace(/[^\w]/g, "_");
/** Inverse of entityId over the current graph. */
export const nodeIdOf = (nodes: LabNode[], ent: string | null): string | null => (ent ? (nodes.find((n) => entityId(n.id) === ent)?.id ?? null) : null);

const r1 = (v: number): number => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

type BlockLook = Pick<Block, "s" | "h" | "color" | "glyph">;
const BLOCK: Partial<Record<ComponentKind, BlockLook>> = {
  api_server: { s: 4, color: "blue", glyph: "server" },
  worker: { s: 4, color: "blue", glyph: "server" },
  k8s_cluster: { s: 6, h: 56, color: "blue", glyph: "boxes" },
  load_balancer: { s: 3.4, h: 30, color: "green", glyph: "balancer" },
  cdn: { s: 4, color: "yellow", glyph: "globe" },
  redis: { s: 3.6, color: "orange", glyph: "zap" },
  elasticsearch: { color: "purple", glyph: "search" },
  kafka: { color: "green", glyph: "inbox" },
  rabbitmq: { color: "green", glyph: "inbox" },
  sqs: { color: "green", glyph: "inbox" },
  monitoring: { color: "slab", glyph: "activity" },
};
export const DB_KINDS = new Set<ComponentKind>(["postgres", "mysql", "mongodb", "cassandra", "dynamodb"]);
/** Kinds that show a CPU pill once the simulation produced runtime data. */
const CPU_KINDS = new Set<ComponentKind>(["api_server", "worker", "k8s_cluster", "redis", "elasticsearch", ...DB_KINDS]);
const STATUS_HEAT = { ok: 0, warn: 0.35, crit: 1, down: 0 } as const;

export interface Placement {
  col: number;
  row: number;
  /** Not reachable from any users node: drawn dimmed in an extra lane. */
  detached: boolean;
}

/**
 * Layered layout: col = BFS depth from the users nodes along edges; rows are centred within a layer and
 * ordered by their parents' rows (barycentre) to limit crossings. Unreachable nodes get their own lane.
 */
export function layout(nodes: LabNode[], edges: LabEdge[]): Record<string, Placement> {
  const ids = new Set(nodes.map((n) => n.id));
  const live = edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  const outs = new Map<string, string[]>();
  const ins = new Map<string, string[]>();
  for (const e of live) {
    outs.set(e.source, [...(outs.get(e.source) || []), e.target]);
    ins.set(e.target, [...(ins.get(e.target) || []), e.source]);
  }
  const order = new Map(nodes.map((n, i) => [n.id, i]));

  const bfs = (roots: string[], depth: Map<string, number>, base: number) => {
    const q = roots.filter((r) => !depth.has(r));
    for (const r of q) depth.set(r, base);
    while (q.length) {
      const id = q.shift()!;
      for (const t of outs.get(id) || []) {
        if (depth.has(t)) continue;
        depth.set(t, depth.get(id)! + 1);
        q.push(t);
      }
    }
  };

  const depth = new Map<string, number>();
  bfs(nodes.filter((n) => n.data.kind === "users").map((n) => n.id), depth, 0);
  const reached = new Set(depth.keys());
  // Detached nodes: layer them from their own roots (no incoming edge from other detached nodes).
  const rest = nodes.filter((n) => !reached.has(n.id));
  const restIds = new Set(rest.map((n) => n.id));
  const restRoots = rest.filter((n) => !(ins.get(n.id) || []).some((s) => restIds.has(s))).map((n) => n.id);
  bfs(restRoots.length ? restRoots : rest.map((n) => n.id), depth, 1);
  for (const n of rest) if (!depth.has(n.id)) depth.set(n.id, 1);

  const out: Record<string, Placement> = {};
  const place = (group: LabNode[], laneOffset: number, detached: boolean): number => {
    const byCol = new Map<number, string[]>();
    for (const n of group) {
      const c = depth.get(n.id)!;
      byCol.set(c, [...(byCol.get(c) || []), n.id]);
    }
    let lo = 0;
    let hi = 0;
    for (const c of [...byCol.keys()].sort((a, b) => a - b)) {
      const col = byCol.get(c)!;
      const bary = (id: string) => {
        const ps = (ins.get(id) || []).map((p) => out[p]?.row).filter((v): v is number => v !== undefined);
        return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length - laneOffset : 0;
      };
      col.sort((a, b) => bary(a) - bary(b) || order.get(a)! - order.get(b)!);
      col.forEach((id, i) => {
        const row = i - (col.length - 1) / 2;
        lo = Math.min(lo, row);
        hi = Math.max(hi, row);
        out[id] = { col: c, row: row + laneOffset, detached };
      });
    }
    return hi - lo;
  };
  const main = nodes.filter((n) => reached.has(n.id));
  let maxRow = 0;
  if (main.length) {
    place(main, 0, false);
    maxRow = Math.max(...main.map((n) => out[n.id].row));
  }
  if (rest.length) {
    // Lane offset: below the main graph, leaving one row of air, accounting for the lane's own centring.
    const byCol = new Map<number, number>();
    for (const n of rest) byCol.set(depth.get(n.id)!, (byCol.get(depth.get(n.id)!) || 0) + 1);
    const half = (Math.max(...byCol.values()) - 1) / 2;
    place(rest, main.length ? maxRow + 1.2 + half : 0, true);
  }
  return out;
}

const blockLabel = (label: string): string[] => {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return words.length <= 2 ? words : [words[0], words.slice(1).join(" ")];
};

function tagsFor(n: LabNode, rt: NodeRuntime | undefined): Tag[] {
  const spec = CATALOG[n.data.kind];
  const tags: Tag[] = [];
  if (rt && (rt.status === "down" || rt.crashed)) tags.push({ text: "DOWN", tone: "red", icon: "alert" });
  else if (rt && rt.crashedInstances > 0) tags.push({ text: `${rt.crashedInstances} crashed`, tone: "red", icon: "skull" });
  if (n.data.instances > 1) tags.push({ text: `×${n.data.instances}`, tone: "paper", icon: "layers" });
  const tier = spec.tiers.find((t) => t.id === n.data.tier);
  if (tier && spec.tiers.length > 1 && tier.id !== spec.tiers[0].id) tags.push({ text: tier.label.split(" (")[0], tone: "violet" });
  if (rt && rt.backlog >= 1) tags.push({ text: `${fmtNum(rt.backlog)} queued`, tone: "amber", icon: "inbox" });
  if (rt && rt.replicationLagMs >= 500) tags.push({ text: `lag ${(rt.replicationLagMs / 1000).toFixed(1)}s`, tone: "amber", icon: "timer" });
  if (rt && rt.storagePct >= 0.85) tags.push({ text: `disk ${Math.round(rt.storagePct * 100)}%`, tone: rt.storagePct >= 0.97 ? "red" : "amber", icon: "database" });
  return tags.slice(0, MAX_TAGS);
}

export interface SceneOptions {
  /** Users currently simulated (crowd density); falls back to a small crowd. */
  users?: number;
  /** Total requests/s right now; flows are emitted only when > 0. */
  rps?: number;
  /** Whether packets should flow (simulation running or paused mid-run). */
  live?: boolean;
}

/** Entity for a node at grid position (x, y); `rt` drives heat/cpu/tags. */
function entityFor(n: LabNode, x: number, y: number, rt: NodeRuntime | undefined, detached: boolean, users: number, tags = tagsFor(n, rt)): Entity {
  const kind = n.data.kind;
  if (kind === "users") {
    const count = clamp(Math.round(2 * Math.log10(Math.max(10, users))), 3, 12);
    return { type: "crowd", x0: r1(x - 4), x1: r1(x + 4), y0: r1(y - 3), y1: r1(y + 3), count, label: `${n.data.label} · ${fmtNum(users)}` };
  }
  const down = !!rt && (rt.status === "down" || rt.crashed);
  const heat = rt && !down ? STATUS_HEAT[rt.status] : 0;
  const cpu = rt && !down && CPU_KINDS.has(kind) ? r1(clamp(rt.utilization, 0, 1) * 100) / 100 : -1;
  if (DB_KINDS.has(kind)) {
    const db: Db = { type: "db", x, y, glyph: "database", label: n.data.label, heat, cpu };
    if (tags.length) db.tags = tags;
    if (detached) db.opacity = 0.5;
    return db;
  }
  const block: Block = { type: "block", x, y, ...(BLOCK[kind] || { color: "blue", glyph: "server" }), label: blockLabel(n.data.label), heat, cpu, dead: down ? 1 : 0, dim: detached ? 1 : 0 };
  if (tags.length) block.tags = tags;
  return block;
}

/** Screen-space silhouette and overlay boxes (pill stack, side/under label) of an entity, as drawn by the engine. */
interface Footprint {
  poly: Pt[];
  boxes: Box[];
}

export function footprintOf(e: Entity): Footprint {
  const p = resolve(e);
  const r = render(p);
  const poly = r.poly && r.poly.length > 2 ? r.poly : [[r.bounds[0], r.bounds[1]], [r.bounds[2], r.bounds[1]], [r.bounds[2], r.bounds[3]], [r.bounds[0], r.bounds[3]]] as Pt[];
  const [minX, minY, maxX, maxY] = bboxOf(poly);
  const boxes: Box[] = [];
  const cx = (minX + maxX) / 2;
  const pills = ("cpu" in p && (p.cpu ?? -1) >= 0 ? 1 : 0) + ("tags" in p && p.tags ? p.tags.length : 0);
  if (pills) {
    const half = pillHalfWidth(p as { cpu?: number; tags?: Tag[] }) + 2;
    boxes.push([cx - half, minY - 6 - pills * 26, cx + half, minY + 2]);
  }
  if (p.type === "db" && p.label) {
    const cy = maxY - (maxX - minX) / 4 - p.h * 0.35;
    boxes.push([maxX + 8, cy - 12, maxX + 12 + measureText(p.label, 10.5) + 33, cy + 12]);
  }
  if (p.type === "crowd" && p.label) {
    const [lx, ly] = iso(p.x1, p.y0, 0);
    const w = measureText(p.label, 10.5) + 33;
    boxes.push([lx - w / 2 - 2, ly + 9, lx + w / 2 + 2, ly + 35]);
  }
  return { poly, boxes };
}

const shiftBox = (b: Box, dx: number, dy: number): Box => [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy];
const shiftPoly = (poly: Pt[], dx: number, dy: number): Pt[] => poly.map(([x, y]): Pt => [x + dx, y + dy]);

/** Number of overlapping (silhouette / pill / label) pairs between different entities. */
export function collisions(fps: Footprint[]): number {
  let n = 0;
  for (let i = 0; i < fps.length; i++)
    for (let j = i + 1; j < fps.length; j++) {
      const a = fps[i];
      const b = fps[j];
      for (const ba of a.boxes) {
        for (const bb of b.boxes) if (overlapArea(ba, bb) > 0) n++;
        if (polyHitsRect(b.poly, ba)) n++;
      }
      for (const bb of b.boxes) if (polyHitsRect(a.poly, bb)) n++;
      if (polyHitsRect(a.poly, bboxOf(b.poly)) && polyHitsRect(b.poly, bboxOf(a.poly))) n++;
    }
  return n;
}

/** Pills a node may show while running (cpu + its static tags + one live tag), for spacing decisions. */
function probeEntity(n: LabNode): Entity {
  const rt = CPU_KINDS.has(n.data.kind) ? ({ utilization: 0.5, status: "ok", crashed: false } as NodeRuntime) : undefined;
  const tags = tagsFor(n, undefined);
  if (tags.length < MAX_TAGS) tags.push({ text: "1.2k queued", tone: "amber", icon: "inbox" });
  return entityFor(n, 0, 0, rt, false, 250_000, n.data.kind === "users" ? [] : tags);
}

export interface Spacing {
  /** World y of each layer (col). */
  colY: Record<number, number>;
  /** Sibling spacing (world x per row unit) of each layer. */
  rowGap: Record<number, number>;
}

let spacingCache: { key: string; spacing: Spacing } | null = null;

/**
 * Per-layer spacing: each layer gets the smallest sibling gap whose members don't collide, then the
 * smallest advance from the previous layer that clears everything already placed (silhouettes, pill
 * stacks, side labels). Sparse graphs keep the default COL_GAP × ROW_GAP grid.
 */
export function spacingFor(nodes: LabNode[], at: Record<string, Placement>): Spacing {
  const key = JSON.stringify([nodes.map((n) => [n.id, n.data.kind, n.data.label, n.data.instances, n.data.tier]), at]);
  if (spacingCache?.key === key) return spacingCache.spacing;
  const base = new Map(nodes.map((n) => [n.id, footprintOf(probeEntity(n))]));
  const byCol = new Map<number, string[]>();
  for (const n of nodes) byCol.set(at[n.id].col, [...(byCol.get(at[n.id].col) || []), n.id]);
  const placed: Footprint[] = [];
  const at0 = (id: string, rg: number, y: number): Footprint => {
    const [dx, dy] = iso(at[id].row * rg, y);
    const f = base.get(id)!;
    return { poly: shiftPoly(f.poly, dx, dy), boxes: f.boxes.map((b) => shiftBox(b, dx, dy)) };
  };
  const clashes = (fresh: Footprint[], old: Footprint[]): number => collisions([...old, ...fresh]) - collisions(old);
  const spacing: Spacing = { colY: {}, rowGap: {} };
  let prev: { c: number; y: number } | null = null;
  for (const c of [...byCol.keys()].sort((a, b) => a - b)) {
    const ids = byCol.get(c)!;
    const rg = ROW_GAPS.find((g) => collisions(ids.map((id) => at0(id, g, 0))) === 0) ?? ROW_GAPS[ROW_GAPS.length - 1];
    let y = 0;
    if (prev) {
      const { c: pc, y: py } = prev;
      const gap = COL_GAPS.find((g) => clashes(ids.map((id) => at0(id, rg, py + g * (c - pc))), placed) === 0) ?? COL_GAPS[COL_GAPS.length - 1];
      y = py + gap * (c - pc);
    }
    spacing.colY[c] = y;
    spacing.rowGap[c] = rg;
    placed.push(...ids.map((id) => at0(id, rg, y)));
    prev = { c, y };
  }
  const ys = Object.values(spacing.colY);
  const mid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  for (const c of Object.keys(spacing.colY)) spacing.colY[+c] = r1(spacing.colY[+c] - mid);
  spacingCache = { key, spacing };
  return spacing;
}

export function toScene(nodes: LabNode[], edges: LabEdge[], opts: SceneOptions = {}): Scene {
  const at = layout(nodes, edges);
  const users = opts.users ?? 1000;
  const sp = spacingFor(nodes, at);
  const entities: Record<string, Entity> = {};
  const runtime = (id: string) => nodes.find((n) => n.id === id)?.data.runtime;
  const isDown = (rt: NodeRuntime | undefined) => !!rt && (rt.status === "down" || rt.crashed);

  for (const n of nodes) {
    const p = at[n.id];
    entities[entityId(n.id)] = entityFor(n, r1(p.row * sp.rowGap[p.col]), sp.colY[p.col], n.data.runtime, p.detached, users);
  }

  const links: Record<string, Link> = {};
  const ids = new Set(nodes.map((n) => n.id));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) continue;
    const from = entityId(e.source);
    const to = entityId(e.target);
    const l: Link = { from, to, pts: [from, to], heads: "end" };
    if (isDown(runtime(e.source)) || isDown(runtime(e.target))) l.style = "cut";
    else if (at[e.source].detached) l.style = "dashed";
    const err = runtime(e.target)?.errorRate ?? 0;
    if (err > 0.005 && l.style !== "cut") l.fail = r1(clamp(err, 0.05, 0.8) * 100) / 100;
    links[e.id] = l;
  }

  const flows = opts.live && (opts.rps ?? 0) > 0 ? synthFlows(nodes, edges.filter((e) => links[e.id] && links[e.id].style !== "cut" && !at[e.source].detached), opts.rps!) : [];
  return { entities, links, flows };
}

export const rateFor = (rps: number): number => r1(clamp(0.6 + 0.5 * Math.log10(Math.max(1, rps)), 0.6, 3));

/**
 * Doc 12 §5.5 flow synthesis, path-exact: one flow per users node. Traffic splits evenly between
 * different roles (target kinds) and evenly across same-kind siblings; slow packets end on hot nodes.
 */
export function synthFlows(nodes: LabNode[], active: LabEdge[], rps: number): Flow[] {
  const kindOf = new Map(nodes.map((n) => [n.id, n.data.kind]));
  const statusOf = (id: string) => nodes.find((n) => n.id === id)?.data.runtime?.status ?? "ok";
  const out = (id: string) => active.filter((e) => e.source === id);
  const sources = nodes.filter((n) => n.data.kind === "users" && out(n.id).length).map((n) => n.id);

  type Path = { path: string[]; share: number; terminal: string };
  const walk = (id: string, seen: Set<string>, share: number, acc: Path[], path: string[]): void => {
    const groups: LabEdge[][] = [];
    for (const e of out(id)) {
      if (seen.has(e.target)) continue;
      const g = groups.find((x) => kindOf.get(x[0].target) === kindOf.get(e.target));
      if (g) g.push(e);
      else groups.push([e]);
    }
    if (!groups.length || acc.length >= MAX_ROUTES) {
      if (path.length) acc.push({ path, share, terminal: id });
      return;
    }
    const next = new Set([...seen, id]);
    for (const g of groups)
      for (const e of g) walk(e.target, next, share / groups.length / g.length, acc, [...path, e.id]);
  };

  const rate = rateFor(rps);
  const slow = (t: string) => statusOf(t) === "warn" || statusOf(t) === "crit";
  const flows: Flow[] = [];
  for (const src of sources) {
    const paths: Path[] = [];
    walk(src, new Set(), 1, paths, []);
    if (!paths.length) continue;
    if (paths.length === 1) {
      const [p] = paths;
      flows.push({ route: p.path, ...(slow(p.terminal) ? { kind: "slow" as PacketKind } : {}), bounce: true, rate });
      continue;
    }
    const scale = 1 / Math.min(...paths.map((p) => p.share));
    flows.push({
      routes: paths.map((p) => ({ path: p.path, ...(slow(p.terminal) ? { kind: "slow" as PacketKind } : {}), weight: Math.max(1, Math.round(p.share * scale)) })),
      pick: "weights",
      bounce: true,
      rate,
    });
  }
  return flows;
}
