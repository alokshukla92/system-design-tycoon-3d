// Pricing plans — edit this file to change what /pricing/ shows. No checkout exists: a plan's CTA either links
// somewhere (`href`) or shows a toast (`toast`), like the classroom's "coming soon" items.
import { COURSE, FLAT } from "../content";

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

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "Everything that exists today. No account, no card, no trial clock.",
    features: [
      `All ${lessons} current lessons across ${modules} ${modules === 1 ? "module" : "modules"}`,
      "Design Lab — a free-form sandbox to build and stress your own architecture",
      "Practice — campaigns, incident drills and interview scenarios",
      "Progress saved in your browser",
    ],
    note: "New lessons land here first while the course is being written.",
    cta: { label: "Start learning", href: "/" },
  },
  {
    id: "pro",
    name: "Pro",
    price: "TBA",
    description: "A paid tier is being considered. Nothing is for sale yet.",
    features: ["Extra deep-dive lessons", "Downloadable cheatsheets", "Early access to new scenarios"],
    note: "Plans and prices are placeholders and may change before launch.",
    cta: { label: "Notify me", toast: "Pro is coming soon" },
    soon: true,
  },
];
