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
          "Over a year, teams added an index for every report idea — five secondary indexes in total. Each new parcel now means writing the row <b>plus an entry in every index</b>, each in a different place on disk.",
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

// shared: (u, v) = (screen-right, screen-down) → grid (x, y)
const P = (u, v) => ({ x: (u + v) / 2, y: (u - v) / 2 });
const crowdAt = (u, v, label, count = 8, half = 3.2) => {
  const c = P(u, v);
  return { type: "crowd", x0: c.x - half, x1: c.x + half, y0: c.y - half, y1: c.y + half, count, label };
};
const at = (u, v) => {
  const c = P(u, v);
  return [c.x, c.y];
};

// ════════════════════════════════════════════════════════════════════════════
// 3. under-the-hood-of-a-write — Pulsewise (fitness bands) and its storage engine
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 900000;
  const head = (count = 8) => ({
    bands: crowdAt(-36, 8, "Pulsewise bands", count),
    api: api(P(-20, 0).x, P(-20, 0).y, ["Ingest", "API"]),
  });
  const mem = (label = ["Buffer pool"], sub = "RAM", extra = {}) => ({ type: "block", ...P(-2, -14), s: 4, h: 30, color: "yellow", glyph: "zap", label, sub, ...extra });
  const wal = (extra = {}) => ({ type: "block", ...P(-2, 14), s: 4, h: 22, color: "slab", glyph: "scroll", label: ["WAL"], sub: "append-only", ...extra });
  const pageB = (u, v, n, extra = {}) => ({ type: "block", ...P(u, v), s: 3, h: 20, color: "purple", glyph: "", label: ["page", n], ...extra });
  const sst = (u, v, label, extra = {}) => ({ type: "block", ...P(u, v), s: 3.4, h: 20, color: "green", glyph: "listOrdered", label, ...extra });
  const W = () => ({ e1: L("bands", "api", "heart-rate samples") });

  // 1 — the journey
  const s1 = {
    entities: {
      ...head(),
      eng: { type: "ghost", ...P(-2, 0), s: 5, h: 60, label: "storage engine" },
      disk: db(P(16, 0).x, P(16, 0).y, "disk", [tag("SSD", "paper", "database")]),
    },
    links: { ...W(), e2: L("api", "eng", "INSERT"), e3: L("eng", "disk", null, { style: "dashed" }) },
    flows: [{ route: ["e1", "e2"], kind: "write", rate: 2.4 }],
  };

  // 2 — RAM only, then power cut
  const s2 = {
    entities: {
      ...head(),
      mem: mem(["Buffer pool"], "RAM", { ...DOWN, tags: [tag("power cut", "red", "power")] }),
      disk: db(P(16, 0).x, P(16, 0).y, "disk", [tag("8 s behind", "amber", "clock")]),
    },
    links: { ...W(), e2: L("api", "mem", "write + ack", { fail: 0.6 }), e3: L("mem", "disk", "flush later", { style: "off" }) },
    flows: [{ route: ["e1", "e2"], kind: "write", rate: 2.2 }],
  };
  s2.entities.card = panel("What the crash took", "alert", [
    "14:02:00  last flush to disk",
    "14:02:08  power cut",
    "! 8 s × 40,000 samples = 320,000 acked writes gone",
    "# they were only ever in RAM",
  ]);

  // 3 — write-ahead log
  const s3 = {
    entities: {
      ...head(),
      mem: mem(),
      wal: wal({ tags: [tag("fsync", "green", "lock")] }),
      disk: db(P(16, 0).x, P(16, 0).y, "data files", [tag("updated later", "paper", "clock")]),
    },
    links: {
      ...W(),
      e4: L("api", "wal", "① append"),
      e2: L("api", "mem", "② apply"),
      e3: L("mem", "disk", "checkpoint", { style: "dashed" }),
      r1: L("wal", "mem", "replay on restart", { style: "off" }),
    },
    flows: [
      { route: ["e1", "e4"], kind: "write", rate: 2.2, bounce: true },
      { route: ["e2"], kind: "write", rate: 2.2 },
      { route: ["e3"], kind: "heavy", rate: 0.3 },
    ],
  };
  s3.entities.card = panel("Write-ahead log", "scroll", [
    "1. append the change to the end of the log",
    "2. fsync — the bytes are on disk",
    "3. apply to the page in RAM, then ack",
    "= crash? replay the log since the last checkpoint",
    "# one fsync can cover thousands of writes (group commit)",
  ]);

  // 4 — B-tree pages updated in place
  const pages = {
    pg1: pageB(16, -22, "17"),
    pg2: pageB(30, -14, "902"),
    pg3: pageB(34, 0, "4,410"),
    pg4: pageB(24, 10, "61,337"),
    pg5: pageB(12, 17, "88,105"),
  };
  const pageLinks = Object.fromEntries(Object.keys(pages).map((k, i) => [`p${i + 1}`, L("mem", k, null, { style: "dashed" })]));
  const s4 = {
    entities: { ...head(), mem: mem(["Buffer pool"], "dirty pages"), wal: wal({ tags: [tag("sequential", "green")] }), ...pages },
    links: { ...W(), e4: L("api", "wal", "① append"), e2: L("api", "mem", "② apply"), ...pageLinks },
    flows: [
      { route: ["e1", "e4"], kind: "write", rate: 2.2, bounce: true },
      { route: ["e2"], kind: "write", rate: 2.2 },
      { routes: Object.keys(pageLinks).map((p) => ({ path: [p] })), kind: "write", rate: 1.6 },
    ],
  };
  s4.entities.card = panel("B-tree: update in place", "layers", [
    "each row lives in exactly one 8 KB page",
    "a write dirties that page in RAM",
    "checkpoint writes the page back to its own spot",
    "= reads: root → branch → leaf, 3–4 pages",
    "! pages are scattered → random disk writes",
  ]);

  // 5 — random I/O wall
  const s5 = clone(s4);
  delete s5.entities.card;
  s5.entities.bands.count = 14;
  s5.links.e1.label = "3× more bands";
  Object.assign(s5.entities.api, WARN, { tags: [tag("queueing", "amber", "hourglass")] });
  Object.assign(s5.entities.mem, WARN);
  for (const k of Object.keys(pages)) Object.assign(s5.entities[k], { heat: 0.8 });
  s5.entities.pg2.tags = [tag("random I/O", "red", "flame")];
  s5.flows = [
    { route: ["e1", "e4"], kind: "slow", rate: 2.4, bounce: true, hold: 0.6 },
    { route: ["e2"], kind: "write", rate: 2.4 },
    { routes: Object.keys(pageLinks).map((p) => ({ path: [p] })), kind: "write", rate: 3.2 },
  ];
  s5.entities.card = bars("Disk bytes for one 100-byte sample", "database", ["# random keys: neighbours in a page rarely change together"], [
    { label: "The sample", note: "100 B", to: 0.02, tone: "green" },
    { label: "WAL record", note: "~150 B", to: 0.04, tone: "green" },
    { label: "Page rewrite", note: "up to 8 KB", to: 1, tone: "red", bold: true },
  ]);

  // 6 — LSM: memtable + SSTables
  const ssts = { sst1: sst(18, -31, ["SST 1"]), sst2: sst(18, -14, ["SST 2"]), sst3: sst(18, 3, ["SST 3"], { tags: [tag("new", "green")] }) };
  const s6 = {
    entities: {
      ...head(14),
      mem: mem(["Memtable"], "sorted · 64 MB"),
      wal: wal({ tags: [tag("sequential", "green")] }),
      ...ssts,
    },
    links: {
      ...W(),
      e4: L("api", "wal", "① append"),
      e2: L("api", "mem", "② insert"),
      f1: L("mem", "sst1", null, { style: "off" }),
      f2: L("mem", "sst2", null, { style: "off" }),
      f3: L("mem", "sst3", "flush when full"),
    },
    flows: [
      { route: ["e1", "e4"], kind: "write", rate: 2.6, bounce: true },
      { route: ["e2"], kind: "write", rate: 2.6 },
      { route: ["f3"], kind: "heavy", rate: 0.35 },
    ],
  };
  s6.links.e1.label = "3× more bands";
  s6.entities.card = panel("LSM-tree: never overwrite", "listOrdered", [
    "writes go to the log and a sorted in-memory table",
    "full memtable → written out as one sorted file",
    "files (SSTables) are immutable once written",
    "= the disk only ever sees long sequential writes",
  ]);

  // 7 — reads check several files
  const s7 = clone(s6);
  delete s7.entities.card;
  s7.links.e1.label = "“last hour for band 7”";
  s7.links.e2.label = "lookup";
  s7.links.f1 = L("mem", "sst1", null, { style: "dashed" });
  s7.links.f2 = L("mem", "sst2", null, { style: "dashed" });
  s7.links.f3 = L("mem", "sst3", null, { style: "dashed" });
  delete s7.links.e4;
  s7.entities.sst3.tags = [tag("bloom: no", "gray", "filter")];
  s7.entities.sst2.tags = [tag("bloom: maybe", "green", "filter")];
  s7.entities.sst1.tags = [tag("bloom: no", "gray", "filter")];
  s7.flows = [
    { route: ["e1", "e2"], kind: "ping", rate: 1.2, bounce: true, hold: 0.4 },
    { route: ["f2"], kind: "ping", rate: 1.2, bounce: true },
  ];
  s7.entities.card = panel("Where is band 7's newest value?", "search", [
    "1. memtable (newest data)",
    "2. SSTables, newest → oldest, until found",
    "# each file keeps a bloom filter: “definitely not here” or “maybe”",
    "= most files are skipped without touching disk",
    "! more files → more places to look",
  ]);

  // 8 — compaction
  const s8 = clone(s6);
  delete s8.entities.card;
  s8.entities.sst3.tags = [];
  s8.entities.l1 = { type: "block", ...P(34, -14), s: 4.6, h: 26, color: "green", glyph: "layers", label: ["Merged", "SST"], tags: [tag("−30% size", "green")] };
  for (const k of ["sst1", "sst2", "sst3"]) s8.entities[k].dim = 0.4;
  s8.links.c1 = L("sst1", "l1", null, { style: "dashed" });
  s8.links.c2 = L("sst2", "l1", "compaction");
  s8.links.c3 = L("sst3", "l1", null, { style: "dashed" });
  s8.links.f3.label = null;
  delete s8.links.f3.label;
  s8.flows = [
    { route: ["e1", "e4"], kind: "write", rate: 2.6, bounce: true },
    { route: ["e2"], kind: "write", rate: 2.6 },
    { routes: [{ path: ["c1"] }, { path: ["c2"] }, { path: ["c3"] }], fanout: true, kind: "heavy", rate: 0.6 },
  ];
  s8.entities.card = panel("Compaction, in the background", "merge", [
    "merge-sort several files into one",
    "keep only the newest value of each key",
    "drop deleted keys (tombstones)",
    "= fewer files per read, less wasted space",
    "! the same bytes get rewritten many times",
  ]);

  // 9 — trade-off: two engines side by side
  const s9 = {
    entities: {
      ...head(14),
      bt: db(P(0, -14).x, P(0, -14).y, "B-tree engine", [tag("read: 3–4 pages", "green", "search"), tag("write: random", "amber")]),
      lsm: db(P(0, 14).x, P(0, 14).y, "LSM engine", [tag("write: sequential", "green", "activity"), tag("read: several files", "amber")]),
    },
    links: { e1: L("bands", "api", "samples"), b1: L("api", "bt", "profile lookups"), b2: L("api", "lsm", "sample stream") },
    flows: [
      { route: ["e1", "b2"], kind: "write", rate: 2.8 },
      { route: ["b1"], bounce: true, rate: 1 },
    ],
  };
  s9.entities.card = bars("Amplification (shorter is better)", "gauge", ["# B-tree ▸ violet   LSM ▸ blue"], [
    { label: "Write amp · B-tree", note: "page rewrites", to: 0.85, tone: "violet" },
    { label: "Write amp · LSM", note: "compaction", to: 0.4, tone: "blue" },
    { label: "Read amp · B-tree", note: "3–4 pages", to: 0.2, tone: "violet" },
    { label: "Read amp · LSM", note: "1–N files", to: 0.55, tone: "blue" },
  ]);

  const s10 = clone(s9);
  s10.entities.card = panel("Under the hood", "listChecks", [
    "log first, then ack — that's what makes a write durable",
    "B-tree: update pages in place; fast, predictable reads",
    "LSM: buffer, flush sorted files, compact; fast writes",
    "= pick the engine that matches your read/write mix",
  ]);

  const labBT = (st) => lab(U, 40000, [["bands", "users", "Bands"], ["api", "api_server", "Ingest API"], ["db", "postgres", "B-tree store", "samples", st]], [["bands", "api"], ["api", "db"]]);
  const labLSM = lab(U, 120000, [["bands", "users", "Bands"], ["api", "api_server", "Ingest API"], ["db", "cassandra", "LSM store", "samples"]], [["bands", "api"], ["api", "db"]]);
  const both = { wps: "120,000", diskPattern: "per engine", lookupCost: "per engine", crashSafe: "yes" };

  write({
    id: "under-the-hood-of-a-write",
    title: "Under the Hood of a Write",
    summary: "Pulsewise fitness bands stream 40,000 heart-rate samples a second. Follow one write into the storage engine: the write-ahead log, B-trees that update in place, and LSM-trees that never do.",
    minutes: 12,
    level: "intermediate",
    metrics: ["wps", "diskPattern", "lookupCost", "crashSafe"],
    legend: ["write", "req", "res", ["heavy", "flush / merge"], ["ping", "read probe"], "fail"],
    goals: [
      { text: "Explain why a write-ahead log makes acknowledged writes survive a crash", step: 2 },
      { text: "See how a B-tree updates pages in place, and why that means random I/O", step: 3 },
      { text: "Follow an LSM-tree write: memtable, flush, SSTables, compaction", step: 5 },
      { text: "Compare read and write amplification of both engines", step: 8 },
    ],
    steps: [
      {
        short: "A write",
        chapter: "setup",
        title: "What happens after INSERT?",
        body: [
          "<b>Pulsewise</b> makes fitness bands. Every band uploads heart-rate samples, and the ingest API stores about <b>40,000 samples a second</b>, each roughly 100 bytes.",
          "To the API, storing a sample is one <code>INSERT</code> and an “OK”. Inside the database a <span class=\"term\">storage engine</span> decides how those bytes reach the disk — and that choice sets how fast writes go, how fast reads go, and what survives a crash.",
        ],
        metrics: { wps: "40,000 needed", diskPattern: "?", lookupCost: "?", crashSafe: "?" },
        scene: s1,
        lab: labBT(),
      },
      {
        short: "RAM only",
        chapter: "problem",
        title: "Fast — until the power cuts",
        body: [
          "The quickest engine imaginable changes the data in memory, replies “OK”, and copies memory to disk every few seconds. RAM is thousands of times faster than disk, so it flies.",
          "Then a power cut hits. Everything written since the last copy — samples the API already confirmed — is gone. A database that forgets acknowledged writes isn't <span class=\"term\">durable</span>, and durability is the D in ACID.",
        ],
        callout: { kind: "warn", text: "“OK” must mean “safe on disk”. If it only means “in memory”, the client has no idea which data to send again." },
        changes: ["+ Buffer pool in RAM", "~ Power cut: buffer pool lost", "~ Disk 8 s behind"],
        metrics: { wps: "40,000", diskPattern: "none", lookupCost: "1 (RAM)", crashSafe: "no" },
        scene: s2,
      },
      {
        short: "Log first",
        chapter: "solution",
        title: "Write-ahead log: append, then ack",
        body: [
          "Before touching any data page, the engine appends a short record describing the change to the end of a <span class=\"term\">write-ahead log</span> (WAL) and forces it to disk with <code>fsync</code>. Only then does it update the page in memory and reply.",
          "Appending to the end of one file is the cheapest thing a disk can do. Pages are written back later in bulk (a <span class=\"term\">checkpoint</span>); after a crash, the engine replays the log from the last checkpoint and nothing acknowledged is lost.",
        ],
        changes: ["+ WAL (append-only, fsync before ack)", "~ Buffer pool back, flushed at checkpoints"],
        metrics: { wps: "40,000", diskPattern: "WAL: sequential", lookupCost: "1 (RAM)", crashSafe: "yes" },
        scene: s3,
        lab: labBT(),
      },
      {
        short: "B-tree",
        chapter: "technique",
        title: "B-tree engines update pages in place",
        body: [
          "Most relational databases keep table and index data in <span class=\"term\">B-trees</span> made of fixed-size pages (often 8 KB). Every key has exactly one home page; a write modifies that page in memory and the checkpoint writes the page back to <em>the same spot</em> on disk.",
          "Reads love this: any key is a root-to-leaf walk of 3–4 pages, most of them cached. Writes pay: samples from different bands land in pages scattered across the disk.",
        ],
        changes: ["+ B-tree pages on disk", "~ Checkpoint writes pages back in place"],
        metrics: { wps: "40,000", diskPattern: "pages: random", lookupCost: "3–4 pages", crashSafe: "yes" },
        scene: s4,
        lab: labBT(),
      },
      {
        short: "I/O wall",
        chapter: "problem",
        title: "Three times the bands, a random-write wall",
        body: [
          "A holiday sale triples the bands: <b>120,000 samples a second</b>. Each sample touches a different page, so the checkpoint has to rewrite thousands of scattered 8 KB pages to persist a few hundred bytes in each.",
          "That ratio — bytes the disk writes per byte you asked to store — is <span class=\"term\">write amplification</span>. The disk saturates on random writes, checkpoints fall behind, and the engine tops out near 52,000 samples a second.",
        ],
        changes: ["~ Traffic ×3", "~ Pages hot with random writes", "~ API queueing"],
        metrics: { wps: "52,000 of 120,000", diskPattern: "pages: random", lookupCost: "3–4 pages", crashSafe: "yes" },
        scene: s5,
        lab: labBT("crit"),
      },
      {
        short: "LSM-tree",
        chapter: "solution",
        title: "LSM-tree: buffer, sort, write once",
        body: [
          "A <span class=\"term\">log-structured merge-tree</span> never updates data in place. Each write goes to the WAL (for durability) and into a <span class=\"term\">memtable</span>, an in-memory structure kept sorted by key.",
          "When the memtable reaches ~64 MB it is written out in one go as a sorted, immutable file — an <span class=\"term\">SSTable</span> — and a fresh memtable starts. Every disk write is now a long sequential stream, so the same disk keeps up with all 120,000 samples a second.",
        ],
        changes: ["- B-tree pages", "~ Buffer pool → sorted memtable", "+ Immutable SSTables flushed from memtable"],
        metrics: { wps: "120,000", diskPattern: "all sequential", lookupCost: "memtable + files", crashSafe: "yes" },
        scene: s6,
        lab: labLSM,
      },
      {
        short: "LSM reads",
        chapter: "tradeoff",
        title: "Reads have more places to look",
        body: [
          "A key may have been written many times, so its newest value could be in the memtable or in any SSTable. A read checks the memtable, then files from newest to oldest, and stops at the first hit.",
          "To avoid opening every file, each SSTable carries a <span class=\"term\">bloom filter</span> — a tiny bit-array that answers “definitely not here” or “maybe here”. Most files are ruled out in memory, so a typical read touches one or two files.",
        ],
        callout: { kind: "tip", text: "Bloom filters can say “maybe” wrongly (a false positive costs one wasted read) but never say “no” when the key is there." },
        changes: ["~ Read probes memtable, then SSTables", "+ Bloom filter verdict on each file"],
        metrics: { wps: "120,000", diskPattern: "all sequential", lookupCost: "1–2 files", crashSafe: "yes" },
        scene: s7,
        lab: labLSM,
      },
      {
        short: "Compaction",
        chapter: "technique",
        title: "Compaction tidies up",
        body: [
          "Left alone, SSTables pile up: reads slow down and old versions of overwritten or deleted keys waste disk. In the background, <span class=\"term\">compaction</span> merge-sorts several files into one, keeping only the newest value of each key and dropping deleted ones.",
          "Merging sorted files is sequential too, but it rewrites the same data again and again as it moves into bigger files. That's the LSM's own write amplification — paid in the background instead of on the write path.",
        ],
        callout: { kind: "warn", text: "If compaction can't keep up with writes, files accumulate and read latency creeps up. Leave disk bandwidth headroom for it." },
        changes: ["+ Merged SSTable", "~ Old SSTables fade out after compaction"],
        metrics: { wps: "120,000", diskPattern: "all sequential", lookupCost: "1–2 files", crashSafe: "yes" },
        scene: s8,
        lab: labLSM,
      },
      {
        short: "Trade-offs",
        chapter: "tradeoff",
        title: "Read, write and space amplification",
        body: [
          "<table class=\"compare\"><tbody><tr><th></th><th>B-tree</th><th>LSM-tree</th></tr><tr><td>Writes</td><td>in place, random</td><td>appends, sequential</td></tr><tr><td>Reads</td><td>3–4 pages, predictable</td><td>memtable + 1–N files</td></tr><tr><td>Extra disk work</td><td>page rewrites</td><td>compaction</td></tr><tr><td>Wasted space</td><td>half-empty pages</td><td>stale versions until merged</td></tr></tbody></table>",
          "Pulsewise keeps user profiles (read-heavy, updated rarely) in a B-tree database and the sample stream (write-heavy, read by time range) in an LSM-based store.",
        ],
        changes: ["~ Profiles in a B-tree engine", "~ Samples in an LSM engine"],
        metrics: both,
        scene: s9,
        lab: lab(U, 120000, [["bands", "users", "Bands"], ["api", "api_server", "Ingest API"], ["bt", "postgres", "B-tree store", "profiles"], ["lsm", "cassandra", "LSM store", "samples"]], [["bands", "api"], ["api", "bt"], ["api", "lsm"]]),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Every write, step by step",
        body: [
          "<ul class=\"takeaways\"><li>A write is acknowledged only after its <b>WAL</b> record is on disk — that's durability.</li><li><b>B-trees</b> update fixed pages in place: cheap, predictable reads; random writes.</li><li><b>LSM-trees</b> buffer in a sorted memtable and flush immutable SSTables: sequential writes; reads check several files, helped by bloom filters.</li><li><b>Compaction</b> keeps LSM reads fast, at the cost of rewriting data in the background.</li></ul>",
        ],
        metrics: both,
        scene: s10,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 4. copies-everywhere — Quillbook (shared notes) learns replication
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 2000000;
  const dbAt = (u, v, label, tags, extra = {}) => db(P(u, v).x, P(u, v).y, label, tags, { cpu: 0.35, ...extra });
  const LEADER = tag("leader", "violet", "flag");
  const FOLLOW = tag("follower", "paper", "replay");
  const head = (count = 10) => ({
    users: crowdAt(-38, 10, "Quillbook users", count),
    app: api(P(-20, 0).x, P(-20, 0).y, ["Notes", "API"]),
  });
  const trio = () => ({
    db1: dbAt(0, -30, "db-a", [LEADER]),
    db2: dbAt(0, 0, "db-b", [FOLLOW]),
    db3: dbAt(0, 30, "db-c", [FOLLOW]),
  });
  const repLinks = () => ({
    rep2: L("db1", "db2", "log stream", { style: "dashed" }),
    rep3: { from: "db1", to: "db3", pts: ["db1", at(16, -30), at(16, 30), "db3"], label: "log stream", style: "dashed" },
  });
  const baseLinks = () => ({
    e1: L("users", "app", "open · edit notes"),
    w: L("app", "db1", "writes"),
    r2: L("app", "db2", "reads"),
    r3: L("app", "db3", "reads"),
    ...repLinks(),
  });
  const baseFlows = (rate = 1) => [
    { route: ["e1", "w"], kind: "write", rate: 0.7 * rate, bounce: true },
    { route: ["e1", ["r2", "r3"]], rate: 2.2 * rate, bounce: true },
    { routes: [{ path: ["rep2"] }, { path: ["rep3"] }], fanout: true, kind: "write", rate: 0.7 * rate },
  ];
  const labRep = (st1, st2, st3) =>
    lab(U, 30000, [
      ["users", "users", "Users"],
      ["app", "api_server", "Notes API"],
      ["db1", "postgres", "db-a", "leader", st1],
      ["db2", "postgres", "db-b", "follower", st2],
      ["db3", "postgres", "db-c", "follower", st3],
    ], [["users", "app"], ["app", "db1"], ["app", "db2"], ["app", "db3"], ["db1", "db2"], ["db1", "db3"]]);

  // 1 — one database
  const s1 = {
    entities: { ...head(), db1: dbAt(0, -30, "db-a", [tag("only copy", "amber", "alert")], { ...CRIT }) },
    links: { e1: L("users", "app", "open · edit notes"), w: L("app", "db1", "reads + writes") },
    flows: [
      { route: ["e1", "w"], pattern: ["req", "req", "slow", "req", "write"], rate: 2.6, bounce: true },
    ],
  };
  s1.entities.card = bars("db-a, peak hour", "database", ["# reads outnumber writes 20 to 1"], [
    { label: "Reads wanted", note: "30,000 q/s", to: 1, tone: "red", bold: true },
    { label: "One node serves", note: "~10,000 q/s", to: 0.33, tone: "amber" },
    { label: "Writes", note: "1,500 q/s", to: 0.05, tone: "violet" },
  ]);

  // 2 — leader + followers
  const s2 = { entities: { ...head(), ...trio() }, links: baseLinks(), flows: baseFlows() };
  s2.entities.card = panel("Replication = ship the log", "replay", [
    "1. every write goes to the leader",
    "2. the leader appends it to its log",
    "3. followers stream the log and replay it in order",
    "= any copy can answer reads",
  ]);

  // 3 — lag
  const s3 = { entities: { ...head(), ...trio() }, links: baseLinks(), flows: baseFlows() };
  s3.entities.db3.tags = [FOLLOW, tag("6 s behind", "amber", "clock")];
  s3.entities.db3.cpu = 0.8;
  s3.entities.db3.heat = 0.4;
  s3.entities.mia = { type: "device", ...P(-26, 32), form: "phone", label: "Mia", tags: [tag("“my edit vanished!”", "red", "alert")] };
  s3.links.m1 = L("mia", "app", "save · reload");
  s3.links.rep3.label = "6 s behind";
  s3.links.rep3.labelTone = "amber";
  s3.flows = [
    ...baseFlows(),
    { route: ["m1", "w"], kind: "mine", rate: 0.5, bounce: true },
    { route: ["m1", "r3"], kind: "mine", rate: 0.5, bounce: true, hold: 0.3 },
  ];
  s3.entities.card = panel("Mia's 2 seconds", "clock", [
    "09:00:00  save note → leader ✓",
    "09:00:01  reload → db-c",
    "! db-c is still replaying 08:59:55",
    "! Mia sees her old text",
  ]);

  // 4 — read-your-writes
  const s4 = clone(s3);
  delete s4.entities.card;
  s4.entities.mia.tags = [tag("sees her edit", "green", "check")];
  s4.flows = [
    ...baseFlows(),
    { route: ["m1", "w"], kind: "mine", rate: 1, bounce: true },
  ];
  s4.links.w.label = "writes + Mia's reads";
  s4.entities.card = panel("Read-your-writes", "userCheck", [
    "after a write, remember its log position",
    "send that user's reads to a copy that has it —",
    "or to the leader for the next ~10 s",
    "= everyone else keeps using followers",
  ]);

  // 5 — sync vs async
  const s5 = { entities: { ...head(), ...trio() }, links: baseLinks(), flows: baseFlows() };
  s5.entities.db2.tags = [FOLLOW, tag("sync", "green", "lock")];
  s5.entities.db3.tags = [FOLLOW, tag("async", "paper", "clock")];
  s5.links.rep2.label = "ack before OK";
  s5.links.rep2.style = "solid";
  s5.flows = [
    { route: ["e1", "w", "rep2"], kind: "write", rate: 0.8, bounce: true },
    { route: ["e1", ["r2", "r3"]], rate: 2, bounce: true },
    { route: ["rep3"], kind: "write", rate: 0.7 },
  ];
  s5.entities.card = panel("Who must confirm a write?", "lock", [
    "async: leader says OK at once",
    "! a crash can lose the last moments of writes",
    "sync: leader waits for a follower's ack",
    "= acked writes exist on two machines",
    "# semi-sync: one sync follower, the rest async",
  ]);

  // 6 — leader dies
  const s6 = clone(s5);
  delete s6.entities.card;
  Object.assign(s6.entities.db1, { cpu: -1, heat: 0, tags: [tag("DOWN", "red", "alert")], opacity: 0.55 });
  s6.links.w.fail = 1;
  s6.links.w.label = "writes ✕";
  s6.links.rep2.style = "cut";
  s6.links.rep3.style = "cut";
  delete s6.links.rep2.label;
  delete s6.links.rep3.label;
  s6.flows = [
    { route: ["e1", "w"], kind: "write", rate: 0.9 },
    { route: ["e1", ["r2", "r3"]], rate: 2, bounce: true },
  ];

  // 7 — failover
  const s7 = clone(s6);
  s7.entities.db1.opacity = 0.35;
  s7.entities.db2.tags = [LEADER, tag("promoted", "green", "check")];
  s7.entities.db3.tags = [FOLLOW];
  delete s7.links.w;
  delete s7.links.rep2;
  delete s7.links.rep3;
  s7.links.r2.label = "reads + writes";
  s7.links.rep23 = L("db2", "db3", "log stream", { style: "dashed" });
  s7.flows = [
    { route: ["e1", "r2"], pattern: ["write", "req", "req"], rate: 1.6, bounce: true },
    { route: ["e1", "r3"], rate: 1.4, bounce: true },
    { route: ["rep23"], kind: "write", rate: 0.7 },
  ];
  s7.entities.card = panel("Failover in 3 moves", "refresh", [
    "1. detect: no heartbeat from db-a for 10 s",
    "2. promote the most up-to-date follower (db-b)",
    "3. point the API and db-c at the new leader",
    "= writes back after ~30 s",
  ]);

  // 8 — split brain
  const s8 = clone(s7);
  delete s8.entities.card;
  Object.assign(s8.entities.db1, { opacity: 1, cpu: 0.35, tags: [tag("still “leader”", "red", "alert")] });
  s8.entities.db2.tags = [LEADER];
  s8.links.w = L("app", "db1", "stale config", { labelTone: "red" });
  s8.flows = [
    { route: ["e1", "w"], kind: "write", rate: 0.8, bounce: true },
    { route: ["e1", "r2"], pattern: ["write", "req"], rate: 1.4, bounce: true },
    { route: ["e1", "r3"], rate: 1.2, bounce: true },
    { route: ["rep23"], kind: "write", rate: 0.7 },
  ];
  s8.entities.card = panel("Two leaders", "alert", [
    "db-a was only cut off — now it's back",
    "! it still accepts writes from a stale API node",
    "! db-a and db-b now hold different histories",
    "# async writes db-a never shipped are also lost",
  ]);

  // 9 — fencing
  const s9 = clone(s7);
  delete s9.entities.card;
  Object.assign(s9.entities.db1, { opacity: 1, cpu: 0.3, tags: [FOLLOW, tag("rejoined", "green", "check")] });
  s9.entities.db2.tags = [LEADER, tag("term 8", "violet", "hash")];
  s9.links.rep21 = { from: "db2", to: "db1", pts: ["db2", at(16, 0), at(16, -30), "db1"], label: "log stream", style: "dashed" };
  s9.links.w = L("app", "db1", "term 7 ✕", { style: "cut", labelTone: "red" });
  s9.flows = [
    { route: ["e1", "r2"], pattern: ["write", "req", "req"], rate: 1.6, bounce: true },
    { route: ["e1", "r3"], rate: 1.4, bounce: true },
    { routes: [{ path: ["rep23"] }, { path: ["rep21"] }], fanout: true, kind: "write", rate: 0.7 },
  ];
  s9.entities.card = panel("Fencing with a term number", "shield", [
    "each promotion bumps the term: 7 → 8",
    "every write carries the term it was sent under",
    "= replicas reject writes from an older term",
    "old leader steps down and follows db-b",
  ]);

  const s10 = clone(s9);
  s10.entities.card = panel("Replication checklist", "listChecks", [
    "followers add read capacity and spare copies",
    "async is fast but lags; sync is safe but slower",
    "route a user's reads after their writes",
    "rehearse failover; fence the old leader",
  ]);

  write({
    id: "copies-everywhere",
    title: "Copies Everywhere",
    summary: "Quillbook's single database can't keep up with reads, and one dead disk would lose everything. Add followers, then deal with what copies bring: lag, stale reads, failover and two leaders.",
    minutes: 12,
    level: "intermediate",
    metrics: ["reads", "lag", "writes", "canLose"],
    legend: ["req", "res", "write", ["mine", "Mia's request"], "fail"],
    goals: [
      { text: "Scale reads with a leader and followers that replay its log", step: 1 },
      { text: "Explain replication lag and fix stale reads with read-your-writes", step: 2 },
      { text: "Choose between synchronous and asynchronous replication", step: 4 },
      { text: "Walk through a failover and prevent split brain with fencing", step: 6 },
    ],
    steps: [
      {
        short: "One copy",
        chapter: "setup",
        title: "One database, two problems",
        body: [
          "<b>Quillbook</b> is a shared-notes app. At peak it needs <b>30,000 reads a second</b> but only 1,500 writes — people open and scroll notes far more than they type.",
          "Everything lives on one database, <code>db-a</code>. It tops out around 10,000 queries a second, and it is the <em>only copy</em> of every note: if its disk dies, so does Quillbook.",
        ],
        metrics: { reads: "10k of 30k q/s", lag: "—", writes: "ok", canLose: "everything" },
        scene: s1,
        lab: lab(U, 30000, [["users", "users", "Users"], ["app", "api_server", "Notes API"], ["db1", "postgres", "db-a", "only copy", "crit"]], [["users", "app"], ["app", "db1"]]),
      },
      {
        short: "Followers",
        chapter: "solution",
        title: "A leader and two followers",
        body: [
          "<span class=\"term\">Replication</span> keeps full copies of the data on several machines. One is the <span class=\"term\">leader</span>: all writes go there. It records each change in its log — the same write-ahead log it already keeps for crash safety.",
          "<span class=\"term\">Followers</span> stream that log and replay it in the same order, so they converge on the same data. The API sends reads to the followers: three nodes now share the read load, and losing one disk no longer loses the notes.",
        ],
        changes: ["+ db-b and db-c follow db-a's log", "~ Reads go to followers, writes to the leader"],
        metrics: { reads: "30k q/s", lag: "0.1 s", writes: "ok", canLose: "~0.1 s of writes" },
        scene: s2,
        lab: labRep(),
      },
      {
        short: "Lag",
        chapter: "problem",
        title: "Followers live slightly in the past",
        body: [
          "By default the leader confirms a write <em>before</em> followers have it — <span class=\"term\">asynchronous replication</span>. Usually they're a fraction of a second behind. During a bulk import, <code>db-c</code> falls <b>6 seconds</b> behind: that's <span class=\"term\">replication lag</span>.",
          "Mia saves a note and reloads. Her save went to the leader; the reload is served by <code>db-c</code>, which hasn't replayed it yet. Her edit appears to have vanished.",
        ],
        callout: { kind: "warn", text: "Lag is normally invisible, then spikes exactly when the system is busiest. Monitor it and alert on it." },
        changes: ["~ db-c 6 s behind the leader", "+ Mia saves, then reloads from db-c"],
        metrics: { reads: "30k q/s", lag: "6 s", writes: "ok", canLose: "~6 s of writes" },
        scene: s3,
        lab: labRep(undefined, undefined, "warn"),
      },
      {
        short: "Own writes",
        chapter: "solution",
        title: "Read-your-writes",
        body: [
          "Most readers don't mind a note being a few seconds old. The <em>author</em> does. <span class=\"term\">Read-your-writes consistency</span> guarantees that you always see your own changes.",
          "A simple way: for a short window after someone writes, send their reads to the leader. A more precise way: remember the log position of their last write and only read from a follower that has replayed past it. Everyone else keeps hitting the followers.",
        ],
        changes: ["~ Mia's reads go to the leader for ~10 s after she writes"],
        metrics: { reads: "30k q/s", lag: "6 s", writes: "ok", canLose: "~6 s of writes" },
        scene: s4,
        lab: labRep(undefined, undefined, "warn"),
      },
      {
        short: "Sync?",
        chapter: "tradeoff",
        title: "Synchronous vs asynchronous",
        body: [
          "If the leader dies, writes it confirmed but hadn't shipped yet are gone. <span class=\"term\">Synchronous replication</span> closes that gap: the leader waits for a follower to confirm before telling the client “OK”.",
          "The price is latency on every write, and availability: if the sync follower stalls, writes stall too. A common middle ground is <em>semi-synchronous</em> — one follower in sync (<code>db-b</code>), the rest async.",
        ],
        callout: { kind: "tip", text: "Making every follower synchronous means the slowest one sets your write latency — and any one failing blocks all writes." },
        changes: ["~ db-b replicates synchronously", "~ db-c stays asynchronous"],
        metrics: { reads: "30k q/s", lag: "0 s (db-b)", writes: "ok", canLose: "0 acked writes" },
        scene: s5,
        lab: labRep(),
      },
      {
        short: "Leader down",
        chapter: "problem",
        title: "The leader dies",
        body: [
          "At 03:12 <code>db-a</code> stops responding. Reads carry on — the followers have the data — but every write fails, because only the leader may accept writes.",
          "Someone (or something) has to decide that <code>db-a</code> is really gone and not just slow, and pick a replacement.",
        ],
        changes: ["~ db-a down", "~ Replication streams cut", "~ Writes failing"],
        metrics: { reads: "20k q/s", lag: "—", writes: "failing", canLose: "0 acked writes" },
        scene: s6,
        lab: labRep("crit"),
      },
      {
        short: "Failover",
        chapter: "solution",
        title: "Promote a follower",
        body: [
          "<span class=\"term\">Failover</span>: after missing heartbeats for a timeout (here 10 s), the cluster promotes the most up-to-date follower. <code>db-b</code> was synchronous, so it has every confirmed write.",
          "The API and <code>db-c</code> are pointed at the new leader. Writes resume after about 30 seconds. The timeout is a trade-off: too short and a slow network triggers needless failovers; too long and writes stay down.",
        ],
        changes: ["~ db-b promoted to leader", "~ db-c follows db-b", "- db-a out of rotation"],
        metrics: { reads: "20k q/s", lag: "0.1 s", writes: "ok", canLose: "~0.1 s of writes" },
        scene: s7,
        lab: lab(U, 30000, [["users", "users", "Users"], ["app", "api_server", "Notes API"], ["db2", "postgres", "db-b", "leader"], ["db3", "postgres", "db-c", "follower"]], [["users", "app"], ["app", "db2"], ["app", "db3"], ["db2", "db3"]]),
      },
      {
        short: "Two leaders",
        chapter: "problem",
        title: "Split brain",
        body: [
          "<code>db-a</code> wasn't dead — a network switch had cut it off. It comes back still believing it's the leader, and one API node with stale config keeps sending it writes.",
          "Now two machines accept writes for the same notes and their histories diverge: <span class=\"term\">split brain</span>. Merging them afterwards is painful, and some edits will be lost either way.",
        ],
        callout: { kind: "warn", text: "Failover is the riskiest moment in a replicated system. Most data-loss stories start with two nodes both thinking they lead." },
        changes: ["~ db-a back, still acting as leader", "+ Stale API path writes to db-a"],
        metrics: { reads: "20k q/s", lag: "—", writes: "diverging", canLose: "edits on both sides" },
        scene: s8,
        lab: labRep("warn"),
      },
      {
        short: "Fencing",
        chapter: "solution",
        title: "Fence off the old leader",
        body: [
          "Every promotion bumps a <span class=\"term\">term</span> (or epoch) number: <code>db-b</code> leads term 8, <code>db-a</code> led term 7. Writes and replication messages carry the term, and nodes reject anything from an older term.",
          "So <code>db-a</code>'s writes bounce, it learns a newer leader exists, discards what it never replicated and rejoins as a follower of <code>db-b</code>.",
        ],
        changes: ["+ Term numbers on writes", "~ db-a rejoins as a follower", "- Stale write path refused"],
        metrics: { reads: "30k q/s", lag: "0.1 s", writes: "ok", canLose: "~0.1 s of writes" },
        scene: s9,
        lab: lab(U, 30000, [["users", "users", "Users"], ["app", "api_server", "Notes API"], ["db2", "postgres", "db-b", "leader"], ["db3", "postgres", "db-c", "follower"], ["db1", "postgres", "db-a", "follower"]], [["users", "app"], ["app", "db2"], ["app", "db3"], ["db2", "db3"], ["db2", "db1"]]),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Copies are cheap; keeping them honest isn't",
        body: [
          "<ul class=\"takeaways\"><li>A <b>leader</b> takes writes; <b>followers</b> replay its log and serve reads.</li><li><b>Async</b> replication is fast but followers lag; <b>sync</b> guarantees acked writes survive, at a latency cost.</li><li>Use <b>read-your-writes</b> routing so users always see their own changes.</li><li><b>Failover</b> promotes a follower; <b>fencing</b> with term numbers stops the old leader from causing split brain.</li></ul>",
        ],
        metrics: { reads: "30k q/s", lag: "0.1 s", writes: "ok", canLose: "~0.1 s of writes" },
        scene: s10,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 5. split-the-pile — Stampwise (loyalty receipts) shards its database
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 6000000;
  const COLS = ["s1", "s2", "s3", "s4"];
  const head = () => ({
    users: crowdAt(-40, 10, "Shoppers & tills", 10),
    app: api(P(-24, 0).x, P(-24, 0).y, ["Receipts", "API"]),
  });
  const router = (label = ["Shard", "router"], sub = "key → shard", extra = {}) => ({ type: "block", ...P(-8, 0), s: 4, h: 30, color: "yellow", glyph: "split", label, sub, ...extra });
  const shardPos = [[10, -30], [10, -10], [10, 10], [10, 30]];
  const shardPos2 = [[28, -30], [28, -10], [28, 10], [28, 30]];
  const shard = (i, tags, extra = {}) => db(P(...shardPos[i]).x, P(...shardPos[i]).y, `shard ${i + 1}`, tags, { cpu: 0.4, ...extra });
  const shards = (tagFn, cpus = [0.4, 0.4, 0.4, 0.4]) =>
    Object.fromEntries(COLS.map((id, i) => [id, shard(i, tagFn(i), cpus[i] > 0.85 ? { ...CRIT, cpu: cpus[i] } : { cpu: cpus[i] })]));
  const linksTo = (labels = []) => ({
    e1: L("users", "app", "earn · redeem"),
    e2: L("app", "rt", "INSERT receipt"),
    ...Object.fromEntries(COLS.map((id, i) => [`k${i + 1}`, L("rt", id, labels[i] ?? null)])),
  });
  const K = ["k1", "k2", "k3", "k4"];
  const spread = (weights, rate = 2.6) => ({ route: ["e1", "e2", K], pick: "weights", weights, kind: "write", rate });
  const share = (title, note, pcts, hot = -1) =>
    bars(title, "gauge", [note], pcts.map((p, i) => ({ label: `shard ${i + 1}`, note: `${p}%`, to: p / 100, tone: i === hot ? "red" : p > 30 ? "amber" : "green", bold: i === hot })));
  const labShards = (n, st = []) =>
    lab(U, 48000, [
      ["users", "users", "Shoppers"],
      ["app", "api_server", "Receipts API"],
      ...Array.from({ length: n }, (_, i) => [`s${i + 1}`, "postgres", `shard ${i + 1}`, null, st[i]]),
    ], [["users", "app"], ...Array.from({ length: n }, (_, i) => ["app", `s${i + 1}`])]);

  // 1 — one big node
  const s1 = {
    entities: { ...head(), big: db(P(4, 0).x, P(4, 0).y, "receipts", [tag("6 TB", "paper", "database"), tag("48k writes / s", "red", "flame")], { ...CRIT, r: 2.4, h: 52 }) },
    links: { e1: L("users", "app", "earn · redeem"), e2: L("app", "big", "INSERT receipt", { fail: 0.35 }) },
    flows: [{ route: ["e1", "e2"], kind: "write", rate: 2.8 }],
  };
  s1.entities.card = bars("Biggest machine we can buy", "server", ["# replicas add reads, but every write still hits the leader"], [
    { label: "Writes needed", note: "48,000 / s", to: 1, tone: "red", bold: true },
    { label: "Node can take", note: "~15,000 / s", to: 0.31, tone: "amber" },
    { label: "Disk used", note: "6 of 8 TB", to: 0.75, tone: "amber" },
  ]);

  // 2 — split by date range
  const months = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];
  const s2 = {
    entities: { ...head(), rt: router(), ...shards((i) => [tag(months[i], "paper", "clock")], [0.25, 0.25, 0.25, 0.25]) },
    links: linksTo(),
    flows: [{ route: ["e1", "e2", K], kind: "ping", rate: 2.4 }],
  };
  s2.links.e2.label = "receipts by date";
  s2.entities.card = panel("Partition by range", "listOrdered", [
    "shard key: created_at",
    "each shard owns a contiguous slice of dates",
    "= “all receipts in March” → one shard, one scan",
    "# the router keeps a small table of boundaries",
  ]);

  // 3 — hot newest shard
  const s3 = {
    entities: { ...head(), rt: router(), ...shards((i) => [tag(months[i], "paper", "clock"), ...(i === 3 ? [tag("all of today", "red", "flame")] : [])], [0.1, 0.1, 0.1, 0.98]) },
    links: linksTo(),
    flows: [spread([0, 0, 0, 1], 2.8)],
  };
  s3.links.k4.fail = 0.4;
  s3.entities.card = share("Writes per shard today", "# new receipts always have the newest date", [0, 0, 0, 100], 3);

  // 4 — hash
  const hashTag = (i) => [tag(`hash % 4 = ${i}`, "paper", "hash")];
  const s4 = { entities: { ...head(), rt: router(["Shard", "router"], "hash key"), ...shards(hashTag, [0.62, 0.6, 0.63, 0.61]) }, links: linksTo(), flows: [spread([1, 1, 1, 1], 3)] };
  s4.entities.card = share("Writes per shard", "# hash(customer_id) % 4 scatters customers evenly", [25, 25, 26, 24]);

  // 5 — cross-shard query
  const s5 = clone(s4);
  delete s5.entities.card;
  s5.entities.store = { type: "block", ...P(-24, 24), s: 3.6, h: 28, color: "green", glyph: "building", label: ["Store", "dashboard"] };
  s5.links.e3 = L("store", "rt", "today's receipts, store 77");
  s5.flows = [
    { route: ["e1", "e2", K], kind: "write", rate: 1.4 },
    { route: ["e3"], rate: 0.5, bounce: true, hold: 1.2 },
    { routes: K.map((k, i) => ({ path: [k], kind: i === 2 ? "slow" : "req" })), fanout: true, bounce: true, rate: 0.5 },
  ];
  s5.entities.card = panel("Scatter-gather", "split", [
    "query doesn't include customer_id →",
    "router asks all 4 shards, then merges",
    "! cost ×4, latency = the slowest shard",
    "# by customer: 1 shard ✓   by store: 4 shards",
  ]);

  // 6 — choosing the key
  const s6 = clone(s4);
  s6.entities.card = panel("Choosing a shard key", "key", [
    "created_at  → ranges easy, newest shard melts",
    "store_id    → store reports local, big chains skew",
    "**customer_id → even writes, a wallet is 1 shard**",
    "= pick a key with many values, even traffic,",
    "= and that your hottest queries include",
  ]);

  // 7 — hot key
  const s7 = clone(s4);
  delete s7.entities.card;
  s7.entities.corp = { type: "block", ...P(-24, -24), s: 3.6, h: 28, color: "orange", glyph: "building", label: ["Brightmart", "staff card"], tags: [tag("16% of all writes", "amber", "trendingUp")] };
  s7.links.e4 = L("corp", "app", "one customer_id");
  Object.assign(s7.entities.s2, { heat: 0.7, cpu: 0.9 });
  s7.entities.s2.tags = [...hashTag(1), tag("hot key", "red", "flame")];
  s7.flows = [spread([21, 37, 21, 21], 2.6), { route: ["e4", "e2", "k2"], kind: "heavy", rate: 1 }];
  s7.entities.card = share("Writes per shard", "# one giant account always hashes to the same shard", [21, 37, 21, 21], 1);

  // 8 — salting
  const s8 = clone(s7);
  delete s8.entities.card;
  Object.assign(s8.entities.s2, { heat: 0, cpu: 0.64, tags: hashTag(1) });
  s8.entities.corp.tags = [tag("split into 8 sub-keys", "green", "split")];
  s8.links.e4.label = "brightmart#0 … #7";
  s8.flows = [spread([1, 1, 1, 1], 2.6), { route: ["e4", "e2", K], kind: "heavy", rate: 1 }];
  s8.entities.card = panel("Salt the hot key", "split", [
    "brightmart → brightmart#0 … brightmart#7",
    "suffix chosen per write, so they hash apart",
    "= the hot account spreads over every shard",
    "! reading its balance now gathers 8 sub-keys",
  ]);

  // 9 — resharding
  const s9 = clone(s8);
  delete s9.entities.card;
  delete s9.entities.corp;
  delete s9.links.e4;
  const parts = (a, b) => [tag(`partitions ${a}–${b}`, "paper", "layers")];
  COLS.forEach((id, i) => {
    s9.entities[id].tags = parts(i * 16, i * 16 + 7);
    s9.entities[id].cpu = 0.58;
  });
  const NEW = ["s5", "s6", "s7", "s8"];
  NEW.forEach((id, i) => {
    s9.entities[id] = db(P(...shardPos2[i]).x, P(...shardPos2[i]).y, `shard ${i + 5}`, [...parts(i * 16 + 8, i * 16 + 15), tag("new", "green")], { cpu: 0.5 });
    s9.links[`m${i + 1}`] = L(COLS[i], id, i === 0 ? "copy 8 partitions" : null, { style: "dashed" });
  });
  s9.links.e1.label = "×2 traffic next year";
  s9.flows = [
    spread([1, 1, 1, 1], 2.6),
    { routes: ["m1", "m2", "m3", "m4"].map((m) => ({ path: [m] })), fanout: true, kind: "heavy", rate: 0.7 },
  ];
  s9.entities.card = panel("Move partitions, not rows", "boxes", [
    "64 fixed partitions: partition = hash(key) % 64",
    "a map says which shard holds each partition",
    "= adding shards moves whole partitions; keys stay put",
    "! hash % N with a new N would move ~half of all rows",
    "# copy, catch up on new writes, flip the map",
  ]);

  // 10 — recap
  const s10 = clone(s9);
  delete s10.entities.card;
  NEW.forEach((id, i) => {
    delete s10.links[`m${i + 1}`];
    s10.links[`k${i + 5}`] = { from: "rt", to: id, pts: ["rt", at(19, 0), at(19, shardPos2[i][1]), id], heads: "end" };
    s10.entities[id].tags = parts(i * 16 + 8, i * 16 + 15);
  });
  COLS.forEach((id) => (s10.entities[id].cpu = 0.55));
  s10.flows = [{ route: ["e1", "e2", [...K, "k5", "k6", "k7", "k8"]], kind: "write", rate: 3.2 }];
  s10.entities.card = panel("Sharding checklist", "listChecks", [
    "shard when one leader can't take the writes or data",
    "range: easy scans, hot edges · hash: even, no scans",
    "key = high cardinality + in your hottest queries",
    "! cross-shard queries and transactions get expensive",
    "= plan resharding from day one",
  ]);

  write({
    id: "split-the-pile",
    title: "Split the Pile",
    summary: "Stampwise's loyalty receipts outgrew the biggest database server money can buy. Split the data across shards — and learn why the shard key decides everything: hot shards, scatter-gather queries and resharding.",
    minutes: 13,
    level: "intermediate",
    metrics: ["shards", "perShard", "hottest", "size"],
    legend: ["write", "req", "res", "slow", ["heavy", "hot key / bulk copy"], ["ping", "range lookup"], "fail"],
    goals: [
      { text: "Explain why replicas don't scale writes, and sharding does", step: 0 },
      { text: "Compare range and hash partitioning", step: 1 },
      { text: "See the cost of queries that span shards", step: 4 },
      { text: "Choose a shard key and handle a hot key", step: 5 },
      { text: "Reshard by moving partitions instead of rehashing rows", step: 8 },
    ],
    steps: [
      {
        short: "Too big",
        chapter: "setup",
        title: "One leader, too many writes",
        body: [
          "<b>Stampwise</b> runs loyalty cards for supermarkets: every till sale writes a receipt and updates points. Peak load is <b>48,000 writes a second</b>, and the table is 6 TB and growing.",
          "Read replicas don't help here — every write must still land on the one leader. The biggest machine available handles about 15,000 writes a second. Requests start timing out.",
        ],
        metrics: { shards: 1, perShard: 48000, hottest: 100, size: "6 TB" },
        scene: s1,
        lab: lab(U, 48000, [["users", "users", "Shoppers"], ["app", "api_server", "Receipts API"], ["big", "postgres", "receipts", "6 TB", "crit"]], [["users", "app"], ["app", "big"]]),
      },
      {
        short: "By range",
        chapter: "solution",
        title: "Split the rows: range partitioning",
        body: [
          "<span class=\"term\">Sharding</span> (horizontal partitioning) splits one table's rows across several independent databases. Each shard holds a subset and takes only that subset's writes. A <span class=\"term\">shard key</span> decides where a row lives, and a router sends each query to the right shard.",
          "The first idea: shard by <code>created_at</code>, one quarter of the year per shard. Each shard owns a contiguous <em>range</em>, so “receipts from March” touches a single shard.",
        ],
        changes: ["- One big database", "+ Shard router", "+ 4 shards, one per quarter"],
        metrics: { shards: 4, perShard: "?", hottest: "?", size: "1.5 TB" },
        scene: s2,
        lab: labShards(4),
      },
      {
        short: "Hot shard",
        chapter: "problem",
        title: "Every new receipt hits the same shard",
        body: [
          "It's November. Every new receipt has today's date, so <b>100%</b> of writes go to the Oct–Dec shard while the other three sit idle. Four databases, the throughput of one.",
          "This is a <span class=\"term\">hot shard</span>. Range keys that grow over time — dates, auto-increment ids — always concentrate new writes at the edge of the key space.",
        ],
        callout: { kind: "warn", text: "A shard key is good only if traffic, not just data, spreads evenly across its values." },
        changes: ["~ Shard 4 takes all writes and overloads", "~ Shards 1–3 idle"],
        metrics: { shards: 4, perShard: 48000, hottest: 100, size: "1.5 TB" },
        scene: s3,
        lab: labShards(4, [undefined, undefined, undefined, "crit"]),
      },
      {
        short: "By hash",
        chapter: "solution",
        title: "Hash partitioning spreads the load",
        body: [
          "Instead, shard by <code>hash(customer_id) % 4</code>. A good hash scatters similar ids far apart, so each shard gets roughly a quarter of customers — and a quarter of writes.",
          "Each shard now takes about <b>12,000 writes a second</b>, comfortably below its limit, and all receipts of one customer live together on one shard: showing someone's points is a single-shard query.",
        ],
        changes: ["~ Shard key: hash(customer_id)", "~ Writes evenly spread"],
        metrics: { shards: 4, perShard: 12000, hottest: 26, size: "1.5 TB" },
        scene: s4,
        lab: labShards(4),
      },
      {
        short: "Cross-shard",
        chapter: "tradeoff",
        title: "Queries without the key ask everyone",
        body: [
          "A store dashboard wants “today's receipts for store 77”. Those receipts belong to thousands of customers, hashed onto every shard. The router must <span class=\"term\">scatter-gather</span>: query all four shards and merge the results.",
          "That's four times the work, and the answer waits for the slowest shard. Range scans over the hash key are gone too. Transactions that touch two customers on different shards need a distributed protocol — slow and complex.",
        ],
        callout: { kind: "tip", text: "For important queries that don't include the shard key, keep a second copy of the data organised by the other key (e.g. a per-store table fed by events)." },
        changes: ["+ Store dashboard querying by store", "~ Router fans out to all shards"],
        metrics: { shards: 4, perShard: 12000, hottest: 26, size: "1.5 TB" },
        scene: s5,
        lab: labShards(4),
      },
      {
        short: "Shard key",
        chapter: "insight",
        title: "The shard key is the big decision",
        body: [
          "A good shard key has <b>many distinct values</b> (so data can be split finely), <b>even traffic</b> across those values, and appears in <b>your most frequent queries</b> (so they stay on one shard).",
          "<code>customer_id</code> wins for Stampwise: millions of customers, each a small slice of traffic, and the hottest screens are per customer. Changing the key later means moving every row — choose deliberately.",
        ],
        metrics: { shards: 4, perShard: 12000, hottest: 26, size: "1.5 TB" },
        scene: s6,
        lab: labShards(4),
      },
      {
        short: "Hot key",
        chapter: "problem",
        title: "One customer bigger than a shard's share",
        body: [
          "Brightmart signs up and gives every employee discounts through a single staff account. That one <code>customer_id</code> produces <b>16% of all writes</b> — and a key always hashes to the same shard.",
          "Shard 2 now carries 37% of the load. Hashing spreads <em>keys</em> evenly; it can't split a single <span class=\"term\">hot key</span>.",
        ],
        changes: ["+ Brightmart staff account", "~ Shard 2 hot"],
        metrics: { shards: 4, perShard: 17800, hottest: 37, size: "1.5 TB" },
        scene: s7,
        lab: labShards(4, [undefined, "warn"]),
      },
      {
        short: "Salting",
        chapter: "solution",
        title: "Split the hot key",
        body: [
          "For known hot keys, append a small random suffix — <code>brightmart#0</code> … <code>brightmart#7</code> — so its writes hash onto different shards. This is called <span class=\"term\">salting</span> the key.",
          "Writes even out again. The cost moves to reads: Brightmart's balance must sum eight sub-keys. Apply it only to the few keys that need it.",
        ],
        changes: ["~ Brightmart key split into 8 sub-keys", "~ Shard 2 back to normal"],
        metrics: { shards: 4, perShard: 12000, hottest: 26, size: "1.5 TB" },
        scene: s8,
        lab: labShards(4),
      },
      {
        short: "Resharding",
        chapter: "technique",
        title: "Growing from 4 shards to 8",
        body: [
          "Next year's traffic doubles. Changing <code>hash % 4</code> to <code>hash % 8</code> would send about half of all rows to a different shard at once — a huge migration.",
          "Better: hash keys into <b>64 fixed partitions</b> from day one and keep a map of which shard holds which partition. To grow, copy whole partitions to new shards, let them catch up on recent writes, then flip the map. No key ever changes partition.",
        ],
        callout: { kind: "next", text: "The next lesson shows another way to add servers while moving only a small fraction of keys: consistent hashing." },
        changes: ["+ Shards 5–8", "~ Half of each old shard's partitions copied over"],
        metrics: { shards: "4 → 8", perShard: "12,000 → 6,000/s", hottest: 13, size: "1.5 → 0.75 TB" },
        scene: s9,
        lab: labShards(8),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Sharding in one breath",
        body: [
          "<ul class=\"takeaways\"><li>Shard when a single leader can't take the <b>writes</b> or hold the <b>data</b>.</li><li><b>Range</b> partitioning keeps scans cheap but can create hot edges; <b>hash</b> spreads load but scatters ranges.</li><li>The <b>shard key</b> should have many values, even traffic, and appear in hot queries. Salt the rare hot key.</li><li>Cross-shard queries and transactions are expensive. Reshard by moving <b>partitions</b>, not rehashing rows.</li></ul>",
        ],
        metrics: { shards: 8, perShard: 12000, hottest: 13, size: "1.5 TB" },
        scene: s10,
        lab: labShards(8),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 6. the-ring — Tilewise (map-tile cache fleet) learns consistent hashing
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 3000000;
  const KEYS = Array.from({ length: 24 }, (_, i) => 7 + i * 15);
  const owner = (k, nodes) => {
    const s = [...nodes].sort((a, b) => a.a - b.a);
    let o = s[s.length - 1];
    for (const n of s) if (n.a <= k) o = n;
    return o.color;
  };
  const movedKeys = (before, after) => KEYS.filter((k) => owner(k, before) !== owner(k, after));
  const ringAt = P(-26, 26);
  const ring = (nodes, extra = {}) => ({ type: "ring", x: ringAt.x, y: ringAt.y, r: 12, nodes, keys: KEYS, label: "hash ring", ...extra });

  const CACHE = { blue: "c1", green: "c2", orange: "c3", purple: "c4" };
  const cachePos = { c1: [8, -30], c2: [8, -12], c3: [8, 6], c4: [8, 24] };
  const cache = (id, color, label, extra = {}) => ({ type: "block", ...P(...cachePos[id]), s: 3.8, h: 30, color, glyph: "zap", label: [label], ...OK, ...extra });
  const head = () => ({
    users: crowdAt(-44, -16, "Map viewers", 8),
    api: api(P(-24, -16).x, P(-24, -16).y, ["Tile", "API"]),
    origin: db(P(26, -3).x, P(26, -3).y, "tile renderer", [tag("slow: 120 ms", "paper", "hourglass")], { cpu: 0.3 }),
  });
  const caches3 = () => ({ c1: cache("c1", "blue", "cache A"), c2: cache("c2", "green", "cache B"), c3: cache("c3", "orange", "cache C") });
  const linkC = (ids) => Object.fromEntries(ids.map((id) => [`a${id}`, L("api", id)]));
  const missL = (ids) => Object.fromEntries(ids.map((id) => [`m${id}`, L(id, "origin", null, { style: "dashed" })]));
  const baseLinks = (ids) => ({ e1: L("users", "api", "GET tile"), ...linkC(ids), ...missL(ids) });
  const traffic = (ids, missRate = 0.2, rate = 2.6) => [
    { route: ["e1", ids.map((id) => `a${id}`)], bounce: true, rate },
    { routes: ids.map((id) => ({ path: [`a${id}`, `m${id}`] })), kind: "slow", bounce: true, rate: rate * missRate },
  ];
  const labC = (n, originSt) =>
    lab(U, 60000, [
      ["users", "users", "Map viewers"],
      ["api", "api_server", "Tile API"],
      ...["c1", "c2", "c3", "c4"].slice(0, n).map((id, i) => [id, "redis", `cache ${"ABCD"[i]}`]),
      ["origin", "postgres", "Tile renderer", null, originSt],
    ], [["users", "api"], ...["c1", "c2", "c3", "c4"].slice(0, n).flatMap((id) => [["api", id], [id, "origin"]])]);

  const N3 = [{ a: 20, color: "blue", mark: true }, { a: 150, color: "green", mark: true }, { a: 330, color: "orange", mark: true }];
  const N4 = [...N3, { a: 240, color: "purple", mark: true }];
  const V = [
    [10, "blue"], [55, "orange"], [95, "green"], [118, "purple"], [160, "orange"], [185, "purple"],
    [212, "blue"], [250, "green"], [280, "blue"], [302, "purple"], [325, "green"], [345, "orange"],
  ].map(([a, color]) => ({ a, color, mark: true }));
  const VnoGreen = V.filter((n) => n.color !== "green");
  const pct = (n) => `${Math.round((n / KEYS.length) * 100)}% of keys`;

  // 1 — modulo works
  const s1 = { entities: { ...head(), ...caches3() }, links: baseLinks(["c1", "c2", "c3"]), flows: traffic(["c1", "c2", "c3"], 0.08) };
  s1.entities.card = panel("Which cache holds a tile?", "hash", [
    "cache = hash(tile_id) % 3",
    "hash(\"z14/9301/5772\") = 2,718,281  →  % 3 = 2  →  cache C",
    "= every API node computes the same answer",
    "= no lookup table, keys spread evenly",
  ]);

  // 2 — add a 4th server → % 4
  const s2 = { entities: { ...head(), ...caches3(), c4: cache("c4", "purple", "cache D", { tags: [tag("new", "green")] }) }, links: baseLinks(["c1", "c2", "c3", "c4"]), flows: traffic(["c1", "c2", "c3", "c4"], 0.75, 2.6) };
  for (const id of ["c1", "c2", "c3"]) s2.entities[id].tags = [tag("miss", "red")];
  Object.assign(s2.entities.origin, CRIT, { tags: [tag("4× load", "red", "flame")] });
  s2.links.e1.label = "% 3 → % 4";
  s2.entities.card = panel("hash % 3  vs  hash % 4", "alert", [
    "hash 2,718,281:  % 3 = 2 (C)   % 4 = 1 (B)   moved",
    "hash 1,000,004:  % 3 = 2 (C)   % 4 = 0 (A)   moved",
    "hash   614,124:  % 3 = 0 (A)   % 4 = 0 (A)   stays",
    "! a key stays only if both remainders match",
    "! ≈ 1 in 4 stay → 75% of keys move at once",
  ]);

  // 3 — the ring
  const s3 = { entities: { ...head(), ...caches3(), ring: ring(N3) }, links: baseLinks(["c1", "c2", "c3"]), flows: traffic(["c1", "c2", "c3"], 0.08) };
  s3.entities.card = panel("Put servers and keys on a circle", "replay", [
    "hash space 0 … 2³² − 1, bent into a ring",
    "each server hashed to a point (◆)",
    "each key hashed to a point (●)",
    "= a key belongs to the server whose stretch it lands in",
    "# arc colour = owning server",
  ]);

  // 4 — add D on the ring
  const mv4 = movedKeys(N3, N4);
  const s4 = {
    entities: { ...head(), ...caches3(), c4: cache("c4", "purple", "cache D", { tags: [tag("new", "green")] }), ring: ring(N4, { moved: mv4 }) },
    links: baseLinks(["c1", "c2", "c3", "c4"]),
    flows: traffic(["c1", "c2", "c3", "c4"], 0.25),
  };
  s4.entities.c2.tags = [tag("gave keys to D", "violet")];
  s4.entities.origin.cpu = 0.55;
  s4.entities.card = panel("Adding cache D", "check", [
    "D lands in the middle of B's stretch",
    "only keys in that slice change owner (circled)",
    `= ${mv4.length} of ${KEYS.length} keys moved; A and C untouched`,
    "# on average a new server takes ~1/N of the keys",
  ]);

  // 5 — uneven
  const s5 = clone(s4);
  delete s5.entities.ring.moved;
  s5.entities.ring.moved = [];
  s5.entities.c2.tags = [];
  s5.entities.c4.tags = [];
  s5.entities.c1.tags = [tag("36% of keys", "red", "flame")];
  Object.assign(s5.entities.c1, WARN);
  s5.entities.c3.tags = [tag("14% of keys", "gray")];
  s5.entities.origin.cpu = 0.3;
  s5.flows = [
    { route: ["e1", ["ac1", "ac2", "ac3", "ac4"]], pick: "weights", weights: [36, 25, 14, 25], bounce: true, rate: 2.8 },
    { routes: ["c1", "c2", "c3", "c4"].map((id) => ({ path: [`a${id}`, `m${id}`] })), kind: "slow", bounce: true, rate: 0.25 },
  ];
  s5.entities.card = bars("Share of the ring", "gauge", ["# one random point per server → lumpy stretches"], [
    { label: "cache A", note: "36%", to: 0.36, tone: "red", bold: true },
    { label: "cache B", note: "25%", to: 0.25, tone: "green" },
    { label: "cache D", note: "25%", to: 0.25, tone: "green" },
    { label: "cache C", note: "14%", to: 0.14, tone: "gray" },
  ]);

  // 6 — virtual nodes
  const s6 = { entities: { ...head(), ...caches3(), c4: cache("c4", "purple", "cache D"), ring: ring(V) }, links: baseLinks(["c1", "c2", "c3", "c4"]), flows: traffic(["c1", "c2", "c3", "c4"], 0.08) };
  s6.entities.card = bars("Share with 128 virtual nodes each", "gauge", ["# ring shows 3 per server; real setups use 100–256"], [
    { label: "cache A", note: "26%", to: 0.26, tone: "green" },
    { label: "cache B", note: "25%", to: 0.25, tone: "green" },
    { label: "cache C", note: "25%", to: 0.25, tone: "green" },
    { label: "cache D", note: "24%", to: 0.24, tone: "green" },
  ]);

  // 7 — B dies
  const mv7 = movedKeys(V, VnoGreen);
  const s7 = clone(s6);
  delete s7.entities.card;
  s7.entities.ring = ring(VnoGreen, { moved: mv7 });
  Object.assign(s7.entities.c2, DOWN);
  s7.links.ac2.style = "off";
  s7.links.mc2.style = "off";
  for (const id of ["c1", "c3", "c4"]) s7.entities[id].tags = [tag("+⅓ of B's keys", "violet")];
  s7.entities.origin.cpu = 0.5;
  s7.flows = traffic(["c1", "c3", "c4"], 0.25);
  s7.entities.card = panel("Cache B fails", "alert", [
    "B's points vanish from the ring",
    "each of its stretches falls to the next server along",
    `= ${mv7.length} of ${KEYS.length} keys moved — only B's`,
    "= spread over A, C and D, not dumped on one neighbour",
  ]);

  // 8 — replicas along the ring
  const s8 = clone(s6);
  s8.entities.c1.tags = [tag("primary", "violet")];
  s8.entities.c3.tags = [tag("replica", "paper", "replay")];
  s8.entities.c4.tags = [tag("replica", "paper", "replay")];
  s8.links.r13 = { from: "c1", to: "c3", pts: ["c1", at(18, -30), at(18, 6), "c3"], style: "dashed", label: "copy" };
  s8.links.r14 = { from: "c1", to: "c4", pts: ["c1", at(18, -30), at(18, 24), "c4"], style: "dashed" };
  s8.flows = [...traffic(["c1", "c2", "c3", "c4"], 0.08), { routes: [{ path: ["r13"] }, { path: ["r14"] }], fanout: true, kind: "write", rate: 0.6 }];
  s8.entities.card = panel("Beyond caches", "layers", [
    "replicas: keep a key on its owner plus the next",
    "2 distinct servers along the ring",
    "used by distributed key-value and wide-column stores,",
    "client-side cache sharding, and some load balancers",
    "# weight a bigger server by giving it more virtual nodes",
  ]);

  const s9 = clone(s6);
  s9.entities.card = panel("Consistent hashing", "listChecks", [
    "! hash % N: changing N moves almost every key",
    "ring: a new server takes only its slice, ~1/N",
    "virtual nodes even out shares and failures",
    "= any client computes the owner — no central lookup",
  ]);

  write({
    id: "the-ring",
    title: "The Ring",
    summary: "Tilewise caches map tiles on three servers. Adding a fourth with hash % N would wipe out three quarters of the cache. Consistent hashing puts servers and keys on a ring so only a small slice moves.",
    minutes: 11,
    level: "intermediate",
    metrics: ["nodes", "moved", "maxShare", "hitRate"],
    legend: ["req", "res", ["slow", "cache miss → renderer"], ["write", "replica copy"]],
    goals: [
      { text: "See why hash % N reshuffles almost every key when N changes", step: 1 },
      { text: "Place servers and keys on a hash ring and find a key's owner", step: 2 },
      { text: "Show that adding or removing a server moves only ~1/N of keys", step: 3 },
      { text: "Use virtual nodes to balance load", step: 5 },
    ],
    steps: [
      {
        short: "Modulo",
        chapter: "setup",
        title: "Three caches and a simple rule",
        body: [
          "<b>Tilewise</b> serves map tiles. Rendering a tile takes ~120 ms, so rendered tiles are kept in a fleet of cache servers; <b>92%</b> of requests are hits.",
          "To pick a cache, every API node computes <code>hash(tile_id) % 3</code>. Same tile, same answer, on every node — no lookup table needed, and tiles spread evenly.",
        ],
        metrics: { nodes: 3, moved: "—", maxShare: 34, hitRate: 92 },
        scene: s1,
        lab: labC(3),
      },
      {
        short: "Add one",
        chapter: "problem",
        title: "Adding a server reshuffles everything",
        body: [
          "Traffic grows, so the team adds <code>cache D</code> and switches to <code>% 4</code>. A tile keeps its server only if its hash leaves the same remainder for 3 and for 4 — true for about <b>1 in 4</b> tiles.",
          "So ~75% of tiles are suddenly looked up on a server that doesn't have them. The hit rate collapses from 92% to about 25%, and the renderer is hit with four times its usual load.",
        ],
        callout: { kind: "warn", text: "The same happens when a server <em>dies</em>: N drops by one and almost every key moves. A single failure becomes a fleet-wide cache flush." },
        changes: ["+ cache D", "~ Rule: hash % 3 → hash % 4", "~ Renderer overloaded by misses"],
        metrics: { nodes: 4, moved: "75% of keys", maxShare: 25, hitRate: 25 },
        scene: s2,
        lab: labC(4, "crit"),
      },
      {
        short: "The ring",
        chapter: "solution",
        title: "Bend the hash space into a ring",
        body: [
          "<span class=\"term\">Consistent hashing</span> hashes <em>servers</em> as well as keys into the same range (say 0 to 2³²−1) and bends that range into a circle, so the largest value sits next to 0.",
          "Each server owns the stretch of ring between its point and the next server's point. To find a tile, hash it to a point and see whose stretch it falls in. The rule involves no N at all.",
        ],
        changes: ["+ Hash ring with servers A, B, C", "- Rule hash % N"],
        metrics: { nodes: 3, moved: "—", maxShare: 50, hitRate: 92 },
        scene: s3,
        lab: labC(3),
      },
      {
        short: "Add D",
        chapter: "solution",
        title: "A new server takes one slice",
        body: [
          "Now add cache D. It hashes to a point inside B's stretch and takes over just the part between its point and the next server. Every other key keeps its owner.",
          `In the picture, ${mv4.length} of ${KEYS.length} keys move (${pct(mv4.length)}). In general a new server takes about <b>1/N</b> of the keys — the minimum possible, since it has to hold its share of something. The hit rate dips to ~70% and refills quickly.`,
        ],
        changes: ["+ cache D on the ring", "~ Keys in B's old slice now belong to D"],
        metrics: { nodes: 4, moved: pct(mv4.length), maxShare: 36, hitRate: 70 },
        scene: s4,
        lab: labC(4, "warn"),
      },
      {
        short: "Lumpy",
        chapter: "problem",
        title: "Random points make lumpy shares",
        body: [
          "With one point per server, stretch sizes are left to chance. Here cache A owns 36% of the ring and cache C only 14% — A runs hot while C idles.",
          "Failures are lumpy too: when a server dies, its whole stretch lands on a single neighbour, which may then tip over as well.",
        ],
        changes: ["~ cache A overloaded", "~ cache C underused"],
        metrics: { nodes: 4, moved: "—", maxShare: 36, hitRate: 92 },
        scene: s5,
        lab: labC(4),
      },
      {
        short: "Virtual nodes",
        chapter: "technique",
        title: "Many small points per server",
        body: [
          "Give each server many points on the ring — <span class=\"term\">virtual nodes</span> — by hashing <code>\"cache-A#1\"</code>, <code>\"cache-A#2\"</code>, and so on. Each server now owns many small stretches scattered around the circle.",
          "With 100–256 virtual nodes each, shares average out to within a few percent. A more powerful server can simply get more virtual nodes.",
        ],
        changes: ["~ Each server placed at several points on the ring"],
        metrics: { nodes: 4, moved: "—", maxShare: 26, hitRate: 92 },
        scene: s6,
        lab: labC(4),
      },
      {
        short: "One dies",
        chapter: "insight",
        title: "Losing a server moves only its keys",
        body: [
          "Cache B crashes. Its points leave the ring and each of its small stretches falls to whichever server comes next — sometimes A, sometimes C, sometimes D.",
          `Only B's keys move (${mv7.length} of ${KEYS.length} here), and the extra load is shared by all survivors instead of crushing one neighbour.`,
        ],
        changes: ["~ cache B down", "~ B's keys spread over A, C and D"],
        metrics: { nodes: 3, moved: pct(mv7.length), maxShare: 34, hitRate: 70 },
        scene: s7,
        lab: labC(4, "warn"),
      },
      {
        short: "Uses",
        chapter: "tradeoff",
        title: "Where the ring shows up",
        body: [
          "Distributed databases use the same ring to place data: a key lives on its owner and is replicated to the next few <em>distinct</em> servers along the ring, so a failure already has copies nearby.",
          "The trade-offs: every client must share the same server list and hash function, and a single very hot key still lands on one server — the ring balances keys, not traffic per key.",
        ],
        callout: { kind: "tip", text: "Many systems use fixed hash partitions plus a lookup map instead (as in the previous lesson). Both aim at the same goal: grow without moving everything." },
        changes: ["+ Replicas on the next servers along the ring"],
        metrics: { nodes: 4, moved: "—", maxShare: 26, hitRate: 92 },
        scene: s8,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Consistent hashing in one breath",
        body: [
          "<ul class=\"takeaways\"><li><code>hash % N</code> is simple but moves almost every key when N changes.</li><li>On a <b>hash ring</b>, servers and keys share one circle; a key belongs to the stretch it lands in.</li><li>Adding or removing a server moves only <b>~1/N</b> of the keys.</li><li><b>Virtual nodes</b> balance shares and spread a failed server's load across all survivors.</li></ul>",
        ],
        metrics: { nodes: 4, moved: "—", maxShare: 26, hitRate: 92 },
        scene: s9,
        lab: labC(4),
      },
    ],
  });
}
