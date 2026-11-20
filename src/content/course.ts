// Course structure (doc 12 §2, §8): the user's "Startup Career" module from system-design-tycoon,
// plus "Incident Commander" (incidents.ts) and "Campaign Extras" (uncovered campaign concepts).
import type { Course } from "../types/lesson";

export const COURSE: Course = [
  {
    id: "startup-career",
    num: "01",
    title: "Startup Career",
    color: "sand",
    lessons: [
      { id: "day-one", title: "Day One" },
      { id: "the-slow-burn", title: "The Slow Burn" },
      { id: "chatterbox", title: "Chatterbox" },
      { id: "the-3am-page", title: "The 3AM Page" },
      { id: "picture-this", title: "Picture This" },
      { id: "a-million-little-writes", title: "A Million Little Writes" },
      { id: "surge", title: "Surge" },
      { id: "checkout", title: "Checkout" },
      { id: "the-stream-must-flow", title: "The Stream Must Flow" },
      { id: "planet-scale", title: "Planet Scale" },
    ],
  },
  {
    id: "incident-commander",
    num: "02",
    title: "Incident Commander",
    color: "rose",
    lessons: [
      { id: "code-red", title: "Code Red at ticketblitz" },
      { id: "the-cache-that-saved-too-well", title: "The Cache That Saved Too Well" },
      { id: "eight-million-messages-behind", title: "Eight Million Messages Behind" },
      { id: "one-shard-to-rule-them-all", title: "One Shard To Rule Them All" },
      { id: "the-region-is-down", title: "The Region Is Down. The Region Is You." },
    ],
  },
  {
    id: "campaign-extras",
    num: "03",
    title: "Campaign Extras",
    color: "teal",
    lessons: [{ id: "search-moves-out", title: "Search Moves Out" }],
  },
];

/** Modules whose lessons are free (original: ["foundations"]); the rest stay behind the Pro gate. */
export const FREE_MODULES: string[] = ["startup-career", "incident-commander", "campaign-extras"];
