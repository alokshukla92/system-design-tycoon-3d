// Subscribe React to location.hash so views can branch on Practice / Design Lab routes.
import { useSyncExternalStore } from "react";
import { labRoute } from "./router";
import type { LabRoute } from "./router";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export const useHash = (): string => useSyncExternalStore(subscribe, () => location.hash);

let lastHash: string | null = null;
let lastRoute: LabRoute | null = null;

/** Current Practice / Design Lab route, or null for lesson routes. */
export function useLabRoute(): LabRoute | null {
  const hash = useHash();
  if (hash !== lastHash) {
    lastHash = hash;
    lastRoute = labRoute(hash);
  }
  return lastRoute;
}
