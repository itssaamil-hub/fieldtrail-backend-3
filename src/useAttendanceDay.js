import { useCallback, useRef, useState } from "react";
import { api, ApiError, setDayStartedFlag } from "./api.js";
import { attendanceV2Api } from "./attendanceV2Api.js";

/**
 * Owns the Start Day / End Day request lifecycle while leaving presentation
 * state (dayStarted, closing modal, confirmation flash, errors) in SalesmanApp.
 * This preserves the existing UI contract while keeping attendance orchestration
 * out of the main App.jsx file.
 */
export default function useAttendanceDay({
  dayStarted,
  attendanceLocationPolicy,
  sessionId,
  setShowClosing,
  setDayStartedState,
  setJustToggled,
  setLoadError,
}) {
  const [togglingDay, setTogglingDay] = useState(false);
  const inFlightRef = useRef(false);

  const handleToggleDay = useCallback(async (closing) => {
    if (dayStarted && !closing) {
      setShowClosing(true);
      return;
    }

    if (inFlightRef.current || togglingDay) return;
    inFlightRef.current = true;
    setTogglingDay(true);

    try {
      if (dayStarted) {
        await api.endDayWithClosing(
          { ...closing },
          { locationRequired: attendanceLocationPolicy.end }
        );
        setShowClosing(false);
        setDayStartedFlag(sessionId, false);
        setDayStartedState(false);
      } else {
        const result = await api.salesmanDayStart({ locationRequired: attendanceLocationPolicy.start });
        setDayStartedFlag(sessionId, true);
        setDayStartedState(true);
        const lateMinutes = Number(result?.lateMinutes);
        if (Number.isFinite(lateMinutes) && lateMinutes > 0) {
          try {
            const ui = await attendanceV2Api.lateStartUi();
            if (ui?.showLateStartBanner === true) {
              window.dispatchEvent(new CustomEvent("engage:late-start", { detail: { lateMinutes } }));
            }
          } catch {
            // Start Day already succeeded. A presentation preference must never turn it into a failure.
          }
        }
      }

      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 1600);
    } catch (err) {
      if (closing) throw err;
      setLoadError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
    } finally {
      inFlightRef.current = false;
      setTogglingDay(false);
    }
  }, [
    attendanceLocationPolicy.end,
    attendanceLocationPolicy.start,
    dayStarted,
    sessionId,
    setDayStartedState,
    setJustToggled,
    setLoadError,
    setShowClosing,
    togglingDay,
  ]);

  return { togglingDay, handleToggleDay };
}
