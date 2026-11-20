import { COURSE, FLAT } from "../content";
import { Credit } from "./Credit";
import { t } from "../i18n";
import type { Module } from "../types/lesson";
import { setDrawer } from "../app/controller";
import { isLocked } from "../app/router";
import { toggleModule, toggleProgress, useClassroom } from "../app/store";
import { Icon } from "./Icon";
import { NavItems, openLangMenu } from "./Topbar";
import { getLocale, localeById } from "../i18n";

function Folder({ color }: { color: Module["color"] }) {
  return (
    <svg className={`folder folder--${color}`} width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
      <path d="M1.2 3.2A2 2 0 0 1 3.2 1.2h4.1l2 2.2h7.5a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H3.2a2 2 0 0 1-2-2Z" />
      <path className="folder__lip" d="M1.2 6.2h17.6" />
    </svg>
  );
}

function LessonMark({ id, done }: { id: string; done: boolean }) {
  if (isLocked(id)) return <Icon name="lock" size={15} stroke={1.5} cls="lesson__mark" />;
  if (done) return <Icon name="circleCheck" size={16} stroke={2} cls="lesson__mark lesson__mark--done" />;
  return <Icon name="file" size={15} stroke={1.5} cls="lesson__mark" />;
}

function ModuleTree() {
  const lessonId = useClassroom((s) => s.lessonId);
  const openModule = useClassroom((s) => s.openModule);
  const done = useClassroom((s) => s.done);
  return (
    <nav className="course" id="course" aria-label={t("Lessons")}>
      {COURSE.map((m) => {
        const open = openModule === m.id;
        const count = m.lessons.filter((l) => done.has(l.id)).length;
        return (
          <section key={m.id} className={open ? "mod is-open" : "mod"} data-mod={m.id}>
            <button className="mod__head" type="button" data-mod={m.id} aria-expanded={open} onClick={() => toggleModule(m.id)}>
              <Icon name="chevronRight" size={15} stroke={2.2} cls="mod__chev" />
              <Folder color={m.color} />
              <span className="mod__title" title={m.title}>
                {m.num}. {m.title}
              </span>
              <span className="mod__count">
                {count}/{m.lessons.length}
              </span>
            </button>
            <div className="mod__body">
              <div className="mod__clip">
                <ul className="mod__lessons">
                  {m.lessons.map((l) => {
                    const current = l.id === lessonId;
                    return (
                      <li key={l.id} className={current ? "lesson is-current" : "lesson"} data-lesson={l.id} data-done={done.has(l.id)}>
                        <a
                          href={`#/${l.id}/1`}
                          className={current ? "btn-pop" : undefined}
                          aria-current={current ? "page" : undefined}
                        >
                          <span className="lesson__markbox">
                            <LessonMark id={l.id} done={done.has(l.id)} />
                          </span>
                          <span className="lesson__title" title={l.title}>
                            {l.title}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </nav>
  );
}

function ProgressCard() {
  const open = useClassroom((s) => s.progressOpen);
  const done = useClassroom((s) => s.done);
  const total = FLAT.length;
  const doneCount = FLAT.filter((l) => done.has(l.id)).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  return (
    <section className={open ? "card progress is-open" : "card progress"} id="progress">
      <button className="progress__head" type="button" aria-expanded={open} aria-controls="progress-body" onClick={toggleProgress}>
        <span className="eyebrow">{t("Progress")}</span>
        <span className="progress__pct">
          {doneCount} / {total}
        </span>
        <Icon name="chevronRight" size={14} stroke={2.2} cls="progress__chev" />
      </button>
      <div className="progress__body" id="progress-body">
        <div className="progress__clip">
          <div className="bar">
            <span style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
          <ul className="progress__list">
            {COURSE.map((m) => {
              const n = m.lessons.filter((l) => done.has(l.id)).length;
              const all = n === m.lessons.length;
              return (
                <li key={m.id} data-mod={m.id}>
                  <span className={`check${all ? " is-on" : n > 0 ? " is-part" : ""}`}>
                    <Icon name="check" size={11} stroke={3} />
                  </span>
                  <span className="progress__label">{m.title}</span>
                  <span className="progress__count">
                    {n}/{m.lessons.length}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Sidebar() {
  return (
    <aside className="sidebar" id="sidebar" aria-label={t("Course")}>
      <nav className="drawer-nav" aria-label={t("Sections")}>
        <NavItems size={16} />
      </nav>
      <div className="tree-root">
        <svg width="22" height="18" viewBox="0 0 20 16" aria-hidden="true">
          <path fill="currentColor" d="M1 3a2 2 0 0 1 2-2h4.3l2 2.2H17a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2Z" />
        </svg>
        <span>{t("Course")}</span>
        <span className="tree-root__meta">{t("{n} lessons", { n: FLAT.length })}</span>
        <button className="drawer-close" id="drawer-close" type="button" aria-label={t("Close the course menu")} onClick={() => setDrawer(false)}>
          <Icon name="close" size={18} stroke={2.2} />
        </button>
      </div>
      <ModuleTree />
      <ProgressCard />
      <div className="drawer-foot">
        <button
          className="lang__btn"
          id="lang-btn-2"
          type="button"
          aria-haspopup="menu"
          onClick={() => {
            setDrawer(false);
            openLangMenu();
          }}
        >
          <Icon name="globe" size={16} stroke={2} />
          <span className="lang__code">{localeById(getLocale()).native}</span>
        </button>
        <Credit />
      </div>
    </aside>
  );
}

export function DrawerBackdrop() {
  return <div className="drawer-backdrop" id="drawer-backdrop" onClick={() => setDrawer(false)} />;
}
