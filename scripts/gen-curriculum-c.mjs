// Generates curriculum part "c": Module 06 (Data & Storage), last five lessons.
// Original content. Usage: node scripts/gen-curriculum-c.mjs [lessonsDir]. Overwrites only these lesson JSONs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? new URL("../src/content/lessons/", import.meta.url).pathname;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── entity presets ──────────────────────────────────────────────────────────
const OK = { cpu: 0.3 };
const WARN = { heat: 0.35, cpu: 0.78 };
const CRIT = { heat: 1, cpu: 0.97 };
const DOWN = { tags: [{ text: "DOWN", tone: "red", icon: "alert" }], dead: 1, heat: 0, cpu: -1 };
const tag = (text, tone, icon) => ({ text, ...(tone ? { tone } : {}), ...(icon ? { icon } : {}) });
const tags = (list) => list.map((t) => (typeof t === "string" ? { text: t } : t));
const crowd = (cx, cy, label, count = 10) => ({ type: "crowd", x0: cx - 4, x1: cx + 4, y0: cy - 3, y1: cy + 3, count, label });
const lb = (x, y, extra = {}) => ({ type: "block", x, y, s: 3.4, h: 30, color: "green", glyph: "balancer", label: ["Load", "Balancer"], ...extra });
const api = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 3.6, color: "blue", glyph: "server", label, ...OK, ...extra });
const block = (x, y, color, glyph, label, extra = {}) => ({ type: "block", x, y, s: 3.6, color, glyph, label, ...extra });
const db = (x, y, label, tagList, extra = {}) => ({ type: "db", x, y, label, ...(tagList ? { tags: tags(tagList) } : {}), ...OK, ...extra });
const device = (x, y, label, form, extra = {}) => ({ type: "device", x, y, w: 5, d: 5, label, ...(form ? { form } : {}), ...extra });
const zone = (x0, x1, y0, y1, label) => ({ type: "zone", x0, x1, y0, y1, label });
const panel = (title, icon, lines, extra = {}) => ({ type: "panel", title, icon, lines, ...extra });
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
    if (s.short.length > 14) throw new Error(`${lesson.id}: short "${s.short}" > 14`);
    for (const k of lesson.metrics) if (!(k in s.metrics)) throw new Error(`${lesson.id}/${s.short}: missing ${k}`);
  }
  writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
}

