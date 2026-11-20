import { fmt, t } from "../i18n";
import { showToast } from "../app/store";
import { SitePage, StartLearning } from "./SitePage";
import { SupportEmail } from "./SiteLinks";
import { FEATURE_VARS, PLANS } from "./pricing.config";
import type { Plan } from "./pricing.config";
import { homeHref, pageHref } from "./routes";

function PlanCard({ plan }: { plan: Plan }) {
  const { cta } = plan;
  return (
    <div className="pricing-card" data-plan={plan.id}>
      <p className="plan-name">
        {t(plan.name)}
        {plan.soon && <span className="plan-badge">{t("Coming soon")}</span>}
      </p>
      <p className="price">{t(plan.price)}</p>
      <p>{t(plan.description)}</p>
      <ul>
        {plan.features.map((f) => (
          <li key={f}>{t(f, FEATURE_VARS)}</li>
        ))}
      </ul>
      {plan.note && <p className="plan-note">{t(plan.note)}</p>}
      {cta.href ? (
        <StartLearning label={cta.label} href={cta.href === "/" ? homeHref() : cta.href} />
      ) : (
        <button type="button" className="start-learning" onClick={() => showToast(cta.toast ? t(cta.toast) : t("Coming soon"), "sparkles")}>
          {t(cta.label)} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}

export function PricingPage() {
  return (
    <SitePage
      page="pricing"
      title={t("Pricing")}
      heading={t("Course pricing")}
      lead={fmt("Every lesson that exists today is free to use. Here is what you get now and what may come later.")}
    >
      <div className="pricing-plans">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </div>
      <h2>{t("Payments")}</h2>
      <p>
        {fmt("There is no checkout yet, so nothing can be charged. If a paid plan launches, its price and terms will be listed here and in the")}{" "}
        <a href={`${pageHref("terms")}#billing-and-refunds`}>{fmt("terms of use")}</a>.
      </p>
      <p>
        {fmt("Questions about plans? Email")} <SupportEmail subject="Pricing question" />.
      </p>
    </SitePage>
  );
}
