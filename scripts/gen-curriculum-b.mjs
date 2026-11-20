// Generates Module 06 "Data & Storage" lessons 1–6 (original content).
// Usage: node scripts/gen-curriculum-b.mjs [lessonsDir]. Overwrites only these lesson JSONs:
// tables-or-documents, finding-the-needle, under-the-hood-of-a-write, copies-everywhere, split-the-pile, the-ring.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? new URL("../src/content/lessons/", import.meta.url).pathname;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── entity presets & helpers ────────────────────────────────────────────────
const OK = { heat: 0, cpu: 0.3 };
const WARN = { heat: 0.35, cpu: 0.78 };
const CRIT = { heat: 1, cpu: 0.96 };
const DOWN = { dead: 1, heat: 0, cpu: -1, tags: [{ text: "DOWN", tone: "red", icon: "alert" }] };
const tag = (text, tone, icon) => ({ text, ...(tone ? { tone } : {}), ...(icon ? { icon } : {}) });
const crowd = (label, count = 10, y0 = -24, extra = {}) => ({ type: "crowd", x0: -4, x1: 4, y0, y1: y0 + 6, count, label, ...extra });
const block = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 4, color: "blue", glyph: "server", label, ...extra });
const api = (x, y, label, extra = {}) => block(x, y, label, { ...OK, ...extra });
const small = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 3.6, h: 26, color: "slab", glyph: "sheets", label, ...extra });
const db = (x, y, label, tags, extra = {}) => ({
  type: "db",
  x,
  y,
  label,
  ...(tags ? { tags: tags.map((t) => (typeof t === "string" ? { text: t } : t)) } : {}),
  ...extra,
});
const panel = (title, icon, lines, extra = {}) => ({ type: "panel", title, icon, lines, ...extra });
const bars = (title, icon, lines, rows) => panel(title, icon, lines, { chart: "bars", bars: rows });
const L = (from, to, label, extra = {}) => ({ from, to, pts: [from, to], ...(label ? { label } : {}), ...extra });
const lab = (users, rps, nodes, edges) => ({
  users,
  rps,
  nodes: nodes.map(([id, kind, label, sub, status]) => ({ id, kind, label, ...(sub ? { sub } : {}), ...(status ? { status } : {}) })),
  edges: edges.map(([from, to]) => ({ from, to })),
});

function write(lesson) {
  if (lesson.steps.length < 8 || lesson.steps.length > 11) throw new Error(`${lesson.id}: ${lesson.steps.length} steps`);
  for (const s of lesson.steps) {
    for (const k of lesson.metrics) if (!(k in s.metrics)) throw new Error(`${lesson.id}/${s.short}: missing ${k}`);
    if (s.short.length > 14) throw new Error(`${lesson.id}/${s.short}: short too long`);
  }
  writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
}

