import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin,
  Battery,
  Gauge,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Plus,
  List,
  X,
  Navigation,
  Camera,
  Radio,
  WifiOff,
  Download,
  RefreshCw,
  Settings,
  LogOut,
  Loader2,
  Route,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  api,
  ApiError,
  getApiBase,
  setApiBase,
  getSession,
  setSession,
  clearSession,
  getWsBase,
  getDeviceId,
  getDayStarted,
  setDayStartedFlag,
  getQueuedLeads,
  pushQueuedLead,
  removeQueuedLead,
  mapSalesmanRow,
  mapLeadRow,
  buildExportUrl,
} from "./api.js";

// ---------------------------------------------------------------------------
// Design tokens — "field ledger": a working paper trail, not a generic SaaS
// dashboard. Ink navy structure, paper-grey surfaces, a signal green for
// verified truth and an amber for anything that can't be trusted yet.
// ---------------------------------------------------------------------------
const T = {
  ink: "#1C2430",
  inkSoft: "#4A5568",
  paper: "#EFEDE6",
  paperDeep: "#E2DFD5",
  card: "#FBFAF6",
  line: "#D8D4C7",
  verified: "#2F7A54",
  verifiedSoft: "#E4F1E9",
  warn: "#B8791F",
  warnSoft: "#F6EAD6",
  danger: "#A23B2E",
  dangerSoft: "#F5E2DE",
  route: "#33507A",
  accent: "#33507A",
};

const rand = (a, b) => a + Math.random() * (b - a);
const fmtTime = (d) => (d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const STATUSES = ["new", "contacted", "follow_up", "demo_scheduled", "proposal_sent", "negotiation", "won", "lost"];
const STATUS_LABEL = {
  new: "New", contacted: "Contacted", follow_up: "Follow-up", demo_scheduled: "Demo Scheduled",
  proposal_sent: "Proposal Sent", negotiation: "Negotiation", won: "Won", lost: "Lost",
};

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);
  return { canInstall: !!deferredPrompt && !installed, installed, promptInstall };
}

