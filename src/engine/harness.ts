// Dev harness for the diagram engine (served at /engine-harness.html by `vite`). Not part of the app build.
import "@fontsource-variable/jetbrains-mono";
import type { Block, Db, Device, Link, Panel, Scene, Tag } from "../types/lesson";
import { Engine } from "./Engine";

// ── presets (modelled on lesson 1 "How a Request Travels") ──────────────────
const server = (x: number, y: number, o: Partial<Block> = {}): Block => ({ type: "block", x, y, color: "blue", glyph: "server", ...o });
const balancer = (x: number, y: number, o: Partial<Block> = {}): Block => ({
  type: "block", x, y, color: "orange", glyph: "balancer", label: ["Load", "Balancer"], pills: "below", ...o,
});
const device = (x: number, y: number, o: Partial<Device> = {}): Device => ({ type: "device", x, y, ...o });
const db = (x: number, y: number, o: Partial<Db> = {}): Db => ({ type: "db", x, y, ...o });
const link = (from: string, to: string, pts: Link["pts"], o: Partial<Link> = {}): Link => ({ from, to, pts, heads: "end", ...o });
const url: Tag = { text: "https://shop.example", icon: "globe" };
const you = (tags: Tag[] = [url]) => device(0, -12, { label: "you", tags });
const dns = (o: Partial<Block> = {}) => server(0, 1, { color: "yellow", glyph: "globe", label: ["DNS"], sub: "resolver", ...o });
const web = (o: Partial<Block> = {}) => server(10, -1, { label: ["Web", "Server"], ...o });
const database = (o: Partial<Db> = {}) => db(10, 12, { label: "database", ...o });
const L = {
  dns: (o: Partial<Link> = {}) => link("dev", "dns", ["dev", "dns"], { heads: "both", label: "where is shop.example?", ...o }),
  web: (o: Partial<Link> = {}) => link("dev", "web", ["dev", ["web", "dev"], "web"], { heads: "both", ...o }),
  db: (o: Partial<Link> = {}) => link("web", "db", ["web", "db"], { heads: "both", label: "SELECT … FROM products", ...o }),
};
const cached = L.dns({ style: "off", label: "cached · 5 min" });
const timing: Panel = {
  type: "panel", x: 0, y: -12, z: 0, dx: -175, dy: -290, title: "Where the time went", icon: "timer",
  lines: [
    "DNS lookup           20 ms",
    "TCP + TLS handshake  60 ms",
    "request + server     55 ms",
    "download             20 ms",
    "= total             155 ms",
    "# 130 ms of it is waiting on the network",
  ],
};
const DOWN = { dead: 1, heat: 0, cpu: -1, tags: [{ text: "DOWN", tone: "red", icon: "alert" }] } satisfies Partial<Block>;

