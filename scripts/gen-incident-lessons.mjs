// Generates the Incident Commander + Campaign Extras lessons (modules 02–03) from the source game's
// incidents/levels. Usage: node scripts/gen-incident-lessons.mjs [lessonsDir]. Overwrites those lesson JSONs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? new URL("../src/content/lessons/", import.meta.url).pathname;
const rate = (rps) => Math.round(Math.min(3, Math.max(0.6, 0.6 + 0.5 * Math.log10(rps))) * 10) / 10;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── entity presets ──────────────────────────────────────────────────────────
const OK = { cpu: 0.3 };
const WARN = { heat: 0.35, cpu: 0.78 };
const CRIT = { heat: 1, cpu: 0.97 };
const DOWN = { tags: [{ text: "DOWN", tone: "red", icon: "alert" }], heat: 0, cpu: -1, opacity: 0.6 };
const crowd = (label, count = 12, y0 = -33) => ({ type: "crowd", x0: -4, x1: 4, y0, y1: y0 + 6, count, label });
const lb = (x, y, label = ["Load", "Balancer"], extra = {}) => ({ type: "block", x, y, s: 3.4, h: 30, color: "green", glyph: "balancer", label, ...extra });
const api = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 4, color: "blue", glyph: "server", label, ...OK, ...extra });
const k8s = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 6, h: 56, color: "blue", glyph: "boxes", label, ...OK, ...extra });
const redis = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 3.6, color: "orange", glyph: "zap", label, ...extra });
const kafka = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 4, color: "green", glyph: "inbox", label, ...extra });
const worker = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 2.8, color: "purple", glyph: "cpu", label, ...OK, ...extra });
const es = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 4, color: "purple", glyph: "search", label, ...extra });
const db = (x, y, label, tags, extra = {}) => ({ type: "db", x, y, label, ...(tags ? { tags: tags.map((t) => (typeof t === "string" ? { text: t } : t)) } : {}), ...OK, ...extra });
const tag = (text, tone, icon) => ({ text, ...(tone ? { tone } : {}), ...(icon ? { icon } : {}) });
const L = (from, to, label, extra = {}) => ({ from, to, pts: [from, to], ...(label ? { label } : {}), ...extra });
const lab = (users, rps, nodes, edges) => ({
  users,
  rps,
  nodes: nodes.map(([id, kind, label, sub, status]) => ({ id, kind, label, ...(sub ? { sub } : {}), ...(status ? { status } : {}) })),
  edges: edges.map(([from, to]) => ({ from, to })),
});

function write(lesson) {
  for (const s of lesson.steps) for (const k of lesson.metrics) if (!(k in s.metrics)) throw new Error(`${lesson.id}/${s.short}: missing ${k}`);
  writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
}

