import type { ReactNode } from "react";
import { COURSE, getLesson } from "../content";
import { BRAND } from "../brand";
import { fmt, t } from "../i18n";
import { SiteLinks, SupportEmail } from "./SiteLinks";
import { SiteCredit } from "../components/Credit";
import {
  featured,
  first,
  last,
  lessonCount,
  lessonHref,
  listJoin,
  moduleCount,
  plural,
  products,
  summaryText,
  techniques,
  totalMinutes,
} from "./courseFacts";

/** Reading list shown under the outline. Edit freely; `lesson` must be a lesson id from src/content. */
export const REFERENCES: { lesson: string; title: string; href: string }[] = [
  { lesson: "the-slow-burn", title: "PostgreSQL Documentation — Indexes", href: "https://www.postgresql.org/docs/current/indexes.html" },
  {
    lesson: "the-3am-page",
    title: "PostgreSQL Documentation — High Availability, Load Balancing, and Replication",
    href: "https://www.postgresql.org/docs/current/high-availability.html",
  },
  { lesson: "surge", title: "RabbitMQ Tutorials — Work Queues", href: "https://www.rabbitmq.com/tutorials/tutorial-two-python" },
  { lesson: "checkout", title: "Stripe API Reference — Idempotent requests", href: "https://docs.stripe.com/api/idempotent_requests" },
];

function LessonLink({ id, children }: { id: string | undefined; children?: ReactNode }) {
  if (!id) return null;
  return (
    <a data-catalog-lesson="" href={lessonHref(id)}>
      {children ?? getLesson(id)?.title ?? id}
    </a>
  );
}

/** SEO-style course overview below the classroom window (target of the topbar "Course" button). */
export function CourseOverview() {
  const brand = BRAND.name;
  const refs = REFERENCES.filter((r) => getLesson(r.lesson));
  return (
    <section className="course-overview" aria-labelledby="course-heading" id="course-overview" tabIndex={-1}>
      <h2 id="course-heading">{t("{brand}: System Design in {n} Animated Lessons", { brand, n: lessonCount })}</h2>
      <div className="course-guide">
        <section>
          <h3>{t("How it works")}</h3>
          <p>
            {fmt("Pick a lesson in the sidebar or press ⌘K / Ctrl K to search. New to system design? Begin with")}{" "}
            <LessonLink id={first?.id} />.{" "}
            {fmt("Each press of")} <strong>{fmt("Next")}</strong>{" "}
            {fmt("changes one thing in the architecture; press Replay to watch the same traffic again.")}
          </p>
        </section>
        <section>
          <h3>{t("What you get with {brand}", { brand })}</h3>
          <ul>
            <li>
              <strong>{fmt("{lessons}, about {minutes} minutes in all.", { lessons: plural(lessonCount, "story-driven lesson"), minutes: totalMinutes })}</strong>{" "}
              {fmt("Follow {products} as each one outgrows its architecture.", { products: listJoin(products) })}
            </li>
            <li>
              <strong>{fmt("Live numbers on every step.")}</strong>{" "}
              {fmt("Users, requests per second, latency and errors update as the diagram changes, so you see the cost of each decision.")}
            </li>
            <li>
              <strong>{fmt("Design Lab and Practice.")}</strong>{" "}
              {fmt("Rebuild what you learned in a sandbox, then play campaigns, incident drills and interview scenarios.")}
            </li>
          </ul>
        </section>
        <section>
          <h3>{t("Who {brand} is for", { brand })}</h3>
          <ul>
            <li>
              <strong>{fmt("Developers moving into backend work.")}</strong> {fmt("See why the single-server setup stops working before you have to fix it at 3 AM.")}
            </li>
            <li>
              <strong>{fmt("Interview candidates.")}</strong> {fmt("Practise explaining trade-offs out loud: what breaks first, what each fix costs, and what you would measure.")}
            </li>
            <li>
              <strong>{fmt("Teams reviewing a design.")}</strong> {fmt("Share a lesson step as a common picture before arguing about caches, replicas or queues.")}
            </li>
          </ul>
        </section>
        <section>
          <h3>{t("A closer look at {brand}", { brand })}</h3>
          <p>
            {fmt("Open")} <LessonLink id={featured?.id} />: {summaryText(featured?.id ?? "")}{" "}
            {fmt("Before each step, guess which metric will move and by how much — then press Next and check.")}
          </p>
          <p>{fmt("The traffic, timings and prices are simplified teaching numbers. For real systems, measure your own workload and load-test before you decide.")}</p>
        </section>
        <section className="guide-faq">
          <h2>{t("{brand} FAQ", { brand })}</h2>
          <details>
            <summary>{t("What does {brand} cover?", { brand })}</summary>
            <p>{fmt("{lessons} in {modules}: {topics}.", { lessons: plural(lessonCount, "lesson"), modules: plural(moduleCount, "module"), topics: listJoin(techniques) })}</p>
          </details>
          <details>
            <summary>{t("Do I need an account?")}</summary>
            <p>{fmt("No. There is no sign-up. Your progress is saved in this browser’s local storage and nowhere else.")}</p>
          </details>
          <details>
            <summary>{t("What order should I take the lessons in?")}</summary>
            <p>
              {fmt("In order, from")} <LessonLink id={first?.id} /> {fmt("to")} <LessonLink id={last?.id} />.{" "}
              {fmt("Each lesson picks up the problems the previous one left behind, and the last one combines every technique at once.")}
            </p>
          </details>
          <details>
            <summary>{t("How do the Design Lab and Practice fit in?")}</summary>
            <p>{fmt("Lessons show one good answer. The Design Lab lets you build your own and watch it run; Practice gives you goals, incidents and interview prompts to solve against the same simulator.")}</p>
          </details>
        </section>
      </div>
      <h2>{t("The {brand} course outline", { brand })}</h2>
      <p>
        {fmt("{brand} groups {lessons} into {modules}. Start with {first}, or jump straight to {last} to see everything working together.", {
          brand,
          lessons: plural(lessonCount, "interactive lesson"),
          modules: plural(moduleCount, "module"),
          first: first?.title ?? "",
          last: last?.title ?? "",
        })}
      </p>
      <div className="course-modules">
        {COURSE.map((m) => (
          <section key={m.id}>
            <h3>{m.title}</h3>
            <ul>
              {m.lessons.map((l) => {
                const summary = getLesson(l.id)?.summary;
                return (
                  <li key={l.id}>
                    <LessonLink id={l.id}>{l.title}</LessonLink>
                    {summary && <p dangerouslySetInnerHTML={{ __html: summary }} />}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {refs.length > 0 && (
        <section className="course-references" aria-labelledby="sources-heading">
          <h2 id="sources-heading">{t("Further reading for {brand}", { brand })}</h2>
          <ul>
            {refs.map((r) => (
              <li key={r.href}>
                {getLesson(r.lesson)?.title} ·{" "}
                <cite>
                  <a href={r.href} lang="en" rel="noopener">
                    {r.title}
                  </a>
                </cite>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="course-footer">
        <address className="site-support">
          <span>{t("Support")}</span>
          <SupportEmail />
        </address>
        <SiteLinks />
        <SiteCredit />
      </footer>
    </section>
  );
}
