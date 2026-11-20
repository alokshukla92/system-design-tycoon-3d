// Design Lab / Practice game state (zustand). Ported from system-design-tycoon's src/state/store.ts
// without React Flow: the graph is plain nodes/edges, positions are auto-arranged by toScene().
// Adds a free "sandbox" mode (Design Lab) with adjustable users, workload and chaos injections.
import { create } from "zustand";
import { storage } from "../app/storage";
import { CATALOG, defaultConfig } from "./sim/catalog/components";
import { initialEngineState, stepSim, type EngineState, type TickContext } from "./sim/simulation/engine";
import { initialFailureState, stepFailures, type FailureEngineState } from "./sim/simulation/failures";
import { computeScores, explainScores, overallScore, type ScoreBreakdown } from "./sim/simulation/scoring";
import { mentor } from "./sim/mentor/mentor";
import { LEVELS, defaultStarter, levelById } from "./sim/game/levels";
import { incidentById } from "./sim/game/incidents";
import { interviewById } from "./sim/game/interviews";
import { evaluateInterview, type InterviewReport } from "./sim/game/evaluate";
import type {
  ArchNodeData, ComponentKind, GameMode, GraphSnapshot, IncidentDef, InterviewDef, LevelDef, MentorMessage,
  Scores, ScriptedEvent, SimEvent, SimMetrics, SLO, WorkloadProfile,
} from "./sim/types";
import { SANDBOX_SLO, fromSnapshot, toSnapshot, workloadById, type LabEdge, type LabNode } from "./model";
import { lessonLabGraph, type LessonOrigin } from "./fromLesson";
import type { StepLab } from "../types/lesson";

export type Phase = "design" | "running" | "paused" | "debrief";
export type LabMode = GameMode | "sandbox";
export type Speed = 1 | 2 | 4;

export interface LevelResult {
  passed: boolean;
  scores: Scores;
  breakdown: ScoreBreakdown;
  overall: number;
  reasons: string[];
  avgP95: number;
  avgAvailability: number;
  finalCost: number;
  lostRevenue?: number;
}

export type Progress = Record<string, { passed: boolean; overall: number }>;

export interface SandboxSettings {
  users: number;
  workloadId: string;
  /** Traffic override from an opened lesson step (cleared when a workload preset is picked). */
  rpsPerKUsers?: number;
}

export type ChaosKind = "traffic_spike" | "node_crash" | "hot_key" | "az_failure" | "bad_deploy";

interface RunState {
  engine: EngineState;
  failures: FailureEngineState;
  ctxPatch: { spikeMult: number; hotKeyActive: boolean; zoneOutage: number };
  tick: number;
  running: boolean;
  metricsHistory: SimMetrics[];
  events: SimEvent[];
  mentorMessages: MentorMessage[];
  mentorDelivered: string[];
  scores: Scores | null;
  scoreBreakdown: ScoreBreakdown | null;
  result: LevelResult | null;
  report: InterviewReport | null;
  lostRevenue: number;
  stableTicks: number;
  repairs: { nodeId: string; atTick: number }[];
  /** Sandbox chaos events (append-only so failure-engine indices stay stable). */
  chaos: ScriptedEvent[];
}

export interface LabState extends RunState {
  mode: LabMode | null;
  level: LevelDef | null;
  incident: IncidentDef | null;
  interview: InterviewDef | null;
  phase: Phase;
  nodes: LabNode[];
  edges: LabEdge[];
  selectedId: string | null;
  nodeCounter: number;
  speed: Speed;
  progress: Progress;
  sandbox: SandboxSettings;
  /** Lesson step the sandbox graph was opened from ("Open in Design Lab"). */
  origin: LessonOrigin | null;
  /** Scenario brief dialog (opened on start). */
  briefOpen: boolean;
  helpOpen: boolean;
}

const REPAIR_DELAY = 18; // ticks until a crashed instance is replaced
export const TICK_MS = 700;

const freshRun = (): RunState => ({
  engine: initialEngineState(),
  failures: initialFailureState(),
  ctxPatch: { spikeMult: 1, hotKeyActive: false, zoneOutage: 0 },
  tick: 0,
  running: false,
  metricsHistory: [],
  events: [],
  mentorMessages: [],
  mentorDelivered: [],
  scores: null,
  scoreBreakdown: null,
  result: null,
  report: null,
  lostRevenue: 0,
  stableTicks: 0,
  repairs: [],
  chaos: [],
});

