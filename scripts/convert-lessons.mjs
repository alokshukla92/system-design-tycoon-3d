// One-time conversion: system-design-tycoon "Learn" lessons → engine lesson JSON (doc 12).
// Usage: node --no-warnings scripts/convert-lessons.mjs [path/to/lessons.ts]
// The source repo is read-only; the generated src/content/lessons/*.json files are the committed
// source of truth. Part 1 applies the mechanical rules (doc 12 §2–§5); part 2 is the hand
// enrichment (doc 12 §7), kept here so it stays reviewable next to the rules it extends.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC =
  process.argv[2] ?? "/Users/alokshukla/Desktop/AlokPrivate/Projects/system-design-tycoon/src/lib/learn/lessons.ts";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "../src/content/lessons");
const { LEARN_MODULES } = await import(SRC);

// ── Part 1: mechanical rules ─────────────────────────────────────────────────
const COL_GAP = 12;
const ROW_GAP = 9;
const r1 = (n) => Math.round(n * 10) / 10 || 0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rateFor = (rps) => r1(clamp(0.6 + 0.5 * Math.log10(Math.max(1, rps)), 0.6, 3));

const CHAPTER = { Problem: "setup", Symptom: "problem", Technique: "technique", Tradeoff: "tradeoff", Recap: "recap" };

// Appendix A
const SHORTS = {
  "day-one": ["Weekend MVP", "HN front page", "Traffic spike", "Scale up", "The cost"],
  "the-slow-burn": ["Slow dashboard", "10× data", "Promo scans", "Add an index", "Index cost"],
  chatterbox: ["Repeat reads", "Fan surge", "40k online", "Add a cache", "Cache costs"],
  "the-3am-page": ["The SLA", "Early tremor", "Primary dies", "Replicate", "Buy uptime"],
  "picture-this": ["Max box", "App Store #3", "Crash", "Scale out", "Scale-out cost"],
  "a-million-little-writes": ["Disk ceiling", "3× writes", "Hot key", "Shard it", "Key choice"],
  surge: ["GPS pings", "Rush hour", "Concert burst", "Add a queue", "Eventual"],
  checkout: ["Payments", "Big Sale", "Mid-sale crash", "Idempotency", "CAP cost"],
  "the-stream-must-flow": ["One region", "Global load", "Region down", "Go global", "Right-size DR"],
  "planet-scale": ["100M users", "Peak load", "Outage again", "Fail small", "Recap"],
};

// §4 goals (hand-worded): [symptom → step 2, concept → step 3, trade-off → step 4]
const GOALS = {
  "day-one": ["See why latency explodes before capacity runs out", "Know what vertical scaling costs"],
  "the-slow-burn": ["See why full scans slow down as data grows", "Know what indexes cost"],
  chatterbox: ["See why identical reads overwhelm the database", "Weigh freshness against hit ratio"],
  "the-3am-page": ["See why one primary is a single point of failure", "Know why availability is bought"],
  "picture-this": ["See why an unwatched instance fails requests", "Know what scaling out demands"],
  "a-million-little-writes": ["See why one hot entity swamps a single primary", "Know why shard keys are nearly permanent"],
  surge: ["See why synchronous writes must absorb the peak", "Know what eventual consistency costs"],
  checkout: ["See why a retry can double-charge a customer", "Know when strong consistency is worth it"],
  "the-stream-must-flow": ["See why one region can't survive a regional outage", "Buy only the DR your SLA requires"],
  "planet-scale": ["See how failures compound at global scale", "Recap every technique in one diagram"],
};

// §3 `.term` spans: first occurrence in the lesson (search concepts)
const TERMS = {
  "day-one": ["queueing", "vertical scaling"],
  "the-slow-burn": ["full scan", "index", "B-tree"],
  chatterbox: ["cache stampede", "cache-aside", "TTL jitter", "request coalescing"],
  "the-3am-page": ["single point of failure", "replication", "observability"],
  "picture-this": ["load balancer", "autoscaling", "CDN", "stateless services"],
  "a-million-little-writes": ["sharding", "shard key", "scatter-gather"],
  surge: ["queue", "backlog", "partition count"],
  checkout: ["exactly-once", "idempotency keys", "CAP theorem", "two-phase commit", "sagas"],
  "the-stream-must-flow": ["CDN", "multi-region", "active-active"],
  "planet-scale": ["composition", "cost-performance"],
};

const md = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

