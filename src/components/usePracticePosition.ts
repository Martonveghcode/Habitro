import { useLayoutEffect, useRef } from "react";

/** Return long, read-only exercises to their prompt when the learner advances. */
export function usePracticePosition(itemId: string | undefined, active: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousItem = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const previous = previousItem.current;
    previousItem.current = active ? itemId : undefined;
    if (!active || !itemId || !previous || itemId === previous || !window.matchMedia("(max-width: 1012px)").matches) return;
    // Typing flows keep their existing viewport and native keyboard.
    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
    const panel = panelRef.current;
    const navHeight = document.querySelector(".globalnav")?.getBoundingClientRect().height ?? 0;
    if (panel && panel.getBoundingClientRect().top < navHeight) {
      window.scrollBy({ top: panel.getBoundingClientRect().top - navHeight - 12, behavior: "instant" });
    }
  }, [active, itemId]);

  return panelRef;
}
