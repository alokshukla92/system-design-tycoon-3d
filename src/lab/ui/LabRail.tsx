// Design Lab rail: Inspector for the selected block, otherwise the scenario brief / sandbox
// controls, plus live SLO goals.
import { Icon } from "../../components/Icon";
import { D, t } from "../../i18n";
import { tr } from "../../i18n/rich";
import { CATALOG } from "../sim/catalog/components";
import type { ComponentKind, ConfigField, SLO } from "../sim/types";
import { USER_STOPS, WORKLOADS, fmtNum, plain, workloadById } from "../model";
import type { ChaosKind } from "../store";
import {
  clearSandbox,
  connect,
  disconnect,
  dismissOrigin,
  injectChaos,
  removeNode,
  restartFromStarter,
  scenarioOf,
  selectNode,
  setSandbox,
  updateNodeConfig,
  updateNodeData,
  useLab,
} from "../store";
import { KIND_ICON, MODES, rich } from "./common";

const NO_INSTANCES: ComponentKind[] = ["users", "cdn", "dynamodb", "sqs", "load_balancer", "monitoring", "k8s_cluster", "kafka"];

const CATEGORY_LABEL: Record<string, string> = {
  traffic: D("traffic"),
  network: D("network"),
  compute: D("compute"),
  database: D("database"),
  cache: D("cache"),
  messaging: D("messaging"),
  search: D("search"),
  observability: D("observability"),
};

const CATEGORY_CHAPTER: Record<string, string> = {
  traffic: "sand",
  network: "green",
  compute: "blue",
  database: "ink",
  cache: "amber",
  messaging: "green",
  search: "violet",
  observability: "sand",
};

function Field({ label, hint, children, inline }: { label: string; hint?: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={inline ? "lab-field lab-field--inline" : "lab-field"}>
      <label className="lab-field__row">
        <span className="lab-field__label">{label}</span>
        {children}
      </label>
      {hint && <p className="lab-field__hint">{plain(hint)}</p>}
    </div>
  );
}

function Stepper({ value, min = 1, max = 100, onChange, label }: { value: number; min?: number; max?: number; onChange: (v: number) => void; label: string }) {
  const clampV = (v: number) => Math.max(min, Math.min(max, Math.round(v)));
  return (
    <span className="lab-stepper">
      <button type="button" aria-label={t("Decrease {label}", { label })} disabled={value <= min} onClick={() => onChange(clampV(value - 1))}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(clampV(v));
        }}
      />
      <button type="button" aria-label={t("Increase {label}", { label })} disabled={value >= max} onClick={() => onChange(clampV(value + 1))}>
        +
      </button>
    </span>
  );
}

