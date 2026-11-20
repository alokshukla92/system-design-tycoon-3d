// Generates curriculum part "f": Module 11 (Shipping) and Module 12 (Whole Systems) lessons.
// Original content. Usage: node scripts/gen-curriculum-f.mjs [lessonsDir]. Overwrites only these lesson JSONs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? new URL("../src/content/lessons/", import.meta.url).pathname;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── entity / link helpers ─────────────────────────────────────────────────────
const tag = (text, tone, icon) => ({ text, ...(tone ? { tone } : {}), ...(icon ? { icon } : {}) });
const blk = (x, y, color, glyph, label, extra = {}) => ({ type: "block", x, y, s: 4, color, glyph, label, ...extra });
const srv = (x, y, label, extra = {}) => blk(x, y, "blue", "server", label, { cpu: 0.3, ...extra });
const lbal = (x, y, extra = {}) => ({ type: "block", x, y, s: 3.4, h: 30, color: "green", glyph: "balancer", label: ["Load", "Balancer"], pills: "below", ...extra });
const cache = (x, y, label, extra = {}) => blk(x, y, "orange", "zap", label, { s: 3.6, ...extra });
const queueBlk = (x, y, label, extra = {}) => blk(x, y, "green", "inbox", label, extra);
const worker = (x, y, label, extra = {}) => blk(x, y, "purple", "cpu", label, { s: 3.2, cpu: 0.3, ...extra });
const store = (x, y, label, extra = {}) => ({ type: "db", x, y, label, ...extra });
const device = (x, y, label, extra = {}) => ({ type: "device", x, y, label, ...extra });
const phone = (x, y, label, extra = {}) => ({ type: "device", x, y, form: "phone", w: 4.4, d: 4.4, label, ...extra });
const crowd = (cx, cy, count, label, extra = {}) => ({ type: "crowd", x0: cx - 4, x1: cx + 4, y0: cy - 3, y1: cy + 3, count, label, ...extra });
const ghost = (x, y, label, s = 6, h = 70) => ({ type: "ghost", x, y, s, h, label });
const zone = (x0, x1, y0, y1, label, extra = {}) => ({ type: "zone", x0, x1, y0, y1, label, ...extra });
const queue = (x, y, n, dir = [0, -1], extra = {}) => ({ type: "queue", x, y, n, dir, ...extra });
const card = (title, icon, lines, extra = {}) => ({ type: "panel", title, icon, lines, ...extra });
const L = (from, to, label, extra = {}) => ({ from, to, pts: [from, to], ...(label ? { label } : {}), ...extra });
const DIM = { dim: 0.55 };
const HOT = { heat: 1, cpu: 0.96 };
const DOWN = { dead: 1, heat: 0, cpu: -1, tags: [tag("DOWN", "red", "alert")] };
const lab = (users, rps, nodes, edges) => ({
  users,
  rps,
  nodes: nodes.map(([id, kind, label, sub, status]) => ({ id, kind, label, ...(sub ? { sub } : {}), ...(status ? { status } : {}) })),
  edges: edges.map(([from, to]) => ({ from, to })),
});
/** Clone a scene and apply a mutation. */
const mut = (scene, fn) => {
  const s = clone(scene);
  fn(s, s.entities, s.links);
  return s;
};

// ── validation (fail fast before the vitest suite) ────────────────────────────
const ICONS = new Set(
  "book settings window scan search chevronRight chevronDown file flame scale shield box database eye zap users play arrowRight bookmark share check user userRound message server replay pause chevronLeft arrowLeft clock lock alert bulb info gauge heartPulse layers flag circleCheck network split target sparkles signal listOrdered keyboard globe cpu trendingUp dollar timer activity mail package chart gift video inbox bell smartphone send radio cart braces workflow refresh skull hourglass bot ban power unplug bug scroll chartLine waypoints siren key building creditCard fingerprint plane hotel car ticket puzzle rocket undo wifi eyeOff fileKey hash merge waves moon signpost idCard userCheck clipboard route sigma filter keyhole gitBranch gitCommit flask container toggle map zoomIn code boxes gitPull listChecks hammer packageCheck component sun menu close expand collapse zoomOut volume2 volumeX flow sheets".split(" "),
);
function check(lesson) {
  const err = (m) => {
    throw new Error(`${lesson.id}: ${m}`);
  };
  lesson.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    if (s.short.length > 14) err(`${at} short too long: ${s.short}`);
    for (const k of lesson.metrics) if (!(k in s.metrics)) err(`${at} missing metric ${k}`);
    const ents = s.scene.entities;
    let panels = 0;
    for (const [id, e] of Object.entries(ents)) {
      if (e.type === "panel") {
        panels++;
        if (e.icon && !ICONS.has(e.icon)) err(`${at} ${id} icon ${e.icon}`);
      }
      if (e.type === "block") {
        if (e.label && e.label.length > 2) err(`${at} ${id} label lines`);
        if (e.glyph && e.glyph !== "server" && e.glyph !== "balancer" && !ICONS.has(e.glyph)) err(`${at} ${id} glyph ${e.glyph}`);
      }
      if (e.type === "db" && e.glyph && !ICONS.has(e.glyph)) err(`${at} ${id} glyph ${e.glyph}`);
      for (const t of e.tags ?? []) if (t.icon && !ICONS.has(t.icon)) err(`${at} ${id} tag icon ${t.icon}`);
    }
    if (panels > 1) err(`${at} has ${panels} panels`);
    const links = s.scene.links ?? {};
    for (const [lid, l] of Object.entries(links)) {
      if (!ents[l.from] || (l.to && !ents[l.to])) err(`${at} link ${lid} endpoint`);
      for (const p of l.pts.flatMap((p) => (Array.isArray(p) ? p : [p])))
        if (typeof p === "string" && !ents[p.replace(/[+-][\d.]+$/, "")]) err(`${at} link ${lid} pt ${p}`);
    }
    for (const f of s.scene.flows ?? []) {
      const paths = f.routes ? f.routes.map((r) => r.path) : [f.route];
      for (const id of paths.flat(2)) if (!links[id] || links[id].style === "off") err(`${at} flow uses bad link ${id}`);
    }
  });
  for (const g of lesson.goals) if (g.step < 0 || g.step >= lesson.steps.length) err(`goal step ${g.step}`);
}
function write(lesson) {
  check(lesson);
  writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
  console.log(`wrote ${lesson.id} (${lesson.steps.length} steps)`);
}

