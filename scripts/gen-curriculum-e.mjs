// Generates curriculum part "e": module 09 Architecture + module 10 Security lessons.
// Original content (own storylines, products and wording). Usage: node scripts/gen-curriculum-e.mjs [lessonsDir].
// Overwrites only: one-codebase-or-many, whos-at-this-address, all-or-nothing, rivers-and-lakes,
// prove-it, not-so-fast, locked-boxes.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? new URL("../src/content/lessons/", import.meta.url).pathname;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── entity factories ────────────────────────────────────────────────────────
const OK = { cpu: 0.3 };
const WARN = { heat: 0.35, cpu: 0.78 };
const CRIT = { heat: 1, cpu: 0.97 };
const tag = (text, tone, icon) => ({ text, ...(tone ? { tone } : {}), ...(icon ? { icon } : {}) });
const DOWN = { tags: [tag("DOWN", "red", "alert")], dead: 1, heat: 0, cpu: -1 };
const crowd = (label, x0, y0, count = 10, w = 8, d = 6) => ({ type: "crowd", x0, x1: x0 + w, y0, y1: y0 + d, count, label });
const block = (x, y, label, color, glyph, extra = {}) => ({ type: "block", x, y, s: 3.6, color, glyph, label, ...extra });
const svc = (x, y, label, extra = {}) => block(x, y, label, "blue", "server", { ...OK, ...extra });
const gw = (x, y, label = ["API", "Gateway"], extra = {}) => block(x, y, label, "green", "balancer", { s: 3.6, h: 32, ...extra });
const dbe = (x, y, label, tags, extra = {}) => ({ type: "db", x, y, label, ...(tags ? { tags: tags.map((t) => (typeof t === "string" ? tag(t) : t)) } : {}), ...extra });
const dev = (x, y, label, extra = {}) => ({ type: "device", x, y, w: 5, d: 5, label, ...extra });
const ghost = (x, y, label, extra = {}) => ({ type: "ghost", x, y, s: 3.6, h: 40, label, ...extra });
const zone = (label, x0, x1, y0, y1) => ({ type: "zone", x0, x1, y0, y1, label });
const panel = (title, icon, lines, extra = {}) => ({ type: "panel", title, icon, lines, ...extra });
const bars = (title, icon, lines, list) => panel(title, icon, lines, { chart: "bars", bars: list });
const bar = (label, note, to, tone, bold) => ({ label, note, to, ...(tone ? { tone } : {}), ...(bold ? { bold } : {}) });
const L = (from, to, label, extra = {}) => ({ from, to, pts: [from, to], ...(label ? { label } : {}), ...extra });
const Lp = (from, to, pts, label, extra = {}) => ({ from, to, pts, ...(label ? { label } : {}), ...extra });
const rt = (route, extra = {}) => ({ route, rate: 1.6, ...extra });
const rts = (routes, extra = {}) => ({ routes: routes.map(([path, kind, weight]) => ({ path, ...(kind ? { kind } : {}), ...(weight ? { weight } : {}) })), rate: 1.6, ...extra });
const lab = (users, rps, nodes, edges) => ({
  users,
  rps,
  nodes: nodes.map(([id, kind, label, sub, status]) => ({ id, kind, label, ...(sub ? { sub } : {}), ...(status ? { status } : {}) })),
  edges: edges.map(([from, to]) => ({ from, to })),
});
const term = (t) => `<span class="term">${t}</span>`;
const takeaways = (items) => `<ul class="takeaways">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

// ── self-check (mirrors src/content/content.test.ts, so mistakes fail fast) ─
const ICONS = new Set(
  `book settings window scan search chevronRight chevronDown file flame scale shield box database eye zap users play arrowRight bookmark share check user userRound message server replay pause chevronLeft arrowLeft clock lock alert bulb info gauge heartPulse layers flag circleCheck network split target sparkles signal listOrdered keyboard globe cpu trendingUp dollar timer activity mail package chart gift video inbox bell smartphone send radio cart braces workflow refresh skull hourglass bot ban power unplug bug scroll chartLine waypoints siren key building creditCard fingerprint plane hotel car ticket puzzle rocket undo wifi eyeOff fileKey hash merge waves moon signpost idCard userCheck clipboard route sigma filter keyhole gitBranch gitCommit flask container toggle map zoomIn code boxes gitPull listChecks hammer packageCheck component sun menu close expand collapse zoomOut volume2 volumeX flow sheets`.split(" "),
);
function check(lesson) {
  const fail = (m) => {
    throw new Error(`${lesson.id}: ${m}`);
  };
  if (lesson.steps.length < 8 || lesson.steps.length > 11) fail(`${lesson.steps.length} steps`);
  for (const g of lesson.goals) if (g.step < 0 || g.step >= lesson.steps.length) fail(`goal ${g.text}`);
  lesson.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    if (!s.short || s.short.length > 14) fail(`${at} short "${s.short}"`);
    for (const k of lesson.metrics) if (!(k in s.metrics)) fail(`${at} missing metric ${k}`);
    for (const k of Object.keys(s.metrics)) if (!lesson.metrics.includes(k)) fail(`${at} extra metric ${k}`);
    for (const c of s.changes ?? []) if (!/^(\+ |- |~ )\S/.test(c)) fail(`${at} change ${c}`);
    const { entities, links = {}, flows = [] } = s.scene;
    if (Object.values(entities).filter((e) => e.type === "panel").length > 1) fail(`${at} >1 panel`);
    for (const [id, e] of Object.entries(entities)) {
      const icons = [...(e.tags ?? []).map((t) => t.icon).filter(Boolean)];
      if (e.type === "panel" && e.icon) icons.push(e.icon);
      if ((e.type === "db" || e.type === "block") && e.glyph && e.glyph !== "server" && e.glyph !== "balancer") icons.push(e.glyph);
      for (const ic of icons) if (!ICONS.has(ic)) fail(`${at} ${id} icon ${ic}`);
      if (e.type === "block" && e.label && e.label.length > 2) fail(`${at} ${id} label lines`);
    }
    for (const [lid, l] of Object.entries(links)) {
      for (const r of [l.from, l.to, ...l.pts.flat().filter((p) => typeof p === "string")])
        if (r && !entities[r.replace(/[+-][\d.]+$/, "")]) fail(`${at} link ${lid} → ${r}`);
    }
    for (const f of flows) {
      const paths = f.routes ? f.routes.map((r) => r.path) : [f.route];
      for (const p of paths) for (const lid of p.flat()) if (!links[lid] || links[lid].style === "off") fail(`${at} flow link ${lid}`);
    }
  });
}

function write(lesson) {
  check(lesson);
  writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
}

// ════════════════════════════════════════════════════════════════════════════
// 09.1 one-codebase-or-many — Brightbasket (grocery delivery)
// ════════════════════════════════════════════════════════════════════════════
{
  const users = () => crowd("Shoppers", -4, -25, 10);
  const SVC = [
    ["cat", "Catalog", -15, "Catalog DB"],
    ["cart", "Cart", -5, "Cart DB"],
    ["pay", "Payments", 5, "Payments DB"],
    ["recs", "Recs", 15, "Recs store"],
  ];
  const mono = (extra = {}) => block(0, 2, ["Monolith"], "blue", "boxes", { s: 6, h: 56, sub: "all features", ...OK, ...extra });
  const s1 = {
    entities: { users: users(), lb: gw(0, -11, ["Load", "Balancer"]), mono: mono(), db: dbe(0, 15, "Postgres", ["one schema"]) },
    links: { e1: L("users", "lb", "GET /aisle"), e2: L("lb", "mono", "route"), e3: L("mono", "db", "SQL") },
    flows: [rt(["e1", "e2", "e3"], { bounce: true })],
  };

  const s2 = clone(s1);
  s2.entities.teams = crowd("8 teams · 60 devs", -18, -1, 9, 7, 6);
  s2.entities.train = { type: "queue", x: -7.4, y: 2, n: 9, gap: 0.9, dir: [-1, 0], color: "#9b7fd1" };
  s2.entities.mono.tags = [tag("release train · Tuesdays", "amber", "clock")];
  s2.links.e4 = Lp("teams", "mono", ["teams", "mono"], "merge & wait", { labelAt: 0.3 });
  s2.flows.push(rt(["e4"], { kind: "write", rate: 1.2, speed: 0.6 }));

  const s3 = clone(s2);
  Object.assign(s3.entities.mono, CRIT, { tags: [tag("recs: memory leak", "red", "bug")] });
  s3.links.e2.fail = 0.7;
  s3.links.e2.label = "502";
  s3.flows = [rt(["e1", "e2", "e3"], { bounce: true, kind: "slow", rate: 2 })];

  const MODS = [
    ["mCat", "Catalog", -7, "orange", "book"],
    ["mCart", "Cart", 0, "blue", "cart"],
    ["mPay", "Payments", 7, "green", "creditCard"],
  ];
  const s4 = {
    entities: {
      users: users(),
      lb: gw(0, -11, ["Load", "Balancer"]),
      box: zone("ONE DEPLOY · MODULAR MONOLITH", -11, 11, -2.5, 6.5),
      db: dbe(0, 15, "Postgres", ["3 schemas, one per module"]),
    },
    links: {
      e1: L("users", "lb", "GET /aisle"),
      e2: L("lb", "mCart", "route"),
      m1: L("mCart", "mCat", "", { style: "dashed", heads: "end" }),
      m2: L("mCart", "mPay", "", { style: "dashed" }),
      e3: L("mCart", "db", "own schema"),
    },
    flows: [rt(["e1", "e2", "m1"], { bounce: true }), rt(["e1", "e2", "e3"], { bounce: true, rate: 1 })],
  };
  for (const [id, label, x, color, glyph] of MODS) s4.entities[id] = block(x, 2, [label], color, glyph, { s: 3.2, h: 34 });
  s4.entities.mCat.tags = [tag("public API only", "green", "shield")];

  const s5 = {
    entities: {
      users: users(),
      lb: gw(0, -11, ["Edge", "Router"], { tags: [tag("/recs → new service", "green", "route")] }),
      mono: mono({ s: 5, sub: "minus recs" }),
      db: dbe(0, 15, "Postgres", ["one schema"]),
      recs: svc(10.5, 2, ["Recs"], { sub: "own deploy", color: "purple" }),
      recsDb: dbe(10.5, 15, "Recs store"),
    },
    links: {
      e1: L("users", "lb", "GET /aisle"),
      e2: L("lb", "mono", "everything else"),
      e3: L("mono", "db", "SQL"),
      r1: Lp("lb", "recs", ["lb", ["recs", "lb"], "recs"], "/recs"),
      r2: L("recs", "recsDb"),
    },
    flows: [rts([[["e1", "e2", "e3"], null, 3], [["e1", "r1", "r2"], null, 1]], { pick: "weights", bounce: true, rate: 2 })],
  };

  const many = () => {
    const sc = { entities: { users: users(), lb: gw(0, -11) }, links: { e1: L("users", "lb", "GET /aisle") }, flows: [] };
    const routes = [];
    for (const [id, label, x, dbl] of SVC) {
      sc.entities[id] = svc(x, 2, [label], { sub: "own deploy" });
      sc.entities[`${id}Db`] = dbe(x, 14, dbl);
      sc.links[`g_${id}`] = L("lb", id);
      sc.links[`d_${id}`] = L(id, `${id}Db`);
      routes.push([["e1", `g_${id}`, `d_${id}`]]);
    }
    sc.flows = [rts(routes, { bounce: true, rate: 2.4 })];
    return sc;
  };
  const s6 = many();

  const s7 = many();
  s7.links.c1 = Lp("cart", "cat", ["cart", "cat"], "price?", { labelTone: "amber" });
  s7.links.c2 = Lp("cart", "pay", ["cart", "pay"], "limits?", { labelTone: "amber" });
  s7.links.g_cart.label = "GET /basket";
  s7.flows = [
    rts([[["e1", "g_cart", "c1"]], [["e1", "g_cart", "c2"]]], { bounce: true, kind: "slow", rate: 1.6 }),
    rts([[["e1", "g_recs", "d_recs"]], [["e1", "g_cat", "d_cat"]]], { bounce: true, rate: 1 }),
  ];
  s7.links.c1.fail = 0.12;
  s7.entities.card = bars("The network tax", "network", ["# one page view, before vs after the split", "! every hop can be slow, or fail"], [
    bar("In-process call", "~0.0001 ms", 0.03, "green"),
    bar("Network call (same zone)", "~0.5–2 ms", 0.35, "amber"),
    bar("Cart page: 6 calls, p99", "~40 ms", 1, "red", true),
  ]);

  const s8 = many();
  s8.links.bad = Lp("cart", "catDb", ["cart", "catDb"], "JOIN products?", { style: "cut", labelTone: "red" });
  s8.links.ev = Lp("cat", "cart", ["cat", "cart"], "PriceChanged");
  s8.entities.cart.tags = [tag("keeps a price copy", "violet", "layers")];
  s8.entities.cat.tags = [tag("sole owner of products", "green", "lock")];
  s8.flows = [rt(["ev"], { kind: "msg", rate: 0.9 }), rts([[["e1", "g_cart", "d_cart"]]], { bounce: true, rate: 1.4 })];

  const s9 = many();
  const TEAMS = { cat: "Team Shelf", cart: "Team Basket", pay: "Team Till", recs: "Team Picks" };
  for (const [id, t] of Object.entries(TEAMS)) s9.entities[id].tags = [tag(t, "violet", "users")];
  s9.entities.card = bars("Pick by team shape", "users", ["# rough guide, not a law"], [
    bar("1–2 teams", "monolith", 0.3, "green"),
    bar("3–8 teams", "modular monolith", 0.6, "blue"),
    bar("Many teams, uneven load", "services", 1, "violet", true),
  ]);

  const s10 = many();

  const U = 300000;
  const labMono = (st) =>
    lab(U, 1800, [["users", "users", "Shoppers"], ["lb", "load_balancer", "Load Balancer"], ["mono", "api_server", "Monolith", "catalog · cart · pay · recs", st], ["db", "postgres", "Postgres", "one schema", st === "crit" ? "warn" : undefined]], [["users", "lb"], ["lb", "mono"], ["mono", "db"]]);
  const labMany = lab(
    U,
    1800,
    [["users", "users", "Shoppers"], ["lb", "load_balancer", "API Gateway"], ...SVC.flatMap(([id, label, , dbl]) => [[id, "api_server", label, "own deploy"], [`${id}Db`, "postgres", dbl]])],
    [["users", "lb"], ...SVC.flatMap(([id]) => [["lb", id], [id, `${id}Db`]])],
  );

  write({
    id: "one-codebase-or-many",
    title: "One Codebase or Many",
    summary: "Brightbasket, a grocery-delivery startup, outgrows its single app. When should one codebase become many services, and what does the split cost?",
    minutes: 11,
    level: "intermediate",
    metrics: ["deploys", "blast", "hops", "opsCost"],
    legend: ["req", "res", "slow", ["write", "code change"], "msg", "fail"],
    goals: [
      { text: "Name what a monolith couples: deploys, failures and data", step: 2 },
      { text: "Split safely with a modular monolith and the strangler fig", step: 4 },
      { text: "Count the network and data costs of microservices", step: 6 },
      { text: "Choose an architecture from your team shape", step: 8 },
    ],
    steps: [
      {
        short: "One app",
        chapter: "setup",
        title: "Everything in one box",
        body: [
          `<b>Brightbasket</b> delivers groceries in three cities. The whole product — catalog, cart, payments, recommendations — is one codebase, built into one artifact and deployed as one process. That's a ${term("monolith")}.`,
          "For a team of six, it's the right call: one repo to search, one thing to deploy, one database where any feature can JOIN any table, and calls between features are plain function calls that cost nanoseconds.",
        ],
        metrics: { deploys: 3, blast: "whole site", hops: 1, opsCost: "low" },
        scene: s1,
        lab: labMono(),
      },
      {
        short: "Deploy queue",
        chapter: "problem",
        title: "Sixty people, one release",
        body: [
          "Two years later there are eight teams and sixty engineers, all merging into the same artifact. A change to the cart can't ship until everyone else's changes are tested together, so releases batch up into a weekly <b>release train</b>.",
          `This is ${term("deploy coupling")}: unrelated work shares one pipeline, one test suite and one rollout. Bigger batches mean riskier releases, which means more caution, which means even bigger batches.`,
        ],
        changes: ["+ 8 teams merging into one codebase", "+ Queue of changes waiting for the release train"],
        metrics: { deploys: "<1", blast: "whole site", hops: 1, opsCost: "low" },
        scene: s2,
        lab: labMono("warn"),
      },
      {
        short: "Blast radius",
        chapter: "problem",
        title: "One bug, whole site",
        body: [
          "Tuesday's train carries a memory leak in the recommendations widget — a <i>nice-to-have</i> feature. The leak grows until the process is killed, and because everything shares one process, <b>checkout dies with it</b>.",
          `The monolith also couples ${term("blast radius")} and scaling: you can't give recommendations more memory, or run payments on more machines, without scaling every feature together.`,
        ],
        callout: { kind: "warn", text: "In one process, the least important code can take down the most important code." },
        changes: ["~ Monolith overloaded by a leak in one module", "~ Load balancer returns 502s"],
        metrics: { deploys: 0, blast: "whole site", hops: 1, opsCost: "low" },
        scene: s3,
        lab: labMono("crit"),
      },
      {
        short: "Modularize",
        chapter: "technique",
        title: "Draw the seams first",
        body: [
          `Before reaching for the network, Brightbasket splits the code <i>inside</i> the monolith: a ${term("modular monolith")}. Each module owns its own tables and exposes a small public interface; nothing reaches into another module's internals or schema.`,
          "Teams can now work in parallel with far fewer collisions, and the boundaries are cheap to move while you're still learning where they belong. It's still one deploy, though — so blast radius hasn't changed yet.",
        ],
        callout: { kind: "tip", text: "If you can't keep modules apart inside one process, separate services will just become a distributed mess." },
        changes: ["~ Monolith split into Catalog, Cart and Payments modules", "~ One schema per module", "- Cross-module table access"],
        metrics: { deploys: 3, blast: "whole site", hops: 1, opsCost: "low" },
        scene: s4,
      },
      {
        short: "Strangler fig",
        chapter: "solution",
        title: "Carve off one piece",
        body: [
          `Rewriting everything at once is how migrations die. Instead they use the ${term("strangler fig")} pattern: put a router in front, build one new service beside the old app, and send just its traffic there.`,
          "Recommendations go first — they're low-risk and were the ones leaking memory. If the new service misbehaves, the router flips <code>/recs</code> back. Piece by piece, the monolith shrinks until nothing is left to route to it.",
        ],
        changes: ["+ Edge router sends /recs to the new service", "+ Recs service with its own store", "~ Monolith no longer serves recommendations"],
        metrics: { deploys: 8, blast: "all but recs", hops: 2, opsCost: "medium" },
        scene: s5,
        lab: lab(
          U,
          1800,
          [["users", "users", "Shoppers"], ["lb", "load_balancer", "Edge Router"], ["mono", "api_server", "Monolith", "catalog · cart · pay"], ["db", "postgres", "Postgres"], ["recs", "api_server", "Recs", "own deploy"], ["recsDb", "mongodb", "Recs store"]],
          [["users", "lb"], ["lb", "mono"], ["mono", "db"], ["lb", "recs"], ["recs", "recsDb"]],
        ),
      },
      {
        short: "Services",
        chapter: "solution",
        title: "Many small deployables",
        body: [
          `A year on, each area is its own ${term("microservice")}: its own repo, pipeline, deploy schedule and database. An API gateway hides the split from the apps.`,
          "Each team ships when it's ready — dozens of deploys a day — and a crash in Recs now takes down <b>one feature</b>, not the store. Payments can run on twenty instances while Recs runs on three.",
        ],
        changes: ["+ Catalog, Cart, Payments and Recs services", "+ A database per service", "~ Load balancer is now an API gateway", "- Monolith retired"],
        metrics: { deploys: 40, blast: "one feature", hops: 4, opsCost: "high" },
        scene: s6,
        lab: labMany,
      },
      {
        short: "Network tax",
        chapter: "tradeoff",
        title: "Function calls became network calls",
        body: [
          "The cart page used to make in-process calls to get prices and payment limits. Now each is a network hop with serialization, timeouts and retries — thousands of times slower, and any hop can fail.",
          "Chains of calls multiply tail latency: if each of six calls has a 1% chance of being slow, about 6% of page loads hit at least one slow call. Every new service needs timeouts, retries with backoff and tracing just to stay as reliable as the monolith was for free.",
        ],
        callout: { kind: "warn", text: "Avoid chatty chains: design service APIs so one page needs a few coarse calls, not many tiny ones." },
        changes: ["+ Cart calls Catalog and Payments per request", "~ Cart → Catalog drops some calls"],
        metrics: { deploys: 40, blast: "one feature", hops: 6, opsCost: "high" },
        scene: s7,
      },
      {
        short: "Data owned",
        chapter: "tradeoff",
        title: "No more JOINs across the line",
        body: [
          `With ${term("data ownership")}, only Catalog may touch the products table. Cart can't simply <code>JOIN</code> to it any more; reaching into another service's database would re-couple everything you just separated.`,
          "Instead Cart asks Catalog's API, or keeps its own copy of the few fields it needs, updated from events like <code>PriceChanged</code>. That copy is briefly stale — you've traded one transaction across everything for eventual consistency between services.",
        ],
        changes: ["+ Catalog publishes PriceChanged events", "+ Cart keeps a local copy of prices", "- Direct reads of another service's tables"],
        metrics: { deploys: 40, blast: "one feature", hops: 4, opsCost: "high" },
        scene: s8,
      },
      {
        short: "Team shape",
        chapter: "insight",
        title: "Architecture follows the org chart",
        body: [
          "Services mostly solve a <b>people</b> problem: letting many teams ship independently. Systems end up mirroring the communication structure of the teams that build them, so draw service lines where team lines are.",
          "A five-person startup with ten microservices pays the full operational bill — deploy pipelines, observability, on-call for each — without the benefit. Start modular, split when deploy queues and blast radius actually hurt.",
        ],
        changes: ["~ Each service owned by exactly one team"],
        metrics: { deploys: 40, blast: "one feature", hops: 4, opsCost: "high" },
        scene: s9,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "One codebase or many: recap",
        body: [
          takeaways([
            "<b>Monolith</b> → simple and fast, but deploys, failures and scaling are coupled",
            "<b>Modular monolith</b> → clean seams and owned schemas, still one deploy",
            "<b>Strangler fig</b> → migrate one route at a time behind a router",
            "<b>Microservices</b> → independent deploys and small blast radius",
            "<b>The bill</b> → network hops, no cross-service JOINs, much more to operate",
          ]),
        ],
        metrics: { deploys: 40, blast: "one feature", hops: 4, opsCost: "high" },
        scene: s10,
        lab: labMany,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 09.2 whos-at-this-address — Forkful (food ordering): service discovery + API gateway
// ════════════════════════════════════════════════════════════════════════════
{
  const PX = { p2: -9, p3: 0, p4: 9, p5: 18 };
  const IP = { p1: "10.0.3.17", p2: "10.0.7.41", p3: "10.0.9.12", p4: "10.0.4.88", p5: "10.0.6.20" };
  const inst = (id, extra = {}) => svc(PX[id] ?? 0, 6, ["Payments"], { sub: IP[id], s: 3.4, ...extra });
  const base = (ids = ["p2", "p3", "p4"]) => {
    const sc = {
      entities: { users: crowd("Diners", -4, -31, 9), orders: svc(0, -16, ["Orders"], { sub: "service" }) },
      links: { e1: L("users", "orders", "POST /order") },
      flows: [],
    };
    for (const id of ids) sc.entities[id] = inst(id);
    return sc;
  };
  const toAll = (sc, ids, via = []) => {
    for (const id of ids) sc.links[`c_${id}`] = L(via.length ? via[0] : "orders", id);
    return rt(["e1", ...via.slice(1), ids.map((id) => `c_${id}`)], { bounce: true, rate: 2 });
  };
  const beats = (sc, ids) => {
    for (const id of ids) sc.links[`hb_${id}`] = L(id, "reg", "", { style: "beat", heads: "none" });
    return rts(ids.map((id) => [[`hb_${id}`], "ping"]), { rate: 1.4 });
  };
  const registry = (extra = {}) => block(-15, -5, ["Service", "Registry"], "yellow", "listOrdered", { h: 36, ...extra });

  // s1 — hard-coded IP, one instance
  const s1 = { entities: { users: crowd("Diners", -4, -31, 9), orders: svc(0, -16, ["Orders"], { sub: "service", tags: [tag("PAY_URL=10.0.3.17", "paper", "file")] }), p1: inst("p1", { x: 0 }) }, links: { e1: L("users", "orders", "POST /order"), c_p1: L("orders", "p1", "charge") }, flows: [rt(["e1", "c_p1"], { bounce: true, rate: 2 })] };

  // s2 — autoscaled, IPs changed, old IP gone
  const s2 = base();
  s2.entities.orders.tags = [tag("PAY_URL=10.0.3.17", "red", "file")];
  s2.entities.p1 = ghost(0, 19, "10.0.3.17 · gone");
  s2.entities.p3.y = 6;
  s2.links.c_p1 = Lp("orders", "p1", ["orders", "p1"], "charge", { fail: 1, labelTone: "red" });
  s2.flows = [rt(["e1", "c_p1"], { rate: 2 })];

  // s3 — registry + heartbeats; orders asks the registry
  const s3 = base();
  s3.entities.reg = registry({ tags: [tag("payments → 3 healthy", "green", "check")] });
  s3.links.q = L("orders", "reg", "where is payments?", { style: "dashed", heads: "both" });
  s3.flows = [beats(s3, ["p2", "p3", "p4"]), rt(["q"], { kind: "ping", bounce: true, rate: 0.5 }), toAll(s3, ["p2", "p3", "p4"])];

  // s4 — client-side discovery with a cached list; p4 crashes, cache is stale
  const s4 = base();
  s4.entities.reg = registry({ tags: [tag("p4 missed 3 beats → evicted", "amber", "clock")] });
  s4.entities.orders.tags = [tag("cached list · refresh 30 s", "amber", "clock")];
  Object.assign(s4.entities.p4, DOWN);
  s4.links.q = L("orders", "reg", "list", { style: "dashed", heads: "both" });
  s4.flows = [beats(s4, ["p2", "p3"]), toAll(s4, ["p2", "p3", "p4"])];
  s4.links.c_p4.fail = 1;

  // s5 — server-side discovery: internal load balancer in the middle
  const s5 = base();
  s5.entities.reg = registry({ tags: [tag("payments → 3 healthy", "green", "check")] });
  s5.entities.ilb = gw(0, -5, ["payments", ".internal"], { tags: [tag("one stable name", "green", "signpost")] });
  s5.entities.orders.tags = [tag("PAY_URL=payments.internal", "green", "file")];
  s5.links.o = L("orders", "ilb", "charge");
  s5.links.w = L("reg", "ilb", "", { style: "dashed" });
  s5.flows = [beats(s5, ["p2", "p3", "p4"]), toAll(s5, ["p2", "p3", "p4"], ["ilb", "o"])];

  // s6 — DNS-based discovery: TTL caching leaves a stale answer
  const s6 = base();
  s6.entities.reg = registry({ tags: [tag("p4 removed", "amber", "check")] });
  s6.entities.dns = block(-15, -16, ["DNS"], "orange", "globe", { h: 36, tags: [tag("TTL 30 s", "amber", "clock")] });
  s6.entities.orders.tags = [tag("cached answer: .41 .12 .88", "amber", "globe")];
  Object.assign(s6.entities.p4, DOWN);
  s6.links.r = L("orders", "dns", "payments.svc?", { style: "dashed", heads: "both" });
  s6.links.u = L("reg", "dns", "", { style: "dashed" });
  s6.flows = [beats(s6, ["p2", "p3"]), rt(["r"], { kind: "ping", bounce: true, rate: 0.5 }), toAll(s6, ["p2", "p3", "p4"])];
  s6.links.c_p4.fail = 1;

  // s7 — health checks: readiness gates traffic; liveness restarts
  const s7 = base(["p2", "p3", "p4", "p5"]);
  s7.entities.reg = registry({ tags: [tag("3 ready · 1 warming", "green", "heartPulse")] });
  s7.entities.ilb = gw(0, -5, ["payments", ".internal"]);
  s7.entities.p5.tags = [tag("not ready: warming cache", "amber", "hourglass")];
  s7.entities.p5.dim = 0.5;
  s7.links.o = L("orders", "ilb", "charge");
  s7.links.w = L("reg", "ilb", "", { style: "dashed" });
  for (const id of ["p2", "p3", "p4", "p5"]) s7.links[`hc_${id}`] = L("reg", id, "", { style: "beat", heads: "none" });
  s7.links.hc_p5.label = "GET /ready → 503";
  s7.links.hc_p5.labelTone = "amber";
  s7.flows = [toAll(s7, ["p2", "p3", "p4"], ["ilb", "o"]), rts(["p2", "p3", "p4", "p5"].map((id) => [[`hc_${id}`], "ping"]), { rate: 0.5, bounce: true, fanout: true })];

  // s8 — API gateway as the single front door for the apps
  const front = () => ({
    entities: {
      users: crowd("Apps & web", -4, -31, 9),
      gw: gw(0, -18, ["API", "Gateway"], { s: 4, tags: [tag("auth · limits · routing", "green", "shield")] }),
      menu: svc(-10, -4, ["Menu"], { sub: "×3" }),
      orders: svc(0, -4, ["Orders"], { sub: "×4" }),
      pay: svc(10, -4, ["Payments"], { sub: "×6" }),
      reg: registry({ x: -18, y: -18 }),
    },
    links: {
      e1: L("users", "gw", "api.forkful.app"),
      gm: L("gw", "menu", "/menu"),
      go: L("gw", "orders", "/orders"),
      op: L("orders", "pay", "charge"),
      rg: L("reg", "gw", "", { style: "dashed" }),
    },
    flows: [rts([[["e1", "gm"]], [["e1", "go"]], [["e1", "go", "op"]]], { bounce: true, rate: 2.2 })],
  });
  const s8 = front();

  const s9 = front();
  s9.entities.bot = { type: "device", x: 14, y: -31, w: 5, d: 5, label: "Scraper bot", tags: [tag("no token", "red", "bot")] };
  s9.links.b = L("bot", "gw", "GET /menu ×9000", { fail: 0.9, labelTone: "red" });
  s9.entities.gw.tags = [tag("×3 · 401/429 at the door", "amber", "ban")];
  s9.entities.biz = ghost(10, -18, "no business logic here");
  s9.flows.push(rt(["b"], { kind: "poison", rate: 2.4 }));

  const s10 = front();


  const U = 900000;
  const labIlb = (n) =>
    lab(
      U,
      900,
      [["users", "users", "Diners"], ["orders", "api_server", "Orders"], ["ilb", "load_balancer", "payments.internal"], ["pay", "api_server", "Payments", `${n} instances`]],
      [["users", "orders"], ["orders", "ilb"], ["ilb", "pay"]],
    );
  const labGw = lab(
    U,
    2400,
    [["users", "users", "Apps & web"], ["gw", "load_balancer", "API Gateway", "TLS · auth · rate limit"], ["menu", "api_server", "Menu", "×3"], ["orders", "api_server", "Orders", "×4"], ["pay", "api_server", "Payments", "×6"]],
    [["users", "gw"], ["gw", "menu"], ["gw", "orders"], ["orders", "pay"]],
  );
  write({
    id: "whos-at-this-address",
    title: "Who's at This Address?",
    summary: "Forkful's services keep moving as they autoscale. How does one service find another — and how do the apps find any of them?",
    minutes: 10,
    level: "intermediate",
    metrics: ["instances", "lookup", "deadCalls", "p95"],
    legend: ["req", "res", ["ping", "heartbeat / health check"], ["poison", "unauthenticated"], "fail"],
    goals: [
      { text: "See why hard-coded addresses break once instances move", step: 1 },
      { text: "Compare client-side, server-side and DNS discovery", step: 3 },
      { text: "Keep traffic off sick instances with health checks", step: 6 },
      { text: "Put an API gateway in front as the single front door", step: 7 },
    ],
    steps: [
      {
        short: "One address",
        chapter: "setup",
        title: "Payments lives at 10.0.3.17",
        body: [
          "<b>Forkful</b> takes food orders. At checkout, the Orders service calls the Payments service — and finds it the simplest way possible: Payments' IP address sits in a config file.",
          "With one long-lived Payments server, that works. Nothing moves, so nothing needs finding.",
        ],
        metrics: { instances: 1, lookup: "hard-coded IP", deadCalls: 0, p95: 120 },
        scene: s1,
        lab: lab(U, 900, [["users", "users", "Diners"], ["orders", "api_server", "Orders"], ["p1", "api_server", "Payments", "10.0.3.17"]], [["users", "orders"], ["orders", "p1"]]),
      },
      {
        short: "IPs move",
        chapter: "problem",
        title: "The address went stale",
        body: [
          "Payments moves to containers with autoscaling. On Friday evening it scales to three instances — and every deploy or scale event hands out <b>fresh IP addresses</b>. The old server at 10.0.3.17 was replaced an hour ago.",
          "Orders is still calling the address in its config. Every charge goes to a machine that no longer exists, times out, and the checkout fails. In a dynamic fleet, <i>where</i> a service lives is runtime data, not configuration.",
        ],
        callout: { kind: "warn", text: "Containers, autoscaling and rolling deploys all change addresses — often many times a day." },
        changes: ["+ Payments autoscaled to 3 instances with new IPs", "~ Old instance 10.0.3.17 is gone", "~ Orders still calls the old address"],
        metrics: { instances: 3, lookup: "hard-coded IP", deadCalls: 100, p95: null },
        scene: s2,
      },
      {
        short: "Registry",
        chapter: "technique",
        title: "A phone book for services",
        body: [
          `A ${term("service registry")} keeps a live list of instances per service. Each Payments instance registers its address when it starts and sends a <b>heartbeat</b> every few seconds; if heartbeats stop, the registry drops it.`,
          "Now Orders asks by <i>name</i> — \"where is payments?\" — and gets the current list of healthy addresses. Consul, etcd/ZooKeeper-backed registries and Kubernetes' own endpoint lists all play this role.",
        ],
        changes: ["+ Service registry", "+ Instances register and send heartbeats", "~ Orders looks Payments up by name"],
        metrics: { instances: 3, lookup: "registry", deadCalls: 0, p95: 125 },
        scene: s3,
      },
      {
        short: "Client-side",
        chapter: "technique",
        title: "The caller picks an instance",
        body: [
          `In ${term("client-side discovery")}, Orders fetches the instance list, caches it, and load-balances across it itself. No extra hop, and the client can be smart — prefer the same zone, retry on another instance.`,
          "The catch is staleness. When an instance crashes, the registry notices after a few missed heartbeats, but Orders keeps using its cached list until the next refresh. For those seconds, some calls still go to a dead address — so clients also need timeouts and retries. Every language your services use needs this logic too.",
        ],
        changes: ["~ Orders caches the instance list and balances itself", "~ One instance crashes; the registry evicts it"],
        metrics: { instances: 3, lookup: "client-side", deadCalls: 4, p95: 140 },
        scene: s4,
      },
      {
        short: "Server-side",
        chapter: "technique",
        title: "One stable name in front",
        body: [
          `With ${term("server-side discovery")}, Orders calls a single stable name — <code>payments.internal</code> — and a load balancer behind that name watches the registry and spreads calls over healthy instances.`,
          "Callers stay simple and language-agnostic, and the balancer updates the moment the registry changes. The cost is one more network hop and one more component that must itself be highly available.",
        ],
        changes: ["+ Internal load balancer at payments.internal", "~ Orders calls one stable name"],
        metrics: { instances: 3, lookup: "server-side LB", deadCalls: 0, p95: 128 },
        scene: s5,
        lab: labIlb(3),
      },
      {
        short: "DNS",
        chapter: "technique",
        title: "Discovery through DNS",
        body: [
          `The most universal option is ${term("DNS-based discovery")}: the registry publishes records, and <code>payments.svc</code> resolves to the current instance IPs. Every language and tool already speaks DNS.`,
          "But DNS answers are cached — by resolvers, by the OS, sometimes by the runtime for far longer than the record's TTL. After an instance dies, some callers keep its address until their cache expires. Keep TTLs short and still expect a few failed calls to retry.",
        ],
        callout: { kind: "tip", text: "Kubernetes Services combine both ideas: a DNS name that points at a stable virtual IP, which the cluster balances over ready pods." },
        changes: ["+ DNS records published from the registry", "~ Orders resolves payments.svc, cached for 30 s", "~ One instance died; cached answers still include it"],
        metrics: { instances: 3, lookup: "DNS", deadCalls: 2, p95: 126 },
        scene: s6,
      },
      {
        short: "Health",
        chapter: "solution",
        title: "Only send traffic to the ready",
        body: [
          `Being registered isn't the same as being able to serve. ${term("Health checks")} come in two kinds: a <b>liveness</b> check asks \"is the process stuck?\" (if so, restart it), and a <b>readiness</b> check asks \"can you take traffic right now?\"`,
          "A fresh instance warming its cache answers <code>/ready</code> with 503, so it stays out of rotation until it's actually useful. Instances that start failing readiness are pulled out before callers notice.",
        ],
        changes: ["+ 4th Payments instance, still warming up", "+ Readiness probes on every instance", "~ Not-ready instance gets no traffic"],
        metrics: { instances: 4, lookup: "server-side LB", deadCalls: 0, p95: 122 },
        scene: s7,
        lab: labIlb(4),
      },
      {
        short: "Gateway",
        chapter: "solution",
        title: "One front door for the apps",
        body: [
          "Inside the network, services can find each other. But the phone app shouldn't know about Menu, Orders and Payments, their addresses, or how they're split — that would freeze the internal design into every installed app.",
          `An ${term("API gateway")} is the single public entry point. It terminates TLS, checks the caller's token, applies rate limits, and routes <code>/menu</code> and <code>/orders</code> to the right service using the same discovery underneath.`,
        ],
        changes: ["+ API gateway at api.forkful.app", "+ Menu, Orders and Payments behind it", "~ Apps only know one hostname"],
        metrics: { instances: 6, lookup: "gateway + registry", deadCalls: 0, p95: 130 },
        scene: s8,
        lab: labGw,
      },
      {
        short: "Door rules",
        chapter: "tradeoff",
        title: "Keep the front door thin",
        body: [
          "Shared concerns belong at the gateway: a scraper with no token is turned away with 401, a flood gets 429, and services never see either.",
          "But every request now passes through it, so run several stateless copies, and resist putting business logic there. A gateway that knows about discounts and order rules becomes a new monolith that every team has to change and deploy.",
        ],
        callout: { kind: "warn", text: "If the gateway is down, everything is down. Treat it like the most critical service you run." },
        changes: ["+ Scraper bot rejected at the gateway", "~ Gateway runs ×3, stateless"],
        metrics: { instances: 6, lookup: "gateway + registry", deadCalls: 0, p95: 132 },
        scene: s9,
        lab: labGw,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Who's at this address: recap",
        body: [
          takeaways([
            "<b>Registry</b> → instances register and heartbeat; callers look up by name",
            "<b>Client-side</b> → no extra hop, but caches go stale and logic lives in every client",
            "<b>Server-side / DNS</b> → simple callers; one more hop, or TTL-cached answers",
            "<b>Health checks</b> → readiness keeps traffic off instances that can't serve",
            "<b>API gateway</b> → one thin, replicated front door for auth, limits and routing",
          ]),
        ],
        metrics: { instances: 6, lookup: "gateway + registry", deadCalls: 0, p95: 130 },
        scene: s10,
        lab: labGw,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 09.3 all-or-nothing — Tripwell (flight + hotel + car bundles): 2PC, sagas, outbox, idempotency
// ════════════════════════════════════════════════════════════════════════════
{
  const PARTS = [
    ["fl", ["Flights"], -12, "blue", "plane", "Flights DB"],
    ["ho", ["Hotels"], 0, "orange", "hotel", "Hotels DB"],
    ["car", ["Cars"], 12, "purple", "car", "Cars DB"],
  ];
  const users = () => crowd("Travellers", -4, -27, 9);
  const head = (label, extra = {}) => block(0, -12, label, "green", "workflow", { h: 34, ...OK, ...extra });
  const base = (label = ["Trip", "Orchestrator"], ids = ["fl", "ho", "car"]) => {
    const sc = { entities: { users: users(), trip: head(label) }, links: { e1: L("users", "trip", "POST /trip") }, flows: [] };
    for (const [id, lbl, x, color, glyph, dbl] of PARTS) {
      if (!ids.includes(id)) continue;
      sc.entities[id] = block(x, 3, lbl, color, glyph, { ...OK });
      sc.entities[`${id}Db`] = dbe(x, 15, dbl);
      sc.links[`t_${id}`] = L("trip", id);
      sc.links[`d_${id}`] = L(id, `${id}Db`);
    }
    return sc;
  };
  const all = (extra = {}) => rts(PARTS.map(([id]) => [["e1", `t_${id}`, `d_${id}`]]), { bounce: true, rate: 2, ...extra });

  // s1 — one database, one transaction
  const s1 = {
    entities: { users: users(), trip: head(["Trip", "Service"]), db: dbe(0, 12, "Tripwell DB", [tag("BEGIN · 3 inserts · COMMIT", "green", "check")]) },
    links: { e1: L("users", "trip", "POST /trip"), e2: L("trip", "db", "one transaction") },
    flows: [rt(["e1", "e2"], { bounce: true, rate: 2 })],
  };

  // s2 — split into three services; hotel fails, flight already booked
  const s2 = base(["Trip", "Service"]);
  s2.links.t_fl.label = "book seat";
  s2.links.t_ho.label = "book room";
  s2.links.t_ho.fail = 1;
  s2.links.t_ho.labelTone = "red";
  s2.entities.ho.tags = [tag("sold out", "red", "ban")];
  s2.entities.flDb.tags = [tag("seat paid · no hotel", "red", "alert")];
  s2.flows = [rt(["e1", "t_fl", "d_fl"], { bounce: true, rate: 1.4 }), rt(["e1", "t_ho"], { rate: 1.4 })];

  // s3 — two-phase commit: prepare + vote, locks held
  const s3 = base(["Trip", "Coordinator"]);
  for (const [id] of PARTS) {
    s3.links[`t_${id}`].label = "prepare?";
    s3.entities[`${id}Db`].tags = [tag("prepared · locked", "amber", "lock")];
  }
  s3.links.t_ho.label = "prepare? → yes";
  s3.entities.trip.tags = [tag("phase 1: votes 3/3 yes", "green", "listChecks")];
  s3.flows = [all({ pattern: ["ping", "req"] })];

  // s4 — coordinator crashes between phases; participants stuck
  const s4 = base(["Trip", "Coordinator"]);
  Object.assign(s4.entities.trip, DOWN, { tags: [tag("crashed before COMMIT", "red", "alert")] });
  for (const [id] of PARTS) {
    s4.links[`t_${id}`].style = "dashed";
    s4.entities[`${id}Db`].tags = [tag("prepared · waiting", "red", "lock")];
  }
  s4.entities.other = crowd("Other bookings", 18, -14, 6, 6, 5);
  s4.links.o1 = L("other", "carDb", "same cars?", { labelTone: "red", fail: 1 });
  s4.flows = [rt(["e1"], { kind: "slow", rate: 1.2 }), rt(["o1"], { kind: "slow", rate: 1 })];

  // s5 — saga: a chain of local transactions
  const s5 = base();
  s5.links.t_fl.label = "1 · book seat";
  s5.links.t_ho.label = "2 · book room";
  s5.links.t_car.label = "3 · rent car";
  for (const [id] of PARTS) s5.entities[`${id}Db`].tags = [tag("local COMMIT", "green", "check")];
  s5.entities.trip.tags = [tag("saga log: step 2 of 3", "violet", "listOrdered")];
  s5.flows = [all({ rate: 1.6 })];

  // s6 — compensation: car fails, undo hotel + flight
  const s6 = base();
  s6.links.t_car.label = "rent car → none left";
  s6.links.t_car.fail = 1;
  s6.links.t_car.labelTone = "red";
  s6.links.t_ho.label = "cancel room";
  s6.links.t_fl.label = "refund seat";
  s6.entities.flDb.tags = [tag("seat released", "violet", "undo")];
  s6.entities.hoDb.tags = [tag("room released", "violet", "undo")];
  s6.entities.trip.tags = [tag("compensating 2 → 1", "violet", "undo")];
  s6.flows = [rt(["e1", "t_car"], { rate: 1.2 }), rts([[["t_ho", "d_ho"]], [["t_fl", "d_fl"]]], { kind: "write", rate: 1.4 })];

  // s7 — choreography: services react to each other's events
  const s7 = base(["Trip", "Service"]);
  delete s7.links.t_ho;
  delete s7.links.t_car;
  s7.links.t_fl.label = "TripRequested";
  s7.links.f2h = L("fl", "ho", "SeatBooked");
  s7.links.h2c = L("ho", "car", "RoomBooked");
  s7.entities.trip.tags = [tag("no central brain", "gray", "waypoints")];
  s7.flows = [rt(["e1", "t_fl", "f2h", "h2c"], { kind: "msg", rate: 1.2 }), rts([[["d_fl"]], [["d_ho"]], [["d_car"]]], { rate: 1 })];

  // s8 — dual write: commit, then crash before publishing
  const s8 = clone(s7);
  s8.links.h2c.style = "cut";
  s8.links.h2c.labelTone = "red";
  s8.entities.ho.tags = [tag("crashed after COMMIT", "red", "alert")];
  s8.entities.hoDb.tags = [tag("room booked", "amber", "check")];
  s8.entities.car.tags = [tag("never heard", "gray", "eyeOff")];
  Object.assign(s8.entities.ho, { heat: 0.6 });
  s8.flows = [rt(["e1", "t_fl", "f2h"], { kind: "msg", rate: 1.2 }), rt(["d_ho"], { kind: "write", rate: 1 })];

  // s9 — transactional outbox + relay
  const s9 = {
    entities: {
      users: crowd("Travellers", -16, -27, 9),
      trip: head(["Trip", "Service"], { x: -12 }),
      ho: block(-12, 3, ["Hotels"], "orange", "hotel", { ...OK }),
      hoDb: dbe(-12, 15, "Hotels DB", [tag("booking + outbox row, one tx", "green", "check")]),
      relay: block(1, 15, ["Outbox", "Relay"], "slab", "send", { s: 3, h: 26 }),
      bus: block(1, 3, ["Event", "Log"], "purple", "inbox", { h: 30, tags: [tag("RoomBooked", "violet", "mail")] }),
      car: block(13, 3, ["Cars"], "purple", "car", { ...OK }),
      carDb: dbe(13, 15, "Cars DB"),
    },
    links: {
      e1: L("users", "trip", "POST /trip"),
      t_ho: L("trip", "ho", "book room"),
      d_ho: L("ho", "hoDb", "INSERT ×2"),
      r1: L("hoDb", "relay", "poll"),
      r2: L("relay", "bus", "publish"),
      r3: L("bus", "car", "RoomBooked"),
      d_car: L("car", "carDb"),
    },
    flows: [rt(["e1", "t_ho", "d_ho"], { kind: "write", rate: 1.2 }), rt(["r1", "r2", "r3", "d_car"], { kind: "msg", rate: 1.2 })],
  };

  // s10 — idempotency: duplicate delivery is harmless
  const s10 = clone(s9);
  s10.links.r3.label = "RoomBooked ×2";
  s10.entities.car.tags = [tag("key ho-5521 seen → skip", "green", "key")];
  s10.entities.carDb.tags = [tag("processed_keys", "paper", "hash")];
  s10.flows = [rt(["r1", "r2", "r3", "d_car"], { kind: "msg", rate: 2.2, pattern: ["msg", "msg", "req"] })];

  const s11 = base();

  const U = 120000;
  const labSplit = (st) =>
    lab(U, 400, [["users", "users", "Travellers"], ["trip", "api_server", "Trip Service", undefined, st], ...PARTS.flatMap(([id, lbl, , , , dbl]) => [[id, "api_server", lbl[0]], [`${id}Db`, "postgres", dbl]])], [["users", "trip"], ...PARTS.flatMap(([id]) => [["trip", id], [id, `${id}Db`]])]);
  const labOutbox = lab(
    U,
    400,
    [["users", "users", "Travellers"], ["trip", "api_server", "Trip Service"], ["ho", "api_server", "Hotels"], ["hoDb", "postgres", "Hotels DB", "bookings + outbox"], ["relay", "worker", "Outbox Relay"], ["bus", "kafka", "Event Log"], ["car", "api_server", "Cars"], ["carDb", "postgres", "Cars DB"]],
    [["users", "trip"], ["trip", "ho"], ["ho", "hoDb"], ["hoDb", "relay"], ["relay", "bus"], ["bus", "car"], ["car", "carDb"]],
  );

  write({
    id: "all-or-nothing",
    title: "All or Nothing",
    summary: "Tripwell sells flight + hotel + car bundles, now split across three services. How do you keep a trip from being half-booked when there's no single database to roll back?",
    minutes: 11,
    level: "advanced",
    metrics: ["allOrNothing", "blocked", "coord", "p95"],
    legend: ["req", "res", ["write", "local write / undo"], "msg", "fail"],
    goals: [
      { text: "See why splitting data breaks plain transactions", step: 1 },
      { text: "Explain two-phase commit and why it blocks", step: 3 },
      { text: "Build a saga with compensating actions", step: 5 },
      { text: "Publish events reliably with an outbox and idempotent consumers", step: 9 },
    ],
    steps: [
      {
        short: "One DB",
        chapter: "setup",
        title: "Three bookings, one transaction",
        body: [
          "<b>Tripwell</b> sells holiday bundles: a flight, a hotel room and a rental car, booked together. A traveller wants all three or none — a flight to Lisbon with no room is worse than no trip at all.",
          `While everything lives in one database this is easy: wrap the three inserts in a ${term("transaction")}. If the car insert fails, <code>ROLLBACK</code> undoes the other two, and nobody ever sees a half-booked trip.`,
        ],
        metrics: { allOrNothing: "yes", blocked: "none", coord: "one DB transaction", p95: 180 },
        scene: s1,
        lab: lab(U, 400, [["users", "users", "Travellers"], ["trip", "api_server", "Trip Service"], ["db", "postgres", "Tripwell DB"]], [["users", "trip"], ["trip", "db"]]),
      },
      {
        short: "Half-booked",
        chapter: "problem",
        title: "No BEGIN across services",
        body: [
          "Tripwell has since split into Flights, Hotels and Cars services, each with its own database — and there's no <code>BEGIN</code> that spans three databases owned by three teams.",
          "The trip service books the seat (committed, card charged), then asks Hotels for a room — sold out. The seat stays sold. Without coordination, every partial failure leaves a traveller paying for a fragment of a trip.",
        ],
        callout: { kind: "warn", text: "Each local commit is permanent the moment it happens. A later failure can't reach back and undo it for you." },
        changes: ["+ Flights, Hotels and Cars own separate databases", "~ Hotel booking fails after the seat is committed"],
        metrics: { allOrNothing: "no", blocked: "—", coord: "none", p95: 240 },
        scene: s2,
        lab: labSplit(),
      },
      {
        short: "2PC",
        chapter: "technique",
        title: "Two-phase commit",
        body: [
          `The textbook answer is ${term("two-phase commit")} (2PC). A coordinator first asks every participant to <b>prepare</b>: do the work, lock the rows, write it durably, and vote yes or no — but don't commit yet.`,
          "Only if all three vote yes does the coordinator send <b>commit</b>; any no means everyone aborts. The outcome is truly atomic. The price: every participant holds its locks from prepare until it hears the final decision.",
        ],
        changes: ["+ Trip service becomes a 2PC coordinator", "~ Each database prepares and holds locks", "~ All three vote yes"],
        metrics: { allOrNothing: "yes", blocked: "3 rows", coord: "2PC", p95: 410 },
        scene: s3,
        lab: labSplit(),
      },
      {
        short: "Stuck",
        chapter: "problem",
        title: "The coordinator vanishes",
        body: [
          "Halfway through, after all three have voted yes, the coordinator's machine dies. Each participant has promised to commit if told to — so it can't abort on its own, and it doesn't know the decision, so it can't commit either.",
          "The prepared rows stay locked until the coordinator comes back. Other travellers trying to book the same rooms and cars wait behind those locks. 2PC is <b>blocking</b>: one slow or dead node stalls everyone else.",
        ],
        callout: { kind: "insight", text: "That's why 2PC is rare between independently owned services. It lives on mainly inside a single database product or tightly run cluster." },
        changes: ["~ Coordinator crashes between prepare and commit", "~ Prepared rows locked indefinitely", "+ Other bookings queue behind the locks"],
        metrics: { allOrNothing: "stuck", blocked: "3 rows, ∞", coord: "2PC · down", p95: null },
        scene: s4,
        lab: labSplit("crit"),
      },
      {
        short: "Saga",
        chapter: "solution",
        title: "A saga of local steps",
        body: [
          `A ${term("saga")} gives up on one big atomic commit. The trip becomes a sequence of <b>local transactions</b> — book seat, book room, rent car — each committing immediately in its own service, so no lock is held across services.`,
          `Here an ${term("orchestrator")} drives the steps and records progress in a saga log, so if it restarts it knows exactly where it was. Each step comes paired with an undo.`,
        ],
        changes: ["~ Trip service becomes a saga orchestrator", "+ Saga log records each completed step", "- Cross-service locks"],
        metrics: { allOrNothing: "eventually", blocked: "none", coord: "saga · orchestrated", p95: 260 },
        scene: s5,
        lab: labSplit(),
      },
      {
        short: "Compensate",
        chapter: "solution",
        title: "Undo by doing something new",
        body: [
          `When step 3 fails — no cars left — the orchestrator runs ${term("compensating actions")} in reverse order: cancel the room, then refund the seat. A compensation isn't a rollback; it's a new, forward action that semantically undoes an earlier one.`,
          "Briefly, the world saw a seat that later vanished — so show it as <i>pending</i> until the saga ends, and make every compensation safe to retry.",
        ],
        callout: { kind: "tip", text: "Order steps so the one most likely to fail — or hardest to undo, like charging a card — runs last." },
        changes: ["~ Car rental fails", "+ Cancel room, then refund seat", "~ Trip ends with nothing booked"],
        metrics: { allOrNothing: "yes", blocked: "none", coord: "saga · orchestrated", p95: 270 },
        scene: s6,
        lab: labSplit(),
      },
      {
        short: "Choreography",
        chapter: "tradeoff",
        title: "Orchestration or choreography",
        body: [
          `The alternative is ${term("choreography")}: no conductor. Flights books a seat and emits <code>SeatBooked</code>; Hotels hears it, books a room and emits <code>RoomBooked</code>; Cars reacts in turn. Failures travel back the same way as events.`,
          "Choreography keeps services loosely coupled and has no central point of failure, but the flow lives nowhere — it's spread across event handlers. Orchestration puts the whole flow in one readable place. Many teams start choreographed and switch once a saga has more than three or four steps.",
        ],
        changes: ["- Central orchestrator", "+ Each service reacts to the previous step's event"],
        metrics: { allOrNothing: "yes", blocked: "none", coord: "saga · choreographed", p95: 250 },
        scene: s7,
        lab: lab(U, 400, [["users", "users", "Travellers"], ["trip", "api_server", "Trip Service"], ...PARTS.flatMap(([id, lbl, , , , dbl]) => [[id, "api_server", lbl[0]], [`${id}Db`, "postgres", dbl]])], [["users", "trip"], ["trip", "fl"], ["fl", "ho"], ["ho", "car"], ...PARTS.map(([id]) => [id, `${id}Db`])]),
      },
      {
        short: "Lost event",
        chapter: "problem",
        title: "Committed, then silent",
        body: [
          `Sagas run on messages, and there's a trap in every step: Hotels commits the room, then publishes <code>RoomBooked</code>. That's a ${term("dual write")} — two systems, no shared transaction.`,
          "If Hotels crashes between the two, the room is booked but the event is never sent. Cars never hears about the trip and the saga stalls forever. Publishing first is no better: then you can announce a booking that never committed.",
        ],
        changes: ["~ Hotels crashes after COMMIT, before publishing", "~ Cars never receives RoomBooked"],
        metrics: { allOrNothing: "no", blocked: "none", coord: "saga · choreographed", p95: 250 },
        scene: s8,
      },
      {
        short: "Outbox",
        chapter: "solution",
        title: "The transactional outbox",
        body: [
          `The ${term("outbox pattern")} turns two writes into one. In the <b>same</b> local transaction, Hotels inserts the booking and a row into an <code>outbox</code> table describing the event. Either both are committed or neither is.`,
          "A separate relay reads new outbox rows (by polling, or by tailing the database's change log) and publishes them to the event log, marking each as sent. If the relay crashes, it simply resumes — so every committed booking is announced <b>at least once</b>.",
        ],
        changes: ["+ Outbox table written in the booking transaction", "+ Outbox relay publishes to the event log"],
        metrics: { allOrNothing: "yes", blocked: "none", coord: "saga + outbox", p95: 255 },
        scene: s9,
        lab: labOutbox,
      },
      {
        short: "Idempotent",
        chapter: "technique",
        title: "At least once means maybe twice",
        body: [
          "\"At least once\" has a catch: a relay that crashes after publishing but before marking the row sent publishes it again. Retries and redeliveries make duplicates too.",
          `So every consumer must be ${term("idempotent")}: each message carries a unique key, and Cars stores processed keys in the same transaction as its work. A known key returns the earlier result — no second car.`,
        ],
        callout: { kind: "tip", text: "Public APIs do the same with an Idempotency-Key header, so a retried payment is charged once." },
        changes: ["+ Every event carries an idempotency key", "+ Cars stores processed keys with its writes", "~ Duplicate RoomBooked ignored"],
        metrics: { allOrNothing: "yes", blocked: "none", coord: "saga + outbox + keys", p95: 255 },
        scene: s10,
        lab: labOutbox,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "All or nothing: recap",
        body: [
          takeaways([
            "<b>Separate databases</b> → no shared transaction; partial failure is the default",
            "<b>2PC</b> → atomic, but locks wait on the coordinator and block on failure",
            "<b>Saga</b> → local commits plus compensating actions, all-or-nothing eventually",
            "<b>Orchestration vs choreography</b> → one readable flow vs loosely coupled events",
            "<b>Outbox + idempotency</b> → no lost events, and duplicates are harmless",
          ]),
        ],
        metrics: { allOrNothing: "yes", blocked: "none", coord: "saga + outbox + keys", p95: 255 },
        scene: s11,
        lab: labSplit(),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 09.4 rivers-and-lakes — Tunely (music streaming): batch vs stream processing
// ════════════════════════════════════════════════════════════════════════════
{
  const E = {
    users: () => crowd("Listeners", -8, -29, 9),
    api: (extra = {}) => svc(-4, -16, ["Play API"], extra),
    prodDb: (extra = {}) => dbe(-16, -16, "Postgres", [tag("accounts · plays", "paper", "database")], extra),
    analyst: () => dev(-16, 6, "Analysts"),
    log: (extra = {}) => block(8, -16, ["Event", "Log"], "purple", "inbox", { h: 30, ...extra }),
    lake: (extra = {}) => block(8, -3, ["Data", "Lake"], "slab", "layers", { h: 22, ...extra }),
    batch: (extra = {}) => block(8, 9, ["Nightly", "Job"], "yellow", "hourglass", { h: 30, ...extra }),
    wh: (extra = {}) => dbe(-4, 9, "Warehouse", null, extra),
    stream: (extra = {}) => block(20, -3, ["Stream", "Processor"], "green", "waves", { h: 30, ...OK, ...extra }),
    trend: (extra = {}) => dbe(20, 9, "Trending", null, extra),
  };

  const s1 = {
    entities: { users: E.users(), api: E.api(), prodDb: E.prodDb(), analyst: E.analyst() },
    links: { e1: L("users", "api", "▶ play"), e2: L("api", "prodDb", "INSERT play"), q1: L("analyst", "prodDb", "GROUP BY song") },
    flows: [rt(["e1", "e2"], { bounce: true, rate: 2 }), rt(["q1"], { kind: "heavy", bounce: true, rate: 0.4 })],
  };

  const s2 = clone(s1);
  Object.assign(s2.entities.prodDb, { heat: 1, cpu: 0.97 });
  s2.entities.prodDb.tags = [tag("full scan · 40 min", "red", "hourglass")];
  Object.assign(s2.entities.api, WARN, { tags: [tag("plays timing out", "red", "timer")] });
  s2.links.e2.fail = 0.3;
  s2.flows = [rt(["e1", "e2"], { bounce: true, rate: 3, kind: "slow" }), rt(["q1"], { kind: "heavy", bounce: true, rate: 1.2 })];

  const batchScene = () => ({
    entities: { users: E.users(), api: E.api(), prodDb: E.prodDb(), analyst: E.analyst(), log: E.log(), lake: E.lake(), batch: E.batch(), wh: E.wh() },
    links: {
      e1: L("users", "api", "▶ play"),
      e2: L("api", "prodDb", "accounts only"),
      p1: L("api", "log", "PlayEvent"),
      p2: L("log", "lake", "hourly files"),
      b1: L("lake", "batch", "read all of yesterday"),
      b2: L("batch", "wh", "daily totals"),
      q1: L("analyst", "wh", "GROUP BY song"),
    },
    flows: [rt(["e1", "p1", "p2"], { kind: "msg", rate: 2.2 }), rt(["b1", "b2"], { kind: "heavy", rate: 0.6 }), rt(["q1"], { bounce: true, rate: 0.6 })],
  });
  const s3 = batchScene();
  s3.entities.batch.tags = [tag("runs 02:00 · 50 min", "amber", "clock")];

  // s4 — MapReduce inside the nightly job
  const s4 = {
    entities: {
      lake: block(-20, -4, ["Data", "Lake"], "slab", "layers", { h: 22, tags: [tag("yesterday: 60 M plays", "paper", "layers")] }),
      wh: dbe(20, -4, "Warehouse"),
    },
    links: {},
    flows: [],
  };
  const MAP = [-16, -4, 8];
  const RED = [-10, 2];
  const routes = [];
  MAP.forEach((y, i) => {
    s4.entities[`m${i}`] = block(-6, y, ["Map"], "yellow", "filter", { s: 3, h: 26 });
    s4.links[`lm${i}`] = L("lake", `m${i}`, i === 0 ? "split" : "");
  });
  RED.forEach((y, j) => {
    s4.entities[`r${j}`] = block(8, y, ["Reduce"], "orange", "sigma", { s: 3, h: 26 });
    s4.links[`rw${j}`] = L(`r${j}`, "wh", j === 0 ? "totals" : "");
  });
  MAP.forEach((_, i) => RED.forEach((_, j) => {
    s4.links[`s${i}${j}`] = L(`m${i}`, `r${j}`, "", { style: "dashed" });
    routes.push([[`lm${i}`, `s${i}${j}`, `rw${j}`], "heavy"]);
  }));
  s4.entities.m0.tags = [tag("play → (song, 1)", "paper", "filter")];
  s4.entities.r0.tags = [tag("shuffle by song · sum", "paper", "sigma")];
  s4.flows = [rts(routes, { rate: 2 })];

  // s5 — stale trending
  const s5 = batchScene();
  s5.entities.api.tags = [tag("Trending = yesterday's chart", "red", "clock")];
  s5.entities.wh.tags = [tag("last load 02:50", "amber", "clock")];
  s5.links.tr = L("api", "wh", "GET /trending");
  s5.flows = [rt(["e1", "p1", "p2"], { kind: "msg", rate: 2.6 }), rt(["e1", "tr"], { bounce: true, kind: "slow", rate: 0.8 })];

  const streamScene = () => {
    const sc = batchScene();
    sc.entities.stream = E.stream({ tags: [tag("1-min windows", "green", "timer")] });
    sc.entities.trend = E.trend();
    sc.links.s1 = L("log", "stream", "PlayEvent");
    sc.links.s2 = L("stream", "trend", "counts per minute");
    sc.links.tr = Lp("api", "trend", ["api", ["api", "trend"], "trend"], "GET /trending", { labelAt: 0.25 });
    sc.flows = [rt(["e1", "p1", ["p2", "s1"]], { kind: "msg", rate: 2.6 }), rt(["s2"], { kind: "write", rate: 1 }), rt(["b1", "b2"], { kind: "heavy", rate: 0.3 })];
    return sc;
  };
  const s6 = streamScene();

  const s7 = streamScene();
  s7.entities.card = bars("Three kinds of window", "timer", ["# plays per song, grouped by time"], [
    bar("Tumbling", "fixed, no overlap: 14:00–14:01, 14:01–14:02", 0.45, "green"),
    bar("Sliding", "last 10 min, updated every minute", 0.8, "blue"),
    bar("Session", "until a listener goes quiet for 30 min", 1, "violet", true),
  ]);

  const s8 = streamScene();
  s8.entities.phone = { type: "device", form: "phone", x: -18, y: -28, w: 4, d: 4, label: "Offline on a plane", tags: [tag("14:05 plays, sent 16:40", "amber", "plane")] };
  s8.links.late = L("phone", "api", "late batch");
  s8.entities.stream.tags = [tag("watermark 16:39 · 10 min grace", "amber", "hourglass")];
  s8.flows = [rt(["e1", "p1", "s1"], { kind: "msg", rate: 2 }), rt(["late", "p1", "s1"], { kind: "slow", rate: 0.7 }), rt(["s2"], { kind: "write", rate: 1 })];

  const s9 = streamScene();
  s9.entities.batch.tags = [tag("overwrites with exact totals", "violet", "refresh")];
  s9.entities.stream.tags = [tag("fast, approximate", "green", "zap")];
  s9.links.fix = L("batch", "trend", "nightly correction", { style: "dashed" });
  s9.flows.push(rt(["fix"], { kind: "write", rate: 0.4 }));

  const s10 = {
    entities: {
      users: E.users(),
      api: E.api(),
      prodDb: E.prodDb(),
      analyst: E.analyst(),
      log: E.log({ tags: [tag("keeps 1 year · replayable", "violet", "replay")] }),
      stream: E.stream({ x: 8, y: -3, tags: [tag("v1 · live", "green", "waves")] }),
      v2: block(20, -3, ["Stream", "v2"], "green", "replay", { h: 30, ...WARN, tags: [tag("replaying from day 1", "amber", "replay")] }),
      trend: E.trend({ x: 8 }),
      wh: E.wh(),
    },
    links: {
      e1: L("users", "api", "▶ play"),
      e2: L("api", "prodDb", "accounts only"),
      p1: L("api", "log", "PlayEvent"),
      s1: L("log", "stream", "live"),
      s2: L("stream", "trend"),
      s3: L("stream", "wh", "totals"),
      rp: Lp("log", "v2", ["log", ["v2", "log"], "v2"], "from offset 0"),
      q1: L("analyst", "wh", "GROUP BY song"),
    },
    flows: [rt(["e1", "p1", "s1", ["s2", "s3"]], { kind: "msg", rate: 2.2 }), rt(["rp"], { kind: "heavy", rate: 2.4, speed: 1.6 }), rt(["q1"], { bounce: true, rate: 0.5 })],
  };

  const s11 = streamScene();

  const U = 2000000;
  const nodes0 = [["users", "users", "Listeners"], ["api", "api_server", "Play API"], ["prodDb", "postgres", "Postgres", "accounts · plays"], ["analyst", "monitoring", "Analysts"]];
  const labProd = (st) => lab(U, 9000, nodes0.map((n) => (n[0] === "prodDb" && st ? [...n, st] : n)), [["users", "api"], ["api", "prodDb"], ["analyst", "prodDb"]]);
  const batchNodes = [["users", "users", "Listeners"], ["api", "api_server", "Play API"], ["prodDb", "postgres", "Postgres", "accounts"], ["log", "kafka", "Event Log"], ["batch", "worker", "Nightly Job", "reads the lake"], ["wh", "postgres", "Warehouse"], ["analyst", "monitoring", "Analysts"]];
  const batchEdges = [["users", "api"], ["api", "prodDb"], ["api", "log"], ["log", "batch"], ["batch", "wh"], ["analyst", "wh"]];
  const labBatch = lab(U, 9000, batchNodes, batchEdges);
  const labLambda = lab(U, 9000, [...batchNodes, ["stream", "worker", "Stream Processor"], ["trend", "redis", "Trending"]], [...batchEdges, ["log", "stream"], ["stream", "trend"], ["api", "trend"]]);
  const labKappa = lab(
    U,
    9000,
    [["users", "users", "Listeners"], ["api", "api_server", "Play API"], ["prodDb", "postgres", "Postgres", "accounts"], ["log", "kafka", "Event Log", "1 year retention"], ["stream", "worker", "Stream Processor"], ["trend", "redis", "Trending"], ["wh", "postgres", "Warehouse"], ["analyst", "monitoring", "Analysts"]],
    [["users", "api"], ["api", "prodDb"], ["api", "log"], ["log", "stream"], ["stream", "trend"], ["stream", "wh"], ["analyst", "wh"]],
  );

  write({
    id: "rivers-and-lakes",
    title: "Rivers and Lakes",
    summary: "Tunely, a music-streaming app, needs royalty reports and a live trending chart from the same flood of plays. When do you process data in big nightly batches, and when as a never-ending stream?",
    minutes: 11,
    level: "intermediate",
    metrics: ["freshness", "prodLoad", "eventsDay", "exact"],
    legend: ["req", "res", ["msg", "play event"], ["heavy", "bulk read"], ["write", "results"], "fail"],
    goals: [
      { text: "Move analytics off the production database", step: 2 },
      { text: "Explain how a MapReduce-style batch job works", step: 3 },
      { text: "Count a stream with windows and watermarks", step: 7 },
      { text: "Compare the lambda and kappa architectures", step: 9 },
    ],
    steps: [
      {
        short: "Ask prod",
        chapter: "setup",
        title: "Ask the production database",
        body: [
          "<b>Tunely</b> streams music. Every play is a row in Postgres — the same database that handles logins and playlists. Artists want to know their play counts, so the analysts run <code>GROUP BY song</code> straight against it.",
          "With two million plays a day the query takes a few seconds, the numbers are live and exact, and nobody notices the extra load. Simple, and fine for now.",
        ],
        metrics: { freshness: "live", prodLoad: 30, eventsDay: "2 M", exact: "yes" },
        scene: s1,
        lab: labProd(),
      },
      {
        short: "Scan storm",
        chapter: "problem",
        title: "Reports versus listeners",
        body: [
          "Two years later it's sixty million plays a day. The royalty report now scans billions of rows for forty minutes, evicting the hot data from cache and soaking up disk bandwidth.",
          "Listeners pay for it: pressing play times out because the database is busy answering an analyst. Analytical queries — read everything, aggregate — and transactional queries — touch a few rows, fast — want very different machines.",
        ],
        callout: { kind: "warn", text: "Never let reporting share a database with the user-facing path. Even a replica only moves the problem once scans get big enough." },
        changes: ["~ 60 M plays a day", "~ Report scans billions of rows", "~ Play API times out"],
        metrics: { freshness: "live", prodLoad: 96, eventsDay: "60 M", exact: "yes" },
        scene: s2,
        lab: labProd("crit"),
      },
      {
        short: "Batch",
        chapter: "solution",
        title: "A lake and a nightly job",
        body: [
          `Tunely stops storing plays in Postgres. Each play becomes an event on a log, landed every hour as files in cheap object storage — a ${term("data lake")} that keeps the raw history forever.`,
          `Every night a ${term("batch job")} reads all of yesterday's files, computes exact totals per song and artist, and loads them into a ${term("warehouse")} built for big scans. Analysts query the warehouse; production never sees them.`,
        ],
        changes: ["+ Play events go to an event log", "+ Data lake of hourly files", "+ Nightly job loads a warehouse", "- Analytics on Postgres"],
        metrics: { freshness: "24 h", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s3,
        lab: labBatch,
      },
      {
        short: "MapReduce",
        chapter: "technique",
        title: "Split, shuffle, sum",
        body: [
          `How do you count 60 million plays quickly? Split the files across many workers. In the ${term("map")} step each worker turns its plays into pairs like <code>(song, 1)</code>. The framework then ${term("shuffle")}s, sending every pair for the same song to the same reducer.`,
          `Each ${term("reduce")} worker sums its songs and writes totals. Add machines and the job gets faster; if one dies, only its slice reruns. Modern engines like Spark refine the idea, but the shape is the same.`,
        ],
        changes: ["~ 3 mappers emit (song, 1)", "~ Shuffle groups by song", "~ 2 reducers write totals"],
        metrics: { freshness: "24 h", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s4,
      },
      {
        short: "Stale chart",
        chapter: "problem",
        title: "Trending, as of yesterday",
        body: [
          "Product wants a <b>Trending now</b> chart. A song goes viral at lunchtime — and the chart, fed by last night's job, won't show it until tomorrow morning.",
          "Running the batch every hour helps a little but rescans hours of data each time, and the chart is still up to an hour behind. Batch is great at <i>complete and exact</i>; it's bad at <i>now</i>.",
        ],
        changes: ["+ Trending chart reads the warehouse", "~ Chart is up to a day old"],
        metrics: { freshness: "1 day", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s5,
        lab: labBatch,
      },
      {
        short: "Stream",
        chapter: "solution",
        title: "Process events as they flow",
        body: [
          `A ${term("stream processor")} reads the same event log continuously. It keeps a small running count per song in memory and, every minute, writes the latest numbers to a fast Trending store.`,
          "Instead of re-reading the past, it updates state one event at a time, so the chart is seconds old. The processor checkpoints its state and log position, so after a crash it resumes without double-counting.",
        ],
        changes: ["+ Stream processor reads the event log", "+ Trending store updated every minute", "~ Trending chart reads the stream's output"],
        metrics: { freshness: "5s", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s6,
        lab: labLambda,
      },
      {
        short: "Windows",
        chapter: "technique",
        title: "A stream never ends — so cut it",
        body: [
          `You can't ask \"how many plays in total?\" of an endless stream. Instead you count inside ${term("windows")}: slices of time that open, collect events and close with a result.`,
          "Pick the shape to fit the question: tumbling windows for per-minute charts, sliding windows for \"last ten minutes\", session windows for a listener's continuous listening.",
        ],
        changes: ["~ Plays grouped into 1-minute tumbling windows"],
        metrics: { freshness: "5s", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s7,
      },
      {
        short: "Late events",
        chapter: "tradeoff",
        title: "Plays from the past",
        body: [
          "A listener on a plane plays ten songs offline at 14:05; the phone uploads them at 16:40. Which window do they count in? By <b>event time</b> they belong to 14:05 — a window that closed long ago.",
          `A ${term("watermark")} is the processor's guess that \"everything before 16:39 has probably arrived\". Windows wait a grace period past it, then close. Later stragglers are dropped or sent as corrections — fast results are slightly inexact.`,
        ],
        changes: ["+ Offline phone uploads plays 2½ hours late", "+ Watermark with 10-minute grace period", "~ Very late plays miss their window"],
        metrics: { freshness: "5s", prodLoad: 35, eventsDay: "60 M", exact: "partly" },
        scene: s8,
      },
      {
        short: "Lambda",
        chapter: "tradeoff",
        title: "Both rivers: lambda",
        body: [
          `The ${term("lambda architecture")} runs both: a stream for fast, approximate numbers, and the nightly batch that recomputes exact totals from the lake and overwrites them. Readers get speed now and correctness later.`,
          "The cost is <b>two codebases</b> computing the same thing in two engines. They drift: a bug fixed in one but not the other makes the chart jump every morning.",
        ],
        changes: ["~ Batch job overwrites stream results nightly", "~ Same logic maintained twice"],
        metrics: { freshness: "5s", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s9,
        lab: labLambda,
      },
      {
        short: "Kappa",
        chapter: "insight",
        title: "One river: kappa",
        body: [
          `The ${term("kappa architecture")} drops the batch layer. The event log keeps a long history, and everything — trending, royalty totals — is computed by stream jobs.`,
          "Need to fix a bug or add a metric? Start <b>v2</b> of the job reading the log from the beginning; when it catches up, switch readers over and retire v1. One codebase, at the price of a long-retention log and replays that take hours.",
        ],
        callout: { kind: "insight", text: "Batch is just a stream that happens to be finite. Many modern engines run the same code over both." },
        changes: ["- Data lake batch job", "+ Event log retains a year", "+ Stream v2 replays history"],
        metrics: { freshness: "5s", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s10,
        lab: labKappa,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Rivers and lakes: recap",
        body: [
          takeaways([
            "<b>Separate analytics</b> → big scans never share a database with users",
            "<b>Batch</b> → complete, exact and cheap, but hours behind",
            "<b>Stream</b> → seconds fresh, with windows and checkpointed state",
            "<b>Event time + watermarks</b> → handle late data, accept small inexactness",
            "<b>Lambda vs kappa</b> → two pipelines for correctness, or one log you can replay",
          ]),
        ],
        metrics: { freshness: "5s", prodLoad: 35, eventsDay: "60 M", exact: "yes" },
        scene: s11,
        lab: labLambda,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 10.1 prove-it — Nestegg (savings app): password hashing, sessions vs tokens, MFA, passkeys, OIDC
// ════════════════════════════════════════════════════════════════════════════
{
  const base = () => ({
    entities: {
      users: crowd("Savers", -12, -28, 9),
      auth: block(0, -12, ["Auth", "Service"], "green", "fingerprint", { h: 34, ...OK }),
      udb: dbe(-10, 4, "Users DB"),
      api: svc(10, 4, ["Accounts", "API"]),
    },
    links: {
      e1: L("users", "auth", "email + password"),
      e2: L("auth", "udb", "look up user"),
      e3: L("auth", "api", "", { style: "dashed" }),
    },
    flows: [rt(["e1", "e2"], { bounce: true, rate: 1.8 })],
  });
  const withBots = (sc, rate = 1.6, fail = 0) => {
    sc.entities.bots = crowd("Bots · leaked lists", 6, -30, 7, 7, 5);
    sc.links.b1 = L("bots", "auth", "stolen pairs", { labelTone: "red", ...(fail ? { fail } : {}) });
    sc.flows.push(rt(["b1", "e2"], { kind: "poison", rate, bounce: !fail }));
    return sc;
  };

  const s1 = base();
  s1.entities.udb.tags = [tag("password: hunter2", "red", "eyeOff")];
  s1.entities.card = panel("users table", "database", ["# email · password", "ana@… · hunter2", "bo@… · Summer2019!", "! a single dump = every password"]);

  const s2 = base();
  s2.entities.udb.tags = [tag("sha256(password)", "amber", "hash")];
  s2.entities.thief = ghost(-22, 4, "Dump on a forum");
  s2.links.x1 = L("udb", "thief", "leaked", { style: "dashed", labelTone: "red" });
  s2.flows.push(rt(["x1"], { kind: "poison", rate: 0.6 }));
  s2.entities.card = bars("Guessing speed on one GPU", "zap", ["# guesses per second (rough)", "! same password → same hash, so tables of precomputed hashes work too"], [
    bar("SHA-256", "~10 billion / s", 1, "red", true),
    bar("bcrypt, cost 12", "~20 thousand / s", 0.08, "amber"),
    bar("argon2id, 64 MB", "~a few hundred / s", 0.02, "green"),
  ]);

  const s3 = base();
  s3.entities.udb.tags = [tag("argon2id · per-user salt", "green", "lock")];
  s3.entities.auth.tags = [tag("~150 ms to verify", "paper", "timer")];
  s3.entities.card = panel("What's stored now", "fileKey", ["# email · salt · hash", "ana@… · 9f2c… · $argon2id$…", "bo@… · 41ab… · $argon2id$…", "= same password, different salts → different hashes"]);

  const s4 = base();
  s4.entities.sess = dbe(0, 15, "Session store", [tag("sid → user, expires", "paper", "key")]);
  s4.links.s1 = L("auth", "sess", "create sid");
  s4.links.s2 = L("api", "sess", "sid valid?");
  s4.links.e4 = Lp("users", "api", ["users", ["api", "users"], "api"], "cookie: sid", { labelAt: 0.3 });
  s4.flows = [rt(["e1", "s1"], { bounce: true, rate: 1 }), rt(["e4", "s2"], { bounce: true, rate: 2 })];

  const s5 = base();
  s5.entities.api.tags = [tag("verifies signature locally", "green", "check")];
  s5.entities.auth.tags = [tag("signs JWT · 15 min", "violet", "key")];
  s5.links.e4 = Lp("users", "api", ["users", ["api", "users"], "api"], "Bearer eyJ…", { labelAt: 0.3 });
  s5.links.e3.label = "public key";
  s5.entities.card = panel("Sessions vs tokens", "scale", ["# session id: server looks it up", "= revoke instantly", "! a store lookup per request", "# JWT: signed, checked offline", "= no lookup needed", "! valid until it expires"]);
  s5.flows = [rt(["e1", "e2"], { bounce: true, rate: 0.8 }), rt(["e4"], { bounce: true, rate: 2.2 })];

  const s6 = withBots(base(), 2.4);
  s6.entities.udb.tags = [tag("argon2id · per-user salt", "green", "lock")];
  s6.entities.auth.tags = [tag("2% of guesses log in", "red", "alert")];
  Object.assign(s6.entities.auth, WARN);

  const s7 = withBots(base(), 2, 0.7);
  s7.entities.auth.tags = [tag("+ 6-digit code", "amber", "smartphone")];
  s7.entities.phone = { type: "device", form: "phone", x: -24, y: -14, w: 4, d: 4, label: "Authenticator app" };
  s7.links.m1 = L("phone", "auth", "code 482 913", { style: "dashed" });
  s7.entities.phish = ghost(22, -12, "fake nestegg-login.co");
  s7.flows.push(rt(["m1"], { kind: "ping", rate: 0.6 }));

  const s8 = withBots(base(), 1.8, 1);
  s8.entities.auth.tags = [tag("passkey · origin-bound", "green", "fingerprint")];
  s8.entities.udb.tags = [tag("public keys only", "green", "key")];
  s8.entities.phone = { type: "device", form: "phone", x: -24, y: -14, w: 4, d: 4, label: "Phone · private key" };
  s8.links.m1 = L("phone", "auth", "signed challenge");
  s8.links.e1.label = "sign in";
  s8.flows.push(rt(["m1"], { kind: "write", rate: 0.8, bounce: true }));

  const s9 = base();
  s9.entities.idp = block(-20, -12, ["Identity", "Provider"], "purple", "idCard", { h: 34, tags: [tag("password + MFA here", "violet", "shield")] });
  s9.links.o1 = Lp("users", "idp", ["users", "idp"], "1 · sign in with…");
  s9.links.o2 = L("idp", "auth", "2 · code → ID token");
  s9.entities.udb.tags = [tag("no passwords at all", "green", "check")];
  s9.links.e2.label = "find by sub";
  s9.flows = [rt(["o1", "o2", "e2"], { rate: 1.6 })];

  const s10 = base();
  s10.entities.udb.tags = [tag("public keys · argon2id", "green", "lock")];

  const U = 400000;
  const labN = (extra = [], edges = [], st) =>
    lab(U, 1200, [["users", "users", "Savers"], ["auth", "api_server", "Auth Service", undefined, st], ["udb", "postgres", "Users DB"], ["api", "api_server", "Accounts API"], ...extra], [["users", "auth"], ["auth", "udb"], ["users", "api"], ...edges]);

  write({
    id: "prove-it",
    title: "Prove It",
    summary: "Nestegg, a savings app, has to know who is really logging in. Store passwords safely, choose between sessions and tokens, and stop stolen passwords from working at all.",
    minutes: 11,
    level: "intermediate",
    metrics: ["leak", "stuffing", "mfa"],
    legend: ["req", "res", ["poison", "stolen password"], ["write", "signed proof"], ["ping", "one-time code"], "fail"],
    goals: [
      { text: "Store passwords with a slow, salted hash", step: 2 },
      { text: "Compare server sessions with signed tokens", step: 4 },
      { text: "Stop credential stuffing with a second factor", step: 6 },
      { text: "Delegate login with OAuth 2.0 and OpenID Connect", step: 8 },
    ],
    steps: [
      {
        short: "Plaintext",
        chapter: "setup",
        title: "Passwords in a column",
        body: [
          `${term("Authentication")} answers one question: <i>are you really who you claim to be?</i> <b>Nestegg</b>, a savings app, started the simple way — a users table with the password stored as typed, compared with <code>==</code> on login.`,
          "It works. But anyone who ever reads that table — a backup on a lost laptop, a SQL injection, a curious insider — now has every customer's password. And since people reuse passwords, also their email and their bank.",
        ],
        callout: { kind: "warn", text: "Never store a password you can read back. If you can recover it, so can whoever steals your database." },
        metrics: { leak: "all passwords", stuffing: "—", mfa: "no" },
        scene: s1,
        lab: labN(),
      },
      {
        short: "Fast hash",
        chapter: "problem",
        title: "Hashed — but too quickly",
        body: [
          `A ${term("hash")} is a one-way function: easy to compute, impossible to reverse. Nestegg now stores <code>sha256(password)</code> and compares hashes. Better — until the table leaks.`,
          "General-purpose hashes are built to be <b>fast</b>, so an attacker can try billions of guesses per second. And with no salt, everyone with the password <code>Summer2019!</code> has the same hash: crack it once, and every matching row falls at the same time.",
        ],
        changes: ["~ Passwords stored as unsalted SHA-256", "+ Database dump leaked"],
        metrics: { leak: "most passwords", stuffing: "—", mfa: "no" },
        scene: s2,
        lab: labN(),
      },
      {
        short: "Slow + salt",
        chapter: "solution",
        title: "Slow, salted hashing",
        body: [
          `Use a ${term("password hashing function")} — <b>argon2id</b> or <b>bcrypt</b> — that is deliberately slow and memory-hungry, with a tunable cost. 150 ms is nothing for one login but cripples an attacker trying billions.`,
          `Each user also gets a random ${term("salt")} stored next to the hash. Identical passwords now produce different hashes, so precomputed tables are useless and each account must be attacked separately. Only weak passwords remain crackable, slowly.`,
        ],
        changes: ["~ Hash with argon2id, tuned to ~150 ms", "+ Random salt per user", "~ Rehash old SHA-256 rows at next login"],
        metrics: { leak: "weak ones, slowly", stuffing: "—", mfa: "no" },
        scene: s3,
        lab: labN(),
      },
      {
        short: "Sessions",
        chapter: "technique",
        title: "Remembering who logged in",
        body: [
          "Nobody wants to type a password on every click. After a successful login, the server needs to remember the result. The classic way is a <b>session</b>.",
          `Auth creates a random ${term("session ID")}, stores <code>sid → user, expiry</code> in a fast store and sends the sid in a <code>HttpOnly; Secure</code> cookie. Every request, the API looks the sid up. Logging out — or kicking out a stolen session — is one delete.`,
        ],
        changes: ["+ Session store", "+ Session cookie on every request", "~ API checks each sid"],
        metrics: { leak: "weak ones, slowly", stuffing: "—", mfa: "no" },
        scene: s4,
        lab: labN([["sess", "redis", "Session store"]], [["auth", "sess"], ["api", "sess"]]),
      },
      {
        short: "Tokens",
        chapter: "tradeoff",
        title: "Signed tokens instead",
        body: [
          `A ${term("JWT")} flips this around: Auth signs a small token saying <i>user 81, expires 10:15</i>. Any service holding the public key can verify it without calling anyone, which suits many services and mobile apps.`,
          "The catch is revocation: a valid token works until it expires, even after logout or theft. So keep access tokens short-lived (minutes) and pair them with a longer <b>refresh token</b> that Auth can check — and revoke — when issuing new ones.",
        ],
        changes: ["- Session lookups from the API", "+ Short-lived signed access tokens", "+ Revocable refresh tokens"],
        metrics: { leak: "weak ones, slowly", stuffing: "—", mfa: "no" },
        scene: s5,
        lab: labN(),
      },
      {
        short: "Stuffing",
        chapter: "problem",
        title: "Someone else's leak",
        body: [
          `Nestegg's hashing is solid. It doesn't matter. Bots take billions of email/password pairs leaked from <i>other</i> sites and try them here: ${term("credential stuffing")}.`,
          "About 2% of attempts succeed, because people reuse passwords. Each success looks like a perfectly normal login. Rate limits per IP, bot detection and rejecting known-breached passwords all help — but as long as a password alone is enough, some will get in.",
        ],
        changes: ["+ Bots replaying leaked passwords", "~ 2% of attempts take over an account"],
        metrics: { leak: "weak ones, slowly", stuffing: 2, mfa: "no" },
        scene: s6,
        lab: labN([], [], "warn"),
      },
      {
        short: "MFA",
        chapter: "solution",
        title: "Something you have",
        body: [
          `${term("Multi-factor authentication")} asks for a second, different kind of proof. Here, a 6-digit code from an authenticator app that changes every 30 seconds. A stolen password alone no longer opens the account.`,
          "Codes have a weak spot: they can be <b>phished</b>. A fake login page relays your password and code to the real site in real time. SMS codes are weaker still — phone numbers can be hijacked.",
        ],
        changes: ["+ One-time codes from an authenticator app", "~ Stolen passwords mostly fail"],
        metrics: { leak: "weak ones, slowly", stuffing: 0.05, mfa: "phishable" },
        scene: s7,
        lab: labN(),
      },
      {
        short: "Passkeys",
        chapter: "solution",
        title: "No shared secret at all",
        body: [
          `${term("Passkeys")} (WebAuthn) replace the password with a key pair. The private key never leaves the user's device and is unlocked by fingerprint or PIN; Nestegg stores only the public key.`,
          "To sign in, the device signs a fresh challenge — and the signature is bound to <code>nestegg.app</code>, so a look-alike phishing site gets nothing usable. A leaked database contains only public keys, and there's no password to stuff.",
        ],
        callout: { kind: "tip", text: "Roll passkeys out alongside passwords + MFA, then nudge users over. Keep a safe recovery path — it's now the weakest link." },
        changes: ["+ Passkey sign-in", "~ Users DB stores public keys", "~ Stolen passwords rejected"],
        metrics: { leak: "nothing usable", stuffing: 0, mfa: "passkey" },
        scene: s8,
        lab: labN(),
      },
      {
        short: "OIDC",
        chapter: "technique",
        title: "Let someone else check",
        body: [
          `Nestegg's business app lets employees of client companies log in with their work account. With ${term("OAuth 2.0")} plus ${term("OpenID Connect")}, the user is sent to their company's <b>identity provider</b>, signs in there (with its own MFA), and comes back with a one-time code.`,
          "Nestegg's server swaps the code for a signed <b>ID token</b> naming the user. Nestegg never sees a password. OAuth alone is about <i>delegated access</i> (\"this app may read my calendar\"); OIDC adds the identity layer on top.",
        ],
        changes: ["+ Sign in with the company identity provider", "- Passwords for business accounts"],
        metrics: { leak: "nothing usable", stuffing: 0, mfa: "passkey" },
        scene: s9,
        lab: labN([["idp", "api_server", "Identity Provider"]], [["users", "idp"], ["idp", "auth"]]),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Prove it: recap",
        body: [
          takeaways([
            "<b>Never plaintext or fast hashes</b> → argon2id or bcrypt with a per-user salt",
            "<b>Sessions</b> → server lookup, instant revocation",
            "<b>JWTs</b> → offline checks; keep them short-lived with revocable refresh tokens",
            "<b>MFA</b> → defeats stuffing; codes can still be phished",
            "<b>Passkeys and OIDC</b> → no shared password to leak, phish or reuse",
          ]),
        ],
        metrics: { leak: "nothing usable", stuffing: 0, mfa: "passkey" },
        scene: s10,
        lab: labN(),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 10.2 not-so-fast — Ledgerly (invoicing for small firms): authorization
// ════════════════════════════════════════════════════════════════════════════
{
  const base = () => ({
    entities: {
      ana: dev(-15, -26, "Ana · Pinecraft"),
      bo: dev(5, -28, "Bo · Rivet & Co"),
      api: svc(-4, -12, ["Invoices", "API"]),
      db: dbe(-4, 4, "Invoices DB", [tag("all tenants, one table", "paper", "layers")]),
    },
    links: {
      a1: L("ana", "api", "GET /invoices/1042"),
      b1: L("bo", "api", "GET /invoices/2210"),
      d1: L("api", "db", "SELECT by id"),
    },
    flows: [rts([[["a1", "d1"]], [["b1", "d1"]]], { bounce: true, rate: 1.8 })],
  });
  const withPolicy = (sc, extra = {}) => {
    sc.entities.pdp = block(14, -10, ["Policy", "Engine"], "yellow", "scale", { h: 32, ...extra });
    sc.links.p1 = L("api", "pdp", "allowed?", { heads: "both", style: "dashed" });
    return sc;
  };

  const s1 = base();
  s1.entities.api.tags = [tag("token valid? → OK", "amber", "userCheck")];
  s1.entities.card = panel("Two different questions", "keyhole", ["# authentication: who are you?", "= Ana, from Pinecraft (signed token)", "# authorization: may Ana do this?", "! …nobody is asking yet"]);

  const s2 = base();
  s2.links.b1.label = "GET /invoices/1042";
  s2.links.b1.labelTone = "red";
  s2.entities.api.tags = [tag("logged in → here you go", "red", "eye")];
  s2.entities.bo.tags = [tag("sees Pinecraft's invoice", "red", "eyeOff")];
  s2.flows = [rt(["a1", "d1"], { bounce: true, rate: 1.4 }), rt(["b1", "d1"], { bounce: true, kind: "poison", rate: 1.4 })];
  s2.entities.card = panel("Insecure direct object reference", "hash", ["# Bo's own invoice: /invoices/2210", "# Bo edits the URL: /invoices/1042", "! API checks login, not ownership", "! count 1 … 99999 → every customer"]);

  const s3 = base();
  s3.entities.api.tags = [tag("tenant = token.tenant", "green", "shield")];
  s3.links.b1.label = "GET /invoices/1042";
  s3.links.b1.fail = 1;
  s3.links.d1.label = "WHERE id AND tenant";
  s3.entities.bo.tags = [tag("404 Not Found", "green", "ban")];
  s3.flows = [rt(["a1", "d1"], { bounce: true, rate: 1.4 }), rt(["b1"], { kind: "poison", rate: 1.2 })];

  const s4 = base();
  s4.entities.ana.label = "Ana · owner";
  s4.entities.bo = dev(5, -28, "Cal · viewer");
  s4.links.b1.label = "DELETE /invoices/1042";
  s4.links.b1.fail = 1;
  s4.entities.api.tags = [tag("viewer can't delete → 403", "green", "ban")];
  s4.entities.card = panel("Roles → permissions", "users", ["# owner · invoices:* users:*", "# accountant · invoices:read,write", "# viewer · invoices:read", "= check the permission, not the role name"]);
  s4.flows = [rt(["a1", "d1"], { bounce: true, rate: 1.4 }), rt(["b1"], { kind: "poison", rate: 1 })];

  const s5 = base();
  s5.entities.ana.label = "Ana · approver, Sales";
  s5.entities.bo = dev(5, -28, "Dev · approver, Ops");
  s5.links.a1.label = "approve $3,200 Sales";
  s5.links.b1.label = "approve $48,000 Ops";
  s5.links.b1.fail = 1;
  s5.entities.card = panel("An attribute rule", "filter", ["# allow approve if", "= user.dept == invoice.dept", "= and invoice.amount < 5000", "= and request.time in office hours", "! else ask a finance lead"]);
  s5.flows = [rt(["a1", "d1"], { bounce: true, rate: 1.4 }), rt(["b1"], { kind: "poison", rate: 1 })];

  const many = () => {
    const sc = base();
    sc.entities.exp = svc(-18, 6, ["Exports"]);
    sc.entities.mob = svc(10, 10, ["Mobile", "API"]);
    sc.links.x1 = L("ana", "exp", "CSV export");
    sc.links.x2 = L("exp", "db");
    sc.links.m1 = L("bo", "mob", "GET /m/inv/1042");
    sc.links.m2 = L("mob", "db");
    return sc;
  };
  const s6 = many();
  s6.entities.api.tags = [tag("checks v3", "green", "shield")];
  s6.entities.exp.tags = [tag("checks v1 · no ABAC", "amber", "shield")];
  s6.entities.mob.tags = [tag("forgot to check", "red", "alert")];
  s6.flows = [rt(["a1", "d1"], { bounce: true, rate: 1.2 }), rt(["x1", "x2"], { bounce: true, rate: 0.8 }), rt(["m1", "m2"], { bounce: true, kind: "poison", rate: 1.2 })];

  const s7 = withPolicy(many(), { tags: [tag("policy as code · tested", "green", "code")] });
  s7.links.p2 = L("mob", "pdp", "", { heads: "both", style: "dashed" });
  s7.links.p3 = Lp("exp", "pdp", ["exp", ["exp", "pdp"], "pdp"], "", { heads: "both", style: "dashed" });
  s7.links.m1.fail = 1;
  s7.flows = [rt(["a1", "p1", "d1"], { rate: 1.2 }), rt(["m1"], { kind: "poison", rate: 1 }), rt(["p2"], { kind: "ping", bounce: true, rate: 0.8 }), rt(["x1", "p3"], { kind: "ping", rate: 0.6 })];

  const svcScene = () => ({
    entities: {
      api: svc(-12, -12, ["Invoices", "API"]),
      rep: svc(4, -12, ["Reports"]),
      db: dbe(-12, 4, "Invoices DB"),
      pay: dbe(4, 4, "Payroll DB"),
      users: dbe(18, 4, "Users DB"),
    },
    links: { d1: L("api", "db"), r1: L("rep", "db", "SELECT") },
    flows: [],
  });
  const s8 = svcScene();
  s8.entities.rep.tags = [tag("DB_USER=admin", "red", "key")];
  Object.assign(s8.entities.rep, CRIT);
  s8.entities.rep.tags.push(tag("compromised dependency", "red", "bug"));
  s8.links.r2 = L("rep", "pay", "SELECT *", { labelTone: "red" });
  s8.links.r3 = L("rep", "users", "SELECT *", { labelTone: "red" });
  s8.flows = [rts([[["r1"]], [["r2"]], [["r3"]]], { kind: "poison", bounce: true, rate: 2 })];

  const s9 = svcScene();
  s9.entities.rep.tags = [tag("identity: reports · read invoices", "green", "idCard")];
  s9.entities.api.tags = [tag("mTLS · knows its caller", "green", "lock")];
  s9.links.r1.label = "read-only view";
  s9.links.r2 = L("rep", "pay", "denied", { fail: 1, labelTone: "red" });
  s9.links.r3 = L("rep", "users", "denied", { fail: 1, labelTone: "red" });
  s9.links.a1 = L("rep", "api", "on behalf of Ana", { style: "dashed" });
  s9.flows = [rt(["r1"], { bounce: true, rate: 1.4 }), rts([[["r2"]], [["r3"]]], { kind: "poison", rate: 1 }), rt(["a1", "d1"], { bounce: true, rate: 0.8 })];

  const s10 = withPolicy(base());
  s10.entities.api.tags = [tag("checks every request", "green", "shield")];

  const U = 50000;
  const labBase = (st) => lab(U, 300, [["users", "users", "Customers"], ["api", "api_server", "Invoices API", undefined, st], ["db", "postgres", "Invoices DB"]], [["users", "api"], ["api", "db"]]);
  const labMany = lab(
    U,
    300,
    [["users", "users", "Customers"], ["api", "api_server", "Invoices API"], ["exp", "api_server", "Exports"], ["mob", "api_server", "Mobile API"], ["db", "postgres", "Invoices DB"], ["pdp", "api_server", "Policy Engine"]],
    [["users", "api"], ["users", "exp"], ["users", "mob"], ["api", "db"], ["exp", "db"], ["mob", "db"], ["api", "pdp"], ["exp", "pdp"], ["mob", "pdp"]],
  );

  write({
    id: "not-so-fast",
    title: "Not So Fast",
    summary: "Ledgerly, an invoicing app for small firms, knows who you are. The harder question: what are you allowed to see and do — and who checks it, on which request?",
    minutes: 10,
    level: "intermediate",
    metrics: ["exposed", "checks", "privilege"],
    legend: ["req", "res", ["poison", "unauthorized"], ["ping", "policy check"], "fail"],
    goals: [
      { text: "Tell authentication apart from authorization", step: 0 },
      { text: "Find and fix an IDOR with a server-side check", step: 2 },
      { text: "Model permissions with RBAC and ABAC", step: 4 },
      { text: "Centralise policy and limit what services can reach", step: 8 },
    ],
    steps: [
      {
        short: "Logged in",
        chapter: "setup",
        title: "Logged in is not allowed",
        body: [
          `<b>Ledgerly</b> hosts invoices for thousands of small firms in one database. Login works well — every request carries a signed token saying who the caller is. That's authentication.`,
          `${term("Authorization")} is the next question: <i>may this person do this to this thing?</i> Ledgerly's API mostly relies on the app — it only shows you your own invoices, and hides buttons you shouldn't press.`,
        ],
        metrics: { exposed: "—", checks: "token only", privilege: "—" },
        scene: s1,
        lab: labBase(),
      },
      {
        short: "IDOR",
        chapter: "problem",
        title: "Just change the number",
        body: [
          "Bo, at another firm, opens his invoice <code>/invoices/2210</code>, edits the URL to <code>1042</code> — and gets Pinecraft's invoice, bank details and all. The API checked Bo was logged in, not that the invoice was his.",
          `This is an ${term("IDOR")}, one of the most common serious web bugs. Hiding links in the UI does nothing: anyone can send any request with any ID.`,
        ],
        callout: { kind: "warn", text: "The client is the attacker's computer. Every rule the UI enforces must be enforced again on the server." },
        changes: ["~ Bo requests an invoice ID he doesn't own", "~ API returns it"],
        metrics: { exposed: "yes", checks: "token only", privilege: "—" },
        scene: s2,
        lab: labBase("crit"),
      },
      {
        short: "Every request",
        chapter: "solution",
        title: "Check on the server, every time",
        body: [
          "The fix is a check on <b>every</b> request, on the server, against the object being touched: load the invoice only if its <code>tenant_id</code> matches the caller's tenant from the token. Bo now gets a 404 — not even confirmation that 1042 exists.",
          "Build it into the data access layer so a forgotten <code>WHERE</code> is hard to write, and add tests that log in as one tenant and try to read another's data. Random, unguessable IDs help a little, but are no substitute for the check.",
        ],
        changes: ["+ Ownership check on every query", "~ Other tenants' IDs return 404"],
        metrics: { exposed: "no", checks: "every request", privilege: "—" },
        scene: s3,
        lab: labBase(),
      },
      {
        short: "RBAC",
        chapter: "technique",
        title: "Roles",
        body: [
          `Inside a firm, people need different powers. With ${term("role-based access control")} (RBAC), users get roles — owner, accountant, viewer — and each role maps to a set of permissions like <code>invoices:delete</code>.`,
          "Cal is a viewer, so <code>DELETE /invoices/1042</code> returns 403. RBAC is easy to reason about and audit: \"who can delete invoices?\" is one lookup. Code should check permissions, not role names, so roles can change without code changes.",
        ],
        changes: ["+ Roles: owner, accountant, viewer", "+ Permission check before each action"],
        metrics: { exposed: "no", checks: "per role", privilege: "—" },
        scene: s4,
        lab: labBase(),
      },
      {
        short: "ABAC",
        chapter: "technique",
        title: "Rules about attributes",
        body: [
          `Then the rules get specific: approvers may approve invoices from <i>their own department</i>, under <i>$5,000</i>. Roles alone would need a role per department per limit — a ${term("role explosion")}.`,
          `${term("Attribute-based access control")} (ABAC) decides with rules over attributes of the user, the resource and the context. Dev's $48,000 Ops invoice is over his limit and is refused. Most real systems combine both: roles for the broad strokes, attributes for the fine print.`,
        ],
        changes: ["+ Rule: same department, under $5,000", "~ Over-limit approval refused"],
        metrics: { exposed: "no", checks: "roles + attributes", privilege: "—" },
        scene: s5,
        lab: labBase(),
      },
      {
        short: "Drift",
        chapter: "problem",
        title: "Every service, its own rules",
        body: [
          "Ledgerly grows an Exports service and a Mobile API. Each team copies the permission code — at different versions. Exports never learned the new approval rules, and the Mobile API forgot the tenant check entirely.",
          "Bo is back, through <code>/m/inv/1042</code>. With checks scattered across services, nobody can answer \"who can see invoice 1042?\" or prove every path enforces the same policy.",
        ],
        changes: ["+ Exports and Mobile API read the same data", "~ Checks copied and drifted", "~ Mobile API skips the tenant check"],
        metrics: { exposed: "yes", checks: "copied ×3, drifted", privilege: "—" },
        scene: s6,
        lab: labMany,
      },
      {
        short: "Central policy",
        chapter: "solution",
        title: "One policy, many enforcers",
        body: [
          `Ledgerly moves the rules into a ${term("policy engine")}. Services stay the <b>enforcement points</b>: on each request they ask \"may user X do action Y on resource Z?\" and obey the answer. The decisions come from one place.`,
          "Policies live as code: reviewed, versioned, unit-tested and logged on every decision. A rule change ships once and applies everywhere. Keep the engine close — usually a sidecar or library with cached policy — so the check costs microseconds, not a network round-trip.",
        ],
        changes: ["+ Central policy engine", "~ All three services ask before acting", "+ Every decision logged for audit"],
        metrics: { exposed: "no", checks: "central policy", privilege: "—" },
        scene: s7,
        lab: labMany,
      },
      {
        short: "Superuser",
        chapter: "problem",
        title: "The service that could read everything",
        body: [
          "Users aren't the only callers. The Reports service connects to the database as <code>admin</code> — easiest at the time. Then a compromised third-party package runs inside it.",
          "With admin credentials, the attacker reads not just invoices but payroll and the users table. The damage of a breach equals the access of whatever was breached.",
        ],
        changes: ["~ Reports uses the admin database account", "+ Malicious dependency inside Reports", "~ Payroll and Users dumped"],
        metrics: { exposed: "yes", checks: "central policy", privilege: "everything" },
        scene: s8,
        lab: lab(U, 300, [["api", "api_server", "Invoices API"], ["rep", "worker", "Reports", "admin creds", "crit"], ["db", "postgres", "Invoices DB"], ["pay", "postgres", "Payroll DB"], ["users", "postgres", "Users DB"]], [["api", "db"], ["rep", "db"], ["rep", "pay"], ["rep", "users"]]),
      },
      {
        short: "Least priv.",
        chapter: "solution",
        title: "Least privilege between services",
        body: [
          `Apply ${term("least privilege")}: each service gets its own identity and only the access its job needs. Reports gets a read-only role on a reporting view — nothing else.`,
          "Services prove who they are with mutual TLS or short-lived workload tokens, and the Invoices API authorizes by caller identity too. Acting for a user, Reports passes the user's context so tenant rules still apply.",
        ],
        callout: { kind: "tip", text: "Assume something will be compromised. Design so that when it is, it can reach as little as possible." },
        changes: ["+ Per-service identities", "~ Reports: read-only view only", "- Shared admin credentials"],
        metrics: { exposed: "no", checks: "central policy", privilege: "least privilege" },
        scene: s9,
        lab: lab(U, 300, [["api", "api_server", "Invoices API"], ["rep", "worker", "Reports", "read-only"], ["db", "postgres", "Invoices DB"], ["pay", "postgres", "Payroll DB"], ["users", "postgres", "Users DB"]], [["api", "db"], ["rep", "db"], ["rep", "api"]]),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Not so fast: recap",
        body: [
          takeaways([
            "<b>Authn ≠ authz</b> → knowing who someone is doesn't say what they may do",
            "<b>Server-side, every request</b> → check ownership of the object; the UI proves nothing",
            "<b>RBAC + ABAC</b> → roles for broad access, attribute rules for the fine print",
            "<b>Central policy</b> → one source of rules, enforced by every service",
            "<b>Least privilege</b> → services get only the access their job needs",
          ]),
        ],
        metrics: { exposed: "no", checks: "central policy", privilege: "least privilege" },
        scene: s10,
        lab: labMany,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 10.3 locked-boxes — Mendly (telehealth notes): TLS, encryption at rest, envelope/KMS, secrets
// ════════════════════════════════════════════════════════════════════════════
{
  const base = () => ({
    entities: {
      users: crowd("Patients", -5, -29, 9),
      edge: gw(0, -15, ["Load", "Balancer"]),
      api: svc(0, 0, ["Notes", "API"]),
      db: dbe(0, 13, "Notes DB"),
    },
    links: { e1: L("users", "edge", "http://"), e2: L("edge", "api", "http"), e3: L("api", "db", "SQL") },
    flows: [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.8 })],
  });
  const tlsAll = (sc) => {
    sc.links.e1.label = "https:// · TLS 1.3";
    sc.links.e2.label = "mTLS";
    sc.links.e3.label = "TLS";
    return sc;
  };
  const kms = (extra = {}) => block(15, 0, ["Key", "Service"], "yellow", "key", { h: 34, ...extra });
  const vault = (extra = {}) => block(-15, 0, ["Secrets", "Manager"], "purple", "fileKey", { h: 34, ...extra });

  const s1 = base();
  s1.entities.api.tags = [tag("DB_PASS in config.js", "red", "code")];
  s1.entities.db.tags = [tag("plain files on disk", "red", "eye")];

  const s2 = base();
  s2.entities.cafe = ghost(-17, -16, "Café Wi-Fi snooper");
  s2.links.sn = L("users", "cafe", "copies every packet", { style: "dashed", labelTone: "red" });
  s2.entities.card = panel("What the snooper sees", "eye", ["# POST /notes HTTP/1.1", "# Cookie: sid=7c41…", "! \"Patient reports chest pain since…\"", "! can also change the reply in flight"]);
  s2.flows = [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.6 }), rt(["sn"], { kind: "poison", rate: 1 })];

  const s3 = base();
  s3.links.e1.label = "https:// · TLS 1.3";
  s3.entities.edge.tags = [tag("certificate for mendly.health", "green", "lock")];
  s3.entities.cafe = ghost(-17, -16, "Café Wi-Fi snooper");
  s3.links.sn = L("users", "cafe", "random bytes", { style: "dashed" });
  s3.entities.api.tags = [tag("plain http inside", "amber", "unplug")];
  s3.flows = [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.6 }), rt(["sn"], { kind: "empty", rate: 0.8 })];

  const s4 = tlsAll(base());
  s4.entities.api.tags = [tag("own certificate · mTLS", "green", "idCard")];
  s4.entities.edge.tags = [tag("certs auto-renewed", "green", "refresh")];

  const s5 = tlsAll(base());
  s5.entities.db.tags = [tag("AES-256 disk + backups", "green", "lock")];
  s5.entities.bak = ghost(14, 13, "Lost backup drive");
  s5.links.bk = L("db", "bak", "ciphertext only", { style: "dashed" });
  s5.entities.card = panel("What disk encryption covers", "database", ["= stolen disk or backup → unreadable", "= decommissioned hardware → safe", "! the running DB decrypts for anyone it trusts", "! a SQL injection still reads plaintext"]);
  s5.flows = [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.6 }), rt(["bk"], { kind: "empty", rate: 0.6 })];

  const s6 = tlsAll(base());
  s6.entities.kms = kms({ tags: [tag("master key never leaves", "green", "lock")] });
  s6.links.k1 = L("api", "kms", "unwrap data key", { heads: "both", style: "dashed" });
  s6.entities.db.tags = [tag("note + wrapped data key", "green", "fileKey")];
  s6.entities.card = panel("Envelope encryption", "boxes", ["# 1 · new random data key per patient", "# 2 · encrypt the note with the data key", "# 3 · KMS wraps the data key with the master key", "= store ciphertext + wrapped key together", "= every unwrap is checked and logged"]);
  s6.flows = [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.4 }), rt(["k1"], { kind: "ping", bounce: true, rate: 0.8 })];

  const s7 = tlsAll(base());
  s7.entities.kms = kms();
  s7.links.k1 = L("api", "kms", "", { heads: "both", style: "dashed" });
  s7.entities.repo = dev(-16, 0, "Git repo", { tags: [tag("DB_PASS=Mendly2021!", "red", "code")] });
  s7.entities.bot = ghost(-16, -18, "Public-repo scanner");
  s7.links.r1 = L("repo", "api", "deploy", { style: "dashed" });
  s7.links.r2 = L("repo", "bot", "pushed by mistake", { labelTone: "red" });
  s7.links.r3 = L("bot", "db", "logs in", { labelTone: "red", labelAt: 0.75 });
  s7.flows = [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.2 }), rt(["r2", "r3"], { kind: "poison", rate: 0.9 })];

  const s8 = tlsAll(base());
  s8.entities.kms = kms();
  s8.links.k1 = L("api", "kms", "", { heads: "both", style: "dashed" });
  s8.entities.vault = vault({ tags: [tag("access by service identity", "green", "idCard")] });
  s8.links.v1 = L("api", "vault", "fetch at startup", { heads: "both" });
  s8.entities.api.tags = [tag("no secrets in code", "green", "check")];
  s8.flows = [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.6 }), rt(["v1"], { kind: "ping", bounce: true, rate: 0.5 })];

  const s9 = clone(s8);
  s9.entities.vault.tags = [tag("DB creds expire in 1 h", "violet", "refresh")];
  delete s9.entities.api.tags;
  s9.links.v2 = L("vault", "db", "create · revoke user", { style: "dashed" });
  s9.entities.kms.tags = [tag("master key rotated yearly", "violet", "refresh")];
  s9.flows = [rt(["e1", "e2", "e3"], { bounce: true, rate: 1.4 }), rt(["v2"], { kind: "write", rate: 0.6 }), rt(["v1"], { kind: "ping", bounce: true, rate: 0.8 })];

  const s10 = clone(s8);

  const U = 250000;
  const labL = (extra = [], edges = []) =>
    lab(U, 900, [["users", "users", "Patients"], ["edge", "load_balancer", "Load Balancer"], ["api", "api_server", "Notes API"], ["db", "postgres", "Notes DB"], ...extra], [["users", "edge"], ["edge", "api"], ["api", "db"], ...edges]);
  const labFull = labL([["kms", "api_server", "Key Service"], ["vault", "api_server", "Secrets Manager"]], [["api", "kms"], ["api", "vault"]]);

  write({
    id: "locked-boxes",
    title: "Locked Boxes",
    summary: "Mendly stores patients' telehealth notes. Encrypt data on the wire and on disk, manage the keys that do it, and get passwords out of the codebase for good.",
    minutes: 10,
    level: "intermediate",
    metrics: ["inTransit", "atRest", "secrets"],
    legend: ["req", "res", ["poison", "attacker"], ["empty", "unreadable"], ["ping", "key / secret fetch"]],
    goals: [
      { text: "Encrypt traffic with TLS, inside and out", step: 3 },
      { text: "Know what encryption at rest does and doesn't stop", step: 4 },
      { text: "Explain envelope encryption with a key service", step: 5 },
      { text: "Move secrets into a manager and rotate them", step: 8 },
    ],
    steps: [
      {
        short: "Open wire",
        chapter: "setup",
        title: "Notes in the clear",
        body: [
          "<b>Mendly</b> lets patients message their doctors and keeps the visit notes. Version one is a load balancer, an API and a database — talking plain HTTP, storing plain files on disk, with the database password in a config file in the repo.",
          `Each is fine until someone is in the wrong place: on the network path, holding a disk, or reading the code. ${term("Encryption")} makes data useless without a key; the hard part is everything around the keys.`,
        ],
        metrics: { inTransit: "no", atRest: "no", secrets: "source code" },
        scene: s1,
        lab: labL(),
      },
      {
        short: "Sniffed",
        chapter: "problem",
        title: "Anyone on the path can read",
        body: [
          "A patient sends a message from café Wi-Fi. Every router between them and Mendly can read the request: the session cookie, the message, the doctor's reply.",
          "Worse, anyone on the path can <b>change</b> it — inject a script or alter a reply — and neither side would know. Plain HTTP has no secrecy, no integrity and no proof of who you're talking to.",
        ],
        changes: ["+ Snooper on shared Wi-Fi", "~ Cookies and notes readable in transit"],
        metrics: { inTransit: "no", atRest: "no", secrets: "source code" },
        scene: s2,
        lab: labL(),
      },
      {
        short: "TLS",
        chapter: "solution",
        title: "TLS at the front door",
        body: [
          `${term("TLS")} fixes all three. The load balancer presents a certificate for <code>mendly.health</code>, signed by an authority the browser trusts, proving it's the real site. The handshake agrees on fresh session keys, and everything after is encrypted and tamper-evident.`,
          "The snooper now sees random bytes going to Mendly's address. But TLS ends at the load balancer — behind it, traffic still flows in plain HTTP across the internal network.",
        ],
        changes: ["+ HTTPS with a trusted certificate", "+ HTTP redirects to HTTPS", "~ Internal hops still plain"],
        metrics: { inTransit: "partly", atRest: "no", secrets: "source code" },
        scene: s3,
        lab: labL(),
      },
      {
        short: "TLS inside",
        chapter: "technique",
        title: "No trusted inside",
        body: [
          `Internal networks get breached too, and cloud networks are shared. So Mendly encrypts every hop: ${term("mutual TLS")} between load balancer and API — both sides present certificates — and TLS to the database.`,
          "A service mesh or platform can issue and renew these short-lived internal certificates automatically, so no one forgets the one that expires on a Sunday. Modern CPUs make the encryption cost negligible.",
        ],
        changes: ["+ mTLS between internal services", "+ TLS to the database", "+ Automatic certificate renewal"],
        metrics: { inTransit: "yes", atRest: "no", secrets: "source code" },
        scene: s4,
        lab: labL(),
      },
      {
        short: "At rest",
        chapter: "solution",
        title: "Encrypt what's on disk",
        body: [
          `${term("Encryption at rest")} protects stored data: the database volume and its backups are encrypted with AES-256. A lost backup drive or a disk pulled from a rack is just noise.`,
          "Know its limit. The running database decrypts transparently for anyone it lets in — so a SQL injection or a stolen app credential still reads plaintext. Disk encryption guards hardware, not access.",
        ],
        callout: { kind: "warn", text: "\"Encrypted at rest\" on a checklist often means only disk encryption. Ask who can make the system decrypt." },
        changes: ["+ Encrypted volumes and backups"],
        metrics: { inTransit: "yes", atRest: "partly", secrets: "source code" },
        scene: s5,
        lab: labL(),
      },
      {
        short: "Envelope",
        chapter: "technique",
        title: "Keys inside keys",
        body: [
          `For the notes themselves, Mendly uses ${term("envelope encryption")}. Each patient's notes are encrypted by the app with their own random <b>data key</b>. That data key is then encrypted — wrapped — by a <b>master key</b> held in a ${term("key management service")} (KMS), and stored next to the data.`,
          "The master key never leaves the KMS; the app sends a wrapped key and gets it unwrapped only if allowed, and every unwrap is logged. A database dump alone is useless, and deleting one data key crypto-shreds that patient's notes.",
        ],
        changes: ["+ Key service holds the master key", "+ Per-patient data keys, stored wrapped", "~ Notes encrypted by the app"],
        metrics: { inTransit: "yes", atRest: "yes", secrets: "source code" },
        scene: s6,
        lab: labL([["kms", "api_server", "Key Service"]], [["api", "kms"]]),
      },
      {
        short: "Leaked key",
        chapter: "problem",
        title: "The password in the repo",
        body: [
          "All that cryptography, and the database password still sits in <code>config.js</code>. An engineer pushes a copy of the repo to a public fork by mistake; automated scanners find credentials on public repos within minutes.",
          "Deleting the commit doesn't help — it's in the history, in every clone and in CI logs. Secrets in code are copied everywhere the code goes and are almost never changed.",
        ],
        changes: ["+ Repo copy pushed publicly", "~ Scanner logs in with the database password"],
        metrics: { inTransit: "yes", atRest: "yes", secrets: "source code" },
        scene: s7,
      },
      {
        short: "Secrets mgr",
        chapter: "solution",
        title: "A safe for secrets",
        body: [
          `Mendly moves every credential into a ${term("secrets manager")}. The API proves its identity — via its platform workload identity, not another password — and fetches the database credentials at startup.`,
          "Secrets are encrypted (by the KMS), access is granted per service, and every read is audited. The code and config now hold only the <i>name</i> of a secret. A leaked repo leaks nothing usable.",
        ],
        changes: ["+ Secrets manager", "- Passwords in code and config", "~ API fetches credentials at startup"],
        metrics: { inTransit: "yes", atRest: "yes", secrets: "secrets manager" },
        scene: s8,
        lab: labFull,
      },
      {
        short: "Rotation",
        chapter: "insight",
        title: "Assume keys leak; rotate them",
        body: [
          `Any secret may leak eventually, so limit how long it's useful. ${term("Rotation")} replaces credentials on a schedule — and instantly after any suspected leak. Better still, the secrets manager issues <b>dynamic</b> database users that expire after an hour.`,
          "Keys rotate too: the KMS creates a new master key version and new data keys get wrapped with it, while old versions stay available for decryption. Practise rotation regularly so it's a routine, not an emergency.",
        ],
        changes: ["+ Short-lived database credentials", "+ Yearly master-key rotation"],
        metrics: { inTransit: "yes", atRest: "yes", secrets: "secrets manager" },
        scene: s9,
        lab: labFull,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Locked boxes: recap",
        body: [
          takeaways([
            "<b>TLS everywhere</b> → secrecy, integrity and identity on every hop, inside too",
            "<b>At rest</b> → disk encryption guards hardware, not access",
            "<b>Envelope encryption</b> → data keys wrapped by a master key that never leaves the KMS",
            "<b>Secrets manager</b> → no credentials in code; access by identity, audited",
            "<b>Rotation</b> → short-lived secrets and rotated keys limit any leak",
          ]),
        ],
        metrics: { inTransit: "yes", atRest: "yes", secrets: "secrets manager" },
        scene: s10,
        lab: labFull,
      },
    ],
  });
}
