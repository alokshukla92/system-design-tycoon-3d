// Design Lab graph model (React-Flow-free) and small shared helpers.
import type { ArchNodeData, GraphSnapshot, WorkloadProfile, SLO } from "./sim/types";

export interface LabNode {
  id: string;
  position: { x: number; y: number };
  data: ArchNodeData;
}

export interface LabEdge {
  id: string;
  source: string;
  target: string;
}

export const toSnapshot = (nodes: LabNode[], edges: LabEdge[]): GraphSnapshot => ({
  nodes: nodes.map((n) => ({ id: n.id, data: n.data, position: n.position })),
  edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
});

export const fromSnapshot = (snap: GraphSnapshot): { nodes: LabNode[]; edges: LabEdge[] } => ({
  nodes: snap.nodes.map((n) => ({ id: n.id, position: { ...n.position }, data: { ...n.data, config: { ...n.data.config } } })),
  edges: snap.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
});

/** The source game's copy contains emoji; the replica UI uses line icons only. */
export const plain = (text: string): string =>
  text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^\s+/gm, "")
    .trim();

export const fmtNum = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
};

export const fmtUsd = (n: number): string => `$${fmtNum(n)}`;

export interface WorkloadPreset {
  id: string;
  label: string;
  workload: WorkloadProfile;
}

/** Sandbox traffic shapes (free play: not part of the source game, values follow its levels). */
export const WORKLOADS: WorkloadPreset[] = [
  {
    id: "web",
    label: "Balanced web app",
    workload: { rpsPerKUsers: 12, readRatio: 0.9, staticRatio: 0.1, searchRatio: 0, storageGbPerDayPer10k: 2, peakMult: 1.6, needsStrongConsistency: false, skew: 0.25 },
  },
  {
    id: "feed",
    label: "Read-heavy feed",
    workload: { rpsPerKUsers: 28, readRatio: 0.95, staticRatio: 0.5, searchRatio: 0.02, storageGbPerDayPer10k: 8, peakMult: 2, needsStrongConsistency: false, skew: 0.6 },
  },
  {
    id: "ingest",
    label: "Write-heavy ingest",
    workload: { rpsPerKUsers: 20, readRatio: 0.25, staticRatio: 0, searchRatio: 0, storageGbPerDayPer10k: 40, peakMult: 1.5, needsStrongConsistency: false, skew: 0.3 },
  },
  {
    id: "search",
    label: "Search-heavy catalog",
    workload: { rpsPerKUsers: 14, readRatio: 0.9, staticRatio: 0.4, searchRatio: 0.3, storageGbPerDayPer10k: 4, peakMult: 1.8, needsStrongConsistency: false, skew: 0.3 },
  },
  {
    id: "payments",
    label: "Payments (strong consistency)",
    workload: { rpsPerKUsers: 8, readRatio: 0.6, staticRatio: 0.05, searchRatio: 0, storageGbPerDayPer10k: 5, peakMult: 2, needsStrongConsistency: true, skew: 0.15 },
  },
];

export const workloadById = (id: string): WorkloadPreset => WORKLOADS.find((w) => w.id === id) ?? WORKLOADS[0];

/** Display/scoring SLO for the sandbox. */
export const SANDBOX_SLO: SLO = { maxP95Ms: 300, minAvailabilityPct: 99.9, maxErrorRate: 0.01, maxMonthlyBudget: 20000 };

/** Sandbox user-count presets (slider stops). */
export const USER_STOPS = [100, 1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000, 100_000_000];
