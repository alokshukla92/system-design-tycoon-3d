import { beforeAll, describe, expect, it, vi } from "vitest";
import { LESSONS } from "../content/lessons";
import type { StepLab } from "../types/lesson";
import { CATALOG } from "./sim/catalog/components";
import { SIM_RPS_CAP, hasLab, lessonLabGraph, workloadFor } from "./fromLesson";

const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

let store: typeof import("./store");
beforeAll(async () => {
  store = await import("./store");
});

const stepLab = (lessonId: string, step: number): StepLab => {
  const lab = LESSONS[lessonId].steps[step].lab;
  if (!lab) throw new Error(`${lessonId}/${step} has no lab data`);
  return lab;
};
const dataOf = (lab: StepLab, id: string) => lessonLabGraph(lab).graph.nodes.find((n) => n.id === id)!.data;

describe("lesson → lab graph", () => {
  it("every lesson step carries a loadable architecture", () => {
    for (const lesson of Object.values(LESSONS))
      lesson.steps.forEach((s, i) => {
        const at = `${lesson.id}/${i}`;
        expect(hasLab(s.lab), at).toBe(true);
        const { graph, sandbox } = lessonLabGraph(s.lab!);
        const ids = new Set(graph.nodes.map((n) => n.id));
        expect(graph.nodes.filter((n) => n.data.kind === "users"), at).toHaveLength(1);
        for (const n of graph.nodes) {
          expect(CATALOG[n.data.kind], at).toBeDefined();
          expect(CATALOG[n.data.kind].tiers.some((t) => t.id === n.data.tier), `${at} ${n.id} tier`).toBe(true);
        }
        for (const e of graph.edges) expect(ids.has(e.source) && ids.has(e.target), `${at} ${e.id}`).toBe(true);
        for (const e of s.lab!.edges.filter((e) => !(e.from === "queue" && e.to === "db" && lesson.id === "planet-scale")))
          expect(graph.edges.some((g) => g.source === e.from && g.target === e.to), `${at} ${e.from}→${e.to}`).toBe(true);
        if (s.lab!.rps <= SIM_RPS_CAP) expect(sandbox.users, at).toBe(s.metrics.users);
        else expect(sandbox.users, at).toBe(Math.round((s.lab!.users * SIM_RPS_CAP) / s.lab!.rps));
      });
  });

  it("sizes struggling blocks small and healthy blocks with headroom", () => {
    const crit = dataOf(stepLab("day-one", 2), "api");
    expect([crit.tier, crit.instances]).toEqual(["small", 1]);
    expect(dataOf(stepLab("day-one", 3), "api").tier).toBe("xl"); // "API Server — XL"
    expect(dataOf(stepLab("day-one", 3), "api").label).toBe("API Server");
    expect(dataOf(stepLab("surge", 3), "api").instances).toBeGreaterThan(1);
    expect(dataOf(stepLab("checkout", 2), "k8s").config.maxPods).toBe(2);
    expect(Number(dataOf(stepLab("checkout", 3), "k8s").config.maxPods)).toBeGreaterThan(10);
    expect(dataOf(stepLab("the-slow-burn", 3), "db").config.indexing).toBe("tuned"); // healthy DBs are indexed
    expect(dataOf(stepLab("the-slow-burn", 2), "db").config.indexing).toBe("none");
  });

  it("wires stores the way the simulator routes traffic", () => {
    const pairs = (id: string, step: number) => lessonLabGraph(stepLab(id, step)).graph.edges.map((e) => `${e.source}>${e.target}`);
    expect(pairs("chatterbox", 3)).toContain("api>db"); // cache-aside: misses go api → db
    expect(pairs("surge", 3)).toContain("api>db"); // drained writes land in a compute-reachable store
    const planet = pairs("planet-scale", 3);
    expect(planet).toEqual(expect.arrayContaining(["queue>queueWorkers", "queueWorkers>db", "k8s>db"]));
    expect(planet).not.toContain("queue>db");
    const page = lessonLabGraph(stepLab("the-3am-page", 3)).graph;
    expect(page.edges.some((e) => e.source === "api" && e.target === "replica")).toBe(false);
    expect(page.nodes.find((n) => n.id === "db")!.data.config.replicaSet).toBeGreaterThanOrEqual(1);
  });

  it("scales lesson traffic beyond the simulator's reach down with its users", () => {
    const lab = stepLab("planet-scale", 3);
    const { sandbox, scaled } = lessonLabGraph(lab);
    expect(scaled).toBe(true);
    expect(sandbox.users).toBe(Math.round((lab.users * SIM_RPS_CAP) / lab.rps));
    expect(lessonLabGraph(stepLab("day-one", 2)).scaled).toBe(false);
  });

  it("disambiguates duplicate names and picks a matching workload", () => {
    const lab = stepLab("the-3am-page", 3);
    expect(dataOf(lab, "replica").label).toBe("MongoDB (replica)");
    expect(dataOf(lab, "api").label).toBe("API Server");
    expect(workloadFor(["users", "lb", "postgres"])).toBe("payments");
    expect(workloadFor(["users", "kafka"])).toBe("ingest");
    expect(workloadFor(["users", "api_server", "mongodb"])).toBe("web");
  });

  it("matches the lesson's mean request rate", () => {
    const lab = stepLab("day-one", 2);
    const { sandbox } = lessonLabGraph(lab);
    const view = store.scenarioOf({ mode: "sandbox", level: null, incident: null, interview: null, sandbox, chaos: [] })!;
    const mean = (sandbox.users / 1000) * view.workload.rpsPerKUsers * (1 + (view.workload.peakMult - 1) / 2);
    expect(mean).toBeCloseTo(lab.rps, -1);
  });

  it("ignores unknown kinds and adds a users node when missing", () => {
    const { graph } = lessonLabGraph({
      users: 10,
      rps: 1,
      nodes: [{ id: "a", kind: "api_server", label: "API" }, { id: "x", kind: "mainframe", label: "?" }],
      edges: [{ from: "a", to: "x" }],
    });
    expect(graph.nodes.map((n) => n.data.kind)).toEqual(["users", "api_server"]);
    expect(graph.edges).toEqual([]);
  });
});

