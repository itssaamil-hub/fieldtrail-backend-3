import React, { useEffect, useRef, useState } from "react";

export default function LateStartToast() {
  const [lateMinutes, setLateMinutes] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const onLateStart = (event) => {
      const minutes = Number(event.detail?.lateMinutes);
      if (!Number.isFinite(minutes) || minutes <= 0) return;
      setLateMinutes(minutes);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLateMinutes(0), 3200);
    };
    window.addEventListener("engage:late-start", onLateStart);
    return () => {
      window.removeEventListener("engage:late-start", onLateStart);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!lateMinutes) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "calc(72px + env(safe-area-inset-top))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 120,
        maxWidth: "calc(100vw - 32px)",
        padding: "9px 13px",
        borderRadius: 10,
        background: "#FFF7E6",
        border: "1px solid #F1D49A",
        color: "#8A5A12",
        boxShadow: "0 6px 18px rgba(30, 35, 40, 0.12)",
        fontSize: 13,
        fontWeight: 700,
        whiteSpace: "nowrap",
        pointerEvents: "none",
      }}
    >
      Day started · Late by {lateMinutes} min
    </div>
  );
}
