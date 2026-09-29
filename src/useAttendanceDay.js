import { useCallback, useRef, useState } from "react";
import { api, ApiError, setDayStartedFlag } from "./api.js";

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
        await api.salesmanDayStart({ locationRequired: attendanceLocationPolicy.start });
        setDayStartedFlag(sessionId, true);
        setDayStartedState(true);
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
