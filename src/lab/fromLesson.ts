// "Open in Design Lab": turns a lesson step's original architecture (Step.lab, emitted by
// scripts/convert-lessons.mjs from the source lessons) into a runnable sandbox graph + traffic.
//
// Lesson diagrams are drawn for teaching; the simulator has wiring conventions of its own, so the
// graph is normalised minimally: data stores reached only through a cache/queue/worker also get a
// direct edge from the compute tier (the sim routes reads and drained writes that way), and a queue
// feeding a DB directly gets a worker pool to drain it. Sizing follows the step's story: struggling
// (warn/crit) blocks keep the smallest tier and one instance so the bottleneck shows up in the sim;
// healthy blocks get headroom for the step's traffic.
import type { StepLab } from "../types/lesson";
import { CATALOG, defaultConfig } from "./sim/catalog/components";
import type { ComponentKind, GraphSnapshot, Tier } from "./sim/types";
import { workloadById } from "./model";
import type { SandboxSettings } from "./store";

export interface LessonOrigin {
  lessonId: string;
  title: string;
  /** 0-based step index. */
  step: number;
  /** The lesson's request rate, set when the sandbox traffic had to be scaled down to fit the sim. */
  lessonRps?: number;
}

/** Mean sandbox rps ceiling: past this, single-LB / single-primary lesson designs can't fit the sim's capacities. */
export const SIM_RPS_CAP = 5_000;
const HEADROOM = 0.6; // keep healthy blocks under ~60% busy at peak
const CACHE_MISS = 0.32; // short-TTL cache-aside hit ratio in the sim is 0.68
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const isKind = (k: string): k is ComponentKind => Object.prototype.hasOwnProperty.call(CATALOG, k);
const COMPUTE = new Set<ComponentKind>(["api_server", "k8s_cluster"]);
const DBS = new Set<ComponentKind>(["postgres", "mysql", "mongodb", "cassandra", "dynamodb"]);
const QUEUES = new Set<ComponentKind>(["kafka", "rabbitmq", "sqs"]);

type GNode = GraphSnapshot["nodes"][number];
type Edge = { from: string; to: string };

export const hasLab = (lab: StepLab | undefined): lab is StepLab => !!lab && lab.nodes.some((n) => isKind(n.kind) && n.kind !== "users");

/** Sandbox traffic shape that best matches the architecture. */
export function workloadFor(kinds: string[]): string {
  const has = (k: string) => kinds.includes(k);
  if (has("postgres") || has("mysql")) return "payments";
  if (has("kafka") || has("worker") || has("cassandra") || has("sqs") || has("rabbitmq")) return "ingest";
  if (has("cdn") || has("redis")) return "feed";
  return "web";
}

const newNode = (id: string, kind: ComponentKind, label: string): GNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { kind, label, tier: CATALOG[kind].tiers[0].id, instances: 1, config: defaultConfig(kind) },
});

/** Smallest tier whose read (and write) capacity covers the demand with headroom, else the largest. */
function tierFor(kind: ComponentKind, read: number, write = 0): Tier {
  const s = CATALOG[kind];
  const fits = (t: Tier) => s.readCapacityRps * t.capacityMult * HEADROOM >= read && s.writeCapacityRps * t.capacityMult * HEADROOM >= write;
  return s.tiers.find(fits) ?? s.tiers[s.tiers.length - 1];
}

