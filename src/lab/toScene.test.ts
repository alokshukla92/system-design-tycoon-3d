import { describe, expect, it } from "vitest";
import type { ArchNodeData, ComponentKind, NodeRuntime } from "./sim/types";
import type { LabEdge, LabNode } from "./model";
import { resolvePoint } from "../engine/framing";
import { COL_GAP, ROW_GAP, collisions, entityId, footprintOf, layout, nodeIdOf, rateFor, spacingFor, toScene } from "./toScene";

const node = (id: string, kind: ComponentKind, extra: Partial<ArchNodeData> = {}): LabNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { kind, label: kind === "users" ? "Users" : kind, tier: "small", instances: 1, config: {}, ...extra },
});
const edge = (source: string, target: string): LabEdge => ({ id: `e-${source}-${target}`, source, target });
const rt = (p: Partial<NodeRuntime>): NodeRuntime => ({
  utilization: 0.4, latencyMs: 10, errorRate: 0, inboundRps: 100, servedRps: 100, storagePct: 0.1, backlog: 0,
  replicationLagMs: 0, crashed: false, crashedInstances: 0, status: "ok", activeFailures: [], ...p,
});

describe("lab layout", () => {
  it("layers nodes by BFS depth from users and centres siblings", () => {
    const nodes = [node("u", "users"), node("lb", "load_balancer"), node("a", "api_server"), node("b", "api_server"), node("db", "postgres")];
    const edges = [edge("u", "lb"), edge("lb", "a"), edge("lb", "b"), edge("a", "db"), edge("b", "db")];
    const at = layout(nodes, edges);
    expect([at.u.col, at.lb.col, at.a.col, at.b.col, at.db.col]).toEqual([0, 1, 2, 2, 3]);
    expect([at.a.row, at.b.row]).toEqual([-0.5, 0.5]);
    expect(at.db.row).toBe(0);
    expect(Object.values(at).every((p) => !p.detached)).toBe(true);
  });

  it("puts nodes unreachable from users in a separate dimmed lane", () => {
    const nodes = [node("u", "users"), node("a", "api_server"), node("m", "monitoring"), node("r", "redis")];
    const at = layout(nodes, [edge("u", "a"), edge("m", "r")]);
    expect(at.m.detached && at.r.detached).toBe(true);
    expect(at.r.col).toBe(at.m.col + 1);
    expect(at.m.row).toBeGreaterThan(at.a.row);
    const scene = toScene(nodes, [edge("u", "a"), edge("m", "r")]);
    expect(scene.entities.m).toMatchObject({ type: "block", dim: 1 });
    expect(scene.links?.["e-m-r"]?.style).toBe("dashed");
  });

  it("survives cycles", () => {
    const nodes = [node("u", "users"), node("a", "api_server"), node("b", "worker")];
    const at = layout(nodes, [edge("u", "a"), edge("a", "b"), edge("b", "a")]);
    expect([at.a.col, at.b.col]).toEqual([1, 2]);
  });
});

