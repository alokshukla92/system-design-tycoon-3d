// Generates the original curriculum lessons for modules 07 (Communication) and 08 (Reliability).
// Usage: node scripts/gen-curriculum-d.mjs [lessonsDir]. Overwrites only these lessons' JSON files:
// asking-nicely, later-please, shout-it-out, live-wire, no-single-point, fair-share, give-up-gracefully,
// seeing-in-the-dark. All products, numbers and storylines are fictional and written for this course.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? new URL("../src/content/lessons/", import.meta.url).pathname;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── shared factories ────────────────────────────────────────────────────────
const T = (text, tone, icon) => ({ text, ...(tone ? { tone } : {}), ...(icon ? { icon } : {}) });
const DOWN = { dead: 1, heat: 0, cpu: -1, tags: [T("DOWN", "red", "alert")] };
const crowd = (label, count = 10, x = 0, y0 = -32, w = 4) => ({ type: "crowd", x0: x - w, x1: x + w, y0, y1: y0 + 6, count, label });
const blk = (x, y, color, glyph, label, extra = {}) => ({ type: "block", x, y, s: 4, color, glyph, label, ...extra });
const server = (x, y, label, extra = {}) => blk(x, y, "blue", "server", label, extra);
const lb = (x, y, label = ["Load", "Balancer"], extra = {}) => blk(x, y, "green", "balancer", label, { s: 3.4, h: 30, ...extra });
const db = (x, y, label, extra = {}) => ({ type: "db", x, y, label, ...extra });
const phone = (x, y, label, extra = {}) => ({ type: "device", form: "phone", x, y, w: 4, d: 4, label, ...extra });
const laptop = (x, y, label, extra = {}) => ({ type: "device", x, y, w: 5, d: 5, label, ...extra });
const card = (title, icon, lines, extra = {}) => ({ type: "panel", title, icon, lines, ...extra });
const bars = (title, icon, list, lines = [], extra = {}) => ({ type: "panel", title, icon, chart: "bars", bars: list, lines, ...extra });
const bar = (label, note, to, tone = "gray", extra = {}) => ({ label, note, to, tone, ...extra });
const L = (from, to, label, extra = {}) => ({ from, to, pts: [from, to], ...(label ? { label } : {}), ...extra });
const B = (from, to, label, extra = {}) => L(from, to, label, { heads: "both", ...extra });
const lab = (users, rps, nodes, edges) => ({
  users,
  rps,
  nodes: nodes.map(([id, kind, label, sub, status]) => ({ id, kind, label, ...(sub ? { sub } : {}), ...(status ? { status } : {}) })),
  edges: edges.map(([from, to]) => ({ from, to })),
});
const term = (t) => `<span class="term">${t}</span>`;
const takeaways = (items) => `<ul class="takeaways">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const table = (rows, head) =>
  `<table class="compare numbers">${head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` : ""}<tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

function write(lesson) {
  if (lesson.steps.length < 8 || lesson.steps.length > 11) throw new Error(`${lesson.id}: ${lesson.steps.length} steps`);
  for (const s of lesson.steps) {
    for (const k of lesson.metrics) if (!(k in s.metrics)) throw new Error(`${lesson.id}/${s.short}: missing ${k}`);
    if (s.short.length > 14) throw new Error(`${lesson.id}: short too long "${s.short}"`);
    const panels = Object.values(s.scene.entities).filter((e) => e.type === "panel").length;
    if (panels > 1) throw new Error(`${lesson.id}/${s.short}: ${panels} panels`);
  }
  writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
}

// ════════════════════════════════════════════════════════════════════════════
// 07·1 asking-nicely — API styles (Trailmix, a hiking app)
// ════════════════════════════════════════════════════════════════════════════
{
  const app = (extra = {}) => phone(0, -24, "Trailmix app", extra);
  const svc = (x, label, glyph, extra = {}) => blk(x, 0, "blue", glyph, [label], { s: 3.6, h: 40, ...extra });
  const four = () => ({
    trails: svc(-10.5, "Trails", "map"),
    people: svc(-3.5, "Users", "user"),
    reviews: svc(3.5, "Reviews", "message"),
    weather: svc(10.5, "Weather", "sun"),
    tdb: db(-10.5, 10, "trails DB"),
  });
  const td = () => L("trails", "tdb", "");

  // step 1–2: one resource service
  const s1 = {
    entities: {
      app: app(),
      trails: blk(0, -10, "blue", "map", ["Trails", "API"], { s: 4, cpu: 0.2 }),
      tdb: db(0, 2, "trails DB"),
      card: card("REST in one card", "globe", [
        "GET    /trails/42   → read one",
        "GET    /trails      → list",
        "POST   /trails      → create",
        "PUT    /trails/42   → replace",
        "DELETE /trails/42   → remove",
        "# nouns live in the URL, verbs come from HTTP",
      ]),
    },
    links: { p: B("app", "trails", "GET /trails/42"), td: L("trails", "tdb", "") },
    flows: [{ route: ["p", "td"], bounce: true, rate: 0.9, speed: 0.8 }],
  };

  const s2 = clone(s1);
  s2.entities.app.tags = [T("list: 20 trails", "paper", "listOrdered")];
  s2.entities.trails.cpu = 0.46;
  s2.links.p = B("app", "trails", "GET /trails?near=me", { labelTone: "amber" });
  s2.entities.card = bars("One list screen", "layers", [
    bar("Sent: 20 full trails", "1.6 MB", 1, "red", { bold: true }),
    bar("Shown: name · km · stars", "8 KB", 0.04, "green"),
  ], ["! GPS tracks and photo lists ride along unused"]);
  s2.flows = [{ route: ["p", "td"], bounce: true, rate: 0.7, speed: 0.6, kind: "heavy" }];

  // step 3–4: four resources, chatty client
  const s3 = {
    entities: { app: app({ tags: [T("trail detail", "paper", "map")] }), ...four() },
    links: {
      a1: B("app", "trails", "1 · /trails/42", { labelAt: 0.7 }),
      a2: B("app", "people", "2 · /users/7", { labelAt: 0.7 }),
      a3: B("app", "reviews", "3 · /reviews", { labelAt: 0.7 }),
      a4: B("app", "weather", "4 · /weather", { labelAt: 0.7 }),
      td: td(),
    },
    flows: [{ route: [["a1", "a2", "a3", "a4"]], bounce: true, rate: 1.1, speed: 0.55 }],
  };
  const s4 = clone(s3);
  s4.entities.card = bars("Time spent waiting", "timer", [
    bar("Wi-Fi · 4 × 25 ms", "100 ms", 0.07, "green"),
    bar("City 4G · 4 × 90 ms", "360 ms", 0.26, "amber"),
    bar("Trailhead 3G · 4 × 350 ms", "1.4 s", 1, "red", { bold: true }),
  ], ["# bytes are small; the round trips dominate"]);
  s4.entities.app.tags = [T("1 bar of signal", "amber", "signal")];

  // step 5: backend for frontend
  const fan = (ids) => ({ fanout: true, routes: ids.map((id) => ({ path: [id] })), bounce: true, rate: 0.7, speed: 1.2 });
  const s5 = {
    entities: {
      app: app({ tags: [T("trail detail", "paper", "map")] }),
      bff: blk(0, -12, "orange", "layers", ["Screen", "API"], { s: 4, sub: "backend for frontend" }),
      ...four(),
    },
    links: {
      p: B("app", "bff", "GET /screens/trail/42", { labelTone: "green" }),
      b1: B("bff", "trails", ""),
      b2: B("bff", "people", ""),
      b3: B("bff", "reviews", ""),
      b4: B("bff", "weather", ""),
      td: td(),
    },
    flows: [
      { route: ["p"], bounce: true, rate: 0.7, speed: 0.55, hold: 0.7 },
      fan(["b1", "b2", "b3", "b4"]),
    ],
  };

  const s6 = clone(s5);
  Object.assign(s6.entities.bff, { glyph: "braces", label: ["GraphQL"], sub: "one endpoint", color: "purple" });
  s6.links.p.label = "POST /graphql";
  s6.entities.card = card("The app asks for a shape", "braces", [
    "trail(id: 42) { name  km  climbM }",
    "  author { name }",
    "  reviews(last: 3) { stars  text }",
    "  forecast { tempC  rainPct }",
    "= one trip, 6 KB, nothing unused",
  ]);

  const s7 = clone(s6);
  for (const k of ["b1", "b2", "b3", "b4"]) s7.links[k].label = "gRPC";
  s7.entities.bff.tags = [T("HTTP/2 · protobuf", "violet", "code")];
  s7.entities.card = bars("One review, two encodings", "code", [
    bar("JSON text", "412 B", 1, "amber"),
    bar("Protobuf binary", "118 B", 0.29, "green", { bold: true }),
  ], ["# typed .proto contract, generated client stubs"]);

  const s8 = clone(s7);
  s8.entities.app = phone(-6, -24, "app v1 · 2024", { tags: [T("expects miles", "amber", "clock")] });
  s8.entities.app2 = phone(6, -24, "app v2", { tags: [T("expects km", "green", "check")] });
  s8.links.p.label = "";
  s8.links.p2 = B("app2", "bff", "");
  delete s8.entities.bff.tags;
  s8.entities.bff.tags = [T("serves both", "amber", "gitBranch")];
  s8.entities.card = card("Change without breaking", "gitBranch", [
    "+ add a field (distanceKm): safe",
    "! rename or remove a field: old apps crash",
    "# big breaks: /v2/… path or a version header",
    "# deprecate → watch usage → sunset date",
  ]);
  s8.flows = [
    { route: ["p"], bounce: true, rate: 0.5, speed: 0.55, hold: 0.5 },
    { route: ["p2"], bounce: true, rate: 0.5, speed: 0.55, hold: 0.5 },
    fan(["b1", "b2", "b3", "b4"]),
  ];

  // step 9–10: idempotency
  const book = () => ({
    app: app({ tags: [T("Book campsite", "paper", "ticket")] }),
    bff: blk(0, -12, "orange", "ticket", ["Bookings", "API"], { s: 4 }),
    bdb: db(0, 1, "bookings"),
  });
  const s9 = {
    entities: {
      ...book(),
      card: card("A tunnel, a retry", "replay", [
        "1. POST /bookings → booked, card charged",
        "2. reply lost: phone loses signal",
        "3. app times out, sends POST again",
        "! two bookings, charged twice",
      ]),
    },
    links: { p: B("app", "bff", "POST /bookings", { labelTone: "amber" }), d: L("bff", "bdb", "INSERT") },
    flows: [{ route: ["p", "d"], rate: 0.9, speed: 0.6, pattern: ["write", "write"] }],
  };
  s9.entities.bdb.tags = [T("2 bookings", "red", "alert")];

  const s10 = clone(s9);
  s10.entities.keys = blk(-8, -12, "orange", "key", ["Seen", "keys"], { s: 3.2, h: 34, sub: "24 h TTL" });
  s10.links.k = B("bff", "keys", "key seen?");
  s10.links.p.label = "POST + Idempotency-Key";
  s10.links.p.labelTone = "green";
  s10.entities.bdb.tags = [T("1 booking", "green", "check")];
  s10.entities.card = card("Idempotency key", "key", [
    "app makes a key once: 7f3c-…",
    "new key → book, store the reply",
    "same key again → return stored reply",
    "= retry as often as you like",
    "# GET, PUT, DELETE are idempotent by design",
  ]);
  s10.flows = [
    { route: ["p", "k"], bounce: true, rate: 0.8, speed: 0.6, kind: "write" },
    { route: ["d"], rate: 0.4, kind: "write" },
  ];

  const s11 = clone(s7);
  s11.entities.keys = blk(-8, -12, "orange", "key", ["Seen", "keys"], { s: 3.2, h: 34, sub: "24 h TTL" });
  s11.links.k = B("bff", "keys", "");
  delete s11.entities.card;

  const M = (trips, payload, screenMs, unused) => ({ trips, payload, screenMs, unused });
  const labScreen = (sub) =>
    lab(30000, 400, [
      ["users", "users", "Trailmix app"],
      ["api", "api_server", "Screen API", sub],
      ["db", "postgres", "trails DB"],
    ], [["users", "api"], ["api", "db"]]);

  write({
    id: "asking-nicely",
    title: "Asking Nicely",
    summary: "REST, GraphQL and gRPC — how the shape of an API decides round trips, bytes and safe retries on a flaky phone network.",
    minutes: 11,
    level: "intermediate",
    metrics: ["trips", "payload", "screenMs", "unused"],
    legend: ["req", "res", ["heavy", "oversized response"], "write"],
    goals: [
      { text: "Describe resources and verbs in a REST API", step: 0 },
      { text: "Spot over-fetching and under-fetching", step: 2 },
      { text: "Explain why round trips hurt most on mobile", step: 3 },
      { text: "Choose between a screen API, GraphQL and gRPC", step: 6 },
      { text: "Make retries safe with idempotency keys", step: 9 },
    ],
    steps: [
      {
        short: "REST",
        chapter: "setup",
        title: "Things with addresses",
        body: [
          `<b>Trailmix</b> is a hiking app: trails, reviews, weather at the trailhead. Its first backend speaks ${term("REST")}: every <i>thing</i> (a trail, a user, a review) is a resource with a URL, and plain HTTP verbs say what to do with it.`,
          "Because the rules are shared by the whole web, a REST API is easy to explore with a browser, easy to cache (a <code>GET</code> is safe to store) and every language already has a client.",
        ],
        metrics: M(1, "3 KB", 240, 20),
        scene: s1,
        lab: labScreen("REST"),
      },
      {
        short: "Over-fetch",
        chapter: "problem",
        title: "A truck to deliver a postcard",
        body: [
          `The new <i>Nearby</i> screen lists 20 trails with a name, distance and star rating. The only endpoint available is <code>GET /trails</code>, which returns each trail in full — GPS track, elevation profile, photo list.`,
          `That is ${term("over-fetching")}: the server sends 1.6 MB so the phone can draw 8 KB worth of text. On a metered data plan the user pays for it, and the screen waits for every byte.`,
        ],
        callout: { kind: "warn", text: "Adding <code>?fields=name,km</code> helps, but every new screen then needs its own field list." },
        changes: ["~ Screen now lists 20 trails", "~ Response grows to 1.6 MB"],
        metrics: M(1, "1.6 MB", 2100, 99),
        scene: s2,
        lab: labScreen("REST · full objects"),
      },
      {
        short: "Under-fetch",
        chapter: "problem",
        title: "Four questions, one screen",
        body: [
          `The trail detail screen needs the trail, its author, the latest reviews and a forecast. With one endpoint per resource, the app has to call four of them — ${term("under-fetching")}.`,
          "Worse, the calls depend on each other: the app only learns the author's id and the trailhead coordinates from the first reply, so the requests run one after another in a waterfall.",
        ],
        changes: ["+ Users, Reviews and Weather services", "~ App makes 4 calls per screen"],
        metrics: M(4, "64 KB", 1500, 70),
        scene: s3,
      },
      {
        short: "Round trips",
        chapter: "insight",
        title: "Latency beats bandwidth",
        body: [
          `On a phone, the cost of a request is mostly the ${term("round trip")}: radio wake-up, the signal travelling to a tower and on to the data center and back. A weak 3G link can add 300–400 ms per trip before a single byte of data arrives.`,
          "Four sequential round trips cost four times that wait. Shaving bytes barely matters; removing trips does.",
        ],
        callout: { kind: "insight", text: "Design mobile APIs around <b>one round trip per screen</b>. Data-center hops between your own services cost ~1 ms; the phone's hop costs hundreds." },
        changes: ["+ Round-trip budget card"],
        metrics: M(4, "64 KB", 1500, 70),
        scene: s4,
      },
      {
        short: "Screen API",
        chapter: "solution",
        title: "Let the server do the running around",
        body: [
          `A ${term("backend for frontend")} (BFF) is a thin API shaped like the app's screens. The phone makes one call; the BFF fans out to Trails, Users, Reviews and Weather inside the data center, where each hop takes a millisecond or two, and returns exactly what the screen draws.`,
          "The cost: every new screen means BFF work, and a web app and a phone app often end up with a BFF each.",
        ],
        changes: ["+ Screen API (BFF) in front of the services", "~ 4 phone round trips → 1"],
        metrics: M(1, "22 KB", 420, 30),
        scene: s5,
        lab: labScreen("backend for frontend"),
      },
      {
        short: "GraphQL",
        chapter: "technique",
        title: "The client writes the order",
        body: [
          `${term("GraphQL")} turns the BFF idea into a general tool. The server publishes a typed schema of everything it knows; the client sends a query naming exactly the fields it wants, through one endpoint. Resolvers on the server fetch each piece.`,
          "No over-fetching, no under-fetching, and front-end teams can change a screen without waiting for a new endpoint.",
        ],
        callout: { kind: "warn", text: "The bill comes later: one POST endpoint defeats ordinary HTTP caching, naive resolvers cause N+1 queries (batch them), and a hostile query can be enormous — enforce depth and cost limits." },
        changes: ["~ Screen API → GraphQL endpoint", "~ Response carries only requested fields"],
        metrics: M(1, "6 KB", 330, 0),
        scene: s6,
      },
      {
        short: "gRPC",
        chapter: "technique",
        title: "Calling a function on another machine",
        body: [
          `Between your own services, a ${term("remote procedure call")} style often fits better than resources. With ${term("gRPC")} you describe functions and messages in a <code>.proto</code> file; tools generate typed client and server code, and calls travel as compact binary over HTTP/2.`,
          "You get strict contracts, smaller payloads, multiplexed connections, deadlines and streaming. Browsers can't speak it natively, so it usually lives behind the BFF or GraphQL layer.",
        ],
        changes: ["~ Internal calls now gRPC over HTTP/2", "~ Payloads ~3.5× smaller"],
        metrics: M(1, "6 KB", 300, 0),
        scene: s7,
      },
      {
        short: "Versioning",
        chapter: "tradeoff",
        title: "Old apps never die",
        body: [
          "Web pages update on refresh; installed apps don't. A year from now some hikers will still run v1, which reads <code>distance</code> in miles. If you rename it to <code>distanceKm</code>, their app breaks on the trail.",
          `So APIs evolve ${term("additively")}: add new fields, keep old ones until usage drops, and reserve a new version (<code>/v2</code> or a header) for changes that truly can't be additive. GraphQL marks fields <code>@deprecated</code>; protobuf never reuses a field number.`,
        ],
        changes: ["+ Old app v1 still in the wild", "~ API answers both versions"],
        metrics: M(1, "6 KB", 300, 0),
        scene: s8,
      },
      {
        short: "Lost reply",
        chapter: "problem",
        title: "Did it work? Try again!",
        body: [
          "A hiker books a campsite as the train enters a tunnel. The server books it and charges the card, but the reply never reaches the phone. The app times out and does the reasonable thing: it retries.",
          `<code>POST</code> is not ${term("idempotent")}: doing it twice does the thing twice. Networks lose replies all the time, so any API that clients retry must handle this.`,
        ],
        changes: ["+ Bookings API", "~ The retry creates a second booking"],
        metrics: M(2, "2 KB", 2600, 0),
        scene: s9,
      },
      {
        short: "Idempotency",
        chapter: "solution",
        title: "Same key, same answer",
        body: [
          `The app generates an ${term("idempotency key")} once per user action and sends it with every attempt. The server records each key with its result; a repeat with a known key gets the stored reply instead of a new booking.`,
          "Now the client may retry freely — on timeouts, on app restarts, even days later within the key's lifetime.",
        ],
        callout: { kind: "tip", text: "Store the key and the booking in the same transaction, or a crash between the two reopens the gap." },
        changes: ["+ Seen-keys store", "~ Requests carry an Idempotency-Key", "~ Bookings 2 → 1"],
        metrics: M(2, "2 KB", 2600, 0),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Pick the style per hop",
        body: [
          table(
            [
              ["REST", "public APIs, cacheable reads, simple CRUD"],
              ["Screen API / GraphQL", "phone and web clients — one trip per screen"],
              ["gRPC", "service-to-service: typed, binary, streaming"],
            ],
            ["Style", "Best at"],
          ),
          takeaways([
            "Over-fetching wastes bytes; under-fetching wastes round trips — on mobile the trips hurt more.",
            "Evolve APIs additively; old clients live for years.",
            "Anything a client may retry needs an idempotency story.",
          ]),
        ],
        metrics: M(1, "6 KB", 300, 0),
        scene: s11,
        lab: labScreen("GraphQL · gRPC inside"),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 07·2 later-please — message queues (Snapfolio, photo-book printing)
// ════════════════════════════════════════════════════════════════════════════
{
  const WX = [-11, -6.6, -2.2, 2.2, 6.6, 11];
  const wk = (i, extra = {}) => blk(WX[i], 10, "purple", "cpu", [`W${i + 1}`], { s: 2.8, h: 34, ...extra });
  const base = (count = 5) => ({
    users: crowd("Photographers", count),
    api: blk(0, -18, "blue", "server", ["Upload", "API"], { cpu: 0.3 }),
    store: db(0, 21, "print files", { r: 2 }),
  });
  const queued = (n, nWorkers = 2, count = 6) => {
    const e = {
      ...base(count),
      q: blk(0, -5, "green", "inbox", ["Job", "Queue"], { s: 4.4, h: 34 }),
      qd: { type: "queue", x: -4.2, y: -6, n, gap: 0.9, dir: [-1, 0], color: "#efb041" },
    };
    for (let i = 0; i < nWorkers; i++) e[`w${i}`] = wk(i + (nWorkers === 2 ? 2 : 0));
    return e;
  };
  const qLinks = (ids) => {
    const l = { u: B("users", "api", "POST /albums"), e: L("api", "q", "enqueue") };
    for (const id of ids) {
      l[`c${id}`] = L("q", `w${id}`, "");
      l[`s${id}`] = L(`w${id}`, "store", "");
    }
    return l;
  };
  const consume = (ids, extra = {}) => ({ route: [ids.map((i) => `c${i}`)], rate: 0.5 * ids.length + 0.4, kind: "msg", ...extra });
  const saves = (ids) => ({ route: [ids.map((i) => `s${i}`)], rate: 0.25 * ids.length + 0.3, kind: "write" });

  const s1 = {
    entities: { ...base(4), card: card("Inside one upload request", "hourglass", ["receive 40 photos", "resize · colour-correct · lay out pages", "render print PDF", "= reply after 8.2 s"]) },
    links: { u: B("users", "api", "POST /albums"), d: L("api", "store", "save PDF") },
    flows: [{ route: ["u"], bounce: true, rate: 0.7, hold: 2, kind: "slow" }, { route: ["d"], rate: 0.3, kind: "write" }],
  };
  s1.entities.api.cpu = 0.55;

  const s2 = clone(s1);
  s2.entities.users.count = 12;
  Object.assign(s2.entities.api, { heat: 1, cpu: 0.98, tags: [T("all threads busy", "red", "flame")] });
  s2.links.u.fail = 0.45;
  s2.flows = [{ route: ["u"], bounce: true, rate: 2.2, hold: 2, kind: "slow" }, { route: ["d"], rate: 0.3, kind: "write" }];
  s2.entities.card = bars("Sunday evening", "trendingUp", [
    bar("Uploads arriving", "90 / min", 1, "red", { bold: true }),
    bar("Uploads the API can finish", "35 / min", 0.39, "amber"),
  ], ["! the rest time out and are lost"]);

  const s3 = { entities: queued(2), links: qLinks([0, 1]), flows: [] };
  s3.entities.w0 = wk(2);
  s3.entities.w1 = wk(3);
  s3.flows = [
    { route: ["u"], bounce: true, rate: 1, speed: 1.3 },
    { route: ["e"], rate: 0.9, kind: "msg" },
    consume([0, 1]),
    saves([0, 1]),
  ];
  s3.entities.card = card("Accept now, work later", "inbox", ["API: validate, store photos, enqueue job", "reply 202 Accepted + job id", "worker: pull job, render, save", "= upload answers in 160 ms"]);

  const s4 = clone(s3);
  s4.entities.users.count = 12;
  s4.entities.qd.n = 13;
  Object.assign(s4.entities.w0, { heat: 0.6, cpu: 0.96 });
  Object.assign(s4.entities.w1, { heat: 0.6, cpu: 0.96 });
  s4.entities.q.tags = [T("oldest job: 18 min", "amber", "clock")];
  s4.flows[0].rate = 2.2;
  s4.flows[1].rate = 2;
  s4.entities.card = bars("The queue is a shock absorber", "inbox", [
    bar("Jobs in", "90 / min", 1, "amber"),
    bar("Jobs out (2 workers)", "30 / min", 0.33, "violet"),
  ], ["# the backlog grows, but nothing is lost", "# users still get an instant reply"]);

  const ALL = [0, 1, 2, 3, 4, 5];
  const s5 = { entities: queued(3, 6, 12), links: qLinks(ALL), flows: [] };
  s5.entities.q.tags = [T("oldest job: 1 min", "green", "clock")];
  s5.flows = [{ route: ["u"], bounce: true, rate: 2.2, speed: 1.3 }, { route: ["e"], rate: 2, kind: "msg" }, consume(ALL), saves(ALL)];
  s5.entities.card = card("Scale the consumers, not the API", "server", ["1 worker ≈ 15 albums / min", "6 workers ≈ 90 / min = the Sunday peak", "# autoscale on queue depth or oldest-job age", "= backlog 4,800 → 300 in 40 min"]);

  const s6 = clone(s5);
  Object.assign(s6.entities.w2, DOWN);
  s6.links.c2 = { ...s6.links.c2, style: "cut", fail: 1 };
  delete s6.links.s2;
  s6.flows = [{ route: ["u"], bounce: true, rate: 1.4, speed: 1.3 }, { route: ["e"], rate: 1.3, kind: "msg" }, consume(ALL.filter((i) => i !== 2).concat([2])), saves([0, 1, 3, 4, 5])];
  delete s6.entities.q.tags;
  s6.entities.q.tags = [T("delete on receive", "red", "alert")];
  s6.entities.card = card("W3 crashed mid-render", "skull", ["queue removed its jobs when W3 took them", "W3 held 12 jobs in memory", "! 12 albums will never print"]);

  const s7 = clone(s6);
  s7.links.c2 = L("q", "w2", "", { style: "cut" });
  s7.entities.q.tags = [T("ack after done", "green", "check")];
  s7.flows = [
    { route: ["u"], bounce: true, rate: 1.4, speed: 1.3 },
    { route: ["e"], rate: 1.3, kind: "msg" },
    { route: [["c0", "c1", "c3", "c4", "c5"]], rate: 2, kind: "msg", bounce: true, hold: 0.8 },
    saves([0, 1, 3, 4, 5]),
  ];
  s7.entities.card = card("Acknowledge, then forget", "check", ["worker takes job → job hidden, not deleted", "finish → worker sends ack → job deleted", "no ack within 5 min → job visible again", "= W3's 12 jobs go to other workers"]);

  const s8 = clone(s5);
  s8.entities.store.tags = [T("job 9187 · done", "green", "check")];
  s8.entities.w2.tags = [T("job 9187 again", "amber", "replay")];
  s8.entities.q.tags = [T("at-least-once", "amber", "replay")];
  s8.entities.card = card("Same job, twice", "replay", ["W3 saved album 9187, then crashed before ack", "job reappears → W4 renders it again", "naive: print + ship 2 books, bill twice", "= idempotent: 'job 9187 done' → skip"]);

  const s9 = clone(s5);
  s9.entities.dlq = blk(9, -16, "orange", "alert", ["Dead", "letters"], { s: 3.4, h: 32, tags: [T("1 job", "red", "bug")] });
  s9.links.dl = L("q", "dlq", "after 5 tries", { labelTone: "red", labelAt: 0.4 });
  s9.entities.q.tags = [T("TIFF 1 of 40 corrupt", "red", "bug")];
  s9.flows = [
    { route: ["u"], bounce: true, rate: 1.6, speed: 1.3 },
    { route: ["e"], rate: 1.5, kind: "msg" },
    { route: [ALL.map((i) => `c${i}`)], rate: 3, pattern: ["msg", "msg", "msg", "poison"] },
    saves(ALL),
    { route: ["dl"], rate: 0.3, kind: "poison" },
  ];
  s9.links.c1.fail = 0.25;
  s9.entities.card = card("A poison message", "bug", ["crashes every worker that tries it", "retry with backoff: 10 s, 40 s, 3 min…", "after 5 attempts → dead-letter queue", "= the line keeps moving; a human looks later"]);

  const s10 = clone(s4);
  s10.entities.qd.n = 18;
  s10.entities.q.tags = [T("max 50,000 jobs", "amber", "gauge")];
  s10.entities.api.tags = [T("full → 503 + retry later", "amber", "ban")];
  s10.links.u.label = "POST /albums";
  s10.entities.card = bars("If in > out, forever", "gauge", [
    bar("Arriving", "900 / min", 1, "red"),
    bar("Processed", "600 / min", 0.67, "violet"),
    bar("Backlog growth", "+18,000 / hour", 0.33, "amber", { bold: true }),
  ], ["# bound the queue · alert on oldest-job age", "# push back on producers or add consumers"]);

  const s11 = clone(s9);
  s11.entities.q.tags = [T("ack · retries · DLQ", "green", "check")];
  delete s11.entities.card;
  s11.links.c1.fail = 0;

  const M = (respond, backlog, workers, lost) => ({ respond, backlog, workers, lost });
  const labQ = (n, st) =>
    lab(20000, 40, [
      ["users", "users", "Photographers"],
      ["api", "api_server", "Upload API"],
      ["q", "sqs", "Job queue", undefined, st],
      ["w", "worker", "Render workers", `${n} workers`],
      ["db", "postgres", "Albums DB"],
    ], [["users", "api"], ["api", "q"], ["q", "w"], ["w", "db"]]);

  write({
    id: "later-please",
    title: "Later, Please",
    summary: "Move slow work out of the request with a message queue — and learn the acks, retries and dead letters that keep jobs from vanishing.",
    minutes: 12,
    level: "intermediate",
    metrics: ["respond", "backlog", "workers", "lost"],
    legend: ["req", "res", "slow", "msg", ["poison", "poison job"], "write", "fail"],
    goals: [
      { text: "Decouple slow work with producers, a queue and consumers", step: 2 },
      { text: "Use the backlog as a buffer and scale consumers", step: 4 },
      { text: "Explain acks and at-least-once delivery", step: 6 },
      { text: "Make consumers idempotent and park poison jobs", step: 8 },
      { text: "Recognise when backpressure is needed", step: 9 },
    ],
    steps: [
      {
        short: "Do it now",
        chapter: "setup",
        title: "The upload that takes eight seconds",
        body: [
          "<b>Snapfolio</b> turns your photos into printed albums. Upload 40 photos and the API does everything on the spot: resize, colour-correct, lay out pages, render a print-ready PDF — then replies.",
          "On a quiet Tuesday that's 8 seconds of spinner. Annoying, but it works.",
        ],
        metrics: M(8200, 0, 0, 0),
        scene: s1,
        lab: lab(2000, 3, [["users", "users", "Photographers"], ["api", "api_server", "Upload API", "renders inline"], ["db", "postgres", "Albums DB"]], [["users", "api"], ["api", "db"]]),
      },
      {
        short: "Sunday rush",
        chapter: "problem",
        title: "Everyone uploads after the weekend",
        body: [
          "Sunday evening, uploads triple. Each one holds an API thread for 8 seconds of CPU work, so the thread pool fills, new uploads queue inside the server, and the load balancer's 30-second timeout starts cutting them off.",
          "The user sees an error after half a minute, and the half-finished album is simply gone.",
        ],
        callout: { kind: "warn", text: "Doing slow work inside a request ties your response time — and your failure rate — to the slowest thing you do." },
        changes: ["~ Uploads 3× higher", "~ API threads saturated", "~ Requests time out"],
        metrics: M(30000, 0, 0, 340),
        scene: s2,
        lab: lab(20000, 40, [["users", "users", "Photographers"], ["api", "api_server", "Upload API", "renders inline", "crit"], ["db", "postgres", "Albums DB"]], [["users", "api"], ["api", "db"]]),
      },
      {
        short: "Add a queue",
        chapter: "solution",
        title: "Take a ticket",
        body: [
          `Split the work. The API — now a ${term("producer")} — checks the upload, stores the photos and puts a small job message on a ${term("message queue")}, then answers <code>202 Accepted</code> with a job id. Separate ${term("consumer")} processes, the workers, pull jobs and do the rendering.`,
          "The app shows “We're building your album” and notifies the user when it's ready. Users wait for a reply that is honest instead of one that is slow.",
        ],
        changes: ["+ Job queue", "+ 2 render workers", "~ API replies 202 Accepted"],
        metrics: M(160, 20, 2, 0),
        scene: s3,
        lab: labQ(2),
      },
      {
        short: "Buffer",
        chapter: "insight",
        title: "The backlog absorbs the spike",
        body: [
          `Sunday again. Jobs now arrive three times faster than two workers can finish them, so the ${term("backlog")} grows. That's fine: the queue stores jobs durably, the API still answers in 160 ms, and nothing is dropped.`,
          "The cost moved from “errors now” to “albums ready later”. Watch the age of the oldest job — that's the delay your users actually feel.",
        ],
        changes: ["~ Backlog grows to 4,800 jobs", "~ Oldest job waits 18 min"],
        metrics: M(160, 4800, 2, 0),
        scene: s4,
        lab: labQ(2, "warn"),
      },
      {
        short: "Scale out",
        chapter: "technique",
        title: "More hands on the line",
        body: [
          "Because producers and consumers only share the queue, each side scales on its own. Add workers and they simply start pulling jobs too; no load balancer or API change is needed.",
          "Autoscaling on queue depth (or oldest-job age) adds workers on Sunday and removes them on Tuesday, so you pay for rendering only when there's rendering to do.",
        ],
        changes: ["+ 4 more workers", "~ Backlog drains to 300"],
        metrics: M(160, 300, 6, 0),
        scene: s5,
        lab: labQ(6),
      },
      {
        short: "Worker dies",
        chapter: "problem",
        title: "Taken is not the same as done",
        body: [
          "Worker W3 runs out of memory on a huge panorama and crashes. Our queue was configured to delete a job the moment a worker receives it, so W3's 12 in-progress jobs vanish with it.",
          "Twelve customers paid for albums that will never arrive, and no error was logged anywhere.",
        ],
        changes: ["- W3 crashed", "~ 12 in-flight jobs lost"],
        metrics: M(160, 300, 5, 12),
        scene: s6,
      },
      {
        short: "Acks",
        chapter: "solution",
        title: "Delete only after an acknowledgement",
        body: [
          `With ${term("acknowledgements")}, receiving a job just hides it for a ${term("visibility timeout")}. The worker deletes it by sending an ack after the PDF is safely saved. If the worker dies first, the timeout expires and the job reappears for another worker.`,
          `This gives ${term("at-least-once delivery")}: every job is processed, possibly more than once.`,
        ],
        callout: { kind: "tip", text: "Set the visibility timeout comfortably above the slowest normal job, or long jobs get handed out twice while still running." },
        changes: ["~ Jobs hidden on receive, deleted on ack", "~ W3's jobs redelivered"],
        metrics: M(160, 312, 5, 0),
        scene: s7,
      },
      {
        short: "Duplicates",
        chapter: "tradeoff",
        title: "Twice is the price of never zero",
        body: [
          "At-least-once has a catch: a worker can finish the work and crash just before its ack. The job comes back and another worker renders the same album again.",
          `So consumers must be ${term("idempotent")}: running a job twice has the same effect as once. Write output to a path derived from the job id, record “job 9187 done” in the same transaction as the result, and skip jobs already marked done.`,
        ],
        callout: { kind: "insight", text: "“Exactly once” delivery is not something a network can promise. You build <i>effectively once</i> from at-least-once plus idempotent processing." },
        changes: ["+ W3 back", "~ Job 9187 delivered twice, processed once"],
        metrics: M(160, 300, 6, 0),
        scene: s8,
        lab: labQ(6),
      },
      {
        short: "Poison job",
        chapter: "technique",
        title: "The job that always fails",
        body: [
          `One album contains a corrupt TIFF that crashes the renderer every time. Redelivery makes it a ${term("poison message")}: it bounces from worker to worker forever, burning capacity.`,
          `Cap the attempts. Retry with growing delays, and after the 5th failure move the job to a ${term("dead-letter queue")} (DLQ). Alert on DLQ size; someone inspects, fixes and replays those jobs later.`,
        ],
        changes: ["+ Dead-letter queue", "~ Retries capped at 5"],
        metrics: M(160, 300, 6, 0),
        scene: s9,
        lab: labQ(6),
      },
      {
        short: "Backpressure",
        chapter: "tradeoff",
        title: "A queue is not infinite",
        body: [
          `A queue hides a mismatch, it doesn't fix it. If jobs arrive faster than you can ever process them, the backlog grows without end, delays reach days and eventually storage runs out.`,
          `${term("Backpressure")} means telling producers to slow down: bound the queue, and when it's full make the API answer <code>503</code> with “try again later” (or throttle uploads), while autoscaling catches up. Better a clear “not now” than a promise you can't keep.`,
        ],
        changes: ["~ Queue bounded at 50,000 jobs", "~ API pushes back when full"],
        metrics: M(160, 18000, 2, 0),
        scene: s10,
        lab: labQ(2, "crit"),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Fast replies, durable work",
        body: [
          takeaways([
            "Queue slow work: reply fast with a job id, let consumers do the rest.",
            "The backlog buffers spikes; scale consumers on its depth and age.",
            "Ack after the work is done → at-least-once delivery.",
            "At-least-once needs idempotent consumers.",
            "Cap retries and park poison jobs in a dead-letter queue.",
            "Bound queues and push back when consumers can't keep up.",
          ]),
        ],
        metrics: M(160, 300, 6, 0),
        scene: s11,
        lab: labQ(6),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 07·3 shout-it-out — pub/sub & events (Bramble, an online plant shop)
// ════════════════════════════════════════════════════════════════════════════
{
  const SX = [-10.5, -3.5, 3.5, 10.5, 17.5];
  const sub = (i, glyph, label, color, extra = {}) => blk(SX[i], 6, color, glyph, label, { s: 3.6, h: 40, ...extra });
  const subs = () => ({
    email: sub(0, "mail", ["Email"], "orange"),
    inv: sub(1, "package", ["Inventory"], "blue"),
    ana: sub(2, "chart", ["Analytics"], "purple"),
    loy: sub(3, "bookmark", ["Loyalty"], "yellow"),
  });
  const SUBS = ["email", "inv", "ana", "loy"];
  const top = () => ({
    users: crowd("Shoppers", 8, 0, -34),
    orders: server(0, -20, ["Orders"], { cpu: 0.3 }),
    pay: blk(9, -20, "purple", "creditCard", ["Payments"], { s: 3.4, h: 36 }),
  });
  const topLinks = () => ({ u: B("users", "orders", "checkout"), pp: B("orders", "pay", "charge") });

  // sync chain
  const syncLinks = () => {
    const l = topLinks();
    for (const id of SUBS) l[`d${id}`] = B("orders", id, "");
    return l;
  };
  const s1 = {
    entities: {
      ...top(),
      ...subs(),
      card: card("Inside one checkout", "cart", ["charge card        180 ms", "send receipt email 420 ms", "reserve stock      150 ms", "record analytics   260 ms", "add loyalty points 240 ms", "= 1.25 s before “Thanks!”"]),
    },
    links: syncLinks(),
    flows: [
      { route: ["u"], bounce: true, rate: 0.6, hold: 1.4, speed: 0.8 },
      { route: [["pp", ...SUBS.map((s) => `d${s}`)]], bounce: true, rate: 1.6 },
    ],
  };

  const s2 = clone(s1);
  Object.assign(s2.entities.email, DOWN);
  s2.links.demail = { ...s2.links.demail, style: "cut", fail: 1 };
  Object.assign(s2.entities.orders, { heat: 0.7, cpu: 0.8, tags: [T("waiting on Email", "red", "hourglass")] });
  s2.flows[0].kind = "slow";
  s2.entities.card = card("Email is down", "mail", ["the email provider times out after 5 s", "Orders waits, then gives up", "! the order fails — the plants were in stock", "# a receipt took down revenue"]);

  const s3 = clone(s1);
  s3.entities.gift = { type: "ghost", x: SX[4], y: 6, s: 3.6, h: 40, label: "Gift box?" };
  s3.links.dgift = L("orders", "gift", "", { style: "dashed" });
  s3.entities.orders.tags = [T("4th redeploy this month", "amber", "rocket")];
  s3.entities.card = card("Every new idea edits Orders", "gitBranch", ["marketing: “free gift on first order”", "→ Orders team adds a 6th call", "→ test, review, redeploy checkout", "! Orders knows everyone downstream"]);

  // publish/subscribe
  const pubLinks = (ids) => {
    const l = { ...topLinks(), pub: L("orders", "topic", "publish OrderPlaced") };
    for (const id of ids) l[`t${id}`] = L("topic", id, "");
    return l;
  };
  const pubFlows = (ids) => [
    { route: ["u", "pp"], bounce: true, rate: 0.9, speed: 1.1 },
    { route: ["pub"], rate: 0.9, kind: "msg" },
    { fanout: true, routes: ids.map((id) => ({ path: [`t${id}`] })), rate: 0.9, kind: "msg" },
  ];
  const topic = (extra = {}) => blk(0, -7, "green", "radio", ["order", "events"], { s: 4.4, h: 34, ...extra });
  const s4 = {
    entities: { ...top(), topic: topic({ sub: "topic" }), ...subs() },
    links: pubLinks(SUBS),
    flows: pubFlows(SUBS),
  };
  s4.entities.card = card("Orders only announces", "radio", ["OrderPlaced { id 881, items, total }", "Email, Inventory, Analytics, Loyalty", "each subscribed on their own", "= Orders doesn't know who listens"]);

  const ALL = [...SUBS, "gift"];
  const s5 = { entities: { ...top(), topic: topic({ sub: "topic" }), ...subs(), gift: sub(4, "gift", ["Gift", "box"], "orange") }, links: pubLinks(ALL), flows: pubFlows(ALL) };
  s5.entities.orders.tags = [T("no change", "green", "check")];

  const s6 = clone(s5);
  delete s6.entities.orders.tags;
  Object.assign(s6.entities.email, DOWN);
  s6.links.temail = { ...s6.links.temail, style: "dashed" };
  s6.entities.eq = { type: "queue", x: SX[0] - 3.2, y: 2.4, n: 9, gap: 0.9, dir: [-1, 0], color: "#efb041" };
  s6.flows = pubFlows(ALL.filter((i) => i !== "email"));
  s6.entities.card = card("Failures stay local", "shield", ["Email's subscription keeps its copies", "1,200 receipts waiting, none lost", "everyone else carries on", "= checkout never noticed"]);

  const s7 = clone(s5);
  delete s7.entities.orders.tags;
  Object.assign(s7.entities.topic, { label: ["event", "log"], sub: "", tags: [T("kept 7 days", "violet", "clock")] });
  s7.entities.email.tags = [T("catching up", "amber", "replay")];
  s7.entities.ana.tags = [T("v2: replay from #0", "violet", "replay")];
  s7.entities.eq = { type: "queue", x: SX[0] - 3.2, y: 2.4, n: 3, gap: 0.9, dir: [-1, 0], color: "#efb041" };
  s7.flows[2] = { fanout: true, routes: ALL.map((id) => ({ path: [`t${id}`] })), rate: 1.4, kind: "msg" };
  s7.entities.card = card("A log, not a mailbox", "listOrdered", ["events appended in order: #1, #2, … #98,412", "each reader keeps its own bookmark", "inventory  at #98,412", "email      at #96,100  (catching up)", "analytics v2 starts at #0 → rebuilds", "# reading never deletes"]);

  // partitions & ordering
  const PX = [-7, 0, 7];
  const part = (i) => blk(PX[i], -7, "green", "inbox", [`P${i}`], { s: 3.2, h: 30 });
  const s8 = {
    entities: {
      ...top(),
      p0: part(0),
      p1: part(1),
      p2: part(2),
      inv: blk(0, 6, "blue", "package", ["Inventory"], { s: 3.6, h: 40 }),
      card: card("Key = order id", "hash", ["hash(order 881) mod 3 = 1 → P1", "P1: Placed → Paid → Shipped → Refunded", "= one order's events stay in order", "! no order promised across P0, P1, P2"]),
    },
    links: { ...topLinks(), o0: L("orders", "p0", ""), o1: L("orders", "p1", "order 881"), o2: L("orders", "p2", ""), i0: L("p0", "inv", ""), i1: L("p1", "inv", ""), i2: L("p2", "inv", "") },
    flows: [
      { route: ["u", "pp"], bounce: true, rate: 0.8, speed: 1.1 },
      { routes: [{ path: ["o0", "i0"] }, { path: ["o1", "i1"], kind: "mine" }, { path: ["o2", "i2"] }], kind: "msg", rate: 1.6 },
    ],
  };
  s8.entities.topic = undefined;
  delete s8.entities.topic;

  const s9 = clone(s8);
  s9.entities.inv = blk(-7, 6, "blue", "package", ["Inventory", "#1"], { s: 3.6, h: 40 });
  s9.entities.inv2 = blk(0, 6, "blue", "package", ["Inventory", "#2"], { s: 3.6, h: 40 });
  s9.entities.inv3 = blk(7, 6, "blue", "package", ["Inventory", "#3"], { s: 3.6, h: 40 });
  s9.links.i1 = L("p1", "inv2", "");
  s9.links.i2 = L("p2", "inv3", "");
  s9.entities.card = card("Consumer groups", "users", ["group inventory: 3 instances, 1 partition each", "group analytics: 1 instance reads all 3", "= share work inside a group", "= every group gets every event", "# 4th instance with 3 partitions → idle"]);

  const s10 = clone(s5);
  delete s10.entities.orders.tags;
  s10.entities.card = card("Done… eventually", "clock", ["shopper sees “Thanks!”    260 ms", "receipt email arrives    ~2 s", "loyalty points appear    ~5 s", "! “where are my points?” tickets", "# events are contracts: version the schema"]);

  const s11 = clone(s5);
  delete s11.entities.orders.tags;

  const M = (checkout, knows, breaks, subsN) => ({ checkout, knows, breaks, subs: subsN });
  const labPub = (n) =>
    lab(50000, 300, [
      ["users", "users", "Shoppers"],
      ["orders", "api_server", "Orders"],
      ["topic", "kafka", "order events", `${n} subscribers`],
      ["w", "worker", "Subscribers"],
      ["db", "postgres", "Orders DB"],
    ], [["users", "orders"], ["orders", "db"], ["orders", "topic"], ["topic", "w"]]);
  const labSync = (st) =>
    lab(50000, 300, [["users", "users", "Shoppers"], ["orders", "api_server", "Orders", "calls 5 services in a row", st], ["db", "postgres", "Orders DB"]], [["users", "orders"], ["orders", "db"]]);

  write({
    id: "shout-it-out",
    title: "Shout It Out",
    summary: "Publish an event once and let any number of services react — fan-out, decoupling, replayable logs, ordering per key and consumer groups.",
    minutes: 12,
    level: "intermediate",
    metrics: ["checkout", "knows", "breaks", "subs"],
    legend: ["req", "res", "slow", "msg", ["mine", "order 881's events"], "fail"],
    goals: [
      { text: "See how direct calls couple a service to everything downstream", step: 1 },
      { text: "Fan out events to independent subscribers", step: 3 },
      { text: "Replay history from an event log", step: 6 },
      { text: "Keep per-key order with partitions", step: 7 },
      { text: "Share work with consumer groups", step: 8 },
    ],
    steps: [
      {
        short: "Call chain",
        chapter: "setup",
        title: "Checkout calls everyone",
        body: [
          "<b>Bramble</b> sells houseplants online. When a shopper checks out, the Orders service charges the card and then, one by one, asks Email to send a receipt, Inventory to reserve stock, Analytics to record the sale and Loyalty to add points.",
          "Each call is quick on its own, but they add up: the shopper stares at a spinner for over a second while Orders runs errands.",
        ],
        metrics: M(1250, 5, "yes", 0),
        scene: s1,
        lab: labSync(),
      },
      {
        short: "Email down",
        chapter: "problem",
        title: "A receipt takes down checkout",
        body: [
          `The email provider has an outage. Orders waits for its 5-second timeout, then treats the whole checkout as failed. Shoppers with full baskets and valid cards can't buy anything.`,
          `This is ${term("temporal coupling")}: Orders can only succeed when every service it calls is up at that same moment. The more services in the chain, the more often one of them isn't.`,
        ],
        changes: ["- Email provider down", "~ Checkout fails after 5 s"],
        metrics: M(5000, 5, "yes", 0),
        scene: s2,
        lab: labSync("crit"),
      },
      {
        short: "New feature",
        chapter: "problem",
        title: "Everyone's changes land in Orders",
        body: [
          "Marketing wants a free gift on a customer's first order. That's a new service — and, with direct calls, another change to Orders: new client code, new error handling, another redeploy of the most critical service in the company.",
          "Orders has become the place where every team's feature has to be wired in.",
        ],
        changes: ["+ Planned Gift service", "~ Orders would make a 6th call"],
        metrics: M(1400, 6, "yes", 0),
        scene: s3,
      },
      {
        short: "Publish",
        chapter: "solution",
        title: "Announce it, don't arrange it",
        body: [
          `Flip the arrows. Orders still charges the card synchronously (it must know the payment worked), then publishes one ${term("event")} — <code>OrderPlaced</code> — to a ${term("topic")} and replies to the shopper.`,
          `Every interested service ${term("subscribes")} to the topic and gets its own copy. This is ${term("publish/subscribe")}: the publisher states a fact; subscribers decide what to do about it.`,
        ],
        callout: { kind: "insight", text: "An event is a fact in the past tense (“order placed”), not a command (“send email”). The publisher doesn't care who reacts." },
        changes: ["+ order-events topic", "~ Orders publishes one event", "~ Subscribers react on their own"],
        metrics: M(260, 1, "no", 4),
        scene: s4,
        lab: labPub(4),
      },
      {
        short: "Fan-out",
        chapter: "technique",
        title: "New listener, zero changes",
        body: [
          `The Gift team creates their own subscription and starts receiving <code>OrderPlaced</code> events. Orders isn't touched or redeployed. This ${term("fan-out")} is the payoff of decoupling: adding a consumer costs the publisher nothing.`,
        ],
        changes: ["+ Gift service subscribes", "~ Orders unchanged"],
        metrics: M(260, 1, "no", 5),
        scene: s5,
        lab: labPub(5),
      },
      {
        short: "Fail apart",
        chapter: "insight",
        title: "One subscriber down, nobody else cares",
        body: [
          "The email provider fails again. This time checkout doesn't notice: Email's subscription simply keeps collecting events — 1,200 receipts waiting — while Inventory, Analytics, Loyalty and Gift carry on.",
          "When Email recovers it works through the pile. Receipts arrive late, but none are lost and no sale was refused.",
        ],
        changes: ["- Email down", "+ Email's copies pile up in its subscription"],
        metrics: M(260, 1, "no", 5),
        scene: s6,
      },
      {
        short: "Event log",
        chapter: "technique",
        title: "Keep the events, rewind at will",
        body: [
          `Many systems store events in an append-only ${term("event log")} kept for days or forever. Consumers don't remove events; each one tracks an ${term("offset")} — how far it has read.`,
          "That makes history reusable: a brand-new Analytics v2 can start at offset 0 and rebuild its numbers from every order ever placed, while Email catches up from where it stopped.",
        ],
        changes: ["~ Topic is now a 7-day log", "~ Analytics v2 replays from the start"],
        metrics: M(260, 1, "no", 5),
        scene: s7,
        lab: labPub(5),
      },
      {
        short: "Ordering",
        chapter: "tradeoff",
        title: "Order, but only per key",
        body: [
          `One log can't absorb unlimited traffic, so it's split into ${term("partitions")} read in parallel. Order is only guaranteed inside a partition.`,
          `So pick a ${term("partition key")}. Keying by order id sends every event about order 881 to the same partition, so Inventory never sees “Refunded” before “Placed”. Events of different orders may interleave, which is fine.`,
        ],
        callout: { kind: "warn", text: "A hot key (one huge customer) lands on one partition and can't be spread. Choose keys with many, evenly busy values." },
        changes: ["+ 3 partitions P0–P2", "~ Events routed by order id"],
        metrics: M(260, 1, "no", 5),
        scene: s8,
      },
      {
        short: "Groups",
        chapter: "technique",
        title: "Share the work, not the events",
        body: [
          `Inventory runs three instances. They join one ${term("consumer group")}: the log assigns each partition to exactly one member, so each event is handled once by the group and order per partition holds.`,
          "Analytics is a different group, so it still receives every event. Inside a group: load-sharing. Across groups: broadcast.",
        ],
        changes: ["~ Inventory scaled to 3 instances", "~ One partition per instance"],
        metrics: M(260, 1, "no", 5),
        scene: s9,
      },
      {
        short: "Eventually",
        chapter: "tradeoff",
        title: "The price of not waiting",
        body: [
          `Checkout is fast because it no longer waits — which means the rest happens ${term("eventually")}. A shopper may look for loyalty points a few seconds too early.`,
          "And the flow is harder to see: no single function shows what happens after a sale. You need event schemas treated as contracts, tracing across consumers, and dead-letter handling for events a subscriber can't process.",
        ],
        changes: ["~ Side effects arrive seconds later"],
        metrics: M(260, 1, "no", 5),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Say it once, let others listen",
        body: [
          takeaways([
            "Keep the calls you truly need answers from (payment) synchronous; publish the rest as events.",
            "Pub/sub fans one event out to any number of independent subscribers.",
            "A slow or broken subscriber only delays itself.",
            "Event logs keep history: consumers track offsets and can replay.",
            "Order holds per partition — key events by the entity they describe.",
            "Consumer groups share partitions; separate groups each get everything.",
          ]),
        ],
        metrics: M(260, 1, "no", 5),
        scene: s11,
        lab: labPub(5),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 07·4 live-wire — real-time updates (Pitchside, live scores for amateur leagues)
// ════════════════════════════════════════════════════════════════════════════
{
  const fans = (count = 9) => crowd("Fans", count, 0, -34);
  const one = () => ({
    users: fans(),
    api: server(0, -20, ["Match", "API"], { cpu: 0.2 }),
    edb: db(0, -7, "match events"),
    scorer: laptop(11, -20, "Scorer"),
  });
  const oneLinks = (q) => ({ q, sc: L("scorer", "api", "POST goal"), ev: L("api", "edb", "") });
  const scoring = { route: ["sc", "ev"], rate: 0.35, kind: "write" };

  const s1 = {
    entities: { ...one(), card: card("HTTP speaks when spoken to", "message", ["client asks → server answers", "server has news → no way to say it", "! fans see the goal only on refresh"]) },
    links: oneLinks(B("users", "api", "GET /match/812")),
    flows: [scoring, { route: ["q"], bounce: true, rate: 0.25 }],
  };
  s1.entities.users.count = 6;

  const s2 = clone(s1);
  s2.links.q.label = "every 2 s: anything new?";
  s2.entities.api.cpu = 0.55;
  s2.entities.card = card("Short polling", "refresh", ["setInterval(() => fetch('/match/812'), 2000)", "news appears ≤ 2 s late, ~1 s on average", "# simple, works everywhere, any proxy"]);
  s2.flows = [scoring, { route: ["q"], bounce: true, rate: 2.4, pattern: ["empty", "empty", "empty", "empty", "empty", "empty", "empty", "req"] }];

  const s3 = clone(s2);
  s3.entities.users.count = 12;
  Object.assign(s3.entities.api, { heat: 0.8, cpu: 0.92, tags: [T("25,000 req/s", "red", "flame")] });
  s3.entities.card = bars("50,000 fans × 30 polls / min", "activity", [
    bar("Requests per second", "25,000", 1, "red", { bold: true }),
    bar("…that carry news", "~500", 0.03, "green"),
  ], ["! faster polling = fresher and costlier", "# slower polling = cheaper and staler"]);
  s3.flows[1].rate = 3;

  const s4 = clone(s1);
  s4.entities.users.count = 12;
  s4.links.q.label = "wait until news (≤ 30 s)";
  Object.assign(s4.entities.api, { cpu: 0.35, tags: [T("50,000 requests held open", "amber", "hourglass")] });
  s4.entities.card = card("Long polling", "hourglass", ["client asks; server holds the request", "news → answer at once", "30 s of quiet → empty answer", "client immediately asks again", "= ~instant, few wasted replies"]);
  s4.flows = [scoring, { route: ["q"], bounce: true, rate: 1, hold: 1.8, pattern: ["req", "req", "empty"] }];

  const s5 = clone(s4);
  delete s5.links.q;
  s5.links.sse = L("api", "users", "text/event-stream", { labelTone: "green" });
  s5.entities.api.tags = [T("50,000 open streams", "green", "radio")];
  s5.entities.card = card("Server-Sent Events", "radio", ["one GET, the response never ends", "data: {\"goal\":\"Rovers 2–1\"}", "browser reconnects by itself", "Last-Event-ID → resume where it left", "# one-way: server → client only"]);
  s5.flows = [scoring, { route: ["sse"], rate: 1.2, kind: "push" }];

  const s6 = clone(s5);
  delete s6.links.sse;
  s6.links.up = L("users", "api", "WebSocket", { heads: "both" });
  s6.links.dn = L("api", "users", "", { heads: "none" });
  s6.entities.api.tags = [T("50,000 sockets", "green", "network")];
  s6.entities.card = card("WebSockets", "network", ["starts as HTTP: Upgrade: websocket", "then a raw two-way pipe", "server → fan: goals, stats, chat", "fan → server: chat, reactions", "# needs LB + proxies that allow long upgrades"]);
  s6.flows = [scoring, { route: ["up"], rate: 0.8, kind: "msg" }, { route: ["dn"], rate: 1.3, kind: "push" }];

  // many connection servers
  const WX = [-9, 0, 9];
  const many = (cpu = 0.5) => ({
    fansA: crowd("Fans", 5, -9, -34, 3),
    users: crowd("Fans", 5, 0, -34, 3),
    fansC: crowd("Fans", 5, 9, -34, 3),
    ws1: server(WX[0], -20, ["Socket", "#1"], { cpu }),
    api: server(WX[1], -20, ["Socket", "#2"], { cpu }),
    ws3: server(WX[2], -20, ["Socket", "#3"], { cpu }),
  });
  const manyLinks = () => ({
    upA: L("fansA", "ws1", "chat: “What a goal!”", { labelTone: "amber" }),
    dnA: L("ws1", "fansA", "", { heads: "none" }),
    dnB: L("api", "users", "", { heads: "none" }),
    dnC: L("ws3", "fansC", "", { heads: "none" }),
  });
  const s7 = {
    entities: {
      ...many(),
      card: card("12,000 sockets per server", "server", ["each fan is pinned to one socket server", "message arrives on #1", "#1 can only push to its own sockets", "! fans on #2 and #3 never see it"]),
    },
    links: manyLinks(),
    flows: [{ route: ["upA"], rate: 0.7, kind: "msg" }, { route: ["dnA"], rate: 0.7, kind: "push" }],
  };
  s7.entities.api.tags = [T("never heard it", "red", "volumeX")];
  s7.entities.ws3.tags = [T("never heard it", "red", "volumeX")];

  const bus = () => blk(0, -7, "orange", "radio", ["Pub/Sub"], { s: 4, sub: "channel match:812" });
  const s8 = {
    entities: { ...many(), bus: bus() },
    links: {
      ...manyLinks(),
      pub: L("ws1", "bus", "PUBLISH", { labelAt: 0.45 }),
      b1: L("bus", "ws1", "", { heads: "none" }),
      b2: L("bus", "api", ""),
      b3: L("bus", "ws3", ""),
    },
    flows: [
      { route: ["upA", "pub"], rate: 0.6, kind: "msg" },
      { fanout: true, routes: [{ path: ["b1", "dnA"] }, { path: ["b2", "dnB"] }, { path: ["b3", "dnC"] }], rate: 0.6, kind: "push" },
    ],
    // b1 reverses along pub; labelled once
  };
  s8.entities.card = card("A shared backplane", "radio", ["every socket server SUBSCRIBEs match:812", "#1 PUBLISHes the chat message once", "bus fans it out to all subscribers", "= each server pushes to its own fans"]);

  const s9 = clone(s8);
  for (const [k, w] of [["h1", "ws1"], ["h2", "api"], ["h3", "ws3"]]) s9.links[k] = L(w, "bus", "", { style: "beat", heads: "none" });
  delete s9.links.b1;
  delete s9.links.b2;
  delete s9.links.b3;
  delete s9.links.pub;
  s9.links.upA.label = "";
  s9.entities.bus.tags = [T("online: 48,210", "green", "users")];
  s9.entities.card = card("Who's here?", "users", ["client heartbeat every 30 s", "server: SET online:fan42 EX 75", "2 missed beats → key expires → offline", "# count online per match, not per server"]);
  s9.flows = [{ routes: [{ path: ["h1"] }, { path: ["h2"] }, { path: ["h3"] }], rate: 1.5, kind: "ping" }];

  const s10 = clone(s8);
  Object.assign(s10.entities.api, { ...DOWN, tags: [T("deploying", "amber", "rocket")] });
  delete s10.links.b2;
  delete s10.links.dnB;
  s10.links.rA = L("users", "ws1", "reconnect", { style: "dashed", labelAt: 0.35 });
  s10.links.rC = L("users", "ws3", "", { style: "dashed" });
  s10.entities.ws1.heat = 0.5;
  s10.entities.ws1.cpu = 0.8;
  s10.entities.ws3.heat = 0.5;
  s10.entities.ws3.cpu = 0.8;
  s10.entities.card = bars("16,000 reconnects", "refresh", [
    bar("All at once", "16,000 in 1 s", 1, "red"),
    bar("Random 0–10 s jitter", "~1,600 / s", 0.1, "green", { bold: true }),
  ], ["# drain: stop new sockets, then close slowly"]);
  s10.flows = [{ route: [["rA", "rC"]], rate: 2.6, kind: "req" }, { fanout: true, routes: [{ path: ["b1", "dnA"] }, { path: ["b3", "dnC"] }], rate: 0.5, kind: "push" }];

  const s11 = clone(s8);
  delete s11.entities.card;

  const M = (rpm, wasted, delay, conns) => ({ rpm, wasted, delay, conns });
  const labOne = (sub, st) =>
    lab(50000, 25000, [["users", "users", "Fans"], ["api", "api_server", "Match API", sub, st], ["db", "postgres", "match events"]], [["users", "api"], ["api", "db"]]);
  const labMany = () =>
    lab(50000, 2000, [["users", "users", "Fans"], ["lb", "load_balancer", "LB", "sticky"], ["api", "api_server", "Socket servers", "×3"], ["bus", "redis", "Pub/Sub", "match channels"]], [["users", "lb"], ["lb", "api"], ["api", "bus"]]);

  write({
    id: "live-wire",
    title: "Live Wire",
    summary: "Push a goal to 50,000 phones within a second: polling, long polling, Server-Sent Events, WebSockets — and how to scale open connections.",
    minutes: 12,
    level: "intermediate",
    metrics: ["rpm", "wasted", "delay", "conns"],
    legend: ["req", "res", "empty", "push", "msg", "write", "ping"],
    goals: [
      { text: "See why plain HTTP can't push and what polling costs", step: 2 },
      { text: "Compare long polling, SSE and WebSockets", step: 5 },
      { text: "Fan out across connection servers with pub/sub", step: 7 },
      { text: "Track presence with heartbeats and TTLs", step: 8 },
      { text: "Survive deploys without a reconnect storm", step: 9 },
    ],
    steps: [
      {
        short: "The goal",
        chapter: "setup",
        title: "A goal nobody hears about",
        body: [
          "<b>Pitchside</b> shows live scores for amateur football leagues. A volunteer scorer taps “Goal!” on a laptop by the pitch; the event lands in the Match API.",
          "But HTTP only answers questions. Until a fan's phone asks again, the server has no way to tell it anything — the goal sits in the database while fans stare at 1–1.",
        ],
        metrics: M(0, "—", "never", 0),
        scene: s1,
        lab: labOne("request/response"),
      },
      {
        short: "Polling",
        chapter: "technique",
        title: "Are we there yet?",
        body: [
          `The simplest fix is ${term("short polling")}: every phone asks “anything new?” every 2 seconds. It works through every firewall and proxy, and a fan sees a goal at most 2 seconds late.`,
          "Almost every answer, though, is “no”.",
        ],
        changes: ["~ Phones poll every 2 s"],
        metrics: M(30, 97, "1 s", 0),
        scene: s2,
        lab: labOne("short polling"),
      },
      {
        short: "Poll cost",
        chapter: "problem",
        title: "Paying for silence",
        body: [
          "Cup final day: 50,000 fans. At 30 polls a minute each, that's 25,000 requests per second — and about 97% of them come back empty. The API fleet is sized for questions with no news.",
          "Poll faster for fresher scores and the cost rises; poll slower and fans hear the crowd cheer before their phone does. Polling makes you trade freshness against load.",
        ],
        changes: ["~ 50,000 fans online", "~ API saturated by empty polls"],
        metrics: M(30, 97, "1 s", 0),
        scene: s3,
        lab: labOne("short polling", "crit"),
      },
      {
        short: "Long poll",
        chapter: "technique",
        title: "Ask once, wait for news",
        body: [
          `With ${term("long polling")} the server doesn't answer “nothing yet”; it holds the request open until something happens or ~30 s pass. The fan gets the goal almost instantly, then immediately asks again.`,
          "Requests drop from 30 to about 2 per fan per minute. The cost moves elsewhere: 50,000 requests are now open at once, so the server must hold many idle connections cheaply.",
        ],
        changes: ["~ Server holds requests until news", "~ 50,000 open requests"],
        metrics: M(2, 30, "90 ms", 50000),
        scene: s4,
        lab: labOne("long polling"),
      },
      {
        short: "SSE",
        chapter: "technique",
        title: "One response that never ends",
        body: [
          `${term("Server-Sent Events")} make the long wait official: the phone opens one HTTP request and the server streams events down it as they happen. It's plain HTTP, the browser reconnects automatically, and the <code>Last-Event-ID</code> header lets it resume without gaps.`,
          "SSE is one-way — perfect for scores, notifications and feeds, where the client mostly listens.",
        ],
        changes: ["- Polling", "+ Event stream from server to fans"],
        metrics: M(0, 0, "40 ms", 50000),
        scene: s5,
        lab: labOne("SSE streams"),
      },
      {
        short: "WebSocket",
        chapter: "technique",
        title: "Both sides talk",
        body: [
          `Pitchside adds match chat. Now fans send too, many times a minute. A ${term("WebSocket")} starts as an HTTP request with an <code>Upgrade</code> header and becomes a persistent two-way channel: small messages flow both ways with no per-message HTTP overhead.`,
          "Use it when the client talks as much as it listens — chat, multiplayer, collaborative editing.",
        ],
        callout: { kind: "tip", text: "If you only push one way, SSE is simpler: it works with ordinary HTTP tooling and reconnects for free." },
        changes: ["~ Event stream → two-way WebSocket", "+ Fans send chat messages"],
        metrics: M(0, 0, "40 ms", 50000),
        scene: s6,
        lab: labOne("WebSockets"),
      },
      {
        short: "Many servers",
        chapter: "problem",
        title: "Your friends are on another server",
        body: [
          `One server can't hold 50,000 busy sockets with room to spare, so Pitchside runs three ${term("connection servers")}. Each socket is pinned to the server it connected to.`,
          "A fan on #1 posts “What a goal!”. Server #1 pushes it to its own 16,000 sockets — and the 34,000 fans on #2 and #3 see nothing.",
        ],
        changes: ["+ 3 socket servers", "~ Each fan pinned to one server"],
        metrics: M(0, 0, "never", 50000),
        scene: s7,
      },
      {
        short: "Backplane",
        chapter: "solution",
        title: "Publish once, every server delivers",
        body: [
          `Connect the servers with a ${term("pub/sub")} backplane (Redis Pub/Sub, NATS or a message broker). Each socket server subscribes to channels for the matches its fans are watching.`,
          "A message arriving at any server is published once to <code>match:812</code>; every subscribed server receives it and pushes it down its own sockets. Servers stay stateless towards each other.",
        ],
        changes: ["+ Pub/Sub backplane", "~ Messages reach fans on every server"],
        metrics: M(0, 0, "40 ms", 50000),
        scene: s8,
        lab: labMany(),
      },
      {
        short: "Presence",
        chapter: "technique",
        title: "Who's watching right now?",
        body: [
          `${term("Presence")} (“48,210 watching”) can't rely on clean disconnects — phones drop into tunnels without saying goodbye. Instead, clients send a heartbeat every 30 s and the server refreshes a key with a TTL in a shared store.`,
          "Miss two heartbeats and the key expires: that fan is offline. Counts are approximate by design, and that's fine for a badge.",
        ],
        changes: ["+ Heartbeats to the shared store", "~ Online count from expiring keys"],
        metrics: M(2, 0, "40 ms", 50000),
        scene: s9,
        lab: labMany(),
      },
      {
        short: "Deploys",
        chapter: "tradeoff",
        title: "Long-lived connections, short-lived servers",
        body: [
          `Restarting server #2 cuts 16,000 sockets. If all clients reconnect instantly, the survivors take a ${term("reconnect storm")} on top of normal traffic.`,
          "Clients should wait a random delay (jitter) and back off on failure; servers should drain: stop accepting new sockets, then close existing ones gradually.",
          table([
            ["Short polling", "rare updates, simplest setup"],
            ["Long polling", "fallback where streams are blocked"],
            ["SSE", "server → client feeds"],
            ["WebSocket", "two-way, chatty clients"],
          ]),
        ],
        changes: ["- Socket #2 restarting", "~ Its fans reconnect with jitter"],
        metrics: M(0, 0, "40 ms", 50000),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Keep the line open",
        body: [
          takeaways([
            "Polling trades freshness for load; most answers are empty.",
            "Long polling holds requests open until there's news.",
            "SSE streams server → client over plain HTTP; WebSockets go both ways.",
            "Open connections pin users to servers — fan out through a pub/sub backplane.",
            "Presence = heartbeats + expiring keys.",
            "Reconnect with jitter and drain servers before deploys.",
          ]),
        ],
        metrics: M(0, 0, "40 ms", 50000),
        scene: s11,
        lab: labMany(),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 08·1 no-single-point — redundancy & failover (Ledgerly, invoicing for small firms)
// ════════════════════════════════════════════════════════════════════════════
{
  const users = () => crowd("Customers", 9, 0, -36);
  const web = (x, label = ["Web"], extra = {}) => server(x, -11, label, { cpu: 0.35, ...extra });
  const pdb = (x, label = "Postgres", extra = {}) => db(x, 2, label, extra);
  const health = { routes: [{ path: ["h1"] }, { path: ["h2"] }], rate: 1.2, kind: "ping" };

  const s1 = {
    entities: { users: users(), web: web(0, ["Web", "server"]), pg: pdb(0) },
    links: { u: B("users", "web", "HTTPS"), d: L("web", "pg", "SQL") },
    flows: [{ route: ["u", "d"], bounce: true, rate: 1.4 }],
  };
  s1.entities.web.tags = [T("only one", "amber", "alert")];
  s1.entities.pg.tags = [T("only one", "amber", "alert")];

  const s2 = clone(s1);
  Object.assign(s2.entities.web, DOWN);
  s2.links.u = { ...s2.links.u, style: "cut", fail: 1 };
  s2.flows = [{ route: ["u"], rate: 1.4 }];
  s2.entities.card = card("Single point of failure", "alert", ["the web server's disk dies at 02:10", "no other machine can serve the site", "! every customer gets an error", "# back when someone rebuilds it: ~3 h"]);

  const s3 = clone(s1);
  s3.entities.card = card("Availability in series", "sigma", ["web server   99.5%", "× database   99.5%", "= both up   99.0%", "# 1% of a year ≈ 88 hours down", "! every extra must-work part multiplies in"]);

  // load balancer + 2 web
  const pair = () => ({
    users: users(),
    lb: lb(0, -23, ["Load", "Balancer"]),
    web: web(-6, ["Web", "#1"]),
    web2: web(6, ["Web", "#2"]),
    pg: pdb(0),
  });
  const pairLinks = () => ({ u: B("users", "lb", "HTTPS"), w1: L("lb", "web"), w2: L("lb", "web2"), d1: L("web", "pg", ""), d2: L("web2", "pg", "") });
  const pairFlow = (ws = ["w1", "w2"]) => ({ routes: ws.map((w) => ({ path: ["u", w, w === "w1" ? "d1" : "d2"] })), bounce: true, rate: 1.8 });
  const s4 = { entities: pair(), links: pairLinks(), flows: [pairFlow()] };
  s4.entities.lb.tags = [T("new SPOF", "amber", "alert")];
  s4.entities.pg.tags = [T("still one", "amber", "alert")];
  s4.entities.card = card("Availability in parallel", "sigma", ["both web servers down: 0.5% × 0.5%", "= web tier up 99.9975%", "× LB 99.99% × DB 99.5%", "= 99.49% — the DB now dominates"]);

  const s5 = clone(s4);
  Object.assign(s5.entities.web2, DOWN);
  delete s5.entities.lb.tags;
  s5.links.h1 = L("lb", "web", "", { style: "beat", heads: "none" });
  s5.links.h2 = L("lb", "web2", "", { style: "beat", heads: "none" });
  s5.links.w2 = { ...s5.links.w2, style: "off" };
  delete s5.links.d2;
  s5.flows = [pairFlow(["w1"]), health];
  s5.entities.card = card("Health checks", "heartPulse", ["LB → GET /health every 5 s", "3 failures in a row → out of rotation", "2 passes → back in", "= users never reach the dead server", "# check what matters: can it reach the DB?"]);

  // standby db
  const withStandby = () => {
    const e = pair();
    e.pg = pdb(-6, "primary");
    e.pg2 = pdb(6, "standby", { tags: [T("in sync", "green", "check")] });
    return e;
  };
  const sbLinks = () => ({ ...pairLinks(), d1: L("web", "pg", ""), d2: L("web2", "pg", ""), rep: L("pg", "pg2", "sync copy") });
  const s6 = { entities: withStandby(), links: sbLinks(), flows: [pairFlow(), { route: ["rep"], rate: 0.8, kind: "write" }] };
  s6.entities.lb.tags = [T("last SPOF", "amber", "alert")];
  s6.entities.card = card("Active–passive database", "database", ["primary takes all reads and writes", "standby replays every change", "heartbeat between them", "# standby waits, ready to take over"]);

  const s7 = { entities: withStandby(), links: sbLinks(), flows: [] };
  Object.assign(s7.entities.pg, DOWN);
  s7.entities.pg2 = pdb(6, "primary", { tags: [T("promoted", "green", "flag")] });
  s7.links = { ...pairLinks(), d1: L("web", "pg2", ""), d2: L("web2", "pg2", ""), rep: L("pg", "pg2", "", { style: "cut" }) };
  s7.entities.lb.tags = [T("last SPOF", "amber", "alert")];
  s7.flows = [pairFlow()];
  s7.entities.card = card("Failover timeline", "clock", ["00 s  primary stops answering", "15 s  3 heartbeats missed → declared dead", "25 s  standby promoted to primary", "40 s  apps reconnect to the new address", "= ~40 s of failed writes, not 3 hours", "! fence the old primary: no split brain"]);

  // active-active LBs
  const aa = () => {
    const e = withStandby();
    e.lb = lb(-6, -23, ["LB", "A"]);
    e.lb2 = lb(6, -23, ["LB", "B"]);
    return e;
  };
  const aaLinks = () => ({
    u: B("users", "lb", "DNS: A"),
    u2: B("users", "lb2", "DNS: B"),
    w1: L("lb", "web"),
    w2: L("lb", "web2"),
    x1: L("lb2", "web"),
    x2: L("lb2", "web2"),
    d1: L("web", "pg", ""),
    d2: L("web2", "pg", ""),
    rep: L("pg", "pg2", "sync copy"),
  });
  const aaFlow = () => ({
    routes: [
      { path: ["u", "w1", "d1"] },
      { path: ["u2", "x2", "d2"] },
      { path: ["u", "w2", "d2"] },
      { path: ["u2", "x1", "d1"] },
    ],
    bounce: true,
    rate: 2,
  });
  const s8 = { entities: aa(), links: aaLinks(), flows: [aaFlow(), { route: ["rep"], rate: 0.8, kind: "write" }] };
  s8.entities.card = card("Active–active vs active–passive", "split", ["active–active: all copies serve traffic", "+ no idle hardware, no switch-over", "! shared state must be safe to split", "active–passive: one serves, one waits", "+ simple for databases, costs a failover"]);

  // multi-AZ
  const zones = (bDown) => ({
    za: { type: "zone", x0: -10.5, x1: -1.5, y0: -27, y1: 6, label: "ZONE A" },
    zb: { type: "zone", x0: 1.5, x1: 10.5, y0: -27, y1: 6, label: bDown ? "ZONE B · POWER CUT" : "ZONE B" },
  });
  const s9 = { entities: { ...zones(), ...aa() }, links: aaLinks(), flows: [aaFlow(), { route: ["rep"], rate: 0.8, kind: "write" }] };
  s9.entities.card = card("Availability zones", "building", ["separate buildings, power and network", "1–2 ms apart: fast enough for sync copies", "each zone has an LB, web and a database", "= a whole building can go dark"]);

  const s10 = { entities: { ...zones(true), ...aa() }, links: aaLinks(), flows: [] };
  for (const id of ["lb2", "web2", "pg2"]) Object.assign(s10.entities[id], DOWN);
  Object.assign(s10.entities.web, { heat: 0.6, cpu: 0.9 });
  s10.links.u2 = { ...s10.links.u2, style: "cut" };
  s10.links.rep = { ...s10.links.rep, style: "cut", label: "" };
  for (const k of ["w2", "x1", "x2", "d2"]) s10.links[k] = { ...s10.links[k], style: "off" };
  s10.flows = [{ route: ["u", "w1", "d1"], bounce: true, rate: 2 }];
  s10.entities.card = bars("Capacity you must keep spare", "gauge", [
    bar("2 zones: run each at ≤ 50%", "pay 2×", 1, "amber"),
    bar("3 zones: run each at ≤ 67%", "pay 1.5×", 0.75, "green", { bold: true }),
  ], ["! the survivor must carry everyone"]);

  const s11 = clone(s9);
  delete s11.entities.card;

  const M = (avail, downtime, spofs, survives) => ({ avail, downtime, spofs, survives });
  const L1 = lab(5000, 200, [["users", "users", "Customers"], ["api", "api_server", "Web server"], ["db", "postgres", "Postgres"]], [["users", "api"], ["api", "db"]]);
  const L2 = (st) => lab(5000, 200, [["users", "users", "Customers"], ["lb", "load_balancer", "Load balancer"], ["api", "api_server", "Web ×2", undefined, st], ["db", "postgres", "Postgres"]], [["users", "lb"], ["lb", "api"], ["api", "db"]]);
  const L3 = (sub) => lab(5000, 200, [["users", "users", "Customers"], ["lb", "load_balancer", "Load balancers", sub], ["api", "api_server", "Web ×2"], ["db", "postgres", "Postgres", "primary"], ["db2", "postgres", "Postgres", "standby"]], [["users", "lb"], ["lb", "api"], ["api", "db"], ["db", "db2"]]);

  write({
    id: "no-single-point",
    title: "No Single Point",
    summary: "Find the parts whose failure takes everything down, then remove them with redundancy, health checks, failover and multiple zones.",
    minutes: 11,
    level: "intermediate",
    metrics: ["avail", "downtime", "spofs", "survives"],
    legend: ["req", "res", "ping", "write", "fail"],
    goals: [
      { text: "Spot single points of failure", step: 1 },
      { text: "Do availability math for series and parallel parts", step: 3 },
      { text: "Route around failures with health checks", step: 4 },
      { text: "Compare active-passive failover and active-active", step: 7 },
      { text: "Spread across zones and budget spare capacity", step: 9 },
    ],
    steps: [
      {
        short: "One of each",
        chapter: "setup",
        title: "One server, one database",
        body: [
          "<b>Ledgerly</b> sends invoices for 5,000 small businesses. It runs on one web server and one Postgres database. Both are solid machines that rarely fail.",
          "“Rarely” adds up, though: each is down roughly half a percent of the time for crashes, patches and hardware swaps.",
        ],
        metrics: M("99.0%", "88 h", 2, "nothing"),
        scene: s1,
        lab: L1,
      },
      {
        short: "Disk dies",
        chapter: "problem",
        title: "When the only one breaks",
        body: [
          `At 02:10 the web server's disk fails. There's no other copy of it, so every customer gets an error until someone rebuilds it.`,
          `A ${term("single point of failure")} (SPOF) is any component whose failure alone stops the whole system. Ledgerly has two: the web server and the database.`,
        ],
        changes: ["- Web server down", "~ Every request fails"],
        metrics: M("99.0%", "88 h", 2, "nothing"),
        scene: s2,
        lab: lab(5000, 200, [["users", "users", "Customers"], ["api", "api_server", "Web server", "DOWN", "crit"], ["db", "postgres", "Postgres"]], [["users", "api"], ["api", "db"]]),
      },
      {
        short: "Nines",
        chapter: "insight",
        title: "Counting nines",
        body: [
          `${term("Availability")} is the share of time the system works. When a request needs <i>every</i> part in a chain, the availabilities multiply — two 99.5% parts give 99.0%.`,
          table([
            ["99%", "3.7 days down / year"],
            ["99.9%", "8.8 hours"],
            ["99.99%", "53 minutes"],
            ["99.999%", "5 minutes"],
          ], ["Availability", "Downtime"]),
        ],
        callout: { kind: "insight", text: "In series, availability only goes down. In parallel — where any one copy is enough — it goes up fast." },
        changes: ["+ Series availability card"],
        metrics: M("99.0%", "88 h", 2, "nothing"),
        scene: s3,
      },
      {
        short: "Two of them",
        chapter: "solution",
        title: "Two web servers and a balancer",
        body: [
          `Add a second web server and a ${term("load balancer")}. Now the web tier is only down if <i>both</i> servers are down at once: 0.5% × 0.5% = 0.0025% of the time.`,
          "But look at the score: the load balancer is a new SPOF and the database still is one. Overall availability is now capped by the weakest single part.",
        ],
        changes: ["+ Load balancer", "+ Second web server"],
        metrics: M("99.49%", "45 h", 2, "a web server"),
        scene: s4,
        lab: L2(),
      },
      {
        short: "Health checks",
        chapter: "technique",
        title: "Noticing a dead server",
        body: [
          `Redundancy only helps if traffic avoids the broken copy. The balancer runs ${term("health checks")}: it calls each server's <code>/health</code> every few seconds and removes one after several failures in a row.`,
          "A shallow check (“the process answers”) misses a server that can't reach its database. A deep check tests real dependencies — but keep it cheap, and don't let one shared dependency fail every server's check at once.",
        ],
        changes: ["- Web #2 down", "+ Health checks every 5 s", "~ Traffic only to Web #1"],
        metrics: M("99.49%", "45 h", 2, "a web server"),
        scene: s5,
        lab: L2("warn"),
      },
      {
        short: "Standby DB",
        chapter: "solution",
        title: "A database waiting in the wings",
        body: [
          `Databases hold state, so you can't just run two independent ones. The common pattern is ${term("active–passive")}: a primary serves everything while a standby receives every change through ${term("replication")} and stays ready.`,
          "With synchronous replication a write is confirmed only once the standby has it too, so a failover loses nothing — at the cost of a little extra write latency.",
        ],
        changes: ["+ Standby database", "~ Changes copied synchronously"],
        metrics: M("99.94%", "5 h", 1, "one server"),
        scene: s6,
        lab: L3("single"),
      },
      {
        short: "Failover",
        chapter: "technique",
        title: "Promoting the standby",
        body: [
          `The primary dies. ${term("Failover")} takes a few steps: notice (missed heartbeats), decide (promote the standby), redirect (move a virtual IP or DNS name so apps reconnect). The total is usually tens of seconds — far better than hours, but not zero.`,
          `Detection is the tricky part: a primary that's only slow or cut off might still be accepting writes. Before promoting, the old primary must be ${term("fenced")} off, or you get two primaries and a split brain.`,
        ],
        changes: ["- Primary down", "~ Standby promoted", "~ Web servers reconnect"],
        metrics: M("99.94%", "5 h", 1, "one server"),
        scene: s7,
      },
      {
        short: "Active-active",
        chapter: "tradeoff",
        title: "Everybody works",
        body: [
          `The web tier was already ${term("active–active")}: both servers take traffic, so losing one just means the other works harder — no switch-over. Do the same for the balancers: two of them, both published in DNS (or sharing a floating address).`,
          "Active–active suits stateless parts. For databases it means multiple writers and conflict resolution, so most teams keep their primary active–passive.",
        ],
        changes: ["+ Second load balancer", "~ No single point left"],
        metrics: M("99.95%", "4.4 h", 0, "one server"),
        scene: s8,
        lab: L3("pair"),
      },
      {
        short: "Zones",
        chapter: "solution",
        title: "Don't share a building",
        body: [
          `Every copy still sits in one data center. A power cut, cooling failure or fibre cut there takes all of them at once — they share a hidden SPOF.`,
          `Cloud regions are split into ${term("availability zones")}: separate buildings with independent power and network, a millisecond or two apart. Put one copy of each tier in each zone, and a whole zone can fail while the other carries on.`,
        ],
        changes: ["+ Zone A and Zone B", "~ One copy of each tier per zone"],
        metrics: M("99.99%", "53 min", 0, "a zone"),
        scene: s9,
        lab: L3("one per zone"),
      },
      {
        short: "Zone lost",
        chapter: "tradeoff",
        title: "The survivor carries everyone",
        body: [
          "Zone B loses power. Health checks and DNS shift all traffic to zone A within seconds. The primary database already lives in zone A, so writes never stop; had it been in B, the standby in A would have been promoted.",
          `The catch is capacity. Zone A must absorb the full load, so with two zones each must normally run at most half full. Three zones need only ⅔ — one reason many teams use three. Redundancy you can't afford to keep spare isn't redundancy.`,
        ],
        changes: ["- Zone B down", "~ Zone A serves all traffic"],
        metrics: M("99.99%", "53 min", 0, "a zone"),
        scene: s10,
        lab: L3("zone B down"),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Assume every part will fail",
        body: [
          takeaways([
            "A SPOF is anything whose failure alone stops the system — hunt for hidden shared ones too.",
            "Series parts multiply availabilities down; parallel copies push them up.",
            "Health checks turn redundancy into actual failure avoidance.",
            "Stateless tiers go active–active; databases usually go active–passive with fenced failover.",
            "Spread copies across zones and keep enough spare capacity to lose one.",
          ]),
        ],
        metrics: M("99.99%", "53 min", 0, "a zone"),
        scene: s11,
        lab: L3("one per zone"),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 08·2 fair-share — rate limiting (Skyglass, a weather data API)
// ════════════════════════════════════════════════════════════════════════════
{
  const ents = () => ({
    users: crowd("Customers", 9, -3, -36),
    bot: laptop(10, -34, "Customer #4471"),
    gw: lb(0, -21, ["API", "Gateway"]),
    api: server(0, -8, ["Forecast", "API"], { cpu: 0.45 }),
    fdb: db(0, 4, "forecasts"),
  });
  const links = () => ({ u: B("users", "gw", "GET /forecast"), b: B("bot", "gw", ""), g: L("gw", "api", ""), d: L("api", "fdb", "") });
  const real = (rate = 1.4) => ({ route: ["u", "g", "d"], bounce: true, rate });

  const s1 = { entities: ents(), links: links(), flows: [real(), { route: ["b", "g", "d"], bounce: true, rate: 0.4 }] };
  s1.entities.card = card("Skyglass today", "sun", ["2,000 customers, each with an API key", "1,200 requests / s at peak", "# no limits: every key may send anything"]);

  const s2 = clone(s1);
  Object.assign(s2.entities.bot, { tags: [T("retry loop bug", "red", "bug")] });
  Object.assign(s2.entities.api, { heat: 1, cpu: 0.98 });
  s2.links.b.label = "9,000 req/s";
  s2.links.b.labelTone = "red";
  s2.links.g.fail = 0.35;
  s2.flows = [real(1), { route: ["b", "g", "d"], bounce: true, rate: 3, kind: "poison" }];
  s2.entities.card = bars("Who is using the API", "users", [
    bar("Customer #4471", "9,000 req/s", 1, "red", { bold: true }),
    bar("All other 1,999 customers", "1,200 req/s", 0.13, "gray"),
  ], ["! one key, 88% of the traffic"]);

  const s3 = clone(s2);
  Object.assign(s3.entities.api, { heat: 0, cpu: 0.47 });
  s3.entities.gw.tags = [T("20 req/s per key", "green", "ban")];
  s3.entities.gw.pills = "above";
  s3.links.g.fail = 0;
  s3.links.b.label = "429 Too Many Requests";
  s3.links.b.labelTone = "amber";
  s3.flows = [real(1.4), { routes: [{ path: ["b"], kind: "empty", weight: 6 }, { path: ["b", "g", "d"], kind: "poison", weight: 1 }], pick: "weights", bounce: true, rate: 2.6 }];
  s3.entities.card = card("The polite “no”", "ban", ["HTTP/1.1 429 Too Many Requests", "Retry-After: 1", "RateLimit-Limit: 20", "RateLimit-Remaining: 0", "# cheap: rejected before any real work"]);

  const s4 = clone(s3);
  s4.entities.gw.tags = [T("1,200 / minute window", "amber", "clock")];
  s4.entities.card = bars("Fixed window: count per minute", "clock", [
    bar("12:00:00–12:00:58", "0", 0.02, "gray"),
    bar("12:00:59", "1,200 ✓", 0.5, "amber"),
    bar("12:01:00 (new window)", "1,200 ✓", 1, "red", { bold: true }),
  ], ["! 2,400 requests in 2 seconds — double the limit"]);

  const s5 = clone(s3);
  s5.entities.gw.tags = [T("sliding window", "green", "clock")];
  s5.entities.card = card("Sliding window estimate", "clock", ["now 12:01:15 → 25% into this minute", "this minute so far:         300", "last minute 1,200 × 75% =   900", "= estimate 1,200 → limit reached", "# 2 counters per key, smooth at edges"]);

  const s6 = clone(s3);
  s6.entities.gw.tags = [T("token bucket", "green", "zap")];
  s6.entities.tok = { type: "queue", x: -4.4, y: -24.5, n: 8, gap: 0.8, dir: [-1, 0], color: "#7cc47f" };
  s6.entities.card = card("Token bucket per key", "zap", ["bucket holds up to 40 tokens (burst)", "refills 20 tokens every second (rate)", "each request spends 1 token", "empty bucket → 429", "= short bursts OK, average stays ≤ 20/s"]);

  // three gateways
  const GX = [-7, 0, 7];
  const multi = () => {
    const e = ents();
    e.gw = lb(GX[1], -21, ["Gateway", "#2"]);
    e.gw1 = lb(GX[0], -21, ["Gateway", "#1"]);
    e.gw3 = lb(GX[2], -21, ["Gateway", "#3"]);
    return e;
  };
  const multiLinks = () => ({
    ...links(),
    b1: B("bot", "gw1", ""),
    b3: B("bot", "gw3", ""),
    g1: L("gw1", "api", ""),
    g3: L("gw3", "api", ""),
  });
  const s7 = { entities: multi(), links: multiLinks(), flows: [] };
  for (const g of ["gw1", "gw", "gw3"]) s7.entities[g].tags = [T("my count: 20", "amber", "hash")];
  s7.entities.bot.tags = [T("gets 60 req/s", "red", "bug")];
  s7.entities.api.cpu = 0.55;
  s7.flows = [real(1.2), { route: [["b1", "b", "b3"], ["g1", "g", "g3"]], bounce: true, rate: 2, kind: "poison" }];
  s7.entities.card = card("Local counters", "hash", ["each gateway counts on its own", "the LB spreads the key over all 3", "! limit 20/s × 3 gateways = 60/s", "# add gateways → the limit drifts up"]);

  const s8 = clone(s7);
  for (const g of ["gw1", "gw", "gw3"]) delete s8.entities[g].tags;
  s8.entities.redis = blk(-12, -12, "orange", "zap", ["Redis"], { s: 3.4, h: 34, sub: "shared counters" });
  s8.links.r1 = L("gw1", "redis", "");
  s8.links.r2 = L("gw", "redis", "INCR", { labelAt: 0.6 });
  s8.links.r3 = L("gw3", "redis", "");
  s8.entities.bot.tags = [T("held to 20 req/s", "green", "check")];
  s8.entities.api.cpu = 0.47;
  s8.flows = [
    real(1.2),
    { route: [["b1", "b", "b3"]], bounce: true, rate: 2, kind: "empty" },
    { route: [["r1", "r2", "r3"]], bounce: true, rate: 2.4, kind: "ping", speed: 1.4 },
  ];
  s8.entities.card = card("One count for the whole fleet", "zap", ["key = rate:4471:12:01", "INCR key → 21   (atomic)", "EXPIRE key 60", "21 > 20 → 429", "# token bucket? one small Lua script", "! Redis down → fail open, alert loudly"]);

  const s9 = clone(s8);
  s9.entities.bot.tags = [T("backs off · Retry-After", "green", "clock")];
  s9.flows[1].rate = 0.8;
  s9.entities.card = card("Limits are product decisions", "key", ["per plan: free 10/s · pro 100/s", "per endpoint: POST /login 5/min per IP", "per tenant: cap total, not just per key", "clients: honour Retry-After + jitter", "# shed load when the backend itself is hot"]);

  const s10 = clone(s8);
  s10.entities.bot.tags = [T("held to 20 req/s", "green", "check")];
  delete s10.entities.card;

  const M = (abuser, served, apiCpu, limited) => ({ abuser, served, apiCpu, limited });
  const lab1 = (st, sub) => lab(2000, 1200, [["users", "users", "Customers"], ["lb", "load_balancer", "API gateway", sub], ["api", "api_server", "Forecast API", undefined, st], ["db", "postgres", "forecasts"]], [["users", "lb"], ["lb", "api"], ["api", "db"]]);
  const lab3 = lab(2000, 1200, [["users", "users", "Customers"], ["lb", "load_balancer", "Gateways ×3", "rate limited"], ["redis", "redis", "Redis", "shared counters"], ["api", "api_server", "Forecast API"], ["db", "postgres", "forecasts"]], [["users", "lb"], ["lb", "redis"], ["lb", "api"], ["api", "db"]]);

  write({
    id: "fair-share",
    title: "Fair Share",
    summary: "Stop one runaway client from starving everyone else: per-key limits, window and token-bucket algorithms, shared counters and polite 429s.",
    minutes: 11,
    level: "intermediate",
    metrics: ["abuser", "served", "apiCpu", "limited"],
    legend: ["req", "res", ["poison", "runaway client"], ["empty", "429 rejected"], ["ping", "counter check"], "fail"],
    goals: [
      { text: "Explain why shared capacity needs per-client limits", step: 1 },
      { text: "Compare fixed windows, sliding windows and token buckets", step: 3 },
      { text: "Enforce one limit across many gateways", step: 7 },
      { text: "Reject politely with 429 and Retry-After", step: 8 },
    ],
    steps: [
      {
        short: "Open door",
        chapter: "setup",
        title: "Anyone may ask anything",
        body: [
          "<b>Skyglass</b> sells weather forecasts through an API. Farms, airlines and app developers each hold an API key and call <code>GET /forecast</code>. Traffic is healthy and the servers are half busy.",
          "Nothing stops a single key from sending as much as it likes. Until now, nobody did.",
        ],
        metrics: M("—", 100, 45, 0),
        scene: s1,
        lab: lab1(undefined, "no limits"),
      },
      {
        short: "Runaway",
        chapter: "problem",
        title: "One bug, everyone's outage",
        body: [
          "Customer #4471 deploys a script with a retry loop and no delay. It hammers the API with 9,000 requests a second — seven times everyone else combined.",
          `The servers don't know whose requests matter. Queues fill, latency soars and requests from all 2,000 customers start failing. This is the ${term("noisy neighbour")} problem.`,
        ],
        changes: ["+ Runaway script on key #4471", "~ API CPU 45% → 98%", "~ 38% of real requests fail"],
        metrics: M(9000, 62, 98, 0),
        scene: s2,
        lab: lab1("crit", "no limits"),
      },
      {
        short: "Limit per key",
        chapter: "solution",
        title: "Everyone gets a budget",
        body: [
          `A ${term("rate limiter")} in the gateway counts requests per API key. Up to 20 per second pass; beyond that the gateway answers <code>429 Too Many Requests</code> immediately, without touching the Forecast API.`,
          "The script still misbehaves, but it can only spend its own budget. Everyone else is served normally again.",
        ],
        callout: { kind: "tip", text: "Rejecting is cheap — microseconds in the gateway — so a limiter keeps working even under a flood." },
        changes: ["+ 20 req/s limit per key", "~ Excess answered with 429"],
        metrics: M(9000, 100, 47, 8980),
        scene: s3,
        lab: lab1(undefined, "20 req/s per key"),
      },
      {
        short: "Fixed window",
        chapter: "technique",
        title: "Counting per minute",
        body: [
          `The simplest algorithm is a ${term("fixed window")}: keep one counter per key per clock minute and reject once it passes 1,200. It needs one number per key and resets itself.`,
          "Its flaw is at the edges. A client can send 1,200 requests at 12:00:59 and 1,200 more at 12:01:00 — twice the intended rate in two seconds.",
        ],
        changes: ["~ Limiter uses 1-minute windows"],
        metrics: M(9000, 100, 49, 8980),
        scene: s4,
      },
      {
        short: "Sliding",
        chapter: "technique",
        title: "Smoothing the edges",
        body: [
          `A ${term("sliding window")} judges the last 60 seconds rather than the current clock minute. Storing every timestamp is exact but heavy; the common shortcut weights the previous window's count by how much of it still overlaps.`,
          "Two counters per key, no boundary spike, and an error small enough to ignore.",
        ],
        changes: ["~ Fixed window → sliding window"],
        metrics: M(9000, 100, 47, 8980),
        scene: s5,
      },
      {
        short: "Token bucket",
        chapter: "technique",
        title: "Allowance with savings",
        body: [
          `A ${term("token bucket")} gives each key a bucket that refills at the allowed rate (20 tokens/s) up to a maximum (40). Each request spends a token; an empty bucket means 429.`,
          "Two knobs say two different things: the refill rate caps the long-run average, the bucket size allows short bursts — like an app that fires 30 calls when it opens.",
        ],
        changes: ["~ Limiter uses a token bucket", "+ Tokens refill 20/s, burst 40"],
        metrics: M(9000, 100, 47, 8980),
        scene: s6,
      },
      {
        short: "3 gateways",
        chapter: "problem",
        title: "Each gateway counts alone",
        body: [
          "Skyglass grows to three gateways behind a load balancer. Each one keeps its counters in its own memory, and the load balancer spreads key #4471 over all three.",
          "Each gateway sees 20 req/s and is happy — so the key actually gets 60. Every gateway you add quietly raises everyone's limit.",
        ],
        changes: ["+ Gateways #1 and #3", "~ Counters are per gateway"],
        metrics: M(9000, 100, 55, 8940),
        scene: s7,
      },
      {
        short: "Shared count",
        chapter: "solution",
        title: "One counter for the fleet",
        body: [
          `Move the counters into a shared, fast store like Redis. Each gateway runs an atomic <code>INCR</code> on the key's counter (or a small script for a token bucket) and gets the fleet-wide count in under a millisecond.`,
          `Decide what happens if the store is unreachable: ${term("fail open")} (allow traffic, risk overload) is usual for public APIs; fail closed suits limits that guard money or security, like login attempts.`,
        ],
        changes: ["+ Redis with shared counters", "~ All gateways check one count"],
        metrics: M(9000, 100, 47, 8980),
        scene: s8,
        lab: lab3,
      },
      {
        short: "Be polite",
        chapter: "tradeoff",
        title: "Tell clients how to behave",
        body: [
          "A good limiter explains itself: <code>Retry-After</code> says when to come back and rate-limit headers show the remaining budget. Well-behaved clients back off with jitter, and #4471's fixed script now waits instead of hammering.",
          `Limits are also product choices: bigger plans get bigger budgets, sensitive endpoints like login get tight per-IP limits, and when the backend itself is struggling, ${term("load shedding")} drops low-priority work regardless of who sent it.`,
        ],
        changes: ["~ Plans get different limits", "~ Client honours Retry-After"],
        metrics: M(20, 100, 46, 0),
        scene: s9,
        lab: lab3,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Fair by construction",
        body: [
          takeaways([
            "Shared capacity needs per-client budgets, or one bug becomes everyone's outage.",
            "Fixed windows are simple but burst at edges; sliding windows smooth them.",
            "Token buckets cap the average rate and allow controlled bursts.",
            "With many gateways, keep counters in a shared store — and choose fail-open or fail-closed.",
            "Reject cheaply with 429 + Retry-After so clients can back off.",
          ]),
        ],
        metrics: M(20, 100, 46, 0),
        scene: s10,
        lab: lab3,
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 08·3 give-up-gracefully — timeouts, retries, breakers, bulkheads (Hearth, grocery delivery)
// ════════════════════════════════════════════════════════════════════════════
{
  const ents = () => ({
    users: crowd("Shoppers", 9, 0, -36),
    orders: server(0, -22, ["Orders"], { cpu: 0.25 }),
    pay: blk(-7, -9, "purple", "creditCard", ["Payments"], { s: 3.8, cpu: 0.35 }),
    pdb: db(-7, 3, "payments DB"),
    recs: blk(7, -9, "yellow", "sparkles", ["Picks"], { s: 3.6, h: 40, sub: "you may also like" }),
  });
  const links = () => ({
    u: B("users", "orders", "POST /checkout"),
    p: B("orders", "pay", "charge"),
    pd: L("pay", "pdb", ""),
    r: B("orders", "recs", "suggest"),
  });
  const happy = (extra = {}) => [{ route: ["u", "p", "pd"], bounce: true, rate: 1.3, ...extra }, { route: ["r"], bounce: true, rate: 0.6 }];

  const s1 = { entities: ents(), links: links(), flows: happy() };
  s1.entities.card = card("One checkout", "cart", ["Orders → Payments: charge card   ~90 ms", "Orders → Picks: suggestions      ~40 ms", "200 worker threads in Orders", "= 240 ms end to end"]);

  const s2 = clone(s1);
  Object.assign(s2.entities.pdb, { heat: 1, cpu: 0.97, tags: [T("disk saturated", "red", "flame")] });
  Object.assign(s2.entities.pay, { heat: 0.6, cpu: 0.4, tags: [T("waiting on DB", "amber", "hourglass")] });
  Object.assign(s2.entities.orders, { heat: 1, cpu: 0.3, tags: [T("200 / 200 threads stuck", "red", "hourglass")] });
  s2.flows = [{ route: ["u", "p", "pd"], bounce: true, rate: 1.6, kind: "slow", hold: 2.5 }];
  s2.entities.card = card("No timeout set", "hourglass", ["the HTTP client's default: wait 60 s", "each stuck call holds an Orders thread", "200 threads × 60 s = full in seconds", "! Orders stops answering anything at all"]);

  const s3 = clone(s2);
  delete s3.entities.orders.tags;
  Object.assign(s3.entities.orders, { heat: 0.2, tags: [T("timeout 800 ms", "green", "timer")] });
  s3.links.p = B("orders", "pay", "charge · gives up at 800 ms", { fail: 0.38 });
  s3.flows = [{ route: ["u", "p", "pd"], bounce: true, rate: 1.6, pattern: ["req", "req", "slow"] }, { route: ["r"], bounce: true, rate: 0.6 }];
  s3.entities.card = card("Choosing a timeout", "timer", ["Payments p99 on a good day: 300 ms", "timeout ≈ p99 × 2–3 → 800 ms", "= a stuck call frees its thread fast", "# failing fast beats failing slowly"]);

  const s4 = clone(s1);
  s4.links.p = B("orders", "pay", "charge · retry once", { fail: 0.04 });
  s4.entities.orders.tags = [T("1 retry on blips", "green", "refresh")];
  s4.flows = [{ route: ["u", "p", "pd"], bounce: true, rate: 1.6, pattern: ["req", "req", "req", "slow"] }, { route: ["r"], bounce: true, rate: 0.6 }];
  s4.entities.card = card("Transient failures", "refresh", ["1 call in 50 hits a blip:", "a restarted pod, a dropped packet", "retry once → almost always succeeds", "= 98% → 99.5% of checkouts OK"]);

  const s5 = clone(s1);
  Object.assign(s5.entities.pay, { heat: 1, cpu: 0.99, tags: [T("4× normal load", "red", "flame")] });
  s5.entities.orders.tags = [T("3 instant retries", "red", "refresh")];
  s5.entities.users.count = 12;
  s5.links.p = B("orders", "pay", "charge · retry, retry, retry", { fail: 0.6, labelTone: "red" });
  s5.flows = [{ route: ["u", "p", "pd"], bounce: true, rate: 3, pattern: ["req", "slow", "slow", "slow"] }, { route: ["r"], bounce: true, rate: 0.6 }];
  s5.entities.card = bars("Retry storm", "refresh", [
    bar("Real checkouts", "1×", 0.25, "gray"),
    bar("+ Orders' 3 retries each", "4×", 1, "red", { bold: true }),
  ], ["! the app retries too: worst case 4 × 4 = 16×", "# retries hit hardest exactly when it's down"]);

  const s6 = clone(s5);
  Object.assign(s6.entities.pay, { heat: 0.3, cpu: 0.78, tags: [T("recovering", "amber", "heartPulse")] });
  s6.entities.orders.tags = [T("backoff + jitter", "green", "clock")];
  s6.entities.users.count = 9;
  s6.links.p = B("orders", "pay", "retry after 100 · 200 · 400 ms ± jitter", { fail: 0.15, labelTone: "amber" });
  s6.flows = [{ route: ["u", "p", "pd"], bounce: true, rate: 1.7, pattern: ["req", "req", "req", "slow"] }, { route: ["r"], bounce: true, rate: 0.6 }];
  s6.entities.card = bars("When do retries land?", "clock", [
    bar("No jitter: all at +100 ms", "spike", 1, "red"),
    bar("Full jitter: random 0–100 ms", "spread", 0.3, "green", { bold: true }),
  ], ["wait = random(0, 100 ms × 2^attempt)", "# cap tries at 3; retry budget ≤ 10% extra"]);

  const s7 = clone(s1);
  Object.assign(s7.entities.pay, { cpu: 0.2, tags: [T("resting", "green", "moon")] });
  s7.entities.orders.tags = [T("breaker OPEN", "red", "power")];
  s7.links.p = B("orders", "pay", "trial call every 30 s", { style: "dashed" });
  s7.flows = [{ route: ["u"], bounce: true, rate: 1.4, kind: "empty" }, { route: ["p"], bounce: true, rate: 0.25, kind: "ping" }, { route: ["r"], bounce: true, rate: 0.6 }];
  s7.entities.card = card("Circuit breaker", "power", ["CLOSED: calls flow, failures counted", "> 50% of last 20 calls fail → OPEN", "OPEN: fail instantly, no call for 30 s", "HALF-OPEN: let a few trial calls through", "trials pass → CLOSED · fail → OPEN again"]);

  const s8 = clone(s7);
  s8.entities.orders.tags = [T("breaker OPEN → fallback", "amber", "power")];
  s8.entities.later = blk(-9, -22, "green", "inbox", ["Charge", "later"], { s: 3.4, h: 32 });
  s8.links.lt = L("orders", "later", "", { heads: "end" });
  s8.flows = [{ route: ["u"], bounce: true, rate: 1.4 }, { route: ["lt"], rate: 1.2, kind: "msg" }, { route: ["p"], bounce: true, rate: 0.25, kind: "ping" }, { route: ["r"], bounce: true, rate: 0.6 }];
  s8.entities.card = card("Degrade, don't die", "layers", ["payments down → accept the order", "queue the charge, confirm by email", "picks down → show cached bestsellers", "= most checkouts still succeed", "# decide per feature: what's good enough?"]);

  const s9 = clone(s1);
  Object.assign(s9.entities.recs, { heat: 1, cpu: 0.95, tags: [T("hangs 5 s", "red", "hourglass")] });
  s9.entities.orders.tags = [T("picks pool full 30/30", "red", "boxes")];
  s9.entities.pay.tags = [T("own pool · fine", "green", "boxes")];
  s9.flows = [{ route: ["u", "p", "pd"], bounce: true, rate: 1.4 }, { route: ["r"], bounce: true, rate: 1, kind: "slow", hold: 1.8 }];
  s9.entities.card = bars("One pool vs bulkheads", "boxes", [
    bar("Shared pool: Picks takes all 200", "checkout starves", 1, "red"),
    bar("Bulkhead: Picks capped at 30", "checkout fine", 0.15, "green", { bold: true }),
  ], ["# like a ship's watertight compartments"]);

  const s10 = clone(s1);
  s10.entities.orders.tags = [T("deadline 2.5 s", "violet", "timer")];
  s10.entities.card = card("Budgets flow downstream", "timer", ["app gives up at 3.0 s", "Orders must answer within 2.5 s", "Payments call: 800 ms × at most 2", "! work after the caller gave up is waste", "# retry in one layer only, and only idempotent calls"]);

  const s11 = clone(s1);
  s11.entities.orders.tags = [T("timeouts · backoff · breaker", "green", "shield")];
  delete s11.entities.card;

  const M = (checkout, success, payLoad, threads) => ({ checkout, success, payLoad, threads });
  const labG = (st = {}) =>
    lab(80000, 900, [
      ["users", "users", "Shoppers"],
      ["api", "api_server", "Orders", st.sub, st.api],
      ["pay", "api_server", "Payments", undefined, st.pay],
      ["db", "postgres", "payments DB", undefined, st.db],
    ], [["users", "api"], ["api", "pay"], ["pay", "db"]]);

  write({
    id: "give-up-gracefully",
    title: "Give Up Gracefully",
    summary: "Slow dependencies are worse than dead ones. Timeouts, careful retries, circuit breakers, fallbacks and bulkheads keep one failure from spreading.",
    minutes: 13,
    level: "advanced",
    metrics: ["checkout", "success", "payLoad", "threads"],
    legend: ["req", "res", "slow", "retry", ["empty", "fast failure"], ["ping", "trial call"], "msg", "fail"],
    goals: [
      { text: "Set timeouts so slow calls can't hold every thread", step: 2 },
      { text: "Retry with backoff and jitter without starting a storm", step: 5 },
      { text: "Stop calling a failing service with a circuit breaker", step: 6 },
      { text: "Degrade with fallbacks and isolate with bulkheads", step: 8 },
      { text: "Propagate deadlines down the call chain", step: 9 },
    ],
    steps: [
      {
        short: "Happy path",
        chapter: "setup",
        title: "A checkout with two helpers",
        body: [
          "<b>Hearth</b> delivers groceries. When a shopper checks out, the Orders service asks Payments to charge the card and asks Picks for “you may also like” suggestions to show on the confirmation page.",
          "Orders handles requests with a pool of 200 worker threads. On a normal evening only a handful are busy at once.",
        ],
        metrics: M(240, 99, "1×", "14 / 200"),
        scene: s1,
        lab: labG(),
      },
      {
        short: "No timeout",
        chapter: "problem",
        title: "Slow is worse than down",
        body: [
          "The payments database's disk saturates and queries slow to many seconds. Payments doesn't fail — it just answers slowly. Orders' HTTP client has the default timeout of 60 seconds, so every checkout thread waits.",
          `Within seconds all 200 threads are stuck. Orders can't even serve requests that don't need Payments. One slow dependency has spread into a full outage: a ${term("cascading failure")}.`,
        ],
        callout: { kind: "warn", text: "A dead service fails fast and frees resources. A slow one holds them. Every remote call needs a timeout." },
        changes: ["~ Payments DB slows to seconds", "~ All Orders threads waiting"],
        metrics: M(30000, 3, "1×", "200 / 200"),
        scene: s2,
        lab: labG({ api: "crit", pay: "warn", db: "crit" }),
      },
      {
        short: "Timeouts",
        chapter: "solution",
        title: "Decide how long to wait",
        body: [
          `Set an explicit ${term("timeout")} on the Payments call, based on how it normally behaves: if its p99 is 300 ms, waiting 800 ms covers healthy slow calls while cutting off sick ones.`,
          "Checkouts that hit the timeout fail — but they fail in under a second, threads come back, and the rest of Orders keeps working.",
        ],
        changes: ["+ 800 ms timeout on Payments calls", "~ Threads freed quickly"],
        metrics: M(800, 62, "1×", "52 / 200"),
        scene: s3,
        lab: labG({ db: "crit" }),
      },
      {
        short: "Retry",
        chapter: "technique",
        title: "Most blips go away",
        body: [
          `The database recovers. Now a different pattern shows up: about one call in 50 fails for passing reasons — a pod restarting, a dropped connection. Those are ${term("transient failures")}, and an immediate second try almost always works.`,
          "One retry lifts success from 98% to 99.5% for a few percent more load. Retrying is only safe because the charge carries an idempotency key — a repeated charge can't bill twice.",
        ],
        changes: ["~ Payments DB healthy", "+ One retry on failure"],
        metrics: M(300, 99, "1.05×", "16 / 200"),
        scene: s4,
        lab: labG(),
      },
      {
        short: "Retry storm",
        chapter: "problem",
        title: "Retries pile on a struggling service",
        body: [
          "Friday at 6 pm Payments gets busy and starts failing some calls. Orders retries each failure three times, instantly. The phone app also retries failed checkouts. Payments, already overloaded, now gets four times the traffic — and fails even more.",
          `This ${term("retry storm")} feeds itself: the more it fails, the more it's retried. Retries that help with blips make real overload much worse.`,
        ],
        changes: ["~ Payments overloaded", "~ 3 immediate retries per failure", "~ Load on payments ×4"],
        metrics: M(2400, 18, "4×", "200 / 200"),
        scene: s5,
        lab: labG({ api: "crit", pay: "crit" }),
      },
      {
        short: "Backoff",
        chapter: "solution",
        title: "Wait longer, and not all together",
        body: [
          `${term("Exponential backoff")} doubles the wait before each attempt (100, 200, 400 ms…), giving a struggling service room to recover. ${term("Jitter")} randomises each wait so thousands of clients don't retry in the same millisecond.`,
          "Add a cap (at most 3 tries) and a retry budget (retries may add at most 10% extra load), and retry in one layer only — not in the app, Orders and Payments all at once.",
        ],
        changes: ["~ Retries back off exponentially", "+ Random jitter", "~ Load on payments 4× → 1.2×"],
        metrics: M(600, 91, "1.2×", "60 / 200"),
        scene: s6,
        lab: labG({ pay: "warn" }),
      },
      {
        short: "Breaker",
        chapter: "technique",
        title: "Stop calling, for a while",
        body: [
          `When Payments is clearly down, even careful retries waste time. A ${term("circuit breaker")} in Orders watches recent results; once most calls fail, it <i>opens</i> and fails every call instantly without touching the network.`,
          "After a cool-down it goes half-open and lets a few trial calls through. If they succeed, it closes and traffic resumes; if not, it waits again. Payments gets quiet time to recover.",
        ],
        changes: ["+ Circuit breaker (open)", "~ Payments receives trial calls only"],
        metrics: M(20, 40, "0.1×", "8 / 200"),
        scene: s7,
      },
      {
        short: "Fallback",
        chapter: "solution",
        title: "A worse answer beats no answer",
        body: [
          `Failing fast protects the system, but the shopper still sees an error. A ${term("fallback")} gives a degraded but useful result instead: accept the order, queue the charge, and confirm by email once Payments is back (with limits for new customers to manage fraud risk).`,
          "If Picks is down, show cached bestsellers. Every dependency deserves the question: what's good enough when it's gone?",
        ],
        changes: ["+ Charge-later queue", "~ Orders accepted while Payments rests"],
        metrics: M(260, 96, "0.1×", "12 / 200"),
        scene: s8,
      },
      {
        short: "Bulkheads",
        chapter: "technique",
        title: "Watertight compartments",
        body: [
          "Now Picks hangs for 5 seconds per call. Suggestions are optional, but with one shared thread pool, slow Picks calls slowly take all 200 threads and checkout starves — a nice-to-have breaking a must-have.",
          `${term("Bulkheads")} give each dependency its own limited pool (or concurrency limit): Picks may use 30 threads, Payments 120. When Picks is slow, only its compartment floods.`,
        ],
        changes: ["~ Picks hangs", "+ Separate pools per dependency"],
        metrics: M(280, 99, "1×", "70 / 200"),
        scene: s9,
        lab: labG(),
      },
      {
        short: "Deadlines",
        chapter: "insight",
        title: "Time budgets flow downstream",
        body: [
          `Timeouts must fit inside each other. If the app gives up at 3 s, Orders has about 2.5 s, so its Payments call can take at most 800 ms twice. Passing a ${term("deadline")} with each request lets every service stop work nobody is waiting for any more.`,
          "Together: timeouts bound waiting, backoff and budgets bound retries, breakers stop hopeless calls, fallbacks keep value, bulkheads contain damage.",
        ],
        changes: ["+ Deadline passed with each call"],
        metrics: M(260, 99, "1×", "16 / 200"),
        scene: s10,
        lab: labG({ sub: "deadline 2.5 s" }),
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Fail fast, fail small",
        body: [
          takeaways([
            "Every remote call needs a timeout based on its normal latency.",
            "Retry transient failures — with exponential backoff, jitter, a cap and idempotency.",
            "Retry storms turn overload into collapse; retry in one layer only.",
            "Circuit breakers stop calling a failing service and probe for recovery.",
            "Fallbacks give a degraded answer; bulkheads keep one slow dependency from taking every thread.",
          ]),
        ],
        metrics: M(260, 99, "1×", "16 / 200"),
        scene: s11,
        lab: labG(),
      },
    ],
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 08·4 seeing-in-the-dark — observability (Quillmail, newsletters for writers)
// ════════════════════════════════════════════════════════════════════════════
{
  const ents = () => ({
    users: crowd("Writers", 9, 0, -36),
    gw: lb(0, -23, ["Gateway"]),
    lists: server(-8, -10, ["Lists"], { s: 3.6 }),
    send: server(0, -10, ["Send"], { s: 3.6 }),
    bill: server(8, -10, ["Billing"], { s: 3.6 }),
    tmpl: blk(1, 3, "orange", "file", ["Templates"], { s: 3.6, h: 40 }),
    sdb: db(-12, 1, "subscribers"),
  });
  const links = (failT = 0) => ({
    u: B("users", "gw", "POST /send"),
    gl: B("gw", "lists", ""),
    gs: B("gw", "send", ""),
    gb: B("gw", "bill", ""),
    ld: L("lists", "sdb", ""),
    st: B("send", "tmpl", "render", failT ? { fail: failT } : {}),
  });
  const traffic = (extra = {}) => [
    { route: ["u", ["gl", "gs", "gb", "gs"]], bounce: true, rate: 1.6 },
    { route: ["st"], bounce: true, rate: 0.8, ...extra },
    { route: ["ld"], rate: 0.4, kind: "write" },
  ];
  const obsEnts = () => ({ obs: blk(15, -4, "green", "chartLine", ["Telemetry"], { s: 4 }) });
  const obsLinks = () => ({
    t1: L("lists", "obs", "", { style: "dashed", pts: ["lists", ["lists", "obs"], "obs"] }),
    t2: L("send", "obs", "", { style: "dashed", pts: ["send", ["send", "obs"], "obs"] }),
    t3: L("bill", "obs", "", { style: "dashed" }),
    t4: L("tmpl", "obs", "", { style: "dashed" }),
  });
  const tele = { routes: [{ path: ["t1"] }, { path: ["t2"] }, { path: ["t3"] }, { path: ["t4"] }], rate: 1.6, kind: "write", speed: 1.2 };
  const withObs = (failT = 0.08) => ({
    entities: { ...ents(), ...obsEnts() },
    links: { ...links(failT), ...obsLinks() },
    flows: [...traffic({ pattern: ["req", "req", "slow"] }), tele],
  });

  const s1 = { entities: ents(), links: links(0.08), flows: traffic({ pattern: ["req", "req", "slow"] }) };
  s1.entities.card = card("What the team saw", "eyeOff", ["14:02  new template engine deployed", "14:02–16:00  nothing", "16:05  a writer posts: “my issue never went out”", "! 3% of sends failing for two hours"]);

  const s2 = clone(s1);
  s2.entities.oncall = laptop(15, -20, "On-call");
  s2.links.ss = L("oncall", "send", "ssh + grep", { style: "dashed", labelAt: 0.4 });
  s2.links.sl = L("oncall", "bill", "", { style: "dashed" });
  s2.entities.card = card("send-07: /var/log/app.log", "scroll", ["ERROR something went wrong", "WARN retrying...", "ERROR something went wrong", "# 14 machines, different formats, no request ids", "! which of these is our problem?"]);

  const s3 = withObs();
  s3.entities.card = card("Golden numbers per service", "chartLine", ["RED (requests): Rate · Errors · Duration", "send: 420/s · 3.1% errors · p99 2.4 s", "lists: 400/s · 0.0% · p99 40 ms", "USE (resources): Utilization · Saturation · Errors", "templates CPU 92%, queue 140"]);

  const s4 = withObs();
  s4.entities.card = card("One event = one JSON line", "braces", ["{\"svc\":\"send\",\"lvl\":\"error\",", " \"req\":\"r-7f3a\",\"list\":\"bakers-weekly\",", " \"err\":\"render timeout\",\"ms\":2004}", "# query: svc=send AND err=* | count by err", "= 98% are “render timeout”"]);

  const s5 = withObs();
  s5.entities.tmpl.heat = 0.8;
  s5.entities.tmpl.tags = [T("render 1.9 s", "red", "timer")];
  s5.links.gs.label = "trace r-7f3a";
  s5.entities.card = bars("Trace r-7f3a · 2.1 s", "waypoints", [
    bar("gateway", "2.10 s", 1, "gray"),
    bar("  send", "2.06 s", 0.98, "gray"),
    bar("    lists.lookup", "40 ms", 0.02, "green"),
    bar("    templates.render", "1.92 s", 0.91, "red", { bold: true, from: 0.05 }),
  ], ["# each span: service, start, duration, parent"]);

  const s6 = withObs(0);
  s6.entities.oncall = laptop(15, -20, "On-call", { tags: [T("40 pages / week", "red", "bell")] });
  s6.links.al = L("obs", "oncall", "CPU > 80%!", { labelTone: "red" });
  s6.flows = [...traffic(), tele, { route: ["al"], rate: 1.6, kind: "kill" }];
  s6.entities.card = card("Alerting on causes", "bell", ["CPU > 80% on any machine → page", "disk > 70% → page", "any ERROR log line → page", "! 38 of 40 pages: nothing users noticed", "# people learn to ignore the pager"]);

  const s7 = withObs(0);
  s7.entities.oncall = laptop(15, -20, "On-call", { tags: [T("2 pages / month", "green", "bell")] });
  s7.links.al = L("obs", "oncall", "SLO burn", { labelTone: "green" });
  s7.flows = [...traffic(), tele, { route: ["al"], rate: 0.2, kind: "kill" }];
  s7.entities.card = card("Alert on what users feel", "target", ["SLI: issues accepted and sent within 60 s", "SLO: 99.9% over 30 days", "= error budget 0.1% ≈ 43 min a month", "# page only when the budget burns fast"]);

  const s8 = clone(s7);
  s8.entities.card = bars("Burn rate → action", "flame", [
    bar("1× · budget lasts 30 days", "fine", 0.07, "green"),
    bar("6× · gone in 5 days", "ticket", 0.43, "amber"),
    bar("14× · gone in ~2 days", "page now", 1, "red", { bold: true }),
  ], ["# check a long and a short window together"]);

  const s9 = withObs(0.08);
  s9.entities.oncall = laptop(15, -20, "On-call", { tags: [T("paged 14:04", "amber", "siren")] });
  s9.links.al = L("obs", "oncall", "burn 30×", { labelTone: "red" });
  s9.entities.tmpl.tags = [T("v2 · slow render", "red", "timer")];
  s9.flows = [...traffic({ pattern: ["req", "req", "slow"] }), tele, { route: ["al"], rate: 0.5, kind: "kill" }];
  s9.entities.card = card("The same bug, replayed", "siren", ["14:02  template engine v2 deployed", "14:04  burn-rate page: send SLO", "14:05  dashboard: only send errors, p99 up", "14:07  trace: templates.render 1.9 s", "= 14:09 rolled back — 7 min, not 4 h"]);

  const s10 = withObs(0);
  s10.entities.card = bars("Telemetry has a bill", "dollar", [
    bar("Metric label user_id", "2M series", 1, "red"),
    bar("Metric label plan", "3 series", 0.02, "green"),
    bar("Traces kept: 1% + all errors", "affordable", 0.2, "green", { bold: true }),
  ], ["! high-cardinality ids go in logs and traces, not metric labels"]);

  const s11 = withObs(0);
  s11.entities.oncall = laptop(15, -20, "On-call", { tags: [T("SLO alerts", "green", "bell")] });
  s11.links.al = L("obs", "oncall", "");
  s11.flows = [...traffic(), tele, { route: ["al"], rate: 0.2, kind: "kill" }];

  const M = (detect, locate, signals, errors) => ({ detect, locate, signals, errors });
  const base = [["users", "users", "Writers"], ["lb", "load_balancer", "Gateway"], ["api", "api_server", "Send", "+ Lists, Billing"], ["db", "postgres", "subscribers"]];
  const labO = (mon, st) =>
    lab(30000, 400, [...base.map((n) => (n[0] === "api" && st ? [...n, st] : n)), ...(mon ? [["mon", "monitoring", "Telemetry", mon]] : [])], [["users", "lb"], ["lb", "api"], ["api", "db"], ...(mon ? [["api", "mon"]] : [])]);

  write({
    id: "seeing-in-the-dark",
    title: "Seeing in the Dark",
    summary: "Find out something is wrong before your users tell you — and where: metrics, structured logs, distributed traces, SLOs and alerts that matter.",
    minutes: 12,
    level: "intermediate",
    metrics: ["detect", "locate", "signals", "errors"],
    legend: ["req", "res", "slow", "telemetry", ["kill", "alert"], "fail"],
    goals: [
      { text: "Watch every service with RED and USE metrics", step: 2 },
      { text: "Search structured logs by request", step: 3 },
      { text: "Follow one request across services with a trace", step: 4 },
      { text: "Alert on symptoms with SLOs and burn rates", step: 6 },
      { text: "Keep telemetry cost and cardinality in check", step: 9 },
    ],
    steps: [
      {
        short: "Blind",
        chapter: "setup",
        title: "Users noticed first",
        body: [
          "<b>Quillmail</b> sends newsletters for independent writers: a gateway, Lists, Send, Billing and a Templates service that renders each issue.",
          "At 14:02 a new template engine went out. For two hours, 3% of newsletters silently failed to send. The team found out when a writer complained publicly — that's the only alerting system they had.",
        ],
        metrics: M("2 h", "4 h", "none", 3),
        scene: s1,
        lab: labO(null, "warn"),
      },
      {
        short: "ssh & grep",
        chapter: "problem",
        title: "Searching 14 machines by hand",
        body: [
          "The on-call engineer logs into machines one by one and greps text files. Messages are vague, formats differ per service, and nothing links a log line to the request that caused it.",
          `Hours go by just working out <i>which</i> service is failing. ${term("Observability")} is the ability to answer new questions about a running system from the data it emits — and right now it emits almost nothing useful.`,
        ],
        changes: ["+ On-call engineer", "~ Logs read machine by machine"],
        metrics: M("2 h", "4 h", "scattered logs", 3),
        scene: s2,
      },
      {
        short: "Metrics",
        chapter: "technique",
        title: "A few numbers for everything",
        body: [
          `${term("Metrics")} are cheap numeric time series. For every service that handles requests, track ${term("RED")}: request <b>R</b>ate, <b>E</b>rror rate and <b>D</b>uration (as percentiles). For every resource — CPU, disk, queue, pool — track ${term("USE")}: <b>U</b>tilization, <b>S</b>aturation and <b>E</b>rrors.`,
          "A dashboard of those answers “is something wrong, and roughly where?” in seconds: Send's errors and p99 jumped at 14:02; Lists didn't move.",
        ],
        changes: ["+ Telemetry pipeline", "+ RED metrics per service"],
        metrics: M("20 min", "1 h", "metrics", 3),
        scene: s3,
        lab: labO("metrics", "warn"),
      },
      {
        short: "Logs",
        chapter: "technique",
        title: "Logs a machine can query",
        body: [
          `${term("Structured logs")} write each event as fields (JSON) rather than prose: service, level, request id, list, error, duration. Shipped to one central store, they can be filtered and counted like a database.`,
          "One query shows that 98% of Send's errors are “render timeout” — the problem is downstream of Send.",
        ],
        changes: ["~ Logs are JSON with request ids", "~ All logs in one searchable store"],
        metrics: M("20 min", "1 h", "metrics + logs", 3),
        scene: s4,
        lab: labO("metrics · logs", "warn"),
      },
      {
        short: "Traces",
        chapter: "technique",
        title: "Follow one request end to end",
        body: [
          `A ${term("distributed trace")} follows a single request through every service. The gateway assigns a trace id and passes it along in headers; each service records ${term("spans")} — what it did, when, for how long, and for which parent.`,
          "Laid out as a waterfall, trace r-7f3a points straight at it: 1.92 of its 2.1 seconds are spent in <code>templates.render</code>.",
        ],
        changes: ["+ Trace ids passed between services", "~ Slow span found in Templates"],
        metrics: M("20 min", "10 min", "metrics, logs, traces", 3),
        scene: s5,
        lab: labO("metrics · logs · traces", "warn"),
      },
      {
        short: "Too loud",
        chapter: "problem",
        title: "The pager that cried wolf",
        body: [
          "Dashboards need someone watching, so the team adds alerts: CPU above 80%, disk above 70%, any error log. The pager goes off 40 times a week; almost every page is harmless.",
          `Engineers start ignoring it — and a real incident sits unacknowledged for 45 minutes. Alerts on <i>causes</i> are noisy, because systems routinely run hot without hurting anyone.`,
        ],
        changes: ["+ Alerts on CPU, disk, errors", "~ 40 pages a week"],
        metrics: M("ignored", "10 min", "metrics, logs, traces", 0.2),
        scene: s6,
        lab: labO("cause-based alerts"),
      },
      {
        short: "SLOs",
        chapter: "solution",
        title: "Promise something users care about",
        body: [
          `Alert on ${term("symptoms")} instead. Pick a ${term("service level indicator")} (SLI) users feel: the share of issues sent within 60 s. Set a ${term("service level objective")} (SLO): 99.9% over 30 days.`,
          `That leaves an ${term("error budget")} of 0.1% — about 43 minutes of full outage a month. Small blips spend a little budget and wake nobody; anything that threatens the promise pages.`,
        ],
        changes: ["+ SLO on sends", "~ Pages drop to ~2 a month"],
        metrics: M("5 min", "10 min", "metrics, logs, traces", 0.2),
        scene: s7,
        lab: labO("SLO alerts"),
      },
      {
        short: "Burn rate",
        chapter: "technique",
        title: "How fast is the budget going?",
        body: [
          `The ${term("burn rate")} compares how fast you're spending the error budget with the pace that would use exactly all of it in 30 days. At 1× all is well; at 14× the month's budget is gone in about two days — page now. A slow 6× burn becomes a ticket for working hours.`,
          "Check a long and a short window together, so a brief spike doesn't page and a recovered incident stops paging quickly.",
        ],
        changes: ["~ Alerts keyed to burn rate"],
        metrics: M("5 min", "10 min", "metrics, logs, traces", 0.2),
        scene: s8,
      },
      {
        short: "Replay",
        chapter: "insight",
        title: "The same incident, with eyes",
        body: [
          "Rewind to the bad deploy, with everything in place. Two minutes in, the send SLO burns at 30× and pages. The dashboard shows only Send unhealthy; a trace shows Templates rendering for 1.9 s. Rollback at 14:09.",
          "Detection went from 2 hours to 2 minutes, diagnosis from 4 hours to 5 minutes — and a writer never had to tell anyone.",
        ],
        changes: ["~ Bad deploy replayed", "~ Burn-rate page after 2 min"],
        metrics: M("2 min", "5 min", "metrics, logs, traces", 3),
        scene: s9,
        lab: labO("SLO alerts", "warn"),
      },
      {
        short: "Cost",
        chapter: "tradeoff",
        title: "Seeing everything costs money",
        body: [
          `Telemetry has a bill. Each unique combination of metric labels is a separate time series, so a label like <code>user_id</code> creates millions — a ${term("cardinality")} explosion. Keep per-user detail in logs and traces.`,
          "Traces are usually sampled: keep, say, 1% of normal requests plus every error and slow one. Logs need levels and retention limits. Spend where it answers questions.",
        ],
        changes: ["~ Traces sampled", "~ No ids in metric labels"],
        metrics: M("2 min", "5 min", "metrics, logs, traces", 0.2),
        scene: s10,
      },
      {
        short: "Recap",
        chapter: "recap",
        title: "Know before they tell you",
        body: [
          takeaways([
            "Metrics (RED for services, USE for resources) say <i>whether</i> and roughly <i>where</i>.",
            "Structured, centralised logs say <i>what</i> happened to a request.",
            "Traces show <i>where the time went</i> across services.",
            "Alert on symptoms via SLOs and burn rate, not on every cause.",
            "Watch cardinality and sample traces to keep the bill sane.",
          ]),
        ],
        metrics: M("2 min", "5 min", "metrics, logs, traces", 0.2),
        scene: s11,
        lab: labO("SLO alerts"),
      },
    ],
  });
}
