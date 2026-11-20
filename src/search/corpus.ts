// Search corpus: every lesson's pre-flattened search text (content/derive.ts searchLesson, built by the
// lesson-data Vite plugin). Imported dynamically on first search open, so it is its own chunk.
import { FLAT } from "../content";
import type { SearchLesson } from "../content/derive";

const FILES = import.meta.glob<SearchLesson>("../content/lessons/*.json", {
  query: "?lesson-search",
  import: "default",
  eager: true,
});
const BY_ID = new Map(Object.values(FILES).map((l) => [l.id, l]));

/** Search projections of every course lesson, in course order. */
export const CORPUS: SearchLesson[] = FLAT.map((r) => BY_ID.get(r.id)).filter((l): l is SearchLesson => !!l);
