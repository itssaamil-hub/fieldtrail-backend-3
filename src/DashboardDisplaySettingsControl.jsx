import React, { useEffect, useRef, useState } from "react";
import {
  loadDashboardDisplaySettings,
  saveDashboardDisplaySettings,
} from "./dashboardComparisons.js";

function Toggle({ label, description, checked, disabled, onChange, T }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: `1px solid ${T.line}` }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{label}</div>
        {description && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{description}</div>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        style={{
          flexShrink: 0, width: 42, height: 24, borderRadius: 999, border: "none",
          cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.65 : 1,
          background: checked ? T.verified : "#D5D1C4", position: "relative", transition: "background 0.15s",
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 18, height: 18, borderRadius: "50%",
          background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        }} />
      </button>
    </div>
  );
}

export default function DashboardDisplaySettingsControl({ T }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveSequence = useRef(0);

  const load = async () => {
    setError("");
    try {
      setSettings(await loadDashboardDisplaySettings());
    } catch (err) {
      setError(err.message || "Couldn't load dashboard display settings.");
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (next) => {
    const sequence = ++saveSequence.current;
    setSettings(next);
    setSaving(true);
    setError("");
    try {
      const saved = await saveDashboardDisplaySettings(next);
      if (sequence === saveSequence.current) {
        setSettings(saved);
        window.dispatchEvent(new Event("engage-display-settings"));
      }
    } catch (err) {
      if (sequence === saveSequence.current) {
        setError(err.message || "Couldn't save dashboard display settings.");
        await load();
      }
    } finally {
      if (sequence === saveSequence.current) setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>Display Settings</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Controls historical KPI comparison indicators across Engage dashboards.</div>
      {error && <div role="alert" style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 10 }}>{error}</div>}
      {!settings ? (
        <div style={{ fontSize: 12, color: T.inkSoft, padding: "10px 0" }}>Loading display settings…</div>
      ) : (
        <>
          <Toggle
            T={T}
            label="Show comparisons on Admin dashboard"
            description="Show historical comparison lines on Admin KPI cards."
            checked={settings.showAdminComparisons !== false}
            disabled={saving}
            onChange={(value) => save({ ...settings, showAdminComparisons: value })}
          />
          <Toggle
            T={T}
            label="Show comparisons on Employee dashboard"
            description="Show historical comparison lines on employee KPI cards."
            checked={settings.showEmployeeComparisons !== false}
            disabled={saving}
            onChange={(value) => save({ ...settings, showEmployeeComparisons: value })}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 2px" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Comparison Period</div>
              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Shared by Admin and Employee dashboards.</div>
            </div>
            <select
              value={settings.comparisonPeriod || "weekly"}
              disabled={saving}
              onChange={(event) => save({ ...settings, comparisonPeriod: event.target.value })}
              style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 9px", background: "#fff", fontSize: 12.5, opacity: saving ? 0.65 : 1 }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {saving && <div role="status" style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 6 }}>Saving display settings…</div>}
        </>
      )}
    </div>
  );
}