interface SavedLab {
  graph: GraphSnapshot;
  counter: number;
  sandbox: SandboxSettings;
  origin?: LessonOrigin | null;
}

const usersNode = (): GraphSnapshot["nodes"][number] => ({
  id: "u0",
  position: { x: 0, y: 0 },
  data: { kind: "users", label: "Users", tier: "base", instances: 1, config: {} },
});

const savedLab = (): SavedLab => {
  const s = storage.get<SavedLab | null>("lab", null);
  if (s && s.graph?.nodes?.length) return s;
  return { graph: defaultStarter(), counter: 100, sandbox: { users: 10_000, workloadId: "web" } };
};

/** Scenario-like view of the current mode (sandbox synthesises one from its settings). */
export interface ScenarioView {
  users: number;
  usersEnd: number;
  durationTicks: number;
  workload: WorkloadProfile;
  slo: SLO;
  scripted: ScriptedEvent[];
}

const sandboxWorkload = (sb: SandboxSettings): WorkloadProfile => {
  const w = workloadById(sb.workloadId).workload;
  return sb.rpsPerKUsers ? { ...w, rpsPerKUsers: sb.rpsPerKUsers } : w;
};

export function scenarioOf(s: Pick<LabState, "mode" | "level" | "incident" | "interview" | "sandbox" | "chaos">): ScenarioView | null {
  if (s.mode === "campaign" && s.level) return { ...s.level };
  if (s.mode === "incident" && s.incident) return { ...s.incident, usersEnd: s.incident.users };
  if (s.mode === "sandbox")
    return {
      users: s.sandbox.users,
      usersEnd: s.sandbox.users,
      durationTicks: Number.POSITIVE_INFINITY,
      workload: sandboxWorkload(s.sandbox),
      slo: SANDBOX_SLO,
      scripted: s.chaos,
    };
  return null;
}

export function targetUsersOf(s: Pick<LabState, "mode" | "level" | "incident" | "interview" | "sandbox">): number {
  if (s.mode === "campaign" && s.level) return s.level.usersEnd;
  if (s.mode === "incident" && s.incident) return s.incident.users;
  if (s.mode === "interview" && s.interview) return s.interview.tiers[s.interview.tiers.length - 1].users;
  if (s.mode === "sandbox") return s.sandbox.users;
  return 1000;
}

/** Components the player can place right now (campaign levels gate the palette). */
export function availableOf(s: Pick<LabState, "mode" | "level">): ComponentKind[] | undefined {
  if (s.mode === "campaign" && s.level) return [...s.level.unlocked, "worker", "monitoring"];
  return undefined;
}

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const useLab = create<LabState>(() => {
  const saved = savedLab();
  return {
    mode: null,
    level: null,
    incident: null,
    interview: null,
    phase: "design",
    nodes: [],
    edges: [],
    selectedId: null,
    nodeCounter: saved.counter,
    speed: 1,
    progress: storage.get<Progress>("practice", {}),
    sandbox: saved.sandbox,
    origin: saved.origin ?? null,
    briefOpen: false,
    helpOpen: false,
    ...freshRun(),
  };
});

const get = useLab.getState;
const set = useLab.setState;

function persistSandbox(): void {
  const s = get();
  if (s.mode !== "sandbox") return;
  const graph = toSnapshot(s.nodes, s.edges);
  graph.nodes = graph.nodes.map((n) => ({ ...n, data: { ...n.data, runtime: undefined } }));
  storage.set("lab", { graph, counter: s.nodeCounter, sandbox: s.sandbox, origin: s.origin } satisfies SavedLab);
}

function graphChanged(): void {
  refreshScores();
  maybeDesignAdvice();
  persistSandbox();
}

// ── scenario lifecycle ──────────────────────────────────────────────────────
export function openSandbox(): void {
  const saved = savedLab();
  const { nodes, edges } = fromSnapshot(saved.graph);
  set({
    ...freshRun(),
    mode: "sandbox",
    level: null,
    incident: null,
    interview: null,
    phase: "design",
    nodes,
    edges,
    selectedId: null,
    nodeCounter: Math.max(saved.counter, 100),
    sandbox: saved.sandbox,
    origin: saved.origin ?? null,
    briefOpen: false,
  });
  refreshScores();
}