// ---------------------------------------------------------------------------
export default function App() {
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [session, setSessionState] = useState(getSession());
  const [showSettings, setShowSettings] = useState(false);
  const [showCrmSettings, setShowCrmSettings] = useState(false);
  const online = useOnlineStatus();

  const handleSaveApiBase = (url) => {
    const changed = url !== apiBase;
    setApiBase(url);
    setApiBaseState(url);
    if (changed && session) {
      clearSession();
      setSessionState(null);
    }
  };

  const handleLoggedIn = (sess) => {
    setSession(sess);
    setSessionState(sess);
  };

  const handleLogout = () => {
    clearSession();
    setSessionState(null);
  };

  let body;
  if (!apiBase) {
    body = <ConnectBackendScreen onSave={handleSaveApiBase} />;
  } else if (!session) {
    body = <LoginScreen apiBase={apiBase} online={online} onLoggedIn={handleLoggedIn} onOpenSettings={() => setShowSettings(true)} />;
  } else if (session.role === "admin") {
    body = <AdminApp session={session} online={online} onLogout={handleLogout} />;
  } else {
    body = <SalesmanApp session={session} online={online} onLogout={handleLogout} />;
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: T.paper, minHeight: "100vh", color: T.ink }}>
      <TopBar online={online} session={session} onLogout={handleLogout} onOpenSettings={() => setShowSettings(true)} onOpenCrmSettings={() => setShowCrmSettings(true)} />
      {body}
      {showSettings && (
        <SettingsModal
          apiBase={apiBase}
          onClose={() => setShowSettings(false)}
          onSave={(url) => { handleSaveApiBase(url); setShowSettings(false); }}
        />
      )}
      {showCrmSettings && <CrmSettingsModal onClose={() => setShowCrmSettings(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function TopBar({ online, session, onLogout, onOpenSettings, onOpenCrmSettings }) {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const [showIosHint, setShowIosHint] = useState(false);
  const [narrow, setNarrow] = useState(window.innerWidth < 560);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 560);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", paddingTop: "calc(14px + env(safe-area-inset-top))", background: T.ink, color: T.paper, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MapPin size={17} color={T.paper} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: 0.2 }}>FieldTrail</div>
          {!narrow && session && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#9AA5B1", marginLeft: 4 }}>
              {session.fullName} · {session.role}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConnectionPill online={online} />

          <button
            onClick={onOpenSettings}
            title="Backend settings"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid #3A4658", cursor: "pointer", background: "#2A3444", color: T.paper }}
          >
            <Settings size={14} />
          </button>

          {!installed && (
            <div style={{ position: "relative" }}>
              <button onClick={() => (canInstall ? promptInstall() : setShowIosHint((v) => !v))}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 6, border: "1px solid #3A4658", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#2A3444", color: T.paper, fontFamily: "Inter, sans-serif" }}
                title="Install FieldTrail as an app">
                <Download size={13} /> {narrow ? "" : "Install"}
              </button>
              {showIosHint && isIos && !canInstall && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 230, background: T.card, color: T.ink, borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.5, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 60 }}>
                  On iPhone/iPad: tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen."</strong>
                  <button onClick={() => setShowIosHint(false)} style={{ display: "block", marginTop: 8, background: "none", border: "none", color: T.route, fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 12 }}>Got it</button>
                </div>
              )}
            </div>
          )}

          {session?.role === "admin" && (
            <button
              onClick={onOpenCrmSettings}
              title="CRM Settings"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 6, border: "1px solid #3A4658", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#2A3444", color: T.paper, fontFamily: "Inter, sans-serif" }}
            >
              <Settings size={13} /> {narrow ? "" : "CRM Settings"}
            </button>
          )}

          {session && (
            <button
              onClick={onLogout}
              title="Log out"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 6, border: "1px solid #3A4658", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "transparent", color: "#B7C0CC", fontFamily: "Inter, sans-serif" }}
            >
              <LogOut size={13} /> {narrow ? "" : "Log out"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionPill({ online }) {
  if (!online) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#F0C9A8", background: "#4A2E1F", padding: "5px 9px", borderRadius: 6, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
        <WifiOff size={12} /> OFFLINE
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// First-run screen: no backend URL saved yet. Pings /health before saving so
// a typo doesn't silently break everything downstream.
function ConnectBackendScreen({ onSave }) {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    const clean = url.trim().replace(/\/+$/, "");
    if (!clean) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`${clean}/health`);
      if (!res.ok) throw new Error();
      onSave(clean);
    } catch {
      setError("Couldn't reach that URL. Double-check it's your deployed backend and try again — or save anyway if you're sure it's right.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: T.ink, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <MapPin size={26} color={T.paper} />
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>Connect FieldTrail</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>Paste your backend's URL to get started. You only need to do this once per device.</div>
      </div>
      <Field label="Backend URL">
        <input
          style={inputStyle}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-backend.up.railway.app"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </Field>
      {error && (
        <div style={{ fontSize: 12, color: T.warn, background: T.warnSoft, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
          {error}
          <button onClick={() => onSave(url.trim().replace(/\/+$/, ""))} style={{ display: "block", marginTop: 6, background: "none", border: "none", color: T.route, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12 }}>
            Save anyway
          </button>
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={!url.trim() || checking}
        style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: url.trim() ? "pointer" : "not-allowed", background: url.trim() ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {checking && <Loader2 size={16} className="spin" />}
        {checking ? "Checking…" : "Connect"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function LoginScreen({ apiBase, online, onLoggedIn, onOpenSettings }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.login(phone.trim(), password);
      // Expected shape: { token, user: { id, fullName, role, phone } }
      const user = res.user || res;
      onLoggedIn({
        token: res.token,
        id: user.id,
        fullName: user.fullName || user.full_name,
        role: user.role,
        phone: user.phone,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Check your phone number and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "60px 20px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: T.ink, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <MapPin size={26} color={T.paper} />
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>Sign in</div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>{apiBase}</div>
      </div>

      {!online && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.warn, background: T.warnSoft, padding: "9px 12px", borderRadius: 8, marginBottom: 14 }}>
          <WifiOff size={14} /> No connection — you need to be online to sign in the first time.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Field label="Phone number">
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit phone" inputMode="tel" autoFocus />
        </Field>
        <Field label="Password">
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && (
          <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={!phone.trim() || !password || loading}
          style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: "pointer", background: T.route, color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: !phone.trim() || !password ? 0.6 : 1 }}
        >
          {loading && <Loader2 size={16} className="spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button onClick={onOpenSettings} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: T.inkSoft, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
        Not your backend? Change the URL
      </button>
    </div>
  );
}

function SettingsModal({ apiBase, onClose, onSave }) {
  const [url, setUrl] = useState(apiBase || "");
  return (
    <Overlay onClose={onClose} title="Backend settings">
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>
        Changing this will sign you out, since sessions are tied to a specific backend.
      </div>
      <Field label="Backend URL">
        <input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-backend.up.railway.app" autoCapitalize="none" autoCorrect="off" />
      </Field>
      <button
        onClick={() => onSave(url.trim().replace(/\/+$/, ""))}
        disabled={!url.trim()}
        style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: url.trim() ? "pointer" : "not-allowed", background: url.trim() ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5 }}
      >
        Save
      </button>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Shared small pieces
// ---------------------------------------------------------------------------
function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div
      className={onClick ? "ft-card ft-row" : "ft-card"}
      onClick={onClick}
      style={{
        background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 16px",
        minWidth: 118, flex: 1, cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 11, color: T.inkSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: color || T.ink, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function VerificationStamp({ status, small }) {
  const map = {
    verified: { label: "VERIFIED", color: T.verified, bg: T.verifiedSoft, IconC: CheckCircle2 },
    poor_accuracy: { label: "COULD NOT VERIFY", color: T.warn, bg: T.warnSoft, IconC: AlertTriangle },
    unverified: { label: "UNVERIFIED", color: T.danger, bg: T.dangerSoft, IconC: AlertTriangle },
  };
  const s = map[status] || map.unverified;
  const IconC = s.IconC;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1.5px solid ${s.color}`, color: s.color, background: s.bg, borderRadius: 5, padding: small ? "2px 7px" : "4px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: small ? 10.5 : 11.5, fontWeight: 600, letterSpacing: 0.3, transform: "rotate(-1deg)", whiteSpace: "nowrap" }}>
      <IconC size={small ? 11 : 13} />
      {s.label}
    </div>
  );
}

function SyncBadge({ syncStatus }) {
  if (syncStatus !== "queued") return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: T.warn, background: T.warnSoft, borderRadius: 5, padding: "2px 7px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
      <RefreshCw size={10} /> QUEUED — WILL SYNC
    </div>
  );
}

// Shown instead of VerificationStamp when GPS Location is turned off in
// Location Settings — this is a neutral "not applicable" state, distinct
// from an actual failed/unverified GPS reading.
function NoLocationBadge({ small }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.inkSoft, background: T.paperDeep, borderRadius: 5, padding: small ? "2px 7px" : "4px 10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: small ? 10.5 : 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>
      NO LOCATION
    </div>
  );
}

// A labeled ON/OFF toggle — used throughout CRM Settings. Deliberately
// plain (no external UI lib) to match the rest of this app's styling.
function SettingToggle({ label, description, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: `1px solid ${T.line}` }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{label}</div>
        {description && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        style={{
          flexShrink: 0, width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
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

function CrmSettingsModal({ onClose }) {
  const [leadSettings, setLeadSettings] = useState(null);
  const [locationSettings, setLocationSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminGetSettings()
      .then((res) => { setLeadSettings(res.leadSettings); setLocationSettings(res.locationSettings); })
      .catch((err) => setError(err.message || "Couldn't load settings."));
  }, []);

  const save = async (nextLead, nextLocation) => {
    setSaving(true);
    setError("");
    try {
      const res = await api.adminUpdateSettings({ leadSettings: nextLead, locationSettings: nextLocation });
      setLeadSettings(res.leadSettings);
      setLocationSettings(res.locationSettings);
    } catch (err) {
      setError(err.message || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleLead = (key) => (val) => save({ ...leadSettings, [key]: val }, locationSettings);
  const toggleLocation = (key) => (val) => save(leadSettings, { ...locationSettings, [key]: val });

  return (
    <Overlay onClose={onClose} title="CRM Settings">
      {!leadSettings || !locationSettings ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: 20 }}>
          <Loader2 size={16} className="spin" /> Loading settings…
        </div>
      ) : (
        <>
          {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>{error}</div>}

          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>Lead Settings</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Controls which fields a salesman must fill in when adding a lead.</div>
          <SettingToggle label="Require Business Name" checked={leadSettings.requireBusinessName} onChange={toggleLead("requireBusinessName")} />
          <SettingToggle label="Require Sub Location" checked={leadSettings.requireSubLocation} onChange={toggleLead("requireSubLocation")} />
          <SettingToggle label="Require POS Name" checked={leadSettings.requirePosName} onChange={toggleLead("requirePosName")} />
          <SettingToggle label="Require Contact Name" checked={leadSettings.requireContactName} onChange={toggleLead("requireContactName")} />
          <SettingToggle label="Require Contact Number" checked={leadSettings.requireContactNumber} onChange={toggleLead("requireContactNumber")} />
          <SettingToggle label="Require Status" checked={leadSettings.requireStatus} onChange={toggleLead("requireStatus")} />
          <SettingToggle label="Require Comments" checked={leadSettings.requireComments} onChange={toggleLead("requireComments")} />

          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginTop: 22, marginBottom: 4 }}>Location Settings</div>
          <SettingToggle
            label="GPS Location"
            description="If off, leads can be saved with no location at all."
            checked={locationSettings.gpsLocation}
            onChange={toggleLocation("gpsLocation")}
          />
          <SettingToggle
            label="Location Mandatory for New Lead"
            description="Only applies when GPS Location is on — salesman must capture location before saving."
            checked={locationSettings.locationMandatoryForNewLead}
            onChange={toggleLocation("locationMandatoryForNewLead")}
          />
          <SettingToggle
            label="Continuous GPS Tracking"
            description="Live location pings while the salesman's day is active."
            checked={locationSettings.continuousGpsTracking}
            onChange={toggleLocation("continuousGpsTracking")}
          />

          {saving && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={12} className="spin" /> Saving…</div>}
        </>
      )}
    </Overlay>
  );
}

function ExportButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: T.ink, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}
    >
      <Download size={12} /> {label}
    </button>
  );
}

function Tab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${active ? T.route : T.line}`, cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: active ? T.route : "#fff", color: active ? "#fff" : T.ink }}
    >
      {label}
    </button>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 12.5, fontFamily: "Inter, sans-serif", background: "#fff", color: T.ink }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function LegendDot({ color, label }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 8, background: color, display: "inline-block" }} />{label}</div>;
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600, marginBottom: 4 }}>{label}</div>{children}</div>;
}

const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 13.5, fontFamily: "Inter, sans-serif", background: "#fff", color: T.ink, boxSizing: "border-box" };

function Overlay({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,36,48,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2000 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", background: T.card, borderRadius: "16px 16px 0 0", padding: 18, paddingBottom: "calc(18px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}><X size={19} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live map — Leaflet + OpenStreetMap (free, no API key). Salesman and lead
// markers are plain Leaflet layers kept in refs so live position updates
// just move existing markers instead of re-creating the map on every render.
// ---------------------------------------------------------------------------
function LiveMap({ salesmen, leads, onSelectLead, title = "Live Salesmen & Lead Map", subtitle }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const salesmanMarkersRef = useRef({});
  const leadMarkersRef = useRef({});
  const onSelectLeadRef = useRef(onSelectLead);
  const flownOnceRef = useRef(false);
  onSelectLeadRef.current = onSelectLead;

  const salesmanIcon = (s) =>
    L.divIcon({
      className: "",
      html: `
        <div style="position:relative;display:flex;align-items:center;">
          <div style="position:absolute;width:16px;height:16px;border-radius:50%;background:${T.route};opacity:${s.status === "online" ? 0.35 : 0};animation:pulseMarker 1.6s ease-out infinite;"></div>
          <div style="position:relative;width:16px;height:16px;border-radius:50%;background:${s.status === "online" ? T.route : "#9AA5B1"};border:2px solid ${s.status === "online" ? T.verified : "#fff"};box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>
          <div style="margin-left:6px;padding:1px 6px;background:${T.ink};color:${T.paper};font:600 10.5px Inter,sans-serif;border-radius:4px;white-space:nowrap;">${s.name.split(" ")[0]}${s.status === "online" ? " · LIVE" : ""}</div>
        </div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

  const leadColor = (l) => (l.verification === "verified" ? T.verified : l.verification === "poor_accuracy" ? T.warn : T.danger);
  const leadIcon = (l) =>
    L.divIcon({
      className: "",
      html: `<div style="width:12px;height:12px;border-radius:50%;background:${leadColor(l)};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [26.847, 80.975], zoom: 12, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    const positioned = salesmen.filter((s) => s.lat != null && s.lng != null);
    positioned.forEach((s) => {
      seen.add(s.id);
      const existing = salesmanMarkersRef.current[s.id];
      if (existing) {
        existing.setLatLng([s.lat, s.lng]);
        existing.setIcon(salesmanIcon(s));
      } else {
        const marker = L.marker([s.lat, s.lng], { icon: salesmanIcon(s), zIndexOffset: 500 }).addTo(map);
        marker.bindTooltip(`${s.name} · ${s.area}`, { direction: "top", offset: [0, -8] });
        salesmanMarkersRef.current[s.id] = marker;
      }
    });
    Object.keys(salesmanMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) { salesmanMarkersRef.current[id].remove(); delete salesmanMarkersRef.current[id]; }
    });
    if (!flownOnceRef.current && positioned.length > 0) {
      flownOnceRef.current = true;
      const group = L.featureGroup(Object.values(salesmanMarkersRef.current));
      map.fitBounds(group.getBounds().pad(0.4), { maxZoom: 14 });
    }
  }, [salesmen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set();
    const positionedLeads = leads.filter((l) => l.lat != null && l.lng != null);
    positionedLeads.forEach((l) => {
      seen.add(l.id);
      const existing = leadMarkersRef.current[l.id];
      if (existing) {
        existing.setLatLng([l.lat, l.lng]);
        existing.setIcon(leadIcon(l));
      } else {
        const marker = L.marker([l.lat, l.lng], { icon: leadIcon(l) }).addTo(map);
        marker.on("click", () => onSelectLeadRef.current(l));
        marker.bindTooltip(l.business, { direction: "top", offset: [0, -6] });
        leadMarkersRef.current[l.id] = marker;
      }
    });
    Object.keys(leadMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) { leadMarkersRef.current[id].remove(); delete leadMarkersRef.current[id]; }
    });
  }, [leads]);

  return (
    <div className="ft-card" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: subtitle ? 2 : 8 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</div>
        {!subtitle && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.verified, fontFamily: "'IBM Plex Mono', monospace" }}><Radio size={12} /> LIVE</div>}
      </div>
      {subtitle && <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 8 }}>{subtitle}</div>}
      <div ref={containerRef} style={{ width: "100%", height: subtitle ? 460 : 360, borderRadius: 8, overflow: "hidden" }} />
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 11, color: T.inkSoft }}>
        {salesmen.length > 0 && <LegendDot color={T.route} label="Salesman (online)" />}
        <LegendDot color={T.verified} label="Verified lead" />
        <LegendDot color={T.warn} label="Poor accuracy" />
        <LegendDot color={T.danger} label="Unverified" />
      </div>
      <div style={{ fontSize: 10.5, color: "#9AA5B1", marginTop: 6 }}>Live map data © OpenStreetMap contributors — free, no API key.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN — real data: fetches roster/leads/summary, keeps a WebSocket open