const BLOCK = {
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
const DBS = new Set(["postgres", "mysql", "mongodb", "cassandra", "dynamodb"]);
const COMPUTE = new Set(["api_server", "worker", "k8s_cluster", ...DBS]);
const STATUS = { warn: { heat: 0.35, cpu: 0.78 }, crit: { heat: 1, cpu: 0.97 } };
const DOWN_TAG = { text: "DOWN", tone: "red", icon: "alert" };

function parseMetrics(list) {
  const get = (k) => list.find((m) => m.key === k).value;
  const u = /^([\d.]+)([kM]?)$/.exec(get("users"));
  const users = Math.round(Number(u[1]) * (u[2] === "M" ? 1e6 : u[2] === "k" ? 1e3 : 1));
  return {
    users,
    rps: Number(get("rps").replace(/,/g, "")),
    p95: Number(get("latency").replace(/ ms$/, "")),
    // Numbers (not "0.1%" strings) so the original level() colours them; the original fmt rounds.
    errors: Number(get("error").replace(/%$/, "")),
  };
}

function entity(n, maxCol, users) {
  const y = r1((n.col - maxCol / 2) * COL_GAP);
  const x = r1(n.row * ROW_GAP);
  const st = n.status ?? "ok";
  if (n.kind === "users") {
    const count = clamp(Math.round(2 * Math.log10(users)), 3, 12);
    return { type: "crowd", x0: r1(x - 4), x1: r1(x + 4), y0: r1(y - 3), y1: r1(y + 3), count, label: n.label };
  }
  const visual = st === "ok" ? (COMPUTE.has(n.kind) ? { cpu: 0.3 } : {}) : st === "muted" ? { dim: 1 } : { ...STATUS[st] };
  if (DBS.has(n.kind)) {
    const { dim, ...rest } = visual;
    return {
      type: "db", x, y, label: n.label,
      ...(n.sub ? { tags: [{ text: n.sub }] } : {}),
      ...rest,
      ...(dim ? { opacity: 0.5 } : {}),
    };
  }
  // Original block labels are one word per line (max 2 lines); a " — " suffix becomes the sub-line.
  const [name, suffix] = n.label.split(" — ");
  const words = name.split(" ");
  const label = words.length <= 2 ? words : [words[0], words.slice(1).join(" ")];
  const sub = n.sub ?? suffix;
  return { type: "block", x, y, ...BLOCK[n.kind], label, ...(sub ? { sub } : {}), ...visual };
}

function link(e) {
  const l = { from: e.from, to: e.to, pts: [e.from, e.to] };
  if (e.packet) l.label = e.packet;
  if (e.animate === "none") l.style = "off";
  if (e.animate === "error") l.fail = 0.35;
  return l;
}

/** §5.5 flow synthesis over active (non-"off") edges. */
function synthFlows(diagram, links, rps) {
  const kind = Object.fromEntries(diagram.nodes.map((n) => [n.id, n.kind]));
  const status = Object.fromEntries(diagram.nodes.map((n) => [n.id, n.status ?? "ok"]));
  const active = diagram.edges.filter((e) => links[e.id].style !== "off");
  const out = (id) => active.filter((e) => e.from === id);
  const sources = [...new Set(active.map((e) => e.from))].filter((id) => !active.some((e) => e.to === id));

  const walk = (id, seen) => {
    const groups = [];
    for (const e of out(id)) {
      if (seen.has(e.to)) continue;
      const g = groups.find((g) => kind[g[0].to] === kind[e.to]);
      if (g) g.push(e);
      else groups.push([e]);
    }
    if (!groups.length) return [{ steps: [], terminal: id }];
    return groups.flatMap((g) => {
      const step = g.length > 1 ? g.map((e) => e.id) : g[0].id;
      return walk(g[0].to, new Set([...seen, id])).map((r) => ({ steps: [step, ...r.steps], terminal: r.terminal }));
    });
  };

  const rate = rateFor(rps);
  const slow = (t) => status[t] === "warn" || status[t] === "crit";
  return sources.map((src) => {
    const routes = walk(src, new Set());
    if (routes.length === 1) {
      const [r] = routes;
      return { route: r.steps, ...(slow(r.terminal) ? { kind: "slow" } : {}), bounce: true, rate };
    }
    // Different roles → weighted `routes` (equal per branch); round-robin arrays are expanded.
    const expanded = routes.flatMap((r) => {
      let paths = [{ path: [], share: 1 }];
      for (const s of r.steps) {
        const alts = Array.isArray(s) ? s : [s];
        paths = paths.flatMap((p) => alts.map((a) => ({ path: [...p.path, a], share: p.share / alts.length })));
      }
      return paths.map((p) => ({ ...p, slow: slow(r.terminal) }));
    });
    const scale = Math.max(...expanded.map((p) => 1 / p.share));
    return {
      routes: expanded.map((p) => ({
        path: p.path,
        ...(p.slow ? { kind: "slow" } : {}),
        weight: Math.round(p.share * scale),
      })),
      pick: "weights",
      bounce: true,
      rate,
    };
  });
}

/** "Open in Design Lab": the step's original architecture (source kinds, not iso entities). */
function labGraph(diagram, metrics) {
  return {
    users: metrics.users,
    rps: metrics.rps,
    nodes: diagram.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      label: n.label,
      ...(n.sub ? { sub: n.sub } : {}),
      ...(n.status && n.status !== "ok" ? { status: n.status } : {}),
    })),
    edges: diagram.edges.map((e) => ({ from: e.from, to: e.to })),
  };
}

