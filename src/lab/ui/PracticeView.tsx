// Practice menu (#/practice/<tab>): Startup Career levels with unlocks, Incident Commander and
// Architecture Interview, laid out in the classroom grid.
import { setDrawer } from "../../app/controller";
import type { PracticeTab } from "../../app/router";
import { Icon } from "../../components/Icon";
import { DrawerBackdrop } from "../../components/Sidebar";
import { NavItems } from "../../components/Topbar";
import { D, t } from "../../i18n";
import { INCIDENTS } from "../sim/game/incidents";
import { INTERVIEWS } from "../sim/game/interviews";
import { LEVELS } from "../sim/game/levels";
import { fmtNum, plain } from "../model";
import { startIncident, startInterview, startLevel, unlockedLevels, useLab } from "../store";
import type { Progress } from "../store";
import { MODES } from "./common";

const TABS: PracticeTab[] = ["campaign", "incident", "interview"];
const ITEMS: Record<PracticeTab, { id: string }[]> = { campaign: LEVELS, incident: INCIDENTS, interview: INTERVIEWS };

const passedIn = (tab: PracticeTab, progress: Progress) => ITEMS[tab].filter((x) => progress[x.id]?.passed).length;

function play(tab: PracticeTab, id: string): void {
  if (tab === "campaign") startLevel(id);
  else if (tab === "incident") startIncident(id);
  else startInterview(id);
  location.hash = `#/play/${tab}/${id}`;
}