function ConfigInput({ id, f, value }: { id: string; f: ConfigField; value: string | number | boolean | undefined }) {
  if (f.type === "toggle") {
    const on = value === true;
    return (
      <Field label={f.label} hint={f.hint} inline>
        <button type="button" role="switch" aria-checked={on} className={on ? "lab-switch is-on" : "lab-switch"} onClick={() => updateNodeConfig(id, f.key, !on)}>
          <span />
        </button>
      </Field>
    );
  }
  if (f.type === "select") {
    return (
      <Field label={f.label} hint={f.options?.find((o) => o.value === String(value ?? f.default))?.hint ?? f.hint}>
        <select className="lab-select" value={String(value ?? f.default)} onChange={(e) => updateNodeConfig(id, f.key, e.target.value)}>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {plain(o.label)}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  return (
    <Field label={f.label} hint={f.hint} inline>
      <Stepper label={f.label} value={Number(value ?? f.default)} min={f.min ?? 0} max={f.max ?? 100} onChange={(v) => updateNodeConfig(id, f.key, v)} />
    </Field>
  );
}

function Inspector({ id }: { id: string }) {
  const node = useLab((s) => s.nodes.find((n) => n.id === id));
  const nodes = useLab((s) => s.nodes);
  const edges = useLab((s) => s.edges);
  const mode = useLab((s) => s.mode);
  if (!node) return null;
  const spec = CATALOG[node.data.kind];
  const isUsers = node.data.kind === "users";
  const rt = node.data.runtime;
  const label = (nid: string) => plain(nodes.find((n) => n.id === nid)?.data.label ?? nid);
  const out = edges.filter((e) => e.source === id);
  const inc = edges.filter((e) => e.target === id);
  const targets = nodes.filter((n) => n.id !== id && n.data.kind !== "users" && !out.some((e) => e.target === n.id));
  const util = rt ? Math.round(Math.min(rt.utilization, 9.99) * 100) : 0;

  return (
    <section className="card guide lab-inspect" id="guide" aria-label={t("Inspector")}>
      <div className="guide__meta">
        <span className="eyebrow">{t("Inspect")}</span>
        <div className="guide__meta-end">
          <span className={`chapter chapter--${CATEGORY_CHAPTER[spec.category] ?? "sand"}`}>{CATEGORY_LABEL[spec.category] ? t(CATEGORY_LABEL[spec.category]) : spec.category}</span>
          <button className="lab-x" type="button" aria-label={t("Close the inspector")} title={t("Deselect (Esc)")} onClick={() => selectNode(null)}>
            <Icon name="close" size={15} stroke={2.2} />
          </button>
        </div>
      </div>
      <div className="guide__content lab-inspect__body">
        <h3 className="guide__title lab-inspect__title">
          <span className="lab-inspect__icon">
            <Icon name={KIND_ICON[node.data.kind]} size={17} stroke={1.9} />
          </span>
          {plain(node.data.label)}
        </h3>
        <p className="lab-inspect__desc">{plain(spec.description)}</p>

        {rt && !isUsers && (
          <div className="lab-stats">
            <div data-level={rt.utilization > 0.95 ? "bad" : rt.utilization > 0.75 ? "warn" : "good"}>
              <span>{t("Utilization")}</span>
              <b>{util >= 999 ? ">999%" : `${util}%`}</b>
            </div>
            <div>
              <span>{t("Latency")}</span>
              <b>{rt.latencyMs.toFixed(0)}ms</b>
            </div>
            <div>
              <span>{t("Traffic")}</span>
              <b>{fmtNum(Math.round(rt.servedRps))} rps</b>
            </div>
            <div data-level={rt.errorRate > 0.02 ? "bad" : rt.errorRate > 0.001 ? "warn" : "good"}>
              <span>{t("Errors")}</span>
              <b>{(rt.errorRate * 100).toFixed(1)}%</b>
            </div>
          </div>
        )}

        {!isUsers && spec.tiers.length > 1 && (
          <Field label={t("Instance size")} hint={t("Vertical scaling — bigger box, super-linear cost")}>
            <select className="lab-select" value={node.data.tier} onChange={(e) => updateNodeData(id, { tier: e.target.value })}>
              {spec.tiers.map((x) => (
                <option key={x.id} value={x.id}>
                  {plain(x.label)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!NO_INSTANCES.includes(node.data.kind) && (
          <Field label={t("Instances")} hint={t("Horizontal scaling — more identical boxes")} inline>
            <Stepper label={t("Instances")} value={node.data.instances} onChange={(v) => updateNodeData(id, { instances: v })} />
          </Field>
        )}
        {spec.config.map((f) => (
          <ConfigInput key={f.key} id={id} f={f} value={node.data.config[f.key]} />
        ))}

        <div className="lab-conn">
          <div className="lab-conn__head">{t("Connections")}</div>
          {inc.length === 0 && out.length === 0 && <p className="lab-field__hint">{t("Not wired yet — traffic can’t reach it.")}</p>}
          <ul>
            {inc.map((e) => (
              <li key={e.id}>
                <Icon name="arrowLeft" size={13} stroke={2} />
                <button type="button" className="lab-conn__name" onClick={() => selectNode(e.source)}>
                  {label(e.source)}
                </button>
                <button type="button" className="lab-conn__rm" title={t("Remove connection")} aria-label={t("Disconnect from {name}", { name: label(e.source) })} onClick={() => disconnect(e.id)}>
                  <Icon name="unplug" size={13} stroke={2} />
                </button>
              </li>
            ))}
            {out.map((e) => (
              <li key={e.id}>
                <Icon name="arrowRight" size={13} stroke={2} />
                <button type="button" className="lab-conn__name" onClick={() => selectNode(e.target)}>
                  {label(e.target)}
                </button>
                <button type="button" className="lab-conn__rm" title={t("Remove connection")} aria-label={t("Disconnect {name}", { name: label(e.target) })} onClick={() => disconnect(e.id)}>
                  <Icon name="unplug" size={13} stroke={2} />
                </button>
              </li>
            ))}
          </ul>
          {targets.length > 0 && (
            <select
              className="lab-select"
              aria-label={t("Connect to")}
              value=""
              onChange={(e) => {
                if (e.target.value) connect(id, e.target.value);
              }}
            >
              <option value="">{t("Connect to…")}</option>
              {targets.map((n) => (
                <option key={n.id} value={n.id}>
                  {plain(n.data.label)}
                </option>
              ))}
            </select>
          )}
        </div>

        {!isUsers && (
          <div className="lab-inspect__foot">
            <div className="lab-inspect__badges">
              {spec.consistency && <span className="lab-badge lab-badge--violet">{t("{level} consistency", { level: spec.consistency })}</span>}
              <span className="lab-badge">{t("{amount}/mo base", { amount: `$${spec.costPerMonthUsd}` })}</span>
            </div>
            {mode !== null && (
              <button type="button" className="btn-ghost lab-danger" id="lab-remove" onClick={() => removeNode(id)}>
                <Icon name="close" size={15} stroke={2} />
                {t("Remove component")}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function SloLine({ label, ok, value }: { label: string; ok: boolean | null; value: string }) {
  return (
    <li className={ok ? "is-hit" : undefined}>
      <span className={`check${ok ? " is-on" : ""}`}>
        <Icon name="check" size={11} stroke={3} />
      </span>
      <span>{label}</span>
      <b className="lab-slo__v">{value}</b>
    </li>
  );
}

function Goals({ slo }: { slo: SLO }) {
  const m = useLab((s) => s.metricsHistory[s.metricsHistory.length - 1]);
  const incident = useLab((s) => s.mode === "incident");
  return (
    <section className="card goals lab-goals" id="goals" aria-label={t("Targets")}>
      <span className="eyebrow">{t("Targets")}</span>
      <ul>
        <SloLine label={`${t("p95 latency")} ≤ ${slo.maxP95Ms}ms`} ok={m ? m.p95LatencyMs <= slo.maxP95Ms : null} value={m ? `${Math.round(m.p95LatencyMs)}ms` : "–"} />
        <SloLine
          label={`${t("Availability")} ≥ ${slo.minAvailabilityPct}%`}
          ok={m ? m.availabilityPct >= slo.minAvailabilityPct : null}
          value={m ? `${m.availabilityPct.toFixed(2)}%` : "–"}
        />
        <SloLine
          label={`${t("Error rate")} ≤ ${(slo.maxErrorRate * 100).toFixed(1)}%`}
          ok={m ? m.errorRate <= slo.maxErrorRate : null}
          value={m ? `${(m.errorRate * 100).toFixed(2)}%` : "–"}
        />
        {!incident && (
          <SloLine
            label={`${t("Budget")} ≤ ${t("{amount}/mo", { amount: `$${fmtNum(slo.maxMonthlyBudget)}` })}`}
            ok={m ? m.costPerMonth <= slo.maxMonthlyBudget : null}
            value={m ? `$${fmtNum(m.costPerMonth)}` : "–"}
          />
        )}
      </ul>
    </section>
  );
}

const CHAOS: { type: ChaosKind; label: string; icon: string; target?: ComponentKind }[] = [
  { type: "traffic_spike", label: D("Traffic spike ×4"), icon: "trendingUp" },
  { type: "node_crash", label: D("Crash an API box"), icon: "skull", target: "api_server" },
  { type: "hot_key", label: D("Hot key"), icon: "flame" },
  { type: "az_failure", label: D("Zone outage"), icon: "unplug" },
  { type: "bad_deploy", label: D("Bad deploy"), icon: "bug" },
];

/** Mean sandbox rps for a lesson traffic override (the sim swings ±(peakMult − 1)/2 around it). */
const lessonRps = (users: number, perK: number, workloadId: string) => (users / 1000) * perK * (1 + (workloadById(workloadId).workload.peakMult - 1) * 0.5);

function SandboxCard() {
  const sandbox = useLab((s) => s.sandbox);
  const phase = useLab((s) => s.phase);
  const origin = useLab((s) => s.origin);
  const stop = Math.max(0, USER_STOPS.findIndex((u) => u >= sandbox.users));
  return (
    <section className="card guide lab-brief" id="guide" aria-label={t("Sandbox")}>
      <div className="guide__meta">
        <span className="eyebrow">{t("Sandbox")}</span>
        <span className="chapter chapter--green">{t("Free play")}</span>
      </div>
      <div className="guide__content">
        <h3 className="guide__title">{t("Build anything. Break it on purpose.")}</h3>
        <div className="guide__body">
          <p>{tr("Add blocks from the palette, click one to configure it, and wire it with <b>Connect to…</b>. Launch to run live traffic through the design.")}</p>
        </div>
        {origin && (
          <div className="callout callout--next lab-origin" id="lab-origin">
            <span className="callout__icon">
              <Icon name="book" size={15} stroke={2} />
            </span>
            <div>
              <div className="callout__title">{t("From a lesson")}</div>
              <p>
                <a href={`#/${origin.lessonId}/${origin.step + 1}`}>
                  {origin.title} · {t("step {n}", { n: origin.step + 1 })}
                </a>
                {sandbox.rpsPerKUsers
                  ? origin.lessonRps
                    ? ` · ${t("~{rps} rps (scaled down from the lesson’s {lesson} to fit the simulator)", { rps: fmtNum(lessonRps(sandbox.users, sandbox.rpsPerKUsers, sandbox.workloadId)), lesson: fmtNum(origin.lessonRps) })}`
                    : ` · ${t("~{rps} rps, as in the lesson", { rps: fmtNum(lessonRps(sandbox.users, sandbox.rpsPerKUsers, sandbox.workloadId)) })}`
                  : ""}
              </p>
            </div>
            <button type="button" className="lab-origin__close" aria-label={t("Dismiss lesson note")} title={t("Dismiss")} onClick={dismissOrigin}>
              <Icon name="close" size={13} stroke={2.2} />
            </button>
          </div>
        )}
        <Field label={`${t("Users")} · ${fmtNum(sandbox.users)}`}>
          <input
            className="lab-range"
            type="range"
            min={0}
            max={USER_STOPS.length - 1}
            step={1}
            value={stop}
            aria-valuetext={t("{n} users", { n: fmtNum(sandbox.users) })}
            onChange={(e) => setSandbox({ users: USER_STOPS[Number(e.target.value)] })}
          />
        </Field>
        <Field label={t("Workload")}>
          <select className="lab-select" value={sandbox.workloadId} onChange={(e) => setSandbox({ workloadId: e.target.value, rpsPerKUsers: undefined })}>
            {WORKLOADS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="lab-conn__head">{t("Chaos")}</div>
        <div className="lab-chaos">
          {CHAOS.map((c) => (
            <button key={c.type} type="button" className="lab-mini" disabled={phase === "debrief"} onClick={() => injectChaos(c.type, c.target)}>
              <Icon name={c.icon} size={13} stroke={2} />
              {t(c.label)}
            </button>
          ))}
        </div>
        <button type="button" className="btn-ghost lab-danger lab-clear" onClick={clearSandbox}>
          <Icon name="refresh" size={15} stroke={2} />
          {t("Start over")}
        </button>
      </div>
    </section>
  );
}

function BriefCard() {
  const mode = useLab((s) => s.mode);
  const level = useLab((s) => s.level);
  const incident = useLab((s) => s.incident);
  const interview = useLab((s) => s.interview);
  const paras = level?.brief ?? incident?.brief ?? interview?.prompt ?? [];
  const tab = mode === "campaign" || mode === "incident" || mode === "interview" ? mode : "campaign";
  return (
    <section className="card guide lab-brief" id="guide" aria-label={t("Brief")}>
      <div className="guide__meta">
        <span className="eyebrow">{t("Brief")}</span>
        <span className={`chapter chapter--${tab === "incident" ? "red" : tab === "interview" ? "violet" : "green"}`}>
          {level ? t("Level {n}", { n: level.number }) : t(MODES[tab].label)}
        </span>
      </div>
      <div className="guide__content">
        <div className="guide__body">
          {paras.map((p, i) => (
            <p key={i}>{rich(p)}</p>
          ))}
          {interview && (
            <ul className="takeaways">
              {interview.requirements.map((r, i) => (
                <li key={i}>{plain(r)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="callout callout--tip">
          <span className="callout__icon">
            <Icon name="bulb" size={15} stroke={2} />
          </span>
          <div>
            <div className="callout__title">{t("Tip")}</div>
            <p>{t("Click any block on the stage to inspect it. Palette blocks connect from whatever is selected.")}</p>
          </div>
        </div>
      </div>
      <div className="guide__nav">
        <a className="btn-ghost" href={`#/practice/${tab}`}>
          <Icon name="arrowLeft" size={15} stroke={2} />
          {t("Menu")}
        </a>
        <button type="button" className="btn-ghost" title={t("Discard your design and rebuild the starter")} onClick={restartFromStarter}>
          <Icon name="refresh" size={15} stroke={2} />
          {t("From scratch")}
        </button>
      </div>
    </section>
  );
}

export function LabRail() {
  const selectedId = useLab((s) => s.selectedId);
  const mode = useLab((s) => s.mode);
  const slo = useLab((s) => scenarioOf(s)?.slo ?? s.interview?.slo);
  return (
    <aside className="rail lab-rail">
      {selectedId ? <Inspector id={selectedId} /> : mode === "sandbox" ? <SandboxCard /> : <BriefCard />}
      {slo && mode !== "interview" && <Goals slo={slo} />}
    </aside>
  );
}
