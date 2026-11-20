import { useEffect, useRef, useState } from "react";
import { FLAT } from "../content";
import { t } from "../i18n";
import { isLocked } from "../app/router";
import { setState, useClassroom } from "../app/store";
import { Icon } from "./Icon";

export function Toast() {
  const toast = useClassroom((s) => s.toast);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !toast) return;
    el.classList.remove("is-on");
    void el.offsetWidth;
    el.classList.add("is-on");
    const id = setTimeout(() => el.classList.remove("is-on"), 2800);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <div className="toast" role="status" aria-live="polite" ref={ref}>
      {toast && (
        <>
          <span className="toast__icon">
            <Icon name={toast.icon} size={16} stroke={2} />
          </span>
          <b className="toast__text">{toast.text}</b>
        </>
      )}
    </div>
  );
}

/** Pro upsell shown when a locked lesson is requested. The replica has no checkout. */
export function UpgradeDialog() {
  const open = useClassroom((s) => s.upgradeOpen);
  const ref = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState("");
  const locked = FLAT.filter((l) => isLocked(l.id)).length;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setResult("");
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog id="pro-upgrade" aria-labelledby="pro-title" ref={ref} onClose={() => setState({ upgradeOpen: false })}>
      <div className="upgrade-head">
        <span className="upgrade-badge">✦ PRO</span>
        <form method="dialog">
          <button type="submit" aria-label={t("Close")}>
            ×
          </button>
        </form>
      </div>
      <h2 id="pro-title">{t("Traffic just doubled. What would you change first?")}</h2>
      <p>
        {t("Build the judgment to answer that with confidence. Unlock {n} more interactive lessons and see how each architecture choice changes what happens next.", {
          n: locked,
        })}
      </p>
      <ul className="upgrade-benefits">
        <li>
          <span aria-hidden="true">✓</span>
          {t("Trace requests through load balancers, caches, and database shards.")}
        </li>
        <li>
          <span aria-hidden="true">✓</span>
          {t("Watch failures spread and see how retries and failover change the outcome.")}
        </li>
        <li>
          <span aria-hidden="true">✓</span>
          {t("Work through complete designs, from a URL shortener to a chat system.")}
        </li>
      </ul>
      <div className="upgrade-price">
        <strong>US$4.99</strong>
        <span>{t("One-time payment, no subscription")}</span>
      </div>
      <button type="button" className="upgrade-action" onClick={() => setResult(t("Checkout is unavailable right now. Please try again."))}>
        {t("Unlock all {n} lessons", { n: FLAT.length })}
      </button>
      <p className="upgrade-result" role="status" hidden={!result}>
        {result}
      </p>
    </dialog>
  );
}
