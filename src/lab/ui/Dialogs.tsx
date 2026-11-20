// Practice dialogs: scenario brief, debrief (postmortem), interview report, and how-to-play help.
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { LEVELS } from "../sim/game/levels";
import type { Scores } from "../sim/types";
import { fmtNum, plain } from "../model";
import { dismissResult, resetRun, restartFromStarter, setBriefOpen, setHelpOpen, useLab } from "../store";
import { AXES, Badge, LabDialog, rich, scoreLevel } from "./common";

const menuHref = (mode: string | null) => `#/practice/${mode === "incident" || mode === "interview" ? mode : "campaign"}`;
const toMenu = () => {
  location.hash = menuHref(useLab.getState().mode);
};

function SloGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="lab-slo-grid">
      {items.map(([k, v]) => (
        <div key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

export function BriefDialog() {
  const open = useLab((s) => s.briefOpen && s.phase === "design" && s.tick === 0);
  const level = useLab((s) => s.level);
  const incident = useLab((s) => s.incident);
  const interview = useLab((s) => s.interview);
  const mode = useLab((s) => s.mode);
  const start = () => setBriefOpen(false);

  if (mode === "campaign" && level) {
    return (
      <LabDialog
        id="lab-brief"
        wide
        open={open}
        onClose={toMenu}
        badges={
          <>
            <Badge tone="green" icon="rocket">
              Level {level.number}
            </Badge>
            <Badge icon="users">
              {fmtNum(level.users)} → {fmtNum(level.usersEnd)} users
            </Badge>
          </>
        }
        title={plain(level.title)}
      >
        <p className="lab-dialog__sub">{plain(level.project)}</p>
        <div className="lab-dialog__body">
          {level.brief.map((p, i) => (
            <p key={i}>{rich(p)}</p>
          ))}
        </div>
        <SloGrid
          items={[
            ["p95 latency", `≤ ${level.slo.maxP95Ms}ms`],
            ["Availability", `≥ ${level.slo.minAvailabilityPct}%`],
            ["Error rate", `≤ ${(level.slo.maxErrorRate * 100).toFixed(1)}%`],
            ["Budget", `$${level.slo.maxMonthlyBudget.toLocaleString()}/mo`],
          ]}
        />
        <div className="lab-dialog__actions">
          <button type="button" className="btn-pop lab-action" onClick={start}>
            Take the helm
            <Icon name="arrowRight" size={16} stroke={2.2} />
          </button>
        </div>
      </LabDialog>
    );
  }
  if (mode === "incident" && incident) {
    return (
      <LabDialog
        id="lab-brief"
        wide
        open={open}
        onClose={toMenu}
        badges={
          <>
            <Badge tone="red" icon="siren">
              Active incident
            </Badge>
            <Badge icon="users">{fmtNum(incident.users)} users</Badge>
            <Badge tone="amber" icon="dollar">
              −${incident.revenuePerTick.toLocaleString()}/min while down
            </Badge>
          </>
        }
        title={plain(incident.title)}
      >
        <p className="lab-dialog__sub">{plain(incident.company)}</p>
        <div className="lab-dialog__body">
          {incident.brief.map((p, i) => (
            <p key={i}>{rich(p)}</p>
          ))}
        </div>
        <div className="lab-dialog__actions">
          <button type="button" className="btn-pop lab-action lab-action--danger" onClick={start}>
            Join the war room
            <Icon name="arrowRight" size={16} stroke={2.2} />
          </button>
        </div>
      </LabDialog>
    );
  }
  if (mode === "interview" && interview) {
    return (
      <LabDialog
        id="lab-brief"
        wide
        open={open}
        onClose={toMenu}
        badges={
          <Badge tone="violet" icon="target">
            Architecture interview
          </Badge>
        }
        title={plain(interview.title)}
      >
        <div className="lab-dialog__body">
          {interview.prompt.map((p, i) => (
            <p key={i}>{rich(p)}</p>
          ))}
        </div>
        <div className="lab-dialog__section">Requirements</div>
        <ul className="takeaways">
          {interview.requirements.map((r, i) => (
            <li key={i}>{plain(r)}</li>
          ))}
        </ul>
        <p className="muted-copy">
          Design on the stage, then submit. Your design will be stress-tested at {interview.tiers.map((t) => t.label.split(": ")[1] ?? t.label).join(", ")} —
          including viral hot-key events.
        </p>
        <div className="lab-dialog__actions">
          <button type="button" className="btn-pop lab-action" onClick={start}>
            Start designing
            <Icon name="arrowRight" size={16} stroke={2.2} />
          </button>
        </div>
      </LabDialog>
    );
  }
  return null;
}

const FAIL_KEYWORDS: { match: string; label: string; axis: keyof Scores; fallback: string }[] = [
  { match: "Cost", label: "Cost", axis: "cost", fallback: "You're over budget — swap oversized tiers for more, smaller instances, trim spare replicas/shards, and remove anything unused." },
  {
    match: "Availability",
    label: "Availability",
    axis: "reliability",
    fallback: "Availability dipped — add redundancy (replicas, multiple instances, a load balancer) so a single failure doesn't drop requests.",
  },
  {
    match: "Error",
    label: "Error rate",
    axis: "scalability",
    fallback: "Errors spiked — a component ran out of capacity under load. Add headroom on the busiest node (bigger tier or more instances) and a cache to absorb reads.",
  },
  {
    match: "latency",
    label: "p95 latency",
    axis: "latency",
    fallback: "p95 was too high — latency explodes past ~80% utilization. Cache hot reads, add replicas, or scale the busiest tier.",
  },
];

const isPass = (r: string) => r.includes("✓");

export function DebriefDialog() {
  const phase = useLab((s) => s.phase);
  const mode = useLab((s) => s.mode);
  const level = useLab((s) => s.level);
  const incident = useLab((s) => s.incident);
  const result = useLab((s) => s.result);
  const [axis, setAxis] = useState<keyof Scores | null>(null);
  const [help, setHelp] = useState(false);
  const open = phase === "debrief" && !!result && mode !== "interview" && mode !== "sandbox";
  if (!result || mode === "interview" || mode === "sandbox") return null;

  const debrief = level?.debrief ?? incident?.debrief;
  const next = level ? LEVELS.find((l) => l.number === level.number + 1) : undefined;
  const failing = result.reasons.find((r) => !isPass(r));
  const blocker = failing ? (FAIL_KEYWORDS.find((f) => failing.includes(f.match)) ?? null) : null;
  const hasContent = (k: keyof Scores) => {
    const ex = result.breakdown?.[k];
    return !!ex && (ex.tips.length > 0 || ex.reasons.length > 0);
  };
  const blockerTips = blocker ? (result.breakdown?.[blocker.axis]?.tips.length ? result.breakdown[blocker.axis].tips : [blocker.fallback]) : [];
  const weakest = AXES.reduce((lo, a) => (result.scores[a.key] < result.scores[lo.key] ? a : lo), AXES[0]);
  const weakestWithContent = [...AXES].sort((a, b) => result.scores[a.key] - result.scores[b.key]).find((a) => hasContent(a.key));
  const active: keyof Scores = axis ?? ((blocker && hasContent(blocker.axis) && blocker.axis) || weakestWithContent?.key || weakest.key);
  const activeLabel = AXES.find((a) => a.key === active)!.label;
  const ex = result.breakdown?.[active];
  const close = () => {
    setAxis(null);
    setHelp(false);
    dismissResult();
  };

  return (
    <LabDialog
      id="lab-debrief"
      wide
      open={open}
      onClose={close}
      badges={
        <>
          {result.passed ? (
            <Badge tone="green" icon="circleCheck">
              {mode === "incident" ? "Service restored" : "Level passed"}
            </Badge>
          ) : (
            <Badge tone="red" icon="alert">
              {mode === "incident" ? "Incident unresolved" : "SLO missed"}
            </Badge>
          )}
          <Badge tone="violet">Overall {result.overall}/100</Badge>
        </>
      }
      title={result.passed ? "Postmortem (the good kind)" : "Postmortem"}
    >
      <ul className="lab-reasons">
        {result.reasons.map((r, i) => (
          <li key={i} className={isPass(r) ? "is-ok" : "is-bad"}>
            <Icon name={isPass(r) ? "check" : "close"} size={12} stroke={3} />
            {plain(r.replace(/[✓✗]/g, ""))}
          </li>
        ))}
      </ul>

      {!result.passed &&
        blocker &&
        (help ? (
          <div className="callout callout--warn">
            <span className="callout__icon">
              <Icon name="bulb" size={15} stroke={2} />
            </span>
            <div>
              <div className="callout__title">Fix this first — {blocker.label} is what failed</div>
              <ul className="lab-tips">
                {blockerTips.map((t, i) => (
                  <li key={i}>{plain(t)}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="callout callout--next lab-stuck">
            <p>Try to work out the fix yourself first — check the scores below and ask the mentor. Still stuck?</p>
            <button type="button" className="btn-ghost" id="lab-stuck" onClick={() => setHelp(true)}>
              <Icon name="bulb" size={15} stroke={2} />
              Show me what to fix
            </button>
          </div>
        ))}

      <div className="lab-axes">
        {AXES.map((a) => (
          <button
            key={a.key}
            type="button"
            className={a.key === active ? "lab-axis is-on" : "lab-axis"}
            data-level={scoreLevel(result.scores[a.key])}
            onClick={() => setAxis(a.key)}
          >
            <b>{result.scores[a.key]}</b>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      <div className="lab-axis-detail">
        <div className="lab-dialog__section">
          {activeLabel} {result.scores[active]}/100 <span>· tap any score above</span>
        </div>
        {ex && (ex.reasons.length > 0 || ex.tips.length > 0) ? (
          <>
            {ex.reasons.length > 0 && (
              <ul className="lab-tips lab-tips--minus">
                {ex.reasons.map((r, i) => (
                  <li key={i}>{plain(r)}</li>
                ))}
              </ul>
            )}
            {ex.tips.length > 0 &&
              (help ? (
                <>
                  <div className="lab-dialog__section">To improve</div>
                  <ul className="lab-tips">
                    {ex.tips.map((t, i) => (
                      <li key={i}>{plain(t)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <button type="button" className="lab-link" onClick={() => setHelp(true)}>
                  Stuck? Reveal how to improve this →
                </button>
              ))}
          </>
        ) : (
          <p className="muted-copy">Nothing to fix here — this axis is solid.</p>
        )}
      </div>

      {debrief && (
        <div className="callout callout--insight lab-concept">
          <span className="callout__icon">
            <Icon name="book" size={15} stroke={2} />
          </span>
          <div>
            <div className="callout__title">What this was really about</div>
            <h3>{plain(debrief.concept)}</h3>
            {debrief.explanation.map((p, i) => (
              <p key={i}>{plain(p)}</p>
            ))}
            <div className="callout__title lab-concept__sub">Tradeoffs to carry with you</div>
            <ul className="lab-tips lab-tips--scale">
              {debrief.tradeoffs.map((t, i) => (
                <li key={i}>{plain(t)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="lab-dialog__actions lab-dialog__actions--wrap">
        <a className="btn-ghost" href={menuHref(mode)}>
          Menu
        </a>
        <button type="button" className="btn-ghost" onClick={close}>
          Inspect the wreckage
        </button>
        <button type="button" className="btn-ghost" title="Discard your design and rebuild the original starter architecture" onClick={restartFromStarter}>
          From scratch
        </button>
        <button type="button" className="btn-ghost" id="lab-retry" title="Keep your architecture and replay the simulation from the start" onClick={resetRun}>
          <Icon name="replay" size={15} stroke={2} />
          Retry (keep my build)
        </button>
        {result.passed && next && (
          <a className="btn-pop lab-action" href={`#/play/campaign/${next.id}`}>
            Next: Level {next.number} — {plain(next.title)}
            <Icon name="arrowRight" size={16} stroke={2.2} />
          </a>
        )}
      </div>
    </LabDialog>
  );
}

export function ReportDialog() {
  const phase = useLab((s) => s.phase);
  const mode = useLab((s) => s.mode);
  const report = useLab((s) => s.report);
  const interview = useLab((s) => s.interview);
  if (mode !== "interview" || !report || !interview) return null;
  const open = phase === "debrief";
  const hire = report.verdict.startsWith("Strong Hire") || report.verdict.startsWith("Hire");
  return (
    <LabDialog
      id="lab-report"
      wide
      open={open}
      onClose={dismissResult}
      badges={
        <>
          <Badge tone={hire ? "green" : "amber"} icon="clipboard">
            Interview feedback
          </Badge>
          <Badge tone="violet">{report.overall}/100</Badge>
        </>
      }
      title={plain(interview.title)}
    >
      <p className={hire ? "lab-verdict is-hire" : "lab-verdict"}>{plain(report.verdict)}</p>
      <div className="lab-dialog__section">Stress test results</div>
      <div className="lab-table">
        <table className="compare numbers">
          <thead>
            <tr>
              <th>Tier</th>
              <th>p95</th>
              <th>Errors</th>
              <th>Cost/mo</th>
              <th>Steady</th>
              <th>Viral spike</th>
            </tr>
          </thead>
          <tbody>
            {report.tierResults.map((t) => (
              <tr key={t.label}>
                <td>{plain(t.label)}</td>
                <td>{t.p95Ms}ms</td>
                <td>{(t.errorRate * 100).toFixed(1)}%</td>
                <td>${fmtNum(t.costPerMonth)}</td>
                <td className={t.passed ? "is-ok" : "is-bad"}>{t.passed ? "Pass" : "Fail"}</td>
                <td className={t.underStress.passed ? "is-ok" : "is-bad"}>
                  {t.underStress.passed ? "Pass" : `Fail · ${(t.underStress.errorRate * 100).toFixed(0)}% err`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="lab-sg">
        <div>
          <div className="lab-dialog__section">Strengths</div>
          <ul className="lab-tips lab-tips--plus">{report.strengths.length ? report.strengths.map((s, i) => <li key={i}>{plain(s)}</li>) : <li>—</li>}</ul>
        </div>
        <div>
          <div className="lab-dialog__section">Gaps the interviewer noticed</div>
          <ul className="lab-tips lab-tips--minus">{report.gaps.length ? report.gaps.map((g, i) => <li key={i}>{plain(g)}</li>) : <li>—</li>}</ul>
        </div>
      </div>
      <div className="lab-dialog__actions">
        <a className="btn-ghost" href="#/practice/interview">
          Menu
        </a>
        <button type="button" className="btn-ghost" onClick={dismissResult}>
          Revise design
        </button>
        <button type="button" className="btn-pop lab-action" onClick={restartFromStarter}>
          <Icon name="replay" size={15} stroke={2.2} />
          Fresh attempt
        </button>
      </div>
    </LabDialog>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="lab-help__step">
      <span className="lab-help__n">{n}</span>
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </li>
  );
}

const RECIPES: [string, string, string, string][] = [
  ["split", "Load Balancer", "Users → LB → API ×N", "Only helps with 2+ API instances behind it. Spreads traffic and reroutes around crashes."],
  ["zap", "Cache (Redis)", "API → Redis and API → DB", "Absorbs repeated reads before they hit the database. Keep the DB connected too — for cache misses."],
  ["inbox", "Queue (Kafka/SQS)", "API → Queue → Worker → DB", "Buffers write bursts so the database sees a smooth drain instead of a spike. Needs a Worker to consume it."],
  ["globe", "CDN", "Users → CDN → LB/API", "Serves static content from the edge, cutting latency and origin load."],
  ["search", "Search (Elasticsearch)", "API → Elasticsearch", "Handles text-search queries that would otherwise scan the whole database."],
  ["activity", "Observability", "API → O11y, DB → O11y", "Not in the traffic path — it just needs to exist to unlock diagnostics. Connect it to what it watches."],
];

export function HelpDialog() {
  const open = useLab((s) => s.helpOpen);
  return (
    <LabDialog
      id="lab-help"
      wide
      open={open}
      onClose={() => setHelpOpen(false)}
      badges={
        <Badge tone="violet" icon="book">
          Field manual
        </Badge>
      }
      title="How to play"
    >
      <p className="lab-dialog__sub">
        Design an architecture, press <b>Launch</b>, and watch simulated traffic flow through it. Things break the way they break in production —
        your job is to spot it and fix it.
      </p>
      <ol className="lab-help">
        <Step n={1} title="Add a component">
          Click a block in the <b>Components</b> palette (left; the menu button on small screens). If a block is selected, the new one is connected
          from it automatically. The stage arranges everything for you — traffic flows from Users outward.
        </Step>
        <Step n={2} title="Connect components">
          Click a block on the stage to open the <b>Inspector</b>. Use <b>Connect to…</b> to wire it to another block, or the unplug button to
          remove a connection. Unwired blocks sit dimmed in a lane below the diagram.
        </Step>
        <Step n={3} title="Configure">
          In the Inspector change the instance size (vertical scaling), instance count (horizontal scaling), replicas, caching strategy, shard key
          and reliability toggles.
        </Step>
        <Step n={4} title="Delete">
          Select a block and press <b>Remove component</b> (or Delete / Backspace). The Users block can’t be removed.
        </Step>
        <Step n={5} title="Run the simulation">
          Press <b>Launch</b> (Space). Use <b>1× / 2× / 4×</b> for speed, <b>Step</b> to advance one minute, and pause anytime to redesign
          mid-run.
        </Step>
        <Step n={6} title="Read the board">
          Block pills show load: green is healthy, amber strained, red failing; DOWN means crashed. Red × packets are failing requests. The
          <b> Events</b> tab streams alerts, the <b>Mentor</b> asks guiding questions, and the <b>Design review</b> scores grade the design.
        </Step>
      </ol>
      <div className="lab-dialog__section">What connects to what</div>
      <div className="lab-recipes">
        {RECIPES.map(([icon, name, flow, text]) => (
          <div key={name} className="lab-recipe">
            <div className="lab-recipe__name">
              <Icon name={icon} size={14} stroke={2} />
              {name}
            </div>
            <code>{flow}</code>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <p className="muted-copy">The golden rule: a component only helps if traffic can actually reach it.</p>
      <div className="lab-dialog__actions">
        <button type="button" className="btn-pop lab-action" onClick={() => setHelpOpen(false)}>
          Got it
          <Icon name="arrowRight" size={16} stroke={2.2} />
        </button>
      </div>
    </LabDialog>
  );
}