// for instant pushes (new leads, live location, status changes), and falls
// back to a periodic refetch as a safety net if the socket drops.
// ---------------------------------------------------------------------------
function AdminApp({ session, online }) {
  const [salesmen, setSalesmen] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      const [salesmenRes, leadsRes] = await Promise.all([api.adminSalesmen(), api.adminLeads()]);
      setSalesmen((salesmenRes.salesmen || []).map(mapSalesmanRow));
      setLeads((leadsRes.leads || []).map(mapLeadRow));
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Periodic safety-net refetch (covers any missed WS events / a dropped socket)
  useEffect(() => {
    if (!online) return;
    const iv = setInterval(loadAll, 15000);
    return () => clearInterval(iv);
  }, [online, loadAll]);

  // WebSocket for instant pushes
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    let retryTimer = null;

    const connect = () => {
      if (cancelled) return;
      const wsBase = getWsBase();
      if (!wsBase) return;
      const ws = new WebSocket(`${wsBase}/realtime/admin?token=${encodeURIComponent(session.token)}`);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        if (!cancelled) retryTimer = setTimeout(connect, 4000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg.type === "location_update" || msg.type === "salesman_status") {
          const s = msg.salesman;
          setSalesmen((prev) => prev.map((p) => (p.id === s.id ? {
            ...p,
            lat: s.lat != null ? s.lat : p.lat,
            lng: s.lng != null ? s.lng : p.lng,
            battery: s.batteryPct != null ? s.batteryPct : p.battery,
            speed: s.speedMps != null ? s.speedMps * 3.6 : p.speed,
            status: s.status || p.status,
            lastUpdate: s.lastSeenAt ? new Date(s.lastSeenAt) : p.lastUpdate,
          } : p)));
        } else if (msg.type === "new_lead") {
          setLeads((prev) => (prev.some((l) => l.id === msg.lead.id) ? prev : [mapLeadRow(msg.lead), ...prev]));
        } else if (msg.type === "lead_status_changed") {
          setLeads((prev) => prev.map((l) => (l.id === msg.leadId ? { ...l, status: msg.status } : l)));
        }
      };
    };
    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [online, session.token]);

  const onStatusChange = async (id, status) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l))); // optimistic
    try {
      await api.adminUpdateLeadStatus(id, status);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't update status.");
      loadAll(); // revert to server truth
    }
  };

  const onUpdateLead = async (id, payload) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? {
      ...l,
      subLocation: payload.subLocation, posName: payload.posName,
      renewalMonth: payload.renewalMonth, renewalDate: payload.renewalDate || "",
      owner: payload.contactName, phone: payload.phone, notes: payload.notes,
    } : l))); // optimistic
    try {
      await api.adminUpdateLead(id, payload);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't save changes.");
      loadAll();
    }
  };

  const onDeleteLead = async (id) => {
    setLeads((prev) => prev.filter((l) => l.id !== id)); // optimistic
    try {
      await api.adminDeleteLead(id);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't delete the lead.");
      loadAll(); // revert to server truth if the delete actually failed
    }
  };

  const onAddSalesman = async (payload) => {
    await api.adminCreateSalesman(payload);
    await loadAll();
  };

  const onToggleSalesmanActive = async (id, nextIsActive) => {
    setSalesmen((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: nextIsActive } : s))); // optimistic
    try {
      await api.adminUpdateSalesman(id, { isActive: nextIsActive });
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't update salesman.");
      loadAll();
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 60, color: T.inkSoft, fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Loading dashboard…
      </div>
    );
  }

  return (
    <AdminView
      salesmen={salesmen}
      leads={leads}
      onStatusChange={onStatusChange}
      onUpdateLead={onUpdateLead}
      onDeleteLead={onDeleteLead}
      onAddSalesman={onAddSalesman}
      onToggleSalesmanActive={onToggleSalesmanActive}
      loadError={loadError}
      wsConnected={wsConnected}
      online={online}
    />
  );
}

