import { useEffect, useRef } from "react";
import { CHAPTERS, LEGEND, LEVELS, METRICS, lessonRef } from "../content";
import { Engine } from "../engine";
import { t } from "../i18n";
import type { Lesson } from "../types/lesson";
import { attachEngine, detachEngine, fit, replay, setFull, togglePause } from "../app/controller";
import { go } from "../app/router";
import { useClassroom } from "../app/store";
import { OpenInLabButton } from "../lab/ui/OpenInLab";
import { Icon } from "./Icon";

const html = (s: string) => ({ __html: s });

export function LessonHead({ lesson }: { lesson: Lesson | undefined }) {
  const ref = lesson ? lessonRef(lesson.id) : undefined;
  return (
    <div className="lesson-head" id="head">
      {lesson && ref && (
        <>
          <div className="crumb">
            {ref.module.num}. {ref.module.title} <span>/</span> {t("Lesson {n} of {total}", { n: ref.index, total: ref.of })}
          </div>
          <div className="lesson-head__row">
            <h2 className="title" dangerouslySetInnerHTML={html(lesson.title)} />
            <div className="tags">
              <span className="tag tag--sand">
                <Icon name="clock" size={13} stroke={2} />
                {t("{n} min", { n: lesson.minutes })}
              </span>
              <span className="tag tag--mint">
                <Icon name="signal" size={13} stroke={2} />
                {t(LEVELS[lesson.level] ?? lesson.level)}
              </span>
              <span className="tag tag--violet">
                <Icon name="listOrdered" size={13} stroke={2} />
                {t("{n} steps", { n: lesson.steps.length })}
              </span>
            </div>
          </div>
          <p className="subtitle" title={lesson.summary.replace(/<[^>]+>/g, "")} dangerouslySetInnerHTML={html(lesson.summary)} />
        </>
      )}
    </div>
  );
}

function Hud({ lesson }: { lesson: Lesson | undefined }) {
  return (
    <div className="stage__hud" id="hud">
      {lesson?.metrics.map((k) => {
        const def = METRICS[k];
        return (
          <div className="chip" data-k={k} key={`${lesson.id}:${k}`}>
            <span className="chip__label">
              <Icon name={def?.icon ?? "activity"} size={12} stroke={2} />
              {t(def?.label ?? k)}
            </span>
            <span className="chip__value">–</span>
          </div>
        );
      })}
    </div>
  );
}

function Legend({ lesson }: { lesson: Lesson | undefined }) {
  return (
    <div className="stage__legend" id="legend">
      {lesson?.legend.map((entry, i) => {
        const [key, custom] = Array.isArray(entry) ? entry : [entry, undefined];
        const def = LEGEND[key];
        if (!def) return null;
        return (
          <span key={i}>
            <i className={`lg lg--${def.swatch}`}>{key === "fail" ? "×" : null}</i>
            {custom ?? t(def.label)}
          </span>
        );
      })}
    </div>
  );
}

function Tools({ lesson }: { lesson: Lesson | undefined }) {
  const step = useClassroom((s) => s.step);
  const paused = useClassroom((s) => s.paused);
  const manual = useClassroom((s) => s.manualView);
  const full = useClassroom((s) => s.full);
  return (
    <div className="stage__tools">
      <button className="tool tool--fit" id="fit" type="button" hidden={!manual} title={t("Back to the whole diagram (0)")} onClick={fit}>
        <Icon name="zoomOut" size={15} stroke={2} />
        <span>{t("Fit")}</span>
      </button>
      <button className="tool" id="replay" type="button" title={t("Replay this step (R)")} onClick={replay}>
        <Icon name="replay" size={15} stroke={2} />
        <span>{t("Replay")}</span>
      </button>
      <button
        className={paused ? "tool is-on" : "tool"}
        id="pause"
        type="button"
        title={t(paused ? "Play traffic (Space)" : "Pause traffic (Space)")}
        onClick={togglePause}
      >
        <Icon name={paused ? "play" : "pause"} size={15} stroke={2} />
        <span>{t(paused ? "Play" : "Pause")}</span>
      </button>
      <OpenInLabButton lesson={lesson} step={step} />
      <button
        className="tool tool--expand"
        id="expand"
        type="button"
        title={t(full ? "Exit full screen" : "Full screen")}
        aria-label={t(full ? "Exit full screen" : "Show the diagram full screen")}
        onClick={() => setFull(!full)}
      >
        <Icon name={full ? "collapse" : "expand"} size={15} stroke={2} />
      </button>
    </div>
  );
}

function Canvas() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let engine: InstanceType<typeof Engine> | null = null;
    try {
      engine = new Engine(el);
      attachEngine(engine);
    } catch (err) {
      console.warn("[stage] engine failed to start", err);
    }
    return () => {
      detachEngine();
      engine?.destroy();
    };
  }, []);
  return <div className="stage__canvas" id="canvas" ref={host} />;
}

export function Stage({ lesson }: { lesson: Lesson | undefined }) {
  return (
    <section className="card stage" aria-label={t("Diagram")}>
      <Hud lesson={lesson} />
      <Tools lesson={lesson} />
      <Canvas />
      <Legend lesson={lesson} />
    </section>
  );
}

export function Timeline({ lesson, step }: { lesson: Lesson | undefined; step: number }) {
  const n = lesson?.steps.length ?? 0;
  return (
    <section className="card timeline" id="timeline" aria-label={t("Steps")}>
      {lesson && (
        <>
          <div className="timeline__head">
            <span className="eyebrow">{t("In this lesson")}</span>
            <span className="timeline__count" id="tl-count">
              {t("Step {n} of {total}", { n: step + 1, total: n })}
            </span>
          </div>
          <div className="timeline__track" style={{ "--n": n } as React.CSSProperties}>
            <div className="timeline__rail">
              <span id="tl-fill" style={{ width: `${n > 1 ? (step / (n - 1)) * 100 : 0}%` }} />
            </div>
            <ol className="timeline__steps">
              {lesson.steps.map((s, i) => (
                <li key={`${lesson.id}:${i}`} className={i === step ? "is-current" : i < step ? "is-done" : undefined}>
                  <button type="button" data-step={i} title={s.title.replace(/<[^>]+>/g, "")} onClick={() => go(lesson.id, i)}>
                    <span className={`timeline__dot chapter-dot--${CHAPTERS[s.chapter]?.tone ?? "sand"}`}>{i + 1}</span>
                    <span className="timeline__label" dangerouslySetInnerHTML={html(s.short)} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </section>
  );
}