function wrapTerms(steps, terms) {
  for (const term of terms) {
    const re = new RegExp(`(?<![\\w-])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\w-])`, "i");
    outer: for (const s of steps)
      for (let i = 0; i < s.body.length; i++)
        if (re.test(s.body[i])) {
          s.body[i] = s.body[i].replace(re, '<span class="term">$1</span>');
          break outer;
        }
  }
}

function convert(src) {
  const maxCol = Math.max(...src.steps.flatMap((s) => s.diagram.nodes.map((n) => n.col)));
  const shorts = SHORTS[src.id];
  const steps = src.steps.map((s, i) => {
    const metrics = parseMetrics(s.metrics);
    const entities = Object.fromEntries(s.diagram.nodes.map((n) => [n.id, entity(n, maxCol, metrics.users)]));
    const links = Object.fromEntries(s.diagram.edges.map((e) => [e.id, link(e)]));
    const step = { short: shorts[i], chapter: CHAPTER[s.kicker], title: s.title, body: s.body.map(md) };
    if (s.keyIdea) step.callout = { kind: "insight", text: md(s.keyIdea) };
    if (s.whatChanged && s.kicker === "Recap") {
      const li = s.whatChanged.map((c) => {
        const [lesson, concept] = c.split(" → ");
        return concept ? `<li><b>${md(lesson)}</b> → ${md(concept)}</li>` : `<li>${md(c)}</li>`;
      });
      step.body.push(`<ul class="takeaways">${li.join("")}</ul>`);
    } else if (s.whatChanged) {
      step.changes = s.whatChanged.map((c) => (/^(\+ |- |− )/.test(c) ? c : `~ ${c}`));
    }
    step.metrics = metrics;
    step.scene = { entities, links, flows: synthFlows(s.diagram, links, metrics.rps) };
    step.lab = labGraph(s.diagram, metrics);
    return step;
  });
  wrapTerms(steps, TERMS[src.id]);
  const [g2, g4] = GOALS[src.id];
  return {
    id: src.id,
    title: src.title,
    summary: `${src.project}. ${src.summary}`,
    minutes: src.minutes,
    level: src.level.toLowerCase(),
    metrics: ["users", "rps", "p95", "errors"],
    legend: [],
    goals: [
      { text: g2, step: 2 },
      { text: src.concept, step: 3 },
      { text: g4, step: 4 },
    ],
    steps,
  };
}

// ── Part 2: hand enrichment (doc 12 §7) ──────────────────────────────────────
const panel = (p) => ({ type: "panel", ...p });
const ent = (step, id) => step.scene.entities[id];
const lk = (step, id) => step.scene.links[id];
const rateOf = (step) => rateFor(step.metrics.rps);
const tag = (e, t) => (e.tags = [...(e.tags ?? []), t]);

/** DOWN preset (§5.4). `db` has no `dead` field, so a dead cylinder is emptied, faded and tagged. */
function down(step, id, cutLinks) {
  const e = ent(step, id);
  const tags = [DOWN_TAG, ...(e.tags ?? [])];
  if (e.type === "db") Object.assign(e, { heat: 0, cpu: -1, opacity: 0.6, tags });
  else Object.assign(e, { dead: 1, heat: 0, cpu: -1, tags });
  for (const l of cutLinks) Object.assign(lk(step, l), { style: "cut", fail: 1 });
}

