import { Fragment } from "react";
import type { ReactNode } from "react";
import { t } from "./index";

/**
 * Translate `key` and render it as React nodes: `<b>…</b>` becomes bold and `{name}` placeholders take
 * React nodes (links, bold text) from `vars`, so translators can move them freely within the sentence.
 */
export function tr(key: string, vars: Record<string, ReactNode> = {}): ReactNode {
  const parts = t(key).split(/(<b>.*?<\/b>|\{\w+\})/g);
  return parts.map((p, i) => {
    if (p.startsWith("<b>") && p.endsWith("</b>")) return <b key={i}>{p.slice(3, -4)}</b>;
    const m = /^\{(\w+)\}$/.exec(p);
    if (m && m[1] in vars) return <Fragment key={i}>{vars[m[1]]}</Fragment>;
    return p;
  });
}
