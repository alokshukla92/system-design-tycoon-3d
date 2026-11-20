import { CALLOUTS, CHAPTERS, nextLesson } from "../content";
import { DEFAULTS, type PanelP } from "../engine/entities";
import { renderPanel } from "../engine/panel";
import { recolor } from "../engine/theme";
import { t } from "../i18n";
import type { Lesson, Panel, Step } from "../types/lesson";
import { go } from "../app/router";
import { useClassroom } from "../app/store";
import { Icon } from "./Icon";

const html = (s: string) => ({ __html: s });
const BLOCK_RE = /^<(p|ul|ol|table|div|figure|pre|h\d)\b/i;

/** Inline copy of the step's info panel, shown in the guide when the stage is too small to dock it. */
function GuideCard({ step }: { step: Step }) {
  useClassroom((s) => s.theme);
  const panel = Object.values(step.scene.entities).find((e): e is Panel => e.type === "panel");
  if (!panel) return null;
  let svg = "";
  let w = 0;
  try {
    const r = renderPanel({ ...DEFAULTS.panel, ...panel, x: 0, y: 0, z: 0, dx: 0, dy: 0, lift: 0 } as unknown as PanelP);
    const size = r.size ?? { w: 0, h: 0 };
    w = size.w + 6;
    svg = `<svg viewBox="-2 -2 ${w} ${size.h + 8}" width="${w}" role="img" aria-label="${(panel.title ?? "").replace(/"/g, "&quot;")}">${recolor(r.over)}</svg>`;
  } catch {
    return null;
  }
  return <figure className="guide__card" dangerouslySetInnerHTML={html(svg)} />;
}

function Change({ text }: { text: string }) {
  const kind = text.startsWith("+") ? "add" : text.startsWith("−") || text.startsWith("-") ? "del" : "mod";
  return (
    <li className={`chg chg--${kind}`}>
      <b>{{ add: "+", del: "−", mod: "~" }[kind]}</b>
      <span dangerouslySetInnerHTML={html(text.slice(2))} />
    </li>
  );
}

export function Guide({ lesson, step }: { lesson: Lesson | undefined; step: number }) {
  if (!lesson) return <section className="card guide" id="guide" aria-live="polite" />;
  const s = lesson.steps[step];
  const total = lesson.steps.length;
  const chapter = CHAPTERS[s.chapter] ?? { label: s.chapter, tone: "sand" };
  const last = step === total - 1;
  const next = nextLesson(lesson.id);
  const nextTitle = next ? next.title : "";
  const label = last
    ? next
      ? nextTitle.length <= 15
        ? t("Next: {title}", { title: nextTitle })
        : nextTitle
      : t("Finish lesson")
    : t("Next: {title}", { title: lesson.steps[step + 1].short });
  const callout = s.callout && CALLOUTS[s.callout.kind];

  return (
    <section className="card guide" id="guide" aria-live="polite">
      <div className="guide__meta">
        <span className="eyebrow">{t("Step {n} / {total}", { n: step + 1, total })}</span>
        <div className="guide__meta-end">
          <span className={`chapter chapter--${chapter.tone}`} key={`${lesson.id}:${s.chapter}:${step}`}>
            {t(chapter.label)}
          </span>
        </div>
      </div>
      <div className="guide__content" key={`${lesson.id}:${step}`}>
        <h2 className="guide__title" dangerouslySetInnerHTML={html(s.title)} />
        <div className="guide__body" dangerouslySetInnerHTML={html(s.body.map((b) => (BLOCK_RE.test(b) ? b : `<p>${b}</p>`)).join(""))} />
        <GuideCard step={s} />
        {s.callout && callout && (
          <div className={`callout callout--${s.callout.kind}`}>
            <div className="callout__icon">
              <Icon name={callout.icon} size={16} stroke={2} />
            </div>
            <div>
              <div className="callout__title">{t(callout.title)}</div>
              <p dangerouslySetInnerHTML={html(s.callout.text)} />
            </div>
          </div>
        )}
        {!!s.changes?.length && (
          <div className="changes">
            <div className="eyebrow">{t("What changed")}</div>
            <ul>
              {s.changes.map((c, i) => (
                <Change key={i} text={c} />
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="guide__nav">
        <button className="btn-ghost" id="back" type="button" disabled={step === 0} onClick={() => go(lesson.id, step - 1)}>
          <Icon name="arrowLeft" size={15} stroke={2.2} />
          {t("Back")}
        </button>
        <button
          className={`btn-pop btn-next${label.length > 21 ? " is-long" : ""}`}
          id="next"
          type="button"
          title={last && next ? t("Next lesson: {title}", { title: nextTitle }) : ""}
          onClick={() => {
            if (!last) go(lesson.id, step + 1);
            else if (next) go(next.id, 0);
          }}
        >
          <span className="btn-next__label">{label}</span>
          <Icon name={last && !next ? "check" : "arrowRight"} size={15} stroke={2.2} />
        </button>
      </div>
      <div className="guide__hint">
        <Icon name="keyboard" size={14} stroke={1.8} />
        <span>
          <kbd>←</kbd> <kbd>→</kbd> {t("step")} · <kbd>R</kbd> {t("replay")} · <kbd>Space</kbd> {t("pause")}
        </span>
      </div>
    </section>
  );
}

export function Goals({ lesson, step }: { lesson: Lesson | undefined; step: number }) {
  return (
    <section className="card goals" id="goals">
      {lesson && (
        <>
          <div className="eyebrow">{t("You’ll learn")}</div>
          <ul>
            {lesson.goals.map((g, i) => {
              const hit = step >= g.step;
              return (
                <li key={`${lesson.id}:${i}`} className={hit ? "is-hit" : undefined}>
                  <span className={hit ? "check is-on" : "check"}>
                    <Icon name="check" size={11} stroke={3} />
                  </span>
                  <span dangerouslySetInnerHTML={html(g.text)} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
