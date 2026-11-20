// Design Lab sheet: head (title / project / badges), the isometric stage with live HUD chips and
// sim tools, and the design score strip.
import { useEffect, useRef, useState } from "react";
import { useClassroom } from "../../app/store";
import { Icon } from "../../components/Icon";
import { Engine } from "../../engine";
import type { EngineApi } from "../../engine";
import type { SLO } from "../sim/types";
import { fmtNum, plain } from "../model";
import type { LabState } from "../store";
import { pause, resetRun, run, scenarioOf, selectNode, setHelpOpen, setSpeed, stepOnce, submitInterview, targetUsersOf, useLab } from "../store";
import { entityId, nodeIdOf, toScene } from "../toScene";
import { AXES, MODES, scoreLevel } from "./common";

let labEngine: EngineApi | null = null;
export const getLabEngine = () => labEngine;

function sloOf(s: LabState): SLO | undefined {
  return scenarioOf(s)?.slo ?? s.interview?.slo;
}

export function LabHead() {
  const mode = useLab((s) => s.mode);
  const level = useLab((s) => s.level);
  const incident = useLab((s) => s.incident);
  const interview = useLab((s) => s.interview);
  const sandbox = useLab((s) => s.sandbox);
  const nodes = useLab((s) => s.nodes.length);
  const origin = useLab((s) => s.origin);

  let crumb: React.ReactNode = "Design Lab";
  let title = "Design Lab";
  let subtitle = "Free-form sandbox: add components, wire them up, and run real traffic through the design.";
  const tags: React.ReactNode[] = [];
  if (mode === "campaign" && level) {
    crumb = (
      <>
        Practice <span>/</span> {MODES.campaign.label} <span>/</span> Level {level.number}
      </>
    );
    title = level.title;
    subtitle = level.project;
    tags.push(
      <span className="tag tag--sand" key="u">
        <Icon name="users" size={13} stroke={2} />
        {fmtNum(level.users)} → {fmtNum(level.usersEnd)}
      </span>,
      <span className="tag tag--mint" key="d">
        <Icon name="clock" size={13} stroke={2} />
        {level.durationTicks} min
      </span>,
    );
  } else if (mode === "incident" && incident) {
    crumb = (
      <>
        Practice <span>/</span> {MODES.incident.label}
      </>
    );
    title = incident.title;
    subtitle = incident.company;
    tags.push(
      <span className="tag tag--red" key="a">
        <Icon name="siren" size={13} stroke={2} />
        Active incident
      </span>,
      <span className="tag tag--sand" key="r">
        <Icon name="dollar" size={13} stroke={2} />
        −${incident.revenuePerTick.toLocaleString()}/min down
      </span>,
    );
  } else if (mode === "interview" && interview) {
    crumb = (
      <>
        Practice <span>/</span> {MODES.interview.label}
      </>
    );
    title = interview.title;
    subtitle = plain(interview.requirements.join(" · "));
    tags.push(
      <span className="tag tag--violet" key="t">
        <Icon name="target" size={13} stroke={2} />
        up to {fmtNum(interview.tiers[interview.tiers.length - 1].users)} users
      </span>,
    );
  } else if (mode === "sandbox") {
    crumb = (
      <>
        Design Lab <span>/</span> Sandbox
      </>
    );
    if (origin) subtitle = `From lesson “${origin.title}” · step ${origin.step + 1}. Tinker with it, then Launch to run live traffic through it.`;
    tags.push(
      <span className="tag tag--sand" key="u">
        <Icon name="users" size={13} stroke={2} />
        {fmtNum(sandbox.users)} users
      </span>,
      <span className="tag tag--mint" key="n">
        <Icon name="boxes" size={13} stroke={2} />
        {nodes} blocks
      </span>,
    );
  }
  return (
    <div className="lesson-head lab-head" id="head">
      <div className="crumb">{crumb}</div>
      <div className="lesson-head__row">
        <h2 className="title" title={title}>
          {plain(title)}
        </h2>
        <div className="tags">{tags}</div>
      </div>
      <p className="subtitle" title={subtitle}>
        {subtitle}
      </p>
    </div>
  );
}

type Level = "good" | "warn" | "bad" | undefined;

function Chip({ k, icon, label, value, level }: { k: string; icon: string; label: string; value: string; level?: Level }) {
  return (
    <div className="chip" data-k={k} data-level={level}>
      <span className="chip__label">
        <Icon name={icon} size={12} stroke={2} />
        {label}
      </span>
      <span className="chip__value">{value}</span>
    </div>
  );
}