describe("lab toScene", () => {
  it("uses engine-safe entity ids for node ids that look like point offsets", () => {
    const nodes = [node("start-users-0", "users"), node("start-api_server-1", "api_server")];
    const s = toScene(nodes, [edge("start-users-0", "start-api_server-1")]);
    expect(Object.keys(s.entities)).toEqual(["start_users_0", "start_api_server_1"]);
    const link = s.links!["e-start-users-0-start-api_server-1"];
    const anchors: Record<string, [number, number]> = { start_users_0: [1, 2], start_api_server_1: [3, 4] };
    expect(link.pts.map((p) => resolvePoint(p, (id) => anchors[id]))).toEqual([[1, 2], [3, 4]]);
    expect(nodeIdOf(nodes, entityId("start-api_server-1"))).toBe("start-api_server-1");
  });

  it("maps kinds to doc-12 entities with stable ids and grid→iso coordinates", () => {
    const nodes = [node("u", "users"), node("lb", "load_balancer"), node("api", "api_server"), node("db", "postgres"), node("c", "redis")];
    const edges = [edge("u", "lb"), edge("lb", "api"), edge("api", "db"), edge("api", "c")];
    const s = toScene(nodes, edges, { users: 10_000 });
    const { colY, rowGap } = spacingFor(nodes, layout(nodes, edges));
    expect(Object.keys(s.entities)).toEqual(["u", "lb", "api", "db", "c"]);
    expect(s.entities.u).toMatchObject({ type: "crowd", count: 8, x0: -4, x1: 4, y0: colY[0] - 3 });
    expect(s.entities.lb).toMatchObject({ type: "block", color: "green", glyph: "balancer", s: 3.4, y: colY[1] });
    expect(colY[1] - colY[0]).toBe(COL_GAP);
    expect(s.entities.api).toMatchObject({ type: "block", color: "blue", glyph: "server", cpu: -1 });
    expect(s.entities.db).toMatchObject({ type: "db", glyph: "database", y: colY[3] });
    expect((s.entities.db as { x: number }).x).toBeCloseTo(-0.5 * rowGap[3], 1);
    expect(s.entities.c).toMatchObject({ type: "block", color: "orange", glyph: "zap" });
    expect((s.entities.c as { x: number }).x).toBeCloseTo(0.5 * rowGap[3], 1);
    expect(s.links?.["e-api-db"]).toEqual({ from: "api", to: "db", pts: ["api", "db"], heads: "end" });
    expect(s.flows).toEqual([]);
  });

  it("drives heat, cpu, tags, dead/cut links and failure rate from the runtime", () => {
    const nodes = [
      node("u", "users"),
      node("api", "api_server", { instances: 3, tier: "large", runtime: rt({ utilization: 1.4, status: "crit", errorRate: 0.2 }) }),
      node("q", "kafka", { runtime: rt({ backlog: 12_500, status: "warn" }) }),
      node("db", "postgres", { runtime: rt({ status: "down", crashed: true }) }),
    ];
    const edges = [edge("u", "api"), edge("api", "q"), edge("api", "db")];
    const s = toScene(nodes, edges, { users: 5000, rps: 800, live: true });
    expect(s.entities.api).toMatchObject({ heat: 1, cpu: 1, dead: 0 });
    const apiTags = (s.entities.api as { tags: { text: string }[] }).tags.map((t) => t.text);
    expect(apiTags[0]).toBe("×3");
    expect(apiTags).toHaveLength(2);
    expect(s.entities.q).toMatchObject({ heat: 0.35, cpu: -1, tags: [{ text: "12.5k queued", tone: "amber" }] });
    expect(s.entities.db).toMatchObject({ type: "db", cpu: -1, tags: [{ text: "DOWN", tone: "red" }] });
    expect(s.links?.["e-api-db"]?.style).toBe("cut");
    expect(s.links?.["e-u-api"]?.fail).toBe(0.2);
    // The dead DB branch carries no packets; the queue branch is slow because the queue is warm.
    expect(s.flows).toEqual([{ route: ["e-u-api", "e-api-q"], kind: "slow", bounce: true, rate: rateFor(800) }]);
  });

  it("splits flows evenly across same-kind siblings with exact per-path routes", () => {
    const nodes = [node("u", "users"), node("lb", "load_balancer"), node("a", "api_server"), node("b", "api_server"), node("db", "mysql"), node("c", "redis")];
    const edges = [edge("u", "lb"), edge("lb", "a"), edge("lb", "b"), edge("a", "db"), edge("b", "db"), edge("a", "c")];
    const [f] = toScene(nodes, edges, { rps: 100, live: true }).flows!;
    expect("routes" in f && f.routes.map((r) => [r.path.join(">"), r.weight])).toEqual([
      ["e-u-lb>e-lb-a>e-a-db", 1],
      ["e-u-lb>e-lb-a>e-a-c", 1],
      ["e-u-lb>e-lb-b>e-b-db", 2],
    ]);
  });
});

describe("lab spacing", () => {
  it("keeps the default grid for a sparse chain", () => {
    const nodes = [node("u", "users"), node("a", "api_server"), node("db", "postgres")];
    const sp = spacingFor(nodes, layout(nodes, [edge("u", "a"), edge("a", "db")]));
    expect(sp.colY).toEqual({ 0: -COL_GAP, 1: 0, 2: COL_GAP });
    expect(Object.values(sp.rowGap)).toEqual([ROW_GAP, ROW_GAP, ROW_GAP]);
  });

  it("spreads dense layers so pills, side labels and silhouettes never overlap", () => {
    const hot = rt({ utilization: 1, status: "crit", backlog: 4200 });
    const lag = rt({ utilization: 0.7, status: "warn", replicationLagMs: 900 });
    const nodes = [
      node("u", "users"), node("lb", "load_balancer"), node("a1", "api_server", { instances: 3, runtime: hot }),
      node("a2", "api_server", { runtime: hot }), node("r", "redis", { runtime: hot }), node("m", "mongodb", { label: "MongoDB", runtime: lag }),
      node("p", "postgres", { label: "PostgreSQL", runtime: lag }), node("d", "mysql", { label: "MySQL", runtime: lag }),
    ];
    const edges = [edge("u", "a2"), edge("u", "lb"), edge("lb", "a1"), edge("a2", "d"), edge("a1", "r"), edge("a1", "m"), edge("a1", "p")];
    const fps = Object.values(toScene(nodes, edges, { users: 5e6 }).entities).map(footprintOf);
    expect(collisions(fps)).toBe(0);
  });
});