describe("lab store: loadLessonGraph", () => {
  const origin = { lessonId: "day-one", title: "Day One", step: 2 };

  it("loads the graph into the sandbox, marks its origin and persists it", () => {
    mem.clear();
    expect(store.sandboxHasWork(origin)).toBe(false);
    store.loadLessonGraph(stepLab("day-one", 2), origin);
    const s = store.useLab.getState();
    expect(s.mode).toBe("sandbox");
    expect(s.origin).toEqual(origin);
    expect(s.nodes.map((n) => n.id)).toEqual(["users", "api", "db"]);
    expect(s.edges.map((e) => [e.source, e.target])).toEqual([["users", "api"], ["api", "db"]]);
    expect(s.sandbox.users).toBe(15_000);
    expect(JSON.parse(mem.get("sdt:lab")!).origin).toEqual(origin);
    store.loadLessonGraph(stepLab("planet-scale", 3), { lessonId: "planet-scale", title: "Planet Scale", step: 3 });
    expect(store.useLab.getState().origin?.lessonRps).toBe(stepLab("planet-scale", 3).rps);
    store.loadLessonGraph(stepLab("day-one", 2), origin);
    // Same step again: nothing to lose; another step or a hand-made design: confirm first.
    expect(store.sandboxHasWork(origin)).toBe(false);
    expect(store.sandboxHasWork({ ...origin, step: 3 })).toBe(true);
  });

  it("runs the simulation and shows the step's bottleneck", () => {
    store.loadLessonGraph(stepLab("day-one", 2), origin);
    store.run();
    for (let i = 0; i < 12; i++) store.tickOnce();
    const crit = store.useLab.getState().metricsHistory.at(-1)!;
    store.loadLessonGraph(stepLab("day-one", 3), { ...origin, step: 3 });
    store.run();
    for (let i = 0; i < 12; i++) store.tickOnce();
    const fixed = store.useLab.getState().metricsHistory.at(-1)!;
    expect(crit.errorRate).toBeGreaterThan(0.2);
    expect(fixed.errorRate).toBeLessThan(0.01);
    expect(crit.p95LatencyMs).toBeGreaterThan(fixed.p95LatencyMs);
  });

  it("dismissing the note or starting over clears the origin", () => {
    store.loadLessonGraph(stepLab("day-one", 2), origin);
    store.dismissOrigin();
    expect(store.useLab.getState().origin).toBeNull();
    expect(JSON.parse(mem.get("sdt:lab")!).origin).toBeNull();
    store.loadLessonGraph(stepLab("day-one", 2), origin);
    store.clearSandbox();
    expect(store.useLab.getState().origin).toBeNull();
    expect(store.useLab.getState().nodes).toHaveLength(1);
    expect(store.sandboxHasWork(origin)).toBe(false);
  });
});