// ════════════════════════════════════════════════════════════════════════════
// 1. code-red — inc-meltdown (ticketblitz)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 800000;
  const base = () => ({
    users: crowd("Users", 12),
    lb: lb(0, -18, ["ALB"]),
    api: api(0, -6, ["Checkout", "API"], { sub: "12 instances", tags: [tag("retries on", "amber", "refresh")], pills: "above" }),
    db: db(0, 6, "Main DB", ["Postgres · large"]),
  });
  const links = () => ({
    e1: L("users", "lb", "GET /event"),
    e2: L("lb", "api", "route"),
    e3: L("api", "db", "SELECT seat map"),
  });
  const labBase = (st = {}) => [
    ["users", "users", "Users"],
    ["lb", "load_balancer", "ALB"],
    ["api", "api_server", "Checkout API", "12 instances · retries on", st.api],
    ["db", "postgres", "Main DB", "large · tuned indexes", st.db],
  ];
  const labEdges = [["users", "lb"], ["lb", "api"], ["api", "db"]];

  const s1 = { entities: base(), links: links(), flows: [{ route: ["e1", "e2", "e3"], bounce: true, rate: rate(9600) }] };

  const s2 = clone(s1);
  Object.assign(s2.entities.api, WARN);
  Object.assign(s2.entities.db, CRIT, { tags: [tag("Postgres · large"), tag("drowning", "red", "flame")] });
  s2.links.e3.fail = 0.4;
  s2.flows = [{ route: ["e1", "e2", "e3"], kind: "slow", bounce: true, rate: rate(48000) }];

  const s3 = clone(s2);
  s3.links.e3.label = "retry, retry…";
  s3.links.e3.fail = 0.55;
  s3.flows = [{ route: ["e1", "e2", "e3"], bounce: true, rate: 3, pattern: ["req", "req", "slow"], hold: 0.6 }];
  s3.entities.card = {
    type: "panel",
    title: "Retry storm",
    icon: "refresh",
    chart: "bars",
    lines: ["# load reaching the DB", "! retries without a circuit breaker → collapse"],
    bars: [
      { label: "Real requests", note: "1×", to: 0.5, tone: "amber" },
      { label: "+ retries of failed calls", note: "~2×", to: 1, tone: "red", bold: true },
    ],
  };

  const s4 = { entities: base(), links: links(), flows: [] };
  s4.entities.db.x = 5.4;
  s4.entities.api.tags = [tag("circuit breaker", "green", "shield")];
  s4.entities.api.pills = "above";
  s4.entities.cache = redis(-5.4, 6, ["Redis"], { sub: "cache-aside" });
  s4.links.e3.label = "per-user only";
  s4.links.ec = L("api", "cache", "GET seat map");
  s4.flows = [
    {
      routes: [
        { path: ["e1", "e2", "ec"], weight: 4 },
        { path: ["e1", "e2", "e3"], weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: 3,
    },
  ];

  const s5 = clone(s4);
  s5.entities.lb.tags = [tag("rate limit · 429", "amber", "ban")];
  s5.entities.lb.pills = "above";
  s5.flows = [
    {
      routes: [
        { path: ["e1", "e2", "ec"], weight: 4 },
        { path: ["e1", "e2", "e3"], weight: 1 },
        { path: ["e1"], kind: "empty", weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: 3,
    },
  ];

  const labFix = (lim) =>
    lab(
      U,
      48000,
      [
        ["users", "users", "Users"],
        ["lb", "load_balancer", "ALB", lim ? "rate limited" : undefined],
        ["api", "api_server", "Checkout API", "12 instances · circuit breaker"],
        ["cache", "redis", "Redis", "cache-aside"],
        ["db", "postgres", "Main DB", "large · tuned indexes"],
      ],
      [...labEdges, ["api", "cache"]],
    );

  write({
    id: "code-red",
    title: "Code Red at ticketblitz",
    summary: "ticketblitz — event ticketing. Your first day as infra lead: a superstar tour just went on sale and checkout is timing out.",
    minutes: 8,
    level: "intermediate",
    metrics: ["users", "rps", "p95", "errors"],
    legend: ["req", "res", "slow", "retry", "empty", "fail"],
    goals: [
      { text: "See how fan-in reads and retries melt one database", step: 2 },
      { text: "Offload reads with a cache and stop the retry storm", step: 3 },
      { text: "Degrade gracefully with a rate limiter", step: 4 },
    ],
    steps: [
      {
        short: "Day one",
        chapter: "setup",
        title: "Straight to the database",
        body: [
          "<b>09:02</b> — You just joined <b>ticketblitz</b> as the new infra lead. Calendar says 'onboarding'. Slack says <b>#incident-checkout-down (327 unread)</b>.",
          "The previous architect believed in 'keeping things simple': every request goes straight from the <span class=\"term\">Checkout API</span> to one Postgres database. Until 09:00, that held.",
        ],
        metrics: { users: U, rps: 9600, p95: 160, errors: 0.2 },
        scene: s1,
        lab: lab(U, 9600, labBase(), labEdges),
      },
      {
        short: "5× spike",
        chapter: "problem",
        title: "Tickets are live",
        body: [
          "A superstar tour went on sale at 09:00. Traffic is <b>5×</b> and not coming down — 48,000 requests a second, all of them landing on the same database.",
          "Most of those reads are for data that's <em>identical for every user</em>: seat maps, event details. The database computes the same answer thousands of times a second, and the site times out.",
        ],
        callout: { kind: "warn", text: "Every minute down is ~$1,800 in lost sales." },
        metrics: { users: U, rps: 48000, p95: null, errors: 35 },
        scene: s2,
        lab: lab(U, 48000, labBase({ api: "warn", db: "crit" }), labEdges),
      },
      {
        short: "Retry storm",
        chapter: "problem",
        title: "The API makes it worse",
        body: [
          "The API retries every failed call against the drowning database — <b>roughly doubling its load</b>.",
          "A <span class=\"term\">retry storm</span> turns a slowdown into a full outage: retries against an already-overloaded dependency <em>amplify</em> the load instead of riding it out.",
        ],
        metrics: { users: U, rps: 48000, p95: null, errors: 60 },
        scene: s3,
        lab: lab(U, 48000, labBase({ api: "crit", db: "crit" }), labEdges),
      },
      {
        short: "Offload",
        chapter: "technique",
        title: "Cache the fan-in, break the circuit",
        body: [
          "A <span class=\"term\">cache</span> absorbs the fan-in: seat maps and event details are served from Redis, and the database only sees what's truly per-user.",
          "A <span class=\"term\">circuit breaker</span> stops the retries: once the DB is failing, calls fail fast instead of piling on. It converts 'slow and failing' into 'fast and degraded', which protects everything upstream.",
        ],
        callout: { kind: "tip", text: "Adding a cache mid-incident is a valid emergency move precisely because cache-aside needs no data migration." },
        changes: ["+ Redis cache (cache-aside) for seat maps & event details", "~ API retries behind a circuit breaker"],
        metrics: { users: U, rps: 48000, p95: 240, errors: 3 },
        scene: s4,
        lab: labFix(false),
      },
      {
        short: "Degrade",
        chapter: "tradeoff",
        title: "Degraded beats dead",
        body: [
          "A <span class=\"term\">rate limiter</span> at the edge would have kept the site degraded-but-alive from the first minute: serving 80% of users beats serving 0%.",
          "Rate limiting trades a few rejected requests for keeping the whole system alive. <b>429s are cheaper than a dead database.</b>",
        ],
        callout: { kind: "insight", text: "Retries, breakers and limiters are load-control decisions. Without them, every overload becomes a collapse." },
        changes: ["+ Rate limiter at the ALB (excess → 429)"],
        metrics: { users: U, rps: 48000, p95: 220, errors: 3 },
        scene: s5,
        lab: labFix(true),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 2. the-cache-that-saved-too-well — inc-cache-down (newsly)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 2000000;
  const R = 20000;
  const base = () => ({
    users: crowd("Users", 12),
    lb: lb(0, -18, ["ALB"]),
    api: api(0, -6, ["API"], { sub: "24 instances" }),
    redis: redis(-5.4, 6, ["Redis"], { sub: "85% of reads" }),
    db: db(5.4, 6, "MySQL", ["medium · sized for 15%"]),
  });
  const links = () => ({
    e1: L("users", "lb", "GET /story"),
    e2: L("lb", "api", "route"),
    e3: L("api", "redis", "GET"),
    e4: L("api", "db", "miss → SELECT"),
  });
  const labN = (st = {}, extra = []) => [
    ["users", "users", "Users"],
    ["lb", "load_balancer", "ALB", st.lb],
    ["api", "api_server", "API", "24 instances · retries on"],
    ["redis", "redis", "Redis", st.redisSub ?? "long TTL", st.redis],
    ["db", "mysql", "MySQL", st.dbSub ?? "medium · tuned indexes", st.db],
    ...extra,
  ];
  const labE = [["users", "lb"], ["lb", "api"], ["api", "redis"], ["api", "db"]];
  const hitMiss = (hit, miss, missKind) => ({
    routes: [
      { path: ["e1", "e2", "e3"], weight: hit },
      { path: ["e1", "e2", "e4"], weight: miss, ...(missKind ? { kind: missKind } : {}) },
    ],
    pick: "weights",
    bounce: true,
    rate: rate(R),
  });

  const s1 = { entities: base(), links: links(), flows: [hitMiss(17, 3)] };

  const s2 = { entities: base(), links: links(), flows: [] };
  Object.assign(s2.entities.redis, DOWN, { sub: "" });
  s2.links.e3 = { ...s2.links.e3, style: "cut", fail: 1 };
  Object.assign(s2.entities.db, CRIT, { tags: [tag("6× its design load", "red", "flame")] });
  s2.links.e4.label = "every read";
  s2.links.e4.fail = 0.8;
  s2.flows = [{ route: ["e1", "e2", "e4"], kind: "slow", bounce: true, rate: rate(R) }];
  s2.entities.card = {
    type: "panel",
    title: "Load-bearing cache",
    icon: "zap",
    chart: "bars",
    lines: ["# reads reaching MySQL", "! nobody ever tested the miss path"],
    bars: [
      { label: "Cache up", note: "15%", to: 0.15, tone: "green" },
      { label: "Cache down", note: "100% · 6×", to: 1, tone: "red", bold: true },
    ],
  };

  const s3 = { entities: base(), links: links(), flows: [] };
  s3.entities.redis = redis(-5.4, 6, ["Redis"], { sub: "restarted", tags: [tag("cold · empty", "amber", "clock")] });
  Object.assign(s3.entities.db, CRIT, { tags: [tag("herd", "red", "flame")] });
  s3.links.e3.label = "miss";
  s3.links.e4.label = "every miss";
  s3.links.e4.fail = 0.8;
  s3.flows = [
    {
      routes: [
        { path: ["e1", "e2", "e3"], kind: "empty", weight: 1 },
        { path: ["e1", "e2", "e4"], kind: "slow", weight: 4 },
      ],
      pick: "weights",
      bounce: true,
      rate: rate(R),
    },
  ];

  // Recovery: DB first (replica + edge limiter), cache still cold.
  const s4 = { entities: base(), links: links(), flows: [] };
  s4.entities.redis = redis(-5.4, 6, ["Redis"], { sub: "still cold" });
  s4.entities.lb.tags = [tag("rate limit", "amber", "ban")];
  s4.entities.lb.pills = "above";
  Object.assign(s4.entities.db, WARN, { tags: [tag("primary")] });
  s4.entities.dbR = db(11.7, 10, "MySQL", ["read replica"], WARN);
  s4.links.e3.label = "miss";
  s4.links.e4.label = "miss → SELECT";
  s4.links.e5 = L("api", "dbR", "miss → SELECT");
  s4.flows = [
    {
      routes: [
        { path: ["e1", "e2", "e3"], kind: "empty", weight: 1 },
        { path: ["e1", "e2", "e4"], weight: 2 },
        { path: ["e1", "e2", "e5"], weight: 2 },
        { path: ["e1"], kind: "empty", weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: rate(R),
    },
  ];

  // Then warm the cache.
  const s5 = clone(s4);
  s5.entities.redis.sub = "warm again";
  s5.entities.db = db(5.4, 6, "MySQL", ["primary"]);
  s5.entities.dbR = db(11.7, 10, "MySQL", ["read replica"]);
  s5.links.e3.label = "GET";
  s5.flows = [
    {
      routes: [
        { path: ["e1", "e2", "e3"], weight: 17 },
        { path: ["e1", "e2", "e4"], weight: 2 },
        { path: ["e1", "e2", "e5"], weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: rate(R),
    },
  ];

  const s6 = clone(s5);
  s6.entities.redisR = redis(-14.4, 6, ["Redis"], { sub: "replica" });
  s6.links.e6 = L("redis", "redisR", "replication", { style: "beat" });
  s6.flows.push({ route: ["e6"], kind: "ping", rate: 0.8 });

  const labRec = (sub, st, extra = [], extraE = []) =>
    lab(
      U,
      R,
      labN(
        { lb: "rate limited", redisSub: sub, db: st, dbSub: "primary · medium" },
        [["dbR", "mysql", "MySQL", "read replica", st], ...extra],
      ),
      [...labE, ["api", "dbR"], ...extraE],
    );

  write({
    id: "the-cache-that-saved-too-well",
    title: "The Cache That Saved Too Well",
    summary: "newsly — news aggregator. Redis just died mid-news-cycle, and the database underneath was never sized to live without it.",
    minutes: 8,
    level: "intermediate",
    metrics: ["users", "rps", "hitRate", "p95", "errors"],
    legend: ["req", "res", "slow", ["empty", "cache miss"], "ping", "fail"],
    goals: [
      { text: "See why an 85% cache is load-bearing infrastructure", step: 1 },
      { text: "Spot the cold-start thundering herd", step: 2 },
      { text: "Recover in the right order: DB first, then warm", step: 3 },
      { text: "Give the cache its own redundancy", step: 5 },
    ],
    steps: [
      {
        short: "14:29",
        chapter: "setup",
        title: "A cache doing heavy lifting",
        body: [
          "<b>newsly</b> serves 2M readers, about 20,000 requests a second. A Redis cache in front of MySQL absorbs <b>85% of all reads</b>.",
          "The database underneath was sized for the <em>remaining 15%</em>. It has never seen anything else.",
        ],
        metrics: { users: U, rps: R, hitRate: 85, p95: 120, errors: 0.1 },
        scene: s1,
        lab: lab(U, R, labN(), labE),
      },
      {
        short: "Redis down",
        chapter: "problem",
        title: "Hit ratio: 0%",
        body: [
          "<b>14:30</b> — Redis primary unreachable. Hit ratio: 0%. Database inbound: vertical line.",
          "A cache that absorbs 85% of reads isn't an optimization anymore — it's <span class=\"term\">load-bearing infrastructure</span>, and its failure is a <b>database 6×-overload event</b>. The site goes down with it.",
        ],
        callout: { kind: "warn", text: "Nobody ever tested the miss path." },
        metrics: { users: U, rps: R, hitRate: 0, p95: null, errors: 80 },
        scene: s2,
        lab: lab(U, R, labN({ redis: "crit", redisSub: "DOWN", db: "crit" }), labE),
      },
      {
        short: "Cold start",
        chapter: "problem",
        title: "Just restart it?",
        body: [
          "Restarting Redis gets you a <em>cold, empty</em> cache. Every request misses and falls through to MySQL at once.",
          "That's the <span class=\"term\">thundering herd</span>: the misses kill the database again before the cache ever warms up.",
        ],
        callout: { kind: "warn", text: "Think before you act — the obvious fix repeats the outage." },
        metrics: { users: U, rps: R, hitRate: 5, p95: null, errors: 75 },
        scene: s3,
        lab: lab(U, R, labN({ redisSub: "cold · empty", db: "crit" }), labE),
      },
      {
        short: "DB first",
        chapter: "technique",
        title: "Recovery order matters",
        body: [
          "Bring the database up to <b>survivable capacity first</b>: add replicas or a bigger tier, and rate-limit the edge so the miss path never sees more than it can take.",
          "Only then is it safe to let the cache refill. Users get a slower site for a few minutes instead of no site.",
        ],
        changes: ["+ MySQL read replica", "+ Rate limiter at the ALB"],
        metrics: { users: U, rps: R, hitRate: 20, p95: 340, errors: 4 },
        scene: s4,
        lab: labRec("warming", "warn"),
      },
      {
        short: "Warm up",
        chapter: "solution",
        title: "Then warm the cache",
        body: [
          "With the database holding, the cache refills on its own as requests miss and fill it. The hit ratio climbs back to 85% and the database load falls back to its 15%.",
        ],
        changes: ["~ Redis warmed back to 85% hits"],
        metrics: { users: U, rps: R, hitRate: 85, p95: 130, errors: 0.2 },
        scene: s5,
        lab: labRec("long TTL", undefined),
      },
      {
        short: "Redundancy",
        chapter: "tradeoff",
        title: "Caches deserve redundancy too",
        body: [
          "Sizing the DB for full cache-miss traffic doubles your cost for an event that happens rarely — most teams instead keep a <span class=\"term\">rate limiter</span> ready to degrade gracefully.",
          "<span class=\"term\">Redis replication</span> (a replica set for the cache itself) makes the cache crash a non-event.",
        ],
        callout: { kind: "insight", text: "Once a cache is load-bearing, it needs the same redundancy as the database behind it." },
        changes: ["+ Redis replica"],
        metrics: { users: U, rps: R, hitRate: 85, p95: 130, errors: 0.2 },
        scene: s6,
        lab: labRec("long TTL · replicated", undefined, [["redisR", "redis", "Redis", "replica"]], [["redis", "redisR"]]),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 3. eight-million-messages-behind — inc-backlog (shipwell)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 1500000;
  const CX = (n, gap) => Array.from({ length: n }, (_, i) => Math.round((i - (n - 1) / 2) * gap * 100) / 100);
  const base = () => ({
    users: crowd("Scanners + Apps", 12),
    lb: lb(0, -18, ["NLB"]),
    api: api(0, -6, ["Ingest", "API"], { sub: "16 instances" }),
    kafka: kafka(0, 6, ["Kafka"], { sub: "4 partitions" }),
    store: db(0, 30, "Event Store", ["Cassandra · 4 nodes"]),
  });
  const baseLinks = () => ({
    e1: L("users", "lb", "scan event"),
    e2: L("lb", "api", "route"),
    e3: L("api", "kafka", "produce"),
  });
  const consumers = (scene, n, busy, gap = 5.4) => {
    const xs = CX(n, gap);
    const routes = [];
    xs.forEach((x, i) => {
      const id = `c${i + 1}`;
      const idle = i >= busy;
      const w = worker(x, 18, [`C${i + 1}`], idle ? { dim: 0.6, tags: [tag("idle", "gray", "moon")] } : { heat: 0.35 });
      delete w.cpu;
      scene.entities[id] = w;
      if (!idle) {
        scene.links[`k${i + 1}`] = L("kafka", id);
        scene.links[`w${i + 1}`] = L(id, "store");
        routes.push({ path: [`k${i + 1}`, `w${i + 1}`], kind: "msg", weight: 1 });
      }
    });
    return routes;
  };
  const prodFlow = (r) => ({ route: ["e1", "e2", "e3"], kind: "write", rate: rate(r) });
  const labN = (cons, kafkaSub = "4 partitions", st) => [
    ["users", "users", "Scanners + Apps"],
    ["lb", "load_balancer", "NLB"],
    ["api", "api_server", "Ingest API", "16 instances"],
    ["kafka", "kafka", "Kafka", kafkaSub],
    ["workers", "worker", "Consumers", cons, st],
    ["db", "cassandra", "Event Store", "4 nodes"],
  ];
  const labE = [["users", "lb"], ["lb", "api"], ["api", "kafka"], ["kafka", "workers"], ["workers", "db"], ["api", "db"]];

  // s1: 2 consumers, backlog piled up.
  const s1 = { entities: base(), links: baseLinks(), flows: [] };
  s1.entities.backlog = { type: "queue", x: -3.5, y: 8.5, n: 8, gap: 0.9, dir: [0, -1] };
  const r1 = consumers(s1, 2, 2, 5.4);
  for (const k of ["c1", "c2"]) s1.entities[k].heat = 1;
  s1.flows = [prodFlow(12000), { routes: r1, pick: "weights", rate: 0.8 }];

  const s2 = clone(s1);
  s2.entities.backlog.n = 12;
  s2.entities.kafka.tags = [tag("healthy", "green", "check")];
  s2.entities.kafka.pills = "above";
  s2.flows = [prodFlow(26400), { routes: r1, pick: "weights", rate: 0.8 }];
  s2.entities.card = {
    type: "panel",
    title: "Drain < arrival",
    icon: "inbox",
    lines: ["producers: fine · brokers: fine", "! consumer throughput < producer throughput", "! …permanently → backlog grows forever"],
  };

  // s3: 6 consumers, only 4 partitions → 2 idle.
  const s3 = { entities: base(), links: baseLinks(), flows: [] };
  s3.entities.backlog = { type: "queue", x: -3.5, y: 8.5, n: 12, gap: 0.9, dir: [0, -1] };
  const r3 = consumers(s3, 6, 4, 4.5);
  s3.entities.kafka.tags = [tag("4 partitions → 4 consumers", "amber", "split")];
  s3.entities.kafka.pills = "above";
  s3.entities.kafka.sub = "";
  s3.flows = [prodFlow(26400), { routes: r3, pick: "weights", rate: 1.4 }];

  // s4: more partitions, overscaled consumers → drain > arrival.
  const s4 = { entities: base(), links: baseLinks(), flows: [] };
  s4.entities.backlog = { type: "queue", x: -3.5, y: 8.5, n: 5, gap: 0.9, dir: [0, -1] };
  const r4 = consumers(s4, 8, 8, 4.2);
  s4.entities.kafka.sub = "more partitions";
  s4.flows = [prodFlow(26400), { routes: r4, pick: "weights", rate: 2.4 }];

  // s5: caught up, scale back.
  const s5 = { entities: base(), links: baseLinks(), flows: [] };
  s5.entities.backlog = { type: "queue", x: -3.5, y: 8.5, n: 1, gap: 0.9, dir: [0, -1] };
  const r5 = consumers(s5, 6, 6, 4.5);
  for (let i = 1; i <= 6; i++) s5.entities[`c${i}`].heat = 0;
  s5.entities.kafka.sub = "more partitions";
  s5.flows = [prodFlow(26400), { routes: r5, pick: "weights", rate: 1.8 }];

  write({
    id: "eight-million-messages-behind",
    title: "Eight Million Messages Behind",
    summary: "shipwell — logistics platform. Dashboards are 47 minutes behind and Kafka looks perfectly healthy. The drain is the problem.",
    minutes: 7,
    level: "intermediate",
    metrics: ["users", "rps", "backlog", "workers"],
    legend: [["write", "scan event"], ["msg", "consumed"], "queue"],
    goals: [
      { text: "Read consumer lag: the queue is fine, the drain is not", step: 1 },
      { text: "Learn why partition count caps consumer parallelism", step: 2 },
      { text: "Catch up with margin, then scale back", step: 3 },
    ],
    steps: [
      {
        short: "11:15",
        chapter: "setup",
        title: "47 minutes behind",
        body: [
          "<b>11:15</b> — Warehouse scanners across the country send package-scan events through <span class=\"term\">Kafka</span>. Dashboards are showing data from <b>47 minutes ago</b> and falling further behind.",
          "Consumer lag: <b>8.2 million messages</b>. Customers are calling support asking where their packages are. The COO is calling you.",
        ],
        metrics: { users: U, rps: 12000, backlog: "8.2M msgs", workers: 2 },
        scene: s1,
        lab: lab(U, 12000, labN("2 instances", undefined, "crit"), labE),
      },
      {
        short: "Healthy?",
        chapter: "problem",
        title: "Producers fine. Brokers fine.",
        body: [
          "Holiday shipping volume: scan events <b>2× normal</b>, all day.",
          "The brokers are healthy because Kafka's job is to <em>hold</em> messages — it is holding 8 million of them beautifully. The failure is downstream: <span class=\"term\">consumer throughput &lt; producer throughput</span>, permanently.",
        ],
        callout: { kind: "warn", text: "A queue doesn't make slow consumers fast — it buys you time. If the drain stays slower than the arrivals, 'eventually' becomes 'never'." },
        metrics: { users: U, rps: 26400, backlog: "8.2M+ & rising", workers: 2 },
        scene: s2,
        lab: lab(U, 26400, labN("2 instances", undefined, "crit"), labE),
      },
      {
        short: "Idle",
        chapter: "technique",
        title: "Partitions cap parallelism",
        body: [
          "The first lever is more consumers. Scale to six… and only four of them do any work.",
          "Each partition is read by one consumer in a group, so <b>partition count caps consumer parallelism</b>. With 4 partitions, consumers 5+ stand idle.",
        ],
        changes: ["~ Consumers: 2 → 6 (4 busy, 2 idle)"],
        metrics: { users: U, rps: 26400, backlog: "8.2M+ & rising", workers: 6 },
        scene: s3,
        lab: lab(U, 26400, labN("6 instances · 2 idle", "4 partitions", "warn"), labE),
      },
      {
        short: "Drain",
        chapter: "solution",
        title: "Both levers, with margin",
        body: [
          "Two levers fix a drain problem: <b>more consumers AND enough partitions</b> for them to share.",
          "Catching up a deep backlog needs drain rate &gt; arrival rate <em>with margin</em> — so temporarily overscale the workers. The lag finally starts shrinking.",
        ],
        changes: ["+ More Kafka partitions", "~ Consumers overscaled to catch up"],
        metrics: { users: U, rps: 26400, backlog: "draining", workers: 8 },
        scene: s4,
        lab: lab(U, 26400, labN("8 instances", "more partitions", "warn"), labE),
      },
      {
        short: "Headroom",
        chapter: "tradeoff",
        title: "Overprovision partitions early",
        body: [
          "Once the backlog is gone, scale the workers back. Sizing for exactly steady-state means you never recover from any dip.",
          "Adding partitions is easy at creation and annoying later: rebalancing, and ordering boundaries change. <b>Overprovision partitions early.</b>",
        ],
        callout: { kind: "insight", text: "Partitions are your ceiling on parallelism; workers are how close you run to it." },
        changes: ["~ Consumers scaled back after catch-up"],
        metrics: { users: U, rps: 26400, backlog: "caught up", workers: 6 },
        scene: s5,
        lab: lab(U, 26400, labN("6 instances", "more partitions"), labE),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 4. one-shard-to-rule-them-all — inc-hotshard (gamerly)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 5000000;
  const GAP = 6.6;
  const XS = Array.from({ length: 8 }, (_, i) => Math.round((i - 3.5) * GAP * 100) / 100);
  const base = (hot) => {
    const e = {
      users: crowd("Players", 12),
      lb: lb(0, -18, ["ALB"]),
      k8s: k8s(0, -3, ["Stats", "Service"], { sub: "8–40 pods" }),
      cache: redis(-10.8, -3, ["Leaderboard", "Cache"]),
    };
    XS.forEach((x, i) => {
      const isHot = hot && i === 2;
      const d = db(x, 13, `S${i + 1}`, isHot ? [tag("100% CPU", "red", "flame")] : undefined, isHot ? CRIT : hot ? { opacity: 0.75 } : {});
      if (!isHot) delete d.cpu;
      e[`s${i + 1}`] = d;
    });
    return e;
  };
  const baseLinks = () => {
    const l = {
      e1: L("users", "lb", "POST /stats"),
      e2: L("lb", "k8s", "route"),
      ec: L("k8s", "cache", "leaderboard"),
    };
    XS.forEach((_, i) => (l[`d${i + 1}`] = L("k8s", `s${i + 1}`)));
    return l;
  };
  const writes = (w) => XS.map((_, i) => ({ path: ["e1", "e2", `d${i + 1}`], kind: "write", weight: w[i] }));
  const flow = (w, r, slow) => ({
    routes: [{ path: ["e1", "e2", "ec"], weight: 4 }, ...writes(w).map((x) => (slow && x.weight > 1 ? { ...x, kind: "slow" } : x))],
    pick: "weights",
    bounce: true,
    rate: rate(r),
  });
  const labN = (sub, st, k8sSt) => [
    ["users", "users", "Players"],
    ["lb", "load_balancer", "ALB"],
    ["k8s", "k8s_cluster", "Stats Service", "8–40 pods", k8sSt],
    ["redis", "redis", "Leaderboard Cache", "long TTL + jitter"],
    ["db", "mongodb", "Stats DB (sharded)", sub, st],
  ];
  const labE = [["users", "lb"], ["lb", "k8s"], ["k8s", "redis"], ["k8s", "db"]];
  const HOT = [0, 0, 14, 0, 0, 0, 0, 0].map((x) => x || 0.3);
  const EVEN = [1, 1, 1, 1, 1, 1, 1, 1];

  const s1 = { entities: base(false), links: baseLinks(), flows: [flow(EVEN, 45000)] };

  const s2 = { entities: base(true), links: baseLinks(), flows: [flow(HOT, 45000, true)] };
  s2.links.d3.label = "nearly every write";
  s2.links.d3.fail = 0.4;

  const s3 = clone(s2);
  s3.entities.k8s.sub = "40 pods";
  Object.assign(s3.entities.k8s, WARN);
  s3.flows = [flow(HOT, 90000, true)];
  s3.entities.card = {
    type: "panel",
    title: "Monotonic shard key",
    icon: "split",
    chart: "bars",
    lines: ["# shard key = game id", "! tonight one game IS the traffic"],
    bars: [
      { label: "Paid for", note: "8 shards", to: 1, tone: "gray" },
      { label: "Got", note: "1 shard", to: 0.125, tone: "red", bold: true },
    ],
  };

  const s4 = { entities: base(false), links: baseLinks(), flows: [flow(EVEN, 90000)] };
  s4.entities.cache.tags = [tag("bought time", "green", "clock")];
  s4.entities.cache.pills = "above";
  s4.entities.k8s.sub = "re-keyed";
  XS.forEach((_, i) => (s4.links[`d${i + 1}`].label = i === 0 ? "hashed write" : undefined));
  for (const k of Object.keys(s4.links)) if (s4.links[k].label === undefined) delete s4.links[k].label;

  const s5 = clone(s4);
  delete s5.entities.cache.tags;
  delete s5.entities.cache.pills;
  s5.links.d1.label = "top scores this hour?";
  s5.flows = [
    flow(EVEN, 90000),
    { routes: XS.map((_, i) => ({ path: [`d${i + 1}`] })), fanout: true, kind: "ping", rate: 0.7 },
  ];

  write({
    id: "one-shard-to-rule-them-all",
    title: "One Shard To Rule Them All",
    summary: "gamerly — game stats platform. Launch night: the stats DB is sharded 8 ways, and one shard is doing all the work.",
    minutes: 8,
    level: "advanced",
    metrics: ["users", "rps", "hottest", "p95", "errors"],
    legend: ["req", "res", ["write", "stats write"], "slow", ["ping", "scatter-gather"], "fail"],
    goals: [
      { text: "Diagnose a hot partition under live traffic", step: 1 },
      { text: "See why a monotonic key wastes 7 of 8 shards", step: 2 },
      { text: "Re-key to spread one hot entity", step: 3 },
      { text: "Pay for it with scatter-gather range queries", step: 4 },
    ],
    steps: [
      {
        short: "8 shards",
        chapter: "setup",
        title: "Capacity should be fine",
        body: [
          "<b>gamerly</b> tracks live player stats for 5M players. The stats DB is <span class=\"term\">sharded</span> 8 ways behind an autoscaled Stats Service, with a Redis leaderboard cache on the side.",
          "On a normal night, writes spread across all eight shards.",
        ],
        metrics: { users: U, rps: 45000, hottest: 13, p95: 90, errors: 0.1 },
        scene: s1,
        lab: lab(U, 45000, labN("medium · 8 shards · key: game id"), labE),
      },
      {
        short: "Shard 3",
        chapter: "problem",
        title: "One shard has all the fun",
        body: [
          "<b>20:05</b> — A new game launched tonight. One new game id is receiving <b>nearly every write</b> on the platform.",
          "Shard 3 is at 100% CPU and the other seven are napping. Latency alerts everywhere. The on-call DBA quit last week (unrelated, probably).",
        ],
        callout: { kind: "warn", text: "Hot partitions are the classic sharding failure: one celebrity, one viral post, one busy tenant overwhelming a single shard." },
        metrics: { users: U, rps: 45000, hottest: 90, p95: null, errors: 12 },
        scene: s2,
        lab: lab(U, 45000, labN("8 shards · shard 3 at 100%", "crit"), labE),
      },
      {
        short: "Why?",
        chapter: "problem",
        title: "Paid for 8×, got 1×",
        body: [
          "Player count doubles as streamers come online. The autoscaler adds pods — and more pods hammering a saturated shard make it <em>worse</em>.",
          "The shard key was the <span class=\"term\">game id</span> with monotonic insert patterns. Tonight one game IS the traffic, so one shard eats nearly everything.",
        ],
        metrics: { users: U, rps: 90000, hottest: 90, p95: null, errors: 30 },
        scene: s3,
        lab: lab(U, 90000, labN("8 shards · shard 3 at 100%", "crit", "warn"), labE),
      },
      {
        short: "Re-key",
        chapter: "technique",
        title: "Shard-key surgery",
        body: [
          "Re-key to a <span class=\"term\">hashed / composite key</span> — game id + player id bucket — so a single hot entity spreads across all eight shards.",
          "The cache absorbing leaderboard reads bought time while the writes rebalanced.",
        ],
        changes: ["~ Shard key: game id → hash(game id + player bucket)"],
        metrics: { users: U, rps: 90000, hottest: 13, p95: 180, errors: 0.3 },
        scene: s4,
        lab: lab(U, 90000, labN("8 shards · hashed composite key"), labE),
      },
      {
        short: "Ranges",
        chapter: "tradeoff",
        title: "No more cheap range queries",
        body: [
          "Hashed keys kill cheap range queries: 'top scores this hour' becomes a <span class=\"term\">scatter-gather</span> across every shard. You traded query convenience for write survival.",
          "Live re-sharding under fire is the most expensive way to learn shard-key design.",
        ],
        callout: { kind: "insight", text: "The cheap way: model your most-viral entity before you pick the key." },
        metrics: { users: U, rps: 90000, hottest: 13, p95: 180, errors: 0.3 },
        scene: s5,
        lab: lab(U, 90000, labN("8 shards · hashed composite key"), labE),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 5. the-region-is-down — inc-region (medichart)
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 3000000;
  const zone = (id, x0, x1, label) => ({ type: "zone", x0, x1, y0: -10, y1: 13, label });
  const base = () => ({
    zoneA: zone("zoneA", -14, 14, "ONE REGION"),
    users: crowd("Hospitals", 12),
    lb: lb(0, -18, ["ALB"]),
    apiA: api(-4.5, -5, ["Records", "API"], { sub: "5 instances" }),
    apiB: api(4.5, -5, ["Records", "API"], { sub: "5 instances" }),
    redis: redis(-9, 9, ["Session", "Cache"]),
    db: db(0, 9, "Records DB", ["1 read replica"]),
    es: es(9, 9, ["Search"]),
  });
  const baseLinks = () => ({
    e1: L("users", "lb", "GET /patient"),
    ea: L("lb", "apiA"),
    eb: L("lb", "apiB"),
    ra: L("apiA", "redis"),
    da: L("apiA", "db"),
    sa: L("apiA", "es"),
    rb: L("apiB", "redis"),
    db_: L("apiB", "db"),
    sb: L("apiB", "es"),
  });
  const via = (front, backs, w = 1, kind) => backs.map((b) => ({ path: ["e1", front, b], weight: w, ...(kind ? { kind } : {}) }));
  const labN = (sub, st, extra = []) => [
    ["users", "users", "Hospitals"],
    ["lb", "load_balancer", "ALB"],
    ["api", "api_server", "Records API", sub, st],
    ["redis", "redis", "Session Cache"],
    ["db", "postgres", "Records DB", "large · 1 read replica"],
    ["es", "elasticsearch", "Search"],
    ...extra,
  ];
  const labE = [["users", "lb"], ["lb", "api"], ["api", "redis"], ["api", "db"], ["api", "es"]];

  const s1 = { entities: base(), links: baseLinks(), flows: [] };
  s1.flows = [{ routes: [...via("ea", ["ra", "da", "sa"]), ...via("eb", ["rb", "db_", "sb"])], pick: "weights", bounce: true, rate: rate(21000) }];

  const s2 = { entities: base(), links: baseLinks(), flows: [] };
  Object.assign(s2.entities.apiB, DOWN, { sub: "" });
  for (const k of ["eb", "rb", "db_", "sb"]) s2.links[k] = { ...s2.links[k], style: "cut", fail: 1 };
  Object.assign(s2.entities.apiA, CRIT);
  s2.links.ea.fail = 0.5;
  s2.flows = [{ routes: [...via("ea", ["ra", "da", "sa"], 1, "slow"), { path: ["e1", "eb"], kind: "slow", weight: 3 }], pick: "weights", bounce: true, rate: rate(21000) }];

  // Survive: overscale survivors + shed non-critical load.
  const s3 = { entities: base(), links: baseLinks(), flows: [] };
  Object.assign(s3.entities.apiB, DOWN, { sub: "" });
  for (const k of ["eb", "rb", "db_", "sb"]) s3.links[k] = { ...s3.links[k], style: "cut", fail: 1 };
  s3.entities.apiA = api(-4.5, -5, ["Records", "API"], { sub: "overscaled", ...WARN });
  s3.entities.lb.tags = [tag("shed non-critical", "amber", "ban")];
  s3.entities.lb.pills = "above";
  s3.flows = [{ routes: [...via("ea", ["ra", "da", "sa"], 2), { path: ["e1"], kind: "empty", weight: 1 }], pick: "weights", bounce: true, rate: rate(21000) }];

  const s4 = clone(s3);
  s4.flows[0].rate = rate(31500);
  s4.entities.card = {
    type: "panel",
    title: "Survival math",
    icon: "gauge",
    lines: ["# survival = remaining capacity > current demand", "! outage: ~50% of capacity gone", "! morning shift: demand 1.5×", "= overscale what survived · shed the rest"],
  };

  // Durable fix: capacity in a second failure domain.
  const s5 = { entities: {}, links: {}, flows: [] };
  s5.entities = {
    zoneA: zone("zoneA", -15, -1, "ZONE A"),
    zoneB: zone("zoneB", 1, 15, "ZONE B"),
    users: crowd("Hospitals", 12),
    lb: lb(0, -18, ["ALB"], { sub: "multi-AZ" }),
    apiA: api(-7, -4, ["Records", "API"]),
    db: db(-5, 8, "Records DB", ["primary"]),
    apiB2: api(7, -4, ["Records", "API"]),
    dbB: db(10, 7, "Records DB", ["read replica"]),
  };
  s5.links = {
    e1: L("users", "lb", "GET /patient"),
    ea: L("lb", "apiA"),
    eb2: L("lb", "apiB2"),
    da: L("apiA", "db"),
    db2: L("apiB2", "dbB", "reads"),
    rep: L("db", "dbB", "replication"),
  };
  s5.flows = [
    {
      routes: [
        { path: ["e1", "ea", "da"], weight: 1 },
        { path: ["e1", "eb2", "db2"], weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: rate(21000),
    },
    { route: ["rep"], kind: "write", rate: 0.8 },
  ];

  const s6 = clone(s5);
  s6.entities.zoneB.label = "REGION B · STANDBY";
  s6.entities.zoneA.label = "REGION A";
  s6.entities.apiB2.dim = 0.5;
  s6.entities.apiB2.sub = "N+1 headroom";
  s6.links.eb2 = { ...s6.links.eb2, style: "dashed", label: "failover drill" };
  s6.links.db2 = { ...s6.links.db2, style: "off" };
  s6.entities.dbB.tags = [tag("standby")];
  s6.flows = [
    {
      routes: [
        { path: ["e1", "ea", "da"], weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: rate(21000),
    },
    { route: ["e1", "eb2"], kind: "ping", rate: 0.6 },
    { route: ["rep"], kind: "write", rate: 0.8 },
  ];

  write({
    id: "the-region-is-down",
    title: "The Region Is Down. The Region Is You.",
    summary: "medichart — health records SaaS. 03:11, a regional outage, half your capacity gone, and doctors mid-shift. Survive the night, then build it right.",
    minutes: 9,
    level: "advanced",
    metrics: ["users", "rps", "p95", "errors"],
    legend: ["req", "res", "slow", "empty", ["write", "replication"], "ping", "fail"],
    goals: [
      { text: "See what losing half your capacity does", step: 1 },
      { text: "Survive: overscale what's left, shed the rest", step: 2 },
      { text: "Spread capacity across failure domains", step: 4 },
      { text: "Practice failover before you need it", step: 5 },
    ],
    steps: [
      {
        short: "03:10",
        chapter: "setup",
        title: "Everything in one region",
        body: [
          "<b>medichart</b> serves hospitals: 3M users pulling up patient records, about 21,000 requests a second.",
          "Everything lives in <b>one region</b> because 'multi-region was on the roadmap for Q3'. It is currently Q2.",
        ],
        metrics: { users: U, rps: 21000, p95: 110, errors: 0.1 },
        scene: s1,
        lab: lab(U, 21000, labN("medium · 10 instances · circuit breaker"), labE),
      },
      {
        short: "Outage",
        chapter: "problem",
        title: "Half your capacity evaporated",
        body: [
          "<b>03:11</b> — Your cloud provider's status page just turned red: a major regional outage. <b>~50% of your instance capacity</b> is unreachable. Provider ETA: 'investigating'.",
          "Doctors are mid-shift. 'Down' is not a word you get to use.",
        ],
        callout: { kind: "warn", text: "Half the fleet now has to carry all of the traffic." },
        metrics: { users: U, rps: 21000, p95: null, errors: 50 },
        scene: s2,
        lab: lab(U, 21000, labN("~5 of 10 instances reachable", "crit"), labE),
      },
      {
        short: "Survive",
        chapter: "solution",
        title: "DR in its rawest form",
        body: [
          "When a region degrades, <span class=\"term\">survival = remaining capacity &gt; current demand</span>.",
          "So you <b>overscale what survived</b> and <b>shed non-critical load</b> at the edge. Not elegant — disaster recovery in its rawest form.",
        ],
        changes: ["~ Surviving Records API overscaled", "+ Load shedding at the ALB"],
        metrics: { users: U, rps: 21000, p95: 320, errors: 3 },
        scene: s3,
        lab: lab(U, 21000, labN("overscaled survivors", "warn"), labE),
      },
      {
        short: "Morning",
        chapter: "problem",
        title: "Morning shift, wounded fleet",
        body: [
          "Morning shift is starting on the East Coast. Traffic climbs <b>1.5×</b> on your wounded fleet.",
          "Overscaling bought you headroom; the demand side just moved again. You hold under the 4% error budget only because the survivors were scaled past what they needed at 03:11.",
        ],
        metrics: { users: U, rps: 31500, p95: 380, errors: 3.5 },
        scene: s4,
        lab: lab(U, 31500, labN("overscaled survivors", "warn"), labE),
      },
      {
        short: "Domains",
        chapter: "technique",
        title: "More than one failure domain",
        body: [
          "The durable fix is capacity in more than one <span class=\"term\">failure domain</span>: <b>multi-AZ first</b> (cheap, easy), multi-region for the SLAs that justify it.",
          "Managed services (DynamoDB, SQS, ALB) are already multi-AZ — one reason they cost more on paper and less in incidents.",
        ],
        callout: { kind: "tip", text: "Multi-AZ first: same region, separate data centers, most of the protection for a fraction of the work." },
        changes: ["+ Second zone: Records API capacity", "+ Records DB read replica in zone B"],
        metrics: { users: U, rps: 21000, p95: 110, errors: 0.1 },
        scene: s5,
        lab: lab(
          U,
          21000,
          [...labN("spread across zones"), ["dbB", "postgres", "Records DB", "read replica · zone B"]],
          [...labE, ["db", "dbB"]],
        ),
      },
      {
        short: "Game day",
        chapter: "tradeoff",
        title: "Paying for idle, practicing failure",
        body: [
          "N+1 region capacity means paying for headroom that idles ~99% of the time. For hospital software, that math closes easily; for a meme app, maybe not.",
          "Failover needs <em>practice</em> — an untested DR plan is a rumor. <span class=\"term\">Game days</span> exist because the first failover should never be the real one.",
        ],
        callout: { kind: "insight", text: "Buy the redundancy your SLA justifies — then rehearse using it." },
        metrics: { users: U, rps: 21000, p95: 110, errors: 0.1 },
        scene: s6,
        lab: lab(
          U,
          21000,
          [...labN("region A"), ["dbB", "postgres", "Records DB", "standby · region B"]],
          [...labE, ["db", "dbB"]],
        ),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 6. search-moves-out — L8 (shoply) search offload
// ════════════════════════════════════════════════════════════════════════════
{
  const U = 8000000;
  const base = () => ({
    users: crowd("Shoppers", 12),
    lb: lb(0, -18),
    k8s: k8s(0, -4, ["K8s", "Cluster"]),
    db: db(0, 9, "PostgreSQL", ["primary · strong consistency"]),
  });
  const baseLinks = () => ({
    e1: L("users", "lb", "GET /search?q=…"),
    e2: L("lb", "k8s", "route"),
    e3: L("k8s", "db", "SQL"),
  });
  const labN = (st, extra = []) => [
    ["users", "users", "Shoppers"],
    ["lb", "load_balancer", "Load Balancer"],
    ["k8s", "k8s_cluster", "K8s Cluster"],
    ["db", "postgres", "PostgreSQL", "strong consistency", st],
    ...extra,
  ];
  const labE = [["users", "lb"], ["lb", "k8s"], ["k8s", "db"]];
  const mix = (r, searchKind = "heavy") => ({
    routes: [
      { path: ["e1", "e2", "e3"], weight: 11 },
      { path: ["e1", "e2", "e3"], kind: searchKind, weight: 1 },
    ],
    pick: "weights",
    bounce: true,
    rate: rate(r),
  });

  const s1 = { entities: base(), links: baseLinks(), flows: [mix(80000, "req")] };

  const s2 = { entities: base(), links: baseLinks(), flows: [mix(80000)] };
  Object.assign(s2.entities.db, WARN);
  s2.links.e3.label = "LIKE '%term%'";
  s2.entities.card = {
    type: "panel",
    title: "Search on the primary",
    icon: "search",
    chart: "bars",
    lines: ["# DB CPU per query", "! LIKE '%term%' → full table scan, every query"],
    bars: [
      { label: "Product lookup", note: "1×", to: 0.05, tone: "green" },
      { label: "Search query", note: "20×", to: 1, tone: "red", bold: true },
    ],
  };

  const s3 = { entities: base(), links: baseLinks(), flows: [mix(320000)] };
  Object.assign(s3.entities.db, CRIT, { tags: [tag("primary · strong consistency"), tag("scanning", "red", "flame")] });
  s3.links.e3.label = "LIKE '%term%'";
  s3.links.e3.fail = 0.3;
  s3.flows = [
    {
      routes: [
        { path: ["e1", "e2", "e3"], kind: "slow", weight: 11 },
        { path: ["e1", "e2", "e3"], kind: "heavy", weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: rate(320000),
    },
  ];

  const s4 = { entities: base(), links: baseLinks(), flows: [] };
  s4.entities.db.x = -6.3;
  s4.entities.search = es(6.3, 9, ["Elasticsearch"], { sub: "inverted index" });
  s4.links.e3.label = "carts · payments";
  s4.links.es = L("k8s", "search", "search");
  s4.links.idx = { from: "db", to: "search", pts: ["db", "search"], label: "async index", style: "dashed" };
  s4.flows = [
    {
      routes: [
        { path: ["e1", "e2", "e3"], weight: 11 },
        { path: ["e1", "e2", "es"], weight: 1 },
      ],
      pick: "weights",
      bounce: true,
      rate: rate(320000),
    },
    { route: ["idx"], kind: "write", rate: 0.8 },
  ];

  const s5 = clone(s4);
  s5.entities.search.tags = [tag("near-real-time", "violet", "clock")];
  s5.entities.search.pills = "above";
  s5.entities.db.tags = [tag("source of truth", "green", "database")];

  const labES = lab(U, 320000, labN(undefined, [["es", "elasticsearch", "Elasticsearch", "product search"]]), [...labE, ["k8s", "es"], ["db", "es"]]);

  write({
    id: "search-moves-out",
    title: "Search Moves Out",
    summary: "shoply — e-commerce at scale. Product search runs on the primary database, and the Big Sale is about to multiply it by four.",
    minutes: 6,
    level: "intermediate",
    metrics: ["users", "rps", "p95", "errors"],
    legend: ["req", "res", ["heavy", "search query"], "slow", ["write", "async index"], "fail"],
    goals: [
      { text: "See why LIKE '%term%' is a full scan per query", step: 1 },
      { text: "Move search to an inverted index", step: 3 },
      { text: "Keep the source of truth in the database", step: 4 },
    ],
    steps: [
      {
        short: "Shoply",
        chapter: "setup",
        title: "One database does everything",
        body: [
          "<b>shoply</b> processes real money now: carts, payments, inventory — 8M users, about 80,000 requests a second, all served by one strongly consistent PostgreSQL primary.",
          "About 8% of that traffic is <span class=\"term\">product search</span>, and it runs on the same database.",
        ],
        metrics: { users: U, rps: 80000, p95: 200, errors: 0.3 },
        scene: s1,
        lab: lab(U, 80000, labN(), labE),
      },
      {
        short: "20× CPU",
        chapter: "problem",
        title: "Search eats the primary",
        body: [
          "Search on a relational database means <code>LIKE '%term%'</code> — a <b>full table scan per query</b>. Product search on the primary was eating <b>20× CPU per query</b>.",
          "The scan grows with the catalog, not with the query. A small share of requests does most of the database's work.",
        ],
        metrics: { users: U, rps: 80000, p95: 300, errors: 0.6 },
        scene: s2,
        lab: lab(U, 80000, labN("warn"), labE),
      },
      {
        short: "Big Sale",
        chapter: "problem",
        title: "The Big Sale is live",
        body: [
          "The Big Sale is LIVE. Checkout traffic <b>4×</b> — and search grows with it. Every shopper looking for a deal adds another full scan to the same primary that has to commit their payment.",
          "Browsing is now starving money.",
        ],
        callout: { kind: "warn", text: "Search and checkout share one CPU budget. When search wins, payments time out." },
        metrics: { users: U, rps: 320000, p95: null, errors: 8 },
        scene: s3,
        lab: lab(U, 320000, labN("crit"), labE),
      },
      {
        short: "Index",
        chapter: "technique",
        title: "An inverted index",
        body: [
          "Move search to <span class=\"term\">Elasticsearch</span>. A search engine <em>inverts</em> the index — term → matching products — so queries are <b>O(term), not O(rows)</b>.",
          "The primary goes back to what only it can do: carts, payments, inventory.",
        ],
        changes: ["+ Elasticsearch for product search", "+ Async indexing from PostgreSQL"],
        metrics: { users: U, rps: 320000, p95: 260, errors: 0.4 },
        scene: s4,
        lab: labES,
      },
      {
        short: "Eventual",
        chapter: "tradeoff",
        title: "Not a primary store",
        body: [
          "Elasticsearch is <span class=\"term\">near-real-time</span> and not durable like a primary database. Standard pattern: <b>source of truth in the DB, indexed into ES asynchronously</b> — a new product may take a moment to show up in results.",
          "Strong consistency costs latency and availability. Reserve it for money and inventory; let browsing be eventual.",
        ],
        callout: { kind: "insight", text: "Pick consistency per operation, not per system: payments strong, search eventual." },
        metrics: { users: U, rps: 320000, p95: 260, errors: 0.4 },
        scene: s5,
        lab: labES,
      },
    ],
  });
}
console.log("ok");
