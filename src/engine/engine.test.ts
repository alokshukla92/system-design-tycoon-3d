import { describe, expect, it } from "vitest";
import { renderBlock, resolve, type BlockP } from "./entities";
import { cardFootprint, dockRect, layoutOf, planFor, quantizeZoom, resolvePoint } from "./framing";
import { swipeDir, wheelZoomFactor } from "./gestures";
import { labelCost, placeLabel, pointAlong, polyHitsRect, wrapLabel } from "./labels";
import { clamp01, ease } from "./math";
import { packetSpeed, pickRoute, travelSpan, type FlowState } from "./packets";
import { hockeyCurve, panelSize } from "./panel";
import { clipStart, iso, roundedPolyline, type Pt } from "./projection";
import { darkColor, recolor } from "./theme";
import type { Scene } from "../types/lesson";


describe("projection", () => {
  it("projects world → screen as [14(x+y), 7(x−y) − z]", () => {
    expect(iso(0, 0)).toEqual([0, 0]);
    expect(iso(2, -2, 46)).toEqual([0, 28 - 46]);
    expect(iso(-2, -2, 46)).toEqual([-56, -46]);
    expect(iso(1, 2, 3)).toEqual([42, -10]);
  });

  it("clips a polyline start to just outside a polygon", () => {
    const square: Pt[] = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
    const out = clipStart([[0, 0], [100, 0]], square, 3);
    expect(out[0][0]).toBeCloseTo(13, 5);
    expect(out[0][1]).toBeCloseTo(0, 5);
    expect(out[out.length - 1]).toEqual([100, 0]);
  });

  it("rounds polyline corners with quadratic curves", () => {
    expect(roundedPolyline([[0, 0], [100, 0], [100, 100]], 10)).toMatch(/^M0,0 L90,0 Q100,0 100,10 L100,100$/);
  });
});