const steps: { name: string; scene: Scene }[] = [
  { name: "1 · you + url", scene: { entities: { dev: you() }, links: {}, flows: [] } },
  {
    name: "2 · DNS lookup",
    scene: {
      entities: { dev: you(), dns: dns({ tags: [{ text: "→ 203.0.113.7", tone: "amber" }] }) },
      links: { q: L.dns() },
      flows: [{ route: ["q"], bounce: true, rate: 0.8 }],
    },
  },
  {
    name: "3 · handshake (ping)",
    scene: {
      entities: { dev: you(), dns: dns(), web: web() },
      links: { q: cached, h: L.web({ label: "TCP + TLS handshake" }) },
      flows: [{ route: ["h"], kind: "ping", bounce: true, rate: 1.3 }],
    },
  },
  {
    name: "4 · GET (label swap, cpu)",
    scene: {
      entities: { dev: you(), dns: dns(), web: web({ cpu: 0.3 }) },
      links: { q: cached, h: L.web({ label: "GET /products" }) },
      flows: [{ route: ["h"], bounce: true, rate: 0.9 }],
    },
  },
  {
    name: "5 · database round trip (hold)",
    scene: {
      entities: { dev: you(), dns: dns(), web: web({ cpu: 0.3 }), db: database() },
      links: { q: cached, h: L.web({ label: "GET /products" }), s: L.db() },
      flows: [{ route: ["h", "s"], bounce: true, rate: 0.6, hold: 1.4 }],
    },
  },
  {
    name: "6 · timing panel",
    scene: {
      entities: { dev: you(), dns: dns(), web: web({ cpu: 0.35 }), db: database(), card: timing },
      links: { q: cached, h: L.web({ label: "HTML · 120 KB" }), s: L.db() },
      flows: [{ route: ["h", "s"], bounce: true, rate: 1.1 }],
    },
  },
  {
    name: "7 · LB + crowd + fanout + bars",
    scene: {
      entities: {
        users: { type: "crowd", x0: -16, x1: -8, y0: -6, y1: 6, count: 24, label: "10k users" },
        lb: balancer(0, 0, { cpu: 0.4 }),
        a: server(10, -7, { label: ["App 1"], cpu: 0.5 }),
        b: server(10, 0, { label: ["App 2"], cpu: 0.7 }),
        c: server(10, 7, { label: ["App 3"], cpu: 0.9, heat: 1 }),
        card: {
          type: "panel", title: "Load per server", icon: "gauge", chart: "bars",
          lines: ["round-robin spreads **evenly**"],
          bars: [
            { label: "App 1", to: 0.5, tone: "green", note: "50%" },
            { label: "App 2", to: 0.7, tone: "amber", note: "70%" },
            { label: "App 3", to: 0.9, tone: "red", note: "90%", bold: true },
          ],
        },
      },
      links: {
        in: link("users", "lb", ["users", "lb"], { label: "requests" }),
        la: link("lb", "a", ["lb", ["lb", "a"], "a"]),
        lbb: link("lb", "b", ["lb", "b"]),
        lc: link("lb", "c", ["lb", ["lb", "c"], "c"]),
      },
      flows: [
        { route: ["in"], rate: 2 },
        { routes: [{ path: ["la"] }, { path: ["lbb"] }, { path: ["lc"], kind: "heavy" }], fanout: true, rate: 0.7 },
      ],
    },
  },
  {
    name: "8 · server down (cut/fail/beat, hockey)",
    scene: {
      entities: {
        users: { type: "crowd", x0: -16, x1: -8, y0: -6, y1: 6, count: 36, label: "10k users" },
        lb: balancer(0, 0, { cpu: 0.8 }),
        a: server(10, -7, { label: ["App 1"], cpu: 0.95, heat: 1 }),
        b: server(10, 0, { label: ["App 2"], ...DOWN }),
        c: server(10, 7, { label: ["App 3"], cpu: 0.95, heat: 1 }),
        card: {
          type: "panel", title: "Latency vs load", icon: "chartLine", chart: "hockey", marker: 0.92,
          lines: ["! past ~80% latency explodes"],
        },
      },
      links: {
        in: link("users", "lb", ["users", "lb"], { label: "requests", fail: 0.25 }),
        la: link("lb", "a", ["lb", ["lb", "a"], "a"]),
        lbb: link("lb", "b", ["lb", "b"], { style: "cut", label: "no response", labelTone: "red" }),
        lc: link("lb", "c", ["lb", ["lb", "c"], "c"], { style: "beat" }),
      },
      flows: [
        { route: ["in"], rate: 3 },
        { route: [["la", "lc"]], rate: 2, kind: "slow" },
      ],
    },
  },
  {
    name: "9 · queue, zone, ghost, phone, dashed",
    scene: {
      entities: {
        region: { type: "zone", x0: -4, x1: 16, y0: -10, y1: 10, label: "us-east-1" },
        phone: device(-12, 0, { form: "phone", label: "mobile app" }),
        api: server(0, 0, { label: ["API"], color: "green" }),
        q: { type: "queue", x: 7, y: 0, n: 5, dir: [1, 0] },
        worker: server(13, 0, { label: ["Worker"], color: "purple", glyph: "cpu" }),
        future: { type: "ghost", x: 13, y: 8, s: 4, h: 46, label: "worker 2?" },
      },
      links: {
        req: link("phone", "api", ["phone", "api"], { label: "POST /order" }),
        enq: link("api", "worker", ["api", "worker"], { style: "dashed", heads: "end" }),
      },
      flows: [
        { route: ["req"], rate: 1.2, kind: "write" },
        { route: ["enq"], rate: 1.2, kind: "msg", pattern: ["msg", "msg", "poison"] },
      ],
    },
  },
  {
    name: "10 · hash ring",
    scene: {
      entities: {
        ring: {
          type: "ring", x: 0, y: 0, r: 9, label: "hash ring",
          nodes: [{ a: 0.05, color: "blue" }, { a: 0.38, color: "green" }, { a: 0.7, color: "orange", mark: true }],
          keys: [0.12, 0.2, 0.45, 0.5, 0.62, 0.8, 0.93], moved: [0.62],
        },
      },
      links: {},
      flows: [],
    },
  },
];

// ── wiring ──────────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $("canvas");
const engine = new Engine(canvas);
const w = window as unknown as { engine: Engine; harnessErrors: string[] };
w.engine = engine;
w.harnessErrors = [];
const scenes = steps.map((s) => s.scene);
let i = Number(new URLSearchParams(location.search).get("step") || 1) - 1;
i = Math.max(0, Math.min(steps.length - 1, i));

const show = (instant = false) => {
  engine.goTo(scenes[i], { instant });
  $("label").textContent = `${steps[i].name}  (${i + 1}/${steps.length})`;
};
const go = (d: number) => {
  const n = i + d;
  if (n < 0 || n >= steps.length) return;
  i = n;
  show();
};

engine.onSwipe = (d) => go(d);
engine.onView = (manual) => ($("fit").hidden = !manual);
engine.onCards = (docked) => document.documentElement.classList.toggle("cards-inline", !docked);
engine.frame(scenes);
if (i > 0) engine.goTo(scenes[i - 1], { instant: true });
show(new URLSearchParams(location.search).has("instant"));

$("prev").onclick = () => go(-1);
$("next").onclick = () => go(1);
$("replay").onclick = () => {
  if (i > 0) engine.goTo(scenes[i - 1], { instant: true });
  else engine.clear();
  show();
};
$("pause").onclick = () => {
  engine.paused = !engine.paused;
  $("pause").textContent = engine.paused ? "play" : "pause";
};
$("theme").onclick = () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  engine.retheme();
};
$("fit").onclick = () => engine.fit();
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === " ") $("pause").click();
  else if (e.key === "0") engine.fit();
});
addEventListener("error", (e) => w.harnessErrors.push(String(e.message)));