// ════════════════════════════════════════════════════════════════════════════
// 1. a-name-for-everything — unique ids at scale (Loopline, parcel tracking)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 3000;
  const base = () => ({
    users: crowd(0, -27, "Shops & couriers", 10),
    lb: lb(0, -17),
    apiA: api(-8, -6, ["API"], { sub: "server A" }),
    apiB: api(8, -6, ["API"], { sub: "server B" }),
  });
  const shards = (tA = ["BIGINT ids"], tB = ["BIGINT ids"], extra = {}) => ({
    sA: db(-8, 8, "Shard A", tA, extra),
    sB: db(8, 8, "Shard B", tB, extra),
  });
  const links = (a, b) => ({
    u: L("users", "lb", "POST /parcels"),
    la: L("lb", "apiA"),
    lb2: L("lb", "apiB"),
    wa: L("apiA", a, "INSERT"),
    wb: L("apiB", b, "INSERT"),
  });
  const writes = (rate = 2.4, extra = {}) => ({
    routes: [{ path: ["u", "la", "wa"] }, { path: ["u", "lb2", "wb"] }],
    kind: "write",
    bounce: true,
    rate,
    ...extra,
  });
  const labN = (extra = [], st = {}) => [
    ["users", "users", "Shops & couriers"],
    ["lb", "load_balancer", "Load Balancer"],
    ["api", "api_server", "API", "2 servers"],
    ["sA", "postgres", "Shard A", undefined, st.db],
    ["sB", "postgres", "Shard B", undefined, st.db],
    ...extra,
  ];
  const labE = [["users", "lb"], ["lb", "api"], ["api", "sA"], ["api", "sB"]];

  // s1 — one database, one counter
  const s1 = {
    entities: { ...base(), db: db(0, 8, "Postgres", ["id BIGSERIAL", tag("next id 4,180,221", "violet", "hash")]) },
    links: links("db", "db"),
    flows: [writes(2)],
  };

  // s2 — two shards, two counters, duplicates
  const s2 = {
    entities: {
      ...base(),
      ...shards([tag("next id 9,014", "violet", "hash"), tag("dup!", "red", "alert")], [tag("next id 9,014", "violet", "hash"), tag("dup!", "red", "alert")]),
      card: panel("Same number, two parcels", "alert", [
        "Shard A → **#9,014** · florist, Leeds",
        "Shard B → **#9,014** · bike shop, Porto",
        "! one tracking number, two parcels",
      ]),
    },
    links: links("sA", "sB"),
    flows: [writes(2.6)],
  };

  // s3 — central counter: unique, but a bottleneck + SPOF
  const s3 = { entities: { ...base(), ...shards() }, links: links("sA", "sB"), flows: [] };
  s3.entities.ctr = block(0, -6, "orange", "hash", ["Id", "counter"], { s: 3.2, h: 34, ...CRIT, tags: [tag("every insert", "red", "flame")] });
  Object.assign(s3.entities.apiA, WARN);
  Object.assign(s3.entities.apiB, WARN);
  s3.links.ca = L("apiA", "ctr", "next id?", { fail: 0.2 });
  s3.links.cb = L("apiB", "ctr", "next id?", { fail: 0.2 });
  s3.flows = [
    { routes: [{ path: ["u", "la", "ca"] }, { path: ["u", "lb2", "cb"] }], kind: "slow", bounce: true, rate: 2.6 },
    { routes: [{ path: ["wa"] }, { path: ["wb"] }], kind: "write", bounce: true, rate: 1 },
  ];

  // s4 — UUIDv4: no coordination
  const s4 = { entities: { ...base(), ...shards(["UUID keys"], ["UUID keys"]) }, links: links("sA", "sB"), flows: [writes(3)] };
  s4.entities.apiA.tags = [tag("uuid4()", "green", "sparkles")];
  s4.entities.apiB.tags = [tag("uuid4()", "green", "sparkles")];
  s4.entities.card = panel("122 random bits", "sparkles", [
    "2¹²² ≈ 5 × 10³⁶ possible ids",
    "1 year at 30,000 / s ≈ 10¹² ids",
    "= chance of any repeat ≈ 1 in 10¹³",
  ]);

  // s5 — random keys scatter B-tree inserts
  const s5 = clone(s4);
  Object.assign(s5.entities.sA, WARN, { tags: tags(["UUID keys", tag("page splits", "amber", "layers")]) });
  Object.assign(s5.entities.sB, WARN, { tags: tags(["UUID keys", tag("page splits", "amber", "layers")]) });
  s5.flows = [writes(3, { pattern: ["write", "write", "slow"] })];
  s5.entities.card = panel(
    "Where new rows land in the index",
    "layers",
    ["# the key's B-tree, from smallest to largest id"],
    {
      chart: "bars",
      bars: [
        { label: "Counter ids", note: "always the right edge", from: 0.9, to: 1, tone: "green" },
        { label: "Random UUIDs", note: "any page, any time", from: 0, to: 1, tone: "red", bold: true },
      ],
    },
  );

  // s6 — ticket server leasing ranges
  const s6 = { entities: { ...base(), ...shards() }, links: links("sA", "sB"), flows: [] };
  s6.entities.tick = block(0, -6, "yellow", "ticket", ["Ticket", "server"], { s: 3.2, h: 34, ...OK, tags: [tag("odd / even pair", "gray", "layers")] });
  s6.entities.apiA.tags = [tag("9,001–10,000", "violet", "hash")];
  s6.entities.apiB.tags = [tag("10,001–11,000", "violet", "hash")];
  s6.links.ta = L("apiA", "tick", "lease 1,000", { style: "dashed" });
  s6.links.tb = L("apiB", "tick", "lease 1,000", { style: "dashed" });
  s6.flows = [writes(3), { routes: [{ path: ["ta"] }, { path: ["tb"] }], kind: "ping", bounce: true, rate: 0.35 }];

  // s7 — Snowflake-style: time + worker + sequence
  const s7 = { entities: { ...base(), ...shards() }, links: links("sA", "sB"), flows: [writes(3)] };
  s7.entities.apiA.tags = [tag("worker 17", "violet", "idCard")];
  s7.entities.apiB.tags = [tag("worker 18", "violet", "idCard")];
  s7.entities.card = panel("64-bit id layout", "hash", ["# each bar is its share of the 64 bits"], {
    chart: "bars",
    bars: [
      { label: "sign", note: "1 bit", from: 0, to: 0.02, tone: "gray" },
      { label: "timestamp", note: "41 bits · ~69 years of ms", from: 0.02, to: 0.66, tone: "violet", bold: true },
      { label: "worker id", note: "10 bits · 1,024 workers", from: 0.66, to: 0.81, tone: "blue" },
      { label: "sequence", note: "12 bits · 4,096 per ms", from: 0.81, to: 1, tone: "green" },
    ],
  });

  // s8 — sortable ids: appends again
  const s8 = clone(s7);
  s8.entities.sA.tags = tags(["BIGINT ids", tag("appends at end", "green", "check")]);
  s8.entities.sB.tags = tags(["BIGINT ids", tag("appends at end", "green", "check")]);
  s8.entities.card = panel("Reading an id", "clock", [
    "id = (ms << 22) | (worker << 12) | seq",
    "bigger id ⇒ created later",
    "= creation time = id >> 22 (+ epoch)",
  ]);

  // s9 — clock steps backwards
  const s9 = clone(s8);
  delete s9.entities.card;
  Object.assign(s9.entities.apiB, WARN, { tags: [tag("worker 18", "violet", "idCard"), tag("clock −4 ms", "amber", "clock")] });
  s9.links.wb.label = "waits 4 ms";
  s9.links.wb.labelTone = "amber";
  s9.flows = [
    {
      routes: [
        { path: ["u", "la", "wa"], kind: "write" },
        { path: ["u", "lb2", "wb"], kind: "slow" },
      ],
      bounce: true,
      rate: 2.6,
    },
  ];

  // s10 — recap: healthy Snowflake setup
  const s10 = clone(s8);
  delete s10.entities.card;

  const labS = lab(U, 30000, labN(), labE);

  write({
    id: "a-name-for-everything",
    title: "A Name for Everything",
    summary: "Loopline tracks millions of parcels across sharded databases. Every one of them needs an id that no other parcel will ever get.",
    minutes: 12,
    level: "intermediate",
    metrics: ["wps", "collide", "idSize", "sortable", "idDep"],
    legend: [["write", "insert"], "res", ["slow", "waiting for an id"], ["ping", "range lease"], "fail"],
    goals: [
      { text: "See why per-database counters collide once you shard", step: 1 },
      { text: "Weigh a central counter against random UUIDs", step: 2 },
      { text: "Lease id ranges from a ticket server", step: 5 },
      { text: "Build time-sortable ids from time, worker and sequence", step: 6 },
      { text: "Guard a generator against clocks that jump back", step: 8 },
    ],
    steps: [
      {
        short: "One counter",
        chapter: "setup",
        title: "Every parcel needs a number",
        body: [
          "<b>Loopline</b> tracks parcels for 3,000 local shops. Every label printed and every parcel registered creates a row, and every row needs an <span class=\"term\">id</span> that no other row will ever have.",
          "Today that's easy. The parcels table has an <code>id BIGSERIAL</code> column and the single Postgres database hands out 1, 2, 3… Because only one machine is counting, two rows can never receive the same number.",
        ],
        metrics: { wps: "2,000", collide: "no", idSize: "8 bytes", sortable: "yes", idDep: "one DB" },
        scene: s1,
        lab: lab(U, 2000, [["users", "users", "Shops & couriers"], ["lb", "load_balancer", "Load Balancer"], ["api", "api_server", "API", "2 servers"], ["db", "postgres", "Postgres"]], [["users", "lb"], ["lb", "api"], ["api", "db"]]),
      },
      {
        short: "Two counters",
        chapter: "problem",
        title: "Two databases, two counters",
        body: [
          "Write traffic outgrew one machine, so the parcels table was split across two <span class=\"term\">shards</span>. Each shard kept its own <code>BIGSERIAL</code> — and each counter is counting on its own.",
          "So shard A gives parcel <b>#9,014</b> to a florist in Leeds, and shard B gives <b>#9,014</b> to a bike shop in Porto a second later. A courier scans the label and the tracking page has two candidates.",
        ],
        callout: { kind: "warn", text: "An auto-increment counter is only unique inside the one database that owns it." },
        changes: ["- Single Postgres", "+ Shard A and shard B, each with its own counter"],
        metrics: { wps: "12,000", collide: "yes", idSize: "8 bytes", sortable: "per shard", idDep: "own shard" },
        scene: s2,
        lab: lab(U, 12000, labN(), labE),
      },
      {
        short: "One sequence",
        chapter: "problem",
        title: "Ask one central counter?",
        body: [
          "The obvious fix: keep a single <span class=\"term\">sequence</span> in one place and have every insert ask it for the next number first. Ids are unique again — but every write now pays an extra round trip to the same box.",
          "That box is a <b>bottleneck</b> and a <b>single point of failure</b>. At peak it caps the whole system at what one machine can count, and when it restarts nobody anywhere can register a parcel.",
        ],
        changes: ["+ Central id counter", "~ Every insert waits for a number first"],
        metrics: { wps: "7k of 30k", collide: "no", idSize: "8 bytes", sortable: "yes", idDep: "every insert" },
        scene: s3,
        lab: lab(U, 30000, labN([["ctr", "redis", "Id counter", "every insert", "crit"]], { db: undefined }), [...labE, ["api", "ctr"]]),
      },
      {
        short: "UUIDv4",
        chapter: "technique",
        title: "Pick a number nobody else will pick",
        body: [
          "A <span class=\"term\">UUIDv4</span> skips coordination entirely: the server fills 122 bits with randomness and that's the id. No counter, no round trip, no shared state — any server, any shard, even a phone that's offline can mint one.",
          "Duplicates are possible in principle and irrelevant in practice: with 2¹²² possible values, Loopline could mint ids at full speed for a year and the chance of a single repeat would be around one in ten trillion.",
        ],
        callout: { kind: "tip", text: "A UUID is 16 bytes — twice a BIGINT — and it's copied into every index and foreign key that references the row." },
        changes: ["- Central id counter", "~ Each API server generates ids locally"],
        metrics: { wps: "30,000", collide: "no", idSize: "16 bytes", sortable: "no", idDep: "nothing" },
        scene: s4,
        lab: labS,
      },
      {
        short: "Index pain",
        chapter: "tradeoff",
        title: "Random keys, scattered writes",
        body: [
          "The database keeps the primary key in a <span class=\"term\">B-tree</span> sorted by id. Counter ids always land at the right-hand edge, so the same few pages stay hot in memory. Random UUIDs land on <em>any</em> page: inserts touch cold pages, split full ones, and push each other out of the cache.",
          "Once the index is much bigger than RAM, insert throughput sags. And the ids are useless for ordering — <code>ORDER BY id</code> returns parcels in random order, so you need a separate timestamp index too.",
        ],
        callout: { kind: "warn", text: "Random primary keys hurt most exactly when the table is far bigger than memory." },
        changes: ["~ Shard indexes: inserts scattered across all pages"],
        metrics: { wps: "22k of 30k", collide: "no", idSize: "16 bytes", sortable: "no", idDep: "nothing" },
        scene: s5,
        lab: lab(U, 30000, labN([], { db: "warn" }), labE),
      },
      {
        short: "Ticket ranges",
        chapter: "technique",
        title: "Hand out ids in batches",
        body: [
          "A middle ground keeps compact 64-bit numbers without asking on every insert. A <span class=\"term\">ticket server</span> leases each API server a whole <b>range</b> — say 9,001 to 10,000 — and the server spends it from memory, asking again only when it runs out.",
          "One call per thousand inserts takes the counter off the hot path. Run two ticket servers, one leasing odd-numbered ranges and one even, so either can restart without stopping registrations.",
        ],
        callout: { kind: "tip", text: "Ranges leave gaps: if a server crashes holding 9,001–10,000, the unused numbers are simply skipped. Ids must be unique, never gapless." },
        changes: ["+ Ticket server leasing ranges of 1,000", "~ API servers spend their range from memory"],
        metrics: { wps: "30,000", collide: "no", idSize: "8 bytes", sortable: "roughly", idDep: "ticket server" },
        scene: s6,
        lab: lab(U, 30000, labN([["tick", "mysql", "Ticket server", "leases ranges"]]), [...labE, ["api", "tick"]]),
      },
      {
        short: "Time + worker",
        chapter: "technique",
        title: "Time, machine, sequence",
        body: [
          "A <span class=\"term\">Snowflake-style id</span> packs three things into one 64-bit number: the <b>milliseconds</b> since a chosen epoch, a <b>worker id</b> unique to each generator, and a <b>sequence</b> that counts ids within the current millisecond.",
          "Each server builds ids from its own clock and its own worker number — no network call at all. Two servers can't collide because their worker ids differ; one server can't repeat itself because its sequence only resets when the millisecond changes.",
        ],
        changes: ["- Ticket server", "~ Each API server gets a worker id and builds ids locally"],
        metrics: { wps: "30,000", collide: "no", idSize: "8 bytes", sortable: "yes", idDep: "local clock" },
        scene: s7,
        lab: labS,
      },
      {
        short: "Sortable",
        chapter: "insight",
        title: "Ids that sort by time",
        body: [
          "Because the timestamp sits in the high bits, newer ids are bigger numbers. <code>ORDER BY id DESC</code> now means newest first, inserts append at the right edge of the B-tree again, and you can read a parcel's creation time straight out of its id.",
          "The 128-bit world borrowed the same trick: <span class=\"term\">UUIDv7</span> and ULID put a millisecond timestamp in front of random bits, so you keep coordination-free generation <em>and</em> index-friendly ordering.",
        ],
        callout: { kind: "insight", text: "A good id scheme is unique without coordination and roughly ordered by time. You rarely have to give up either." },
        changes: ["~ Shard indexes: inserts append at the end again"],
        metrics: { wps: "30,000", collide: "no", idSize: "8 bytes", sortable: "yes", idDep: "local clock" },
        scene: s8,
        lab: labS,
      },
      {
        short: "Clock skew",
        chapter: "tradeoff",
        title: "When the clock jumps back",
        body: [
          "Time-based ids trust the clock. If a time sync steps worker 18's clock <b>back by 4 ms</b>, it re-enters milliseconds it already used and could mint ids it already handed out.",
          "Generators defend themselves: remember the last timestamp used, and if the clock reads earlier than that, wait until it catches up (or refuse to issue ids). Worker ids need the same care — lease them from a coordination service at startup instead of hard-coding them in config files.",
        ],
        callout: { kind: "warn", text: "Two servers that accidentally share a worker id will produce duplicates silently, at full speed." },
        changes: ["~ Worker 18's clock steps back 4 ms", "~ Its generator pauses until time passes the last id"],
        metrics: { wps: "30,000", collide: "if unsafe", idSize: "8 bytes", sortable: "roughly", idDep: "local clock" },
        scene: s9,
        lab: labS,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Choosing an id scheme",
        body: [
          "<table class=\"compare\"><tbody><tr><th>Scheme</th><th>Size</th><th>Sorted</th><th>Coordination</th></tr><tr><td>Auto-increment</td><td>8 B</td><td>yes</td><td>one DB, every insert</td></tr><tr><td>UUIDv4</td><td>16 B</td><td>no</td><td>none</td></tr><tr><td>Ticket ranges</td><td>8 B</td><td>roughly</td><td>one call per range</td></tr><tr><td>Time + worker + seq</td><td>8 B</td><td>yes</td><td>unique worker ids</td></tr><tr><td>UUIDv7 / ULID</td><td>16 B</td><td>yes</td><td>none</td></tr></tbody></table>",
          "<ul class=\"takeaways\"><li>Per-database counters stop being unique the moment you shard.</li><li>Random ids remove coordination but scatter index writes.</li><li>Time-prefixed ids give uniqueness, ordering and compact indexes — as long as clocks and worker ids are guarded.</li></ul>",
        ],
        metrics: { wps: "30,000", collide: "no", idSize: "8 bytes", sortable: "yes", idDep: "local clock" },
        scene: s10,
        lab: labS,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 2. right-or-reachable — CAP / PACELC / quorums (Tallyho, group wallets)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 1200000;
  const region = () => ({
    zEu: zone(-14, -4, -18, 5, "FRANKFURT"),
    zUs: zone(4, 14, -18, 5, "VIRGINIA"),
    euUsers: crowd(-9, -27, "EU travellers", 8),
    usUsers: crowd(9, -27, "US travellers", 8),
    euApi: api(-9, -13, ["API"], { sub: "Frankfurt" }),
    usApi: api(9, -13, ["API"], { sub: "Virginia" }),
    euDb: db(-9, 0, "EU copy", ["wallet €100"]),
    usDb: db(9, 0, "US copy", ["wallet €100"]),
  });
  const rlinks = (repLabel = "sync replication · 85 ms", repExtra = {}) => ({
    eu1: L("euUsers", "euApi"),
    eu2: L("euApi", "euDb", "write"),
    us1: L("usUsers", "usApi"),
    us2: L("usApi", "usDb", "write"),
    rep: { from: "euDb", to: "usDb", pts: ["euDb", "usDb"], heads: "both", label: repLabel, ...repExtra },
  });
  const labR = (status) =>
    lab(
      U,
      9000,
      [
        ["users", "users", "Travellers"],
        ["api", "api_server", "API", "2 regions"],
        ["eu", "postgres", "EU copy", "primary", status],
        ["us", "postgres", "US copy", "replica", status],
      ],
      [["users", "api"], ["api", "eu"], ["eu", "us"]],
    );

  // s1 — two regions, synchronous replication
  const s1 = { entities: region(), links: rlinks(), flows: [] };
  s1.flows = [
    { route: ["eu1", "eu2", "rep"], kind: "write", bounce: true, rate: 0.9 },
    { route: ["us1", "us2"], kind: "write", bounce: true, rate: 0.9 },
  ];

  // s2 — the partition
  const s2 = { entities: region(), links: rlinks("partition", { style: "cut", fail: 1, labelTone: "red" }), flows: [] };
  Object.assign(s2.entities.euApi, WARN, { tags: [tag("waiting", "amber", "hourglass")] });
  Object.assign(s2.entities.usApi, WARN, { tags: [tag("waiting", "amber", "hourglass")] });
  s2.flows = [
    { route: ["eu1", "eu2", "rep"], kind: "slow", rate: 1 },
    { route: ["us1", "us2"], kind: "slow", bounce: true, hold: 1.6, rate: 0.8 },
  ];
  s2.entities.card = panel("CAP, during a partition", "split", [
    "**C**onsistent: every read sees the latest write",
    "**A**vailable: every request gets a real answer",
    "! with the link down you can't promise both",
  ]);

  // s3 — choose consistency: refuse writes that can't replicate
  const s3 = { entities: region(), links: rlinks("partition", { style: "cut", labelTone: "red" }), flows: [] };
  s3.entities.euApi.tags = [tag("writes: 503", "red", "ban")];
  s3.entities.usApi.tags = [tag("writes: 503", "red", "ban")];
  s3.links.eu2.label = "reads only";
  s3.links.us2.label = "reads only";
  s3.flows = [
    { routes: [{ path: ["eu1", "eu2"] }, { path: ["eu1"], kind: "empty" }], bounce: true, rate: 1.4 },
    { routes: [{ path: ["us1", "us2"] }, { path: ["us1"], kind: "empty" }], bounce: true, rate: 1.4 },
  ];

  // s4 — choose availability: both sides accept writes and diverge
  const s4 = { entities: region(), links: rlinks("partition", { style: "cut", labelTone: "red" }), flows: [] };
  s4.entities.euDb.tags = tags([tag("wallet €40", "amber", "creditCard")]);
  s4.entities.usDb.tags = tags([tag("wallet €30", "amber", "creditCard")]);
  s4.entities.euApi.tags = [tag("accepting writes", "green", "check")];
  s4.entities.usApi.tags = [tag("accepting writes", "green", "check")];
  s4.flows = [
    { route: ["eu1", "eu2"], kind: "write", bounce: true, rate: 1.3 },
    { route: ["us1", "us2"], kind: "write", bounce: true, rate: 1.3 },
  ];

  // s5 — heal: conflicting histories meet
  const s5 = { entities: region(), links: rlinks("exchanging backlog", { labelTone: "amber" }), flows: [] };
  s5.entities.euDb.tags = tags([tag("wallet €40", "red", "alert")]);
  s5.entities.usDb.tags = tags([tag("wallet €30", "red", "alert")]);
  s5.entities.card = panel("Same wallet, two histories", "creditCard", [
    "start: €100",
    "Frankfurt · Ana: dinner −€60 → €40",
    "Virginia · Raj: car hire −€70 → €30",
    "! together −€130 · wallet overdrawn by €30",
    "# last-write-wins would silently drop one expense",
  ]);
  s5.flows = [{ route: ["rep"], kind: "write", bounce: true, rate: 1.2 }];

  // s6 — decide per data type
  const s6 = { entities: region(), links: rlinks("partition", { style: "cut", labelTone: "red" }), flows: [] };
  s6.entities.euDb.tags = tags([tag("wallet → CP", "violet", "lock"), tag("comments → AP", "green", "message")]);
  s6.entities.usDb.tags = tags([tag("wallet home", "violet", "flag"), tag("comments → AP", "green", "message")]);
  s6.entities.euApi.tags = [tag("wallet spend: 503", "amber", "ban")];
  s6.flows = [
    {
      routes: [
        { path: ["eu1", "eu2"], kind: "msg" },
        { path: ["eu1"], kind: "empty" },
      ],
      bounce: true,
      rate: 1.4,
    },
    { routes: [{ path: ["us1", "us2"], kind: "write" }, { path: ["us1", "us2"], kind: "msg" }], bounce: true, rate: 1.4 },
  ];

  // s7 — quorum inside a region
  const quorum = () => ({
    zQ: zone(-10, 5, 2, 18, "VIRGINIA · 3 REPLICAS"),
    users: crowd(0, -26, "Travellers", 10),
    co: api(0, -13, ["Tallyho", "API"], { sub: "coordinator" }),
    r1: db(-7, 5, "Replica 1", [tag("v7", "green")]),
    r2: db(-2, 10, "Replica 2", [tag("v7", "green")]),
    r3: db(3, 15, "Replica 3", [tag("v6 · behind", "amber", "clock")]),
  });
  const qlinks = () => ({
    u: L("users", "co", "comment"),
    c1: L("co", "r1"),
    c2: L("co", "r2"),
    c3: L("co", "r3"),
  });
  const s7 = { entities: quorum(), links: qlinks(), flows: [] };
  s7.links.c1.label = "W";
  s7.links.c2.label = "W + R";
  s7.links.c3.label = "R";
  s7.flows = [
    { fanout: true, routes: [{ path: ["c1"], kind: "write" }, { path: ["c2"], kind: "write" }], bounce: true, rate: 0.7 },
    { fanout: true, routes: [{ path: ["c2"] }, { path: ["c3"] }], bounce: true, rate: 0.7 },
    { route: ["u"], bounce: true, rate: 1.2 },
  ];
  s7.entities.card = panel("Quorum arithmetic", "sigma", [
    "N = 3 copies of every row",
    "W = 2 must confirm each write",
    "R = 2 answer each read",
    "= R + W = 4 > 3 → every read meets the latest write",
  ]);

  // s8 — one replica down; the dials
  const s8 = { entities: quorum(), links: qlinks(), flows: [] };
  Object.assign(s8.entities.r1, DOWN);
  s8.entities.r3.tags = [tag("v7", "green")];
  s8.links.c1 = { ...s8.links.c1, style: "cut", label: "" };
  s8.links.c2.label = "W + R";
  s8.links.c3.label = "W + R";
  s8.flows = [
    { fanout: true, routes: [{ path: ["c2"], kind: "write" }, { path: ["c3"], kind: "write" }], bounce: true, rate: 0.7 },
    { fanout: true, routes: [{ path: ["c2"] }, { path: ["c3"] }], bounce: true, rate: 0.7 },
    { route: ["u"], bounce: true, rate: 1.2 },
  ];
  s8.entities.card = panel("Turning the dials (N = 3)", "settings", [
    "R=1 W=1 · fastest · reads may be stale",
    "R=2 W=2 · overlap · survives 1 replica down",
    "R=1 W=3 · cheap reads · 1 replica down blocks writes",
    "! lose 2 replicas and R=2 / W=2 can't be met",
  ]);

  // s9 — PACELC: async replication for latency
  const s9 = { entities: region(), links: rlinks("async · ~300 ms", { style: "dashed" }), flows: [] };
  s9.entities.euApi.tags = [tag("commit locally", "green", "zap")];
  s9.entities.usApi.tags = [tag("commit locally", "green", "zap")];
  s9.entities.usDb.tags = tags([tag("~300 ms behind", "amber", "clock")]);
  s9.flows = [
    { route: ["eu1", "eu2"], kind: "write", bounce: true, rate: 1.3 },
    { route: ["us1", "us2"], kind: "write", bounce: true, rate: 1.3 },
    { route: ["rep"], kind: "write", rate: 0.8, speed: 0.6 },
  ];
  s9.entities.card = panel("Else: latency or consistency", "timer", ["# p95 of a wallet write, no partition"], {
    chart: "bars",
    bars: [
      { label: "Sync to both regions", note: "190 ms", to: 1, tone: "amber" },
      { label: "Commit locally, ship later", note: "25 ms", to: 0.13, tone: "green", bold: true },
    ],
  });

  // s10 — recap
  const s10 = clone(s6);
  s10.links = rlinks("async · ~300 ms", { style: "dashed" });
  delete s10.entities.euApi.tags;
  s10.flows = [
    { route: ["eu1", "eu2"], kind: "write", bounce: true, rate: 1.2 },
    { route: ["us1", "us2"], kind: "msg", bounce: true, rate: 1.2 },
    { route: ["rep"], kind: "write", rate: 0.7, speed: 0.6 },
  ];

  const labQ = (st) =>
    lab(U, 9000, [["users", "users", "Travellers"], ["co", "api_server", "Tallyho API", "coordinator"], ["cas", "cassandra", "Replicas", "N=3 · R=2 · W=2", st]], [["users", "co"], ["co", "cas"]]);

  write({
    id: "right-or-reachable",
    title: "Right or Reachable",
    summary: "Tallyho keeps group travel wallets in two regions. When the ocean link drops, every request has to pick: the right answer, or an answer at all.",
    minutes: 12,
    level: "intermediate",
    metrics: ["consistent", "available", "conflicts", "lag", "p95"],
    legend: [["write", "write"], "req", "res", ["slow", "stuck write"], ["empty", "refused"], ["msg", "comment"], "fail"],
    goals: [
      { text: "See what a network partition forces you to choose", step: 1 },
      { text: "Compare refusing writes with accepting and diverging", step: 2 },
      { text: "Choose consistency per kind of data", step: 5 },
      { text: "Use quorums (R + W > N) to tune reads and writes", step: 6 },
      { text: "Trade latency for consistency even without failures", step: 8 },
    ],
    steps: [
      {
        short: "Two regions",
        chapter: "setup",
        title: "One wallet, two continents",
        body: [
          "<b>Tallyho</b> runs shared travel wallets: a group tops up €100 and anyone can spend from it. To keep the app fast for everyone, the data lives in <b>Frankfurt</b> and in <b>Virginia</b>.",
          "Every write is copied to the other region before it's confirmed — <span class=\"term\">synchronous replication</span>. Both copies always agree, at the price of an ocean round trip on every write.",
        ],
        metrics: { consistent: "yes", available: "yes", conflicts: 0, lag: "0 s", p95: 190 },
        scene: s1,
        lab: labR(),
      },
      {
        short: "Partition",
        chapter: "problem",
        title: "The ocean link drops",
        body: [
          "A transatlantic route fails. Both regions are healthy and serving users, but they can't talk to each other: a <span class=\"term\">network partition</span>.",
          "Every write now hangs, waiting for a confirmation that will never come. The <span class=\"term\">CAP theorem</span> says this moment is a forced choice: while partitioned, a replicated system can stay <b>consistent</b> or stay <b>available</b> — not both.",
        ],
        callout: { kind: "warn", text: "Partitions aren't optional. Cables get cut and switches fail; the only question is what your system does when it happens." },
        changes: ["~ Frankfurt ↔ Virginia link partitioned", "~ Writes stuck waiting for the other side"],
        metrics: { consistent: "?", available: "?", conflicts: 0, lag: "unknown", p95: null },
        scene: s2,
        lab: labR("warn"),
      },
      {
        short: "Choose C",
        chapter: "tradeoff",
        title: "Option 1: stay correct",
        body: [
          "A <span class=\"term\">CP</span> system refuses what it can't make safe. Writes that can't reach the other region fail fast with an error; reads still work but may be a few minutes old.",
          "Nobody overdraws the wallet — and nobody can pay for dinner either. For the length of the outage, Tallyho is partly down on both continents.",
        ],
        changes: ["~ Both APIs reject writes with 503", "~ Reads still served from the local copy"],
        metrics: { consistent: "yes", available: "no", conflicts: 0, lag: "frozen", p95: 30 },
        scene: s3,
        lab: labR("crit"),
      },
      {
        short: "Choose A",
        chapter: "tradeoff",
        title: "Option 2: stay reachable",
        body: [
          "An <span class=\"term\">AP</span> system keeps accepting writes on both sides and promises to reconcile later. Everything feels normal: payments go through in 25 ms in each region.",
          "But the two copies are now quietly telling different stories. Frankfurt thinks the wallet holds €40, Virginia thinks €30, and each is approving new spending against its own number.",
        ],
        changes: ["~ Both regions accept writes independently", "~ The two copies diverge"],
        metrics: { consistent: "no", available: "yes", conflicts: 0, lag: "growing", p95: 25 },
        scene: s4,
        lab: labR(),
      },
      {
        short: "Heal",
        chapter: "problem",
        title: "The link comes back",
        body: [
          "When the partition heals, each region ships its backlog to the other — and they disagree. Two payments were each approved against €100, together spending €130.",
          "Someone must <span class=\"term\">reconcile</span>. <i>Last-write-wins</i> keeps one version and silently drops the other expense. For money, neither answer is acceptable after the fact.",
        ],
        callout: { kind: "insight", text: "AP doesn't remove conflicts — it postpones them until after the partition, when they're harder to undo." },
        changes: ["~ Link restored, backlogs exchanged", "+ Conflict on the wallet balance"],
        metrics: { consistent: "no", available: "yes", conflicts: 1, lag: "catching up", p95: 25 },
        scene: s5,
        lab: labR("warn"),
      },
      {
        short: "Per data",
        chapter: "insight",
        title: "Choose per kind of data",
        body: [
          "The choice isn't per system, it's per operation. Wallet spending gets a <b>home region</b> (Virginia): during a partition, Frankfurt refuses spending rather than guess. That's CP where it matters.",
          "Comments and reactions are AP: accept them everywhere and merge later. A set of comments merges cleanly — keep everything from both sides — so there's nothing to lose by staying available.",
        ],
        callout: { kind: "tip", text: "Data that merges naturally (sets, counters, append-only logs) is a great fit for AP. Data with invariants (balances, stock, seats) usually isn't." },
        changes: ["~ Wallet writes routed to a single home region", "~ Comments accepted in both regions and merged"],
        metrics: { consistent: "wallet: yes", available: "comments: yes", conflicts: 0, lag: "comments", p95: 30 },
        scene: s6,
        lab: labR(),
      },
      {
        short: "Quorum",
        chapter: "technique",
        title: "Quorums: overlap by arithmetic",
        body: [
          "Inside a region, stores like Cassandra or DynamoDB keep <b>N</b> copies of each row and let you choose how many must answer. A write waits for <b>W</b> replicas; a read asks <b>R</b> replicas and takes the newest version.",
          "If <span class=\"term\">R + W &gt; N</span>, every read set overlaps every write set in at least one replica — so a read always sees the latest confirmed write, even while replica 3 is still catching up.",
        ],
        changes: ["+ Three replicas behind a coordinator", "~ Writes wait for 2, reads ask 2"],
        metrics: { consistent: "yes", available: "yes", conflicts: 0, lag: "1 · 40 ms", p95: 12 },
        scene: s7,
        lab: labQ(),
      },
      {
        short: "Dials",
        chapter: "tradeoff",
        title: "Lose a replica, keep going",
        body: [
          "Replica 1 dies. With R = 2 and W = 2, the remaining two still form a quorum for both reads and writes — nobody notices.",
          "R and W are dials: lower them for speed and availability, raise them for stronger reads. <b>Eventual consistency</b> (R = 1, W = 1) is fastest, but a read may land on a replica that hasn't heard the latest write yet.",
        ],
        changes: ["~ Replica 1 down", "~ Reads and writes use replicas 2 and 3"],
        metrics: { consistent: "yes", available: "yes", conflicts: 0, lag: "0 s", p95: 14 },
        scene: s8,
        lab: labQ("warn"),
      },
      {
        short: "PACELC",
        chapter: "insight",
        title: "Even without failures",
        body: [
          "Partitions are rare; latency is every request. <span class=\"term\">PACELC</span> extends CAP: if <b>P</b>artitioned, choose <b>A</b> or <b>C</b>; <b>E</b>lse, choose <b>L</b>atency or <b>C</b>onsistency.",
          "Comments now commit locally in 25 ms and replicate asynchronously, about 300 ms behind. To hide the lag from the author, read their own data from the region they wrote to — <span class=\"term\">read-your-writes</span>.",
        ],
        changes: ["~ Replication becomes asynchronous", "~ Writes commit in the local region"],
        metrics: { consistent: "eventual", available: "yes", conflicts: 0, lag: "0.3 s", p95: 25 },
        scene: s9,
        lab: labR(),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Right, reachable, or fast",
        body: [
          "<ul class=\"takeaways\"><li>During a partition you choose: refuse (consistent) or accept and reconcile later (available).</li><li>Make the choice per kind of data — money CP, comments AP.</li><li>Quorums with R + W &gt; N give consistent reads while tolerating failed replicas.</li><li>Without failures, the trade is latency versus consistency.</li></ul>",
        ],
        metrics: { consistent: "wallet: yes", available: "comments: yes", conflicts: 0, lag: "0.3 s", p95: 25 },
        scene: s10,
        lab: labR(),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 3. whos-in-charge — consensus & leader election (Ferrylane, ride dispatch)
// ════════════════════════════════════════════════════════════════════════════
{
  const node = (x, y, n, extra = {}) => block(x, y, "purple", "database", [`Node ${n}`], { s: 3.4, h: 38, ...OK, ...extra });
  const LEAD = (t) => [tag("leader", "violet", "flag"), tag(`term ${t}`, "gray", "hash")];
  const FOL = (t) => [tag(`follower · term ${t}`, "gray")];
  const base = () => ({
    riders: crowd(0, -30, "Riders", 10),
    disp: api(0, -19, ["Dispatch", "API"]),
    n1: node(0, -6, 1, { tags: LEAD(1) }),
    n2: node(-11, 9, 2, { tags: FOL(1) }),
    n3: node(11, 9, 3, { tags: FOL(1) }),
  });
  const links = (leader = "n1") => ({
    r: L("riders", "disp", "book ride"),
    w: L("disp", leader, "assign driver"),
    a: L("n1", "n2"),
    b: L("n1", "n3"),
    c: { from: "n2", to: "n3", pts: ["n2", "n3"], heads: "both" },
  });

  // s1 — one leader, two followers
  const s1 = { entities: base(), links: links(), flows: [] };
  s1.links.a.label = "replicate";
  s1.links.b.label = "replicate";
  s1.links.c.style = "off";
  s1.flows = [
    { route: ["r", "w"], kind: "write", bounce: true, rate: 1.4 },
    { fanout: true, routes: [{ path: ["a"], kind: "write" }, { path: ["b"], kind: "write" }], bounce: true, rate: 1 },
  ];

  // s2 — leader dies, nobody takes over
  const s2 = { entities: base(), links: links(), flows: [] };
  Object.assign(s2.entities.n1, DOWN);
  s2.links.w.fail = 1;
  s2.links.a.style = "cut";
  s2.links.b.style = "cut";
  s2.links.c.style = "off";
  s2.entities.n2.tags = [tag("follower · waiting", "amber", "hourglass")];
  s2.entities.n3.tags = [tag("follower · waiting", "amber", "hourglass")];
  s2.flows = [{ route: ["r", "w"], kind: "write", rate: 1.4 }];

  // s3 — naive failover → split brain
  const s3 = { entities: base(), links: links(), flows: [] };
  s3.links.a = { ...s3.links.a, style: "cut", label: "network split" };
  s3.links.b = { ...s3.links.b, style: "cut" };
  s3.links.c.label = "replicate";
  s3.links.w2 = L("disp", "n2", "assign driver");
  s3.entities.n1.tags = [tag("leader", "red", "flag"), tag("term 1", "gray", "hash")];
  s3.entities.n2.tags = [tag("leader (self-promoted)", "red", "flag")];
  Object.assign(s3.entities.n1, WARN);
  Object.assign(s3.entities.n2, WARN);
  s3.flows = [
    { routes: [{ path: ["r", "w"] }, { path: ["r", "w2"] }], kind: "write", bounce: true, rate: 1.8 },
    { route: ["c"], kind: "write", bounce: true, rate: 0.8 },
  ];
  s3.entities.card = panel("Two bosses", "alert", [
    "Node 1: driver 4411 → ride to the airport",
    "Node 2: driver 4411 → ride to the station",
    "! one driver, two pickups",
  ]);

  // s4 — majority vote, new term
  const s4 = { entities: base(), links: links("n2"), flows: [] };
  s4.links.a = { ...s4.links.a, style: "cut", label: "network split" };
  s4.links.b = { ...s4.links.b, style: "cut" };
  s4.links.c.label = "vote for me? (term 2)";
  s4.links.w.style = "off";
  s4.entities.n1.tags = [tag("alone: 1 of 3", "gray", "unplug")];
  Object.assign(s4.entities.n1, { dim: 0.5 });
  s4.entities.n2.tags = [tag("candidate · term 2", "amber", "flag"), tag("votes 2 of 3", "green", "check")];
  s4.entities.n3.tags = [tag("voted Node 2", "green", "check")];
  s4.flows = [{ route: ["c"], kind: "ping", bounce: true, hold: 0.4, rate: 1 }];
  s4.entities.card = panel("Election rules", "flag", [
    "a candidate votes for itself, then asks the rest",
    "each node votes at most once per term",
    "= leader only with a majority: 2 of 3",
    "# Node 1 alone can never win again",
  ]);

  // s5 — heartbeats, randomized timeouts
  const s5 = { entities: base(), links: links("n2"), flows: [] };
  s5.links.a = { from: "n2", to: "n1", pts: ["n2", "n1"], style: "cut", label: "network split" };
  s5.links.b = { from: "n1", to: "n3", pts: ["n1", "n3"], style: "cut" };
  s5.links.c = { from: "n2", to: "n3", pts: ["n2", "n3"], style: "beat", label: "heartbeat · 50 ms" };
  s5.entities.n1.tags = [tag("alone: 1 of 3", "gray", "unplug")];
  Object.assign(s5.entities.n1, { dim: 0.5 });
  s5.entities.n2.tags = LEAD(2);
  s5.entities.n3.tags = FOL(2);
  s5.flows = [
    { route: ["c"], kind: "ping", rate: 1.6 },
    { route: ["r", "w"], kind: "write", bounce: true, rate: 1 },
  ];
  s5.entities.card = panel("Staying in charge", "heartPulse", [
    "leader heartbeat: every 50 ms",
    "follower timeout: random 150–300 ms",
    "# silence past the timeout → start an election",
    "# randomness means one node usually times out first",
  ]);

  // s6 — log replication, commit on majority
  const s6 = { entities: base(), links: links("n2"), flows: [] };
  s6.links.a = { from: "n2", to: "n1", pts: ["n2", "n1"], style: "cut", label: "network split" };
  s6.links.b = { from: "n1", to: "n3", pts: ["n1", "n3"], style: "cut" };
  s6.links.c = { from: "n2", to: "n3", pts: ["n2", "n3"], label: "append #42" };
  s6.entities.n1.tags = [tag("alone: 1 of 3", "gray", "unplug")];
  Object.assign(s6.entities.n1, { dim: 0.5 });
  s6.entities.n2.tags = [...LEAD(2), tag("#42 stored", "green", "check")];
  s6.entities.n3.tags = [tag("follower · term 2", "gray"), tag("#42 stored", "green", "check")];
  s6.flows = [
    { route: ["r", "w", "c"], kind: "write", bounce: true, rate: 1.1 },
  ];
  s6.entities.card = panel("Node 2's log", "listOrdered", [
    "#41 · driver 902 → ride 7731 · committed",
    "#42 · driver 4411 → ride 7740 · 2 of 3 stored",
    "= majority stored → committed → reply to dispatch",
    "# committed entries survive any future election",
  ]);

  // s7 — stale leader rejoins and steps down
  const s7 = { entities: base(), links: links("n2"), flows: [] };
  s7.links.a = { from: "n2", to: "n1", pts: ["n2", "n1"], style: "beat", label: "term 2 heartbeat" };
  s7.links.b = { from: "n1", to: "n3", pts: ["n1", "n3"], style: "off" };
  s7.links.c = { from: "n2", to: "n3", pts: ["n2", "n3"], style: "beat" };
  s7.entities.n1.tags = [tag("follower · term 2", "violet", "undo"), tag("drops #42", "amber", "alert")];
  s7.entities.n2.tags = LEAD(2);
  s7.entities.n3.tags = FOL(2);
  s7.flows = [
    { fanout: true, routes: [{ path: ["a"], kind: "ping" }, { path: ["c"], kind: "ping" }], rate: 1.2 },
    { route: ["a"], kind: "write", rate: 0.6 },
    { route: ["r", "w"], kind: "write", bounce: true, rate: 1 },
  ];

  // s8 — five nodes survive two failures
  const s8 = { entities: base(), links: links("n2"), flows: [] };
  s8.entities.n4 = node(-16, -2, 4, { tags: FOL(3) });
  s8.entities.n5 = node(16, -6, 5, { tags: FOL(3) });
  Object.assign(s8.entities.n1, DOWN);
  Object.assign(s8.entities.n3, DOWN);
  s8.entities.n2.tags = LEAD(3);
  s8.links.a = { from: "n2", to: "n1", pts: ["n2", "n1"], style: "cut" };
  s8.links.b = { from: "n1", to: "n3", pts: ["n1", "n3"], style: "off" };
  s8.links.c = { from: "n2", to: "n3", pts: ["n2", "n3"], style: "cut" };
  s8.links.d = L("n2", "n4", "append");
  s8.links.e = L("n2", "n5", "append");
  s8.flows = [
    { route: ["r", "w"], kind: "write", bounce: true, rate: 1.1 },
    { fanout: true, routes: [{ path: ["d"], kind: "write" }, { path: ["e"], kind: "write" }], bounce: true, rate: 0.9 },
  ];
  s8.entities.card = panel("Cluster size vs. failures", "layers", ["# majority needed → failures tolerated"], {
    chart: "bars",
    bars: [
      { label: "3 nodes", note: "majority 2 · can lose 1", to: 0.33, tone: "green" },
      { label: "4 nodes", note: "majority 3 · can lose 1", to: 0.33, tone: "amber" },
      { label: "5 nodes", note: "majority 3 · can lose 2", to: 0.66, tone: "green", bold: true },
      { label: "6 nodes", note: "majority 4 · can lose 2", to: 0.66, tone: "amber" },
    ],
  });

  // s9 — recap: healthy five-node cluster
  const s9 = clone(s8);
  s9.entities.n1 = node(0, -6, 1, { tags: FOL(3) });
  s9.entities.n3 = node(11, 9, 3, { tags: FOL(3) });
  delete s9.entities.card;
  s9.links.a = { from: "n2", to: "n1", pts: ["n2", "n1"], style: "beat" };
  s9.links.c = { from: "n2", to: "n3", pts: ["n2", "n3"], style: "beat" };
  s9.links.d.label = "";
  s9.links.e.label = "";
  s9.flows = [
    { route: ["r", "w"], kind: "write", bounce: true, rate: 1 },
    { fanout: true, routes: [{ path: ["a"], kind: "ping" }, { path: ["c"], kind: "ping" }, { path: ["d"], kind: "ping" }, { path: ["e"], kind: "ping" }], rate: 0.9 },
  ];

  write({
    id: "whos-in-charge",
    title: "Who's in Charge?",
    summary: "Ferrylane's ride dispatch relies on a three-node store with one leader. When the leader vanishes, the cluster must pick a new one — exactly one.",
    minutes: 13,
    level: "advanced",
    metrics: ["leaders", "term", "canLose", "writes"],
    legend: [["write", "log entry"], "res", ["ping", "vote / heartbeat"], "fail"],
    goals: [
      { text: "See why a single leader needs automatic failover", step: 1 },
      { text: "Recognise split brain and the damage it does", step: 2 },
      { text: "Elect leaders with terms and majority votes", step: 3 },
      { text: "Commit writes only once a majority stores them", step: 5 },
      { text: "Pick cluster sizes: why 3 and 5, not 4", step: 7 },
    ],
    steps: [
      {
        short: "One leader",
        chapter: "setup",
        title: "One node gives the orders",
        body: [
          "<b>Ferrylane</b> matches riders with drivers. Who-drives-whom lives in a small store replicated on three nodes in three data centres, so losing one building doesn't lose the data.",
          "Exactly one node is the <span class=\"term\">leader</span>: it accepts every write and copies it to the two <span class=\"term\">followers</span>. One writer means one order of events — driver 4411 can only be assigned once.",
        ],
        metrics: { leaders: 1, term: 1, canLose: "a follower", writes: "ok" },
        scene: s1,
      },
      {
        short: "Leader down",
        chapter: "problem",
        title: "03:12, the leader dies",
        body: [
          "Node 1's host fails. Nodes 2 and 3 have every assignment, but neither knows whether it's <em>allowed</em> to take over, so they wait.",
          "Every booking fails until someone is paged, confirms Node 1 is really dead, and promotes a follower by hand. Twenty minutes of no rides at the busiest time of the night.",
        ],
        callout: { kind: "warn", text: "Replicas protect the data. They don't, by themselves, keep the system writable." },
        changes: ["~ Node 1 down", "~ Followers wait — no rule says who's next"],
        metrics: { leaders: 0, term: 1, canLose: "nothing", writes: "failing" },
        scene: s2,
      },
      {
        short: "Split brain",
        chapter: "problem",
        title: "Promote whoever notices first?",
        body: [
          "So the team automates it: a follower that stops hearing from the leader promotes itself. Then a flaky switch cuts Node 1 off from the others — without killing it.",
          "Node 2 promotes itself. Node 1 never noticed anything wrong. Now dispatch servers on each side of the split write to a different leader: <span class=\"term\">split brain</span>. Driver 4411 gets sent to two pickups.",
        ],
        callout: { kind: "insight", text: "From the inside, 'the leader is dead' and 'I can't reach the leader' look exactly the same." },
        changes: ["~ Network split isolates Node 1", "~ Node 2 promotes itself", "+ Two leaders accepting writes"],
        metrics: { leaders: 2, term: 1, canLose: "?", writes: "diverging" },
        scene: s3,
      },
      {
        short: "Majority",
        chapter: "technique",
        title: "Win a majority, or wait",
        body: [
          "Consensus protocols like <span class=\"term\">Raft</span> add one rule: you're leader only if a <b>majority</b> of the cluster voted for you. Time is split into numbered <span class=\"term\">terms</span>; a candidate bumps the term, votes for itself and asks the others, and each node votes at most once per term.",
          "Two different majorities of three always share a node, so two leaders can't win the same term. Node 1, alone on its side of the split, can't reach 2 of 3 — it can never win again. Writes pause briefly while the vote happens.",
        ],
        callout: { kind: "tip", text: "Voters also refuse candidates whose log is behind their own, so a new leader always has every committed entry." },
        changes: ["~ Node 2 runs for term 2", "~ Node 3 votes for it → 2 of 3", "~ Node 1 can't gather a majority"],
        metrics: { leaders: 0, term: 2, canLose: "1 node", writes: "paused" },
        scene: s4,
      },
      {
        short: "Heartbeats",
        chapter: "technique",
        title: "Heartbeats and timeouts",
        body: [
          "The new leader proves it's alive by sending <span class=\"term\">heartbeats</span> every 50 ms. A follower that hears nothing for its <b>election timeout</b> assumes the leader is gone and starts an election.",
          "Each follower picks its timeout at random — say between 150 and 300 ms — so one usually wakes up first and wins before anyone else even becomes a candidate. That avoids split votes where nobody reaches a majority.",
        ],
        changes: ["+ Heartbeats from Node 2", "~ Dispatch writes go to Node 2"],
        metrics: { leaders: 1, term: 2, canLose: "1 node", writes: "ok" },
        scene: s5,
      },
      {
        short: "Log commit",
        chapter: "technique",
        title: "Commit means a majority has it",
        body: [
          "Writes become entries in a replicated <span class=\"term\">log</span>. The leader appends entry #42, sends it to the followers, and once a majority (itself plus Node 3) has stored it, the entry is <b>committed</b>: applied to the store and acknowledged to dispatch.",
          "Node 1 is still unreachable and that's fine — a majority is enough. And because any future leader needs votes from that same majority, a committed entry can never be lost.",
        ],
        changes: ["~ Entry #42: leader → Node 3 → committed"],
        metrics: { leaders: 1, term: 2, canLose: "1 node", writes: "ok" },
        scene: s6,
      },
      {
        short: "Stale leader",
        chapter: "insight",
        title: "The old leader comes back",
        body: [
          "The switch recovers. Node 1 still believes it leads term 1, and during the split it even appended a write — which never reached a majority, so it was never committed and its client never got a success.",
          "The first message from Node 2 carries <b>term 2</b>. A higher term always wins: Node 1 steps down, discards its uncommitted entry and copies the leader's log. No human involved, nothing committed lost.",
        ],
        callout: { kind: "insight", text: "Terms act as a logical clock for leadership: any message from an older term is ignored, any newer term forces a step-down." },
        changes: ["~ Network split heals", "~ Node 1 becomes a follower in term 2", "- Node 1's uncommitted entry"],
        metrics: { leaders: 1, term: 2, canLose: "1 node", writes: "ok" },
        scene: s7,
      },
      {
        short: "Odd sizes",
        chapter: "tradeoff",
        title: "Why 3 or 5, never 4",
        body: [
          "Ferrylane grows the cluster to five nodes. A majority is now 3, so it survives <b>two</b> failures — here Nodes 1 and 3 are down and writes still commit.",
          "A fourth node doesn't help: four needs a majority of 3, tolerating only one failure, the same as three nodes, with one more machine to wait on. And every node added makes each write wait on a bigger majority, so consensus groups stay small.",
        ],
        callout: { kind: "tip", text: "Use a consensus store (etcd, ZooKeeper, Consul) for small, critical data — leadership, locks, config — not for bulk traffic." },
        changes: ["+ Nodes 4 and 5", "~ Nodes 1 and 3 down — still a majority of 3"],
        metrics: { leaders: 1, term: 3, canLose: "2 nodes", writes: "ok" },
        scene: s8,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "One leader, by majority",
        body: [
          "<ul class=\"takeaways\"><li>A single leader keeps writes in one order; failover must be automatic.</li><li>Naive failover creates split brain, because 'dead' and 'unreachable' look the same.</li><li>Majority votes and terms guarantee at most one leader per term.</li><li>Writes commit once a majority stores them — so they survive any election.</li><li>Odd sizes: 3 nodes survive 1 failure, 5 survive 2.</li></ul>",
        ],
        metrics: { leaders: 1, term: 3, canLose: "2 nodes", writes: "ok" },
        scene: s9,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 4. one-seat-two-buyers — transactions, isolation, locking (Puddlejump airline)
// ════════════════════════════════════════════════════════════════════════════
{
  const base = (seatTags = [tag("14C: free", "green", "ticket")]) => ({
    maya: device(-7, -18, "Maya", undefined),
    theo: device(7, -18, "Theo", "phone"),
    api: api(0, -6, ["Booking", "API"]),
    db: db(0, 8, "Postgres", seatTags),
  });
  const links = () => ({
    m: L("maya", "api", "book 14C"),
    t: L("theo", "api", "book 14C"),
    q: { from: "api", to: "db", pts: ["api", "db"], heads: "both" },
  });
  const both = (extra = {}, theoExtra = {}) => [
    { route: ["m", "q"], kind: "mine", bounce: true, hold: 0.5, rate: 0.9, ...extra },
    { route: ["t", "q"], bounce: true, hold: 0.5, rate: 0.9, ...extra, ...theoExtra },
  ];
  const labT = (st) => lab(240, 400, [["users", "users", "Travellers"], ["api", "api_server", "Booking API"], ["db", "postgres", "Postgres", "seats", st]], [["users", "api"], ["api", "db"]]);

  // s1 — last seat
  const s1 = { entities: base(), links: links(), flows: [{ route: ["m", "q"], kind: "mine", bounce: true, hold: 0.5, rate: 0.9 }] };
  s1.links.q.label = "SELECT, then UPDATE";

  // s2 — the race
  const s2 = { entities: base(), links: links(), flows: both() };
  s2.links.q.label = "both read 'free'";
  s2.entities.card = panel("Timeline", "clock", [
    ".010 s  Maya  SELECT 14C → free",
    ".012 s  Theo  SELECT 14C → free",
    ".030 s  Maya  UPDATE 14C → Maya",
    ".031 s  Theo  UPDATE 14C → Theo",
    "! both screens say 'Booked!'",
  ]);

  // s3 — lost update
  const s3 = { entities: base([tag("14C: Theo", "red", "ticket"), tag("Maya's write lost", "red", "alert")]), links: links(), flows: [] };
  s3.entities.maya.tags = [tag("charged · no seat", "red", "creditCard")];
  s3.entities.theo.tags = [tag("charged · 14C", "green", "check")];
  s3.links.q.label = "last write wins";
  s3.flows = both();

  // s4 — wrap it in a transaction (still broken at default isolation)
  const s4 = { entities: base([tag("14C: free", "green", "ticket"), tag("READ COMMITTED", "gray", "layers")]), links: links(), flows: both() };
  s4.links.q.label = "BEGIN … COMMIT";
  s4.entities.card = panel("ACID", "lock", [
    "**A**tomic · all of it happens, or none",
    "**C**onsistent · constraints hold after commit",
    "**I**solated · how much concurrent txs see",
    "**D**urable · committed survives a crash",
    "! both txs still read 'free' and both commit",
  ]);

  // s5 — serializable: one aborts and retries
  const s5 = { entities: base([tag("14C: Maya", "violet", "ticket"), tag("SERIALIZABLE", "violet", "layers")]), links: links(), flows: [] };
  s5.links.q.label = "BEGIN ISOLATION SERIALIZABLE";
  s5.entities.theo.tags = [tag("retried → gone", "amber", "refresh")];
  s5.flows = both({}, { kind: "slow", pattern: ["req", "slow"] });
  s5.entities.card = panel("Isolation levels", "layers", [
    "Read uncommitted · may see unfinished writes",
    "Read committed · a common default · lost updates",
    "Repeatable read · stable snapshot · some anomalies",
    "Serializable · as if one at a time",
    "# stronger levels abort conflicts → the app retries",
  ]);

  // s6 — pessimistic row lock
  const s6 = { entities: base([tag("14C locked by Maya", "violet", "lock")]), links: links(), flows: [] };
  s6.entities.wait = { type: "queue", x: 2, y: 3, n: 1, gap: 1.1, dir: [0, -1] };
  s6.links.q.label = "SELECT … FOR UPDATE";
  s6.entities.theo.tags = [tag("waits, then 'taken'", "amber", "hourglass")];
  s6.flows = both({}, { kind: "slow", hold: 1.4 });

  // s7 — optimistic: version check
  const s7 = { entities: base([tag("14C: Maya · v8", "violet", "ticket")]), links: links(), flows: [] };
  s7.links.q.label = "UPDATE … WHERE version = 7";
  s7.entities.theo.tags = [tag("0 rows → 'taken'", "amber", "refresh")];
  s7.flows = both({}, { kind: "empty" });
  s7.entities.card = panel("Optimistic update", "code", [
    "UPDATE seats SET holder = 'Theo', version = 8",
    "WHERE id = '14C' AND version = 7",
    "! 0 rows updated → someone else won",
    "= no lock held while people think",
  ]);

  // s8 — hot rows on sale day
  const s8 = { entities: base([tag("hot rows", "red", "flame")]), links: links(), flows: [] };
  delete s8.entities.maya;
  delete s8.entities.theo;
  s8.entities.crowd = crowd(0, -20, "2,000 shoppers", 14);
  s8.links = {
    c: L("crowd", "api", "book"),
    q: { from: "api", to: "db", pts: ["api", "db"], heads: "both", label: "lock waits / retries" },
  };
  Object.assign(s8.entities.db, CRIT);
  Object.assign(s8.entities.api, WARN);
  s8.entities.wait = { type: "queue", x: 2, y: 3, n: 6, gap: 1.1, dir: [0, -1] };
  s8.flows = [{ route: ["c", "q"], bounce: true, pattern: ["req", "slow", "slow"], hold: 0.6, rate: 2.4 }];
  s8.entities.card = panel("Under contention", "flame", ["# 2,000 buyers chasing 180 seats"], {
    chart: "bars",
    bars: [
      { label: "Row locks", note: "long queues on popular seats", to: 0.85, tone: "amber" },
      { label: "Optimistic", note: "most attempts fail and retry", to: 0.95, tone: "red" },
      { label: "Short hold, pay outside", note: "locks held for ms", to: 0.2, tone: "green", bold: true },
    ],
  });

  // s9 — short transactions: hold with expiry, pay outside the lock
  const s9 = { entities: base([tag("14C held · 10 min", "violet", "clock")]), links: links(), flows: [] };
  delete s9.entities.maya;
  delete s9.entities.theo;
  s9.entities.crowd = crowd(0, -20, "2,000 shoppers", 14);
  s9.entities.pay = block(11, -6, "slab", "creditCard", ["Payment", "provider"], { s: 3.4, h: 34 });
  s9.links = {
    c: L("crowd", "api", "book"),
    q: { from: "api", to: "db", pts: ["api", "db"], heads: "both", label: "hold seat · 3 ms" },
    p: L("api", "pay", "charge · no lock held", { style: "dashed" }),
  };
  s9.entities.wait = { type: "queue", x: 2, y: 3, n: 0, gap: 1.1, dir: [0, -1] };
  s9.flows = [
    { route: ["c", "q"], bounce: true, rate: 2.2 },
    { route: ["p"], kind: "slow", bounce: true, hold: 0.8, rate: 0.7 },
  ];

  // s10 — recap
  const s10 = clone(s7);
  delete s10.entities.card;
  s10.entities.theo.tags = [tag("'14C taken — try 15A?'", "gray", "info")];

  write({
    id: "one-seat-two-buyers",
    title: "One Seat, Two Buyers",
    summary: "Puddlejump has one seat left on its Friday flight. Two travellers tap 'Book' in the same instant — and the code checks before it writes.",
    minutes: 12,
    level: "intermediate",
    metrics: ["seatsLeft", "sold", "oversold", "tx", "p95"],
    legend: [["mine", "Maya’s request"], ["req", "Theo’s request"], "res", ["slow", "waiting / retry"], ["empty", "lost the race"]],
    goals: [
      { text: "Spot the check-then-write race behind double booking", step: 1 },
      { text: "Learn what ACID and isolation levels do (and don't) guarantee", step: 3 },
      { text: "Lock a row with SELECT … FOR UPDATE", step: 5 },
      { text: "Use optimistic concurrency with a version check", step: 6 },
      { text: "Keep transactions short when everyone wants the same row", step: 8 },
    ],
    steps: [
      {
        short: "Last seat",
        chapter: "setup",
        title: "One seat left",
        body: [
          "<b>Puddlejump</b> flies small planes between islands. Friday's 18:40 departure has exactly one seat left: <b>14C</b>.",
          "Booking is a two-step dance: the API runs <code>SELECT holder FROM seats WHERE id = '14C'</code>, and if it's empty, <code>UPDATE seats SET holder = …</code>. With one buyer at a time, that works perfectly.",
        ],
        metrics: { seatsLeft: 1, sold: 0, oversold: "no", tx: "no", p95: 120 },
        scene: s1,
        lab: labT(),
      },
      {
        short: "Race",
        chapter: "problem",
        title: "Two taps, same instant",
        body: [
          "Maya on her laptop and Theo on his phone tap <b>Book</b> within a few milliseconds of each other. Both SELECTs run before either UPDATE — so both see the seat as free.",
          "That gap between <em>checking</em> and <em>writing</em> is a <span class=\"term\">race condition</span>. Every request is correct on its own; the interleaving is what's wrong.",
        ],
        changes: ["+ Theo books 14C at the same moment"],
        metrics: { seatsLeft: 1, sold: 0, oversold: "no", tx: "no", p95: 120 },
        scene: s2,
        lab: labT(),
      },
      {
        short: "Lost update",
        chapter: "problem",
        title: "Both charged, one seat",
        body: [
          "Theo's UPDATE lands a millisecond after Maya's and simply overwrites it. Her write wasn't rejected; it was erased — a <span class=\"term\">lost update</span>.",
          "Both cards were charged and both got a confirmation email. Maya finds out at the gate. The same bug inflates stock counters, double-spends credits and books the same slot twice.",
        ],
        callout: { kind: "warn", text: "Read, decide in application code, write back: if two requests can interleave, they eventually will." },
        changes: ["~ 14C holder: Maya → Theo", "~ Maya charged without a seat"],
        metrics: { seatsLeft: 0, sold: 2, oversold: "yes", tx: "no", p95: 120 },
        scene: s3,
        lab: labT("warn"),
      },
      {
        short: "ACID",
        chapter: "technique",
        title: "Wrap it in a transaction?",
        body: [
          "A <span class=\"term\">transaction</span> groups statements into one unit with <b>ACID</b> guarantees: all or nothing, constraints respected, isolated from others, durable once committed.",
          "But <span class=\"term\">isolation</span> has levels. At <i>read committed</i> — the default in Postgres and many other databases — each statement sees whatever was committed when it started. Both transactions still read 'free', and both commit.",
        ],
        callout: { kind: "warn", text: "BEGIN … COMMIT makes the steps atomic. It doesn't, on its own, stop two transactions from making the same decision." },
        changes: ["~ SELECT + UPDATE now inside one transaction"],
        metrics: { seatsLeft: 0, sold: 2, oversold: "yes", tx: "yes", p95: 125 },
        scene: s4,
        lab: labT("warn"),
      },
      {
        short: "Isolation",
        chapter: "technique",
        title: "Turn isolation up",
        body: [
          "At <span class=\"term\">serializable</span>, the database guarantees the result is as if transactions ran one after another. When it detects that Maya's and Theo's can't be ordered that way, it aborts one with a serialization error.",
          "Theo's transaction is retried from the top: this time the SELECT sees Maya as the holder, and Theo is told the seat is gone. Correct — at the cost of aborted work and retry logic in every caller.",
        ],
        changes: ["~ Isolation level: read committed → serializable", "+ Retry on serialization failure"],
        metrics: { seatsLeft: 0, sold: 1, oversold: "no", tx: "yes", p95: 180 },
        scene: s5,
        lab: labT(),
      },
      {
        short: "Row lock",
        chapter: "technique",
        title: "Lock the row you'll change",
        body: [
          "A more targeted fix: read the seat with <code>SELECT … FOR UPDATE</code>. This takes a <span class=\"term\">row lock</span> on 14C until the transaction ends — <span class=\"term\">pessimistic locking</span>.",
          "Theo's identical query now <em>waits</em> for Maya's transaction. When she commits, his query returns 'held by Maya' and he's shown the next best seat. Only buyers of 14C queue; the rest of the plane is unaffected.",
        ],
        changes: ["~ SELECT → SELECT … FOR UPDATE", "+ Theo waits for Maya's lock"],
        metrics: { seatsLeft: 0, sold: 1, oversold: "no", tx: "yes", p95: 140 },
        scene: s6,
        lab: labT(),
      },
      {
        short: "Optimistic",
        chapter: "technique",
        title: "Don't lock — check on write",
        body: [
          "<span class=\"term\">Optimistic concurrency</span> takes no lock at all. Each row carries a <code>version</code>; the update only applies if the version is still the one you read. If the database reports <b>0 rows updated</b>, someone got there first.",
          "The simplest form needs no version column: <code>UPDATE seats SET holder = 'Theo' WHERE id = '14C' AND holder IS NULL</code> — the check and the write become one atomic statement.",
        ],
        changes: ["- Row lock", "+ Version column checked on every update"],
        metrics: { seatsLeft: 0, sold: 1, oversold: "no", tx: "yes", p95: 95 },
        scene: s7,
        lab: labT(),
      },
      {
        short: "Hot rows",
        chapter: "tradeoff",
        title: "When everyone wants the same seats",
        body: [
          "Holiday sale: 2,000 shoppers chase 180 seats. With row locks, buyers of popular seats queue behind each other; with optimistic checks, most attempts fail and retry, burning work.",
          "The worst pattern holds a lock while calling a slow payment provider — every lock is held for seconds instead of milliseconds, and p95 explodes.",
        ],
        callout: { kind: "tip", text: "Low contention → optimistic is cheap. High contention on a few rows → lock (or queue) them, and keep each transaction tiny." },
        changes: ["~ 2,000 concurrent shoppers", "~ Database hot on a few rows"],
        metrics: { seatsLeft: 37, sold: 143, oversold: "no", tx: "yes", p95: 900 },
        scene: s8,
        lab: lab(2000, 1800, [["users", "users", "Shoppers"], ["api", "api_server", "Booking API", undefined, "warn"], ["db", "postgres", "Postgres", "hot rows", "crit"]], [["users", "api"], ["api", "db"]]),
      },
      {
        short: "Short tx",
        chapter: "solution",
        title: "Hold fast, pay later",
        body: [
          "Split the work. A tiny transaction marks the seat <b>held</b> with an expiry (<code>held_until = now() + 10 min</code>) and commits in milliseconds. Payment happens <em>outside</em> any transaction.",
          "When payment succeeds, a second short transaction confirms the booking; if it fails or the timer runs out, the hold expires and the seat goes back on sale. Locks are held for milliseconds again.",
        ],
        changes: ["+ Seat holds with a 10-minute expiry", "~ Payment moved outside the transaction"],
        metrics: { seatsLeft: 37, sold: 143, oversold: "no", tx: "yes", p95: 210 },
        scene: s9,
        lab: lab(2000, 1800, [["users", "users", "Shoppers"], ["api", "api_server", "Booking API"], ["db", "postgres", "Postgres", "short holds"]], [["users", "api"], ["api", "db"]]),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "One seat, one buyer",
        body: [
          "<ul class=\"takeaways\"><li>Check-then-write in application code is a race; two requests will interleave.</li><li>Transactions give atomicity, but the default isolation level may still allow lost updates.</li><li>Serializable, row locks (<code>FOR UPDATE</code>) and optimistic version checks each make the decision safe.</li><li>Keep transactions short: never hold a lock while waiting on something slow.</li></ul>",
        ],
        metrics: { seatsLeft: 0, sold: 1, oversold: "no", tx: "yes", p95: 95 },
        scene: s10,
        lab: labT(),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 5. where-photos-live — object storage, pre-signed uploads, async, CDN (Crumbly)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 2000000;
  const base = () => ({
    users: crowd(0, -28, "Home cooks", 10),
    api: api(0, -15, ["API"], { sub: "6 servers" }),
    db: db(0, -1, "Postgres", ["recipes"]),
  });
  const bucket = (extra = {}) => block(11, -8, "store", "package", ["Object", "storage"], { s: 4, ...extra });
  const L0 = () => ({
    u: L("users", "api", "POST photo · 4 MB"),
    d: L("api", "db", "INSERT bytes"),
  });
  const labBase = (extra = [], extraE = [], st = {}) =>
    lab(
      U,
      6000,
      [["users", "users", "Home cooks"], ["api", "api_server", "API", "6 servers", st.api], ["db", "postgres", "Postgres", st.dbSub ?? "recipes", st.db], ...extra],
      [["users", "api"], ["api", "db"], ...extraE],
    );

  // s1 — photos as BLOBs
  const s1 = { entities: base(), links: L0(), flows: [] };
  s1.entities.db.tags = tags(["recipes + photo bytes"]);
  s1.flows = [
    { route: ["u", "d"], kind: "heavy", bounce: true, rate: 0.9 },
    { route: ["u", "d"], bounce: true, rate: 1.2 },
  ];

  // s2 — the database bloats
  const s2 = clone(s1);
  Object.assign(s2.entities.db, CRIT, { tags: tags([tag("18 TB · backup 9 h", "red", "database")]) });
  s2.flows = [
    { route: ["u", "d"], kind: "heavy", bounce: true, rate: 0.9 },
    { route: ["u", "d"], kind: "slow", bounce: true, rate: 1.2 },
  ];
  s2.entities.card = panel("What 18 TB of photos costs", "database", [
    "backups: 9 hours, every night",
    "new replica: 2 days to copy",
    "RAM cache full of image pages",
    "! recipe queries now miss memory",
  ]);

  // s3 — app servers become pipes
  const s3 = clone(s2);
  delete s3.entities.card;
  Object.assign(s3.entities.api, CRIT, { tags: [tag("threads busy uploading", "red", "hourglass")] });
  s3.links.u.fail = 0.25;
  s3.flows = [
    { route: ["u", "d"], kind: "heavy", bounce: true, hold: 1.2, rate: 1.1 },
    { route: ["u", "d"], kind: "slow", bounce: true, rate: 1 },
  ];
  s3.entities.card = panel("Time on an API thread", "timer", ["# per request"], {
    chart: "bars",
    bars: [
      { label: "Recipe JSON", note: "20 ms", to: 0.03, tone: "green" },
      { label: "Photo over mobile", note: "8 s + resize", to: 1, tone: "red", bold: true },
    ],
  });

  // s4 — object storage for the bytes, metadata in the DB
  const s4 = { entities: { ...base(), obj: bucket() }, links: L0(), flows: [] };
  s4.entities.db.tags = tags(["recipes", tag("photo rows: key + size", "violet", "listOrdered")]);
  s4.entities.api.tags = [tag("still relaying bytes", "amber", "hourglass")];
  Object.assign(s4.entities.api, WARN);
  s4.links.u.label = "POST photo · 4 MB";
  s4.links.d.label = "INSERT metadata";
  s4.links.o = L("api", "obj", "PUT bytes");
  s4.flows = [
    { route: ["u", "o"], kind: "heavy", bounce: true, rate: 0.9 },
    { route: ["d"], kind: "write", bounce: true, rate: 0.9 },
  ];
  s4.entities.card = panel("photos table", "listOrdered", [
    "id · recipe_id · owner_id",
    "key = photos/2026/11/8f3c….jpg",
    "bytes · content_type · status",
    "= a few hundred bytes per photo",
  ]);

  // s5 — pre-signed direct uploads
  const s5 = { entities: { ...base(), obj: bucket() }, links: L0(), flows: [] };
  s5.entities.db.tags = tags(["recipes", tag("status: pending", "amber", "clock")]);
  s5.links.u.label = "ask for upload URL";
  s5.links.d.label = "INSERT pending row";
  s5.links.up = { from: "users", to: "obj", pts: ["users", [11, "users"], "obj"], label: "PUT · signed URL · 10 min" };
  s5.flows = [
    { route: ["u", "d"], bounce: true, rate: 1 },
    { route: ["up"], kind: "heavy", bounce: true, rate: 0.9 },
  ];

  // s6 — async processing: event → queue → workers
  const s6 = { entities: { ...base(), obj: bucket() }, links: L0(), flows: [] };
  s6.entities.q = block(11, 4, "green", "inbox", ["Queue"], { s: 3.2, h: 34 });
  s6.entities.wk = block(11, 14, "purple", "cpu", ["Image", "workers"], { s: 3.2, ...OK });
  s6.entities.db.tags = tags(["recipes", tag("status: ready", "green", "check")]);
  s6.links.u.label = "ask for upload URL";
  s6.links.d.label = "INSERT pending row";
  s6.links.up = { from: "users", to: "obj", pts: ["users", [11, "users"], "obj"], label: "PUT · signed URL" };
  s6.links.ev = L("obj", "q", "object created");
  s6.links.wq = L("q", "wk", "job");
  s6.links.wo = { from: "wk", to: "obj", pts: ["wk", [17, "wk"], [17, "obj"], "obj"], label: "thumbnails" };
  s6.links.wd = { from: "wk", to: "db", pts: ["wk", ["db", "wk"], "db"], label: "status = ready" };
  s6.flows = [
    { route: ["u", "d"], bounce: true, rate: 0.8 },
    { route: ["up"], kind: "heavy", bounce: true, rate: 0.7 },
    { route: ["ev", "wq"], kind: "msg", rate: 0.7 },
    { routes: [{ path: ["wo"], kind: "write" }, { path: ["wd"], kind: "write" }], rate: 0.9 },
  ];

  // s7 — CDN delivery
  const s7 = clone(s6);
  s7.entities.cdn = block(22, -20, "yellow", "globe", ["CDN"], { tags: [tag("95% hits", "green", "zap")] });
  s7.links.cv = L("users", "cdn", "GET photo");
  s7.links.co = { ...L("cdn", "obj", "miss only"), style: "dashed" };
  s7.links.up = L("users", "obj", "PUT · signed URL");
  s7.flows = [
    { routes: [{ path: ["cv"], weight: 19 }, { path: ["cv", "co"], kind: "slow", weight: 1 }], pick: "weights", bounce: true, rate: 2.4 },
    { route: ["u", "d"], bounce: true, rate: 0.6 },
    { route: ["up"], kind: "heavy", bounce: true, rate: 0.5 },
    { route: ["ev", "wq"], kind: "msg", rate: 0.5 },
  ];

  // s8 — gotchas: orphans, limits, privacy, storage tiers
  const s8 = clone(s7);
  s8.entities.obj.tags = [tag("lifecycle rules", "violet", "clock")];
  s8.entities.card = panel("Before you ship it", "listChecks", [
    "signed URL: 10 min, ≤ 15 MB, image/* only",
    "pending > 24 h → delete the orphan",
    "originals > 90 days → cheaper storage tier",
    "private photos → short-lived signed links",
    "! never trust the client's file type — check it",
  ]);

  // s9 — recap
  const s9 = clone(s7);
  s9.entities.obj.tags = [tag("lifecycle rules", "violet", "clock")];

  const labFull = (cdn) =>
    labBase(
      [["q", "sqs", "Queue", "object created"], ["wk", "worker", "Image workers", "thumbnails"], ...(cdn ? [["cdn", "cdn", "CDN", "95% hits"]] : [])],
      [["api", "q"], ["q", "wk"], ["wk", "db"], ...(cdn ? [["users", "cdn"]] : [])],
    );

  write({
    id: "where-photos-live",
    title: "Where Photos Live",
    summary: "Crumbly's recipe photos are stored inside the database and streamed through the API. Moving the bytes out changes cost, speed and reliability at once.",
    minutes: 11,
    level: "beginner",
    metrics: ["dbGrowth", "appTraffic", "respond", "imgLoad", "storeCost"],
    legend: ["req", "res", ["heavy", "photo bytes"], ["write", "metadata / variant"], ["msg", "upload event"], ["slow", "slow / CDN miss"], "fail"],
    goals: [
      { text: "See why big files don't belong in the database", step: 1 },
      { text: "Store bytes in object storage, metadata in the DB", step: 3 },
      { text: "Upload straight to storage with pre-signed URLs", step: 4 },
      { text: "Process images asynchronously and serve them from a CDN", step: 5 },
    ],
    steps: [
      {
        short: "Photos in DB",
        chapter: "setup",
        title: "Every photo in a table",
        body: [
          "<b>Crumbly</b> is where 2 million home cooks share recipes, and every recipe has photos. Each upload goes to the API, gets resized inside the request, and is saved as a <span class=\"term\">BLOB</span> in the same Postgres that holds the recipes.",
          "One system, one backup, transactions for free. It worked fine for the first ten thousand photos.",
        ],
        metrics: { dbGrowth: "+2 TB/mo", appTraffic: "all bytes", respond: 3800, imgLoad: 850, storeCost: "$1,900" },
        scene: s1,
        lab: labBase([], [], { dbSub: "recipes + photos" }),
      },
      {
        short: "DB bloat",
        chapter: "problem",
        title: "A database full of pixels",
        body: [
          "Photos are now 97% of the database by size: 18 TB. Nightly backups take nine hours, a new replica needs two days to copy, and expensive replicated SSD is storing JPEGs.",
          "Worse, image pages crowd recipe rows out of the database's memory cache. Queries that used to be served from RAM now hit disk — the photos slow down everything else.",
        ],
        changes: ["~ Database: 18 TB, 97% of it photos", "~ Backups and replicas slow down"],
        metrics: { dbGrowth: "+2 TB/mo", appTraffic: "all bytes", respond: 4200, imgLoad: 1400, storeCost: "$1,900" },
        scene: s2,
        lab: labBase([], [], { dbSub: "18 TB", db: "crit" }),
      },
      {
        short: "App as pipe",
        chapter: "problem",
        title: "API servers become pipes",
        body: [
          "Every byte also passes through the API. A 4 MB photo on a weak mobile connection holds an API thread for eight seconds, then burns CPU on resizing. Thirty slow uploads and a server is full.",
          "Recipe requests — the fast, cheap ones — start queuing behind uploads and timing out.",
        ],
        callout: { kind: "warn", text: "Moving large bytes is a different job from running business logic. Don't make one server do both." },
        changes: ["~ API threads tied up by uploads", "+ Timeouts on unrelated requests"],
        metrics: { dbGrowth: "+2 TB/mo", appTraffic: "all bytes", respond: 6500, imgLoad: 1400, storeCost: "$1,900" },
        scene: s3,
        lab: labBase([], [], { dbSub: "18 TB", db: "crit", api: "crit" }),
      },
      {
        short: "Buckets",
        chapter: "technique",
        title: "Bytes in a bucket, facts in the DB",
        body: [
          "<span class=\"term\">Object storage</span> (S3, Google Cloud Storage, Azure Blob) stores files by key in a flat namespace, replicates them for very high durability, scales without capacity planning and costs a fraction of database SSD.",
          "The database keeps only <span class=\"term\">metadata</span>: which recipe, who uploaded it, the object key, size and status. A few hundred bytes per photo instead of four megabytes.",
        ],
        callout: { kind: "tip", text: "Keep the database as the source of truth for what exists; the bucket just holds the bytes behind each key." },
        changes: ["+ Object storage for photo bytes", "~ Database stores metadata rows only"],
        metrics: { dbGrowth: "+3 GB/mo", appTraffic: "all bytes", respond: 3500, imgLoad: 700, storeCost: "$420" },
        scene: s4,
        lab: labBase([], [], { api: "warn" }),
      },
      {
        short: "Pre-signed",
        chapter: "technique",
        title: "Let the client upload directly",
        body: [
          "The API still relays every byte. Instead, the app asks: <i>I'd like to upload a 4 MB JPEG.</i> The API checks permissions, inserts a <code>pending</code> row, and returns a <span class=\"term\">pre-signed URL</span> — a link that allows one PUT to one key for ten minutes.",
          "The phone uploads straight to storage. The API only handles a small JSON request, and storage absorbs slow connections and retries.",
        ],
        changes: ["+ Pre-signed upload URLs", "~ Photo bytes bypass the API entirely"],
        metrics: { dbGrowth: "+3 GB/mo", appTraffic: "small JSON", respond: 60, imgLoad: 700, storeCost: "$420" },
        scene: s5,
        lab: labBase(),
      },
      {
        short: "Async work",
        chapter: "technique",
        title: "Resize after, not during",
        body: [
          "When an object lands, the bucket emits an <b>object created</b> event onto a queue. <span class=\"term\">Image workers</span> pick it up, generate thumbnails at a few sizes, strip location data from the metadata, and write the variants back to storage.",
          "Finally a worker flips the row to <code>ready</code>. The feed shows a placeholder for a second or two; nobody's request waits on resizing.",
        ],
        changes: ["+ Upload events → queue", "+ Image workers write thumbnails", "~ Row status pending → ready"],
        metrics: { dbGrowth: "+3 GB/mo", appTraffic: "small JSON", respond: 60, imgLoad: 400, storeCost: "$440" },
        scene: s6,
        lab: labFull(false),
      },
      {
        short: "CDN",
        chapter: "solution",
        title: "Serve from the edge",
        body: [
          "Photos are read thousands of times more often than they're written, and never change once processed. A <span class=\"term\">CDN</span> caches each variant near the viewer; only about one view in twenty reaches the bucket.",
          "Because a processed variant never changes, its key can include a version or hash and be cached for a year.",
        ],
        changes: ["+ CDN in front of object storage", "~ Photo views served from the edge"],
        metrics: { dbGrowth: "+3 GB/mo", appTraffic: "small JSON", respond: 60, imgLoad: 45, storeCost: "$440" },
        scene: s7,
        lab: labFull(true),
      },
      {
        short: "Gotchas",
        chapter: "tradeoff",
        title: "What the bucket won't do for you",
        body: [
          "Direct uploads move trust to the client, so constrain the signed URL: short expiry, maximum size, allowed content types — and verify the file in the worker anyway.",
          "Some uploads never finish, leaving <b>orphans</b>: pending rows and stray objects that a lifecycle rule cleans up after a day. Rarely viewed originals can move to a cheaper storage tier, and private photos need short-lived signed links instead of public URLs.",
        ],
        changes: ["+ Lifecycle rules: orphans, older originals", "~ Signed URLs limited by size, type and time"],
        metrics: { dbGrowth: "+3 GB/mo", appTraffic: "small JSON", respond: 60, imgLoad: 45, storeCost: "$260" },
        scene: s8,
        lab: labFull(true),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Where the photos live now",
        body: [
          "<ul class=\"takeaways\"><li>Big files in the database bloat backups, replicas and memory.</li><li>Object storage holds the bytes; the database holds metadata and status.</li><li>Pre-signed URLs let clients upload directly, keeping API servers light.</li><li>Process asynchronously from upload events; serve variants through a CDN.</li></ul>",
        ],
        metrics: { dbGrowth: "+3 GB/mo", appTraffic: "small JSON", respond: 60, imgLoad: 45, storeCost: "$260" },
        scene: s9,
        lab: labFull(true),
      },
    ],
  });
}
console.log("ok");
