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