function AdminView({ salesmen, leads, onStatusChange, onUpdateLead, onDeleteLead, onAddSalesman, onToggleSalesmanActive, loadError, wsConnected, online }) {
  const [filterSalesman, setFilterSalesman] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [showAddSalesman, setShowAddSalesman] = useState(false);
  const [routeSalesman, setRouteSalesman] = useState(null);
  const [mapView, setMapView] = useState("live"); // "live" | "leads"
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");

  const todayLeads = leads.filter((l) => Date.now() - l.createdAt.getTime() < 24 * 3600000);
  const converted = leads.filter((l) => l.status === "won").length;
  const pending = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
  const activeSalesmen = salesmen.filter((s) => s.status === "online").length;

  const filteredLeads = leads.filter(
    (l) =>
      (filterSalesman === "all" || l.salesmanId === filterSalesman) &&
      (filterStatus === "all" || l.status === filterStatus) &&
      (!filterDate || l.createdAt.toISOString().slice(0, 10) === filterDate)
  );

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1180, margin: "0 auto" }}>
      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}
      {online && !wsConnected && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.warn, background: T.warnSoft, borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
          <RefreshCw size={12} className="spin" /> Reconnecting live updates… data still refreshes every 15s in the meantime.
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Total Salesmen" value={salesmen.length} />
        <StatCard label="Active Now" value={activeSalesmen} color={T.verified} />
        <StatCard label="Leads Today" value={todayLeads.length} />
        <StatCard label="Total Leads" value={leads.length} />
        <StatCard label="Converted" value={converted} color={T.verified} />
        <StatCard label="Pending" value={pending} color={T.warn} />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Tab active={mapView === "live"} onClick={() => setMapView("live")} label="Live Map" />
        <Tab active={mapView === "leads"} onClick={() => setMapView("leads")} label="Lead Locations" />
      </div>

      {mapView === "live" ? (
        <div className="ft-dashboard-grid">
          <LiveMap salesmen={salesmen} leads={leads} onSelectLead={setSelectedLead} />
          <SalesmenPanel salesmen={salesmen} onAddClick={() => setShowAddSalesman(true)} onToggleActive={onToggleSalesmanActive} onViewRoute={setRouteSalesman} />
        </div>
      ) : (
        <LiveMap salesmen={[]} leads={filteredLeads} onSelectLead={setSelectedLead} title="Lead Locations" subtitle="Respects the salesman/status/date filters below" />
      )}

      <div className="ft-card" style={{ marginTop: 20, background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Leads</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Select value={filterSalesman} onChange={setFilterSalesman} options={[["all", "All salesmen"], ...salesmen.map((s) => [s.id, s.name])]} />
            <Select value={filterStatus} onChange={setFilterStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 8px", fontSize: 12.5, fontFamily: "Inter, sans-serif", background: "#fff", color: T.ink }}
            />
            {filterDate && (
              <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}>
                Clear date
              </button>
            )}
            <ExportButton
              label="CSV"
              onClick={() => window.open(buildExportUrl("csv", { salesmanId: filterSalesman, status: filterStatus, date: filterDate }), "_blank")}
            />
            <ExportButton
              label="Excel"
              onClick={() => window.open(buildExportUrl("xlsx", { salesmanId: filterSalesman, status: filterStatus, date: filterDate }), "_blank")}
            />
            <ExportButton
              label="Google Sheets"
              onClick={async () => {
                setSheetsError("");
                try {
                  const info = await api.adminExportSheetsInfo({ salesmanId: filterSalesman, status: filterStatus, date: filterDate });
                  setSheetsInfo(info);
                } catch (err) {
                  setSheetsError(err.message || "Couldn't prepare the Sheets export.");
                }
              }}
            />
          </div>
        </div>
        {sheetsError && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{sheetsError}</div>}
        {sheetsInfo && (
          <div style={{ fontSize: 12, background: T.paperDeep, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            No Google account is connected, so this can't push directly into a Sheet — but you can pull it in live:
            open a new Google Sheet, put this formula in cell A1, and re-enter it anytime to refresh:
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 8px", marginTop: 6, wordBreak: "break-all" }}>
              {sheetsInfo.importFormula}
            </div>
            <button onClick={() => { navigator.clipboard?.writeText(sheetsInfo.importFormula); }} style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Copy formula
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredLeads.map((l) => (
            <div key={l.id} className="ft-row" onClick={() => setSelectedLead(l)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 8, cursor: "pointer", background: "#fff" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{l.business}</div>
                <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {l.salesmanName} · {fmtTime(l.createdAt)}{l.hasLocation ? ` · ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />}
                <span style={{ fontSize: 12, fontWeight: 600, color: T.route, background: "#EAF0FB", padding: "3px 9px", borderRadius: 5 }}>{STATUS_LABEL[l.status]}</span>
              </div>
            </div>
          ))}
          {filteredLeads.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "36px 8px" }}>
              <List size={22} style={{ opacity: 0.5 }} />
              No leads match these filters.
            </div>
          )}
        </div>
      </div>

      {selectedLead && <LeadDetailDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} onStatusChange={onStatusChange} onUpdate={onUpdateLead} onDelete={onDeleteLead} />}
      {routeSalesman && <SalesmanRouteModal salesman={routeSalesman} onClose={() => setRouteSalesman(null)} />}
      {showAddSalesman && (
        <AddSalesmanModal
          existingCount={salesmen.length}
          onClose={() => setShowAddSalesman(false)}
          onSubmit={async (s) => { await onAddSalesman(s); setShowAddSalesman(false); }}
        />
      )}
    </div>
  );
}

function SalesmenPanel({ salesmen, onAddClick, onToggleActive, onViewRoute }) {
  return (
    <div className="ft-card" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Salesmen</div>
        <button onClick={onAddClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: T.route, color: "#fff", fontWeight: 700, fontSize: 12 }}>
          <Plus size={13} /> Add Salesman
        </button>
      </div>
      {salesmen.length === 0 && <div style={{ fontSize: 12.5, color: T.inkSoft }}>No salesmen yet — add your first one.</div>}
      {salesmen.map((s) => (
        <div key={s.id} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, background: "#fff", opacity: s.isActive === false ? 0.55 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                background: s.isActive === false ? "#EEE" : s.status === "online" ? T.verifiedSoft : "#EEE",
                color: s.isActive === false ? "#888" : s.status === "online" ? T.verified : "#888",
              }}>
                {s.isActive === false ? "DEACTIVATED" : s.status === "online" ? "ONLINE" : "OFFLINE"}
              </span>
              <button
                onClick={() => onToggleActive(s.id, s.isActive === false)}
                title={s.isActive === false ? "Reactivate" : "Deactivate"}
                style={{ fontSize: 10.5, fontWeight: 600, border: `1px solid ${T.line}`, background: "#fff", color: T.inkSoft, borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
              >
                {s.isActive === false ? "Reactivate" : "Deactivate"}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{s.area}{s.employeeCode ? ` · ${s.employeeCode}` : ""}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Battery size={12} /> {s.battery != null ? `${Math.round(s.battery)}%` : "—"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Gauge size={12} /> {s.speed.toFixed(1)} km/h</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={12} /> {fmtTime(s.lastUpdate)}</span>
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{(s.distanceM / 1000).toFixed(1)} km travelled today</div>
          <button
            onClick={() => onViewRoute(s)}
            style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 11.5, fontWeight: 700, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Route size={12} /> View route
          </button>
        </div>
      ))}
    </div>
  );
}

// Draws a salesman's GPS trail for a chosen day: a polyline through every
// location ping, start/end markers, and that day's lead pins along the way.
function SalesmanRouteModal({ salesman, onClose }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    api.adminSalesmanHistory(salesman.id, date)
      .then((res) => setData(res))
      .catch((err) => setError(err.message || "Couldn't load the route for this day."))
      .finally(() => setLoading(false));
  }, [salesman.id, date]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [26.847, 80.975], zoom: 12, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    // Leaflet needs a nudge to size correctly inside a modal that just mounted.
    setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const points = data.route.map((p) => [p.latitude, p.longitude]);
    if (points.length > 0) {
      L.polyline(points, { color: T.route, weight: 3, opacity: 0.75 }).addTo(group);
      L.circleMarker(points[0], { radius: 7, color: "#fff", weight: 2, fillColor: T.verified, fillOpacity: 1 })
        .bindTooltip("Start", { permanent: false }).addTo(group);
      L.circleMarker(points[points.length - 1], { radius: 7, color: "#fff", weight: 2, fillColor: T.danger, fillOpacity: 1 })
        .bindTooltip("Last known", { permanent: false }).addTo(group);
    }

    data.leads.forEach((l) => {
      if (l.latitude == null || l.longitude == null) return;
      L.marker([l.latitude, l.longitude], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;border-radius:50%;background:${l.verification_status === "verified" ? T.verified : T.warn};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`,
          iconSize: [12, 12], iconAnchor: [6, 6],
        }),
      }).bindTooltip(l.business_name, { direction: "top", offset: [0, -6] }).addTo(group);
    });

    const allPoints = [...points, ...data.leads.filter((l) => l.latitude != null).map((l) => [l.latitude, l.longitude])];
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 15 });
    }
  }, [data]);

  return (
    <Overlay onClose={onClose} title={`${salesman.name}'s Route`}>
      <div style={{ marginBottom: 12 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </div>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <div ref={containerRef} style={{ width: "100%", height: 320, borderRadius: 8, background: T.paperDeep }} />
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.inkSoft, marginTop: 8 }}>
          <Loader2 size={13} className="spin" /> Loading route…
        </div>
      )}
      {!loading && data && data.route.length === 0 && (
        <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 10 }}>No location pings recorded for this day.</div>
      )}
      {!loading && data && data.route.length > 0 && (
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span><span style={{ color: T.verified, fontWeight: 700 }}>●</span> Start ({fmtTime(new Date(data.route[0].captured_at))})</span>
          <span><span style={{ color: T.danger, fontWeight: 700 }}>●</span> Last known ({fmtTime(new Date(data.route[data.route.length - 1].captured_at))})</span>
          <span>{data.leads.length} lead{data.leads.length === 1 ? "" : "s"} that day</span>
        </div>
      )}
    </Overlay>
  );
}

