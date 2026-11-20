// Route-level views for Practice / Design Lab: syncs the hash route into the lab store, runs the
// simulation clock and keyboard shortcuts, and lays the lab out in the classroom grid.
import { useEffect } from "react";
import { setDrawer } from "../../app/controller";
import type { LabRoute } from "../../app/router";
import { getState, showToast } from "../../app/store";
import { DrawerBackdrop } from "../../components/Sidebar";
import { LEVELS } from "../sim/game/levels";
import {
  TICK_MS,
  openSandbox,
  pause,
  removeNode,
  run,
  selectNode,
  startIncident,
  startInterview,
  startLevel,
  tickOnce,
  unlockedLevels,
  useLab,
} from "../store";
import { BriefDialog, DebriefDialog, HelpDialog, ReportDialog } from "./Dialogs";
import { LabRail } from "./LabRail";
import { LabHead, LabStage, ScoreStrip, getLabEngine } from "./LabSheet";
import { LabSidebar } from "./LabSidebar";

type PlayRoute = Extract<LabRoute, { view: "lab" | "play" }>;

/** Bring the store in line with the route (start the scenario named by the hash). */
function syncRoute(route: PlayRoute): void {
  const s = useLab.getState();
  if (route.view === "lab") {
    if (s.mode !== "sandbox") openSandbox();
    return;
  }
  const currentId = s.mode === "campaign" ? s.level?.id : s.mode === "incident" ? s.incident?.id : s.mode === "interview" ? s.interview?.id : undefined;
  if (s.mode === route.mode && currentId === route.id) return;
  let ok = false;
  if (route.mode === "campaign") {
    if (LEVELS.some((l) => l.id === route.id) && !unlockedLevels(s.progress).includes(route.id)) {
      showToast("That level is still locked — pass the one before it first.", "lock");
      location.replace(`#/practice/campaign`);
      return;
    }
    ok = startLevel(route.id);
  } else if (route.mode === "incident") ok = startIncident(route.id);
  else ok = startInterview(route.id);
  if (!ok) {
    showToast("That scenario could not be found.", "alert");
    location.replace(`#/practice/${route.mode}`);
  }
}

function onKey(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null;
  const c = getState();
  if (c.searchOpen || c.langOpen || c.upgradeOpen) return;
  if (document.querySelector("dialog[open]")) return;
  if (target?.closest("input, textarea, select, [contenteditable]")) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const s = useLab.getState();
  if (e.key === "Escape") {
    if (s.selectedId) selectNode(null);
  } else if (e.key === "Delete" || e.key === "Backspace") {
    if (s.selectedId) {
      e.preventDefault();
      removeNode(s.selectedId);
    }
  } else if (e.key === " ") {
    if (target?.closest("button, a")) return;
    e.preventDefault();
    if (s.mode === "interview") return;
    if (s.running) pause();
    else run();
  } else if (e.key === "0") getLabEngine()?.fit();
}

export function LabView({ route }: { route: PlayRoute }) {
  const mode = useLab((s) => s.mode);
  const running = useLab((s) => s.running);
  const speed = useLab((s) => s.speed);
  const key = route.view === "lab" ? "lab" : `${route.mode}/${route.id}`;

  useEffect(() => {
    syncRoute(route);
    setDrawer(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tickOnce, TICK_MS / speed);
    return () => clearInterval(id);
  }, [running, speed]);

  useEffect(() => {
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Leaving the lab stops the clock; the scenario is kept so Back resumes it.
      if (useLab.getState().running) pause();
    };
  }, []);

  return (
    <>
      <LabSidebar />
      <DrawerBackdrop />
      <main className="sheet lab-sheet">
        <LabHead />
        {mode && <LabStage />}
        <ScoreStrip />
      </main>
      <LabRail />
      <BriefDialog />
      <DebriefDialog />
      <ReportDialog />
      <HelpDialog />
    </>
  );
}
