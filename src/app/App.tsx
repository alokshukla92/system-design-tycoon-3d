import { useCallback, useEffect } from "react";
import { LabView } from "../lab/ui/LabView";
import { PracticeView } from "../lab/ui/PracticeView";
import { getLesson } from "../content";
import { SearchModal } from "../search/SearchModal";
import type { Lesson } from "../types/lesson";
import { isRtl } from "../i18n";
import { DrawerBackdrop, Sidebar } from "../components/Sidebar";
import { LessonHead, Stage, Timeline } from "../components/Sheet";
import { Goals, Guide } from "../components/Rail";
import { Toast, UpgradeDialog } from "../components/Overlays";
import { CourseOverview, StaticPage, pageForPath } from "../pages";
import { Topbar } from "../components/Topbar";
import {
  applyLayout,
  cancelSidebarScroll,
  fit,
  replay,
  revealLesson,
  rerouteFresh,
  route,
  setDrawer,
  setFull,
  syncThemeColor,
  togglePause,
} from "./controller";
import { go, hashStep, hrefFor, isLabHash, isLocked } from "./router";
import { getState, setState, useClassroom } from "./store";
import { useLabRoute } from "./useHash";

function onKey(e: KeyboardEvent): void {
  const s = getState();
  const target = e.target as HTMLElement | null;
  if (s.searchOpen || s.langOpen || s.upgradeOpen || target?.closest("input, textarea, select, [contenteditable]")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") {
    if (s.drawer) setDrawer(false);
    if (s.full) setFull(false);
    return;
  }
  if (isLabHash()) return;
  const lesson = s.lessonId ? getLesson(s.lessonId) : undefined;
  if (!lesson) return;
  const flip = isRtl() ? -1 : 1;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const n = hashStep(lesson.id, s.step) + (e.key === "ArrowRight" ? 1 : -1) * flip;
    if (n >= 0 && n < lesson.steps.length) go(lesson.id, n);
  } else if (e.key === "r" || e.key === "R") replay();
  else if (e.key === "0") fit();
  else if (e.key === " ") {
    e.preventDefault();
    togglePause();
  }
}

let lessonMounted = false;

const isUnlocked = (id: string) => !isLocked(id);

/** The classroom proper (course tree, lesson sheet, guide rail). */
function LessonBody() {
  const lessonId = useClassroom((s) => s.lessonId);
  const step = useClassroom((s) => s.step);
  const loading = useClassroom((s) => !!s.loadingLesson);
  const lesson: Lesson | undefined = lessonId ? getLesson(lessonId) : undefined;

  useEffect(() => {
    // Back from Practice / Design Lab: the stage engine is new, so render the lesson from scratch.
    if (lessonMounted) queueMicrotask(rerouteFresh);
    lessonMounted = true;
    const course = document.getElementById("course");
    course?.addEventListener("wheel", cancelSidebarScroll, { passive: true });
    return () => course?.removeEventListener("wheel", cancelSidebarScroll);
  }, []);

  return (
    <>
      <Sidebar />
      <DrawerBackdrop />
      <main className="sheet" aria-busy={loading || undefined}>
        <LessonHead lesson={lesson} />
        <Stage lesson={lesson} />
        <Timeline lesson={lesson} step={step} />
      </main>
      <aside className="rail">
        <Guide lesson={lesson} step={step} />
        <Goals lesson={lesson} step={step} />
      </aside>
    </>
  );
}

/** Static pages live at real paths (/pricing/ …); everything else is the classroom at "/". */
export function App() {
  return pageForPath(location.pathname) ? <StaticPage /> : <Classroom />;
}

function Classroom() {
  const lessonId = useClassroom((s) => s.lessonId);
  const searchOpen = useClassroom((s) => s.searchOpen);
  const done = useClassroom((s) => s.done);
  const recent = useClassroom((s) => s.recent);
  const labRoute = useLabRoute();

  // Child effects (engine creation in <Canvas>) run before this one, so the first route has an engine.
  useEffect(() => {
    syncThemeColor();
    applyLayout();
    // route() uses flushSync, which React forbids inside an effect; run it right after.
    queueMicrotask(route);
    const onHash = () => {
      setDrawer(false);
      route();
    };
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyLayout);
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const openSearch = useCallback(() => setState({ searchOpen: true, langOpen: false }), []);
  const closeSearch = useCallback(() => setState({ searchOpen: false }), []);
  const onPick = useCallback((id: string, s: number) => {
    setDrawer(false);
    revealLesson(id, hrefFor(id, s));
  }, []);

  return (
    <>
      <div className="window">
        <Topbar onSearch={openSearch} />
        <div className="body">
          {!labRoute ? (
            <LessonBody />
          ) : labRoute.view === "practice" ? (
            <PracticeView tab={labRoute.tab} />
          ) : (
            <LabView route={labRoute} />
          )}
        </div>
        <Toast />
        <SearchModal
          open={searchOpen}
          onOpen={openSearch}
          onClose={closeSearch}
          onPick={onPick}
          include={isUnlocked}
          currentLessonId={lessonId}
          done={done}
          recent={recent}
        />
      </div>
      <UpgradeDialog />
      <CourseOverview />
    </>
  );
}
