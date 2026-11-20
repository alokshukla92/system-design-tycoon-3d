// Global classroom state (zustand). Mirrors the original controller state `X` plus UI flags.
import { create } from "zustand";
import { storage } from "./storage";

export interface RecentEntry {
  lessonId: string;
  step: number;
}

export type Theme = "light" | "dark";
export type Layout = "desktop" | "tablet" | "stack";

export interface ToastState {
  text: string;
  icon: string;
  /** Bumped on every show so the same message re-triggers the animation. */
  seq: number;
}

export interface ClassroomState {
  lessonId: string | null;
  /** Lesson whose chunk is being fetched; the current lesson stays on screen meanwhile (original: no spinner). */
  loadingLesson: string | null;
  /** 0-based step index. */
  step: number;
  done: Set<string>;
  /** Open module id in the sidebar accordion (single-open). */
  openModule: string | null;
  recent: RecentEntry[];
  progressOpen: boolean;
  theme: Theme;
  layout: Layout;
  paused: boolean;
  /** Engine reports a manual zoom/pan → show #fit. */
  manualView: boolean;
  drawer: boolean;
  full: boolean;
  searchOpen: boolean;
  langOpen: boolean;
  upgradeOpen: boolean;
  toast: ToastState | null;
}

const initialTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const initialLayout = (): Layout => (document.documentElement.dataset.layout as Layout) || "desktop";

export const useClassroom = create<ClassroomState>(() => ({
  lessonId: null,
  loadingLesson: null,
  step: 0,
  done: new Set(storage.get<string[]>("done", [])),
  openModule: null,
  recent: storage.get<RecentEntry[]>("recent", []),
  progressOpen: storage.get("progressOpen", false),
  theme: initialTheme(),
  layout: initialLayout(),
  paused: false,
  manualView: false,
  drawer: false,
  full: false,
  searchOpen: false,
  langOpen: false,
  upgradeOpen: false,
  toast: null,
}));

export const getState = useClassroom.getState;
export const setState = useClassroom.setState;

export function showToast(text: string, icon = "sparkles"): void {
  setState((s) => ({ toast: { text, icon, seq: (s.toast?.seq ?? 0) + 1 } }));
}

export function toggleModule(id: string): void {
  setState((s) => ({ openModule: s.openModule === id ? null : id }));
}

export function toggleProgress(): void {
  const progressOpen = !getState().progressOpen;
  storage.set("progressOpen", progressOpen);
  setState({ progressOpen });
}
