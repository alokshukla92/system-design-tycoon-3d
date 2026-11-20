// Pricing plans — edit this file to change what /pricing/ shows. No checkout exists: a plan's CTA either links
// somewhere (`href`) or shows a toast (`toast`), like the classroom's "coming soon" items.
import { COURSE, FLAT } from "../content";
import { D } from "../i18n";

export interface PlanCta {
  label: string;
  /** Link target (e.g. the classroom). */
  href?: string;
  /** Toast text shown instead of navigating. */
  toast?: string;
}

export interface Plan {
  id: string;
  name: string;
  /** Big price line, e.g. "Free" or "US$9". */
  price: string;
  /** One-line description under the price. */
  description: string;
  features: string[];
  /** Small print under the feature list. */
  note?: string;
  cta: PlanCta;
  /** Shown as a "Coming soon" badge. */
  soon?: boolean;
}

const lessons = FLAT.length;
const modules = COURSE.length;

/** `{lessons}` / `{modules}` in feature lines. Strings are UI keys (D), translated by the pricing page. */
export const FEATURE_VARS = { lessons, modules };

export const PLANS: Plan[] = [
  {
    id: "free",
    name: D("Free"),
    price: D("$0"),
    description: D("Everything that exists today. No account, no card, no trial clock."),
    features: [
      modules === 1 ? D("All {lessons} current lessons across {modules} module") : D("All {lessons} current lessons across {modules} modules"),
      D("Design Lab — a free-form sandbox to build and stress your own architecture"),
      D("Practice — campaigns, incident drills and interview scenarios"),
      D("Progress saved in your browser"),
    ],
    note: D("New lessons land here first while the course is being written."),
    cta: { label: D("Start learning"), href: "/" },
  },
  {
    id: "pro",
    name: D("Pro"),
    price: D("TBA"),
    description: D("A paid tier is being considered. Nothing is for sale yet."),
    features: [D("Extra deep-dive lessons"), D("Downloadable cheatsheets"), D("Early access to new scenarios")],
    note: D("Plans and prices are placeholders and may change before launch."),
    cta: { label: D("Notify me"), toast: D("Pro is coming soon") },
    soon: true,
  },
];
