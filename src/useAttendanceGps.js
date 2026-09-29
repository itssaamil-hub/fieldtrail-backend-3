import { useEffect, useRef } from "react";
import { api } from "./api.js";

// Keep Start/End GPS resolution fast, but persist continuous route history at a
// calmer cadence so dozens of active devices do not create avoidable write load.
const PING_MIN_INTERVAL_MS = 30000;

export default function useAttendanceGps({
  dayStarted,
  continuousTracking,
  attendanceLocationPolicy,
  setGpsStatus,
  getBatteryPct,
}) {
  const lastPingSentRef = useRef(0);

  // Continuous tracking while the employee day is active and the setting is ON.
  useEffect(() => {
    if (!dayStarted) { setGpsStatus("idle"); return; }
    if (!continuousTracking) { setGpsStatus("idle"); return; }
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsStatus("tracking");
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;
        const capturedAt = pos.timestamp || Date.now();
        api.cacheAttendanceLocation({ lat, lng, accuracy, capturedAt });

        const now = Date.now();
        if (now - lastPingSentRef.current < PING_MIN_INTERVAL_MS) return;
        lastPingSentRef.current = now;

        const batteryPct = await getBatteryPct();
        try {
          await api.salesmanPing({
            lat,
            lng,
            accuracyM: Math.round(accuracy),
            speedMps: speed || 0,
            batteryPct,
            isMockSuspected: false,
            capturedAt: new Date(capturedAt).toISOString(),
          });
        } catch {
          // A missed ping is non-fatal; the next watchPosition fix retries.
        }
      },
      (err) => setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [dayStarted, continuousTracking, getBatteryPct, setGpsStatus]);

  // Short battery-bounded warm-up when continuous tracking is not already warming GPS.
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (!attendanceLocationPolicy.start && !attendanceLocationPolicy.end) return;
    if (dayStarted && continuousTracking) return;

    let watchId = null;
    let stopTimer = null;

    const stopWarmup = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = null;
    };

    const startWarmup = () => {
      if (document.hidden || watchId != null) return;
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          api.cacheAttendanceLocation({
            lat,
            lng,
            accuracy,
            capturedAt: pos.timestamp || Date.now(),
          });
          if (Number.isFinite(accuracy) && accuracy <= 50) stopWarmup();
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) stopWarmup();
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
      );
      stopTimer = setTimeout(stopWarmup, 60000);
    };

    const onVisibility = () => {
      if (document.hidden) stopWarmup();
      else startWarmup();
    };

    startWarmup();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", startWarmup);

    return () => {
      stopWarmup();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", startWarmup);
    };
  }, [dayStarted, continuousTracking, attendanceLocationPolicy.start, attendanceLocationPolicy.end]);
}