/** True when a saved sandbox design would be overwritten by loading `origin` (anything beyond the users node). */
export function sandboxHasWork(origin?: LessonOrigin): boolean {
  const s = storage.get<SavedLab | null>("lab", null);
  if (!s?.graph?.nodes || s.graph.nodes.length <= 1) return false;
  const o = s.origin;
  return !(origin && o && o.lessonId === origin.lessonId && o.step === origin.step);
}

/** "Open in Design Lab": replace the sandbox with a lesson step's architecture. */
export function loadLessonGraph(lab: StepLab, origin: LessonOrigin): void {
  const { graph, sandbox, scaled } = lessonLabGraph(lab);
  const { nodes, edges } = fromSnapshot(graph);
  origin = scaled ? { ...origin, lessonRps: lab.rps } : { ...origin, lessonRps: undefined };
  set({
    ...freshRun(),
    mode: "sandbox",
    level: null,
    incident: null,
    interview: null,
    phase: "design",
    nodes,
    edges,
    selectedId: null,
    nodeCounter: Math.max(get().nodeCounter, 100),
    sandbox,
    origin,
    briefOpen: false,
    speed: get().speed,
  });
  persistSandbox();
  refreshScores();
}

export function dismissOrigin(): void {
  set({ origin: null });
  persistSandbox();
}

export function startLevel(id: string): boolean {
  const level = levelById(id);
  if (!level) return false;
  const { nodes, edges } = fromSnapshot(level.starter ?? { nodes: [usersNode()], edges: [] });
  set({ ...freshRun(), mode: "campaign", level, incident: null, interview: null, phase: "design", nodes, edges, selectedId: null, nodeCounter: 100, briefOpen: true });
  refreshScores();
  return true;
}

export function startIncident(id: string): boolean {
  const incident = incidentById(id);
  if (!incident) return false;
  const { nodes, edges } = fromSnapshot(incident.starter);
  set({ ...freshRun(), mode: "incident", level: null, incident, interview: null, phase: "design", nodes, edges, selectedId: null, nodeCounter: 100, briefOpen: true });
  refreshScores();
  return true;
}

export function startInterview(id: string): boolean {
  const interview = interviewById(id);
  if (!interview) return false;
  const { nodes, edges } = fromSnapshot({ nodes: [usersNode()], edges: [] });
  set({ ...freshRun(), mode: "interview", level: null, incident: null, interview, phase: "design", nodes, edges, selectedId: null, nodeCounter: 100, briefOpen: true });
  return true;
}

export function exitLab(): void {
  set({ ...freshRun(), mode: null, level: null, incident: null, interview: null, phase: "design", nodes: [], edges: [], selectedId: null, briefOpen: false, helpOpen: false });
}

export const setBriefOpen = (briefOpen: boolean): void => set({ briefOpen });
export const setHelpOpen = (helpOpen: boolean): void => set({ helpOpen });

// ── graph editing ───────────────────────────────────────────────────────────
export function connect(source: string, target: string): void {
  if (!source || !target || source === target) return;
  const { edges, nodes } = get();
  if (!nodes.some((n) => n.id === target) || edges.some((e) => e.source === source && e.target === target)) return;
  set({ edges: [...edges, { id: `e-${source}-${target}`, source, target }] });
  graphChanged();
}

export function disconnect(edgeId: string): void {
  set({ edges: get().edges.filter((e) => e.id !== edgeId) });
  graphChanged();
}

export function addNode(kind: ComponentKind, connectFrom?: string | null): string {
  const { nodeCounter, nodes } = get();
  const spec = CATALOG[kind];
  const id = `n${nodeCounter}`;
  const node: LabNode = {
    id,
    position: { x: 0, y: 0 },
    data: { kind, label: spec.name, tier: spec.tiers[0].id, instances: 1, config: defaultConfig(kind) },
  };
  set({ nodes: [...nodes, node], nodeCounter: nodeCounter + 1, selectedId: id });
  if (connectFrom && nodes.some((n) => n.id === connectFrom)) connect(connectFrom, id);
  else graphChanged();
  return id;
}