function Hud() {
  const s = useLab();
  const m = s.metricsHistory[s.metricsHistory.length - 1];
  const slo = sloOf(s);
  const incident = s.mode === "incident";
  if (!m) {
    return (
      <div className="stage__hud lab-hud" id="hud">
        <Chip k="users" icon="users" label="Users" value={fmtNum(scenarioOf(s)?.users ?? targetUsersOf(s))} />
        <Chip k="rps" icon="activity" label="Traffic" value="–" />
        <Chip k="p95" icon="timer" label="p95 target" value={slo ? `≤ ${slo.maxP95Ms}ms` : "–"} />
        <Chip k="errors" icon="alert" label="Error target" value={slo ? `≤ ${(slo.maxErrorRate * 100).toFixed(1)}%` : "–"} />
        <Chip k="avail" icon="heartPulse" label="Uptime target" value={slo ? `≥ ${slo.minAvailabilityPct}%` : "–"} />
        {incident ? (
          <Chip k="lost" icon="dollar" label="Revenue lost" value="$0" />
        ) : (
          <Chip k="cost" icon="dollar" label="Budget" value={slo ? `$${fmtNum(slo.maxMonthlyBudget)}/mo` : "–"} />
        )}
      </div>
    );
  }
  const p95: Level = slo ? (m.p95LatencyMs <= slo.maxP95Ms ? "good" : m.p95LatencyMs <= slo.maxP95Ms * 1.5 ? "warn" : "bad") : undefined;
  const err: Level = slo ? (m.errorRate > slo.maxErrorRate ? "bad" : m.errorRate > 0.001 ? "warn" : "good") : undefined;
  const avail: Level = slo ? (m.availabilityPct >= slo.minAvailabilityPct ? "good" : "bad") : undefined;
  const cost: Level = incident ? (s.lostRevenue > 0 ? "bad" : "good") : slo ? (m.costPerMonth > slo.maxMonthlyBudget ? "bad" : "good") : undefined;
  return (
    <div className="stage__hud lab-hud" id="hud">
      <Chip k="users" icon="users" label="Users" value={fmtNum(m.usersNow)} />
      <Chip k="rps" icon="activity" label="Traffic" value={`${fmtNum(m.totalRps)} rps`} />
      <Chip k="p95" icon="timer" label="p95 latency" value={`${Math.round(m.p95LatencyMs)}ms`} level={p95} />
      <Chip k="errors" icon="alert" label="Error rate" value={`${(m.errorRate * 100).toFixed(2)}%`} level={err} />
      <Chip k="avail" icon="heartPulse" label="Availability" value={`${m.availabilityPct.toFixed(2)}%`} level={avail} />
      {incident ? (
        <Chip k="lost" icon="dollar" label="Revenue lost" value={`$${fmtNum(s.lostRevenue)}`} level={cost} />
      ) : (
        <Chip k="cost" icon="dollar" label="Infra cost" value={`$${fmtNum(m.costPerMonth)}/mo`} level={cost} />
      )}
    </div>
  );
}

function Tools({ manual }: { manual: boolean }) {
  const mode = useLab((s) => s.mode);
  const running = useLab((s) => s.running);
  const phase = useLab((s) => s.phase);
  const tick = useLab((s) => s.tick);
  return (
    <div className="stage__tools">
      <button className="tool tool--fit" type="button" hidden={!manual} title="Back to the whole diagram (0)" onClick={() => labEngine?.fit()}>
        <Icon name="zoomOut" size={15} stroke={2} />
        <span>Fit</span>
      </button>
      <button className="tool" type="button" title="How to play" aria-label="How to play" onClick={() => setHelpOpen(true)}>
        <Icon name="info" size={15} stroke={2} />
      </button>
      {mode === "interview" ? (
        <button className="tool is-on" type="button" id="lab-submit" onClick={submitInterview}>
          <Icon name="clipboard" size={15} stroke={2} />
          <span>Submit design</span>
        </button>
      ) : running ? (
        <button className="tool" type="button" id="lab-run" title="Pause (Space)" onClick={pause}>
          <Icon name="pause" size={15} stroke={2} />
          <span>Pause</span>
        </button>
      ) : (
        <button className="tool is-on" type="button" id="lab-run" title="Run (Space)" disabled={phase === "debrief"} onClick={run}>
          <Icon name="play" size={15} stroke={2} />
          <span>{tick === 0 ? "Launch" : "Resume"}</span>
        </button>
      )}
    </div>
  );
}

