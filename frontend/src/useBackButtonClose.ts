import { useEffect, useRef } from "react";

/**
 * Makes the phone/browser back gesture close an open sheet instead of
 * navigating away from the app. Pushes a history entry while the sheet
 * is open; a back gesture pops it (closing the sheet via popstate)
 * instead of leaving the page.
 */
export function useBackButtonClose(isOpen: boolean, onClose: () => void) {
  const pushedByUs = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ sheet: true }, "");
    pushedByUs.current = true;

    function handlePopState() {
      pushedByUs.current = false;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (pushedByUs.current) {
        pushedByUs.current = false;
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
