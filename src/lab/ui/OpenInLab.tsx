// "Open in Design Lab" stage tool for lesson steps: loads the step's architecture into the sandbox
// (#/lab), confirming first when it would replace the learner's own saved design.
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { t } from "../../i18n";
import { tr } from "../../i18n/rich";
import type { Lesson } from "../../types/lesson";
import { hasLab, type LessonOrigin } from "../fromLesson";
import { loadLessonGraph, sandboxHasWork } from "../store";
import { Badge, LabDialog } from "./common";

const plainTitle = (s: string) => s.replace(/<[^>]+>/g, "");

export function OpenInLabButton({ lesson, step }: { lesson: Lesson | undefined; step: number }) {
  const [confirming, setConfirming] = useState(false);
  const s = lesson?.steps[step];
  if (!lesson || !s || !hasLab(s.lab)) return null;
  const lab = s.lab;
  const origin: LessonOrigin = { lessonId: lesson.id, title: plainTitle(lesson.title), step };
  const open = () => {
    setConfirming(false);
    loadLessonGraph(lab, origin);
    location.hash = "#/lab";
  };
  return (
    <>
      <button
        className="tool tool--lab"
        id="open-lab"
        type="button"
        title={t("Open this step’s architecture in the Design Lab")}
        aria-label={t("Open in Design Lab")}
        onClick={() => (sandboxHasWork(origin) ? setConfirming(true) : open())}
      >
        <Icon name="flask" size={15} stroke={2} />
        <span>{t("Tinker")}</span>
      </button>
      <LabDialog
        id="lab-replace"
        open={confirming}
        onClose={() => setConfirming(false)}
        badges={<Badge icon="flask">{t("Design Lab")}</Badge>}
        title={t("Replace your sandbox design?")}
      >
        <div className="lab-dialog__body">
          <p>
            {tr("Your Design Lab already holds a design. Opening {lesson} · step {n} replaces it with this step’s architecture.", {
              lesson: <b>{origin.title}</b>,
              n: step + 1,
            })}
          </p>
        </div>
        <div className="lab-dialog__actions">
          <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
            {t("Keep my design")}
          </button>
          <button type="button" className="btn-pop lab-action" id="lab-replace-ok" onClick={open}>
            {t("Replace & open")}
            <Icon name="arrowRight" size={16} stroke={2.2} />
          </button>
        </div>
      </LabDialog>
    </>
  );
}