function AddSalesmanModal({ existingCount, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", phone: "", password: "", area: "", employeeCode: "", dailyTarget: "8" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSubmit = form.name.trim().length > 0 && form.phone.trim().length > 0 && form.password.length >= 6;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        fullName: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
        employeeCode: form.employeeCode.trim() || `EMP-${1000 + existingCount + 1}`,
        dailyTarget: Number(form.dailyTarget) || 8,
        area: form.area.trim() || null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create salesman.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose} title="Add Salesman">
      <div style={{ fontSize: 12, color: T.inkSoft, background: T.paperDeep, borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
        They'll show up as <strong>OFFLINE</strong> on the map until they install FieldTrail, sign in with this phone + password, and tap Start Day.
      </div>
      <Field label="Full name *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="e.g. Priya Sharma" /></Field>
      <Field label="Phone number * (their login)"><input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="10-digit phone" inputMode="tel" /></Field>
      <Field label="Password * (min 6 characters, share with them securely)"><input style={inputStyle} type="text" value={form.password} onChange={set("password")} placeholder="Set an initial password" /></Field>
      <Field label="Area / territory"><input style={inputStyle} value={form.area} onChange={set("area")} placeholder="e.g. Alambagh" /></Field>
      <Field label="Employee code"><input style={inputStyle} value={form.employeeCode} onChange={set("employeeCode")} placeholder="Auto-generated if left blank" /></Field>
      <Field label="Daily lead target"><input style={inputStyle} type="number" min="1" value={form.dailyTarget} onChange={set("dailyTarget")} /></Field>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <button
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: canSubmit ? "pointer" : "not-allowed", background: canSubmit ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {submitting && <Loader2 size={16} className="spin" />}
        {submitting ? "Creating…" : "Create Salesman"}
      </button>
    </Overlay>
  );
}

// Shared between Admin and Salesman — the fields shown adapt automatically
// to whatever the lead actually has (nullable GPS when Location Settings
// have GPS off, optional sub-location/POS/renewal fields, etc).
function LeadDetailDrawer({ lead, onClose, onStatusChange, onUpdate, onDelete }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    subLocation: lead.subLocation || "", posName: lead.posName || "",
    renewalMonth: lead.renewalMonth || "", renewalDate: lead.renewalDate || "",
    owner: lead.owner || "", phone: lead.phone || "", notes: lead.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveEdit = async () => {
    setSaving(true);
    await onUpdate(lead.id, {
      subLocation: form.subLocation, posName: form.posName,
      renewalMonth: form.renewalMonth, renewalDate: form.renewalDate || null,
      contactName: form.owner, phone: form.phone, notes: form.notes,
    });
    setSaving(false);
    setEditing(false);
  };

  const detailRows = [
    ["Business Name", lead.business],
    ["Sub Location", lead.subLocation],
    ["POS Name", lead.posName],
    ["Renewal Month", lead.renewalMonth],
    ["Renewal Date", lead.renewalDate],
    ["Contact Name", lead.owner],
    ["Contact Number", lead.phone],
  ].filter(([, v]) => v);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,36,48,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 2000 }} onClick={onClose}>
      <div style={{ width: 380, maxWidth: "90vw", background: T.card, height: "100%", padding: 20, overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19 }}>{lead.business}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onUpdate && !editing && (
              <button onClick={() => setEditing(true)} style={{ border: "none", background: "none", cursor: "pointer", color: T.route, fontSize: 12.5, fontWeight: 700 }}>Edit</button>
            )}
            <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}><X size={18} /></button>
          </div>
        </div>
        <div style={{ marginTop: 4, color: T.inkSoft, fontSize: 13 }}>{lead.owner} · {lead.category}</div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {lead.hasLocation ? <VerificationStamp status={lead.verification} /> : <NoLocationBadge />}
          <SyncBadge syncStatus={lead.syncStatus} />
        </div>

        {editing ? (
          <div style={{ marginTop: 16 }}>
            <Field label="Sub Location"><input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} /></Field>
            <Field label="POS Name"><input style={inputStyle} value={form.posName} onChange={set("posName")} /></Field>
            <Field label="Contact Name"><input style={inputStyle} value={form.owner} onChange={set("owner")} /></Field>
            <Field label="Contact Number"><input style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Renewal Month"><input style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")} /></Field></div>
              <div style={{ flex: 1 }}><Field label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></Field></div>
            </div>
            <Field label="Comments"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: T.route, color: "#fff", fontWeight: 700, cursor: "pointer" }}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 16, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 12 }}>
              {detailRows.map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 }}>
                  <span style={{ color: T.inkSoft }}>{label}</span>
                  <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 }}>
                <span style={{ color: T.inkSoft }}>Created</span>
                <span style={{ fontWeight: 600 }}>{lead.createdAt.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {lead.hasLocation ? (
              <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>
                <div>lat: {lead.lat.toFixed(6)}</div>
                <div>lng: {lead.lng.toFixed(6)}</div>
                <div>accuracy: ±{lead.accuracy} m</div>
              </div>
            ) : (
              <div style={{ marginTop: 12, fontSize: 12, color: T.inkSoft, background: T.paperDeep, borderRadius: 8, padding: "8px 10px" }}>
                No location captured for this lead.
              </div>
            )}

            {lead.notes && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 600, letterSpacing: 0.3 }}>Comments</div>
                <div style={{ fontSize: 13.5, marginTop: 4 }}>{lead.notes}</div>
              </div>
            )}
          </>
        )}

        {onStatusChange && !editing && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 600, letterSpacing: 0.3, marginBottom: 6 }}>Update status</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATUSES.map((s) => (
                <button key={s} onClick={() => onStatusChange(lead.id, s)} style={{ fontSize: 11.5, padding: "5px 9px", borderRadius: 6, cursor: "pointer", border: `1px solid ${lead.status === s ? T.route : T.line}`, background: lead.status === s ? T.route : "#fff", color: lead.status === s ? "#fff" : T.ink, fontWeight: 600 }}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
          </div>
        )}

        {onDelete && !editing && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
            {confirmingDelete ? (
              <div style={{ background: T.dangerSoft, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>
                  Delete this lead permanently? This can't be undone.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirmingDelete(false)} style={{ flex: 1, padding: 9, borderRadius: 7, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => { onDelete(lead.id); onClose(); }} style={{ flex: 1, padding: 9, borderRadius: 7, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} style={{ fontSize: 12.5, fontWeight: 700, color: T.danger, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Delete lead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



// ---------------------------------------------------------------------------
// SALESMAN — real day start/end, a throttled real-GPS ping loop while the
// day is active, and an offline lead queue that actually retries against
// the server (backend dedupes on client_uuid, so retries are always safe).
// ---------------------------------------------------------------------------
const PING_MIN_INTERVAL_MS = 12000;

function SalesmanApp({ session, online }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dayStarted, setDayStartedState] = useState(getDayStarted(session.id));
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | tracking | denied | unavailable
  const [queuedCount, setQueuedCount] = useState(getQueuedLeads().length);
  const [continuousTracking, setContinuousTracking] = useState(true); // safe default until settings load
  const lastPingSentRef = useRef(0);

  useEffect(() => {
    api.salesmanGetSettings()
      .then((res) => setContinuousTracking(res.locationSettings?.continuousGpsTracking ?? true))
      .catch(() => { /* keep default on failure */ });
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const res = await api.salesmanLeads();
      setLeads((res.leads || []).map((r) => mapLeadRow({ ...r, salesman_name: session.fullName })));
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your leads.");
    } finally {
      setLoading(false);
    }
  }, [session.fullName]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const getBatteryPct = useCallback(async () => {
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        return Math.round(b.level * 100);
      }
    } catch { /* not supported (iOS Safari etc.) */ }
    return null;
  }, []);

  // Real GPS tracking loop while the day is active.
  useEffect(() => {
    if (!dayStarted) { setGpsStatus("idle"); return; }
    if (!continuousTracking) { setGpsStatus("idle"); return; } // Continuous GPS Tracking turned off in settings
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsStatus("tracking");
        const now = Date.now();
        if (now - lastPingSentRef.current < PING_MIN_INTERVAL_MS) return; // throttle
        lastPingSentRef.current = now;
        const { latitude: lat, longitude: lng, speed, accuracy } = pos.coords;
        const batteryPct = await getBatteryPct();
        try {
          await api.salesmanPing({
            lat, lng,
            accuracyM: Math.round(accuracy),
            speedMps: speed || 0,
            batteryPct,
            isMockSuspected: false,
            capturedAt: new Date().toISOString(),
          });
        } catch {
          // A missed ping isn't fatal — the next watchPosition fix will retry.
        }
      },
      (err) => setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [dayStarted, continuousTracking, getBatteryPct]);

  // Flush the offline lead queue whenever we're online.
  const flushQueue = useCallback(async () => {
    const queue = getQueuedLeads();
    if (queue.length === 0) return;
    for (const payload of queue) {
      try {
        const res = await api.salesmanCreateLead(payload);
        removeQueuedLead(payload.clientUuid);
        setLeads((prev) => prev.map((l) => (l.clientUuid === payload.clientUuid ? mapLeadRow({ ...res.lead, salesman_name: session.fullName }) : l)));
      } catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 0) {
          // Rejected by the server (not just offline) — drop it so it doesn't loop forever silently.
          removeQueuedLead(payload.clientUuid);
        }
        break; // stop on first failure this round; try the rest next time
      }
    }
    setQueuedCount(getQueuedLeads().length);
  }, [session.fullName]);

  useEffect(() => {
    if (online) flushQueue();
  }, [online, flushQueue]);
  useEffect(() => {
    if (!online) return;
    const iv = setInterval(flushQueue, 20000);
    return () => clearInterval(iv);
  }, [online, flushQueue]);

  const getCurrentPositionAsync = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("unavailable"));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
    });

  const handleToggleDay = async () => {
    try {
      const pos = await getCurrentPositionAsync().catch(() => null);
      const lat = pos?.coords.latitude;
      const lng = pos?.coords.longitude;
      if (dayStarted) {
        await api.salesmanDayEnd(lat, lng);
        setDayStartedFlag(session.id, false);
        setDayStartedState(false);
      } else {
        await api.salesmanDayStart(lat, lng);
        setDayStartedFlag(session.id, true);
        setDayStartedState(true);
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
    }
  };

  const handleAddLead = async (payload) => {
    if (online) {
      try {
        const res = await api.salesmanCreateLead(payload);
        const mapped = mapLeadRow({ ...res.lead, salesman_name: session.fullName });
        setLeads((prev) => [mapped, ...prev]);
        return { ok: true, lead: mapped };
      } catch (err) {
        if (!(err instanceof ApiError) || err.status === 0) {
          // Network-level failure even though `online` said true (flaky connection) — queue it.
          pushQueuedLead(payload);
          setQueuedCount(getQueuedLeads().length);
          const queued = { ...adHocLeadFromPayload(payload, session), syncStatus: "queued" };
          setLeads((prev) => [queued, ...prev]);
          return { ok: true, lead: queued };
        }
        return { ok: false, error: err.message };
      }
    } else {
      pushQueuedLead(payload);
      setQueuedCount(getQueuedLeads().length);
      const queued = { ...adHocLeadFromPayload(payload, session), syncStatus: "queued" };
      setLeads((prev) => [queued, ...prev]);
      return { ok: true, lead: queued };
    }
  };

  const handleUpdateLeadStatus = async (id, status) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l))); // optimistic
    try {
      await api.salesmanUpdateLead(id, { status });
    } catch {
      /* left optimistic on failure — background refetch will reconcile */
    }
  };

  const handleUpdateLeadDetails = async (id, payload) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? {
      ...l,
      subLocation: payload.subLocation, posName: payload.posName,
      renewalMonth: payload.renewalMonth, renewalDate: payload.renewalDate || "",
      owner: payload.contactName, phone: payload.phone, notes: payload.notes,
    } : l))); // optimistic
    try {
      await api.salesmanUpdateLead(id, payload);
    } catch {
      /* left optimistic on failure */
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 60, color: T.inkSoft, fontSize: 13 }}>
        <Loader2 size={16} className="spin" /> Loading your leads…
      </div>
    );
  }

  return (
    <SalesmanView
      session={session}
      leads={leads}
      dayStarted={dayStarted}
      onToggleDay={handleToggleDay}
      onAddLead={handleAddLead}
      onUpdateLeadStatus={handleUpdateLeadStatus}
      onUpdateLeadDetails={handleUpdateLeadDetails}
      online={online}
      gpsStatus={gpsStatus}
      queuedCount={queuedCount}
      loadError={loadError}
    />
  );
}