const ENRICH = {
  "day-one"(s) {
    const hockey = { title: "Why it explodes", icon: "gauge", chart: "hockey" };
    s[2].scene.entities.card = panel({
      ...hockey, marker: 0.97,
      lines: ["wait ∝ 1 / (1 − utilisation)", "! 97% busy → queue grows without bound"],
    });
    s[2].scene.flows[0].pattern = ["req", "req", "slow"];
    s[3].scene.entities.card = panel({
      ...hockey, marker: 0.55,
      lines: ["wait ∝ 1 / (1 − utilisation)", "= XL box → back under ~80% busy"],
    });
    for (const st of [s[3], s[4]]) Object.assign(ent(st, "api"), { s: 5, h: 62 });
  },
  "the-slow-burn"(s) {
    s[1].scene.flows[0].hold = 0.6;
    s[2].scene.flows[0].hold = 1.2;
    s[3].scene.entities.card = panel({
      title: "Scan vs index", icon: "search", chart: "bars",
      lines: ["# 10× the documents → 10× the scan", "= 5 s scans → 5 ms lookups"],
      bars: [
        { label: "Full scan · O(n)", note: "5 s", to: 1, tone: "red" },
        { label: "B-tree · O(log n)", note: "5 ms", to: 0.02, tone: "green", bold: true },
      ],
    });
  },
  chatterbox(s) {
    for (const st of [s[3], s[4]]) {
      lk(st, "e3").style = "dashed";
      st.scene.flows = [{
        routes: [
          { path: ["e1", "e2"], weight: 9 },
          { path: ["e1", "e2", "e3"], kind: "slow", weight: 1 },
        ],
        pick: "weights", bounce: true, rate: rateOf(st),
      }];
    }
    s[3].scene.entities.card = panel({
      title: "Cache-aside", icon: "zap",
      lines: ["hit → Redis in ~1 ms", "miss → MongoDB, then fill the cache", "= hot reads: 2200 ms → 60 ms", "! hot key expires → stampede on the DB"],
    });
  },
  "the-3am-page"(s) {
    down(s[2], "db", ["e3"]);
    s[2].metrics.p95 = null; // source says 0 ms while 100% of requests fail → original p95 fmt shows "timeout"
    for (const st of [s[3], s[4]]) {
      lk(st, "e4").style = "beat";
      st.scene.flows.push({ route: ["e4"], kind: "ping", rate: 0.8 });
    }
    s[3].scene.entities.card = panel({
      title: "Replication", icon: "layers",
      lines: ["primary → replica: async copy", "= primary dies → replica serves", "! replicas lag under write load"],
    });
  },
  "picture-this"(s) {
    down(s[2], "api", ["e1"]);
    lk(s[2], "e2").style = "off";
    s[2].scene.flows = [{ route: ["e1"], bounce: true, rate: rateOf(s[2]) }];
    s[3].scene.entities.card = panel({
      title: "Scale out", icon: "server", chart: "hockey", marker: 0.6,
      lines: ["1 box at 97% → queue explodes", "= N pods at ~60% each", "! new pods take minutes to arrive"],
    });
  },
  "a-million-little-writes"(s) {
    tag(ent(s[2], "db"), { text: "1 hot row", tone: "red", icon: "flame" });
    s[3].scene.entities.card = panel({
      title: "Shard key", icon: "split", chart: "bars",
      lines: ["hash(user_id) % 3 → shard", "= each shard takes ~⅓ of the writes", "! monotonic key → every new write hits one shard"],
      bars: [
        { label: "Monotonic key", note: "1 shard", to: 1, tone: "red" },
        { label: "Hashed key", note: "~⅓ each", to: 0.33, tone: "green", bold: true },
      ],
    });
  },
  surge(s) {
    const backlog = (n) => ({ type: "queue", x: 3, y: 3.5, n, gap: 0.9, dir: [0, -1] });
    s[1].scene.entities.backlog = backlog(6);
    s[2].scene.entities.backlog = backlog(10);
    for (const st of [s[3], s[4]]) {
      st.scene.entities.backlog = backlog(3);
      st.scene.flows = [
        { route: ["e1", "e2", "e3"], bounce: true, rate: rateOf(st) },
        { route: ["e4", "e5"], kind: "msg", rate: 1.2 },
      ];
    }
    s[3].scene.entities.card = panel({
      title: "Shock absorber", icon: "inbox",
      lines: ["producers get an instant ack", "workers drain at a sustainable rate", "= the DB sees a smooth stream", "! drain < arrival forever → backlog grows forever"],
    });
  },
  checkout(s) {
    tag(ent(s[2], "k8s"), { text: "pod died", tone: "red", icon: "skull" });
    Object.assign(s[2].scene.flows[0], { pattern: ["req", "req", "slow"], hold: 0.6 });
    for (const st of [s[3], s[4]]) {
      delete lk(st, "e4").style;
      st.scene.flows = [
        { route: ["e1", "e2", "e3"], bounce: true, rate: rateOf(st) },
        { route: ["e4"], bounce: true, rate: 1.2 },
      ];
    }
    s[3].scene.entities.card = panel({
      title: "Idempotency key", icon: "key",
      lines: ["a retry carries the same key", "key seen? → return the stored result", "= the duplicate becomes a no-op", "! every write path needs the dedup check"],
    });
  },
  "the-stream-must-flow"(s) {
    const zoneA = { type: "zone", x0: -4.5, x1: 4.5, y0: 1.5, y1: 21.5, label: "REGION A · US-EAST" };
    const zoneB = { type: "zone", x0: 5.4, x1: 14.4, y0: 1.5, y1: 21.5, label: "REGION B · EU-WEST" };
    s.forEach((st, i) => {
      st.scene.entities = { zoneA, ...(i >= 3 ? { zoneB } : {}), ...st.scene.entities };
    });
    tag(ent(s[2], "k8s"), { text: "½ capacity lost", tone: "red", icon: "alert" });
    for (const st of [s[3], s[4]]) {
      lk(st, "e4").style = "dashed";
      delete lk(st, "e6").style;
      st.scene.flows.push({ route: ["e6"], kind: "write", rate: 0.8 });
    }
    s[3].scene.entities.card = panel({
      title: "Disaster recovery tiers", icon: "shield", chart: "bars",
      lines: ["# recovery time · each tier costs ~10× more"],
      bars: [
        { label: "Backups", note: "hours", to: 1, tone: "red" },
        { label: "Warm standby", note: "minutes", to: 0.35, tone: "amber" },
        { label: "Active-active", note: "seconds", to: 0.06, tone: "green", bold: true },
      ],
    });
  },
  "planet-scale"(s) {
    const zone = { type: "zone", x0: -2.5, x1: 26, y0: -4.5, y1: 28, label: "PRIMARY REGION" };
    s.forEach((st) => (st.scene.entities = { zone, ...st.scene.entities }));
    for (const st of [s[3], s[4]]) {
      for (const id of ["e4", "e5", "e6", "e7"]) delete lk(st, id).style;
      st.scene.flows = [{
        routes: [
          { path: ["e1"], weight: 3 },
          { path: ["e2", "e3", "e4"], weight: 3 },
          { path: ["e2", "e3", "e5", "e7"], kind: "write", weight: 2 },
          { path: ["e2", "e3", "e6"], weight: 1 },
        ],
        pick: "weights", bounce: true, rate: rateOf(st),
      }];
    }
    s[3].scene.entities.card = panel({
      title: "Fail small", icon: "layers",
      lines: ["CDN → edge reads", "cache → hot reads", "queue → write bursts", "shards → write load", "replicas & regions → failures", "= the composition saved you"],
    });
  },
};

