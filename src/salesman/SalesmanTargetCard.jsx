import React from "react";

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function percent(current, target) {
  if (!target) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export default function SalesmanTargetCard({ T, monthCount, monthTarget, todayCount, dailyTarget, wonValue, fmtMoney }) {
  const monthlyCurrent = safeNumber(monthCount);
  const monthlyGoal = safeNumber(monthTarget);
  const dailyCurrent = safeNumber(todayCount);
  const dailyGoal = safeNumber(dailyTarget);
  const monthPct = percent(monthlyCurrent, monthlyGoal);
  const todayPct = percent(dailyCurrent, dailyGoal);
  const monthRemaining = monthlyGoal > 0 ? Math.max(0, monthlyGoal - monthlyCurrent) : null;
  const todayRemaining = dailyGoal > 0 ? Math.max(0, dailyGoal - dailyCurrent) : null;
  const displayWonValue = safeNumber(wonValue);
  const circleSize = 66;
  const stroke = 7;
  const radius = (circleSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - monthPct / 100);
  const monthlyAccent = "#F28A52";
  const monthlyTrack = "#F6DED0";
  const dailyAccent = "#176B6A";
  const dailyTrack = "#CFE6E1";

  return (
    <section
      aria-label="Sales target progress"
      style={{
        background: "#fff",
        border: `1px solid ${T.line}`,
        borderRadius: 16,
        padding: "13px 14px 12px",
        marginBottom: 16,
        boxShadow: "0 2px 8px rgba(20,45,46,.05)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", gap: 11, alignItems: "center" }}>
        <div style={{ width: circleSize, height: circleSize, position: "relative", display: "grid", placeItems: "center" }}>
          <svg width={circleSize} height={circleSize} viewBox={`0 0 ${circleSize} ${circleSize}`} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
            <circle cx={circleSize / 2} cy={circleSize / 2} r={radius} fill="none" stroke={monthlyTrack} strokeWidth={stroke} />
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              fill="none"
              stroke={monthlyAccent}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset .35s ease" }}
            />
          </svg>
          <strong style={{ position: "absolute", fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: T.ink }}>{monthPct}%</strong>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700, marginBottom: 3 }}>This month&apos;s target</div>
          {monthlyGoal > 0 ? (
            <>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, lineHeight: 1.08, color: T.ink, letterSpacing: "-.35px" }}>
                {monthlyCurrent} / {monthlyGoal} deals
              </div>
              <div style={{ marginTop: 4, fontSize: 10.5, color: T.inkSoft, lineHeight: 1.35 }}>
                {monthRemaining === 0 ? "Target reached" : `${monthRemaining} to go`}
                {displayWonValue > 0 && typeof fmtMoney === "function" ? ` · ${fmtMoney(displayWonValue)} won` : ""}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>Monthly target not set</div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: T.line, margin: "11px 0 9px" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>Today</span>
          {dailyGoal > 0 && todayRemaining != null && (
            <span style={{ fontSize: 9.5, color: T.inkSoft }}>{todayRemaining === 0 ? "Target reached" : `${todayRemaining} to go`}</span>
          )}
        </div>
        <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, color: T.ink, whiteSpace: "nowrap" }}>
          {dailyGoal > 0 ? `${dailyCurrent} / ${dailyGoal}` : "Target not set"}
        </strong>
      </div>

      <div style={{ height: 7, background: dailyTrack, borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${todayPct}%`,
            background: dailyAccent,
            borderRadius: 999,
            transition: "width .35s ease",
          }}
        />
      </div>
    </section>
  );
}