function adHocLeadFromPayload(payload, session) {
  const hasLocation = payload.lat != null && payload.lng != null;
  return {
    id: payload.clientUuid,
    clientUuid: payload.clientUuid,
    salesmanId: session.id,
    salesmanName: session.fullName,
    business: payload.businessName,
    subLocation: payload.subLocation || "",
    posName: payload.posName || "",
    renewalMonth: payload.renewalMonth || "",
    renewalDate: payload.renewalDate || "",
    owner: payload.contactName,
    phone: payload.phone,
    category: payload.category,
    status: payload.status || "new",
    hasLocation,
    lat: hasLocation ? payload.lat : null,
    lng: hasLocation ? payload.lng : null,
    accuracy: payload.accuracyM,
    verification: hasLocation ? (payload.accuracyM > 50 ? "poor_accuracy" : "verified") : null,
    createdAt: new Date(),
    notes: payload.notes || "",
  };
}

function SalesmanView({ session, leads, dayStarted, onToggleDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError }) {
  const [showAddLead, setShowAddLead] = useState(false);
  const [showMyLeads, setShowMyLeads] = useState(false);
  const [viewingLead, setViewingLead] = useState(null);
  const [showTodayLeads, setShowTodayLeads] = useState(false);

  const todayLeads = leads.filter((l) => Date.now() - l.createdAt.getTime() < 24 * 3600000);
  const converted = leads.filter((l) => l.status === "won").length;
  const pending = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
  const target = 8;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "18px 16px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>{session.fullName}</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>{session.phone}</div>
        </div>
        <button onClick={onToggleDay} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "none", cursor: "pointer", background: dayStarted ? T.dangerSoft : T.verifiedSoft, color: dayStarted ? T.danger : T.verified, fontWeight: 700, fontSize: 13 }}>
          {dayStarted ? <Square size={14} /> : <Play size={14} />}
          {dayStarted ? "End Day" : "Start Day"}
        </button>
      </div>

      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {(!online || queuedCount > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.warn, background: T.warnSoft, padding: "9px 12px", borderRadius: 8, marginBottom: 14 }}>
          <WifiOff size={14} />
          {!online
            ? "No connection — leads you capture now are saved on this device and will sync automatically once you're back online."
            : `Syncing ${queuedCount} queued lead${queuedCount === 1 ? "" : "s"}…`}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <StatCard label="Today's Leads" value={todayLeads.length} onClick={() => setShowTodayLeads(true)} />
        <StatCard label="Pending" value={pending} color={T.warn} />
        <StatCard label="Converted" value={converted} color={T.verified} />
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.inkSoft, marginBottom: 6 }}><span>Today's target</span><span>{Math.min(todayLeads.length, target)} / {target}</span></div>
        <div style={{ height: 8, background: T.paperDeep, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (todayLeads.length / target) * 100)}%`, background: T.route }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <BigButton icon={Plus} label="Add Lead" onClick={() => setShowAddLead(true)} primary disabled={!dayStarted} />
        <BigButton icon={List} label="My Leads" onClick={() => setShowMyLeads(true)} />
      </div>

      {!dayStarted && <div style={{ marginTop: 12, fontSize: 12, color: T.warn, background: T.warnSoft, padding: "8px 10px", borderRadius: 8 }}>Start your day to enable lead capture.</div>}

      {showAddLead && (
        <AddLeadModal
          session={session}
          online={online}
          onClose={() => setShowAddLead(false)}
          onSubmit={onAddLead}
          onSaved={(lead) => { setShowAddLead(false); setViewingLead(lead); }}
        />
      )}
      {showMyLeads && <MyLeadsModal leads={leads} onClose={() => setShowMyLeads(false)} onSelectLead={setViewingLead} />}
      {showTodayLeads && (
        <MyLeadsModal
          leads={todayLeads}
          title="Today's Leads"
          onClose={() => setShowTodayLeads(false)}
          onSelectLead={(l) => { setShowTodayLeads(false); setViewingLead(l); }}
        />
      )}
      {viewingLead && <LeadDetailDrawer lead={viewingLead} onClose={() => setViewingLead(null)} onStatusChange={onUpdateLeadStatus} onUpdate={onUpdateLeadDetails} />}
    </div>
  );
}

function BigButton({ icon: IconC, label, onClick, primary, disabled }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 10px", borderRadius: 12, border: `1px solid ${T.line}`, cursor: disabled ? "not-allowed" : "pointer", background: primary ? T.route : "#fff", color: primary ? "#fff" : T.ink, fontWeight: 700, fontSize: 14, opacity: disabled ? 0.5 : 1 }}>
      <IconC size={22} />{label}
    </button>
  );
}

const DEFAULT_LEAD_SETTINGS = {
  requireBusinessName: true, requireSubLocation: true, requirePosName: true,
  requireContactName: true, requireContactNumber: true, requireStatus: true, requireComments: false,
};
const DEFAULT_LOCATION_SETTINGS = { gpsLocation: true, locationMandatoryForNewLead: true, continuousGpsTracking: true };

function AddLeadModal({ session, online, onClose, onSubmit, onSaved }) {
  const [form, setForm] = useState({
    business: "", subLocation: "", posName: "", renewalMonth: "", renewalDate: "",
    owner: "", phone: "", category: "Cafe", status: "new", notes: "",
  });
  const [leadSettings, setLeadSettings] = useState(DEFAULT_LEAD_SETTINGS);
  const [locationSettings, setLocationSettings] = useState(DEFAULT_LOCATION_SETTINGS);
  const [gps, setGps] = useState({ state: "locating" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.salesmanGetSettings()
      .then((res) => {
        if (res.leadSettings) setLeadSettings(res.leadSettings);
        if (res.locationSettings) setLocationSettings(res.locationSettings);
        if (!res.locationSettings?.gpsLocation) {
          setGps({ state: "off" }); // GPS turned off entirely — don't even ask for it
        }
      })
      .catch(() => { /* keep defaults if settings can't be fetched */ });
  }, []);

  useEffect(() => {
    if (!locationSettings.gpsLocation) return; // respect Location Settings: GPS Location = OFF
    if (!navigator.geolocation) { setGps({ state: "unavailable" }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ state: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => setGps({ state: "denied" }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [locationSettings.gpsLocation]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const locationRequired = locationSettings.gpsLocation && locationSettings.locationMandatoryForNewLead;
  const locationReady = !locationSettings.gpsLocation || gps.state === "ok" || (!locationRequired && gps.state !== "locating");

  const canSubmit =
    form.business.trim().length > 0 &&
    (!leadSettings.requireSubLocation || form.subLocation.trim().length > 0) &&
    (!leadSettings.requirePosName || form.posName.trim().length > 0) &&
    (!leadSettings.requireContactName || form.owner.trim().length > 0) &&
    (!leadSettings.requireContactNumber || form.phone.trim().length > 0) &&
    (!leadSettings.requireComments || form.notes.trim().length > 0) &&
    locationReady;

  const verification = gps.state === "ok" ? (gps.accuracy > 50 ? "poor_accuracy" : "verified") : null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const hasGps = gps.state === "ok";
    const payload = {
      clientUuid: uuid(),
      businessName: form.business,
      subLocation: form.subLocation || null,
      posName: form.posName || null,
      renewalMonth: form.renewalMonth || null,
      renewalDate: form.renewalDate || null,
      contactName: form.owner,
      phone: form.phone,
      category: form.category,
      status: form.status,
      notes: form.notes,
      lat: hasGps ? gps.lat : null,
      lng: hasGps ? gps.lng : null,
      accuracyM: hasGps ? gps.accuracy : null,
      isMockSuspected: false,
      capturedAt: hasGps ? new Date().toISOString() : null,
      deviceId: getDeviceId(),
    };
    const result = await onSubmit(payload);
    setSubmitting(false);
    if (result.ok) onSaved(result.lead);
    else setError(result.error || "Couldn't save the lead — try again.");
  };

  return (
    <Overlay onClose={onClose} title="Add Lead">
      {!online && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.warn, background: T.warnSoft, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>
          <WifiOff size={13} /> Offline — this will save to your device and sync when reconnected.
        </div>
      )}

      {locationSettings.gpsLocation && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          <GpsStatus gps={gps} verification={verification} />
        </div>
      )}

      <Field label={`Business / Restaurant name${leadSettings.requireBusinessName ? " *" : ""}`}>
        <input style={inputStyle} value={form.business} onChange={set("business")} placeholder="e.g. Ganga Cafe" />
      </Field>
      <Field label={`Sub Location${leadSettings.requireSubLocation ? " *" : ""}`}>
        <input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} placeholder="e.g. Gomti Nagar" />
      </Field>
      <Field label={`POS Name${leadSettings.requirePosName ? " *" : ""}`}>
        <input style={inputStyle} value={form.posName} onChange={set("posName")} placeholder="Current POS/software being used" />
      </Field>
      <Field label={`Contact Name${leadSettings.requireContactName ? " *" : ""}`}>
        <input style={inputStyle} value={form.owner} onChange={set("owner")} />
      </Field>
      <Field label={`Contact Number${leadSettings.requireContactNumber ? " *" : ""}`}>
        <input style={inputStyle} value={form.phone} onChange={set("phone")} />
      </Field>
      <Field label="Category">
        <select style={inputStyle} value={form.category} onChange={set("category")}>
          {["Cafe", "QSR", "Casual Dining", "Fine Dining", "Cloud Kitchen", "Bakery"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      {leadSettings.requireStatus && (
        <Field label="Status *">
          <select style={inputStyle} value={form.status} onChange={set("status")}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Renewal Month"><input style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")} placeholder="e.g. March" /></Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></Field>
        </div>
      </div>
      <Field label={`Comments${leadSettings.requireComments ? " *" : ""}`}>
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} />
      </Field>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", border: `1px dashed ${T.line}`, borderRadius: 8, color: T.inkSoft, fontSize: 12.5, marginBottom: 14 }}>
        <Camera size={15} /> Photo capture — not wired up yet (backend accepts a photoUrl once you add upload storage).
      </div>

      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}

      <button
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: canSubmit ? "pointer" : "not-allowed", background: canSubmit ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {submitting && <Loader2 size={16} className="spin" />}
        {submitting ? "Saving…" : online ? "Save Lead" : "Save Lead (offline)"}
      </button>
    </Overlay>
  );
}

function GpsStatus({ gps, verification }) {
  if (gps.state === "locating") return <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.inkSoft }}><Navigation size={14} className="spin" /> Getting your current GPS location…</div>;
  if (gps.state !== "ok") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 8, padding: "8px 10px" }}>
        <AlertTriangle size={14} />
        {gps.state === "denied" ? "Location permission denied — allow it to capture a lead." : "GPS unavailable on this device/browser."}
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>Captured location</span>
        <VerificationStamp status={verification} small />
      </div>
      <div>lat: {gps.lat.toFixed(6)}</div>
      <div>lng: {gps.lng.toFixed(6)}</div>
      <div>accuracy: ±{gps.accuracy} m</div>
      <div style={{ color: "#9AA5B1", fontFamily: "Inter, sans-serif", marginTop: 4 }}>Locked — cannot be edited manually.</div>
    </div>
  );
}

function MyLeadsModal({ leads, onClose, onSelectLead, title = "My Leads" }) {
  return (
    <Overlay onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {leads.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "30px 8px" }}>
            <List size={22} style={{ opacity: 0.5 }} />
            No leads yet today — tap "Add Lead" to create one.
          </div>
        )}
        {leads.map((l) => (
          <div key={l.id} className="ft-row" onClick={() => onSelectLead(l)} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, background: "#fff", cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.business}</div>
              {l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />}
            </div>
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span>{STATUS_LABEL[l.status]} · {fmtTime(l.createdAt)}</span>
              <SyncBadge syncStatus={l.syncStatus} />
            </div>
          </div>
        ))}
      </div>
    </Overlay>
  );
}