// Legend from what each lesson actually shows (doc 12 §2 + extras introduced by enrichment).
const LEGEND_LABELS = { "the-stream-must-flow": { write: "cross-region sync" } };
function legendFor(lesson) {
  const kinds = new Set();
  let fail = false;
  let queue = false;
  for (const st of lesson.steps) {
    for (const f of st.scene.flows ?? []) {
      if (!f.pattern) kinds.add(f.kind ?? "req");
      (f.pattern ?? []).forEach((k) => kinds.add(k));
      (f.routes ?? []).forEach((r) => r.kind && kinds.add(r.kind));
    }
    fail ||= Object.values(st.scene.links ?? {}).some((l) => l.fail);
    queue ||= Object.values(st.scene.entities).some((e) => e.type === "queue");
  }
  const retry = lesson.steps.some((st) => (st.scene.flows ?? []).some((f) => f.hold && f.pattern?.includes("slow")));
  const legend = ["req", "res"];
  if (kinds.has("slow")) legend.push("slow");
  if (retry) legend.push("retry");
  if (queue) legend.push("queue");
  for (const k of ["msg", "write", "ping"]) {
    if (!kinds.has(k)) continue;
    const custom = LEGEND_LABELS[lesson.id]?.[k];
    legend.push(custom ? [k, custom] : k);
  }
  if (fail) legend.push("fail");
  return legend;
}

mkdirSync(OUT, { recursive: true });
const ids = [];
for (const mod of LEARN_MODULES)
  for (const src of mod.lessons) {
    const lesson = convert(src);
    ENRICH[lesson.id]?.(lesson.steps);
    lesson.legend = legendFor(lesson);
    writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
    ids.push(lesson.id);
  }
console.log(`wrote ${ids.length} lessons: ${ids.join(", ")}`);
