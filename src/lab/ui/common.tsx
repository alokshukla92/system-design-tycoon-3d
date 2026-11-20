// Shared bits for the Practice / Design Lab views: icons per component kind, mode metadata,
// **bold** brief markup, and a <dialog> shell styled like the classroom's upgrade dialog.
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PracticeTab } from "../../app/router";
import { Icon } from "../../components/Icon";
import type { ComponentKind, Scores } from "../sim/types";
import { plain } from "../model";

export const KIND_ICON: Record<ComponentKind, string> = {
  users: "users",
  cdn: "globe",
  load_balancer: "split",
  api_server: "server",
  k8s_cluster: "boxes",
  postgres: "database",
  mysql: "database",
  mongodb: "database",
  cassandra: "database",
  dynamodb: "database",
  elasticsearch: "search",
  redis: "zap",
  kafka: "inbox",
  rabbitmq: "inbox",
  sqs: "inbox",
  worker: "cpu",
  monitoring: "activity",
};

export const MODES: Record<PracticeTab, { label: string; desc: string; icon: string; color: string }> = {
  campaign: { label: "Startup Career", desc: "100 → 100M users", icon: "rocket", color: "green" },
  incident: { label: "Incident Commander", desc: "Fix prod. Now.", icon: "siren", color: "orange" },
  interview: { label: "Architecture Interview", desc: "Design it, then defend it", icon: "target", color: "violet" },
};

export const AXES: { key: keyof Scores; label: string; short: string; icon: string }[] = [
  { key: "scalability", label: "Scalability", short: "Scale", icon: "trendingUp" },
  { key: "reliability", label: "Reliability", short: "Reliability", icon: "shield" },
  { key: "latency", label: "Latency", short: "Latency", icon: "zap" },
  { key: "cost", label: "Cost", short: "Cost", icon: "dollar" },
  { key: "maintainability", label: "Maintainability", short: "Maint", icon: "hammer" },
  { key: "complexity", label: "Simplicity", short: "Simplicity", icon: "puzzle" },
];

export const scoreLevel = (v: number): "good" | "warn" | "bad" => (v >= 75 ? "good" : v >= 50 ? "warn" : "bad");

/** Renders `**bold**` markdown-lite (briefs) with emoji stripped. */
export function rich(text: string): ReactNode[] {
  return plain(text)
    .split(/(\*\*[^*]+\*\*)/g)
    .map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));
}

export const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;

interface DialogProps {
  open: boolean;
  onClose: () => void;
  badges?: ReactNode;
  title: ReactNode;
  id: string;
  wide?: boolean;
  children: ReactNode;
}

/** Modal dialog in the upgrade-dialog style, portalled out of the zoomed .window. */
export function LabDialog({ open, onClose, badges, title, id, wide, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return createPortal(
    <dialog
      className={wide ? "lab-dialog lab-dialog--wide" : "lab-dialog"}
      id={id}
      aria-labelledby={`${id}-title`}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="lab-dialog__inner">
        <div className="upgrade-head">
          <div className="lab-dialog__badges">{badges}</div>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <h2 className="lab-dialog__title" id={`${id}-title`}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

export function Badge({ tone = "sand", icon, children }: { tone?: string; icon?: string; children: ReactNode }) {
  return (
    <span className={`lab-badge lab-badge--${tone}`}>
      {icon && <Icon name={icon} size={12} stroke={2.2} />}
      {children}
    </span>
  );
}