export function removeNode(id: string): void {
  const { nodes, edges } = get();
  const node = nodes.find((n) => n.id === id);
  if (!node || node.data.kind === "users") return;
  set({ nodes: nodes.filter((n) => n.id !== id), edges: edges.filter((e) => e.source !== id && e.target !== id), selectedId: null });
  graphChanged();
}

export function updateNodeData(id: string, patch: Partial<ArchNodeData>): void {
  set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) });
  refreshScores();
  persistSandbox();
}

export function updateNodeConfig(id: string, key: string, value: string | number | boolean): void {
  set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } } : n)) });
  graphChanged();
}

export const selectNode = (selectedId: string | null): void => set({ selectedId });

/** Sandbox: wipe back to just the users node. */
export function clearSandbox(): void {
  const { nodes, edges } = fromSnapshot({ nodes: [usersNode()], edges: [] });
  set({ ...freshRun(), nodes, edges, selectedId: null, phase: "design", speed: get().speed, origin: null, sandbox: { ...get().sandbox, rpsPerKUsers: undefined } });
  persistSandbox();
  refreshScores();
}

export function setSandbox(patch: Partial<SandboxSettings>): void {
  set({ sandbox: { ...get().sandbox, ...patch } });
  refreshScores();
  persistSandbox();
}

export function injectChaos(type: ChaosKind, targetKind?: ComponentKind): void {
  const s = get();
  const at = s.tick + 1;
  const ANNOUNCE: Record<ChaosKind, string> = {
    traffic_spike: "Traffic spike: request volume quadrupled for the next few minutes.",
    node_crash: "An instance just stopped answering health checks.",
    hot_key: "One key is suddenly getting a huge share of all reads.",
    az_failure: "An availability zone went dark: a third of instance capacity is unreachable.",
    bad_deploy: "A deploy just went out. Queries look heavier than before.",
  };
  const ev: ScriptedEvent = {
    atTick: at,
    type,
    magnitude: type === "traffic_spike" ? 4 : undefined,
    durationTicks: type === "node_crash" ? undefined : 20,
    targetKind,
    announcement: ANNOUNCE[type],
  };
  set({ chaos: [...s.chaos, ev] });
  if (!s.running) run();
}

// ── run control ─────────────────────────────────────────────────────────────
export function run(): void {
  const s = get();
  if (s.mode === "interview" || s.phase === "debrief") return;
  set({ running: true, phase: "running" });
}

export const pause = (): void => set({ running: false, phase: "paused" });
export const setSpeed = (speed: Speed): void => set({ speed });

/** Replay from tick 0, keeping the player's current design. */
export function resetRun(): void {
  const s = get();
  set({ ...freshRun(), speed: s.speed, phase: "design", nodes: s.nodes.map((n) => ({ ...n, data: { ...n.data, runtime: undefined } })) });
  refreshScores();
}

/** Discard the design and rebuild the scenario's starter. */
export function restartFromStarter(): void {
  const s = get();
  if (s.mode === "campaign" && s.level) startLevel(s.level.id);
  else if (s.mode === "incident" && s.incident) startIncident(s.incident.id);
  else if (s.mode === "interview" && s.interview) startInterview(s.interview.id);
  else if (s.mode === "sandbox") clearSandbox();
  set({ briefOpen: false });
}

export const dismissResult = (): void => set({ phase: "paused", running: false });

export function refreshScores(): void {
  const s = get();
  const scenario = scenarioOf(s);
  const slo = scenario?.slo ?? s.interview?.slo;
  const workload = scenario?.workload ?? s.interview?.workload;
  if (!slo || !workload) return;
  try {
    const input = {
      graph: toSnapshot(s.nodes, s.edges),
      workload,
      targetUsers: targetUsersOf(s),
      slo,
      recent: s.metricsHistory.slice(-20),
      available: availableOf(s),
    };
    const scores = computeScores(input);
    set({ scores, scoreBreakdown: explainScores(input, scores) });
  } catch {
    // scoring must never crash the game
  }
}