// ════════════════════════════════════════════════════════════════════════════
// 11.1 trust-but-test — Ferncart (grocery delivery) builds a test pyramid
// ════════════════════════════════════════════════════════════════════════════
{
  const base = () => ({
    entities: {
      shop: device(0, -22, "Shopper"),
      web: blk(0, -11, "yellow", "window", ["Web app"], { s: 3.8 }),
      cart: blk(0, 0, "blue", "cart", ["Cart", "service"], { cpu: 0.3 }),
      pay: blk(11, 0, "purple", "creditCard", ["Payments"], { sub: "other team", cpu: 0.25 }),
      db: store(0, 11, "Postgres"),
    },
    links: {
      sw: L("shop", "web", "HTTPS"),
      wc: L("web", "cart", "add item"),
      cp: L("cart", "pay", "POST /charge"),
      cd: L("cart", "db", "SQL"),
    },
    flows: [
      { route: ["sw", "wc", "cd"], bounce: true, rate: 1.2 },
      { route: ["sw", "wc", "cp"], bounce: true, rate: 0.5 },
    ],
  });
  const ci = (extra = {}) => blk(-13, 0, "slab", "workflow", ["CI runner"], { s: 3.8, ...extra });
  const dimAll = (e, keep) => {
    for (const id of ["shop", "web", "cart", "pay", "db"]) if (!keep.includes(id)) Object.assign(e[id], DIM);
  };

  const s1 = mut(base(), (s, e, l) => {
    e.qa = crowd(-13, -11, 5, "QA team");
    l.qa = L("qa", "web", "90-item checklist", { style: "dashed" });
    s.flows.push({ route: ["qa"], kind: "slow", rate: 0.6, bounce: true, hold: 1 });
  });

  const s2 = mut(s1, (s, e, l) => {
    Object.assign(e.cart, HOT, { tags: [tag("bug: 2× discount", "red", "bug")] });
    l.wc.label = "checkout";
    s.flows = [
      { route: ["sw", "wc", "cd"], bounce: true, rate: 1.4, pattern: ["poison", "req", "poison"] },
      { route: ["qa"], kind: "slow", rate: 0.6, bounce: true, hold: 1 },
    ];
  });

  const s3 = mut(base(), (s, e, l) => {
    dimAll(e, ["cart"]);
    e.ci = ci({ tags: [tag("2,400 unit tests", "green", "flask")] });
    e.scope = zone(-3.5, 3.5, -3.5, 3.5, "UNIT · ONE FUNCTION");
    e.cart.sub = "priceFor()";
    l.tc = L("ci", "cart", "priceFor(cart)");
    s.flows = [{ route: ["tc"], kind: "ping", bounce: true, rate: 3, speed: 1.5 }];
    e.card = card("A unit test", "flask", [
      "given 2 promo items + code SAVE10",
      "expect priceFor() = 10% off, once",
      "= runs in 4 ms · no network, no DB",
      "# fakes stand in for Postgres & Payments",
    ]);
  });

  const s4 = mut(s3, (s, e, l) => {
    delete e.card;
    Object.assign(e.db, { dim: 0, tags: [tag("throwaway container", "green", "container")] });
    e.scope = zone(-3.5, 3.5, -3.5, 14, "INTEGRATION · SERVICE + REAL DB");
    e.ci.tags = [tag("+ 180 integration", "green", "flask")];
    e.cart.sub = "";
    l.tc.label = "save cart";
    s.flows = [
      { route: ["tc"], kind: "ping", bounce: true, rate: 1.6, speed: 1.5 },
      { route: ["tc", "cd"], bounce: true, rate: 1, hold: 0.4 },
    ];
  });

  const s5 = mut(s4, (s, e, l) => {
    e.db.tags = [];
    Object.assign(e.db, DIM);
    Object.assign(e.pay, { dim: 0, tags: [tag("verifies contract", "green", "listChecks")] });
    e.scope = zone(-3.5, 14.5, -3.5, 3.5, "CONTRACT · CART ⇄ PAYMENTS");
    e.ci.tags = [tag("+ 40 contract", "green", "flask")];
    l.cp.label = "amount_cents";
    l.cp.labelTone = "green";
    l.tc.label = "checkout";
    s.flows = [{ route: ["tc", "cp"], bounce: true, rate: 1.4 }];
    e.card = card("Cart's contract", "clipboard", [
      "POST /charge",
      "  { amount_cents: int, order_id }",
      "→ 201 { charge_id }",
      "= replayed in Payments CI on every PR",
      "! renaming a field now fails their build",
    ]);
  });

  const s6 = mut(s5, (s, e, l) => {
    delete e.card;
    for (const id of ["shop", "web", "cart", "pay", "db"]) e[id].dim = 0;
    e.pay.tags = [];
    e.shop.tags = [tag("headless browser", "violet", "bot")];
    e.scope = zone(-3.5, 14.5, -25.5, 14, "END-TO-END · WHOLE STACK");
    e.ci.tags = [tag("+ 12 journeys", "green", "flask")];
    l.cp.label = "POST /charge";
    delete l.cp.labelTone;
    delete l.tc;
    l.te = { from: "ci", to: "shop", pts: ["ci", ["ci", "shop"], "shop"], label: "drive browser" };
    s.flows = [
      { route: ["te", "sw", "wc", "cd"], kind: "slow", bounce: true, rate: 0.6, hold: 0.6 },
      { route: ["te", "sw", "wc", "cp"], kind: "slow", bounce: true, rate: 0.4, hold: 0.6 },
    ];
  });

  const pyramid = () =>
    card("Ferncart's test pyramid", "layers", ["# count · time for the whole layer"], {
      chart: "bars",
      w: 250,
      bars: [
        { label: "End-to-end", note: "12 · 9 min", from: 0.4, to: 0.6, tone: "red" },
        { label: "Contract", note: "40 · 1 min", from: 0.3, to: 0.7, tone: "violet" },
        { label: "Integration", note: "180 · 3 min", from: 0.18, to: 0.82, tone: "blue" },
        { label: "Unit", note: "2,400 · 18 s", from: 0, to: 1, tone: "green", bold: true },
      ],
    });

  const s7 = mut(s6, (s, e, l) => {
    delete e.scope;
    e.shop.tags = [];
    e.ci.tags = [tag("2,632 tests", "green", "listChecks")];
    e.card = pyramid();
    s.flows = [
      { route: ["te", "sw", "wc", "cd"], kind: "slow", bounce: true, rate: 0.4, hold: 0.4 },
      { route: ["sw", "wc", "cd"], bounce: true, rate: 1 },
    ];
  });

  const s8 = mut(s7, (s, e, l) => {
    delete e.card;
    e.shop.tags = [tag("headless browser", "violet", "bot")];
    e.ci.tags = [tag("rerun ×3", "amber", "refresh")];
    Object.assign(e.ci, { heat: 0.4 });
    l.sw.fail = 0.35;
    l.sw.label = "sleep(2s)…";
    l.sw.labelTone = "amber";
    s.flows = [{ route: ["te", "sw", "wc", "cd"], bounce: true, rate: 1, pattern: ["slow", "slow", "req"], hold: 0.3 }];
    e.card = card("Why it flakes", "refresh", [
      "! fixed sleeps race the page load",
      "! tests share one shopper account",
      "! order-dependent leftovers in the DB",
      "= wait for conditions, isolate data,",
      "= quarantine & track flake rate",
    ]);
  });

  const s9 = mut(s7, (s, e, l) => {
    e.ci.tags = [tag("4 parallel shards", "green", "split"), tag("fail fast", "green", "zap")];
    e.card = card("Minutes after a push", "timer", ["! before: one 45-minute queue", "= after: first red in 90 s"], {
      chart: "bars",
      w: 260,
      bars: [
        { label: "Lint + unit", note: "0–1.5 min", from: 0, to: 0.17, tone: "green", bold: true },
        { label: "Integration ×4", note: "1.5–4.5", from: 0.17, to: 0.5, tone: "blue" },
        { label: "Contract", note: "1.5–2.5", from: 0.17, to: 0.28, tone: "violet" },
        { label: "E2E ×6 (on main)", note: "4.5–9", from: 0.5, to: 1, tone: "amber" },
      ],
    });
    s.flows = [
      { route: ["te", "sw", "wc", "cd"], kind: "slow", bounce: true, rate: 0.4, hold: 0.3 },
      { route: ["sw", "wc", "cd"], bounce: true, rate: 1 },
    ];
  });

  const s10 = mut(base(), (s, e, l) => {
    delete e.shop;
    e.crowd = crowd(0, -23, 14, "120k shoppers");
    l.sw = L("crowd", "web", "real traffic");
    e.db.tags = [tag("38M rows", "amber", "database")];
    e.pay.tags = [tag("bank API: slow", "amber", "hourglass")];
    e.pay.pills = "below";
    e.mon = blk(-12, -6, "slab", "activity", ["Monitoring"], { s: 3.6 });
    l.m1 = { from: "mon", to: "web", pts: ["mon", "web"], style: "beat", heads: "none" };
    l.m2 = { from: "mon", to: "cart", pts: ["mon", "cart"], style: "beat", heads: "none" };
    s.flows = [
      { route: ["sw", "wc", "cd"], bounce: true, rate: 2.2, pattern: ["req", "req", "req", "slow"] },
      { route: ["sw", "wc", "cp"], bounce: true, rate: 0.8, pattern: ["req", "slow"] },
      { routes: [{ path: ["m1"] }, { path: ["m2"] }], kind: "ping", rate: 1.2 },
    ];
  });

  const s11 = mut(s7, (s, e) => {
    e.ci.tags = [tag("4 shards · 90 s", "green", "zap")];
  });

  const labWeb = (mon) =>
    lab(
      120000,
      900,
      [
        ["users", "users", "Shoppers"],
        ["web", "api_server", "Web app"],
        ["cart", "api_server", "Cart service"],
        ["pay", "api_server", "Payments"],
        ["db", "postgres", "Postgres"],
        ...(mon ? [["mon", "monitoring", "Monitoring"]] : []),
      ],
      [["users", "web"], ["web", "cart"], ["cart", "pay"], ["cart", "db"], ...(mon ? [["mon", "web"]] : [])],
    );

  const M = (feedback, covers, escaped, leadTime) => ({ feedback, covers, escaped, leadTime });
  write({
    id: "trust-but-test",
    title: "Trust but Test",
    summary: "Ferncart stops shipping on hope: build a fast test pyramid, tame flaky tests, and know what tests can never catch.",
    minutes: 11,
    level: "intermediate",
    metrics: ["feedback", "covers", "escaped", "leadTime"],
    legend: ["req", "res", "slow", ["ping", "unit test"], ["poison", "bad result"], "fail"],
    goals: [
      { text: "Tell unit, integration, contract and end-to-end tests apart by scope", step: 5 },
      { text: "Shape a test pyramid and know why the cone shape hurts", step: 6 },
      { text: "Diagnose and fix flaky tests", step: 7 },
      { text: "Keep feedback fast and know which bugs only production reveals", step: 9 },
    ],
    steps: [
      {
        short: "Ship weekly",
        chapter: "setup",
        title: "Ferncart ships on Thursdays",
        body: [
          "<b>Ferncart</b> delivers groceries in three cities. Fourteen engineers merge code all week, then every Thursday a QA team spends two days clicking through a <b>90-item checklist</b> before anything reaches shoppers.",
          "It feels safe. In practice, the checklist only covers what somebody remembered to write down, and engineers wait days to learn whether a change broke something.",
        ],
        metrics: M("2 days", "a checklist", "weekly", "1 week"),
        scene: s1,
        lab: labWeb(false),
      },
      {
        short: "Bug escapes",
        chapter: "problem",
        title: "A discount applied twice",
        body: [
          "A tidy-up of the pricing code made promo codes apply once <em>per item</em> as well as once per cart. Carts with two or more promo items got 20% off instead of 10%.",
          "No checklist line covered “two promo items plus a code”, so it sailed through QA. It ran for three days and cost <b>$41,000</b> before a shopper's tweet flagged it.",
        ],
        callout: { kind: "warn", text: "Manual passes test what people remember. Bugs live in the combinations nobody wrote down." },
        changes: ["~ Cart service now returns wrong totals", "~ Wrong prices reach shoppers"],
        metrics: M("2 days", "a checklist", "weekly", "1 week"),
        scene: s2,
      },
      {
        short: "Unit tests",
        chapter: "technique",
        title: "Unit tests: one piece, in isolation",
        body: [
          "A <span class=\"term\">unit test</span> calls one function or class directly with chosen inputs and asserts on the output. <code>priceFor()</code> needs no server, network or database, so a test runs in milliseconds.",
          "That speed is the point: Ferncart writes <b>2,400</b> of them, covering every discount rule and edge case, and they all finish in 18 seconds on a laptop.",
          "The catch: anything the function talks to is replaced by a <i>fake</i>. A fake behaves how you <em>believe</em> the real thing behaves.",
        ],
        changes: ["- Removed QA checklist pass", "+ Added CI runner", "+ Unit-test scope around priceFor()"],
        metrics: M("20 s", "pricing logic", "fewer", "1 week"),
        scene: s3,
      },
      {
        short: "Integration",
        chapter: "technique",
        title: "Integration tests: talk to the real thing",
        body: [
          "All unit tests passed, yet staging lost cents: the database mapping stored <code>amount</code> in an integer column and quietly truncated it. The fake database never would have.",
          "An <span class=\"term\">integration test</span> runs the Cart service against a real Postgres started in a throwaway container, with real migrations and real SQL. It catches wiring, queries and serialization bugs.",
          "Each one takes seconds instead of milliseconds, so Ferncart keeps the count modest: <b>180</b> tests, about 3 minutes.",
        ],
        changes: ["~ Scope widened to Cart + Postgres", "+ Postgres runs in a test container"],
        metrics: M("3 min", "+ SQL & mapping", "fewer", "1 week"),
        scene: s4,
      },
      {
        short: "Contracts",
        chapter: "technique",
        title: "Contract tests: pin down the handshake",
        body: [
          "The Payments team renamed a request field to <code>amount_cents</code>. Cart's tests used a stubbed Payments that still accepted the old name, so everything stayed green while real checkouts failed.",
          "A <span class=\"term\">consumer-driven contract</span> fixes this: Cart records exactly what it sends and what it needs back. Payments' CI replays that contract against its real API on every pull request, so a breaking rename fails <em>their</em> build before merge.",
        ],
        callout: { kind: "tip", text: "Contracts replace most cross-team end-to-end tests: each side is tested alone, against a shared, versioned promise." },
        changes: ["~ Scope now spans Cart ⇄ Payments", "+ Payments CI verifies Cart's contract"],
        metrics: M("4 min", "+ API promises", "fewer", "1 week"),
        scene: s5,
      },
      {
        short: "End-to-end",
        chapter: "technique",
        title: "End-to-end: a robot shopper",
        body: [
          "An <span class=\"term\">end-to-end test</span> drives a real browser through the deployed stack: sign in, search, add to cart, pay. It is the only test that proves all the pieces actually fit together.",
          "It is also the slowest and most fragile: every network hop, animation and shared environment is a chance to fail. Ferncart keeps just <b>12 journeys</b>, the ones that would make the news if they broke.",
        ],
        changes: ["~ Scope covers the whole stack", "~ CI drives a headless browser"],
        metrics: M("25 min", "+ 12 journeys", "fewer", "2 days"),
        scene: s6,
      },
      {
        short: "Pyramid",
        chapter: "tradeoff",
        title: "Many small tests, few big ones",
        body: [
          "Stack the layers and you get a <span class=\"term\">test pyramid</span>: a wide base of fast, precise unit tests, fewer integration and contract tests, and a thin tip of end-to-end journeys.",
          "The rule of thumb: <b>catch each bug at the lowest layer that can see it</b>. A discount rule belongs in a unit test; a broken SQL mapping in an integration test; only “do the services connect?” needs end-to-end.",
          "The inverted shape, the <i>ice-cream cone</i>, is mostly manual and browser tests: slow, flaky, and silent about <em>where</em> the bug is.",
        ],
        changes: ["- Removed scope overlay", "+ Pyramid of test counts and run times"],
        metrics: M("25 min", "all 4 layers", "rare", "2 days"),
        scene: s7,
      },
      {
        short: "Flaky tests",
        chapter: "problem",
        title: "The test that cried wolf",
        body: [
          "One checkout journey fails about one run in fifteen with no code change. Engineers learn to hit <i>rerun</i> until it goes green.",
          "That habit is the real damage: when a genuine failure appears, people shrug “probably flaky”. A <span class=\"term\">flaky test</span> trains the team to ignore red.",
          "Fixes: wait for a condition (button enabled) instead of a fixed sleep, give each test its own data, quarantine a flaky test out of the blocking suite with an owner and a deadline, and track the flake rate like any other metric.",
        ],
        callout: { kind: "warn", text: "A test that fails at random is worse than no test: it costs time <em>and</em> teaches people to distrust the suite." },
        changes: ["~ Browser step fails ~1 in 15 runs", "~ CI reruns failed jobs ×3"],
        metrics: M("1+ hours", "all 4 layers", "fewer", "2 days"),
        scene: s8,
      },
      {
        short: "Fast feedback",
        chapter: "solution",
        title: "Fast feedback first",
        body: [
          "A suite nobody waits for is a suite nobody runs. Ferncart reorders CI so the cheapest checks run first and <b>fail fast</b>: lint and unit tests report in 90 seconds.",
          "Integration tests are split across four parallel shards. The end-to-end journeys run after merge on main, in parallel, against a staging copy, and block the deploy, not the developer.",
        ],
        changes: ["~ CI split into 4 parallel shards", "~ Cheapest checks run first", "~ E2E moves to post-merge"],
        metrics: M("90 s", "all 4 layers", "rare", "1 hour"),
        scene: s9,
      },
      {
        short: "What escapes",
        chapter: "insight",
        title: "What tests can't see",
        body: [
          "Tests run your code on your inputs in a clean room. Production is not a clean room: a query that is instant on 1,000 test rows times out on <b>38 million</b>, a config value differs, the bank's API slows down, traffic triples at 6 pm.",
          "So testing lowers risk <em>before</em> merge; it never removes it. The bugs that escape are caught by <span class=\"term\">monitoring</span> and by releasing gradually, so a bad change touches a few users for a few minutes.",
        ],
        callout: { kind: "next", text: "Next: <b>Ship It Safely</b> — pipelines, feature flags and canaries that limit the blast radius of what tests miss." },
        changes: ["+ Real shoppers and real data volume", "+ Monitoring watches production"],
        metrics: M("90 s", "code, not prod", "rare", "1 hour"),
        scene: s10,
        lab: labWeb(true),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Trust, but test",
        body: [
          "<ul class=\"takeaways\"><li><b>Unit</b>: one piece, milliseconds, thousands of them.</li><li><b>Integration</b>: real database or broker in a container; catches wiring and SQL.</li><li><b>Contract</b>: each side verifies a shared promise instead of a shared environment.</li><li><b>End-to-end</b>: a handful of critical journeys only.</li><li>Kill flakiness fast and keep the first signal under a few minutes.</li><li>Tests cover code, not production: pair them with monitoring and gradual rollout.</li></ul>",
        ],
        metrics: M("90 s", "all 4 layers", "rare", "1 hour"),
        scene: s11,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 11.2 ship-it-safely — Ferncart moves from release trains to canaries
// ════════════════════════════════════════════════════════════════════════════
{
  const XS = [-9, -3, 3, 9];
  const app = (i, sub, extra = {}) => srv(XS[i], -2, ["App"], { s: 3.6, h: 40, sub, cpu: -1, ...extra });
  const fleetZone = (label = "PROD FLEET · 4 SERVERS") => zone(-12, 12, -5.5, 1.5, label);
  const base = (sub = "v41") => ({
    entities: {
      users: crowd(0, -27, 14, "Shoppers"),
      lb: lbal(0, -15),
      s1: app(0, sub),
      s2: app(1, sub),
      s3: app(2, sub),
      s4: app(3, sub),
      fleet: fleetZone(),
    },
    links: {
      u: L("users", "lb", "HTTPS"),
      l1: L("lb", "s1"),
      l2: L("lb", "s2"),
      l3: L("lb", "s3"),
      l4: L("lb", "s4"),
    },
    flows: [{ route: ["u", ["l1", "l2", "l3", "l4"]], bounce: true, rate: 2.2 }],
  });
  const pipeline = (e, l) => {
    e.p1 = blk(18, -27, "slab", "gitCommit", ["Commit"], { s: 3.2, h: 34 });
    e.p2 = blk(18, -19.5, "yellow", "package", ["Build"], { s: 3.2, h: 34, tags: [tag("image a3f9c1", "paper", "package")] });
    e.p3 = blk(18, -12, "purple", "flask", ["Test"], { s: 3.2, h: 34 });
    e.p4 = blk(18, -4.5, "green", "rocket", ["Deploy"], { s: 3.2, h: 34 });
    l.q1 = L("p1", "p2");
    l.q2 = L("p2", "p3");
    l.q3 = L("p3", "p4");
    l.dep = L("p4", "s4", "same artifact");
  };
  const artifact = { route: ["q1", "q2", "q3", "dep"], kind: "heavy", rate: 0.35 };

  const s1 = mut(base(), (s, e, l) => {
    e.ops = device(18, -12, "Ops laptop");
    l.dep = L("ops", "s4", "scp + restart", { style: "dashed" });
    s.flows.push({ route: ["dep"], kind: "heavy", rate: 0.3 });
    e.card = card("Release train", "clock", ["# every other Thursday, 22:00", "40 commits shipped together", "! rollback = rebuild v40 by hand"]);
  });

  const s2 = mut(s1, (s, e, l) => {
    delete e.card;
    for (const id of ["s1", "s2", "s3", "s4"]) Object.assign(e[id], HOT, { sub: "v42" });
    e.s2.tags = [tag("crash: missing config", "red", "alert")];
    e.fleet.label = "ALL 4 SERVERS ON v42";
    for (const id of ["l1", "l2", "l3", "l4"]) l[id].fail = 0.45;
    l.dep.label = "v42 everywhere";
    s.flows = [{ route: ["u", ["l1", "l2", "l3", "l4"]], bounce: true, rate: 2.4, pattern: ["req", "slow"] }];
  });

  const s3 = mut(base("v42.1"), (s, e, l) => {
    pipeline(e, l);
    s.flows.push(artifact);
  });

  const s4 = mut(s3, (s, e, l) => {
    for (const id of ["s1", "s2", "s3", "s4"]) e[id].sub = "v43 · dark";
    e.flags = blk(-17, -15, "yellow", "toggle", ["Feature", "flags"], { s: 3.6, tags: [tag("new checkout: 5%", "violet", "toggle")] });
    l.fl = L("flags", "s1", "flag rules", { style: "dashed" });
    s.flows = [
      { route: ["u", ["l1", "l2", "l3", "l4"]], bounce: true, rate: 2.4, pattern: ["req", "req", "req", "req", "req", "req", "mine"] },
      { route: ["fl"], kind: "push", rate: 0.5 },
      artifact,
    ];
  });

  const s5 = mut(s3, (s, e, l) => {
    delete e.fleet;
    e.blue = zone(-12, 0, -5.5, 1.5, "BLUE · v43 · STANDBY");
    e.green = zone(0, 12, -5.5, 1.5, "GREEN · v44 · LIVE");
    Object.assign(e.s1, { sub: "v43", dim: 0.5 });
    Object.assign(e.s2, { sub: "v43", dim: 0.5 });
    Object.assign(e.s3, { color: "green", sub: "v44" });
    Object.assign(e.s4, { color: "green", sub: "v44" });
    l.l1.style = "off";
    l.l2.style = "off";
    l.dep = L("p4", "s4", "deploy idle color");
    e.lb.tags = [tag("flip: blue → green", "green", "refresh")];
    s.flows = [{ route: ["u", ["l3", "l4"]], bounce: true, rate: 2.4 }, { route: ["q1", "q2", "q3", "dep"], kind: "heavy", rate: 0.35 }];
  });

  const canaryBase = mut(s3, (s, e, l) => {
    for (const id of ["s1", "s2", "s3"]) e[id].sub = "v44";
    e.s3.tags = [tag("baseline", "paper", "flag")];
    Object.assign(e.s4, { color: "yellow", sub: "v45 canary" });
    e.fleet.label = "STABLE v44 · CANARY v45";
    e.judge = blk(9, 10, "slab", "activity", ["Canary", "judge"], { s: 3.6, pills: "below" });
    l.j3 = { from: "judge", to: "s3", pts: ["judge", "s3"], style: "beat", heads: "none" };
    l.j4 = { from: "judge", to: "s4", pts: ["judge", "s4"], style: "beat", heads: "none" };
    l.dep.label = "v45 → 1 server";
  });
  const weighted = (extra = {}) => ({ route: ["u", ["l1", "l2", "l3", "l4"]], pick: "weights", weights: [6, 6, 6, 1], bounce: true, rate: 2.6, ...extra });

  const s6 = mut(canaryBase, (s) => {
    s.flows = [weighted(), { routes: [{ path: ["j3"] }, { path: ["j4"] }], kind: "ping", rate: 1 }];
    s.entities.card = card("Canary vs baseline · 15 min", "gauge", ["# 5% of traffic on v45"], {
      chart: "bars",
      w: 240,
      bars: [
        { label: "Errors · baseline", note: "0.3%", to: 0.08, tone: "green" },
        { label: "Errors · canary", note: "0.3%", to: 0.08, tone: "green", bold: true },
        { label: "p95 · baseline", note: "210 ms", to: 0.42, tone: "green" },
        { label: "p95 · canary", note: "220 ms", to: 0.44, tone: "green", bold: true },
      ],
    });
  });

  const s7 = mut(canaryBase, (s, e, l) => {
    Object.assign(e.s4, HOT, { tags: [tag("errors 4.1%", "red", "alert")] });
    l.l4.fail = 0.45;
    e.judge.tags = [tag("4.1% vs 0.3% → roll back", "red", "siren")];
    e.judge.heat = 0.4;
    s.flows = [weighted({ weights: [3, 3, 3, 1] }), { routes: [{ path: ["j3"] }, { path: ["j4"] }], kind: "ping", rate: 1 }, { route: ["j4"], kind: "kill", rate: 0.8 }];
    e.card = card("Canary vs baseline · 6 min", "gauge", ["! canary breaches the error budget"], {
      chart: "bars",
      w: 240,
      bars: [
        { label: "Errors · baseline", note: "0.3%", to: 0.08, tone: "green" },
        { label: "Errors · canary", note: "4.1%", to: 0.9, tone: "red", bold: true },
        { label: "p95 · baseline", note: "210 ms", to: 0.42, tone: "green" },
        { label: "p95 · canary", note: "380 ms", to: 0.76, tone: "amber", bold: true },
      ],
    });
  });

  const s8 = mut(canaryBase, (s, e, l) => {
    Object.assign(e.s4, { color: "blue", sub: "v44", tags: [tag("rolled back · 90 s", "green", "undo")] });
    e.s3.tags = [];
    e.fleet.label = "ALL ON v44 · v45 BLOCKED";
    e.judge.tags = [tag("v45 blocked", "amber", "ban")];
    e.p4.tags = [tag("v45 halted", "amber", "ban")];
    l.dep.label = "halted";
    l.dep.style = "dashed";
    s.flows = [{ route: ["u", ["l1", "l2", "l3", "l4"]], bounce: true, rate: 2.4 }, { routes: [{ path: ["j3"] }, { path: ["j4"] }], kind: "ping", rate: 0.8 }];
  });

  const s9 = mut(canaryBase, (s, e, l) => {
    for (const id of ["s1", "s2", "s3"]) e[id].sub = "v45";
    e.s3.tags = [];
    e.s4.sub = "v46 canary";
    e.fleet.label = "v45 + v46 SHARE ONE SCHEMA";
    delete e.judge;
    delete l.j3;
    delete l.j4;
    e.db = store(10, 11, "Postgres", { tags: [tag("zip + postal_code", "amber", "database")] });
    l.fd3 = L("s3", "db", "v45 writes");
    l.fd4 = L("s4", "db", "v46 writes");
    s.flows = [weighted({ rate: 2 }), { routes: [{ path: ["fd3"] }, { path: ["fd4"] }], kind: "write", rate: 1.4, bounce: true }];
    e.card = card("Expand → contract", "database", [
      "1 expand: ADD postal_code (nullable)",
      "2 code writes both, reads zip",
      "3 backfill old rows in batches",
      "4 code reads postal_code",
      "5 contract: stop writing zip, DROP it",
      "= every step can be rolled back alone",
    ]);
  });

  const s10 = mut(canaryBase, (s, e, l) => {
    for (const id of ["s1", "s2", "s3"]) e[id].sub = "v58";
    e.s3.tags = [];
    e.s4.sub = "v59 canary";
    e.fleet.label = "20 SMALL DEPLOYS A DAY";
    e.p2.tags = [tag("2 commits", "green", "gitCommit")];
    l.dep.label = "v59";
    s.flows = [weighted(), artifact, { routes: [{ path: ["j3"] }, { path: ["j4"] }], kind: "ping", rate: 0.8 }];
    e.card = card("Ferncart, before → after", "rocket", [
      "deploys: 1 per 2 weeks → **20 a day**",
      "commits per deploy: 40 → **2**",
      "deploys that fail: 30% → **4%**",
      "= time to restore: 4 hours → 2 min",
    ]);
  });

  const s11 = mut(s10, (s, e) => {
    delete e.card;
  });

  const labFleet = (db) =>
    lab(
      120000,
      900,
      [
        ["users", "users", "Shoppers"],
        ["lb", "load_balancer", "Load Balancer"],
        ["app", "api_server", "App fleet", "4 servers"],
        ...(db ? [["db", "postgres", "Postgres"]] : []),
      ],
      [["users", "lb"], ["lb", "app"], ...(db ? [["app", "db"]] : [])],
    );

  const M = (deploys, leadTime, failRate, restore) => ({ deploys, leadTime, failRate, restore });
  write({
    id: "ship-it-safely",
    title: "Ship It Safely",
    summary: "Ferncart trades fortnightly big-bang releases for a pipeline, feature flags, blue-green, canaries with automatic rollback and safe schema changes.",
    minutes: 12,
    level: "intermediate",
    metrics: ["deploys", "leadTime", "failRate", "restore"],
    legend: ["req", "res", ["heavy", "build artifact"], ["mine", "new feature"], "ping", ["kill", "rollback"], "write", "fail"],
    goals: [
      { text: "Build once and promote one artifact through pipeline stages", step: 2 },
      { text: "Separate deploying code from releasing features with flags", step: 3 },
      { text: "Compare blue-green and canary rollouts", step: 5 },
      { text: "Roll back automatically when a canary misbehaves", step: 7 },
      { text: "Change a database schema without downtime (expand/contract)", step: 8 },
    ],
    steps: [
      {
        short: "Release day",
        chapter: "setup",
        title: "The fortnightly release train",
        body: [
          "Ferncart's tests are in good shape now, but shipping is still an event. Every other Thursday night an engineer copies the new build to all four servers and restarts them.",
          "Each release carries about <b>40 commits</b> from two weeks of work. If anything goes wrong, rolling back means rebuilding the previous version by hand.",
        ],
        metrics: M("1 / 2 wks", "2 weeks", "30%", "4 hours", 0.3),
        scene: s1,
        lab: labFleet(false),
      },
      {
        short: "Big bang",
        chapter: "problem",
        title: "Everything breaks at once",
        body: [
          "Release v42 includes a commit that reads a new config key nobody added in production. Checkout crashes on <b>all four servers at the same moment</b>.",
          "Which of the 40 commits did it? It takes four hours to find the cause, revert, rebuild and redeploy. Every shopper was affected the whole time.",
        ],
        callout: { kind: "warn", text: "Big batches make failures both <em>more likely</em> and <em>harder to diagnose</em>, and an all-at-once rollout makes them hit everyone." },
        changes: ["~ All 4 servers run v42", "~ Checkout errors for every shopper"],
        metrics: M("1 / 2 wks", "2 weeks", "30%", "4 hours", 38),
        scene: s2,
      },
      {
        short: "Pipeline",
        chapter: "technique",
        title: "A pipeline that builds once",
        body: [
          "A <span class=\"term\">CI/CD pipeline</span> turns every merge into the same sequence of stages: build, test, deploy. No laptop, no manual steps.",
          "The key rule: <b>build once, promote the same artifact</b>. The image tagged <code>a3f9c1</code> that passed tests is byte-for-byte what reaches production; only configuration changes per environment.",
          "Because every artifact is kept, rolling back is just deploying the previous one again: minutes, not hours.",
        ],
        changes: ["- Removed ops laptop", "+ Commit → Build → Test → Deploy stages", "~ Deploys use a versioned artifact"],
        metrics: M("3", "1 day", "15%", "20 min", 0.3),
        scene: s3,
      },
      {
        short: "Feature flags",
        chapter: "technique",
        title: "Deploy is not release",
        body: [
          "With <span class=\"term\">feature flags</span>, new code ships switched off: <code>if (flags.on(\"new-checkout\", user))</code>. Deploying becomes boring; <em>releasing</em> is a separate, reversible decision.",
          "The team turns the new checkout on for staff, then 5% of shoppers, then everyone. If it misbehaves, flipping the flag off takes seconds and needs no deploy.",
        ],
        callout: { kind: "tip", text: "Flags are debt: give each one an owner and delete it once the rollout is done." },
        changes: ["+ Feature flag service", "~ Servers run v43 with the feature dark", "~ 5% of shoppers see the new checkout"],
        metrics: M("5", "4 hours", "10%", "1 min", 0.3),
        scene: s4,
      },
      {
        short: "Blue-green",
        chapter: "technique",
        title: "Blue-green: two fleets and a switch",
        body: [
          "In a <span class=\"term\">blue-green deployment</span> there are two identical fleets. The new version goes to the idle one, gets smoke-tested, and then the load balancer flips all traffic over at once.",
          "Rollback is flipping back, which takes seconds. The costs: double the servers during a release, and every shopper moves at the same instant, so a bug that only shows under real load still hits everyone.",
        ],
        changes: ["~ Fleet split into blue (v43) and green (v44)", "~ Load balancer now sends all traffic to green", "~ Blue kept warm for instant rollback"],
        metrics: M("5", "4 hours", "8%", "1 min", 0.3),
        scene: s5,
      },
      {
        short: "Canary",
        chapter: "technique",
        title: "Canary: let a few go first",
        body: [
          "A <span class=\"term\">canary release</span> puts the new version on one server and sends it a small slice of traffic (here about 5%).",
          "An automated <b>canary judge</b> compares the canary with a <i>baseline</i> server running the old version over the same minutes: error rate, p95 latency, saturation. Comparing against the same moment avoids blaming the canary for a normal evening peak.",
          "If the numbers stay close for 15 minutes, the rollout widens step by step: 5% → 25% → 100%.",
        ],
        changes: ["~ One server runs v45 as the canary", "+ Canary judge watches canary vs baseline", "~ Load balancer weights ≈ 19 : 1"],
        metrics: M("8", "2 hours", "8%", "1 min", 0.3),
        scene: s6,
      },
      {
        short: "Bad canary",
        chapter: "problem",
        title: "The canary coughs",
        body: [
          "Six minutes in, v45's error rate climbs to <b>4.1%</b> while the baseline sits at 0.3%. A missing database index makes one checkout query time out under real data.",
          "No human is watching a dashboard at that moment, and none needs to: the judge's thresholds were agreed in advance, so it fires the rollback on its own.",
        ],
        changes: ["~ Canary error rate 4.1%", "~ Judge triggers a rollback"],
        metrics: M("8", "2 hours", "8%", "1 min", 0.5),
        scene: s7,
      },
      {
        short: "Auto rollback",
        chapter: "solution",
        title: "Automatic rollback",
        body: [
          "The canary goes back to v44 within <b>90 seconds</b> and the pipeline blocks v45 from going any further. About 5% of shoppers saw errors for a minute and a half.",
          "Compare that with the v42 release: every shopper, for four hours. Same kind of bug, very different <span class=\"term\">blast radius</span>.",
        ],
        callout: { kind: "insight", text: "You cannot stop every bad change from shipping. You <em>can</em> decide how many people it touches and for how long." },
        changes: ["~ Canary back on v44", "~ v45 halted in the pipeline"],
        metrics: M("8", "2 hours", "5%", "2 min", 0.3),
        scene: s8,
      },
      {
        short: "Migrations",
        chapter: "tradeoff",
        title: "Code rolls back. Data doesn't.",
        body: [
          "During any canary or blue-green release, old and new code run <em>at the same time</em> against <b>one</b> database. Renaming a column in one go breaks whichever version expects the old name, and you cannot roll that back by redeploying.",
          "So schema changes follow <span class=\"term\">expand/contract</span>: first add the new shape alongside the old, move code and data over in separate deploys, and remove the old shape only once nothing uses it.",
        ],
        changes: ["+ Postgres shared by both versions", "~ Schema holds zip and postal_code together"],
        metrics: M("12", "1 hour", "5%", "2 min", 0.3),
        scene: s9,
        lab: labFleet(true),
      },
      {
        short: "Small batches",
        chapter: "insight",
        title: "Smaller, more often, safer",
        body: [
          "Ferncart now ships about <b>20 times a day</b>, two commits at a time. That sounds riskier, but it is the opposite: a small change is easy to review, easy to judge on a canary, and obvious to revert.",
          "The four numbers in the HUD are the classic delivery health metrics: how often you deploy, how long a commit takes to reach users, how often a deploy fails, and how fast you recover.",
        ],
        changes: ["~ 2 commits per deploy", "~ 20 deploys a day"],
        metrics: M("20", "45 min", "4%", "2 min", 0.3),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Ship it safely",
        body: [
          "<ul class=\"takeaways\"><li><b>Pipeline</b>: build once, promote the same artifact through every stage.</li><li><b>Feature flags</b>: deploy dark, release gradually, kill switch in seconds.</li><li><b>Blue-green</b>: instant switch and rollback, but everyone moves at once.</li><li><b>Canary</b>: a small slice first, judged automatically against a baseline, rolled back without a human.</li><li><b>Expand/contract</b>: every schema change must work for old and new code at once.</li><li>Small, frequent deploys shrink both risk and recovery time.</li></ul>",
        ],
        metrics: M("20", "45 min", "4%", "2 min", 0.3),
        scene: s11,
      },
    ],
  });
}