export function lessonLabGraph(lab: StepLab): { graph: GraphSnapshot; sandbox: SandboxSettings; scaled: boolean } {
  const src = lab.nodes.filter((n) => isKind(n.kind));
  const kindOf = new Map(src.map((n) => [n.id, n.kind as ComponentKind]));
  const is = (id: string, kinds: Set<ComponentKind>) => kinds.has(kindOf.get(id)!);
  let edges: Edge[] = lab.edges.filter((e) => e.from !== e.to && kindOf.has(e.from) && kindOf.has(e.to)).map((e) => ({ from: e.from, to: e.to }));
  const out = (id: string) => edges.filter((e) => e.from === id).map((e) => e.to);

  // ── wiring normalisation ──
  const extra: GNode[] = [];
  for (const e of [...edges]) {
    if (!is(e.from, QUEUES) || !is(e.to, DBS)) continue;
    const wid = `${e.from}Workers`;
    if (!kindOf.has(wid)) {
      kindOf.set(wid, "worker");
      extra.push(newNode(wid, "worker", "Workers"));
    }
    edges = [...edges.filter((x) => x !== e), { from: e.from, to: wid }, { from: wid, to: e.to }];
  }
  // Same-kind DB → DB (primary → replica): the replica is a failover copy, not a separate store.
  const replicaOf = new Map<string, string>();
  for (const e of edges) if (is(e.from, DBS) && kindOf.get(e.from) === kindOf.get(e.to)) replicaOf.set(e.to, e.from);
  const computes = [...kindOf.keys()].filter((id) => is(id, COMPUTE));
  for (const c of computes) {
    const seen = new Set<string>();
    const stack = out(c).filter((id) => !is(id, COMPUTE) && kindOf.get(id) !== "load_balancer");
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (is(id, DBS) && !replicaOf.has(id) && !out(c).includes(id)) edges.push({ from: c, to: id });
      if (!is(id, COMPUTE)) stack.push(...out(id));
    }
  }

  // ── traffic & demand per role (mirrors the sim's routing) ──
  const workloadId = workloadFor([...kindOf.values()]);
  const w = workloadById(workloadId).workload;
  // Past the cap, users scale down with the traffic so per-user load (and storage growth) stays the lesson's.
  const rps = Math.min(lab.rps, SIM_RPS_CAP);
  const users = Math.max(1, Math.round((lab.users * rps) / Math.max(rps, lab.rps)));
  // The sim's diurnal swing averages 1 + (peakMult − 1)/2: scale so its mean matches the step's rps.
  const meanDiurnal = 1 + (w.peakMult - 1) * 0.5;
  const rpsPerKUsers = Math.round(Math.max(0.01, ((rps / users) * 1000) / meanDiurnal) * 100) / 100;
  const peak = rps * (w.peakMult / meanDiurnal);
  const reads = peak * w.readRatio;
  const absorbed = [...kindOf.values()].includes("cdn") ? reads * w.staticRatio * 0.6 : 0;
  const search = (reads - absorbed) * w.searchRatio;
  const read = reads - absorbed - search;
  const write = peak - reads;
  const perCompute = (peak - absorbed) / Math.max(1, computes.length);
  const reached = (kinds: Set<ComponentKind> | ComponentKind[]) =>
    [...new Set(computes.flatMap(out))].filter((id) => [...kinds].includes(kindOf.get(id)!));
  const stores = Math.max(1, reached(DBS).length);
  // Without a search cluster, each search costs the DB ~18 reads.
  const searchOnDb = reached(["elasticsearch"]).length ? 0 : search * 18;
  const dbRead = ((reached(["redis"]).length ? read * CACHE_MISS : read) + searchOnDb) / stores;
  const dbWrite = write / stores;

  // ── blocks ──
  const nameOf = (label: string) => label.split(" — ")[0].trim();
  const counts = new Map<string, number>();
  for (const n of src) counts.set(nameOf(n.label), (counts.get(nameOf(n.label)) ?? 0) + 1);
  const nodes = src.map((n) => {
    const kind = n.kind as ComponentKind;
    const spec = CATALOG[kind];
    const name = nameOf(n.label);
    const g = newNode(n.id, kind, (counts.get(name) ?? 0) > 1 && n.sub ? `${name} (${n.sub})` : name);
    const cfg = g.data.config;
    if (n.status === "warn" || n.status === "crit") {
      if (kind === "k8s_cluster") cfg.maxPods = cfg.minPods;
      return g;
    }
    if (kind === "users") return g;
    const xl = /\bXL\b/.test(`${n.label} ${n.sub ?? ""}`) ? spec.tiers.find((t) => t.id === "xl") : undefined;
    if ("indexing" in cfg) cfg.indexing = "tuned";
    for (const key of ["partitionKey", "keyDesign"]) if (key in cfg) cfg[key] = "balanced";
    switch (kind) {
      case "api_server":
        if (xl) g.data.tier = xl.id;
        g.data.instances = clamp(Math.ceil(perCompute / (spec.readCapacityRps * (xl?.capacityMult ?? 1) * HEADROOM)), 1, 40);
        break;
      case "k8s_cluster": {
        const pods = Math.ceil(perCompute / (spec.readCapacityRps * HEADROOM));
        cfg.maxPods = clamp(pods, 10, 200);
        cfg.minPods = clamp(Math.ceil(pods / 2), 2, 50);
        break;
      }
      case "worker":
        g.data.instances = clamp(Math.ceil(write / (spec.writeCapacityRps * HEADROOM)), 1, 40);
        break;
      case "kafka":
        cfg.partitions = clamp(Math.ceil(write / (420 * HEADROOM)), 3, 64);
        break;
      case "cassandra":
        g.data.instances = clamp(Math.ceil(Math.max(dbWrite / (spec.writeCapacityRps * 0.95), dbRead / (spec.readCapacityRps * 0.85)) / HEADROOM), 3, 60);
        break;
      case "redis":
        g.data.tier = tierFor(kind, read).id;
        break;
      case "elasticsearch":
        g.data.tier = (xl ?? tierFor(kind, search)).id;
        break;
      case "postgres":
      case "mysql":
      case "mongodb": {
        if (replicaOf.has(n.id)) break;
        const tier = xl ?? tierFor(kind, dbRead, dbWrite);
        g.data.tier = tier.id;
        const readCap = spec.readCapacityRps * tier.capacityMult * HEADROOM;
        const key = "readReplicas" in cfg ? "readReplicas" : "replicaSet";
        if (readCap < dbRead) cfg[key] = clamp(Math.ceil((dbRead / readCap - 1) / 0.9), 1, kind === "mongodb" ? 4 : 5);
        break;
      }
    }
    return g;
  });
  for (const x of extra) x.data.instances = clamp(Math.ceil(write / (CATALOG.worker.writeCapacityRps * HEADROOM)), 1, 40);
  // A replica drawn as its own block also joins the primary's failover set.
  for (const [replica, primary] of replicaOf) {
    const cfg = nodes.find((n) => n.id === primary)?.data.config;
    const key = cfg && ("readReplicas" in cfg ? "readReplicas" : "replicaSet" in cfg ? "replicaSet" : null);
    if (cfg && key && src.find((n) => n.id === replica)?.status !== "crit") cfg[key] = Math.max(1, Number(cfg[key]) || 0);
  }
  if (!nodes.some((n) => n.data.kind === "users")) nodes.unshift(newNode("u0", "users", "Users"));

  const graph: GraphSnapshot = {
    nodes: [...nodes, ...extra],
    edges: [...new Map(edges.map((e) => [`e-${e.from}-${e.to}`, { id: `e-${e.from}-${e.to}`, source: e.from, target: e.to }])).values()],
  };
  return { graph, sandbox: { users, workloadId, rpsPerKUsers }, scaled: rps < lab.rps };
}