export function submitInterview(): void {
  const s = get();
  if (!s.interview) return;
  const report = evaluateInterview(toSnapshot(s.nodes, s.edges), s.interview);
  const best = s.progress[s.interview.id];
  const hire = report.verdict.startsWith("Strong Hire") || report.verdict.startsWith("Hire");
  const progress = best && best.overall >= report.overall ? s.progress : { ...s.progress, [s.interview.id]: { passed: hire, overall: report.overall } };
  set({ report, phase: "debrief", running: false, progress });
  saveProgress(progress);
}

/** Advance exactly one simulation tick, leaving the run paused. */
export function stepOnce(): void {
  const s = get();
  if (s.mode === "interview" || s.phase === "debrief") return;
  set({ running: true, phase: "running" });
  tickOnce();
  if (get().phase === "running") set({ running: false, phase: "paused" });
}

function saveProgress(progress: Progress): void {
  storage.set("practice", progress);
}

export function tickOnce(): void {
  const s = get();
  if (!s.running || s.phase !== "running") return;
  const scenario = scenarioOf(s);
  if (!scenario) return;

  const tick = s.tick + 1;
  const duration = scenario.durationTicks;
  const usersNow = Math.round(scenario.users + (scenario.usersEnd - scenario.users) * Math.min(1, tick / duration));

  const graph = toSnapshot(s.nodes, s.edges);
  const ctx: TickContext = {
    users: usersNow,
    workload: scenario.workload,
    spikeMult: s.ctxPatch.spikeMult,
    hotKeyActive: s.ctxPatch.hotKeyActive,
    zoneOutage: s.ctxPatch.zoneOutage,
  };
  const r = stepSim(s.engine, graph, ctx);

  const hasObservability = s.nodes.some((n) => n.data.kind === "monitoring");
  const f = stepFailures(s.failures, { tick, signals: r.signals, scripted: scenario.scripted, graph, engineState: r.state, hasObservability });

  const repairs = [...s.repairs];
  for (const cr of f.crashRequests) {
    const ns = r.state.nodes[cr.nodeId];
    if (ns) {
      ns.crashedInstances += cr.instances;
      repairs.push({ nodeId: cr.nodeId, atTick: tick + REPAIR_DELAY });
    }
  }
  for (const rp of repairs.filter((x) => x.atTick <= tick)) {
    const ns = r.state.nodes[rp.nodeId];
    if (ns && ns.crashedInstances > 0) ns.crashedInstances -= 1;
  }
  const pendingRepairs = repairs.filter((x) => x.atTick > tick);

  const nodes = s.nodes.map((n) => {
    const rt = r.runtimes[n.id];
    return rt ? { ...n, data: { ...n.data, runtime: rt } } : n;
  });

  let mentorMessages = s.mentorMessages;
  const delivered = new Set(s.mentorDelivered);
  if (tick % 4 === 0) {
    const msgs = mentor.advise({ graph, workload: scenario.workload, targetUsers: targetUsersOf(s), metrics: r.metrics, signals: r.signals, delivered, tick });
    if (msgs.length > 0) mentorMessages = [...mentorMessages, ...msgs];
  }

  const metricsHistory = [...s.metricsHistory, r.metrics].slice(-180);
  const events = [...s.events, ...f.events].slice(-200);

  let lostRevenue = s.lostRevenue;
  let stableTicks = s.stableTicks;
  let phase: Phase = s.phase;
  let running: boolean = s.running;
  let result = s.result;
  let progress = s.progress;

  if (s.mode === "incident" && s.incident) {
    const inc = s.incident;
    if (r.metrics.errorRate > inc.winCondition.maxErrorRate) {
      lostRevenue += inc.revenuePerTick;
      stableTicks = 0;
    } else stableTicks += 1;
    const won = stableTicks >= inc.winCondition.stableTicks && tick > 10;
    const timeUp = tick >= duration;
    if (won || timeUp) {
      running = false;
      phase = "debrief";
      const input = { graph, workload: inc.workload, targetUsers: inc.users, slo: inc.slo, recent: metricsHistory.slice(-20), available: availableOf(s) };
      const scores = computeScores(input);
      result = {
        passed: won,
        scores,
        breakdown: explainScores(input, scores),
        overall: overallScore(scores),
        reasons: won
          ? [`Service stabilized after ${tick} minutes.`, `Revenue lost during the incident: $${Math.round(lostRevenue).toLocaleString()}.`]
          : [`Time ran out with the service still unstable.`, `Revenue lost: $${Math.round(lostRevenue).toLocaleString()}.`],
        avgP95: avg(metricsHistory.slice(-20).map((m) => m.p95LatencyMs)),
        avgAvailability: avg(metricsHistory.slice(-20).map((m) => m.availabilityPct)),
        finalCost: r.metrics.costPerMonth,
        lostRevenue,
      };
      progress = { ...progress, [inc.id]: { passed: won, overall: result.overall } };
    }
  }

  if (s.mode === "campaign" && s.level && tick >= duration) {
    running = false;
    phase = "debrief";
    const lvl = s.level;
    const win = metricsHistory.slice(-Math.min(40, metricsHistory.length));
    const avgAvail = avg(win.map((m) => m.availabilityPct));
    const avgP95 = avg(win.map((m) => m.p95LatencyMs));
    const avgErr = avg(win.map((m) => m.errorRate));
    const finalCost = r.metrics.costPerMonth;
    const reasons: string[] = [];
    let passed = true;
    if (avgAvail < lvl.slo.minAvailabilityPct) {
      passed = false;
      reasons.push(`Availability ${avgAvail.toFixed(2)}% < required ${lvl.slo.minAvailabilityPct}%`);
    } else reasons.push(`Availability ${avgAvail.toFixed(2)}% ✓`);
    if (avgP95 > lvl.slo.maxP95Ms) {
      passed = false;
      reasons.push(`p95 latency ${Math.round(avgP95)}ms > limit ${lvl.slo.maxP95Ms}ms`);
    } else reasons.push(`p95 latency ${Math.round(avgP95)}ms ✓`);
    if (avgErr > lvl.slo.maxErrorRate) {
      passed = false;
      reasons.push(`Error rate ${(avgErr * 100).toFixed(2)}% > limit ${(lvl.slo.maxErrorRate * 100).toFixed(1)}%`);
    } else reasons.push(`Error rate ${(avgErr * 100).toFixed(2)}% ✓`);
    if (finalCost > lvl.slo.maxMonthlyBudget) {
      passed = false;
      reasons.push(`Cost $${finalCost.toLocaleString()}/mo > budget $${lvl.slo.maxMonthlyBudget.toLocaleString()}/mo`);
    } else reasons.push(`Cost $${finalCost.toLocaleString()}/mo within budget ✓`);
    const input = { graph, workload: lvl.workload, targetUsers: lvl.usersEnd, slo: lvl.slo, recent: metricsHistory.slice(-20), available: availableOf(s) };
    const scores = computeScores(input);
    result = { passed, scores, breakdown: explainScores(input, scores), overall: overallScore(scores), reasons, avgP95, avgAvailability: avgAvail, finalCost };
    progress = { ...progress, [lvl.id]: { passed, overall: result.overall } };
  }

  if (progress !== s.progress) saveProgress(progress);

  set({
    tick,
    engine: r.state,
    failures: f.state,
    ctxPatch: f.ctxPatch,
    nodes,
    metricsHistory,
    events,
    mentorMessages,
    mentorDelivered: [...delivered],
    repairs: pendingRepairs,
    lostRevenue,
    stableTicks,
    phase,
    running,
    result,
    progress,
  });
  if (tick % 8 === 0) refreshScores();
}

/** Design-time mentor advice (no live metrics) — throttled by rule dedupe. */
function maybeDesignAdvice(): void {
  const s = get();
  const scenario = scenarioOf(s) ?? s.interview;
  if (!scenario) return;
  const delivered = new Set(s.mentorDelivered);
  const msgs = mentor.advise({
    graph: toSnapshot(s.nodes, s.edges),
    workload: scenario.workload,
    targetUsers: targetUsersOf(s),
    metrics: null,
    signals: [],
    delivered,
    tick: s.tick,
  });
  if (msgs.length > 0) set({ mentorMessages: [...s.mentorMessages, ...msgs], mentorDelivered: [...delivered] });
}

/** Campaign levels unlocked so far: every passed level plus the next one. */
export function unlockedLevels(progress: Progress): string[] {
  const ids: string[] = [];
  for (const l of LEVELS) {
    ids.push(l.id);
    if (!progress[l.id]?.passed) break;
  }
  return ids;
}
