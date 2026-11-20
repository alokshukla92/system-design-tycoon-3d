import { pageForPath } from "./routes";
import { PricingPage } from "./PricingPage";
import { AboutPage, ContactPage, NotFoundPage, PrivacyPage, TermsPage } from "./InfoPages";
import "../styles/pages.css";

export { CourseOverview } from "./CourseOverview";
export { pageForPath } from "./routes";

const VIEWS = {
  pricing: PricingPage,
  about: AboutPage,
  contact: ContactPage,
  privacy: PrivacyPage,
  terms: TermsPage,
  "404": NotFoundPage,
};

/** Static page for the current path, or null on the classroom root. */
export function StaticPage({ pathname = location.pathname }: { pathname?: string }) {
  const id = pageForPath(pathname);
  if (!id) return null;
  const View = VIEWS[id];
  return <View />;
}