function PracticeSidebar({ tab }: { tab: PracticeTab }) {
  const progress = useLab((s) => s.progress);
  const total = TABS.reduce((a, m) => a + ITEMS[m].length, 0);
  const done = TABS.reduce((a, m) => a + passedIn(m, progress), 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <aside className="sidebar lab-side" id="sidebar" aria-label={t("Practice")}>
      <nav className="drawer-nav" aria-label={t("Sections")}>
        <NavItems size={16} />
      </nav>
      <div className="tree-root">
        <Icon name="flag" size={18} stroke={2} />
        <span>{t("Practice")}</span>
        <span className="tree-root__meta">{t("{n} scenarios", { n: total })}</span>
        <button className="drawer-close" id="drawer-close" type="button" aria-label={t("Close the menu")} onClick={() => setDrawer(false)}>
          <Icon name="close" size={18} stroke={2.2} />
        </button>
      </div>
      <nav className="course lab-modes" id="lab-course" aria-label={t("Practice modes")}>
        <ul className="mod__lessons lab-modes__list">
          {TABS.map((m) => {
            const on = m === tab;
            return (
              <li key={m} className={on ? "lesson is-current" : "lesson"}>
                <a href={`#/practice/${m}`} className={on ? "btn-pop" : undefined} aria-current={on ? "page" : undefined} onClick={() => setDrawer(false)}>
                  <span className="lesson__markbox">
                    <Icon name={MODES[m].icon} size={15} stroke={1.8} cls="lesson__mark" />
                  </span>
                  <span className="lesson__title">{t(MODES[m].label)}</span>
                  <span className="mod__count">
                    {passedIn(m, progress)}/{ITEMS[m].length}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <a className="lab-modes__lab" href="#/lab" onClick={() => setDrawer(false)}>
          <Icon name="window" size={16} stroke={1.8} />
          <span>
            <b>{t("Design Lab")}</b>
            <small>{t("Free-form sandbox, no goals")}</small>
          </span>
          <Icon name="arrowRight" size={15} stroke={2} />
        </a>
      </nav>
      <section className="card progress is-open" id="progress">
        <div className="progress__head">
          <span className="eyebrow">{t("Progress")}</span>
          <span className="progress__pct">
            {done} / {total}
          </span>
        </div>
        <div className="progress__body">
          <div className="progress__clip">
            <div className="bar">
              <span style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <ul className="progress__list">
              {TABS.map((m) => {
                const n = passedIn(m, progress);
                const all = n === ITEMS[m].length;
                return (
                  <li key={m}>
                    <span className={`check${all ? " is-on" : n > 0 ? " is-part" : ""}`}>
                      <Icon name="check" size={11} stroke={3} />
                    </span>
                    <span className="progress__label">{t(MODES[m].label)}</span>
                    <span className="progress__count">
                      {n}/{ITEMS[m].length}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </aside>
  );
}

function Score({ entry }: { entry: { passed: boolean; overall: number } | undefined }) {
  if (!entry) return null;
  return (
    <span className={entry.passed ? "lab-badge lab-badge--green" : "lab-badge"}>
      <Icon name={entry.passed ? "circleCheck" : "replay"} size={12} stroke={2.2} />
      {entry.passed ? t("Passed · {n}", { n: entry.overall }) : t("Best {n}", { n: entry.overall })}
    </span>
  );
}

function Cards({ tab }: { tab: PracticeTab }) {
  const progress = useLab((s) => s.progress);
  if (tab === "campaign") {
    const unlocked = unlockedLevels(progress);
    return (
      <div className="lab-cards">
        {LEVELS.map((l) => {
          const open = unlocked.includes(l.id);
          const done = progress[l.id];
          return (
            <article key={l.id} className={open ? "card lab-card" : "card lab-card is-locked"} data-level-id={l.id}>
              <div className="lab-card__top">
                <span className="lab-card__num">{l.number}</span>
                <div className="lab-card__titles">
                  <h3>{plain(l.title)}</h3>
                  <p>{plain(l.project)}</p>
                </div>
                <Score entry={done} />
              </div>
              <div className="lab-card__foot">
                <span className="lab-card__meta">
                  <Icon name="users" size={13} stroke={2} />
                  {t("{from} → {to} users", { from: fmtNum(l.users), to: fmtNum(l.usersEnd) })}
                </span>
                <button type="button" className={open && !done?.passed ? "btn-pop lab-play" : "btn-ghost lab-play"} disabled={!open} onClick={() => play("campaign", l.id)}>
                  <Icon name={open ? (done?.passed ? "replay" : "play") : "lock"} size={14} stroke={2.2} />
                  {!open ? t("Locked") : done?.passed ? t("Replay") : t("Play")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    );
  }
  if (tab === "incident") {
    return (
      <div className="lab-cards">
        {INCIDENTS.map((inc) => (
          <article key={inc.id} className="card lab-card" data-level-id={inc.id}>
            <div className="lab-card__top">
              <span className="lab-card__num lab-card__num--red">
                <Icon name="siren" size={15} stroke={2} />
              </span>
              <div className="lab-card__titles">
                <h3>{plain(inc.title)}</h3>
                <p>
                  {plain(inc.company)} · {t("{n} users", { n: fmtNum(inc.users) })}
                </p>
              </div>
              <Score entry={progress[inc.id]} />
            </div>
            <p className="lab-card__desc">{plain(inc.brief[0].replace(/\*\*/g, ""))}</p>
            <div className="lab-card__foot">
              <span className="lab-card__meta lab-card__meta--red">
                <Icon name="dollar" size={13} stroke={2} />
                {t("−{amount}/min", { amount: `$${inc.revenuePerTick.toLocaleString()}` })}
              </span>
              <button type="button" className="btn-pop lab-play lab-play--danger" onClick={() => play("incident", inc.id)}>
                <Icon name="siren" size={14} stroke={2.2} />
                {t("Respond")}
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="lab-cards">
      {INTERVIEWS.map((iv) => (
        <article key={iv.id} className="card lab-card" data-level-id={iv.id}>
          <div className="lab-card__top">
            <span className="lab-card__num lab-card__num--violet">
              <Icon name="target" size={15} stroke={2} />
            </span>
            <div className="lab-card__titles">
              <h3>{plain(iv.title)}</h3>
              <p>{t("up to {n} users", { n: fmtNum(iv.tiers[iv.tiers.length - 1].users) })}</p>
            </div>
            <Score entry={progress[iv.id]} />
          </div>
          <p className="lab-card__desc">{plain((iv.prompt[1] ?? iv.prompt[0]).replace(/\*\*/g, ""))}</p>
          <div className="lab-card__foot">
            <span className="lab-card__meta">
              <Icon name="listChecks" size={13} stroke={2} />
              {t("{n} requirements", { n: iv.requirements.length })}
            </span>
            <button type="button" className="btn-pop lab-play" onClick={() => play("interview", iv.id)}>
              <Icon name="play" size={14} stroke={2.2} />
              {t("Begin")}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

const RAIL: Record<PracticeTab, { title: string; body: string[]; tip: string }> = {
  campaign: {
    title: D("Grow a startup from 100 users to 100M"),
    body: [
      D("Each level is a new chapter of the same company. Traffic ramps while you watch, scripted trouble arrives, and the run is graded against the level’s SLOs and budget."),
      D("Pass a level to unlock the next one. New components unlock as the company grows."),
    ],
    tip: D("Numbers are tuned for gameplay but directionally realistic — the tradeoffs transfer to production."),
  },
  incident: {
    title: D("Production is on fire"),
    body: [
      D("You inherit a running system in the middle of an outage. Revenue drains every minute it stays broken."),
      D("Read the events, find the cause, change the design, and hold the error rate down long enough to call it resolved."),
    ],
    tip: D("Alerts show symptoms, not causes. Click blocks on the stage to see which one is actually saturated."),
  },
  interview: {
    title: D("Design it, then defend it"),
    body: [
      D("No clock: design at your own pace, then submit. The design is stress-tested at every scale tier, including viral hot-key spikes."),
      D("You get a hire / no-hire verdict with strengths and the gaps an interviewer would notice."),
    ],
    tip: D("Start simple and scale the bottleneck — over-building costs points on cost and simplicity."),
  },
};

export function PracticeView({ tab }: { tab: PracticeTab }) {
  const progress = useLab((s) => s.progress);
  const rail = RAIL[tab];
  return (
    <>
      <PracticeSidebar tab={tab} />
      <DrawerBackdrop />
      <main className="sheet lab-sheet lab-practice">
        <div className="lesson-head lab-head" id="head">
          <div className="crumb">
            {t("Practice")} <span>/</span> {t(MODES[tab].label)}
          </div>
          <div className="lesson-head__row">
            <h2 className="title">{t(MODES[tab].label)}</h2>
            <div className="tags">
              <span className="tag tag--sand">
                <Icon name={MODES[tab].icon} size={13} stroke={2} />
                {t("{n} scenarios", { n: ITEMS[tab].length })}
              </span>
              <span className="tag tag--mint">
                <Icon name="circleCheck" size={13} stroke={2} />
                {t("{n} passed", { n: passedIn(tab, progress) })}
              </span>
            </div>
          </div>
          <p className="subtitle">{t(MODES[tab].desc)}</p>
          <div className="lab-tabs lab-tabs--page" role="tablist">
            {TABS.map((m) => (
              <a key={m} role="tab" aria-selected={m === tab} className={m === tab ? "is-on" : undefined} href={`#/practice/${m}`}>
                <Icon name={MODES[m].icon} size={13} stroke={2} />
                {t(MODES[m].label)}
              </a>
            ))}
          </div>
        </div>
        <div className="lab-scroll">
          <Cards tab={tab} />
        </div>
      </main>
      <aside className="rail lab-rail">
        <section className="card guide lab-brief" id="guide">
          <div className="guide__meta">
            <span className="eyebrow">{t("How it works")}</span>
            <span className={`chapter chapter--${tab === "incident" ? "red" : tab === "interview" ? "violet" : "green"}`}>{t(MODES[tab].label)}</span>
          </div>
          <div className="guide__content">
            <h3 className="guide__title">{t(rail.title)}</h3>
            <div className="guide__body">
              {rail.body.map((p, i) => (
                <p key={i}>{t(p)}</p>
              ))}
            </div>
            <div className="callout callout--tip">
              <span className="callout__icon">
                <Icon name="bulb" size={15} stroke={2} />
              </span>
              <div>
                <div className="callout__title">{t("Tip")}</div>
                <p>{t(rail.tip)}</p>
              </div>
            </div>
          </div>
          <div className="guide__nav">
            <a className="btn-pop btn-next" href="#/lab">
              <span className="btn-next__label">{t("Open the Design Lab")}</span>
              <Icon name="arrowRight" size={16} stroke={2.2} />
            </a>
          </div>
        </section>
      </aside>
    </>
  );
}