describe("easing", () => {
  it("hits endpoints and overshoots for back", () => {
    for (const f of Object.values(ease)) {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
    expect(ease.inOut(0.5)).toBeCloseTo(0.5, 6);
    expect(Math.max(...Array.from({ length: 99 }, (_, i) => ease.back((i + 1) / 100)))).toBeGreaterThan(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});

describe("block renderer (doc 05b §9 worked example)", () => {
  const web = resolve({ type: "block", x: 0, y: 0, color: "blue", glyph: "server", label: ["Web", "server"] }) as BlockP;
  const r = renderBlock(web);
  it("produces the documented silhouette, bounds and empty overlay", () => {
    expect(r.body).toContain(
      "M-8.94,-69.53 Q0,-74 8.94,-69.53 L47.95,-50.02 Q56,-46 56,-37 L56,-9 Q56,0 47.95,4.02 L10.73,22.63 Q0,28 -10.73,22.63 L-47.95,4.02 Q-56,0 -56,-9 L-56,-37 Q-56,-46 -47.95,-50.02 Z",
    );
    expect(r.body).toContain("M-56,-46 L-7.16,-21.58 Q0,-18 7.16,-21.58 L56,-46");
    expect(r.body).toContain('y="-19.9"');
    expect(r.body).toContain('y="-4.4"');
    expect(r.bounds).toEqual([-64, -108, 64, 42]);
    expect(r.over.trim()).toBe("");
    expect(r.poly).toEqual([[0, -74], [56, -46], [56, 0], [0, 28], [-56, 0], [-56, -46]]);
  });
});

describe("dark recolor", () => {
  it("maps palette colours and leaves upper-case tokens alone", () => {
    expect(darkColor("#fee6cc")).toBe("#604b34");
    expect(darkColor("#a59c90")).toBe("#726657");
    expect(darkColor("#8f2a22")).toBe("#ebb2ad");
    expect(darkColor("#a8916f")).toBe("#a8916f");
    expect(recolor('fill="#E5534B" stroke="#8f2a22"', true)).toBe('fill="#E5534B" stroke="#ebb2ad"');
    expect(recolor('fill="#8f2a22"', false)).toBe('fill="#8f2a22"');
  });
});

describe("panel", () => {
  it("sizes cards from text, bars and charts", () => {
    const base: Parameters<typeof panelSize>[0] = { title: "T", lines: ["a"], chart: null, bars: [], w: 0 };
    expect(panelSize({ ...base, lines: ["a"] }).h).toBe(34 + 18 + 6);
    expect(panelSize({ ...base, chart: "hockey" }).w).toBeGreaterThanOrEqual(220);
    expect(panelSize({ ...base, chart: "hockey" }).h).toBe(34 + 18 + 96 + 22 + 6);
    const bars = panelSize({ ...base, chart: "bars", bars: [{ label: "x" }, { label: "y" }] });
    expect(bars.h).toBe(34 + 18 + 38 + 12 + 6);
    expect(bars.noteW).toBe(46);
  });
  it("hockey curve stays flat then explodes", () => {
    expect(hockeyCurve(0)).toBeCloseTo(0.06);
    expect(hockeyCurve(0.5)).toBeCloseTo(0.12);
    expect(hockeyCurve(0.97)).toBe(1);
  });
});

describe("labels", () => {
  it("finds points along a polyline by arc fraction", () => {
    const p = pointAlong([[0, 0], [10, 0], [10, 10]], 0.75);
    expect(p).toMatchObject({ x: 10, y: 5, dx: 0, dy: 1 });
  });
  it("prefers the free side of a horizontal line", () => {
    const blocked = (r: [number, number, number, number]) => (r[1] < 0 ? 1000 : 0);
    const at = placeLabel([[0, 0], [200, 0]], 0.5, 60, blocked);
    expect(at.cy).toBeGreaterThan(0);
    expect(at.cx).toBeCloseTo(100);
  });
  it("wraps long labels into balanced lines", () => {
    expect(wrapLabel("SELECT … FROM products")).toBe("SELECT …\nFROM products");
    expect(wrapLabel("short")).toBeNull();
  });
  it("charges for polygon hits and nearby line samples", () => {
    const poly: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(polyHitsRect(poly, [5, 5, 20, 20])).toBe(true);
    expect(polyHitsRect(poly, [20, 20, 30, 30])).toBe(false);
    expect(labelCost([5, 5, 20, 20], { polys: [poly], boxes: [] }, [])).toBe(170);
    expect(labelCost([0, 0, 10, 10], { polys: [], boxes: [] }, [[5, 5]])).toBe(18);
  });
});

describe("framing", () => {
  const vp = { width: 900, height: 500, hudScale: 1.15, showCards: true };
  const anchors: Record<string, Pt> = { a: [2, 3] };
  it("resolves link point references with offsets", () => {
    expect(resolvePoint("a", (id) => anchors[id])).toEqual([2, 3]);
    expect(resolvePoint("a+1.5", (id) => anchors[id])).toEqual([3.5, 4.5]);
    expect(resolvePoint([5, "a-1"], (id) => anchors[id])).toEqual([5, 2]);
  });
  it("quantises zoom to 0.05 steps with a floor", () => {
    expect(quantizeZoom(1.2399)).toBe(1.2);
    expect(quantizeZoom(0.1)).toBe(0.3);
    expect(quantizeZoom(1.25)).toBe(1.25);
  });
  it("docks cards in corners with margins", () => {
    const size = cardFootprint({ w: 200, h: 100 }, 1);
    expect(size).toEqual({ w: 200, h: 104 });
    expect(dockRect("tr", size, 900, 500)).toEqual([690, 16, 890, 120]);
    expect(dockRect("bl", size, 900, 500)).toEqual([10, 386, 210, 490]);
  });
  const scene: Scene = {
    entities: {
      dev: { type: "device", x: 0, y: -12, label: "you" },
      web: { type: "block", x: 10, y: -1, label: ["Web", "Server"] },
    },
    links: { h: { from: "dev", to: "web", pts: ["dev", ["web", "dev"], "web"], heads: "both", label: "GET /products" } },
  };
  it("plans a centred camera capped at 1.6× and keeps it for a fitting next step", () => {
    const p = planFor(scene, null, vp);
    expect(p.zoom).toBeLessThanOrEqual(1.6);
    expect(p.cam.w).toBeCloseTo(900 / p.zoom);
    expect(p.picks.h.label).toBe("GET /products");
    const layout = layoutOf(scene, vp);
    const [x0, y0, x1, y1] = layout.b;
    expect(p.cam.x + p.cam.w / 2).toBeCloseTo((x0 + x1) / 2);
    expect(p.cam.y + p.cam.h / 2).toBeCloseTo((y0 + y1) / 2);
    const next = planFor({ ...scene, links: {} }, p, vp);
    expect(next.cam).toBe(p.cam);
  });
  it("docks a panel where it clears the diagram", () => {
    const withCard: Scene = { ...scene, entities: { ...scene.entities, card: { type: "panel", title: "Where the time went", lines: ["a", "b"] } } };
    const p = planFor(withCard, null, vp);
    expect(p.corner).not.toBeNull();
    expect(p.dock).not.toBeNull();
  });
});

describe("packets", () => {
  it("applies kind speed factors", () => {
    expect(packetSpeed("req")).toBe(155);
    expect(packetSpeed("heavy")).toBeCloseTo(108.5);
    expect(packetSpeed("slow", 2)).toBeCloseTo(99.2);
  });
  it("keeps clear of arrowheads", () => {
    expect(travelSpan(100, "end", "solid")).toEqual([0, 84]);
    expect(travelSpan(100, "both", undefined)).toEqual([16, 84]);
    expect(travelSpan(100, "both", "cut")).toEqual([0, 100]);
    expect(travelSpan(30, "both", "solid")).toEqual([0, 30]);
  });
  it("round-robins alternatives and patterns", () => {
    const f: FlowState = { route: ["in", ["a", "b"]], rate: 1, pattern: ["req", "heavy"], acc: 0, n: 0, rr: 0 };
    expect(pickRoute(f)).toEqual({ route: ["in", "a"], kind: "req" });
    expect(pickRoute(f)).toEqual({ route: ["in", "b"], kind: "heavy" });
    const g: FlowState = { routes: [{ path: ["x"], weight: 1 }, { path: ["y"], weight: 3, kind: "write" }], pick: "weights", rate: 1, acc: 0, n: 0, rr: 0 };
    expect(pickRoute(g, () => 0.1).route).toEqual(["x"]);
    expect(pickRoute(g, () => 0.9)).toEqual({ route: ["y"], kind: "write" });
  });
});

describe("gestures", () => {
  it("detects horizontal swipes only", () => {
    expect(swipeDir(-80, 10, 300, false)).toBe(1);
    expect(swipeDir(80, 10, 300, false)).toBe(-1);
    expect(swipeDir(80, 60, 300, false)).toBe(0);
    expect(swipeDir(80, 0, 800, false)).toBe(0);
    expect(swipeDir(80, 0, 300, true)).toBe(0);
    expect(swipeDir(40, 0, 300, false)).toBe(0);
  });
  it("scales line-mode wheel deltas", () => {
    expect(wheelZoomFactor(100, 0)).toBeCloseTo(Math.exp(-1));
    expect(wheelZoomFactor(3, 1)).toBeCloseTo(Math.exp(-0.48));
  });
});
