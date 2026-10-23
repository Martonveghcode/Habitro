import { useId, useState, type ReactNode } from "react";

import { useUiText } from "../netlify/uiLanguage";

/** Keep filters mounted, but out of the way of the exercise on small screens. */
export function PracticeControls({
  children,
  action,
  notice,
  className = "panel control-panel exercise-sidebar",
  label,
}: {
  children: ReactNode;
  action?: ReactNode;
  notice?: ReactNode;
  className?: string;
  label?: string;
}) {
  const uiText = useUiText();
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className={`${className} practice-controls${expanded ? " practice-controls--expanded" : ""}`}>
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="practice-controls__toggle"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <span>{label ?? uiText.practiceSettings}</span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <div className="practice-controls__content" id={contentId}>{children}</div>
      {action ? <div className="practice-controls__action">{action}</div> : null}
      {notice ? <div className="practice-controls__notice">{notice}</div> : null}
    </aside>
  );
}
