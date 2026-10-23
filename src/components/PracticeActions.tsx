import type { MouseEvent, ReactNode } from "react";

/** A pointer tap must not blur a focused answer field and collapse its keyboard. */
export function preserveAnswerFocus(event: MouseEvent<HTMLElement>) {
  if (document.activeElement instanceof HTMLInputElement && document.activeElement.closest(".catalan-answer-row, .practice-panel")) {
    event.preventDefault();
  }
}

export function PracticeActions({
  children,
  onNext,
  disabled = false,
  nextLabel,
}: {
  children: ReactNode;
  onNext: () => void;
  disabled?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="practice-actions" onMouseDown={preserveAnswerFocus}>
      {children}
      <button className="ghost-btn" disabled={disabled} type="button" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  );
}