function RunBar() {
  const mode = useLab((s) => s.mode);
  const speed = useLab((s) => s.speed);
  const tick = useLab((s) => s.tick);
  const phase = useLab((s) => s.phase);
  const duration = useLab((s) => scenarioOf(s)?.durationTicks ?? 0);
  if (mode === "interview") {
    return (
      <div className="stage__legend lab-run">
        <span>Design on the stage, then submit it for a stress test at every scale tier.</span>
      </div>
    );
  }
  const finite = Number.isFinite(duration) && duration > 0;
  return (
    <div className="stage__legend lab-run">
      <div className="lab-seg" role="group" aria-label="Speed">
        {([1, 2, 4] as const).map((v) => (
          <button key={v} type="button" className={v === speed ? "is-on" : undefined} aria-pressed={v === speed} onClick={() => setSpeed(v)}>
            {v}×
          </button>
        ))}
      </div>
      <button className="lab-mini" type="button" title="Advance one minute" disabled={phase === "debrief" || phase === "running"} onClick={stepOnce}>
        <Icon name="arrowRight" size={13} stroke={2.2} />
        Step
      </button>
      <button className="lab-mini" type="button" title="Replay from the start, keeping your design" disabled={tick === 0} onClick={resetRun}>
        <Icon name="replay" size={13} stroke={2.2} />
        Reset
      </button>
      {finite ? (
        <span className="lab-run__clock">
          <span className="lab-run__track">
            <span style={{ width: `${Math.min(100, (tick / duration) * 100)}%` }} />
          </span>
          t+{tick}/{duration}m
        </span>
      ) : (
        <span className="lab-run__clock">t+{tick}m</span>
      )}
    </div>
  );
}

function sceneFor(s: LabState) {
  const m = s.metricsHistory[s.metricsHistory.length - 1];
  return toScene(s.nodes, s.edges, {
    users: m?.usersNow ?? scenarioOf(s)?.users ?? targetUsersOf(s),
    rps: m?.totalRps ?? 0,
    live: s.tick > 0,
  });
}

function LabCanvas({ onManual }: { onManual: (m: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useClassroom((s) => s.theme);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let engine: EngineApi | null = null;
    try {
      engine = new Engine(el);
    } catch (err) {
      console.warn("[lab] engine failed to start", err);
      return;
    }
    labEngine = engine;
    engine.onView = onManual;
    engine.onPick = (id) => selectNode(nodeIdOf(useLab.getState().nodes, id));
    const render = (s: LabState) => {
      if (!engine || !s.mode) return;
      engine.update(sceneFor(s));
      engine.select(s.selectedId ? entityId(s.selectedId) : null);
      engine.paused = !s.running;
      engine.svg.setAttribute("aria-label", "Architecture diagram");
    };
    render(useLab.getState());
    const unsub = useLab.subscribe((s, p) => {
      if (s.nodes !== p.nodes || s.edges !== p.edges || s.metricsHistory !== p.metricsHistory || s.selectedId !== p.selectedId || s.running !== p.running || s.mode !== p.mode || s.tick !== p.tick)
        render(s);
    });
    return () => {
      unsub();
      if (labEngine === engine) labEngine = null;
      engine?.destroy();
    };
  }, [onManual]);
  useEffect(() => {
    labEngine?.retheme();
  }, [theme]);
  return <div className="stage__canvas" id="lab-canvas" ref={host} />;
}

export function LabStage() {
  const [manual, setManual] = useState(false);
  return (
    <section className="card stage lab-stage" aria-label="Diagram">
      <Hud />
      <Tools manual={manual} />
      <LabCanvas onManual={setManual} />
      <RunBar />
    </section>
  );
}

export function ScoreStrip() {
  const scores = useLab((s) => s.scores);
  const breakdown = useLab((s) => s.scoreBreakdown);
  const [axis, setAxis] = useState<keyof NonNullable<typeof scores> | null>(null);
  if (!scores) return null;
  const ex = axis ? breakdown?.[axis] : undefined;
  return (
    <section className="card timeline lab-scores" id="timeline" aria-label="Design scores">
      <div className="timeline__head">
        <span className="eyebrow">Design review</span>
        <span className="timeline__count">{axis ? "Tap again to close" : "Tap a score to see why"}</span>
      </div>
      <div className="lab-scores__row">
        {AXES.map((a) => {
          const v = scores[a.key];
          return (
            <button
              key={a.key}
              type="button"
              className={axis === a.key ? "lab-score is-on" : "lab-score"}
              data-level={scoreLevel(v)}
              aria-pressed={axis === a.key}
              onClick={() => setAxis(axis === a.key ? null : a.key)}
            >
              <Icon name={a.icon} size={13} stroke={2} />
              <span className="lab-score__label">{a.short}</span>
              <span className="lab-score__v">{v}</span>
            </button>
          );
        })}
      </div>
      {axis && (
        <div className="lab-scores__detail">
          {ex && (ex.reasons.length > 0 || ex.tips.length > 0) ? (
            <ul>
              {ex.reasons.map((r, i) => (
                <li key={`r${i}`} className="is-reason">
                  {plain(r)}
                </li>
              ))}
              {ex.tips.map((r, i) => (
                <li key={`t${i}`} className="is-tip">
                  {plain(r)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">Solid — nothing to fix on this axis.</p>
          )}
        </div>
      )}
    </section>
  );
}

