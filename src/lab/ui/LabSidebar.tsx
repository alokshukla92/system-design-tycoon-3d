// Design Lab sidebar: component palette as a folder tree (like the course modules), plus the
// Events / Mentor feed.
import { useEffect, useRef, useState } from "react";
import { setDrawer } from "../../app/controller";
import { Icon } from "../../components/Icon";
import { NavItems } from "../../components/Topbar";
import { D, t } from "../../i18n";
import { CATALOG, PALETTE_ORDER } from "../sim/catalog/components";
import type { EventSeverity } from "../sim/types";
import { plain } from "../model";
import { addNode, availableOf, useLab } from "../store";
import { KIND_ICON } from "./common";

const CATEGORY_COLOR: Record<string, string> = {
  network: "green",
  compute: "blue",
  database: "slate",
  cache: "orange",
  messaging: "teal",
  search: "violet",
  observability: "sand",
};

function Folder({ color }: { color: string }) {
  return (
    <svg className={`folder folder--${color}`} width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
      <path d="M1.2 3.2A2 2 0 0 1 3.2 1.2h4.1l2 2.2h7.5a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H3.2a2 2 0 0 1-2-2Z" />
      <path className="folder__lip" d="M1.2 6.2h17.6" />
    </svg>
  );
}

function Palette() {
  const mode = useLab((s) => s.mode);
  const level = useLab((s) => s.level);
  const nodes = useLab((s) => s.nodes);
  const selectedId = useLab((s) => s.selectedId);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const available = availableOf({ mode, level });
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.data.kind, (counts.get(n.data.kind) ?? 0) + 1);
  const from = nodes.find((n) => n.id === selectedId);

  return (
    <nav className="course lab-palette" id="lab-course" aria-label={t("Components")}>
      {PALETTE_ORDER.map(({ category, label }) => {
        const items = Object.values(CATALOG).filter((c) => c.category === category && (!available || available.includes(c.kind)));
        if (!items.length) return null;
        const open = !closed.has(category);
        const used = items.reduce((a, c) => a + (counts.get(c.kind) ?? 0), 0);
        return (
          <section key={category} className={open ? "mod is-open" : "mod"} data-mod={category}>
            <button
              className="mod__head"
              type="button"
              aria-expanded={open}
              onClick={() =>
                setClosed((s) => {
                  const n = new Set(s);
                  if (n.has(category)) n.delete(category);
                  else n.add(category);
                  return n;
                })
              }
            >
              <Icon name="chevronRight" size={15} stroke={2.2} cls="mod__chev" />
              <Folder color={CATEGORY_COLOR[category] ?? "sand"} />
              <span className="mod__title">{t(label)}</span>
              <span className="mod__count">{used ? t("{n} in use", { n: used }) : items.length}</span>
            </button>
            <div className="mod__body">
              <div className="mod__clip">
                <ul className="mod__lessons">
                  {items.map((c) => (
                    <li key={c.kind} className="lesson" data-kind={c.kind}>
                      <button
                        type="button"
                        title={`${plain(c.description)}${from ? `\n${t("Adds it connected from {name}.", { name: plain(from.data.label) })}` : ""}`}
                        onClick={() => {
                          addNode(c.kind, from && from.data.kind !== "monitoring" ? from.id : null);
                          setDrawer(false);
                        }}
                      >
                        <span className="lesson__markbox">
                          <Icon name={KIND_ICON[c.kind]} size={15} stroke={1.7} cls="lesson__mark" />
                        </span>
                        <span className="lesson__title">{c.shortName}</span>
                        <span className="lab-palette__add" aria-hidden="true">
                          {t("Add")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
      {mode === "campaign" && <p className="lab-palette__note">{t("More components unlock as your company grows.")}</p>}
    </nav>
  );
}

const SEV: Record<EventSeverity, { label: string; tone: string; icon: string }> = {
  info: { label: D("info"), tone: "blue", icon: "info" },
  warn: { label: D("warn"), tone: "amber", icon: "alert" },
  crit: { label: D("alert"), tone: "red", icon: "siren" },
  resolve: { label: D("resolved"), tone: "green", icon: "circleCheck" },
  mentor: { label: D("mentor"), tone: "violet", icon: "bot" },
};

const MENTOR_ICON = { question: "message", observation: "eye", tradeoff: "scale", praise: "sparkles" } as const;

function Feed() {
  const events = useLab((s) => s.events);
  const messages = useLab((s) => s.mentorMessages);
  const [tab, setTab] = useState<"events" | "mentor">("events");
  const [seenMentor, setSeenMentor] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const len = tab === "events" ? events.length : messages.length;
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [len, tab]);
  useEffect(() => {
    if (tab === "mentor") setSeenMentor(messages.length);
  }, [tab, messages.length]);
  const unread = messages.length - seenMentor;

  return (
    <section className="card lab-feed" aria-label={t("Events and mentor")}>
      <div className="lab-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "events"} className={tab === "events" ? "is-on" : undefined} onClick={() => setTab("events")}>
          <Icon name="radio" size={13} stroke={2} />
          {t("Events")}
          {events.length > 0 && <span className="lab-tabs__n">{events.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "mentor"} className={tab === "mentor" ? "is-on" : undefined} onClick={() => setTab("mentor")}>
          <Icon name="bot" size={13} stroke={2} />
          {t("Mentor")}
          {unread > 0 && <span className="lab-tabs__n lab-tabs__n--hot">{unread}</span>}
        </button>
      </div>
      <div className="lab-feed__list" ref={list}>
        {tab === "events" ? (
          events.length === 0 ? (
            <p className="muted-copy lab-feed__empty">{t("Incidents and alerts stream in here. Quiet… for now.")}</p>
          ) : (
            events.map((e) => {
              const m = SEV[e.severity];
              return (
                <div key={e.id} className={`lab-event lab-event--${e.severity}`}>
                  <div className="lab-event__head">
                    <span className="lab-event__t">t+{e.tick}m</span>
                    <span className={`lab-event__sev lab-event__sev--${m.tone}`}>
                      <Icon name={m.icon} size={10} stroke={2.4} />
                      {t(m.label)}
                    </span>
                  </div>
                  <div className="lab-event__title">{plain(e.title)}</div>
                  {e.detail && <p className="lab-event__detail">{plain(e.detail)}</p>}
                </div>
              );
            })
          )
        ) : (
          <>
            <div className="lab-mentor__who">
              <span className="lab-mentor__avatar">
                <Icon name="userRound" size={16} stroke={2} />
              </span>
              <div>
                <b>Priya</b>
                <div className="lab-mentor__role">{t("Staff Engineer · asks, never tells")}</div>
              </div>
            </div>
            {messages.length === 0 && (
              <p className="lab-mentor__msg">
                {t("“I’ll be watching your design. When I see something interesting, I’ll ask you about it. I won’t give you answers — that’s not how you’ll learn this.”")}
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`lab-mentor__msg lab-mentor__msg--${m.kind}`}>
                <Icon name={MENTOR_ICON[m.kind]} size={13} stroke={2} cls="lab-mentor__kind" />
                <span>{plain(m.text)}</span>
                <span className="lab-mentor__t">t+{m.tick}m</span>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

export function LabSidebar() {
  const mode = useLab((s) => s.mode);
  const level = useLab((s) => s.level);
  const available = availableOf({ mode, level });
  const n = available ? available.length : Object.keys(CATALOG).length - 1;
  return (
    <aside className="sidebar lab-side" id="sidebar" aria-label={t("Components")}>
      <nav className="drawer-nav" aria-label={t("Sections")}>
        <NavItems size={16} />
      </nav>
      <div className="tree-root">
        <Icon name="boxes" size={18} stroke={2} />
        <span>{t("Components")}</span>
        <span className="tree-root__meta">{t("{n} available", { n })}</span>
        <button className="drawer-close" id="drawer-close" type="button" aria-label={t("Close the menu")} onClick={() => setDrawer(false)}>
          <Icon name="close" size={18} stroke={2.2} />
        </button>
      </div>
      <p className="lab-side__hint">{t("Click to add. New blocks connect from the selected one.")}</p>
      <Palette />
      <Feed />
    </aside>
  );
}
