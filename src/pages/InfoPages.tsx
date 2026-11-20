import { BRAND } from "../brand";
import { t } from "../i18n";
import { SitePage, TodoNote } from "./SitePage";
import { SupportEmail } from "./SiteLinks";
import { first, lessonCount, lessonHref, listJoin, moduleCount, plural, products, stepCount, LESSONS } from "./courseFacts";
import { SITE_LINKS, pageHref } from "./routes";

export function AboutPage() {
  return (
    <SitePage
      page="about"
      title={t("About")}
      heading={t("About {brand}", { brand: BRAND.name })}
      lead={t("A system design course where every idea is a moving diagram: requests flow, queues fill, servers fail, and you watch what each fix changes.")}
    >
      <p>
        {t("{lessons} in {modules} ({steps} in total) follow a string of fictional products — {products} — from a single server to a platform that spans the planet. Each lesson starts with something breaking and ends with the architecture that fixes it.", {
          lessons: plural(lessonCount, "lesson"),
          modules: plural(moduleCount, "module"),
          steps: plural(stepCount, "step"),
          products: listJoin(products),
        })}
      </p>
      <h2>{t("How to use the course")}</h2>
      <p>
        {t("Start with")} <a href={lessonHref(first?.id ?? "")}>{first?.title}</a>{" "}
        {t("and go in order: every lesson inherits the problems of the one before. Use the arrow keys to step, R to replay a step and Space to pause the traffic. When a lesson clicks, rebuild it yourself in the Design Lab, or test it under pressure in Practice.")}
      </p>
      <h2>{t("Corrections and feedback")}</h2>
      <p>
        {t("Spotted a wrong number, a confusing step or a broken diagram? Tell us on the")} <a href={pageHref("contact")}>{t("contact page")}</a>.
      </p>
    </SitePage>
  );
}

export function ContactPage() {
  return (
    <SitePage
      page="contact"
      title={t("Contact")}
      heading={t("Contact and feedback")}
      lead={t("Questions, corrections, accessibility problems or ideas for the next lesson — this is the place.")}
    >
      <h2>{t("Email")}</h2>
      <p>
        <SupportEmail subject={`${BRAND.name} feedback`} />
      </p>
      <h2>{t("What helps in a report")}</h2>
      <ul>
        <li>{t("The lesson link — it includes the step, for example #/{id}/3", { id: LESSONS[0]?.id ?? "lesson" })}</li>
        <li>{t("What you expected to see and what you saw instead")}</li>
        <li>{t("Your browser and device, if something looks broken")}</li>
        <li>{t("A source, if you are suggesting a technical correction")}</li>
      </ul>
    </SitePage>
  );
}

const STORAGE_KEYS: [string, string][] = [
  ["sdt:last", "the lesson and step you were last on"],
  ["sdt:recent", "recently opened lessons, for search"],
  ["sdt:done", "lessons you have finished"],
  ["sdt:theme", "light or dark theme, once you change it"],
  ["sdt:lab", "your Design Lab sandbox"],
  ["sdt:practice", "Practice progress and scores"],
];

export function PrivacyPage() {
  return (
    <SitePage
      page="privacy"
      title={t("Privacy")}
      heading={t("Privacy policy")}
      lead={t("Short version: no accounts, no tracking. Your progress stays in your own browser.")}
    >
      <TodoNote>
        {t("Placeholder policy. The site owner must review this text, and update it if accounts, payments or analytics are ever added.")}
      </TodoNote>
      <h2>{t("No accounts")}</h2>
      <p>{t("{brand} has no sign-up and no server-side user data. The sign-in button is a placeholder that only shows a notice.", { brand: BRAND.name })}</p>
      <h2>{t("What is stored on your device")}</h2>
      <p>{t("Progress and preferences are saved in your browser’s localStorage and never leave your device:")}</p>
      <ul>
        {STORAGE_KEYS.map(([k, v]) => (
          <li key={k}>
            <code>{k}</code> — {t(v)}
          </li>
        ))}
      </ul>
      <h2>{t("No analytics or tracking")}</h2>
      <p>{t("The site loads no analytics, advertising or tracking scripts and sets no cookies. Fonts and icons are bundled with the site, so no third-party requests are made while you learn.")}</p>
      <h2>{t("Clearing your data")}</h2>
      <p>{t("Clear this site’s data in your browser settings to reset all progress and preferences.")}</p>
      <h2>{t("Questions")}</h2>
      <p>
        {t("Email")} <SupportEmail subject="Privacy question" />.
      </p>
    </SitePage>
  );
}

export function TermsPage() {
  return (
    <SitePage
      page="terms"
      title={t("Terms of Service")}
      heading={t("Terms of use")}
      lead={t("The ground rules for using the course.")}
    >
      <article>
        <TodoNote>{t("Placeholder terms. The site owner must review and complete this text (including the date below) before publishing.")}</TodoNote>
        <p>
          {t("Last updated")} <time>TODO</time>
        </p>
        <h2>{t("1. Using the course")}</h2>
        <p>{t("{brand} ({url}) offers interactive lessons, diagrams and simulations for learning system design. By using it you agree to these terms.", { brand: BRAND.name, url: BRAND.siteUrl })}</p>
        <h2>{t("2. Content")}</h2>
        <p>{t("You may use the lessons for your own learning, at work or at home. Please do not republish or resell the lessons or diagrams without permission.")}</p>
        <h2 id="billing-and-refunds">{t("3. Pricing and payments")}</h2>
        <p>
          {t("All current content is free and there is no checkout. If a paid plan is introduced, its price, billing and refund terms will be published here and on the")}{" "}
          <a href={pageHref("pricing")}>{t("pricing page")}</a> {t("before anything can be bought.")}
        </p>
        <h2>{t("4. No warranty")}</h2>
        <p>{t("Lessons simplify real systems and their numbers are illustrative. Check any design against your own requirements and measurements before using it in production. The site is provided as is, without guarantees of availability or fitness for a particular purpose.")}</p>
        <h2>{t("5. Changes and contact")}</h2>
        <p>
          {t("These terms may change; the current version is always on this page. Questions:")} <SupportEmail subject="Terms question" />. {t("See also the")}{" "}
          <a href={pageHref("privacy")}>{t("privacy policy")}</a>.
        </p>
      </article>
    </SitePage>
  );
}

export function NotFoundPage() {
  return (
    <SitePage
      page="404"
      title={t("Page not found")}
      heading={t("Page not found")}
      lead={t("Nothing lives at {path}. The link may be old or mistyped.", { path: location.pathname })}
    >
      <h2>{t("Lessons")}</h2>
      <ul>
        {LESSONS.map((l) => (
          <li key={l.id}>
            <a href={lessonHref(l.id)}>{l.title}</a>
          </li>
        ))}
      </ul>
      <h2>{t("Pages")}</h2>
      <ul>
        {SITE_LINKS.map((l) => (
          <li key={l.id}>
            <a href={pageHref(l.id)}>{t(l.label)}</a>
          </li>
        ))}
      </ul>
    </SitePage>
  );
}