// ════════════════════════════════════════════════════════════════════════════
// 1. tables-or-documents — Larder (meal-kit app) picks its data stores
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 120000;
  const head = () => ({
    users: crowd("Larder shoppers", 10),
    api: api(0, -9, ["Larder", "API"]),
  });
  const pg = (x = 0, extra = {}) => db(x, 6, "Postgres", [tag("relational", "paper", "sheets")], { cpu: 0.3, ...extra });
  const table = (x, y, label, extra = {}) => small(x, y, label, extra);
  const shopTables = () => ({
    tCust: table(-15, 17, ["customers"]),
    tOrd: table(-5, 17, ["orders"]),
    tItem: table(5, 17, ["order", "items"]),
    tInv: table(15, 17, ["inventory"]),
  });
  const shopLinks = () => ({
    e1: L("users", "api", "GET /orders"),
    e2: L("api", "pg", "SQL"),
    d1: L("pg", "tCust", null, { style: "dashed", heads: "none" }),
    d2: L("pg", "tOrd", null, { style: "dashed", heads: "none" }),
    d3: L("pg", "tItem", null, { style: "dashed", heads: "none" }),
    d4: L("pg", "tInv", null, { style: "dashed", heads: "none" }),
    k1: L("tCust", "tOrd", "customer_id", { heads: "none", style: "dashed" }),
    k2: L("tOrd", "tItem", "order_id", { heads: "none", style: "dashed" }),
    k3: L("tItem", "tInv", "sku", { heads: "none", style: "dashed" }),
  });
  const REL = { joins: "yes", tx: "yes", schema: "fixed", scaleOut: "hard" };
  const labRel = (st) =>
    lab(U, 900, [["users", "users", "Shoppers"], ["api", "api_server", "Larder API"], ["pg", "postgres", "Postgres", "customers · orders · items", st]], [["users", "api"], ["api", "pg"]]);

  // 1 — the question
  const s1 = {
    entities: { ...head(), q: { type: "ghost", x: 0, y: 6, s: 5, h: 70, label: "which store?" } },
    links: { e1: L("users", "api", "GET /orders") },
    flows: [{ route: ["e1"], bounce: true, rate: 1.4 }],
  };

  // 2 — tables
  const s2 = { entities: { ...head(), pg: pg(), ...shopTables() }, links: shopLinks(), flows: [{ route: ["e1", "e2"], bounce: true, rate: 1.6 }] };

  // 3 — joins
  const s3 = clone(s2);
  s3.flows = [
    { route: ["e1", "e2"], bounce: true, rate: 1.2, hold: 0.5 },
    { routes: [{ path: ["d1"] }, { path: ["d2"] }, { path: ["d3"] }], fanout: true, bounce: true, rate: 0.9, kind: "ping" },
  ];
  s3.entities.card = panel("One query, three tables", "network", [
    "SELECT c.name, o.placed_at, i.sku",
    "FROM orders o",
    "JOIN customers c ON c.id = o.customer_id",
    "JOIN order_items i ON i.order_id = o.id",
    "= one round trip, one consistent answer",
  ]);

  // 4 — transactions
  const s4 = clone(s2);
  s4.links.e1.label = "POST /checkout";
  s4.links.e2.label = "BEGIN … COMMIT";
  s4.entities.pg.tags = [tag("relational", "paper", "sheets"), tag("ACID", "green", "lock")];
  s4.entities.tOrd.tags = [tag("+1 row", "green")];
  s4.entities.tItem.tags = [tag("+3 rows", "green")];
  s4.entities.tInv.tags = [tag("stock −3", "amber")];
  s4.flows = [
    { route: ["e1", "e2"], kind: "write", rate: 1.1 },
    { routes: [{ path: ["d2"] }, { path: ["d3"] }, { path: ["d4"] }], fanout: true, kind: "write", rate: 0.8 },
  ];
  s4.entities.card = panel("Checkout = one transaction", "lock", [
    "BEGIN",
    "UPDATE inventory SET stock = stock − 1 …",
    "INSERT INTO orders …",
    "INSERT INTO order_items … (×3)",
    "COMMIT",
    "= all four changes land, or none do",
  ]);

  // 5 — recipes don't fit
  const recipeTables = {
    r1: table(-10, 16, ["recipes"]),
    r2: table(0, 16, ["steps"]),
    r3: table(10, 16, ["ingredients"]),
    r4: table(-10, 25, ["nutrition"]),
    r5: table(0, 25, ["tags"]),
    r6: table(10, 25, ["photos"]),
  };
  const s5 = {
    entities: { ...head(), pg: pg(0, { ...WARN }), ...recipeTables },
    links: {
      e1: L("users", "api", "GET /recipe/812"),
      e2: L("api", "pg", "6-way JOIN"),
      ...Object.fromEntries(["r1", "r2", "r3", "r4", "r5", "r6"].map((r, i) => [`q${i + 1}`, L("pg", r, null, { style: "dashed", heads: "none" })])),
    },
    flows: [
      { route: ["e1", "e2"], kind: "slow", bounce: true, rate: 1, hold: 0.8 },
      { routes: ["q1", "q2", "q3", "q4", "q5", "q6"].map((q) => ({ path: [q] })), fanout: true, bounce: true, rate: 0.7, kind: "ping" },
    ],
  };
  s5.entities.card = bars("Showing one recipe", "sheets", ["# a recipe is one nested thing, stored as six tables"], [
    { label: "Tables touched", note: "6", to: 1, tone: "red", bold: true },
    { label: "Rows stitched", note: "~60", to: 0.8, tone: "amber" },
    { label: "Migrations / month", note: "4", to: 0.55, tone: "amber" },
  ]);

  // 6+ — polyglot row along the screen horizontal: pg, doc, kv, wide
  const docDb = () => db(-7.5, -1.5, "Documents", [tag("JSON docs", "paper", "braces")], { glyph: "braces" });
  const kvDb = () => db(0.5, 6.5, "Key-value", [tag("get / put by key", "paper", "key")], { glyph: "key" });
  const wideDb = () => db(8.5, 14.5, "Wide-column", [tag("partition key", "paper", "layers")], { glyph: "layers" });
  const docEx = () => ({ type: "block", x: -14.5, y: 5.5, s: 4, h: 30, color: "yellow", glyph: "braces", label: ["recipe", "#812"], sub: "nested JSON" });
  const s6 = {
    entities: { ...head(), pg: pg(-15.5, { y: -9.5, cpu: -1 }), doc: docDb(), docEx: docEx() },
    links: {
      e1: L("users", "api", "GET /recipe/812"),
      e2: L("api", "pg", "orders"),
      e3: L("api", "doc", "find by id"),
      x1: L("doc", "docEx", null, { style: "dashed", heads: "none" }),
    },
    flows: [
      { route: ["e1", "e3", "x1"], bounce: true, rate: 1.6 },
      { route: ["e2"], bounce: true, rate: 0.5 },
    ],
  };
  s6.entities.card = panel("One recipe = one document", "braces", [
    "{ id: 812, title: \"Miso salmon\",",
    "  steps: [ … ], ingredients: [ … ],",
    "  tags: [\"quick\", \"fish\"], photos: [ … ] }",
    "= one read, no joins",
    "# a new field is just a new key — no migration",
  ]);

  const s7 = clone(s6);
  delete s7.entities.card;
  s7.entities.kv = kvDb();
  s7.entities.session = { type: "block", x: -6.5, y: 13.5, s: 4, h: 30, color: "orange", glyph: "key", label: ["sess:9f3a"], sub: "→ cart blob" };
  s7.links.e4 = L("api", "kv", "GET sess:9f3a");
  s7.links.x2 = L("kv", "session", null, { style: "dashed", heads: "none" });
  s7.flows = [
    { route: ["e1", "e4", "x2"], bounce: true, rate: 2.6, speed: 1.3 },
    { route: ["e3"], bounce: true, rate: 0.6 },
    { route: ["e2"], bounce: true, rate: 0.4 },
  ];
  s7.entities.card = panel("Key-value: a giant hash map", "key", [
    "put(\"sess:9f3a\", cart)   get(\"sess:9f3a\")",
    "= ~1 ms, scales by adding nodes",
    "! no “find sessions where cart > $50”",
    "# the store can't look inside the value",
  ]);

  const s8 = clone(s7);
  delete s8.entities.card;
  s8.entities.wide = wideDb();
  s8.entities.vans = { type: "block", x: 16.5, y: 6.5, s: 3.8, h: 30, color: "green", glyph: "car", label: ["Delivery", "vans"], sub: "GPS ping / 10 s" };
  s8.links.e5 = L("vans", "wide", "append event");
  s8.flows = [
    { route: ["e5"], kind: "write", rate: 3, speed: 1.2 },
    { route: ["e1", "e3"], bounce: true, rate: 0.8 },
    { route: ["e4"], bounce: true, rate: 0.8 },
  ];
  s8.entities.card = panel("Wide-column: rows grouped by key", "layers", [
    "partition: order_id  →  all events of one delivery",
    "clustering: event_time  →  kept sorted on disk",
    "= huge write volume, spread over many nodes",
    "! design tables around the queries you'll run",
  ]);

  const s9 = clone(s8);
  delete s9.entities.card;
  delete s9.entities.docEx;
  delete s9.entities.session;
  delete s9.links.x1;
  delete s9.links.x2;
  s9.entities.pg.tags = [tag("orders · payments", "green", "lock")];
  s9.entities.doc.tags = [tag("recipes", "green", "braces")];
  s9.entities.kv.tags = [tag("sessions · carts", "green", "key")];
  s9.entities.wide.tags = [tag("van tracking", "green", "layers")];
  s9.links.e2.label = "checkout";
  s9.flows = [
    { routes: [{ path: ["e1", "e2"], weight: 1 }, { path: ["e1", "e3"], weight: 2 }, { path: ["e1", "e4"], weight: 3 }], pick: "weights", bounce: true, rate: 2.4 },
    { route: ["e5"], kind: "write", rate: 2 },
  ];

  const s10 = clone(s9);
  s10.entities.card = panel("Choose by access pattern", "listChecks", [
    "money, relations, invariants → **relational**",
    "self-contained nested records → **document**",
    "lookups by one key, huge rate → **key-value**",
    "append-heavy, query by partition → **wide-column**",
    "= default to relational; add others for a reason",
  ]);

  const labPoly = lab(
    U,
    2400,
    [
      ["users", "users", "Shoppers"],
      ["api", "api_server", "Larder API"],
      ["pg", "postgres", "Postgres", "orders · payments"],
      ["doc", "mongodb", "Document store", "recipes"],
      ["kv", "dynamodb", "Key-value store", "sessions"],
      ["wide", "cassandra", "Wide-column", "van tracking"],
    ],
    [["users", "api"], ["api", "pg"], ["api", "doc"], ["api", "kv"], ["api", "wide"]],
  );

  write({
    id: "tables-or-documents",
    title: "Tables or Documents",
    summary: "Larder, a meal-kit app, has orders, recipes, sessions and van GPS pings. One database shape doesn't fit them all — learn the four families and what each trades away.",
    minutes: 11,
    level: "beginner",
    metrics: ["joins", "tx", "schema", "scaleOut"],
    legend: ["req", "res", "write", "slow", ["ping", "row lookup"]],
    goals: [
      { text: "Model data as tables linked by keys, and query it with joins", step: 1 },
      { text: "See why multi-table transactions matter for money", step: 3 },
      { text: "Recognise when a document fits better than six tables", step: 5 },
      { text: "Know what key-value and wide-column stores are for", step: 6 },
      { text: "Pick a store per access pattern, not per fashion", step: 8 },
    ],
    steps: [
      {
        short: "The data",
        chapter: "setup",
        title: "Where should Larder's data live?",
        body: [
          "<b>Larder</b> ships meal kits. Its API juggles four very different kinds of data: <b>orders</b> (money!), <b>recipes</b> (rich, nested content), <b>sessions</b> (tiny, hot, short-lived) and <b>GPS pings</b> from delivery vans (endless append-only stream).",
          "Before picking a database, ask what shape the data has and how it will be read and written. Databases differ mostly in what they make <em>easy</em> — and what they make you do yourself.",
        ],
        metrics: { joins: "?", tx: "?", schema: "?", scaleOut: "?" },
        scene: s1,
      },
      {
        short: "Tables",
        chapter: "technique",
        title: "Relational: rows, columns and keys",
        body: [
          "A <span class=\"term\">relational database</span> stores data in tables with a fixed set of typed columns. Each row has a <span class=\"term\">primary key</span>; rows point at other rows through <span class=\"term\">foreign keys</span> — an order row stores <code>customer_id</code>, an order item stores <code>order_id</code>.",
          "Each fact lives in exactly one place (<em>normalised</em>): change a customer's email once and every order sees it. The database enforces the schema, so bad data is rejected at the door.",
        ],
        changes: ["+ Postgres with customers, orders, order_items, inventory", "+ Foreign keys link the tables"],
        metrics: REL,
        scene: s2,
        lab: labRel(),
      },
      {
        short: "Joins",
        chapter: "technique",
        title: "Joins reassemble the picture",
        body: [
          "Because facts are split across tables, reads put them back together with a <span class=\"term\">join</span>: one SQL statement matches orders to their customer and items using the keys.",
          "You can ask questions nobody planned for — “revenue per city last week” — without changing how data is stored. That flexibility at <em>query</em> time is the relational model's superpower.",
        ],
        metrics: REL,
        scene: s3,
        lab: labRel(),
      },
      {
        short: "Transactions",
        chapter: "technique",
        title: "All-or-nothing checkout",
        body: [
          "Checkout touches three tables: decrement stock, insert the order, insert its items. A <span class=\"term\">transaction</span> wraps them so they commit together or not at all — a crash halfway can't leave stock taken with no order.",
          "This is <b>ACID</b>: Atomic, Consistent (constraints hold), Isolated (concurrent checkouts don't see each other's half-done work), Durable (committed means on disk).",
        ],
        callout: { kind: "tip", text: "For money, inventory and anything with invariants, multi-row transactions are worth a lot. Rebuilding them in application code is hard and error-prone." },
        changes: ["~ Checkout writes 4 rows in one transaction"],
        metrics: REL,
        scene: s4,
        lab: labRel(),
      },
      {
        short: "Shape clash",
        chapter: "problem",
        title: "Recipes don't want to be tables",
        body: [
          "A recipe is one nested thing: a title, an ordered list of steps, ingredients with quantities, nutrition, tags, photos. Normalised, it becomes <b>six tables</b> — and every recipe page is a six-way join stitching ~60 rows back together.",
          "Worse, the content team adds fields every week (“allergens”, “wine pairing”). Each one is a schema migration on a growing table. The data's shape fights the model.",
        ],
        changes: ["- Shop tables (off screen)", "+ Six tables for one recipe", "~ Postgres busier stitching rows"],
        metrics: { joins: "yes", tx: "yes", schema: "rigid", scaleOut: "hard" },
        scene: s5,
        lab: labRel("warn"),
      },
      {
        short: "Documents",
        chapter: "solution",
        title: "Document store: keep it together",
        body: [
          "A <span class=\"term\">document database</span> stores each recipe as one JSON-like document, nested lists and all. Reading a recipe is a single lookup by id — the data is already in the shape the page needs.",
          "The schema is flexible: a new field is just a new key in new documents. Because each document is self-contained, the store can spread documents across many machines more easily.",
          "The cost: joins across documents are limited, and atomic updates are usually per document. That's fine for recipes — and exactly why orders stay in Postgres.",
        ],
        callout: { kind: "warn", text: "“Schemaless” means the schema lives in your code instead. Old documents keep old shapes — readers must handle both." },
        changes: ["+ Document store holding recipe documents", "~ Postgres keeps orders only"],
        metrics: { joins: "limited", tx: "per doc", schema: "flexible", scaleOut: "medium" },
        scene: s6,
        lab: lab(U, 1500, [["users", "users", "Shoppers"], ["api", "api_server", "Larder API"], ["pg", "postgres", "Postgres", "orders"], ["doc", "mongodb", "Document store", "recipes"]], [["users", "api"], ["api", "pg"], ["api", "doc"]]),
      },
      {
        short: "Key-value",
        chapter: "technique",
        title: "Key-value: fastest when you know the key",
        body: [
          "Sessions and carts are read on <em>every</em> request, always by their id. A <span class=\"term\">key-value store</span> is a distributed hash map: <code>put(key, value)</code>, <code>get(key)</code>, done. Lookups take about a millisecond and capacity grows by adding nodes.",
          "The value is opaque to the store. You can't ask “which carts contain salmon?” — if you need that question, you need a different store (or a second copy of the data).",
        ],
        changes: ["+ Key-value store for sessions & carts"],
        metrics: { joins: "no", tx: "per key", schema: "none", scaleOut: "easy" },
        scene: s7,
      },
      {
        short: "Wide-column",
        chapter: "technique",
        title: "Wide-column: built for floods of writes",
        body: [
          "Each van reports its position every 10 seconds — millions of small writes a day that are only ever read as “the trail of delivery X”. A <span class=\"term\">wide-column store</span> groups rows by a <b>partition key</b> (<code>order_id</code>) and keeps them sorted by a <b>clustering key</b> (<code>event_time</code>).",
          "Writes spread evenly over many nodes and are cheap appends. The price: you design each table around one query up front, and joins and cross-partition transactions are essentially off the table.",
        ],
        changes: ["+ Wide-column store fed by delivery vans"],
        metrics: { joins: "no", tx: "limited", schema: "per query", scaleOut: "easy" },
        scene: s8,
      },
      {
        short: "Trade-offs",
        chapter: "tradeoff",
        title: "Every store gives something up",
        body: [
          "<table class=\"compare\"><tbody><tr><th></th><th>Relational</th><th>Document</th><th>Key-value</th><th>Wide-column</th></tr><tr><td>Joins</td><td>yes</td><td>limited</td><td>no</td><td>no</td></tr><tr><td>Transactions</td><td>multi-row</td><td>per document</td><td>per key</td><td>per partition</td></tr><tr><td>Schema</td><td>enforced</td><td>flexible</td><td>none</td><td>per table</td></tr><tr><td>Scale writes out</td><td>hard</td><td>medium</td><td>easy</td><td>easy</td></tr></tbody></table>",
          "Larder now runs four stores — and pays for it: four things to operate, back up and monitor, plus data that must be kept in sync between them.",
        ],
        callout: { kind: "warn", text: "Polyglot persistence multiplies operational work. Each extra store must earn its place with a real access pattern." },
        changes: ["~ Each store owns one kind of data"],
        metrics: { joins: "where needed", tx: "where needed", schema: "per store", scaleOut: "per store" },
        scene: s9,
        lab: labPoly,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Shape and access pattern decide",
        body: [
          "<ul class=\"takeaways\"><li><b>Relational</b>: normalised tables, joins, multi-row ACID transactions. The safe default.</li><li><b>Document</b>: self-contained nested records read whole; flexible schema, weaker joins.</li><li><b>Key-value</b>: get/put by key at huge rates; no queries on the value.</li><li><b>Wide-column</b>: write-heavy data partitioned by key, tables designed per query.</li></ul>",
          "Start with one relational database. Add a specialised store only when a concrete workload outgrows it.",
        ],
        metrics: { joins: "where needed", tx: "where needed", schema: "per store", scaleOut: "per store" },
        scene: s10,
        lab: labPoly,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 2. finding-the-needle — Parcelly (parcel tracking) learns indexes
// ════════════════════════════════════════════════════════════════════════════
{
  // (u, v) = (screen-right, screen-down) → grid (x, y)
  const P = (u, v) => ({ x: (u + v) / 2, y: (u - v) / 2 });
  const idxBlock = (u, v, label, extra = {}) => ({ type: "block", ...P(u, v), s: 4, h: 30, color: "purple", glyph: "listOrdered", label, ...extra });
  const page = (u, v, label, extra = {}) => ({ type: "block", ...P(u, v), s: 2.8, h: 20, color: "purple", glyph: "", label, ...extra });
  const head = (q = "find parcel") => ({
    users: crowd("Support agents", 6),
    app: api(0, -9, ["Support", "app"]),
    ...(q ? {} : {}),
  });
  const ship = (extra = {}) => db(P(10, -6).x, P(10, -6).y, "shipments", [tag("40M rows", "paper", "layers")], { cpu: 0.25, ...extra });
  const scan = (title) =>
    bars(title, "search", ["# every row is read and compared"], [
      { label: "Rows checked", note: "40,000,000", to: 1, tone: "red", bold: true },
      { label: "Rows wanted", note: "1", to: 0.01, tone: "green" },
    ]);

  // 1 — lookup by primary key
  const s1 = {
    entities: { ...head(), db: ship({ tags: [tag("40M rows", "paper", "layers"), tag("PK: id", "green", "key")] }) },
    links: { e1: L("users", "app", "parcel #31,902,114"), e2: L("app", "db", "WHERE id = ?") },
    flows: [{ route: ["e1", "e2"], bounce: true, rate: 2 }],
  };

  // 2 — full scan
  const s2 = clone(s1);
  s2.links.e1.label = "“where's PX-7Q2K?”";
  s2.links.e2.label = "WHERE tracking_code = ?";
  Object.assign(s2.entities.db, CRIT, { tags: [tag("40M rows", "paper", "layers"), tag("full scan", "red", "flame")] });
  s2.entities.app.tags = [tag("waiting…", "amber", "hourglass")];
  s2.flows = [{ route: ["e1", "e2"], kind: "slow", bounce: true, rate: 1.2, hold: 1.6 }];
  s2.entities.card = scan("Full table scan");

  // 3 — an index
  const s3 = {
    entities: {
      ...head(),
      db: ship(),
      idx: idxBlock(-18, -4, ["tracking"], { sub: "index" }),
    },
    links: {
      e1: L("users", "app", "“where's PX-7Q2K?”"),
      e3: L("app", "idx", "seek PX-7Q2K"),
      e4: L("idx", "db", "row 4,118,770"),
    },
    flows: [{ route: ["e1", "e3", "e4"], bounce: true, rate: 2 }],
  };
  s3.entities.card = panel("An index is a sorted lookup table", "listOrdered", [
    "PX-7Q1Z → row 22,040,117",
    "PX-7Q2K → row 4,118,770",
    "PX-7Q31 → row 39,002,876",
    "= sorted, so the database can jump, not search",
    "# CREATE INDEX ON shipments (tracking_code)",
  ]);

  // 4 — the B-tree
  const s4 = {
    entities: {
      ...head(),
      db: ship(),
      idx: idxBlock(-10, -34, ["root"], { sub: "A … Z" }),
      b1: page(-19, -25, ["A–M"]),
      b2: page(-1, -25, ["N–Z"]),
      l1: page(-25, -16, ["…"], { dim: 0.6 }),
      l2: page(-16, -16, ["PA–PW"], { tags: [tag("PX…", "violet")] }),
      l3: page(-6, -16, ["PX–PZ"], { tags: [tag("PX-7Q2K", "green", "check")] }),
      l4: page(3, -16, ["…"], { dim: 0.6 }),
    },
    links: {
      e1: L("users", "app", "“where's PX-7Q2K?”"),
      e3: L("app", "idx", "seek"),
      t1: L("idx", "b1", null, { style: "dashed" }),
      t2: L("idx", "b2"),
      t3: L("b1", "l1", null, { style: "dashed" }),
      t4: L("b1", "l2", null, { style: "dashed" }),
      t5: L("b2", "l3"),
      t6: L("b2", "l4", null, { style: "dashed" }),
      e4: L("l3", "db", "row 4,118,770"),
    },
    flows: [{ route: ["e1", "e3", "t2", "t5", "e4"], bounce: true, rate: 1.4 }],
  };
  s4.entities.l2.tags = [];
  s4.entities.card = panel("Why it's only ~4 reads", "layers", [
    "one 8 KB page holds ~400 keys",
    "root → 400 → 160,000 → 64,000,000 keys",
    "= 40M rows: root, branch, leaf, row",
    "# each extra level multiplies reach by ~400",
  ]);

  // 5 — composite index
  const s5 = clone(s3);
  delete s5.entities.card;
  s5.entities.idx2 = idxBlock(-6, -18, ["customer", "+ date"]);
  s5.links.e1.label = "customer 88's history";
  s5.links.e5 = L("app", "idx2", "seek (88, newest)");
  s5.links.e6 = L("idx2", "db", "20 rows");
  s5.flows = [
    { route: ["e1", "e5", "e6"], bounce: true, rate: 1.8 },
    { route: ["e3", "e4"], bounce: true, rate: 0.6 },
  ];
  s5.entities.card = panel("Sorted by customer, then date", "listOrdered", [
    "(87, Nov 19) → row 31,902,114",
    "**(88, Mar 02) → row 4,118,770**",
    "**(88, Nov 18) → row 39,870,051**",
    "**(88, Nov 20) → row 39,991,203**",
    "(89, Jan 07) → row 12,550,940",
    "= all of 88's parcels sit side by side, newest last",
  ]);

  // 6 — wrong column order
  const s6 = clone(s5);
  delete s6.entities.card;
  s6.links.e1.label = "all parcels since yesterday";
  s6.links.e5.label = "can't seek by date";
  s6.links.e5.style = "off";
  for (const k of ["e3", "e4", "e6"]) delete s6.links[k].label;
  s6.links.e7 = L("app", "db", "WHERE created_at > ?");
  s6.entities.idx2.dim = 0.5;
  s6.entities.idx2.tags = [tag("dates scattered", "amber", "alert")];
  Object.assign(s6.entities.db, CRIT, { tags: [tag("40M rows", "paper", "layers"), tag("full scan", "red", "flame")] });
  s6.flows = [{ route: ["e1", "e7"], kind: "slow", bounce: true, rate: 1.2, hold: 1.6 }];
  s6.entities.card = panel("Leftmost prefix rule", "alert", [
    "(customer_id, created_at) can answer:",
    "= customer_id = 88",
    "= customer_id = 88 AND created_at > …",
    "! created_at > … alone → full scan",
    "# like a phone book: sorted by surname, then first name",
  ]);

  // 7 — write cost
  const extras = {
    x1: idxBlock(-24, -30, ["status"], { tags: [tag("0 scans", "amber")] }),
    x2: idxBlock(-14, -30, ["weight"], { tags: [tag("0 scans", "amber")] }),
    x3: idxBlock(6, -30, ["zip"], { tags: [tag("1 report / mo", "amber")] }),
  };
  const s7 = {
    entities: {
      ...head(),
      db: ship({ ...WARN, tags: [tag("40M rows", "paper", "layers"), tag("+2,000 / s", "amber", "trendingUp")] }),
      idx: idxBlock(-18, -4, ["tracking"], { sub: "index" }),
      idx2: idxBlock(-6, -18, ["customer", "+ date"]),
      x4: idxBlock(-4, -30, ["destination"], { tags: [tag("0 scans", "amber")] }),
      ...extras,
      feed: { type: "block", ...P(22, 10), s: 4.4, h: 30, color: "green", glyph: "package", label: ["Carriers"], tags: [tag("2,000 inserts / s", "paper")] },
    },
    links: {
      e1: L("users", "app", "“where's PX-7Q2K?”"),
      e3: L("app", "idx", "seek"),
      e4: L("idx", "db", "row"),
      w0: L("feed", "db", "INSERT"),
      w1: L("db", "idx", null, { style: "dashed" }),
      w2: L("db", "idx2", null, { style: "dashed" }),
      w3: L("db", "x1", null, { style: "dashed" }),
      w4: L("db", "x2", null, { style: "dashed" }),
      w5: L("db", "x3", null, { style: "dashed" }),
      w6: L("db", "x4", null, { style: "dashed" }),
    },
    flows: [
      { route: ["w0"], kind: "write", rate: 2.2 },
      { routes: ["w1", "w2", "w3", "w4", "w5", "w6"].map((w) => ({ path: [w] })), fanout: true, kind: "write", rate: 1.1 },
      { route: ["e1", "e3", "e4"], bounce: true, rate: 0.7 },
    ],
  };
  s7.entities.card = bars("Cost of one INSERT", "database", ["# every index is a separate sorted structure to update"], [
    { label: "Table row", note: "1 write", to: 0.17, tone: "green" },
    { label: "Index entries", note: "+5 writes", from: 0.17, to: 1, tone: "red", bold: true },
  ]);

  // 8 — prune
  const s8 = clone(s7);
  delete s8.entities.x1;
  delete s8.entities.x2;
  delete s8.entities.x4;
  delete s8.links.w3;
  delete s8.links.w4;
  delete s8.links.w6;
  delete s8.entities.x3;
  delete s8.links.w5;
  Object.assign(s8.entities.db, OK, { tags: [tag("40M rows", "paper", "layers"), tag("+2,000 / s", "green", "trendingUp")] });
  s8.flows = [
    { route: ["w0"], kind: "write", rate: 2.2 },
    { routes: [{ path: ["w1"] }, { path: ["w2"] }], fanout: true, kind: "write", rate: 1.1 },
    { route: ["e1", "e3", "e4"], bounce: true, rate: 0.9 },
  ];
  s8.entities.card = panel("Index usage, last 30 days", "chart", [
    "idx_tracking     1.9 billion scans   keep",
    "idx_cust_date    310 million scans   keep",
    "! idx_status, idx_weight, idx_dest   0 scans   drop",
    "! idx_zip   1 report / month   drop, run on a replica",
    "= 6 writes per insert → 3",
  ]);

  // 9 — recap
  const s9 = clone(s8);
  s9.entities.card = panel("Index checklist", "listChecks", [
    "index the columns your hot queries filter on",
    "composite: equality columns first, then range / sort",
    "check the plan (EXPLAIN) — no seek means no index",
    "! every index taxes every write and uses disk",
    "= measure usage; drop what nobody reads",
  ]);

  const L2 = (dbSt) =>
    lab(2000, 1800, [["users", "users", "Support agents"], ["app", "api_server", "Support app"], ["db", "postgres", "shipments", "40M rows", dbSt]], [["users", "app"], ["app", "db"]]);

  write({
    id: "finding-the-needle",
    title: "Finding the Needle",
    summary: "Parcelly's support team searches 40 million shipments by tracking code — and waits seven seconds every time. Learn what an index really is, how B-trees find one row in four reads, and what indexes cost.",
    minutes: 11,
    level: "beginner",
    metrics: ["rows", "p95", "writeCost", "indexes"],
    legend: ["req", "res", "slow", "write"],
    goals: [
      { text: "See why a query without an index reads every row", step: 1 },
      { text: "Understand how a B-tree finds one row in a few page reads", step: 3 },
      { text: "Design a composite index and know its column-order rule", step: 4 },
      { text: "Weigh the write and storage cost of every index", step: 6 },
    ],
    steps: [
      {
        short: "40M parcels",
        chapter: "setup",
        title: "One table, forty million rows",
        body: [
          "<b>Parcelly</b> tracks parcels for small shops. Its <code>shipments</code> table holds <b>40 million rows</b> and grows by 2,000 a second at peak.",
          "Looking a parcel up by its numeric <code>id</code> is instant: the <span class=\"term\">primary key</span> comes with an index for free, so the database jumps straight to the row.",
        ],
        metrics: { rows: 1, p95: 4, writeCost: 1, indexes: "PK only" },
        scene: s1,
        lab: L2(),
      },
      {
        short: "Full scan",
        chapter: "problem",
        title: "Searching by tracking code",
        body: [
          "Customers don't know internal ids — they paste a tracking code like <code>PX-7Q2K</code>. There's no index on <code>tracking_code</code>, so the database does the only thing it can: a <span class=\"term\">full table scan</span>, reading all 40 million rows (~9 GB) to find one.",
          "Each search takes seconds and burns disk and CPU that every other query needs. Ten agents searching at once bring the database to its knees.",
        ],
        callout: { kind: "warn", text: "Full scans hide in small test data. With 1,000 rows they take a millisecond; with 40 million they take seconds." },
        changes: ["~ Query filters on tracking_code (no index)", "~ Database at 96% CPU scanning"],
        metrics: { rows: 40000000, p95: 7400, writeCost: 1, indexes: "PK only" },
        scene: s2,
        lab: L2("crit"),
      },
      {
        short: "An index",
        chapter: "solution",
        title: "Keep a sorted copy of the column",
        body: [
          "An <span class=\"term\">index</span> is a separate structure holding every tracking code <em>in sorted order</em>, each with a pointer to its row — like the index at the back of a book.",
          "Because it's sorted, the database can jump to the right spot instead of reading everything. One <code>CREATE INDEX</code> later, the same search reads one row.",
        ],
        changes: ["+ idx_tracking on tracking_code", "~ App seeks the index, then fetches one row"],
        metrics: { rows: 1, p95: 3, writeCost: 2, indexes: 1 },
        scene: s3,
        lab: L2(),
      },
      {
        short: "B-tree",
        chapter: "technique",
        title: "Inside the index: a B-tree",
        body: [
          "Most database indexes are <span class=\"term\">B-trees</span>: a shallow tree of fixed-size pages. The root page splits the key range into slices, each pointing at a child page; leaf pages hold the keys and row pointers.",
          "Each page holds hundreds of keys, so the tree is very wide and very short. Finding <code>PX-7Q2K</code> among 40 million codes means reading the root, one branch and one leaf — then the row.",
        ],
        callout: { kind: "insight", text: "Doubling the table adds almost nothing: with ~400 keys per page, one more level covers 400× more rows." },
        changes: ["~ Index expanded: root → branches → leaves"],
        metrics: { rows: 1, p95: 3, writeCost: 2, indexes: 1 },
        scene: s4,
      },
      {
        short: "Composite",
        chapter: "technique",
        title: "One index, two columns",
        body: [
          "The parcel history page asks: <code>WHERE customer_id = 88 ORDER BY created_at DESC LIMIT 20</code>. A <span class=\"term\">composite index</span> on <code>(customer_id, created_at)</code> sorts entries by customer first, then by date within each customer.",
          "All of customer 88's parcels sit side by side, already in date order. The database seeks to the newest one and reads 20 neighbours — no sorting, no scanning.",
        ],
        changes: ["+ idx_cust_date on (customer_id, created_at)"],
        metrics: { rows: 20, p95: 5, writeCost: 3, indexes: 2 },
        scene: s5,
        lab: L2(),
      },
      {
        short: "Column order",
        chapter: "insight",
        title: "Order of columns matters",
        body: [
          "An analyst asks for “all parcels created since yesterday”. The composite index can't help: dates are only sorted <em>within</em> each customer, so yesterday's parcels are scattered across millions of customer sections. Back to a full scan.",
          "This is the <span class=\"term\">leftmost prefix</span> rule: a composite index serves queries that constrain its first column(s). Put equality filters first and the range or sort column last.",
        ],
        callout: { kind: "tip", text: "Need both access paths? That's two indexes — and, as you'll see next, each one has a price." },
        changes: ["~ Query filters on created_at only"],
        metrics: { rows: 40000000, p95: 7400, writeCost: 3, indexes: 2 },
        scene: s6,
        lab: L2("crit"),
      },
      {
        short: "Write cost",
        chapter: "tradeoff",
        title: "Every index taxes every write",
        body: [
          "Over a year, teams added indexes for every report idea — six in total. Each new parcel now means writing the row <b>plus an entry in every index</b>, each in a different place on disk.",
          "At 2,000 inserts a second that's 12,000 writes a second. Inserts slow down, the indexes take more disk than the table itself, and backups grow with them.",
        ],
        changes: ["+ Carrier feed inserting 2,000 rows / s", "+ 4 more indexes (status, weight, zip, destination)"],
        metrics: { rows: 1, p95: 3, writeCost: 6, indexes: 5 },
        scene: s7,
        lab: L2("warn"),
      },
      {
        short: "Prune",
        chapter: "solution",
        title: "Keep the indexes that earn their keep",
        body: [
          "The database tracks how often each index is used. Three have <b>zero</b> scans in a month; the ZIP index serves one monthly report that can run on a replica instead.",
          "Dropping them halves the write cost per insert. Reads that matter are unaffected — they were never using those indexes.",
        ],
        changes: ["- idx_status, idx_weight, idx_dest, idx_zip"],
        metrics: { rows: 1, p95: 3, writeCost: 3, indexes: 2 },
        scene: s8,
        lab: L2(),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Indexes in one breath",
        body: [
          "<ul class=\"takeaways\"><li>No index on the filtered column → <b>full scan</b>, cost grows with table size.</li><li>A <b>B-tree</b> index finds a row in a handful of page reads, and keeps keys sorted for ranges and ORDER BY.</li><li><b>Composite</b> indexes follow the leftmost-prefix rule: equality columns first.</li><li>Every index adds a <b>write</b> per insert and disk space — measure and prune.</li></ul>",
        ],
        metrics: { rows: 1, p95: 3, writeCost: 3, indexes: 2 },
        scene: s9,
        lab: L2(),
      },
    ],
  });
}

// @@NEXT@@
