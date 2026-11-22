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

// ════════════════════════════════════════════════════════════════════════════
// 12.1 zoom-levels — Tablewise (restaurant booking): HLD service map vs LLD inside one service
// ════════════════════════════════════════════════════════════════════════════
{
  const hld = {
    entities: {
      diners: crowd(0, -26, 9, "Diners"),
      gw: lbal(0, -15, { label: ["API", "Gateway"] }),
      rest: blk(-13, -3, "blue", "building", ["Restaurant", "service"], { s: 3.8, cpu: 0.25 }),
      book: blk(0, -3, "blue", "clock", ["Booking", "service"], { s: 3.8, cpu: 0.35 }),
      notify: worker(13, -3, ["Notifier"]),
      restDb: store(-13, 9, "Restaurants DB"),
      bookDb: store(0, 9, "Bookings DB"),
      events: queueBlk(13, 9, ["Booking", "events"], { s: 3.4 }),
    },
    links: {
      dg: L("diners", "gw", "HTTPS"),
      gr: L("gw", "rest", "menus"),
      gb: L("gw", "book", "reserve"),
      rr: L("rest", "restDb"),
      bb: L("book", "bookDb"),
      be: L("book", "events", "BookingMade", { style: "dashed" }),
      en: L("events", "notify", "consume"),
    },
    flows: [
      { route: ["dg", "gb", "bb"], bounce: true, rate: 1.2 },
      { route: ["dg", "gr", "rr"], bounce: true, rate: 0.8 },
      { route: ["be", "en"], kind: "msg", rate: 0.6 },
    ],
  };

  const s2 = mut(hld, (s, e, l) => {
    e.card = card("What the map answers", "map", [
      "which **services** exist and who owns them",
      "how they talk: **sync** calls vs **async** events",
      "where each piece of **data** lives",
      "what scales out, and what fails alone",
      "# no classes, no columns, no code",
    ]);
    l.gb.labelTone = "green";
    l.be.label = "async event";
  });

  const s3 = mut(hld, (s, e, l) => {
    delete e.diners;
    e.ana = phone(-7, -26, "Ana");
    e.raj = phone(7, -26, "Raj");
    delete l.dg;
    l.ag = L("ana", "gw", "8 pm, table 4");
    l.rg = L("raj", "gw", "8 pm, table 4");
    Object.assign(e.book, { heat: 0.7, cpu: 0.7, tags: [tag("both get a yes?", "red", "alert")] });
    e.bookDb.tags = [tag("2 rows for 1 table", "red", "database")];
    s.flows = [
      { route: ["ag", "gb", "bb"], bounce: true, rate: 1 },
      { route: ["rg", "gb", "bb"], bounce: true, rate: 1 },
    ];
  });

  // LLD: the Booking service opened up. "book" keeps its id and spot so it animates in place.
  const lld = {
    entities: {
      ana: phone(-7, -28, "Ana"),
      raj: phone(7, -28, "Raj"),
      gw: lbal(0, -19, { label: ["API", "Gateway"] }),
      inside: zone(-14, 14, -12, 9, "INSIDE THE BOOKING SERVICE"),
      ctrl: blk(0, -8, "yellow", "code", ["Reservation", "controller"], { s: 3.4, h: 34 }),
      book: blk(0, -1, "blue", "clock", ["Booking", "logic"], { s: 3.8, cpu: 0.35 }),
      avail: blk(-9, -1, "purple", "listChecks", ["Availability"], { s: 3.4, h: 34 }),
      repo: blk(0, 6, "slab", "database", ["Reservation", "repository"], { s: 3.4, h: 34 }),
      outbox: blk(9, -1, "green", "send", ["Event", "publisher"], { s: 3.4, h: 34 }),
      bookDb: store(0, 16, "Bookings DB"),
      events: queueBlk(21, -1, ["Booking", "events"], { s: 3.4 }),
    },
    links: {
      ag: L("ana", "gw"),
      rg: L("raj", "gw"),
      gc: L("gw", "ctrl", "POST /reservations"),
      cb: L("ctrl", "book"),
      ba: L("book", "avail"),
      br: L("book", "repo"),
      bo: L("book", "outbox"),
      rd: L("repo", "bookDb", "SQL"),
      oe: L("outbox", "events", "BookingMade", { style: "dashed" }),
    },
    flows: [
      { route: [["ag", "rg"], "gc", "cb", "br", "rd"], bounce: true, rate: 1 },
      { route: ["ba"], bounce: true, kind: "ping", rate: 0.6 },
    ],
  };

  const s4 = lld;

  const s5 = mut(lld, (s, e, l) => {
    Object.assign(e.ctrl, { pills: "below", tags: [tag("the contract", "violet", "braces")] });
    e.card = card("Reservation API", "braces", [
      "POST /restaurants/{id}/reservations",
      "# body: slot, party_size, idempotency_key",
      "= 201 Created → reservation id",
      "! 409 Conflict → slot already taken",
      "GET /restaurants/{id}/availability?date=",
      "DELETE /reservations/{id}",
    ]);
  });

  const s6 = mut(lld, (s, e) => {
    e.bookDb.tags = [tag("UNIQUE (table_id, slot)", "green", "key")];
    e.card = card("Data model", "database", [
      "**tables**: id, restaurant_id, seats",
      "**reservations**: id, table_id, slot,",
      "    diner_id, party_size, status",
      "**idempotency**: key → reservation_id",
      "= one table + one slot = at most one row",
      "# index (restaurant_id, slot) for availability",
    ]);
  });

  const s7 = mut(lld, (s, e, l) => {
    e.bookDb.tags = [tag("UNIQUE (table_id, slot)", "green", "key")];
    e.ctrl.pills = "below";
    e.ctrl.tags = [tag("Raj → 409, offer 8:30", "amber", "clock")];
    l.rd.label = "INSERT";
    s.flows = [
      { route: ["ag", "gc", "cb", "br", "rd"], bounce: true, rate: 0.9 },
      { route: ["rg", "gc", "cb", "br", "rd"], kind: "poison", bounce: true, rate: 0.9 },
    ];
  });

  const s8 = mut(lld, (s, e, l) => {
    e.avail.tags = [tag("AvailabilityPolicy", "violet", "component")];
    e.repo.tags = [tag("ReservationStore", "violet", "component")];
    e.outbox.tags = [tag("EventSink", "violet", "component")];
    e.outbox.pills = "below";
    e.card = card("Dependencies point inward", "layers", [
      "controller → **BookingService**",
      "BookingService → interfaces it owns:",
      "    ReservationStore, EventSink, Policy",
      "Postgres / Kafka adapters implement them",
      "= tests swap adapters for in-memory fakes",
    ]);
    s.flows = [{ route: [["ag", "rg"], "gc", "cb", ["ba", "br", "bo"]], bounce: true, rate: 1.4 }];
  });

  const s9 = mut(hld, (s, e, l) => {
    e.book.tags = [tag("409 on conflict", "green", "check")];
    e.bookDb.tags = [tag("UNIQUE (table_id, slot)", "green", "key")];
    l.be.label = "via outbox";
  });

  const s10 = mut(s9, (s, e) => {
    delete e.book.tags;
  });

  const labHld = lab(
    40000,
    300,
    [
      ["users", "users", "Diners"],
      ["gw", "load_balancer", "API Gateway"],
      ["rest", "api_server", "Restaurant service"],
      ["book", "api_server", "Booking service"],
      ["restDb", "postgres", "Restaurants DB"],
      ["bookDb", "postgres", "Bookings DB"],
      ["events", "kafka", "Booking events"],
      ["notify", "worker", "Notifier"],
    ],
    [["users", "gw"], ["gw", "rest"], ["gw", "book"], ["rest", "restDb"], ["book", "bookDb"], ["book", "events"], ["events", "notify"]],
  );

  const M = (zoom, unit, output) => ({ zoom, unit, output });
  write({
    id: "zoom-levels",
    title: "Zoom Levels",
    summary: "Tablewise's booking system seen twice: as a high-level service map, then from inside one service, with its API, data model and classes.",
    minutes: 10,
    level: "intermediate",
    metrics: ["zoom", "unit", "output"],
    legend: ["req", "res", "msg", ["ping", "internal call"], ["poison", "rejected (409)"]],
    goals: [
      { text: "Say what a high-level design must show, and what it leaves out", step: 1 },
      { text: "Zoom into one service: modules, API contract and data model", step: 4 },
      { text: "Use the low-level design to enforce a rule the map can't", step: 6 },
      { text: "Move between both levels in a design interview", step: 8 },
    ],
    steps: [
      {
        short: "The map",
        chapter: "setup",
        title: "Tablewise, from 10,000 feet",
        body: [
          "<b>Tablewise</b> lets diners book tables at 3,000 restaurants. This is its <span class=\"term\">high-level design</span> (HLD): a gateway, two services, their databases, and an event stream that a notifier reads to send confirmations.",
          "Each box is something you deploy and own. Each arrow is a network call or a message. Nothing here says how a booking actually works inside.",
        ],
        metrics: M("service map", "services + stores", "—"),
        scene: hld,
        lab: labHld,
      },
      {
        short: "What HLD says",
        chapter: "insight",
        title: "What the map is for",
        body: [
          "An HLD answers <i>system-wide</i> questions: what are the parts, who calls whom, which calls are synchronous and which are async events, where data lives, and what scales or fails independently.",
          "It deliberately hides everything inside a box. That is what makes it useful for talking about the whole system at once, with a team or in an interview.",
        ],
        changes: ["+ Panel: what a high-level design answers", "~ Booking event marked as async"],
        metrics: M("service map", "services + stores", "box diagram"),
        scene: s2,
      },
      {
        short: "Hidden detail",
        chapter: "problem",
        title: "Two diners, one table",
        body: [
          "Ana and Raj both tap <b>8 pm, table 4</b> within the same second. Both requests reach the Booking service. Do both get a confirmation?",
          "The map can't answer. The arrow from the Booking service to its database looks exactly the same whether the code checks then inserts (racy) or relies on the database to refuse a duplicate (safe). The answer lives one zoom level down.",
        ],
        callout: { kind: "warn", text: "Many real bugs hide inside a single box: races, missing idempotency, a wrong index. A service map can't show any of them." },
        changes: ["+ Ana and Raj book the same table", "~ Booking service: double booking possible"],
        metrics: M("service map", "services + stores", "box diagram"),
        scene: s3,
      },
      {
        short: "Zoom in",
        chapter: "technique",
        title: "Open up one box",
        body: [
          "<span class=\"term\">Low-level design</span> (LLD) zooms into one service. Its parts are now modules and classes: a <b>controller</b> that speaks HTTP, the <b>booking logic</b>, an <b>availability</b> check, a <b>repository</b> that talks to the database, and an <b>event publisher</b>.",
          "The other services drop out of view. They still exist, but at this zoom level they are just the outside world.",
        ],
        changes: ["- Restaurant service, Notifier, their stores (out of frame)", "+ Booking service split into 5 modules", "~ Bookings DB moves below the repository"],
        metrics: M("inside Booking", "modules + classes", "module sketch"),
        scene: s4,
      },
      {
        short: "API contract",
        chapter: "technique",
        title: "Pin down the API",
        body: [
          "The first LLD artifact is the contract: endpoints, request fields and every response the caller must handle. Note the <code>idempotency_key</code>, so a retry after a timeout can't create a second booking, and the explicit <code>409 Conflict</code> for a slot that is already gone.",
          "Writing errors down at this level forces the hard decisions early. What should Raj see? Here, the next free slot.",
        ],
        changes: ["+ Panel: reservation endpoints", "+ Controller tagged as the contract"],
        metrics: M("inside Booking", "modules + classes", "API contract"),
        scene: s5,
      },
      {
        short: "Data model",
        chapter: "technique",
        title: "Design the tables",
        body: [
          "Next, the data model. A <b>reservations</b> row ties a table to a time slot, and a <b>unique constraint on (table_id, slot)</b> makes a double booking impossible, no matter how the application code is scheduled.",
          "An index on <code>(restaurant_id, slot)</code> keeps the availability query fast, and a small idempotency table maps each key to the reservation it already created.",
        ],
        changes: ["+ Panel: tables and keys", "+ Unique constraint on Bookings DB"],
        metrics: M("inside Booking", "tables + columns", "data model"),
        scene: s6,
      },
      {
        short: "Race solved",
        chapter: "solution",
        title: "The database says no",
        body: [
          "Replay the race. Both requests pass the availability check, because it ran before either insert. Ana's <code>INSERT</code> commits first; Raj's breaks the unique constraint, the repository turns that into a <i>SlotTaken</i> error, and the controller returns <b>409</b> with the 8:30 alternative.",
          "No locks held across network calls, no distributed coordination. One constraint, chosen at the LLD level, closes the race the HLD couldn't even show.",
        ],
        callout: { kind: "tip", text: "Treat the availability check as a hint for the UI. The constraint is the real guarantee." },
        changes: ["~ Raj's request rejected with 409", "~ Insert labelled on the repository link"],
        metrics: M("inside Booking", "tables + columns", "race handled"),
        scene: s7,
      },
      {
        short: "Classes",
        chapter: "insight",
        title: "Dependencies point inward",
        body: [
          "Inside the service, the booking logic depends only on small interfaces it defines: <code>ReservationStore</code>, <code>EventSink</code>, <code>AvailabilityPolicy</code>. The Postgres and Kafka code implement those interfaces at the edges.",
          "That's why the core can be unit-tested with in-memory fakes, and why swapping the message broker later touches one adapter, not the business rules.",
        ],
        changes: ["+ Interface names on three modules", "~ Booking logic now depends only on interfaces"],
        metrics: M("inside Booking", "interfaces + classes", "class sketch"),
        scene: s8,
      },
      {
        short: "Zoom out",
        chapter: "insight",
        title: "Back to the map, better informed",
        body: [
          "Zoom back out. The service map barely changed, but now two notes on it carry real weight: bookings return <b>409 on conflict</b>, and the database enforces <b>one row per table and slot</b>.",
          "Some LLD choices push back up. That constraint only works if all bookings for a table live in one database, which rules out splitting a restaurant's tables across shards. The levels inform each other.",
        ],
        callout: { kind: "insight", text: "In an interview: sketch the whole map first, then say “let me zoom into the booking path”. Pick one or two boxes; never all of them." },
        changes: ["+ Restaurant service, Notifier, stores back in view", "~ Booking service annotated with the LLD decisions"],
        metrics: M("both", "services ↔ classes", "HLD + 1 deep dive"),
        scene: s9,
        lab: labHld,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Two zoom levels, one system",
        body: [
          "<ul class=\"takeaways\"><li><b>HLD</b>: services, stores, queues and the calls between them. Answers scale, ownership and failure questions.</li><li><b>LLD</b>: inside one service. Modules, API contract, data model, classes.</li><li>Races, idempotency and indexes are LLD problems; you can't see them on the map.</li><li>Keep the core logic free of I/O and depend on interfaces you own.</li><li>LLD decisions can constrain the HLD (for example, what can be sharded).</li><li>In interviews, go wide first, then deep on one or two boxes.</li></ul>",
        ],
        metrics: M("both", "services ↔ classes", "HLD + 1 deep dive"),
        scene: s10,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 12.2 build-a-link-shortener — Tinylane (tnyl.co): an interview-style walkthrough
// ════════════════════════════════════════════════════════════════════════════
{
  const people = () => ({
    creator: device(-9, -28, "Marketer"),
    clickers: crowd(9, -28, 12, "Clickers"),
  });
  const s1 = {
    entities: {
      ...people(),
      box: ghost(0, -8, "Tinylane?", 7, 80),
      card: card("Requirements", "listChecks", [
        "**must**: long URL → tnyl.co/xxxxxxx",
        "**must**: code → redirect, fast, always up",
        "**nice**: custom alias · expiry date",
        "**nice**: click counts per link",
        "# codes unique and not guessable in order",
        "# analytics may lag a minute",
      ]),
    },
    links: {
      cb: L("creator", "box", "shorten"),
      kb: L("clickers", "box", "click"),
    },
    flows: [
      { route: ["cb"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["kb"], bounce: true, rate: 2.2 },
    ],
  };

  const s2 = mut(s1, (s, e, l) => {
    e.card = card("Back of the envelope", "sigma", [
      "100 M new links / month → **~40 writes/s**",
      "~100 clicks per link → **~4,000 redirects/s**",
      "evening peak ×5 → **20,000 redirects/s**",
      "5 years → 6 B links × 500 B ≈ **3 TB**",
      "= 62⁷ ≈ 3.5 trillion codes: 7 chars is plenty",
      "# reads outnumber writes 100 : 1",
    ]);
    l.cb.label = "40 /s";
    l.kb.label = "4,000 /s";
    s.flows = [
      { route: ["cb"], kind: "write", bounce: true, rate: 0.3 },
      { route: ["kb"], bounce: true, rate: 4 },
    ];
  });

  const s3 = mut(s2, (s, e, l) => {
    l.cb.label = "POST /api/links";
    l.kb.label = "GET /{code}";
    e.card = card("The API", "braces", [
      "POST /api/links",
      "  { long_url, alias?, expires_at? }",
      "= 201 { code, short_url }",
      "GET /{code}",
      "= 302 Found · Location: long_url",
      "! 404 if unknown or expired",
      "# 302, not 301: browsers cache a 301 forever",
    ]);
    s.flows = [
      { route: ["cb"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["kb"], bounce: true, rate: 2.2 },
    ];
  });

  // High-level design: one shared layout evolved by every later step.
  const s4 = {
    entities: {
      ...people(),
      lb: lbal(0, -17),
      create: srv(-8, -5, ["Create", "service"], { sub: "3 servers", cpu: 0.15 }),
      redirect: srv(8, -5, ["Redirect", "service"], { sub: "8 servers", cpu: 0.55 }),
      db: store(0, 16, "Links KV", { tags: [tag("key: code", "violet", "key")] }),
      db2: store(-10, 19, "replica", { opacity: 0.85 }),
      db3: store(10, 19, "replica", { opacity: 0.85 }),
      card: card("Data model", "database", [
        "**links**: code (PK) → long_url,",
        "    owner_id, created_at, expires_at",
        "= one key in, one row out: no joins",
        "→ a key-value store, partitioned by code",
        "# 3 TB × 3 replicas, spread over 12 nodes",
      ]),
    },
    links: {
      cl: L("creator", "lb", "POST /api/links"),
      kl: L("clickers", "lb", "GET /{code}"),
      lc: L("lb", "create"),
      lr: L("lb", "redirect"),
      cd: L("create", "db", "put"),
      rd: L("redirect", "db", "get"),
      r2: L("db", "db2", "", { style: "dashed" }),
      r3: L("db", "db3", "", { style: "dashed" }),
    },
    flows: [
      { route: ["cl", "lc", "cd"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["kl", "lr", "rd"], bounce: true, rate: 2.4 },
      { routes: [{ path: ["r2"] }, { path: ["r3"] }], kind: "write", rate: 0.4 },
    ],
  };

  const s5 = mut(s4, (s, e, l) => {
    e.create.tags = [tag("md5(url) → 7 chars", "amber", "hash")];
    e.create.pills = "above";
    Object.assign(e.db, { heat: 0.6, tags: [tag("code taken!", "red", "alert")] });
    l.cd.label = "exists? → put";
    l.cd.labelTone = "amber";
    s.flows = [
      { route: ["cl", "lc", "cd"], bounce: true, rate: 1, pattern: ["write", "write", "poison"] },
      { route: ["kl", "lr", "rd"], bounce: true, rate: 1.6 },
    ];
    e.card = card("Hashing collides", "alert", [
      "7 base62 chars = 3.5 trillion codes",
      "! 50% chance of a clash by ~2.2 M links",
      "! at 6 B links: ~5 M clashes expected",
      "! each write: read first, retry with salt",
      "! two servers can still race on one code",
    ]);
  });

  const s6 = mut(s4, (s, e, l) => {
    delete e.card;
    e.ranges = blk(-19, -5, "slab", "listOrdered", ["Range", "service"], { s: 3.6 });
    e.create.tags = [tag("ids 7,000,000–7,999,999", "green", "hash")];
    e.create.pills = "above";
    l.rc = L("ranges", "create", "lease 1M ids", { style: "dashed" });
    s.flows = [
      { route: ["cl", "lc", "cd"], kind: "write", bounce: true, rate: 0.8 },
      { route: ["kl", "lr", "rd"], bounce: true, rate: 1.6 },
      { route: ["rc"], kind: "ping", rate: 0.15 },
    ];
    e.card = card("Counter → base62", "hash", [
      "each create server leases **1 M ids** at a time",
      "id = 62⁶ + n → always 7 base62 chars",
      "  62⁶ = 56,800,235,584 → \"1000000\"",
      "scramble(id) with a keyed permutation",
      "= unique by construction, no read-before-write",
      "# a crash just skips the rest of a lease",
    ]);
  });

  const s7 = mut(s6, (s, e, l) => {
    delete e.card;
    e.create.tags = [];
    e.cache = cache(8, 6, ["Redis"], { sub: "20 GB hot set", tags: [tag("hit 90%", "green", "zap")] });
    delete l.rd;
    l.rc2 = L("redirect", "cache", "get");
    l.cad = L("cache", "db", "miss");
    s.flows = [
      { route: ["cl", "lc", "cd"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["kl", "lr", "rc2"], bounce: true, rate: 2.4 },
      { route: ["kl", "lr", "rc2", "cad"], bounce: true, rate: 0.35, kind: "slow" },
      { route: ["rc"], kind: "ping", rate: 0.1 },
    ];
  });

  const s8 = mut(s7, (s, e, l) => {
    e.edge = blk(13, -20, "orange", "globe", ["Edge", "CDN"], { s: 3.6, tags: [tag("302 cached 5 min", "green", "zap")] });
    delete l.kl;
    l.ke = L("clickers", "edge", "GET /{code}");
    l.el = L("edge", "lb", "miss");
    Object.assign(e.redirect, { cpu: 0.2, sub: "4 servers" });
    s.flows = [
      { route: ["ke"], bounce: true, rate: 3 },
      { route: ["ke", "el", "lr", "rc2"], bounce: true, rate: 0.8 },
      { route: ["ke", "el", "lr", "rc2", "cad"], bounce: true, rate: 0.15, kind: "slow" },
      { route: ["cl", "lc", "cd"], kind: "write", bounce: true, rate: 0.4 },
    ];
  });

  const s9 = mut(s8, (s, e, l) => {
    e.events = queueBlk(19, -5, ["Click", "events"], { s: 3.4 });
    e.agg = worker(19, 6, ["Click", "counter"]);
    e.stats = store(19, 16, "Click stats");
    l.re = L("redirect", "events", "click", { style: "dashed" });
    l.ee = L("edge", "events", "edge logs", { style: "dashed" });
    l.ea = L("events", "agg", "consume");
    l.as = L("agg", "stats", "+n per minute");
    s.flows = [
      { route: ["ke"], bounce: true, rate: 2.6 },
      { route: ["ke", "el", "lr", "rc2"], bounce: true, rate: 0.8 },
      { route: ["cl", "lc", "cd"], kind: "write", bounce: true, rate: 0.3 },
      { routes: [{ path: ["re", "ea", "as"] }, { path: ["ee", "ea", "as"] }], kind: "msg", rate: 1.4 },
    ];
  });

  const s10 = mut(s9, (s, e, l) => {
    Object.assign(e.edge, { heat: 0.7, tags: [tag("viral link: 30k/s", "amber", "flame")] });
    e.ranges.tags = [tag("down? leases last ~21 h", "amber", "clock")];
    e.ranges.pills = "above";
    e.cache.tags = [tag("node lost → misses", "amber", "alert")];
    e.card = card("Where it bends", "gauge", [
      "! one viral link → one hot key: the edge absorbs it",
      "! range service down → servers keep their leases",
      "! cache node lost → coalesce misses, warm replica",
      "! spam & malware → rate-limit creates, scan URLs",
      "! expiry → check expires_at on read, sweep nightly",
    ]);
    s.flows = [
      { route: ["ke"], bounce: true, rate: 4.5 },
      { route: ["ke", "el", "lr", "rc2", "cad"], bounce: true, rate: 0.5, kind: "slow" },
      { route: ["cl", "lc", "cd"], kind: "write", bounce: true, rate: 0.3 },
      { routes: [{ path: ["re", "ea", "as"] }, { path: ["ee", "ea", "as"] }], kind: "msg", rate: 1.4 },
    ];
  });

  const s11 = mut(s9, (s, e) => {
    e.edge.tags = [];
  });

  const labBase = (opts = {}) =>
    lab(
      3000000,
      opts.rps ?? 4000,
      [
        ["users", "users", "Clickers"],
        ...(opts.cdn ? [["edge", "cdn", "Edge CDN"]] : []),
        ["lb", "load_balancer", "Load Balancer"],
        ["create", "api_server", "Create service"],
        ["redirect", "api_server", "Redirect service"],
        ...(opts.cache ? [["cache", "redis", "Redis"]] : []),
        ["db", "cassandra", "Links KV"],
        ...(opts.events ? [["events", "kafka", "Click events"], ["agg", "worker", "Click counter"], ["stats", "postgres", "Click stats"]] : []),
      ],
      [
        ...(opts.cdn ? [["users", "edge"], ["edge", "lb"]] : [["users", "lb"]]),
        ["lb", "create"],
        ["lb", "redirect"],
        ["create", "db"],
        ...(opts.cache ? [["redirect", "cache"], ["cache", "db"]] : [["redirect", "db"]]),
        ...(opts.events ? [["redirect", "events"], ["events", "agg"], ["agg", "stats"]] : []),
      ],
    );

  const M = (redirectMs, dbQps, codeKind, linksKept) => ({ redirectMs, dbQps, codeKind, linksKept });
  write({
    id: "build-a-link-shortener",
    title: "Build a Link Shortener",
    summary: "Design Tinylane end to end, interview style: requirements, estimates, API, key generation, storage, a cached redirect path and async click analytics.",
    minutes: 13,
    level: "intermediate",
    metrics: ["redirectMs", "dbQps", "codeKind", "linksKept"],
    legend: ["req", "res", "write", "slow", "msg", ["ping", "id lease"], ["poison", "collision"]],
    goals: [
      { text: "Turn a vague prompt into requirements and numbers", step: 1 },
      { text: "Generate short codes that never collide", step: 5 },
      { text: "Make redirects fast with a cache and an edge CDN", step: 7 },
      { text: "Keep analytics off the redirect path", step: 8 },
      { text: "Name the bottlenecks and how the design bends", step: 9 },
    ],
    steps: [
      {
        short: "Requirements",
        chapter: "setup",
        title: "Pin down what we're building",
        body: [
          "The prompt: <i>“Design a URL shortener.”</i> Before drawing anything, agree on scope. <b>Tinylane</b> turns long campaign URLs into <code>tnyl.co/xxxxxxx</code> and redirects anyone who clicks.",
          "Must-haves: create a short link, redirect quickly, never break a link. Nice-to-haves: custom aliases, expiry dates, click counts. Equally important are the non-functional ones: redirects must be <b>fast and always available</b>, and codes must not be guessable in sequence.",
        ],
        callout: { kind: "tip", text: "Spend the first few minutes on requirements. Every later choice is justified by one of them." },
        metrics: M(null, null, null, null),
        scene: s1,
      },
      {
        short: "Estimates",
        chapter: "setup",
        title: "Rough numbers",
        body: [
          "Assume <b>100 million</b> new links a month: about 40 writes a second. If each link is clicked about 100 times, that's roughly <b>4,000 redirects a second</b>, and maybe 20,000 at peak.",
          "Over five years that's 6 billion links. At ~500 bytes each, about <b>3 TB</b>: big for one machine's RAM, small for a database cluster. And 7 base62 characters (a–z, A–Z, 0–9) give 3.5 trillion codes, far more than we'll ever need.",
          "The headline: this system is <b>read-heavy, 100 : 1</b>. Optimize the redirect.",
        ],
        changes: ["+ Panel: back-of-the-envelope numbers", "~ Arrows labelled with rates"],
        metrics: M(null, null, null, "6 B (5 years)"),
        scene: s2,
      },
      {
        short: "API",
        chapter: "technique",
        title: "Two endpoints",
        body: [
          "Creating a link is a <code>POST</code> with the long URL and optional alias and expiry. Following one is a plain <code>GET /{code}</code> answered with a redirect.",
          "Which redirect? A <b>301</b> (permanent) gets cached by browsers, so repeat clicks never reach us: cheaper, but we can't count them, change the target, or expire the link. A <b>302</b> (temporary) keeps every click visible. Tinylane picks 302.",
        ],
        changes: ["+ Panel: create and redirect endpoints", "~ Arrows labelled with their endpoints"],
        metrics: M(null, null, null, "6 B (5 years)"),
        scene: s3,
      },
      {
        short: "High level",
        chapter: "solution",
        title: "First sketch of the system",
        body: [
          "Behind a load balancer, split the two paths: a small <b>Create service</b> for writes and a larger, stateless <b>Redirect service</b> for reads, so each scales on its own.",
          "The data is one key mapping to one row, with no joins, so a replicated <span class=\"term\">key-value store</span> partitioned by code fits well: every lookup goes to exactly one partition, and adding nodes adds capacity.",
          "Every click still goes all the way to the store: about 90 ms for a user far from our region.",
        ],
        changes: ["- Placeholder box", "+ Load balancer, Create and Redirect services", "+ Links KV store with 2 replicas"],
        metrics: M(90, 4000, null, "6 B · 3 TB"),
        scene: s4,
        lab: labBase(),
      },
      {
        short: "Hash codes?",
        chapter: "problem",
        title: "Deep dive: why not hash the URL?",
        body: [
          "Tempting: take <code>md5(long_url)</code>, base62-encode it, keep 7 characters. But 7 characters is a small space for a hash. By the <span class=\"term\">birthday paradox</span>, there's a 50% chance of a clash after only ~2.2 million links, and at 6 billion we'd expect about <b>5 million</b> clashes.",
          "So every create must first read “is this code taken?”, rehash with a salt if so, and still risk two servers claiming the same code at the same moment.",
        ],
        callout: { kind: "warn", text: "Truncated hashes collide long before the space looks full. Collisions grow with the square of the number of links." },
        changes: ["~ Create service hashes the URL", "~ Writes check before inserting", "~ Some writes collide"],
        metrics: M(90, 4000, "hash: collides", "6 B · 3 TB"),
        scene: s5,
      },
      {
        short: "ID ranges",
        chapter: "solution",
        title: "Counters, leased in blocks",
        body: [
          "Instead, give every link a number that's unique by construction, then base62-encode it. A single global counter would be a bottleneck, so a tiny <b>Range service</b> leases each create server a block of <b>a million ids</b>. The server hands them out from memory and comes back once per block.",
          "Starting at 62⁶ makes every code exactly 7 characters. To avoid codes that reveal volume or can be walked in order, pass the id through a keyed, reversible <span class=\"term\">permutation</span> first: it stays unique, but looks random.",
        ],
        callout: { kind: "insight", text: "If a server crashes mid-block, the rest of that block is simply never used. Gaps are fine; duplicates are not." },
        changes: ["+ Range service leases id blocks", "~ Create service encodes ids in base62", "- Read-before-write check"],
        metrics: M(90, 4000, "counter: unique", "6 B · 3 TB"),
        scene: s6,
        lab: labBase(),
      },
      {
        short: "Cache",
        chapter: "solution",
        title: "Deep dive: the redirect path",
        body: [
          "Clicks are heavily skewed: a small share of fresh, popular links gets most of the traffic. A <b>Redis</b> cache in front of the store (cache-aside: read Redis, on a miss read the store and fill Redis) serves about <b>90%</b> of lookups from a 20 GB hot set.",
          "Store lookups fall from 4,000 to about 400 a second. Unknown codes from scanners get cached too, as short-lived “not found” entries, so they don't hammer the store.",
        ],
        changes: ["+ Redis cache between Redirect service and store", "~ Only misses reach Links KV"],
        metrics: M(70, 400, "counter: unique", "6 B · 3 TB"),
        scene: s7,
        lab: labBase({ cache: true }),
      },
      {
        short: "Edge CDN",
        chapter: "solution",
        title: "Answer at the edge",
        body: [
          "The remaining time is mostly distance. Putting a <b>CDN</b> in front lets an edge server near the clicker answer popular redirects itself: the 302 carries <code>Cache-Control: max-age=300</code>, so the edge reuses it for five minutes.",
          "A hit now takes under 20 ms anywhere in the world, and the Redirect fleet shrinks from eight servers to four. The cost: an expired or edited link can live on at the edge for up to five minutes.",
        ],
        changes: ["+ Edge CDN in front of the load balancer", "~ Redirect service: 8 → 4 servers"],
        metrics: M(18, 150, "counter: unique", "6 B · 3 TB"),
        scene: s8,
        lab: labBase({ cache: true, cdn: true, rps: 20000 }),
      },
      {
        short: "Analytics",
        chapter: "technique",
        title: "Count clicks without slowing them",
        body: [
          "Counting clicks must never delay a redirect. The Redirect service fires a small <b>click event</b> into a log like Kafka and responds immediately. Edge hits never reach us, so the CDN's access logs are streamed into the same topic.",
          "A <b>click counter</b> consumes the events, adds them up per link per minute, and writes the totals to a stats store. Dashboards lag by about a minute, which the requirements allowed.",
        ],
        callout: { kind: "tip", text: "Anything that isn't needed to answer the request belongs after the response: queue it." },
        changes: ["+ Click events topic", "+ Click counter worker and stats store", "+ CDN logs feed the same topic"],
        metrics: M(18, 150, "counter: unique", "6 B · 3 TB"),
        scene: s9,
        lab: labBase({ cache: true, cdn: true, events: true, rps: 20000 }),
      },
      {
        short: "Bottlenecks",
        chapter: "tradeoff",
        title: "Where it bends",
        body: [
          "Finish by stress-testing your own design. A viral link becomes one very hot key, but the edge absorbs it. If the Range service goes down, each create server still holds a lease that lasts about <b>21 hours</b> at current rates. If a cache node dies, misses spike, so collapse duplicate misses into one store read.",
          "Then the parts people forget: rate-limit link creation and scan target URLs for malware, and enforce expiry on read with a nightly sweep to delete dead rows.",
        ],
        changes: ["~ Edge absorbs a viral link", "+ Notes on range, cache and abuse risks"],
        metrics: M(18, 300, "counter: unique", "6 B · 3 TB"),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Tinylane, end to end",
        body: [
          "<ul class=\"takeaways\"><li><b>Requirements and estimates first</b>: 40 writes/s vs 4,000 reads/s decides everything.</li><li><b>302 over 301</b> keeps clicks visible and links editable.</li><li><b>Leased counter ranges + base62</b> give unique 7-char codes with no coordination per write; a keyed permutation hides the order.</li><li><b>Key-value store</b> partitioned by code, replicated 3×.</li><li><b>Cache + CDN</b> serve the hot set; the store sees a trickle.</li><li><b>Analytics are async</b>: events after the response, counted in the background.</li></ul>",
        ],
        metrics: M(18, 150, "counter: unique", "6 B · 3 TB"),
        scene: s11,
        lab: labBase({ cache: true, cdn: true, events: true, rps: 20000 }),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 12.3 build-a-news-feed — Murmur (short-post social app): interview walkthrough
// ════════════════════════════════════════════════════════════════════════════
{
  const people = () => ({
    kai: phone(-9, -28, "Kai posts"),
    readers: crowd(9, -28, 12, "Readers"),
  });
  const s1 = {
    entities: {
      ...people(),
      box: ghost(0, -8, "Murmur?", 7, 80),
      card: card("Requirements", "listChecks", [
        "**must**: post short text + photos",
        "**must**: home feed of people you follow",
        "**must**: feed opens in **< 200 ms**",
        "**must**: new posts show up within seconds",
        "# ranked, paged, infinite scroll",
        "# a few seconds of staleness is fine",
      ]),
    },
    links: {
      kb: L("kai", "box", "post"),
      rb: L("readers", "box", "open feed"),
    },
    flows: [
      { route: ["kb"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["rb"], bounce: true, rate: 2.2 },
    ],
  };

  const s2 = mut(s1, (s, e, l) => {
    e.card = card("Back of the envelope", "sigma", [
      "200 M daily users · follow ~200 each",
      "10 feed opens/day → **~23,000 feeds/s** (peak ~70k)",
      "100 M posts/day → **~1,200 posts/s**",
      "push each post to ~200 followers",
      "  → **~230,000 feed writes/s**",
      "= 500 ids × 8 B per user → ~800 GB of feeds",
    ]);
    l.kb.label = "1,200 /s";
    l.rb.label = "23,000 /s";
  });

  const s3 = mut(s2, (s, e, l) => {
    l.kb.label = "POST /v1/posts";
    l.rb.label = "GET /v1/feed";
    e.card = card("The API", "braces", [
      "POST /v1/posts { text, media_ids }",
      "= 201 { post_id }",
      "GET /v1/feed?cursor=…&limit=20",
      "= 200 { items: [...], next_cursor }",
      "# cursor, not page number: new posts",
      "# would shift every offset and repeat items",
    ]);
  });

  // High-level design, evolved by every later step.
  const s4 = {
    entities: {
      ...people(),
      lb: lbal(0, -17),
      post: srv(-10, -5, ["Post", "service"], { cpu: 0.2 }),
      feed: srv(10, -5, ["Feed", "service"], { cpu: 0.45 }),
      posts: store(-10, 7, "Posts DB"),
      graph: store(2, 9, "Follow graph"),
    },
    links: {
      kl: L("kai", "lb", "POST /v1/posts"),
      rl: L("readers", "lb", "GET /v1/feed"),
      lp: L("lb", "post"),
      lf: L("lb", "feed"),
      pp: L("post", "posts", "insert"),
      fg: L("feed", "graph", "who do I follow?"),
      fp: L("feed", "posts", "latest from each"),
    },
    flows: [
      { route: ["kl", "lp", "pp"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["rl", "lf", "fg"], bounce: true, rate: 1 },
      { route: ["rl", "lf", "fp"], bounce: true, rate: 1.6, kind: "heavy" },
    ],
  };

  const s5 = mut(s4, (s, e, l) => {
    Object.assign(e.feed, HOT, { tags: [tag("merge 200 timelines", "red", "merge")] });
    Object.assign(e.posts, { heat: 0.9, cpu: 0.95, tags: [tag("14 M reads/s", "red", "flame")] });
    l.fp.label = "×200 per feed";
    l.fp.labelTone = "red";
    s.flows = [
      { route: ["kl", "lp", "pp"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["rl", "lf", "fg"], bounce: true, rate: 1.2 },
      { route: ["rl", "lf", "fp"], bounce: true, rate: 3, pattern: ["heavy", "slow", "heavy", "slow"] },
    ];
  });

  // Fan-out on write: new posts queue → workers → per-user feed lists in Redis.
  const pushParts = (e, l) => {
    e.newPosts = queueBlk(-19, 3, ["New", "posts"], { s: 3.4 });
    e.fanout = worker(-15, 14, ["Fan-out", "workers"]);
    e.feedCache = cache(10, 14, ["Feed", "cache"], { sub: "500 ids / user" });
    l.pq = L("post", "newPosts", "PostCreated", { style: "dashed" });
    l.qw = L("newPosts", "fanout", "consume");
    l.wg = L("fanout", "graph", "followers");
    l.wc = L("fanout", "feedCache", "prepend id");
    l.fc = L("feed", "feedCache", "read my list");
    l.fp.label = "hydrate 20 posts";
    l.fg.style = "off";
    delete l.fg.label;
  };
  const s6 = mut(s4, (s, e, l) => {
    pushParts(e, l);
    e.fanout.tags = [tag("×200 writes", "green", "split")];
    s.flows = [
      { route: ["kl", "lp", "pp"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["pq", "qw", "wg"], kind: "msg", bounce: true, rate: 0.5 },
      { route: ["wc"], kind: "write", rate: 1.6 },
      { route: ["rl", "lf", "fc"], bounce: true, rate: 1.8 },
      { route: ["fp"], bounce: true, rate: 0.9 },
    ];
  });

  const s7 = mut(s6, (s, e, l) => {
    delete e.kai;
    e.nova = phone(-9, -28, "Nova · 50M fans");
    delete l.kl;
    l.nl = L("nova", "lb", "1 post");
    Object.assign(e.fanout, HOT, { tags: [tag("50,000,000 writes", "red", "flame")] });
    e.newPosts.tags = [tag("backlog: 33 min", "red", "hourglass")];
    e.newPosts.heat = 0.8;
    e.backlog = queue(-22, 5, 6, [0.35, 1]);
    l.wc.fail = 0.2;
    s.flows = [
      { route: ["nl", "lp", "pp"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["pq", "qw"], kind: "msg", rate: 1.4 },
      { route: ["wc"], kind: "write", rate: 4 },
      { route: ["rl", "lf", "fc"], bounce: true, rate: 1.4, pattern: ["req", "slow"] },
    ];
  });

  const s8 = mut(s6, (s, e, l) => {
    delete e.kai;
    e.nova = phone(-9, -28, "Nova · 50M fans");
    delete l.kl;
    l.nl = L("nova", "lb", "1 post");
    e.newPosts.tags = [tag("> 100k fans: no push", "violet", "split")];
    e.fanout.tags = [tag("normal accounts only", "green", "split")];
    e.feed.tags = [tag("list + 3 celebs", "green", "merge")];
    e.feed.pills = "below";
    l.fp.label = "celebs' recent posts";
    l.fp.labelTone = "violet";
    s.flows = [
      { route: ["nl", "lp", "pp"], kind: "write", bounce: true, rate: 0.4 },
      { route: ["pq", "qw", "wg"], kind: "msg", bounce: true, rate: 0.4 },
      { route: ["wc"], kind: "write", rate: 1.2 },
      { route: ["rl", "lf", "fc"], bounce: true, rate: 1.8 },
      { route: ["fp"], bounce: true, rate: 1.1 },
    ];
  });

  const hybridQuiet = (e) => {
    e.newPosts.tags = [];
    e.fanout.tags = [];
    e.feed.tags = [];
  };
  const s9 = mut(s8, (s, e, l) => {
    hybridQuiet(e);
    e.ranker = blk(20, -5, "purple", "sparkles", ["Ranker"], { s: 3.4, cpu: 0.5, tags: [tag("top 20 of 500", "violet", "sparkles")] });
    e.ranker.pills = "below";
    l.fr = L("feed", "ranker", "score");
    l.fp.label = "hydrate posts";
    delete l.fp.labelTone;
    s.flows = [
      { route: ["nl", "lp", "pp"], kind: "write", bounce: true, rate: 0.3 },
      { route: ["pq", "qw", "wg"], kind: "msg", bounce: true, rate: 0.3 },
      { route: ["wc"], kind: "write", rate: 1 },
      { route: ["rl", "lf", "fc"], bounce: true, rate: 1.5 },
      { route: ["fp"], bounce: true, rate: 1 },
      { route: ["fr"], kind: "ping", bounce: true, rate: 1.2 },
    ];
    e.card = card("The 200 ms budget", "timer", ["# one feed request, server side"], {
      chart: "bars",
      w: 260,
      bars: [
        { label: "Read feed list", note: "0–5 ms", from: 0, to: 0.025, tone: "green" },
        { label: "Hydrate posts", note: "5–35 ms", from: 0.025, to: 0.175, tone: "blue" },
        { label: "Rank 500 → 20", note: "35–110 ms", from: 0.175, to: 0.55, tone: "violet", bold: true },
        { label: "Serialize + send", note: "110–150 ms", from: 0.55, to: 0.75, tone: "amber" },
        { label: "Headroom", note: "150–200 ms", from: 0.75, to: 1, tone: "gray" },
      ],
    });
  });

  const s10 = mut(s9, (s, e, l) => {
    delete e.card;
    e.ranker.tags = [];
    delete e.readers;
    e.lia = phone(9, -28, "Lia, back after 3 months");
    delete l.rl;
    l.ll = L("lia", "lb", "GET /v1/feed");
    e.feedCache.tags = [tag("no list for Lia", "amber", "alert")];
    l.fg.style = "solid";
    l.fg.label = "rebuild: who she follows";
    l.fg.labelTone = "amber";
    s.flows = [
      { route: ["ll", "lf", "fc"], bounce: true, rate: 0.8, kind: "empty" },
      { route: ["fg"], bounce: true, rate: 0.9, kind: "slow" },
      { route: ["fp"], bounce: true, rate: 1.4, kind: "heavy" },
      { route: ["fc"], kind: "write", rate: 0.5 },
    ];
    e.card = card("Pages and edge cases", "listOrdered", [
      "next_cursor = (score, post_id) of last item",
      "= session snapshot: page 2 never repeats page 1",
      "! inactive 30+ days → no pushes, rebuild on return",
      "! viral post → hot key: replicate it in the post cache",
      "! deleted post → filtered out at hydrate time",
    ]);
  });

  const s11 = mut(s9, (s, e) => {
    delete e.card;
    e.ranker.tags = [];
  });

  const labFeed = (push, ranker) =>
    lab(
      200000000,
      23000,
      [
        ["users", "users", "Readers"],
        ["lb", "load_balancer", "Load Balancer"],
        ["post", "api_server", "Post service"],
        ["feed", "api_server", "Feed service"],
        ["posts", "cassandra", "Posts DB"],
        ["graph", "mysql", "Follow graph"],
        ...(push ? [["newPosts", "kafka", "New posts"], ["fanout", "worker", "Fan-out workers"], ["feedCache", "redis", "Feed cache"]] : []),
        ...(ranker ? [["ranker", "api_server", "Ranker"]] : []),
      ],
      [
        ["users", "lb"],
        ["lb", "post"],
        ["lb", "feed"],
        ["post", "posts"],
        ["feed", "posts"],
        ...(push ? [["post", "newPosts"], ["newPosts", "fanout"], ["fanout", "graph"], ["fanout", "feedCache"], ["feed", "feedCache"]] : [["feed", "graph"]]),
        ...(ranker ? [["feed", "ranker"]] : []),
      ],
    );

  const M = (feedMs, readWork, fanout, postDelay) => ({ feedMs, readWork, fanout, postDelay });
  write({
    id: "build-a-news-feed",
    title: "Build a News Feed",
    summary: "Design Murmur's home feed interview style: fan-out on read vs on write, the celebrity problem, a hybrid feed cache, ranking and pagination inside a 200 ms budget.",
    minutes: 13,
    level: "advanced",
    metrics: ["feedMs", "readWork", "fanout", "postDelay"],
    legend: ["req", "res", "write", "msg", "heavy", "slow", ["ping", "ranking call"], ["empty", "cache miss"]],
    goals: [
      { text: "Size a feed system from a few assumptions", step: 1 },
      { text: "Compare fan-out on read with fan-out on write", step: 5 },
      { text: "Solve the celebrity problem with a hybrid", step: 7 },
      { text: "Fit ranking and pagination into a 200 ms budget", step: 8 },
      { text: "Handle cold users, hot posts and deletes", step: 9 },
    ],
    steps: [
      {
        short: "Requirements",
        chapter: "setup",
        title: "What a feed has to do",
        body: [
          "The prompt: <i>“Design the home feed for a social app.”</i> <b>Murmur</b> lets people post short updates and scroll a feed of posts from everyone they follow.",
          "Functional: post, follow, read a ranked, infinitely scrolling feed. Non-functional is where it gets interesting: the feed must open in <b>under 200 ms</b>, new posts should reach followers within seconds, and we can accept a little staleness in exchange for speed.",
        ],
        metrics: M(null, "—", null, "—"),
        scene: s1,
      },
      {
        short: "Estimates",
        chapter: "setup",
        title: "The numbers that shape it",
        body: [
          "With <b>200 million</b> daily users opening the feed 10 times a day, that's about <b>23,000 feed reads a second</b>. Half of them post once a day: about 1,200 posts a second.",
          "Reads outnumber writes 20 : 1, but every post has to reach ~200 followers. If we pre-compute feeds, that's ~230,000 small writes a second. Storing the latest 500 post ids per user costs about 4 KB each, roughly <b>800 GB</b> in total: a Redis cluster can hold that.",
        ],
        changes: ["+ Panel: back-of-the-envelope numbers", "~ Arrows labelled with rates"],
        metrics: M(null, "—", null, "—"),
        scene: s2,
      },
      {
        short: "API",
        chapter: "technique",
        title: "Two calls and a cursor",
        body: [
          "Posting is a <code>POST</code> returning the new id. Reading is <code>GET /v1/feed</code>, twenty items at a time.",
          "Paging uses an opaque <span class=\"term\">cursor</span>, not a page number. With offsets, every new post pushes older ones down, so “page 2” would repeat items the user just saw. A cursor says “continue after <i>this</i> item”.",
        ],
        changes: ["+ Panel: post and feed endpoints", "~ Arrows labelled with their endpoints"],
        metrics: M(null, "—", null, "—"),
        scene: s3,
      },
      {
        short: "High level",
        chapter: "solution",
        title: "First sketch: build the feed on read",
        body: [
          "The simplest design: a <b>Post service</b> writes posts, and a <b>Feed service</b> builds each feed when it's opened. It asks the follow graph “who does this reader follow?”, fetches the newest posts from each, merges and sorts.",
          "This is <span class=\"term\">fan-out on read</span>. Posting is cheap and new posts are visible instantly. But one feed open costs about 200 lookups.",
        ],
        changes: ["- Placeholder box", "+ Load balancer, Post and Feed services", "+ Posts DB and Follow graph"],
        metrics: M(350, 200, 1, "instant"),
        scene: s4,
        lab: labFeed(false, false),
      },
      {
        short: "Pull at peak",
        chapter: "problem",
        title: "Deep dive: reads explode",
        body: [
          "At the evening peak, 70,000 feed opens a second × 200 lookups is <b>14 million</b> post reads a second, almost all of them repeating work done seconds earlier for another reader.",
          "The Posts DB runs hot, merging 200 timelines takes time, and feeds take well over a second to open. We spend the expensive work at the worst moment: while a person is waiting.",
        ],
        callout: { kind: "warn", text: "Fan-out on read makes the common operation (reading) pay for the rare one (posting)." },
        changes: ["~ Feed service merges 200 timelines per request", "~ Posts DB overloaded"],
        metrics: M(1400, 200, 1, "instant"),
        scene: s5,
      },
      {
        short: "Push",
        chapter: "solution",
        title: "Fan-out on write",
        body: [
          "Flip it. When Kai posts, the Post service emits a <b>PostCreated</b> event. <b>Fan-out workers</b> look up Kai's followers and prepend the post id to each follower's list in a <b>feed cache</b>.",
          "Opening a feed is now one list read plus fetching 20 posts by id. The expensive work happens in the background, about two seconds after posting, while nobody is waiting.",
        ],
        callout: { kind: "tip", text: "Lists are capped at 500 ids: nobody scrolls further, and the cap keeps memory predictable." },
        changes: ["+ New-posts topic and fan-out workers", "+ Feed cache (Redis lists)", "- Per-request merge of 200 timelines"],
        metrics: M(120, "1 list read", 200, "~2 s"),
        scene: s6,
        lab: labFeed(true, false),
      },
      {
        short: "Celebrities",
        chapter: "problem",
        title: "Deep dive: the celebrity problem",
        body: [
          "Then <b>Nova</b>, a singer with 50 million followers, posts. One post becomes <b>50 million</b> cache writes. At 25,000 writes a second for her share of the fleet, the last fans see it after about half an hour, and everyone else's posts queue behind hers.",
          "Most of those writes are wasted, too: many of her followers won't open the app today.",
        ],
        changes: ["~ Nova posts to 50 M followers", "~ Fan-out backlog grows to 33 min"],
        metrics: M(160, "1 list read", "50,000,000", "~33 min"),
        scene: s7,
      },
      {
        short: "Hybrid",
        chapter: "solution",
        title: "Push for most, pull for a few",
        body: [
          "Use both models. Accounts with more than about <b>100,000 followers</b> skip fan-out. At read time, the Feed service takes the reader's pre-built list and merges in recent posts from the handful of celebrities they follow, which stay hot in cache because millions read them.",
          "Also skip pushing to followers who haven't opened the app in 30 days. Their feed is rebuilt on return.",
        ],
        callout: { kind: "insight", text: "Pick the model per account, not per system: push is cheap for small audiences; pull is cheap for huge ones." },
        changes: ["~ Post service skips fan-out for big accounts", "~ Feed service merges list + celebrity posts"],
        metrics: M(150, "1 + 3 celebs", "≤ 100k", "~2 s"),
        scene: s8,
        lab: labFeed(true, false),
      },
      {
        short: "Ranking",
        chapter: "technique",
        title: "Rank inside the budget",
        body: [
          "Pure newest-first isn't what people want. The feed list gives ~500 <i>candidates</i>; a <b>Ranker</b> scores each on signals like recency, how often you interact with the author, and early engagement, then returns the top 20.",
          "Everything must fit the 200 ms budget, so lay it out explicitly. Ranking gets the biggest slice; hydration is a single multi-get; and some headroom is left for the slow tail.",
        ],
        changes: ["+ Ranker service", "+ Panel: latency budget"],
        metrics: M(150, "1 + 3 celebs", "≤ 100k", "~2 s"),
        scene: s9,
        lab: labFeed(true, true),
      },
      {
        short: "Edge cases",
        chapter: "tradeoff",
        title: "Pages, cold users, hot posts",
        body: [
          "Pagination: the cursor holds the <code>(score, post_id)</code> of the last item, read against a short-lived snapshot of the ranked list, so page 2 never repeats page 1.",
          "<b>Lia</b> returns after three months. No list exists for her, so her first feed is rebuilt the slow way, by pulling from the people she follows, then cached. A viral post becomes a hot key: replicate it across cache nodes. Deleted posts are filtered out when hydrating.",
        ],
        changes: ["+ Lia, an inactive user, returns", "~ Feed rebuilt from the follow graph", "+ Panel: pagination and edge cases"],
        metrics: M(600, "rebuild once", "≤ 100k", "~2 s"),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Murmur's feed",
        body: [
          "<ul class=\"takeaways\"><li><b>Fan-out on read</b>: cheap posts, expensive reads. Fine at small scale.</li><li><b>Fan-out on write</b>: pre-built feeds in a cache; reads become one list fetch.</li><li><b>Celebrities break push</b>: go hybrid, pull big accounts at read time.</li><li>Skip inactive users; rebuild their feed on return.</li><li><b>Rank</b> a few hundred candidates within an explicit latency budget.</li><li><b>Cursor pagination</b> over a snapshot avoids duplicates.</li></ul>",
        ],
        metrics: M(150, "1 + 3 celebs", "≤ 100k", "~2 s"),
        scene: s11,
        lab: labFeed(true, true),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 12.4 build-a-chat-app — Parley (messaging app): interview walkthrough
// ════════════════════════════════════════════════════════════════════════════
{
  const people = () => ({
    alice: phone(-16, -27, "Ines"),
    bob: phone(14, -27, "Tomás"),
  });
  const s1 = {
    entities: {
      ...people(),
      box: ghost(0, -10, "Parley?", 7, 80),
      card: card("Requirements", "listChecks", [
        "**must**: 1:1 and group chats (≤ 500)",
        "**must**: delivered in real time when online",
        "**must**: stored; delivered later when offline",
        "**must**: same order for everyone in a chat",
        "**nice**: sent / delivered / read ticks",
        "**nice**: online & last-seen presence",
        "# never lose a message; never show one twice",
      ]),
    },
    links: {
      ab: L("alice", "box", "send"),
      bb: L("box", "bob", "deliver"),
    },
    flows: [{ route: ["ab", "bb"], kind: "msg", rate: 0.9 }],
  };

  const s2 = mut(s1, (s, e) => {
    e.card = card("Back of the envelope", "sigma", [
      "50 M daily users · **20 M online** at peak",
      "40 messages/user/day → 2 B/day",
      "  → **~23,000 msg/s** (peak ~70,000)",
      "1 open socket per online device → 20 M sockets",
      "~50k sockets per gateway → **~400 gateways**",
      "2 B × ~200 B ≈ 400 GB/day → **~150 TB/year**",
    ]);
  });

  const s3 = mut(s2, (s, e, l) => {
    l.ab.label = "WebSocket frame";
    l.bb.label = "WebSocket frame";
    e.card = card("The protocol", "braces", [
      "→ send { conv_id, client_msg_id, body }",
      "← ack { client_msg_id, seq }",
      "← msg { conv_id, seq, sender, body }",
      "→ receipt { conv_id, seq, delivered | read }",
      "GET /v1/conversations/{id}/messages?after_seq=",
      "# frames over one long-lived socket; REST to catch up",
    ]);
  });

  // High-level design, evolved by every later step.
  const s4 = {
    entities: {
      ...people(),
      gw1: srv(-12, -15, ["WS", "gateway 1"], { cpu: 0.35 }),
      gw2: srv(12, -15, ["WS", "gateway 2"], { cpu: 0.35 }),
      chat: srv(0, -3, ["Chat", "service"], { cpu: 0.4 }),
      registry: cache(14, -3, ["Session", "registry"], { sub: "user → gateway" }),
      store: store(0, 12, "Messages"),
    },
    links: {
      a1: L("alice", "gw1", "WebSocket", { heads: "both" }),
      g1c: L("gw1", "chat"),
      c2g: L("chat", "gw2", "deliver"),
      g2b: L("gw2", "bob", "WebSocket", { heads: "both" }),
      g2r: L("gw2", "registry", "Tomás → gw-2", { style: "dashed" }),
      cr: L("chat", "registry", "where's Tomás?"),
      cs: L("chat", "store", "append"),
    },
    flows: [
      { route: ["a1", "g1c", "c2g", "g2b"], kind: "msg", rate: 0.9 },
      { route: ["cs"], kind: "write", rate: 0.9 },
      { route: ["cr"], kind: "ping", bounce: true, rate: 0.9 },
      { route: ["g2r"], kind: "ping", rate: 0.2 },
    ],
  };

  const s5 = mut(s4, (s, e) => {
    e.store.tags = [tag("conv 9f2: 41 · 42 · 43", "green", "listOrdered")];
    e.card = card("Messages table", "database", [
      "partition key: **conv_id**",
      "sort key: **seq** ↑ · sender, client_msg_id, body",
      "seq: per-chat counter, assigned on write",
      "= every member sees the same order",
      "# not timestamps: device and server clocks drift",
      "# read: WHERE conv_id = ? AND seq > last_seen",
    ]);
    s.flows = [
      { route: ["a1", "g1c", "c2g", "g2b"], kind: "msg", rate: 1.4 },
      { route: ["cs"], kind: "write", rate: 1.4 },
      { route: ["cr"], kind: "ping", bounce: true, rate: 0.6 },
    ];
  });

  const s6 = mut(s4, (s, e, l) => {
    e.alice.tags = [tag("no ack → send again", "amber", "refresh")];
    e.store.tags = [tag("“On my way” ×2", "red", "alert")];
    e.store.heat = 0.5;
    l.a1.label = "train tunnel";
    l.a1.labelTone = "amber";
    l.a1.fail = 0.3;
    s.flows = [
      { route: ["a1", "g1c", "cs"], bounce: true, rate: 1.2, pattern: ["write", "poison"] },
      { route: ["c2g", "g2b"], rate: 1.2, pattern: ["msg", "poison"] },
    ];
  });

  const s7 = mut(s4, (s, e) => {
    e.alice.tags = [tag("outbox: retry until ack", "green", "refresh")];
    e.store.tags = [tag("retry deduped · 1 row", "green", "fingerprint")];
    s.flows = [
      { route: ["a1", "g1c", "cs"], kind: "write", bounce: true, rate: 1 },
      { route: ["c2g", "g2b"], kind: "msg", rate: 0.9 },
      { route: ["cr"], kind: "ping", bounce: true, rate: 0.5 },
    ];
  });

  const pushParts = (e, l) => {
    e.push = worker(14, 9, ["Push", "service"]);
    e.apns = blk(27, -3, "slab", "bell", ["APNs /", "FCM"], { s: 3.4 });
    l.cp = L("chat", "push", "offline → notify");
    l.pa = L("push", "apns");
    l.ab = L("apns", "bob", "notification", { style: "dashed" });
  };
  const s8 = mut(s4, (s, e, l) => {
    pushParts(e, l);
    e.bob.opacity = 0.55;
    e.bob.tags = [tag("offline", "gray", "wifi")];
    e.registry.tags = [tag("Tomás: no session", "amber", "alert")];
    e.registry.pills = "above";
    l.g2b.style = "cut";
    delete l.g2b.label;
    delete l.g2r;
    l.c2g.style = "off";
    s.flows = [
      { route: ["a1", "g1c", "cs"], kind: "write", bounce: true, rate: 0.9 },
      { route: ["cr"], kind: "empty", bounce: true, rate: 0.9 },
      { route: ["cp", "pa", "ab"], kind: "push", rate: 0.6 },
    ];
    e.card = card("Back online: sync", "refresh", [
      "Tomás opens the app → socket to any gateway",
      "GET …/messages?after_seq=41",
      "= gets 42–57 in order, then live frames",
      "# the push holds a preview only",
      "# the message store is the source of truth",
    ]);
  });

  const s9 = mut(s4, (s, e, l) => {
    pushParts(e, l);
    l.ab.style = "off";
    e.alice.tags = [tag("✓✓ read", "violet", "check")];
    e.registry.tags = [tag("Tomás online · TTL 30 s", "green", "clock")];
    e.registry.pills = "above";
    s.flows = [
      { route: ["a1", "g1c", "c2g", "g2b"], kind: "msg", bounce: true, hold: 0.5, rate: 0.8 },
      { route: ["cs"], kind: "write", rate: 0.8 },
      { route: ["g2r"], kind: "ping", rate: 0.7 },
    ];
    e.card = card("Receipts & presence", "check", [
      "✓ sent: stored, seq assigned (the ack)",
      "✓✓ delivered: Tomás's device acked the frame",
      "read: app reports last_read_seq",
      "= receipts are tiny messages on the same path",
      "presence: heartbeat every 20 s, key TTL 30 s",
      "# push presence only to chats on screen",
    ]);
  });

  const s10 = mut(s9, (s, e, l) => {
    delete e.bob;
    e.group = crowd(19, -28, 14, "Hiking club · 300");
    e.gw3 = srv(26, -15, ["WS", "gateway 3"], { cpu: 0.35 });
    l.g2b = L("gw2", "group", "", { heads: "both" });
    l.g3b = L("gw3", "group", "", { heads: "both" });
    l.c3g = L("chat", "gw3", "batch");
    l.c2g.label = "batch";
    l.ab = L("apns", "group", "", { style: "dashed" });
    delete l.g2r;
    e.alice.tags = [];
    e.registry.tags = [tag("300 members: 1 call", "violet", "search")];
    s.flows = [
      { route: ["a1", "g1c", "cs"], kind: "write", rate: 0.8 },
      { routes: [{ path: ["c2g", "g2b"] }, { path: ["c3g", "g3b"] }, { path: ["cp", "pa", "ab"], kind: "push" }], kind: "msg", fanout: true, rate: 0.8 },
      { route: ["cr"], kind: "ping", bounce: true, rate: 0.8 },
    ];
    e.card = card("Where it bends", "gauge", [
      "! groups: store once, send 1 batch per gateway",
      "! 100k-member channels: members pull instead",
      "! gateway dies → 50k reconnect: jittered backoff",
      "! one very busy chat → one hot partition",
      "! presence storms → only for contacts on screen",
    ]);
  });

  const s11 = mut(s9, (s, e) => {
    delete e.card;
    e.alice.tags = [];
  });

  const labChat = (push) =>
    lab(
      20000000,
      23000,
      [
        ["users", "users", "Phones"],
        ["gw1", "api_server", "WS gateway 1"],
        ["gw2", "api_server", "WS gateway 2"],
        ["chat", "api_server", "Chat service"],
        ["registry", "redis", "Session registry"],
        ["store", "cassandra", "Messages"],
        ...(push ? [["push", "worker", "Push service"]] : []),
      ],
      [
        ["users", "gw1"],
        ["users", "gw2"],
        ["gw1", "chat"],
        ["gw2", "chat"],
        ["chat", "registry"],
        ["chat", "store"],
        ...(push ? [["chat", "push"]] : []),
      ],
    );

  const M = (deliverMs, conns, canLoseMsg, ordered) => ({ deliverMs, conns, canLoseMsg, ordered });
  write({
    id: "build-a-chat-app",
    title: "Build a Chat App",
    summary: "Design Parley's messaging interview style: WebSocket gateways, ordered storage per conversation, at-least-once delivery with dedupe, offline push, receipts, presence and groups.",
    minutes: 14,
    level: "advanced",
    metrics: ["deliverMs", "conns", "canLoseMsg", "ordered"],
    legend: ["msg", "write", ["ping", "lookup / heartbeat"], "push", ["empty", "no session"], ["poison", "duplicate"], "fail"],
    goals: [
      { text: "Size connections, message rate and storage", step: 1 },
      { text: "Route messages between WebSocket gateways", step: 3 },
      { text: "Keep one order per conversation with sequence numbers", step: 4 },
      { text: "Deliver at least once, then dedupe", step: 6 },
      { text: "Handle offline users, receipts, presence and groups", step: 9 },
    ],
    steps: [
      {
        short: "Requirements",
        chapter: "setup",
        title: "What a chat app must guarantee",
        body: [
          "The prompt: <i>“Design a chat app.”</i> <b>Parley</b> needs 1:1 and group chats, messages that arrive in real time when you're online and wait for you when you're not, and one agreed order in every conversation.",
          "Two guarantees carry most of the design: a message is <b>never lost</b>, and it's <b>never shown twice</b>. Ticks and presence are nice-to-haves, but they shape the protocol, so note them now.",
        ],
        metrics: M(null, "—", null, null),
        scene: s1,
      },
      {
        short: "Estimates",
        chapter: "setup",
        title: "Sockets, not requests",
        body: [
          "With <b>50 million</b> daily users sending 40 messages each, that's about 23,000 messages a second, peaking near 70,000. Each message is about 200 bytes, so roughly 150 TB a year of history.",
          "The unusual number is connections: <b>20 million phones</b> online at once, each holding a socket open. At ~50,000 sockets per server that's ~400 gateway machines, before we've processed a single message.",
        ],
        changes: ["+ Panel: back-of-the-envelope numbers"],
        metrics: M(null, "20 M", null, null),
        scene: s2,
      },
      {
        short: "Protocol",
        chapter: "technique",
        title: "A small protocol over WebSockets",
        body: [
          "Polling every few seconds would waste battery and still feel slow. Instead, each device opens one <span class=\"term\">WebSocket</span> and keeps it open; the server can push to it any time.",
          "The client tags each message with its own <code>client_msg_id</code>. The server replies with an <b>ack</b> carrying the message's <code>seq</code>. A plain REST call fetches everything after a given <code>seq</code> for catching up.",
        ],
        changes: ["+ Panel: frames and catch-up endpoint", "~ Arrows labelled as WebSocket frames"],
        metrics: M(null, "20 M", null, null),
        scene: s3,
      },
      {
        short: "High level",
        chapter: "solution",
        title: "Gateways and a registry",
        body: [
          "<b>Gateways</b> only hold sockets: thousands of mostly idle connections each. Behind them, a stateless <b>Chat service</b> does the work: store the message, then deliver it.",
          "But Ines is on gateway 1 and Tomás on gateway 2. To deliver, the Chat service asks a <b>session registry</b> (a Redis map of user → gateway, written when a device connects) and forwards the frame to gateway 2, which pushes it down Tomás's socket.",
        ],
        changes: ["- Placeholder box", "+ Two WebSocket gateways", "+ Chat service, session registry, message store"],
        metrics: M(120, "20 M", "yes", "no"),
        scene: s4,
        lab: labChat(false),
      },
      {
        short: "Ordering",
        chapter: "technique",
        title: "Deep dive: one order per chat",
        body: [
          "Ines sends “Running late” then “Start without me”. Ordering by timestamp fails: two servers' clocks can disagree by milliseconds, so the messages may swap. In a group, two members can send at the same instant.",
          "Instead, all writes for one conversation go to one Chat service owner (by hash of <code>conv_id</code>), which assigns the next <span class=\"term\">sequence number</span>. Messages are stored partitioned by conversation and sorted by <code>seq</code>, so history is one fast range read.",
        ],
        callout: { kind: "insight", text: "You only need order <em>within</em> a conversation. A global order across all chats would be expensive and nobody would notice it." },
        changes: ["~ Chat service assigns per-conversation seq", "+ Panel: messages table keyed by (conv_id, seq)"],
        metrics: M(130, "20 M", "yes", "yes"),
        scene: s5,
      },
      {
        short: "Lost acks",
        chapter: "problem",
        title: "The ack that never arrived",
        body: [
          "Ines's train enters a tunnel. Her message reaches the server and is stored, but the <b>ack</b> is lost on the way back. From her phone's point of view, the message may not have arrived.",
          "If the app gives up, a message might be lost. If it simply sends again, Tomás sees “On my way” <b>twice</b>. Networks can't tell you which of the two happened.",
        ],
        changes: ["~ Ines's link drops packets", "~ Retries create a duplicate row"],
        metrics: M(130, "20 M", "yes", "yes"),
        scene: s6,
      },
      {
        short: "Dedupe",
        chapter: "solution",
        title: "At least once, then dedupe",
        body: [
          "The phone keeps unsent messages in a local <b>outbox</b> and retries until it gets an ack: <span class=\"term\">at-least-once</span> delivery. The server stores the message <em>before</em> acking, so an ack always means “safe”.",
          "Duplicates are removed by <span class=\"term\">idempotency</span>: the Chat service remembers each <code>client_msg_id</code> per conversation. A retry of a known id gets the original <code>seq</code> back instead of a new row. Clients dedupe incoming frames by <code>seq</code> too.",
        ],
        callout: { kind: "tip", text: "Exactly-once delivery over a network isn't possible; exactly-once <em>effect</em> is: at-least-once + dedupe." },
        changes: ["+ Outbox on the phone", "+ Dedupe by client_msg_id", "~ Store keeps one row per message"],
        metrics: M(140, "20 M", "no", "yes"),
        scene: s7,
        lab: labChat(false),
      },
      {
        short: "Offline",
        chapter: "technique",
        title: "When Tomás is offline",
        body: [
          "Tomás's phone is in his pocket with the app closed. The registry has no session for him, so the Chat service hands the message to a <b>Push service</b>, which notifies the phone through Apple's or Google's push network.",
          "The message is already safe in the store. When Tomás opens the app, it reconnects and asks for everything after the last <code>seq</code> it saw, then switches to live frames. The push only carries a preview.",
        ],
        changes: ["+ Push service and APNs / FCM", "~ Tomás offline, socket gone", "+ Panel: reconnect and sync"],
        metrics: M(1800, "20 M", "no", "yes"),
        scene: s8,
        lab: labChat(true),
      },
      {
        short: "Receipts",
        chapter: "technique",
        title: "Ticks and presence",
        body: [
          "Receipts reuse the same pipeline as messages. One tick: the server acked (stored). Two ticks: Tomás's device acked the frame. Read: his app reports the highest <code>seq</code> on screen, and one number covers every earlier message.",
          "<b>Presence</b> is a key in the registry that each heartbeat renews, expiring after 30 seconds of silence. Telling every contact about every change would dwarf the message traffic, so it's only sent to people who have that chat open.",
        ],
        changes: ["~ Tomás back online", "~ Delivery round trip returns as a receipt", "+ Panel: receipts and presence"],
        metrics: M(140, "20 M", "no", "yes"),
        scene: s9,
        lab: labChat(true),
      },
      {
        short: "Groups",
        chapter: "tradeoff",
        title: "Groups, and where it bends",
        body: [
          "Ines posts in a <b>300-member</b> group. The message is stored <em>once</em>; the Chat service looks up all members in one batched registry call, then sends <b>one batch per gateway</b>, not 300 separate frames. Offline members get a push.",
          "Then stress-test: very large channels should let members pull instead; a gateway crash means 50,000 phones reconnect at once, so clients back off with random jitter; one very busy chat becomes a hot partition.",
        ],
        changes: ["+ Group of 300 across gateways 2 and 3", "~ Chat service fans out per gateway", "+ Panel: bottlenecks"],
        metrics: M(180, "20 M", "no", "yes"),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Parley, end to end",
        body: [
          "<ul class=\"takeaways\"><li><b>Gateways</b> hold sockets; a <b>registry</b> maps users to gateways.</li><li><b>Per-conversation seq</b> gives one order; store by (conv_id, seq).</li><li><b>Store, then ack</b>; clients retry from an outbox; dedupe by client_msg_id.</li><li><b>Offline</b>: push a preview, sync from the last seq on reconnect.</li><li><b>Receipts</b> are tiny messages; presence is a heartbeat with a TTL.</li><li><b>Groups</b>: write once, fan out per gateway; big channels pull.</li></ul>",
        ],
        metrics: M(140, "20 M", "no", "yes"),
        scene: s11,
        lab: labChat(true),
      },
    ],
  });
}
