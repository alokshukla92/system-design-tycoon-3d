// Engine public contract. Mirrors the original engine instance `Q` (class `ap`) as used by the
// controller (doc 07, JS L7072–8110). Implementation lives in ./Engine.ts (framework-free TS).
import type { Scene } from "../types/lesson";

export interface GoToOptions {
  /** Snap to the scene without any animation (used by replay + first render). */
  instant?: boolean;
}

export interface EngineApi {
  /** The root <svg class="stage-svg"> the engine owns (controller sets aria-label on it). */
  readonly svg: SVGSVGElement;
  /** Pauses packets only (Space key / #pause button). Not reset on step change. */
  paused: boolean;
  /** Called with `true` when panels dock in the HUD (stage ≥ 520 px) and `false` when cards must go inline (html.cards-inline). */
  onCards: ((docked: boolean) => void) | null;
  /** Touch swipe on the stage: +1 = next, −1 = previous (controller flips for RTL). */
  onSwipe: ((dir: 1 | -1) => void) | null;
  /** `true` when the user has zoomed/panned away from auto-fit (controller shows the #fit button). */
  onView: ((manual: boolean) => void) | null;
  /** Click/tap on the stage: the entity id under the pointer, or null for empty space. */
  onPick: ((id: string | null) => void) | null;

  /** Transition to a scene (diff by entity/link id → exit / move / enter / draw, then flows + spotlight). */
  goTo(scene: Scene, opts?: GoToOptions): void;
  /**
   * Live refresh (simulations): if only properties changed since the current scene, tween them in
   * place without restarting packets/camera; structural changes fall back to goTo().
   */
  update(scene: Scene): void;
  /** Persistently outline one entity (null clears). */
  select(id: string | null): void;
  /** Remove everything (entities, links, packets, flows) without animation. */
  clear(): void;
  /** Pre-compute camera framing for a whole lesson (all step scenes) so the camera is stable across steps. */
  frame(scenes: Scene[]): void;
  /** Return to auto-fit camera (key `0`, #fit button). */
  fit(): void;
  /** Re-measure the container after layout/resize changes. */
  refit(): void;
  /** Re-apply theme colours after html[data-theme] changes (dark recolor, doc 05b §7). */
  retheme(): void;
  destroy(): void;
}

export { Engine } from "./Engine";
