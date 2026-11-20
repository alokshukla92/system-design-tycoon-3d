// Generates original curriculum lessons for modules 04 (Foundations) and 05 (Scaling), part "a".
// Usage: node scripts/gen-curriculum-a.mjs [lessonsDir]. Overwrites only this part's lesson JSONs.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? new URL("../src/content/lessons/", import.meta.url).pathname;

// ── text helpers ──────────────────────────────────────────────────────────────
const T = (s) => `<span class="term">${s}</span>`;
const ul = (...items) => `<ul class="takeaways">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const co = (kind, text) => ({ kind, text });

// ── entity / link helpers ────────────────────────────────────────────────────
const tag = (text, tone, icon) => ({ text, ...(tone ? { tone } : {}), ...(icon ? { icon } : {}) });
const DOWN = { dead: 1, heat: 0, cpu: -1, tags: [tag("DOWN", "red", "alert")] };
const crowd = (count, label, rect = {}) => ({ type: "crowd", x0: -4, x1: 4, y0: -20, y1: -14, count, label, ...rect });
const server = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 4, color: "blue", glyph: "server", label, ...extra });
const balancer = (x, y, label = ["Load", "Balancer"], extra = {}) => ({ type: "block", x, y, s: 3.4, h: 30, color: "green", glyph: "balancer", label, ...extra });
const cacheBox = (x, y, label, extra = {}) => ({ type: "block", x, y, s: 3.6, h: 34, color: "orange", glyph: "zap", label, ...extra });
const dbase = (x, y, label, extra = {}) => ({ type: "db", x, y, label, ...extra });
const device = (x, y, label, extra = {}) => ({ type: "device", x, y, label, ...extra });
const card = (title, icon, lines, extra = {}) => ({ type: "panel", title, icon, lines, ...extra });
const L = (from, to, label, extra = {}) => ({ from, to, pts: [from, to], ...(label ? { label } : {}), ...extra });
const lab = (users, rps, nodes, edges) => ({
  users,
  rps,
  nodes: nodes.map(([id, kind, label, sub, status]) => ({ id, kind, label, ...(sub ? { sub } : {}), ...(status ? { status } : {}) })),
  edges: edges.map(([from, to]) => ({ from, to })),
});

/** Step builder keeping the canonical key order. */
const step = (short, chapter, title, body, metrics, scene, more = {}) => ({
  short,
  chapter,
  title,
  body,
  ...(more.callout ? { callout: more.callout } : {}),
  ...(more.changes ? { changes: more.changes } : {}),
  metrics,
  scene,
  ...(more.lab ? { lab: more.lab } : {}),
});

function write(lesson) {
  if (lesson.steps.length < 8 || lesson.steps.length > 11) throw new Error(`${lesson.id}: ${lesson.steps.length} steps`);
  for (const s of lesson.steps) {
    if (s.short.length > 14) throw new Error(`${lesson.id}: short too long "${s.short}"`);
    for (const k of lesson.metrics) if (!(k in s.metrics)) throw new Error(`${lesson.id}/${s.short}: missing ${k}`);
    for (const k of Object.keys(s.metrics)) if (!lesson.metrics.includes(k)) throw new Error(`${lesson.id}/${s.short}: extra ${k}`);
    if (Object.values(s.scene.entities).filter((e) => e.type === "panel").length > 1) throw new Error(`${lesson.id}/${s.short}: 2 panels`);
  }
  writeFileSync(join(OUT, `${lesson.id}.json`), JSON.stringify(lesson, null, 2) + "\n");
}

// ════════════════════════════════════════════════════════════════════════════
// 04-1  how-a-click-travels — one page load, hop by hop
// ════════════════════════════════════════════════════════════════════════════
{
  const dev = (tags) => device(0, -14, "Ines · Lisbon", tags ? { tags } : {});
  const srv = (extra = {}) => server(0, 12, ["plotline", "web server"], { s: 4.4, sub: "Virginia, US", cpu: 0.2, ...extra });
  const res = (extra = {}) => ({ type: "block", x: 11, y: -9, s: 4, h: 40, color: "yellow", glyph: "globe", label: ["DNS", "resolver"], ...extra });
  const ns = (extra = {}) => ({ type: "block", x: 20, y: -1, s: 4, h: 40, color: "purple", glyph: "signpost", label: ["Name", "server"], ...extra });
  const pg = (extra = {}) => dbase(10, 14, "Postgres", extra);
  const wire = (label, extra = {}) => ({ from: "dev", to: "srv", pts: ["dev", "srv"], heads: "both", label, labelTone: "amber", ...extra });
  const dnsLinks = (style) => ({
    q1: { ...L("dev", "res", "plotline.app = ?"), heads: "both", ...(style ? { style } : {}) },
    q2: { ...L("res", "ns", "not cached → ask"), heads: "both", ...(style ? { style } : {}) },
  });
  const MAX = 560;
  const fall = (title, parts, lines = []) => {
    let t = 0;
    const bars = parts.map(([label, ms, tone, bold]) => {
      const b = { label, note: ms ? `${ms} ms` : "0 ms · reused", from: +(t / MAX).toFixed(3), to: +((t + ms) / MAX).toFixed(3), tone, ...(bold ? { bold: true } : {}) };
      t += ms;
      return b;
    });
    return { type: "panel", title, icon: "timer", chart: "bars", bars, lines };
  };
  const M = (dns, connect, request, download) => ({ dns, connect, request, download, total: dns == null ? null : dns + (connect ?? 0) + (request ?? 0) + (download ?? 0) });
  const labReq = lab(1, 2, [["users", "users", "Ines"], ["web", "api_server", "plotline web server", "Virginia"], ["db", "postgres", "Postgres"]], [["users", "web"], ["web", "db"]]);
  const dl = { from: "srv", to: "dev", pts: [["srv+2.4", "srv"], ["dev+2.4", "dev"]], label: "64 KB of HTML" };

  const steps = [
    step(
      "One click",
      "setup",
      "What happens when you press Enter?",
      [
        "Ines, in Lisbon, types <code>plotline.app</code> — a garden-planning site — and presses Enter. Half a second later her garden appears. It feels like one action, but it is a <b>relay of five jobs</b>, each waiting for the one before it.",
        "The plotline server sits in a data centre in Virginia, about 6,000 km away. Keep that distance in mind: it will matter far more than how fast the server is.",
      ],
      M(null, null, null, null),
      {
        entities: {
          dev: dev(),
          srv: srv(),
          card: card("One page load", "listOrdered", ["1  DNS — find the address", "2  TCP — open a connection", "3  TLS — make it private", "4  Request — ask, server works", "5  Download — the bytes arrive", "# each job waits for the previous one"]),
        },
        links: { w: wire("6,000 km · ~90 ms round trip", { style: "dashed" }) },
        flows: [{ route: ["w"], kind: "ping", bounce: true, rate: 0.6, speed: 0.6 }],
      },
      { callout: co("insight", `A ${T("round trip")} (RTT) is one message there and the reply back. Lisbon ⇄ Virginia costs about <b>90 ms</b>, however small the message.`) },
    ),
    step(
      "DNS",
      "technique",
      "First, find the address",
      [
        `Computers connect to IP addresses, not names. So the browser first asks a ${T("DNS resolver")} — usually run by the ISP or a public DNS service — to turn <code>plotline.app</code> into a number like <code>203.0.113.7</code>.`,
        `If the resolver hasn't seen the name recently, it asks the domain's ${T("authoritative name server")} and caches the reply for as long as the record's TTL allows. Both servers are near Ines, so this costs about <b>30 ms</b>.`,
      ],
      M(30, null, null, null),
      {
        entities: { dev: dev([tag("203.0.113.7", "green", "check")]), srv: srv({ dim: 0.5 }), res: res(), ns: ns() },
        links: { w: wire("6,000 km · ~90 ms round trip", { style: "off" }), ...dnsLinks() },
        flows: [{ route: ["q1", "q2"], kind: "ping", bounce: true, rate: 0.9 }],
      },
      {
        callout: co("tip", "Answers are cached at every layer — browser, operating system, resolver. On a repeat visit this step usually costs nothing."),
        changes: ["+ DNS resolver at Ines's ISP", "+ Authoritative name server for plotline.app", "~ Laptop now knows 203.0.113.7"],
      },
    ),
    step(
      "TCP",
      "technique",
      "Shake hands across the ocean",
      [
        `Next the laptop opens a ${T("TCP connection")} to that address. TCP promises the bytes arrive complete and in order, but first both sides agree to talk: <code>SYN</code>, <code>SYN-ACK</code>, <code>ACK</code>.`,
        "The client may send data right behind its final ACK, so the handshake costs exactly <b>one round trip — 90 ms</b>. Nothing useful has been exchanged yet.",
      ],
      M(30, 90, null, null),
      {
        entities: { dev: dev([tag("203.0.113.7", "green", "check")]), srv: srv({ tags: [tag("port 443")] }), res: res({ dim: 0.7 }), ns: ns({ dim: 0.7 }) },
        links: { w: wire("SYN → SYN-ACK → ACK"), ...dnsLinks("off") },
        flows: [{ route: ["w"], kind: "ping", bounce: true, rate: 0.8, speed: 0.7 }],
      },
      {
        callout: co("insight", "A faster connection doesn't help here. The handshake is tiny; what it pays for is <b>distance</b>."),
        changes: ["~ DNS answer cached, resolvers idle", "+ TCP handshake laptop ⇄ server", "~ Connect 0 → 90 ms"],
      },
    ),
    step(
      "TLS",
      "technique",
      "Agree on a secret",
      [
        `The address is <code>https://</code>, so before any page is requested the two sides run a ${T("TLS handshake")}: the server proves who it is with a certificate, and both derive shared encryption keys.`,
        "With TLS 1.3 this costs <b>one more round trip</b> (TLS 1.2 needed two). Connect time is now 180 ms — and Ines still hasn't asked for her garden.",
      ],
      M(30, 180, null, null),
      {
        entities: {
          dev: dev([tag("203.0.113.7", "green", "check")]),
          srv: srv({ tags: [tag("port 443"), tag("certificate", "green", "lock")] }),
          res: res({ dim: 0.7 }),
          ns: ns({ dim: 0.7 }),
          card: fall("So far: 210 ms", [["DNS", 30, "blue"], ["TCP handshake", 90, "amber"], ["TLS handshake", 90, "amber"]]),
        },
        links: { w: wire("TLS hello · certificate · keys"), ...dnsLinks("off") },
        flows: [{ route: ["w"], pattern: ["ping", "write"], bounce: true, rate: 0.8, speed: 0.7 }],
      },
      {
        callout: co("warn", "Two of the jobs so far are pure ceremony, and <b>every new connection</b> to a far-away server pays for them again."),
        changes: ["~ Wire now carries the TLS hello and certificate", "+ Timeline card", "~ Connect 90 → 180 ms"],
      },
    ),
    step(
      "Request",
      "technique",
      "Finally, the question",
      [
        "Over the encrypted connection the browser sends <code>GET /garden</code>. Half a round trip to get there, half to come back: <b>90 ms</b> of travel.",
        `In between, the server does the real work — checks the session, asks Postgres for Ines's planting beds, renders HTML. That ${T("server time")} is about <b>60 ms</b>, so the request phase totals 150 ms.`,
      ],
      M(30, 180, 150, null),
      {
        entities: {
          dev: dev([tag("203.0.113.7", "green", "check")]),
          srv: srv({ cpu: 0.35, tags: [tag("60 ms of work", "violet", "cpu")] }),
          res: res({ dim: 0.7 }),
          ns: ns({ dim: 0.7 }),
          pg: pg(),
          card: fall("So far: 360 ms", [["DNS", 30, "blue"], ["TCP handshake", 90, "amber"], ["TLS handshake", 90, "amber"], ["Request + server", 150, "violet"]]),
        },
        links: { w: wire("GET /garden"), d: { ...L("srv", "pg", "SELECT beds"), heads: "both" }, ...dnsLinks("off") },
        flows: [{ route: ["w", "d"], bounce: true, hold: 0.3, rate: 0.9, speed: 0.8 }],
      },
      {
        callout: co("tip", "Those 60 ms are the only part the backend team directly controls. Hold on to that number."),
        changes: ["+ Postgres behind the web server", "~ Request + server 0 → 150 ms"],
        lab: labReq,
      },
    ),
    step(
      "Download",
      "technique",
      "Bytes don't arrive all at once",
      [
        `The reply is 64 KB of HTML. A brand-new connection doesn't know how much the path can carry, so the server starts cautiously — about 14 KB — then waits for acknowledgements before sending more. This ramp-up is ${T("slow start")}.`,
        "The sending window roughly doubles each round trip (14 KB, then 28 KB, then the rest), so 64 KB needs about <b>two more round trips — 180 ms</b>. Bigger pages need more.",
      ],
      M(30, 180, 150, 180),
      {
        entities: {
          dev: dev([tag("page arriving…", "amber", "hourglass")]),
          srv: srv({ cpu: 0.2, tags: [tag("14 → 28 → 22 KB", "amber", "layers")] }),
          res: res({ dim: 0.7 }),
          ns: ns({ dim: 0.7 }),
          pg: pg(),
          card: fall("Page loaded: 540 ms", [["DNS", 30, "blue"], ["TCP handshake", 90, "amber"], ["TLS handshake", 90, "amber"], ["Request + server", 150, "violet"], ["Download", 180, "green"]]),
        },
        links: { w: wire("ACKs"), d: { ...L("srv", "pg", "SELECT beds"), heads: "both", style: "off" }, r: dl, ...dnsLinks("off") },
        flows: [
          { route: ["r"], kind: "heavy", rate: 1.4, speed: 0.8 },
          { route: ["w"], kind: "ping", rate: 0.7, speed: 0.8 },
        ],
      },
      {
        callout: co("insight", "On a fresh long-distance connection, size costs <b>round trips</b>, not just bandwidth. Trimming 30 KB can save a whole RTT."),
        changes: ["+ 64 KB response streaming back", "~ Download 0 → 180 ms"],
      },
    ),
    step(
      "Time spent",
      "insight",
      "Where the 540 ms went",
      [
        "Add it up: 30 ms DNS, 180 ms of handshakes, 150 ms request, 180 ms download — <b>540 ms</b>. The server's own work was 60 ms, about <b>11%</b> of the wait.",
        "Almost everything else is light crossing an ocean: six round trips at 90 ms each. A server twice as fast saves 30 ms; removing one round trip saves 90.",
      ],
      M(30, 180, 150, 180),
      {
        entities: {
          dev: dev([tag("page ready", "green", "check")]),
          srv: srv({ tags: [tag("60 ms of work", "violet", "cpu")] }),
          res: res({ dim: 0.7 }),
          ns: ns({ dim: 0.7 }),
          pg: pg(),
          card: fall(
            "540 ms, broken down",
            [["DNS", 30, "blue"], ["Handshakes", 180, "amber"], ["Request travel", 90, "amber"], ["Server work", 60, "violet", true], ["Download", 180, "amber"]],
            ["! 6 round trips × 90 ms = 480 ms"],
          ),
        },
        links: { w: wire("6 round trips × 90 ms"), d: { ...L("srv", "pg", "SELECT beds"), heads: "both", style: "off" }, ...dnsLinks("off") },
        flows: [{ route: ["w"], kind: "slow", bounce: true, rate: 0.7 }],
      },
      {
        callout: co("insight", "User-facing latency is mostly <b>round trips × distance</b>. To go faster, make fewer trips or shorter ones."),
        changes: ["~ Timeline regrouped: travel vs. work", "~ Server work highlighted"],
      },
    ),
    step(
      "Fewer trips",
      "solution",
      "Merge the handshakes",
      [
        `Newer protocols attack the round-trip count directly. ${T("HTTP/3")} runs over QUIC, which performs the transport and encryption handshakes <b>together, in one round trip</b>.`,
        "On a first visit, connect drops from 180 to 90 ms and the page lands in 450 ms. Returning clients can even send their first request with zero handshake round trips.",
      ],
      M(30, 90, 150, 180),
      {
        entities: {
          dev: dev([tag("HTTP/3", "violet", "zap")]),
          srv: srv({ tags: [tag("QUIC · 1 RTT", "green", "check")] }),
          res: res({ dim: 0.7 }),
          ns: ns({ dim: 0.7 }),
          pg: pg(),
          card: fall("First visit: 450 ms", [["DNS", 30, "blue"], ["QUIC handshake", 90, "green", true], ["Request + server", 150, "violet"], ["Download", 180, "amber"]]),
        },
        links: { w: wire("QUIC: transport + TLS in 1 RTT"), d: { ...L("srv", "pg", "SELECT beds"), heads: "both" }, ...dnsLinks("off") },
        flows: [{ route: ["w", "d"], bounce: true, hold: 0.3, rate: 0.9, speed: 0.8 }],
      },
      {
        callout: co("warn", "Zero-round-trip (0-RTT) data can be replayed by an attacker, so servers accept it only for safe requests such as plain GETs."),
        changes: ["~ TCP + TLS handshakes merged (QUIC)", "~ Connect 180 → 90 ms", "~ Total 540 → 450 ms"],
      },
    ),
    step(
      "Second click",
      "solution",
      "The second click is cheaper",
      [
        `Ines clicks through to her seed list. The address is already in her browser's DNS cache, and the connection is still open — browsers keep it alive and ${T("reuse")} it. DNS and connect both drop to <b>zero</b>.`,
        "The sending window is already wide open too, so the next 64 KB arrives in about one round trip. Total: <b>240 ms</b>, under half the first visit.",
      ],
      M(0, 0, 150, 90),
      {
        entities: {
          dev: dev([tag("connection open", "green", "check")]),
          srv: srv({ tags: [tag("same connection", "green", "network")] }),
          pg: pg(),
          card: fall("Second click: 240 ms", [["DNS", 0, "blue"], ["Connect", 0, "green"], ["Request + server", 150, "violet"], ["Download", 90, "green", true]]),
        },
        links: { w: wire("GET /seeds (reused)"), d: { ...L("srv", "pg", "SELECT seeds"), heads: "both" } },
        flows: [{ route: ["w", "d"], bounce: true, hold: 0.3, rate: 1.1, speed: 0.8 }],
      },
      {
        changes: ["- DNS servers (answer cached in the browser)", "~ Connection reused (keep-alive)", "~ Total 450 → 240 ms"],
        lab: labReq,
      },
    ),
    step(
      "Recap",
      "recap",
      "One click, five jobs",
      [
        ul(
          "A page load is a relay: <b>DNS → TCP → TLS → request → download</b>, each waiting on the last.",
          "Every handshake costs a full round trip, and distance sets the price of a round trip.",
          "Server work is often a small slice of what the user waits for.",
          "Go faster with <b>fewer trips</b> (connection reuse, HTTP/3, caching) or <b>shorter trips</b> (servers closer to users).",
        ),
      ],
      M(0, 0, 150, 90),
      {
        entities: {
          dev: dev([tag("connection open", "green", "check")]),
          srv: srv(),
          pg: pg(),
          card: {
            type: "panel",
            title: "Same page, three ways",
            icon: "timer",
            chart: "bars",
            bars: [
              { label: "First visit · HTTP/2", note: "540 ms", to: 0.964, tone: "red" },
              { label: "First visit · HTTP/3", note: "450 ms", to: 0.804, tone: "amber" },
              { label: "Second click", note: "240 ms", to: 0.429, tone: "green", bold: true },
            ],
            lines: [],
          },
        },
        links: { w: wire("6,000 km · ~90 ms round trip"), d: { ...L("srv", "pg"), heads: "both" } },
        flows: [{ route: ["w", "d"], bounce: true, hold: 0.3, rate: 1, speed: 0.8 }],
      },
      { callout: co("next", "One user is fast. Next: what happens when thousands of them arrive at once?") },
    ),
  ];

  write({
    id: "how-a-click-travels",
    title: "How a Click Travels",
    summary: "Follow one page load from Lisbon to Virginia, hop by hop, and see where the half-second really goes.",
    minutes: 10,
    level: "beginner",
    metrics: ["dns", "connect", "request", "download", "total"],
    legend: ["req", "res", ["ping", "handshake"], ["heavy", "response bytes"], ["slow", "round trip"]],
    goals: [
      { text: "Name the five stages of a page load", step: 0 },
      { text: "See why every handshake costs a full round trip", step: 2 },
      { text: "Find where the time actually goes", step: 6 },
      { text: "Cut round trips with HTTP/3 and connection reuse", step: 7 },
    ],
    steps,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 04-2  fast-vs-busy — latency, throughput, percentiles, utilization
// ════════════════════════════════════════════════════════════════════════════
{
  const users = (count) => crowd(count, "API clients");
  const srv = (extra = {}) => server(0, 0, ["Label", "renderer"], { s: 5, h: 54, sub: "max 200 req/s", ...extra });
  const q = (n) => ({ type: "queue", x: 3.4, y: -3.6, n, gap: 0.85, dir: [0, -1] });
  const e = (extra = {}) => ({ ...L("users", "srv", "POST /label"), heads: "both", ...extra });
  const hockey = (marker, lines, title = "Wait vs. utilization") => ({ type: "panel", title, icon: "gauge", chart: "hockey", marker, lines });
  const M = (throughput, util, p50, p99) => ({ throughput, util, p50, p99 });
  const backs = ["Users", "Rates", "Stock", "Maps", "Billing"];
  const bx = [-12, -6, 0, 6, 12];

  const steps = [
    step(
      "Two numbers",
      "setup",
      "Fast and busy are different questions",
      [
        `Stampwise runs an API that renders shipping labels. Two questions describe how it's doing: ${T("latency")} — how long does one request take? — and ${T("throughput")} — how many requests does it finish each second?`,
        `Right now 40 requests arrive per second and each needs about 40 ms of work. The server can finish about 200 per second, so it is busy just 20% of the time. That fraction is its ${T("utilization")}.`,
      ],
      M(40, 20, 42, 110),
      {
        entities: { users: users(5), srv: srv({ cpu: 0.2 }), q: q(0) },
        links: { e: e() },
        flows: [{ route: ["e"], bounce: true, hold: 0.25, rate: 1 }],
      },
      {
        callout: co("insight", "A sports car is fast but carries two people; a bus is slow but carries fifty. Latency and throughput are separate dials."),
        lab: lab(2000, 40, [["users", "users", "API clients"], ["api", "api_server", "Label renderer", "max 200 req/s"]], [["users", "api"]]),
      },
    ),
    step(
      "Percentiles",
      "technique",
      "Averages hide the slow ones",
      [
        `Latency isn't one number. Sort a minute of requests by duration: the one in the middle is the ${T("p50")} (median); the one slower than 99% of the others is the ${T("p99")}.`,
        "Here p50 is 42 ms but p99 is 110 ms — a few requests hit a cold cache, a garbage-collection pause or a slow disk. The average, about 50 ms, describes nobody in particular.",
      ],
      M(40, 20, 42, 110),
      {
        entities: {
          users: users(5),
          srv: srv({ cpu: 0.2 }),
          q: q(0),
          card: {
            type: "panel",
            title: "One minute · 2,400 requests",
            icon: "chart",
            chart: "bars",
            bars: [
              { label: "p50", note: "42 ms", to: 0.19, tone: "green" },
              { label: "p90", note: "70 ms", to: 0.32, tone: "green" },
              { label: "p99", note: "110 ms", to: 0.5, tone: "amber", bold: true },
              { label: "slowest", note: "220 ms", to: 1, tone: "red" },
            ],
            lines: ["# 24 requests were slower than p99"],
          },
        },
        links: { e: e() },
        flows: [{ route: ["e"], bounce: true, hold: 0.25, rate: 1.2, pattern: ["req", "req", "req", "req", "slow"] }],
      },
      {
        callout: co("tip", "Watch p50 for the typical experience and p95/p99 for the unlucky. Your most active users send the most requests, so they meet the tail most often."),
        changes: ["+ Latency distribution card", "~ Every so often a request is slow"],
      },
    ),
    step(
      "Fan-out",
      "problem",
      "When one page waits on many calls",
      [
        "Stampwise's dashboard page calls five internal services in parallel and can render only when <i>all</i> of them have answered. The page is as slow as its slowest call.",
        `If each call has a 1% chance of a p99-slow reply, the chance at least one of five is slow is 1 − 0.99⁵ ≈ <b>5%</b>. With 20 calls it's ≈ <b>18%</b>. This ${T("tail amplification")} turns a backend's rare case into a common one.`,
      ],
      M(40, 20, 48, 230),
      {
        entities: {
          users: users(5),
          srv: srv({ label: ["Dashboard", "page"], sub: "waits for all 5", cpu: 0.2 }),
          q: q(0),
          ...Object.fromEntries(
            backs.map((name, i) => [`b${i}`, server(bx[i], 12, [name], { s: 3, h: 32, color: "purple", ...(i === 3 ? { tags: [tag("p99: 210 ms", "amber", "hourglass")] } : {}) })]),
          ),
          card: card("Chance the page is slow", "split", ["1 call   → 1%", "5 calls  → 1 − 0.99⁵ ≈ 5%", "20 calls → 1 − 0.99²⁰ ≈ 18%", "! the page's p99 ≈ a backend's p99.9"]),
        },
        links: { e: e({ label: "GET /dashboard" }), ...Object.fromEntries(backs.map((_, i) => [`f${i}`, { ...L("srv", `b${i}`), heads: "both" }])) },
        flows: [
          { route: ["e"], bounce: true, hold: 1, rate: 0.6 },
          { fanout: true, bounce: true, rate: 0.6, routes: backs.map((_, i) => ({ path: [`f${i}`], ...(i === 3 ? { kind: "slow" } : {}) })) },
        ],
      },
      {
        callout: co("insight", "The more calls a request fans out to, the more the <b>tail</b> of each one matters."),
        changes: ["+ Five backend services", "~ Page waits for the slowest answer"],
      },
    ),
    step(
      "Busier",
      "problem",
      "Traffic triples",
      [
        "Back to the label API. A holiday sale brings 120 requests per second — 60% utilization. Each label still takes 40 ms of work.",
        `Yet p50 creeps up to 65 ms and p99 to 300 ms. Requests now sometimes arrive while the server is busy and wait their turn in a ${T("queue")}. The work didn't grow; the <b>waiting</b> did.`,
      ],
      M(120, 60, 65, 300),
      {
        entities: { users: users(9), srv: srv({ cpu: 0.6 }), q: q(2), card: hockey(0.6, ["at 60% busy, waiting ≈ 1.5× the work"]) },
        links: { e: e() },
        flows: [{ route: ["e"], bounce: true, hold: 0.35, rate: 2, pattern: ["req", "req", "req", "slow"] }],
      },
      { changes: ["~ Traffic 40 → 120 req/s", "+ A short queue forms", "+ Utilization curve card"] },
    ),
    step(
      "Near full",
      "problem",
      "90% busy, six times slower",
      [
        "At 180 requests per second, utilization reaches 90%. Work per request is unchanged, but a typical request now waits behind several others: p50 260 ms, p99 1.4 s.",
        "Arrivals are random, not evenly spaced. Bursts arrive faster than the server drains them, and a 90%-busy server has very few idle moments in which to catch up.",
      ],
      M(180, 90, 260, 1400),
      {
        entities: { users: users(12), srv: srv({ cpu: 0.9, heat: 0.6 }), q: q(9), card: hockey(0.9, ["at 90% busy, waiting ≈ 9× the work"]) },
        links: { e: e() },
        flows: [{ route: ["e"], bounce: true, hold: 0.8, rate: 2.6, pattern: ["slow", "slow", "req"] }],
      },
      { changes: ["~ Traffic 120 → 180 req/s", "~ Queue 2 → 9 waiting", "~ Marker slides up the curve"] },
    ),
    step(
      "Hockey stick",
      "insight",
      "Why latency explodes near saturation",
      [
        `Queueing theory gives a rule of thumb for one server with random arrivals: <b>wait ≈ work × ρ ÷ (1 − ρ)</b>, where ρ is utilization. From 50% to 60% busy adds a little wait; from 90% to 95% <b>doubles</b> it.`,
        `That's the ${T("hockey-stick curve")}: flat for a long stretch, then nearly vertical. The last slice of capacity is by far the most expensive to use.`,
      ],
      M(180, 90, 260, 1400),
      {
        entities: {
          users: users(12),
          srv: srv({ cpu: 0.9, heat: 0.6 }),
          q: q(9),
          card: hockey(0.9, ["ρ 50% → wait 1× work", "ρ 80% → wait 4× work", "ρ 90% → wait 9× work", "! ρ 95% → wait 19× work"], "wait ≈ work × ρ / (1 − ρ)"),
        },
        links: { e: e() },
        flows: [{ route: ["e"], bounce: true, hold: 0.8, rate: 2.6, pattern: ["slow", "slow", "req"] }],
      },
      { callout: co("insight", "Don't plan to run at 100%. Plan for the knee of the curve — often 60–75% for latency-sensitive services."), changes: ["~ Card shows the formula behind the curve"] },
    ),
    step(
      "Overload",
      "problem",
      "Past capacity, throughput stops growing",
      [
        `A flash sale pushes demand to 240 requests per second. The server can still finish only 200: ${T("throughput")} flattens at capacity while the queue grows every second.`,
        "Forty extra requests per second pile up — 2,400 after one minute, each now waiting about 12 s. Clients time out, retry, and add even more load.",
      ],
      M(200, 100, 4200, null),
      {
        entities: { users: users(16), srv: srv({ cpu: 0.99, heat: 1, tags: [tag("queue growing", "red", "alert")] }), q: q(14), card: hockey(0.99, ["demand 240 · capacity 200 req/s", "! +40 req/s queued, forever"]) },
        links: { e: e({ fail: 0.3 }) },
        flows: [{ route: ["e"], bounce: true, hold: 1.2, rate: 3, kind: "slow" }],
      },
      { callout: co("warn", "Above capacity a queue never settles. It grows until requests time out or the server runs out of memory."), changes: ["~ Demand 180 → 240 req/s", "~ Queue keeps growing", "+ Timeouts (failed requests)"] },
    ),
    step(
      "Headroom",
      "solution",
      "Buy room to breathe",
      [
        "Stampwise adds two more renderers behind a load balancer. Capacity is now 600 req/s, so the same 240 req/s keeps each server only <b>40% busy</b>.",
        "The queue drains, p50 is back to 48 ms and p99 to 140 ms. Throughput rises to meet demand because there is finally room for it.",
      ],
      M(240, 40, 48, 140),
      {
        entities: {
          users: users(16),
          lb: balancer(0, -7),
          srv: srv({ x: 0, y: 5, s: 4, h: 46, cpu: 0.4, sub: "" }),
          s2: srv({ x: -8, y: 5, s: 4, h: 46, cpu: 0.4, sub: "", label: ["Renderer", "2"] }),
          s3: srv({ x: 8, y: 5, s: 4, h: 46, cpu: 0.4, sub: "", label: ["Renderer", "3"] }),
          q: q(0),
          card: hockey(0.4, ["each server 40% busy", "= wait ≈ 0.7× the work"]),
        },
        links: { in: { ...L("users", "lb", "POST /label"), heads: "both" }, e1: { ...L("lb", "s2"), heads: "both" }, e2: { ...L("lb", "srv"), heads: "both" }, e3: { ...L("lb", "s3"), heads: "both" } },
        flows: [{ route: ["in", ["e1", "e2", "e3"]], bounce: true, hold: 0.25, rate: 3 }],
      },
      {
        changes: ["+ Load balancer", "+ Two more renderers", "~ Utilization 100% → 40% each", "- Queue drained"],
        lab: lab(12000, 240, [["users", "users", "API clients"], ["lb", "load_balancer", "Load balancer"], ["api", "api_server", "Label renderers", "3 × 200 req/s"]], [["users", "lb"], ["lb", "api"]]),
      },
    ),
    step(
      "Trade-off",
      "tradeoff",
      "Idle capacity is insurance",
      [
        "Running at 40% means paying for machines that sit idle much of the time. Running at 90% is cheap but fragile: one burst or one lost server pushes you over the knee.",
        `Throughput has a hidden trade-off too: ${T("batching")} — processing items in groups — raises throughput by cutting per-item overhead, but each item waits for its batch to fill. Fast and busy often pull in opposite directions.`,
      ],
      M(240, 40, 48, 140),
      {
        entities: {
          users: users(16),
          lb: balancer(0, -7),
          srv: srv({ x: 0, y: 5, s: 4, h: 46, cpu: 0.4, sub: "" }),
          s2: srv({ x: -8, y: 5, s: 4, h: 46, cpu: 0.4, sub: "", label: ["Renderer", "2"] }),
          s3: srv({ x: 8, y: 5, s: 4, h: 46, cpu: 0.4, sub: "", label: ["Renderer", "3"] }),
          q: q(0),
          card: {
            type: "panel",
            title: "Same 240 req/s, different fleets",
            icon: "scale",
            chart: "bars",
            bars: [
              { label: "6 servers · 20% busy", note: "p99 ~120 ms · costly", to: 0.2, tone: "blue" },
              { label: "3 servers · 40% busy", note: "p99 ~140 ms", to: 0.4, tone: "green", bold: true },
              { label: "2 servers · 60% busy", note: "p99 ~300 ms", to: 0.6, tone: "amber" },
              { label: "fewest · 90% busy", note: "p99 ~1.4 s · fragile", to: 0.9, tone: "red" },
            ],
            lines: [],
          },
        },
        links: { in: { ...L("users", "lb", "POST /label"), heads: "both" }, e1: { ...L("lb", "s2"), heads: "both" }, e2: { ...L("lb", "srv"), heads: "both" }, e3: { ...L("lb", "s3"), heads: "both" } },
        flows: [{ route: ["in", ["e1", "e2", "e3"]], bounce: true, hold: 0.25, rate: 3 }],
      },
      { callout: co("tip", "Pick a target utilization per service from its latency goal, then let autoscaling hold it there."), changes: ["~ Card compares fleet sizes for the same load"] },
    ),
    step(
      "Recap",
      "recap",
      "Fast vs busy, in five lines",
      [
        ul(
          "<b>Latency</b> is time per request; <b>throughput</b> is requests finished per second.",
          "Report percentiles: p50 for the typical case, p99 for the tail — and fan-out makes the tail common.",
          "Waiting grows like ρ ÷ (1 − ρ): gentle at first, explosive near saturation.",
          "Past capacity, throughput flatlines and queues grow without limit.",
          "Keep headroom: aim for the knee of the curve, not 100%.",
        ),
      ],
      M(240, 40, 48, 140),
      {
        entities: {
          users: users(16),
          lb: balancer(0, -7),
          srv: srv({ x: 0, y: 5, s: 4, h: 46, cpu: 0.4, sub: "" }),
          s2: srv({ x: -8, y: 5, s: 4, h: 46, cpu: 0.4, sub: "", label: ["Renderer", "2"] }),
          s3: srv({ x: 8, y: 5, s: 4, h: 46, cpu: 0.4, sub: "", label: ["Renderer", "3"] }),
          q: q(0),
        },
        links: { in: { ...L("users", "lb", "POST /label"), heads: "both" }, e1: { ...L("lb", "s2"), heads: "both" }, e2: { ...L("lb", "srv"), heads: "both" }, e3: { ...L("lb", "s3"), heads: "both" } },
        flows: [{ route: ["in", ["e1", "e2", "e3"]], bounce: true, hold: 0.25, rate: 3 }],
      },
      { callout: co("next", "Next: estimate how much capacity you need <i>before</i> you build — on the back of an envelope.") },
    ),
  ];

  write({
    id: "fast-vs-busy",
    title: "Fast vs Busy",
    summary: "Latency and throughput are different dials — and latency explodes long before a server is 100% busy.",
    minutes: 11,
    level: "beginner",
    metrics: ["throughput", "util", "p50", "p99"],
    legend: ["req", "res", "slow", "queue", "fail"],
    goals: [
      { text: "Tell latency from throughput", step: 0 },
      { text: "Read p50 and p99 — and why fan-out amplifies the tail", step: 2 },
      { text: "Explain why latency explodes near saturation", step: 5 },
      { text: "Choose headroom deliberately", step: 8 },
    ],
    steps,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 04-3  back-of-the-envelope — capacity estimation
// ════════════════════════════════════════════════════════════════════════════
{
  const users = (count, label = "10M daily users (DAU)") => crowd(count, label, { x0: -6, x1: 6, y0: -24, y1: -15 });
  const gsrv = { type: "ghost", x: 0, y: 0, s: 8, h: 70, label: "how many servers?" };
  const gsto = { type: "ghost", x: 14, y: 4, s: 6, h: 56, label: "how much storage?" };
  const GX = [-4.5, -1.5, 1.5, 4.5];
  const GY = [-3.5, -0.5, 2.5, 5.5];
  const fleet = () =>
    Object.fromEntries(GX.flatMap((x, i) => GY.map((y, j) => [`w${i * 4 + j}`, { type: "block", x, y, s: 2.2, h: 24, color: "blue", glyph: "server", label: [] }])));
  const zone = { type: "zone", x0: -6.5, x1: 6.5, y0: -5.5, y1: 7.5, label: "WEB TIER · 16 × 8-CORE" };
  const store = { type: "block", x: 15, y: 0, s: 4.6, h: 44, color: "store", glyph: "box", label: ["Photo", "store"], sub: "≈550 TB / year" };
  const meta = dbase(15, 10, "Metadata DB", { tags: [tag("< 2 TB / year")] });
  const M = (_dau, avg, peak, servers, storage, payload) => ({ avg, peak, servers, storage, payload });
  const toZone = (label) => ({ ...L("users", "web", label), heads: "both" });
  const labFleet = lab(10_000_000, 13_900, [["users", "users", "10M daily users"], ["lb", "load_balancer", "Load balancer"], ["web", "api_server", "Web tier", "16 × 8-core"], ["db", "postgres", "Metadata DB"]], [["users", "lb"], ["lb", "web"], ["web", "db"]]);
  const full = (extra = {}) => ({ users: users(16), web: zone, ...fleet(), store, meta, ...extra });
  const fullLinks = (extra = {}) => ({ in: toZone("≈14,000 req/s at peak"), up: { ...L("web", "store", "1.5 TB / day"), heads: "end" }, md: { ...L("web", "meta", "5 GB / day") }, ...extra });

  const steps = [
    step(
      "The question",
      "setup",
      "Will it fit — before you build it?",
      [
        "Snapgrain, a photo-journal app, is planning its launch. The investors ask: how many servers? How much storage? How much bandwidth? Nobody can know exactly — but you can get within a factor of two in five minutes.",
        `That's a ${T("back-of-the-envelope estimate")}: round every number, multiply, and keep the units honest. The goal is the right <b>order of magnitude</b>, not three decimal places.`,
      ],
      M("?", "?", "?", "?", "?", "?"),
      { entities: { users: users(6, "users?"), gsrv, gsto }, links: { in: { ...L("users", "gsrv"), heads: "both", style: "dashed" } }, flows: [] },
      { callout: co("insight", "Estimates exist to make decisions: <i>one</i> database or <i>fifty</i>? A CDN or not? You only need enough precision to choose.") },
    ),
    step(
      "Requests / s",
      "technique",
      "From users to requests per second",
      [
        `Start with ${T("daily active users")} (DAU). Snapgrain expects 10 million. A typical user opens the app a few times and makes about 40 requests a day — feeds, likes, a post now and then.`,
        "10M × 40 = 400 million requests a day. A day has 86,400 seconds — call it 10⁵ — so the <b>average is about 4,600 requests per second</b>.",
      ],
      M(10_000_000, 4630, "?", "?", "?", "?"),
      {
        entities: { users: users(12), gsrv, gsto, card: card("Average load", "activity", ["10,000,000 users × 40 req/day", "= 400,000,000 req/day", "÷ 86,400 s/day (≈ 10⁵)", "= ≈ 4,600 req/s on average"]) },
        links: { in: { ...L("users", "gsrv", "≈4,600 req/s avg"), heads: "both", style: "dashed" } },
        flows: [{ route: ["in"], rate: 1.6 }],
      },
      { callout: co("tip", "Handy shortcut: <b>1 million requests a day ≈ 12 per second</b>."), changes: ["~ Users: 10 million a day", "+ Average request rate"] },
    ),
    step(
      "Peak",
      "problem",
      "Nobody uses an app on average",
      [
        `Traffic follows the sun: quiet at 4 a.m., busiest in the evening, with spikes when a post goes viral. You must survive the ${T("peak")}, not the average.`,
        "A common rule of thumb for consumer apps is peak ≈ 2–3× the average (more for launches and sales). Using 3×: <b>about 14,000 requests per second</b>.",
      ],
      M(10_000_000, 4630, 13_900, "?", "?", "?"),
      {
        entities: {
          users: users(18),
          gsrv,
          gsto,
          card: {
            type: "panel",
            title: "A day of traffic (req/s)",
            icon: "trendingUp",
            chart: "bars",
            bars: [
              { label: "04:00", note: "1,500", to: 0.11, tone: "gray" },
              { label: "09:00", note: "4,000", to: 0.29, tone: "green" },
              { label: "13:00", note: "5,500", to: 0.4, tone: "green" },
              { label: "average", note: "4,600", to: 0.33, tone: "blue" },
              { label: "21:00 peak", note: "13,900", to: 1, tone: "red", bold: true },
            ],
            lines: [],
          },
        },
        links: { in: { ...L("users", "gsrv", "≈14,000 req/s peak"), heads: "both", style: "dashed", labelTone: "red" } },
        flows: [{ route: ["in"], rate: 3 }],
      },
      { changes: ["~ Evening crowd arrives", "+ Peak = 3 × average"] },
    ),
    step(
      "Servers",
      "technique",
      "Divide by what one machine can do",
      [
        "Next, one server's capacity. Say a request costs ~5 ms of CPU: one core handles 200 per second, an 8-core server 1,600. Planning to run at ~60% busy, to stay off the latency knee, leaves <b>~1,000 req/s per server</b>.",
        "14,000 ÷ 1,000 = 14 servers for the peak. Add two spares so a crash or a deploy doesn't overload the rest: <b>16 servers</b>.",
      ],
      M(10_000_000, 4630, 13_900, 16, "?", "?"),
      {
        entities: { users: users(18), web: zone, ...fleet(), gsto, card: card("Servers", "server", ["5 ms CPU → 200 req/s per core", "× 8 cores × 60% target ≈ 1,000 req/s", "14,000 ÷ 1,000 = 14", "= 14 + 2 spare = 16 servers"]) },
        links: { in: toZone("≈14,000 req/s at peak") },
        flows: [{ route: ["in"], rate: 3, bounce: true }],
      },
      { changes: ["- Ghost server", "+ 16 web servers", "~ Peak divided by safe per-server capacity"], lab: labFleet },
    ),
    step(
      "Storage",
      "technique",
      "What piles up every day",
      [
        "Storage grows with what users create. If half of them post one photo a day, that's 5 million photos. At ~300 KB each (compressed, plus a thumbnail) that's <b>1.5 TB a day</b>.",
        "Over a year: 1.5 TB × 365 ≈ <b>550 TB</b>. The metadata — caption, owner, timestamps, ~1 KB per photo — adds only 5 GB a day, under 2 TB a year. The bytes are in the photos.",
      ],
      M(10_000_000, 4630, 13_900, 16, "≈ 550 TB", "?"),
      {
        entities: { ...full(), card: card("Storage per year", "database", ["5M photos/day × 300 KB = 1.5 TB/day", "× 365 days ≈ 550 TB/year", "# metadata: 5M × 1 KB = 5 GB/day", "! × 3 replicas ≈ 1.6 PB of raw disk"]) },
        links: fullLinks(),
        flows: [
          { route: ["in"], rate: 2.4 },
          { route: ["up"], kind: "write", rate: 1.2 },
          { route: ["md"], kind: "write", rate: 0.5 },
        ],
      },
      {
        callout: co("warn", `Durable storage keeps copies. With 3 ${T("replicas")}, 550 TB of photos needs about 1.6 PB of raw disk.`),
        changes: ["- Ghost storage", "+ Photo store (object storage)", "+ Metadata database"],
        lab: labFleet,
      },
    ),
    step(
      "Bandwidth",
      "problem",
      "Reading is heavier than writing",
      [
        "Each user scrolls past about 100 photos a day. Served at ~150 KB (a screen-sized version), that's 10M × 100 × 150 KB = <b>150 TB leaving Snapgrain every day</b>.",
        "150 TB ÷ 86,400 s ≈ 1.7 GB/s — about 14 Gbit/s on average and ~40 Gbit/s at a 3× peak. That number, more than the server count, says Snapgrain will want a CDN.",
      ],
      M(10_000_000, 4630, 13_900, 16, "≈ 550 TB", "150 TB / day"),
      {
        entities: { ...full({ store: { ...store, heat: 0.5, tags: [tag("egress-heavy", "amber", "activity")] } }), card: card("Egress", "activity", ["10M × 100 photos × 150 KB", "= 150 TB/day out", "÷ 86,400 s ≈ 1.7 GB/s ≈ 14 Gbit/s", "! peak × 3 ≈ 40 Gbit/s"]) },
        links: fullLinks({ out: { ...L("store", "users", "≈40 Gbit/s at peak"), labelTone: "red" } }),
        flows: [
          { route: ["in"], rate: 2 },
          { route: ["up"], kind: "write", rate: 0.6 },
          { route: ["out"], kind: "heavy", rate: 2.4 },
        ],
      },
      { changes: ["+ Photo downloads flowing back to users", "~ Bandwidth estimated"] },
    ),
    step(
      "Cheat sheet",
      "insight",
      "Numbers worth remembering",
      [
        "Estimates go quickly when a few anchors live in your head. Powers of ten turn multiplication into counting zeros; rough latency numbers tell you which operations you can afford inside a single request.",
        '<table class="compare numbers"><tbody><tr><td>Read from main memory</td><td>~100 ns</td></tr><tr><td>Random read from SSD</td><td>~100 µs</td></tr><tr><td>Round trip inside a data centre</td><td>~0.5 ms</td></tr><tr><td>Read 1 MB sequentially from SSD</td><td>~1 ms</td></tr><tr><td>Round trip across an ocean</td><td>~80–150 ms</td></tr></tbody></table>',
      ],
      M(10_000_000, 4630, 13_900, 16, "≈ 550 TB", "150 TB / day"),
      {
        entities: { ...full(), card: card("Powers of ten", "hash", ["1 day = 86,400 s ≈ 10⁵ s", "1M per day ≈ 12 per second", "KB 10³ · MB 10⁶ · GB 10⁹ · TB 10¹²", "1 Gbit/s ≈ 125 MB/s", "# 1 year ≈ 3 × 10⁷ s"]) },
        links: fullLinks({ out: { ...L("store", "users", "≈40 Gbit/s at peak") } }),
        flows: [
          { route: ["in"], rate: 2 },
          { route: ["out"], kind: "heavy", rate: 1.6 },
        ],
      },
      { callout: co("tip", "Memory is ~1,000× faster than SSD, which is ~1,000× faster than a cross-ocean round trip. A few of those per request is fine; thousands is not.") },
    ),
    step(
      "Sanity check",
      "tradeoff",
      "Good enough — and knowing why",
      [
        "Every input could be off by 2×: maybe users make 80 requests a day, maybe photos average 500 KB. That's fine. The estimate's job is to show which problems are <b>big</b> (egress, photo storage) and which are <b>small</b> (metadata, a modest web tier).",
        "Write the assumptions next to the result. When real traffic arrives, swap in measured numbers and the same arithmetic tells you what to change.",
      ],
      M(10_000_000, 4630, 13_900, 16, "≈ 550 TB", "150 TB / day"),
      {
        entities: {
          ...full(),
          card: {
            type: "panel",
            title: "If an assumption is 2× off",
            icon: "scale",
            chart: "bars",
            bars: [
              { label: "40 → 80 req/user", note: "16 → 30 servers", to: 0.5, tone: "amber" },
              { label: "300 → 500 KB/photo", note: "550 → 900 TB/yr", to: 0.6, tone: "amber" },
              { label: "egress vs metadata", note: "~30,000× apart", to: 1, tone: "violet", bold: true },
            ],
            lines: ["= the big terms stay big"],
          },
        },
        links: fullLinks({ out: { ...L("store", "users", "≈40 Gbit/s at peak") } }),
        flows: [
          { route: ["in"], rate: 2 },
          { route: ["out"], kind: "heavy", rate: 1.6 },
        ],
      },
      { callout: co("insight", "If two designs differ by 10× in the estimate, the estimate decides. If they differ by 20%, go and measure.") },
    ),
    step(
      "Recap",
      "recap",
      "Estimating on one page",
      [
        ul(
          "DAU × requests per user ÷ ~10⁵ s = average req/s; multiply by 2–3 for the peak.",
          "Servers = peak ÷ safe per-server capacity, plus spares.",
          "Storage per year = items per day × size × 365 (× replicas).",
          "Bandwidth = reads × size — often the biggest number of all.",
          "Round hard, write assumptions down, and look for the term that dominates.",
        ),
      ],
      M(10_000_000, 4630, 13_900, 16, "≈ 550 TB", "150 TB / day"),
      {
        entities: full(),
        links: fullLinks({ out: { ...L("store", "users", "≈40 Gbit/s at peak") } }),
        flows: [
          { route: ["in"], rate: 2 },
          { route: ["up"], kind: "write", rate: 0.6 },
          { route: ["out"], kind: "heavy", rate: 1.6 },
        ],
      },
      { callout: co("next", "Next module: when the numbers say one server isn't enough — do you make it bigger, or add more?") },
    ),
  ];

  write({
    id: "back-of-the-envelope",
    title: "Back of the Envelope",
    summary: "Turn daily users into requests per second, servers, storage and bandwidth — in five minutes, with round numbers.",
    minutes: 10,
    level: "beginner",
    metrics: ["avg", "peak", "servers", "storage", "payload"],
    legend: ["req", "res", ["write", "upload"], ["heavy", "photo download"]],
    goals: [
      { text: "Turn daily users into requests per second", step: 1 },
      { text: "Size for the peak, not the average", step: 2 },
      { text: "Estimate servers from per-machine capacity", step: 3 },
      { text: "Estimate storage and bandwidth", step: 5 },
    ],
    steps,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 05-1  bigger-or-more — vertical vs horizontal scaling
// ════════════════════════════════════════════════════════════════════════════
{
  const users = (count) => crowd(count, "Shoppers", { y0: -22, y1: -16 });
  const app = (extra = {}) => server(0, -2, ["Web", "app"], { sub: "4 vCPU · $140/mo", cpu: 0.3, ...extra });
  const pg = (extra = {}) => dbase(0, 11, "Postgres", { cpu: 0.3, ...extra });
  const XY = [[-10, -8], [-5, -3], [0, 2], [5, 7]];
  const four = (cpu, over = {}) =>
    Object.fromEntries(
      ["app", "a2", "a3", "a4"].map((id, i) => [id, server(XY[i][0], XY[i][1], ["Web", `app ${i + 1}`], { sub: "16 vCPU", cpu, ...(over[id] ?? {}) })]),
    );
  const fourLinks = (extra = {}) => ({
    in: { ...L("users", "lb", "GET /books"), heads: "both" },
    ...Object.fromEntries(["app", "a2", "a3", "a4"].map((id, i) => [`b${i}`, { ...L("lb", id), heads: "both", ...(extra[`b${i}`] ?? {}) }])),
    ...Object.fromEntries(["app", "a2", "a3", "a4"].map((id, i) => [`d${i}`, { ...L(id, "pg"), ...(extra[`d${i}`] ?? {}) }])),
  });
  const rr = (alive = [0, 1, 2, 3], rate = 3) => [{ route: ["in", alive.map((i) => `b${i}`)], bounce: true, rate }];
  const M = (rps, _servers, p95, cost, survive) => ({ rps, p95, cost, survive });
  const one = (extra = {}) => ({ in: { ...L("users", "app", "GET /books"), heads: "both", ...extra }, db: L("app", "pg", "SQL") });
  const labOne = (rps, sub, st) => lab(20000, rps, [["users", "users", "Shoppers"], ["app", "api_server", "Web app", sub, st], ["db", "postgres", "Postgres"]], [["users", "app"], ["app", "db"]]);
  const labFour = (dbSub) =>
    lab(80000, 4800, [["users", "users", "Shoppers"], ["lb", "load_balancer", "Load balancer"], ["app", "api_server", "Web app ×4", "16 vCPU each"], ["db", "postgres", "Postgres", dbSub]], [["users", "lb"], ["lb", "app"], ["app", "db"]]);

  const steps = [
    step(
      "One server",
      "setup",
      "One machine runs everything",
      [
        "Fernway, an online bookshop, runs its whole web app on one 4-vCPU cloud server with a Postgres database beside it. At 300 requests per second the server is 30% busy and pages load in about 110 ms.",
        "Every growing system reaches the same fork in the road: make the machine <b>bigger</b>, or add <b>more</b> machines.",
      ],
      M(300, 1, 110, 140, "no"),
      { entities: { users: users(5), app: app(), pg: pg() }, links: one(), flows: [{ route: ["in", "db"], bounce: true, rate: 1.2 }] },
      { lab: labOne(300, "4 vCPU") },
    ),
    step(
      "Book club",
      "problem",
      "Traffic quadruples",
      [
        "A celebrity book club recommends a Fernway exclusive. Traffic climbs to 1,200 requests per second, four times what the server was sized for.",
        "CPU sits at 95%, requests queue, and p95 latency jumps from 110 ms to 950 ms. Something has to give.",
      ],
      M(1200, 1, 950, 140, "no"),
      {
        entities: { users: users(12), app: app({ cpu: 0.95, heat: 0.9 }), pg: pg({ cpu: 0.45 }) },
        links: one({ fail: 0.08 }),
        flows: [{ route: ["in", "db"], bounce: true, rate: 2.6, pattern: ["slow", "slow", "req"] }],
      },
      { changes: ["~ Traffic 300 → 1,200 req/s", "~ Web app CPU 30% → 95%"], lab: labOne(1200, "4 vCPU", "crit") },
    ),
    step(
      "Scale up",
      "solution",
      "Vertical scaling: a bigger box",
      [
        `The quickest fix is ${T("vertical scaling")} (scaling up): move to a 16-vCPU machine with four times the memory. No code changes, no new moving parts — the app doesn't even notice.`,
        "CPU drops back to about 30% and p95 returns to 130 ms. The bill goes from $140 to $560 a month: in the cloud, price grows roughly in step with size.",
      ],
      M(1200, 1, 130, 560, "no"),
      {
        entities: { users: users(12), app: app({ s: 5.6, h: 66, sub: "16 vCPU · $560/mo", cpu: 0.3 }), pg: pg({ cpu: 0.45 }) },
        links: one(),
        flows: [{ route: ["in", "db"], bounce: true, rate: 2.6 }],
      },
      {
        callout: co("warn", "Resizing a cloud VM usually means stopping it. Without a second machine, that's a few minutes of downtime."),
        changes: ["~ Web app 4 → 16 vCPU", "~ Cost $140 → $560 / month"],
        lab: labOne(1200, "16 vCPU"),
      },
    ),
    step(
      "Ceiling",
      "problem",
      "The ladder has a top rung",
      [
        "Growth continues. 4,800 req/s needs a 64-vCPU machine at about $2,240 a month — still available. But cloud machines top out at a few hundred vCPUs, and the largest, rarest sizes often carry a premium.",
        "Software hits limits first: lock contention, a single-threaded component or memory bandwidth can cap the speed-up long before the hardware runs out.",
      ],
      M(4800, 1, 140, 2240, "no"),
      {
        entities: {
          users: users(18),
          app: app({ s: 7, h: 84, sub: "64 vCPU · $2,240/mo", cpu: 0.7, tags: [tag("near the top size", "amber", "alert")] }),
          pg: pg({ cpu: 0.6 }),
          card: {
            type: "panel",
            title: "Climbing the size ladder",
            icon: "trendingUp",
            chart: "bars",
            bars: [
              { label: "4 vCPU", note: "$140 · 300 req/s", to: 0.03, tone: "green" },
              { label: "16 vCPU", note: "$560 · 1,200 req/s", to: 0.1, tone: "green" },
              { label: "64 vCPU", note: "$2,240 · 4,800 req/s", to: 0.35, tone: "amber", bold: true },
              { label: "largest offered", note: "hard limit", to: 1, tone: "red" },
            ],
            lines: ["! no size above the top rung"],
          },
        },
        links: one(),
        flows: [{ route: ["in", "db"], bounce: true, rate: 3 }],
      },
      { changes: ["~ Web app 16 → 64 vCPU", "~ Cost $560 → $2,240 / month"] },
    ),
    step(
      "One basket",
      "problem",
      "All eggs, one basket",
      [
        "Then, on a Saturday afternoon, the host machine suffers a hardware fault. With one server there is no partial outage: <b>everything</b> is down until a replacement boots and warms up.",
        `A lone machine is a ${T("single point of failure")}. Planned work hurts too — every OS patch or resize is downtime.`,
      ],
      M(4800, 1, null, 2240, "no"),
      {
        entities: { users: users(18), app: app({ s: 7, h: 84, sub: "64 vCPU · $2,240/mo", ...DOWN }), pg: pg({ cpu: 0.05 }) },
        links: { in: { ...L("users", "app", "GET /books"), heads: "both", style: "cut", fail: 1 }, db: { ...L("app", "pg", "SQL"), style: "off" } },
        flows: [{ route: ["in"], rate: 2.4 }],
      },
      { callout: co("warn", "Bigger hardware fails just as often as small hardware — and takes more down with it."), changes: ["~ Web app DOWN", "~ Every request fails"] },
    ),
    step(
      "Scale out",
      "solution",
      "Horizontal scaling: more boxes",
      [
        `${T("Horizontal scaling")} (scaling out) spreads the load across several ordinary machines behind a load balancer. Four 16-vCPU servers cost the same as one 64-vCPU machine — $2,240 plus about $25 for the balancer.`,
        "Need more? Add a fifth. There's no top rung, and capacity grows (or shrinks) in small steps as traffic changes.",
      ],
      M(4800, 4, 130, 2265, "yes"),
      {
        entities: { users: users(18), lb: balancer(0, -10), ...four(0.55), pg: pg({ x: -8.5, y: 5.5, cpu: 0.6 }) },
        links: fourLinks(),
        flows: rr(),
      },
      { changes: ["+ Load balancer", "~ One 64-vCPU box → four 16-vCPU boxes", "~ Survives losing a server: yes"], lab: labFour() },
    ),
    step(
      "Lose one",
      "solution",
      "Losing a server is now a shrug",
      [
        "When app 3 fails, the balancer stops sending it traffic and the other three absorb its share — each goes from ~55% to ~75% busy. Shoppers see slightly slower pages, not an error page.",
        `This is why teams size for ${T("N+1")}: enough capacity that losing any one machine still leaves everyone below the latency knee.`,
      ],
      M(4800, 4, 170, 2265, "yes"),
      {
        entities: { users: users(18), lb: balancer(0, -10), ...four(0.75, { a3: DOWN }), pg: pg({ x: -8.5, y: 5.5, cpu: 0.6 }) },
        links: fourLinks({ b2: { style: "cut" }, d2: { style: "off" } }),
        flows: rr([0, 1, 3]),
      },
      { changes: ["~ App 3 DOWN", "~ Others 55% → 75% busy"], lab: labFour() },
    ),
    step(
      "Fine print",
      "tradeoff",
      "More machines, more problems",
      [
        "Scaling out isn't free. The app must be <b>stateless</b> — a session kept in one server's memory is invisible to the others. There are more machines to deploy, monitor and patch, and every request takes an extra hop through the balancer.",
        "And look at the database: still one machine, now serving four app servers. Scaling out the stateless tier pushes the bottleneck down into the data tier.",
      ],
      M(4800, 4, 160, 2265, "partly"),
      {
        entities: { users: users(18), lb: balancer(0, -10), ...four(0.55), pg: pg({ x: -8.5, y: 5.5, cpu: 0.88, heat: 0.6, tags: [tag("still just one", "amber", "alert")] }) },
        links: fourLinks(),
        flows: [{ routes: [0, 1, 2, 3].map((i) => ({ path: ["in", `b${i}`, `d${i}`] })), bounce: true, rate: 3, hold: 0.2 }],
      },
      { callout: co("next", "Stateless servers get their own lesson: <i>Forget Me Now</i>."), changes: ["~ Database CPU 60% → 88%", "~ Survives losing a server: partly"], lab: labFour() },
    ),
    step(
      "Use both",
      "insight",
      "Up for state, out for compute",
      [
        "Most real systems mix the two. Stateless app servers scale <b>out</b> cheaply. Databases are harder to split, so they're usually scaled <b>up</b> first — a bigger primary — with a standby copy so a hardware fault doesn't become an outage.",
        "Spreading data across machines (read replicas, sharding) is the next step when even the largest database box isn't enough.",
      ],
      M(4800, 4, 130, 3385, "yes"),
      {
        entities: {
          users: users(18),
          lb: balancer(0, -10),
          ...four(0.55),
          pg: pg({ x: -8.5, y: 5.5, r: 2.3, h: 50, cpu: 0.45, tags: [tag("scaled up", "green", "trendingUp")] }),
          standby: dbase(-3.5, 10.5, "Standby", { cpu: 0.1 }),
          card: card("Scaling recipe", "layers", ["web tier → out (add servers)", "database → up (bigger box)", "+ standby copy for failover", "# then replicas & shards — module 06"]),
        },
        links: { ...fourLinks(), rep: { ...L("pg", "standby", "replicate"), style: "dashed" } },
        flows: [...rr(), { route: ["rep"], kind: "write", rate: 0.8 }],
      },
      { changes: ["~ Database scaled up", "+ Standby database", "~ Cost $2,265 → $3,385 / month"], lab: labFour("scaled up · standby") },
    ),
    step(
      "Recap",
      "recap",
      "Bigger or more?",
      [
        ul(
          "<b>Scale up</b>: simplest, no code changes — but has a ceiling, needs restarts, and stays a single point of failure.",
          "<b>Scale out</b>: no ceiling, survives failures, grows in small steps — but needs stateless servers and a load balancer.",
          "Plan for N+1 so one failure doesn't overload the rest.",
          "Scaling the app tier moves the bottleneck to the data tier.",
        ),
      ],
      M(4800, 4, 130, 3385, "yes"),
      {
        entities: { users: users(18), lb: balancer(0, -10), ...four(0.55), pg: pg({ x: -8.5, y: 5.5, r: 2.3, h: 50, cpu: 0.45 }), standby: dbase(-3.5, 10.5, "Standby", { cpu: 0.1 }) },
        links: { ...fourLinks(), rep: { ...L("pg", "standby", "replicate"), style: "dashed" } },
        flows: [...rr(), { route: ["rep"], kind: "write", rate: 0.8 }],
      },
      { callout: co("next", "Next: the load balancer — the front door that makes “more” possible.") },
    ),
  ];

  write({
    id: "bigger-or-more",
    title: "Bigger or More?",
    summary: "Vertical vs horizontal scaling: a bigger machine is simple until it hits the ceiling — or fails.",
    minutes: 10,
    level: "beginner",
    metrics: ["rps", "p95", "cost", "survive"],
    legend: ["req", "res", "fail", ["write", "replication"]],
    goals: [
      { text: "Scale up and know what it buys", step: 2 },
      { text: "Spot the ceiling and the single point of failure", step: 4 },
      { text: "Scale out behind a load balancer and plan for N+1", step: 6 },
      { text: "See where the bottleneck moves next", step: 7 },
    ],
    steps,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 05-2  the-front-door — load balancers
// ════════════════════════════════════════════════════════════════════════════
{
  const users = (count = 14) => crowd(count, "Readers", { y0: -24, y1: -18 });
  const SX = [-8, 0, 8];
  const srvs = (st = {}) =>
    Object.fromEntries([0, 1, 2].map((i) => [`s${i}`, server(SX[i], 4, ["Server", `${i + 1}`], { cpu: 0.35, ...(st[i] ?? {}) })]));
  const lb = (extra = {}) => balancer(0, -9, ["Load", "Balancer"], { s: 3.8, h: 32, ...extra });
  const links = (extra = {}, inLabel = "brightpost.io") => ({
    in: { ...L("users", "lb", inLabel), heads: "both" },
    ...Object.fromEntries([0, 1, 2].map((i) => [`b${i}`, { ...L("lb", `s${i}`), heads: "both", ...(extra[i] ?? {}) }])),
  });
  const rr = (alive = [0, 1, 2], extra = {}) => ({ route: ["in", alive.map((i) => `b${i}`)], bounce: true, rate: 3, ...extra });
  const M = (rps, p95, errors, healthy, maxShare) => ({ rps, p95, errors, healthy, maxShare });
  const labLb = (st = []) =>
    lab(150000, 3000, [["users", "users", "Readers"], ["lb", "load_balancer", "Load balancer"], ["api", "api_server", "Web servers ×3", undefined, st[0]]], [["users", "lb"], ["lb", "api"]]);

  const steps = [
    step(
      "No door",
      "problem",
      "Three servers, no front door",
      [
        "Brightpost, a newsletter platform, outgrew one server and now runs three. But a browser needs <i>one</i> address. The team lists all three IPs in DNS and hopes readers spread out evenly.",
        "They don't. Resolvers cache a single answer, many clients simply take the first IP, and a dead server's address keeps being handed out until caches expire. Server 1 is taking about 70% of the traffic.",
      ],
      M(3000, 780, 2, "3 / 3", 70),
      {
        entities: { users: users(), ...srvs({ 0: { cpu: 0.95, heat: 0.9, tags: [tag("70% of traffic", "red", "flame")] }, 1: { cpu: 0.2 }, 2: { cpu: 0.1 } }) },
        links: Object.fromEntries([0, 1, 2].map((i) => [`d${i}`, { ...L("users", `s${i}`, i === 0 ? "first IP in DNS" : undefined), heads: "both" }])),
        flows: [{ route: [["d0", "d1", "d2"]], pick: "weights", weights: [7, 2, 1], bounce: true, rate: 3 }],
      },
      { callout: co("warn", "DNS answers are cached for minutes or hours. It can't react quickly to load or to a dead server.") },
    ),
    step(
      "Front door",
      "solution",
      "One address, many servers",
      [
        `A ${T("load balancer")} sits in front, owns the public address, and forwards each request to one of the servers behind it. Readers never learn the servers exist — which means servers can be added or removed freely.`,
        `The simplest policy is ${T("round robin")}: 1, 2, 3, 1, 2, 3… With similar requests and similar servers, each gets a third of the traffic.`,
      ],
      M(3000, 120, 0, "3 / 3", 33),
      { entities: { users: users(), lb: lb(), ...srvs() }, links: links(), flows: [rr()] },
      { changes: ["+ Load balancer owns brightpost.io", "~ Round robin across 3 servers", "~ Biggest share 70% → 33%"], lab: labLb() },
    ),
    step(
      "L4 or L7",
      "technique",
      "How much does the balancer read?",
      [
        `A ${T("Layer 4")} balancer works on TCP connections: it sees IP addresses and ports and forwards bytes without reading them. It's very fast and works for any protocol, but every request on one connection goes to the same server.`,
        `A ${T("Layer 7")} balancer speaks HTTP. It terminates TLS, reads paths, headers and cookies, and can route <code>/api</code> and <code>/images</code> to different pools, retry a failed request, or add headers. More features, more work per request.`,
      ],
      M(3000, 120, 0, "3 / 3", 33),
      {
        entities: {
          users: users(),
          lb: lb({ tags: [tag("L7 · terminates TLS", "violet", "lock")] }),
          ...srvs(),
          card: card("Layer 4 vs Layer 7", "layers", ["L4 · sees IP + port, forwards TCP", "L4 · fast, protocol-agnostic", "L7 · sees URL, headers, cookies", "L7 · TLS, per-request routing, retries", "# most web apps use L7"]),
        },
        links: links({ 0: { label: "HTTP" } }, "HTTPS"),
        flows: [rr()],
      },
      { changes: ["~ Balancer now terminates HTTPS (L7)", "+ Comparison card"] },
    ),
    step(
      "Uneven work",
      "problem",
      "Equal turns, unequal work",
      [
        "Brightpost adds “export subscribers”, which takes ~2 s, while normal requests take 20 ms. Round robin counts turns, not effort: several exports can land on the same server while another sits idle.",
        "Server 2 is now at 94% CPU with a growing queue, and its ordinary requests slow down with it. p95 climbs to 900 ms even though the fleet as a whole is half idle.",
      ],
      M(3000, 900, 0, "3 / 3", 55),
      {
        entities: { users: users(), lb: lb({ tags: [tag("round robin", "gray", "replay")] }), ...srvs({ 1: { cpu: 0.94, heat: 0.8, tags: [tag("3 exports running", "red", "hourglass")] }, 0: { cpu: 0.3 }, 2: { cpu: 0.25 } }) },
        links: links(),
        flows: [{ routes: [{ path: ["in", "b0"] }, { path: ["in", "b1"], kind: "heavy" }, { path: ["in", "b2"] }, { path: ["in", "b1"], kind: "slow" }], bounce: true, rate: 3, hold: 0.2 }],
      },
      { changes: ["+ Slow export requests", "~ Server 2 overloaded, others idle"] },
    ),
    step(
      "Least conns",
      "solution",
      "Send work to whoever is least busy",
      [
        `${T("Least connections")} sends each request to the server with the fewest requests in flight. A server stuck on exports has more open requests, so new work flows elsewhere automatically.`,
        `Variants weigh by server size or measured response time. A cheap alternative is the ${T("power of two choices")}: pick two servers at random, use the less busy one — nearly as good, with far less bookkeeping.`,
      ],
      M(3000, 210, 0, "3 / 3", 36),
      {
        entities: { users: users(), lb: lb({ tags: [tag("least connections", "green", "gauge")] }), ...srvs({ 0: { cpu: 0.5 }, 1: { cpu: 0.55, tags: [tag("1 export", "amber", "hourglass")] }, 2: { cpu: 0.5 } }) },
        links: links(),
        flows: [{ routes: [{ path: ["in", "b0"] }, { path: ["in", "b1"], kind: "heavy" }, { path: ["in", "b2"] }, { path: ["in", "b0"] }, { path: ["in", "b2"] }], bounce: true, rate: 3, hold: 0.2 }],
      },
      { changes: ["~ Algorithm: round robin → least connections", "~ Exports spread out", "~ p95 900 → 210 ms"] },
    ),
    step(
      "Hashing",
      "technique",
      "Same reader, same server",
      [
        `Sometimes you <i>want</i> repeat visitors on the same server — say, so each server's in-memory cache stays warm for its readers. ${T("Hash-based routing")} computes <code>hash(reader_id) mod 3</code> and always picks that server.`,
        `Two catches: popular readers make shares uneven (41% here), and with plain <i>mod N</i>, adding a fourth server remaps about three-quarters of readers. ${T("Consistent hashing")} limits that reshuffle to roughly 1/N.`,
      ],
      M(3000, 140, 0, "3 / 3", 41),
      {
        entities: {
          users: users(),
          lb: lb({ tags: [tag("hash(reader) mod 3", "violet", "hash")] }),
          ...srvs({ 0: { cpu: 0.55, tags: [tag("hash 0 · 41%", "amber")] }, 1: { cpu: 0.4, tags: [tag("hash 1 · 33%")] }, 2: { cpu: 0.33, tags: [tag("hash 2 · 26%")] } }),
        },
        links: links(),
        flows: [{ routes: [{ path: ["in", "b0"], kind: "mine", weight: 41 }, { path: ["in", "b1"], weight: 33 }, { path: ["in", "b2"], weight: 26 }], pick: "weights", bounce: true, rate: 3 }],
      },
      { callout: co("tip", "Hashing trades even load for locality. Use it when a warm per-server cache or connection is worth more than perfect balance."), changes: ["~ Algorithm: hash on reader id", "~ Shares now uneven (41 / 33 / 26%)"] },
    ),
    step(
      "Dead server",
      "problem",
      "The balancer keeps calling a dead line",
      [
        "At 3 a.m. server 3's process hangs. The balancer has no idea — it keeps sending a third of all requests there, and every one of them times out. Errors jump to 33%.",
        "A load balancer is only as smart as what it knows about the servers behind it.",
      ],
      M(3000, null, 33, "2 / 3", 33),
      {
        entities: { users: users(), lb: lb({ tags: [tag("round robin", "gray", "replay")] }), ...srvs({ 2: DOWN }) },
        links: links({ 2: { fail: 1 } }),
        flows: [rr()],
      },
      { changes: ["~ Server 3 hangs", "~ 1 in 3 requests fails"], lab: labLb(["warn"]) },
    ),
    step(
      "Health checks",
      "solution",
      "Ask before you send",
      [
        `The balancer now sends a ${T("health check")} — a tiny request such as <code>GET /healthz</code> — to every server every few seconds. After 3 failures in a row it takes a server out of rotation; after 2 successes it puts it back.`,
        "Traffic now flows only to servers 1 and 2. Each carries 50% more than before, but errors fall back to almost zero. When server 3 recovers, it rejoins on its own.",
      ],
      M(3000, 190, 0, "2 / 3", 50),
      {
        entities: { users: users(), lb: lb({ tags: [tag("checks every 5 s", "green", "heartPulse")] }), ...srvs({ 0: { cpu: 0.55 }, 1: { cpu: 0.55 }, 2: { ...DOWN, tags: [tag("out of rotation", "red", "ban")] } }) },
        links: links({ 2: { style: "beat", fail: 1, label: "GET /healthz" } }),
        flows: [rr([0, 1]), { route: [["b0", "b1", "b2"]], kind: "ping", rate: 1.2, speed: 0.9 }],
      },
      {
        callout: co("tip", "Make the health check test what the server really needs (can it reach its database?), but keep it cheap — it runs thousands of times an hour."),
        changes: ["+ Health checks to every server", "- Server 3 removed from rotation", "~ Errors 33% → ~0%"],
        lab: labLb(),
      },
    ),
    step(
      "Door twice",
      "tradeoff",
      "Who balances the balancer?",
      [
        "Every request now flows through one balancer. If it fails, three healthy servers become unreachable — the front door is the new single point of failure.",
        `So balancers run in pairs. A standby watches the active one with heartbeats and takes over its address — a ${T("floating IP")} — within seconds. Managed cloud balancers do this for you across several zones.`,
      ],
      M(3000, 120, 0, "3 / 3", 33),
      {
        entities: { users: users(), lb: lb({ tags: [tag("active", "green", "check")] }), lb2: balancer(-6, -12, ["Standby", "LB"], { s: 3.2, h: 28, dim: 0.3, tags: [tag("standby", "gray")] }), ...srvs() },
        links: { ...links(), hb: { ...L("lb", "lb2", "heartbeat"), heads: "none", style: "beat" } },
        flows: [rr(), { route: ["hb"], kind: "ping", rate: 0.8, bounce: true }],
      },
      { changes: ["+ Standby balancer with heartbeat", "~ Server 3 recovered and back in rotation"], lab: labLb() },
    ),
    step(
      "Recap",
      "recap",
      "The front door, summarised",
      [
        ul(
          "A load balancer gives clients one stable address and spreads requests across servers.",
          "<b>L4</b> forwards connections; <b>L7</b> understands HTTP and can route, terminate TLS and retry.",
          "Round robin is simple; least connections handles uneven work; hashing keeps a client on one server (consistent hashing for resizes).",
          "Health checks remove dead servers automatically.",
          "Run the balancer itself redundantly, or use a managed one.",
        ),
      ],
      M(3000, 120, 0, "3 / 3", 33),
      {
        entities: { users: users(), lb: lb({ tags: [tag("active", "green", "check")] }), lb2: balancer(-6, -12, ["Standby", "LB"], { s: 3.2, h: 28, dim: 0.3, tags: [tag("standby", "gray")] }), ...srvs() },
        links: { ...links(), hb: { ...L("lb", "lb2", "heartbeat"), heads: "none", style: "beat" } },
        flows: [rr(), { route: ["hb"], kind: "ping", rate: 0.8, bounce: true }],
      },
      { callout: co("next", "Next: what breaks when a server remembers you — and how to make it forget.") },
    ),
  ];

  write({
    id: "the-front-door",
    title: "The Front Door",
    summary: "Load balancers: one address for many servers, smarter ways to share the work, and health checks that route around failure.",
    minutes: 11,
    level: "intermediate",
    metrics: ["rps", "p95", "errors", "healthy", "maxShare"],
    legend: ["req", "res", "heavy", ["mine", "popular reader"], "ping", "fail"],
    goals: [
      { text: "Why clients need one front door", step: 1 },
      { text: "Tell Layer 4 from Layer 7 balancing", step: 2 },
      { text: "Pick an algorithm: round robin, least connections, hashing", step: 5 },
      { text: "Route around dead servers with health checks", step: 7 },
      { text: "Avoid making the balancer a single point of failure", step: 8 },
    ],
    steps,
  });
}

// @@NEXT
