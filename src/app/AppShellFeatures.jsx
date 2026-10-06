import React from "react";
import DashboardDisplaySettingsControl from "../DashboardDisplaySettingsControl.jsx";

// Shared application shell/settings UI extracted from App.jsx without changing behavior.
export function createAppShellFeatures(deps) {
  const { useState, useEffect, useRef, useCallback, api, ApiError, getSession, T, DASHBOARD_DISPLAY_KEY, getDashboardDisplaySettings, mapSalesmanRow, AppMenu, Loader2, Gauge, BarChart3, Wallet, Bell, WifiOff, Settings, LogOut, Download, RefreshCw, X, Plus, CheckCircle2, AlertTriangle } = deps;

function LogoMark({ size = 20 }) {
  return (
    <img
      src="/engage-logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: "block", width: size, height: size, objectFit: "cover", borderRadius: Math.max(4, Math.round(size * 0.22)) }}
    />
  );
}

function TopBar({ hidePageNavigation = false, online, session, page, onChangePage, onAddExpense, onOpenSettings, onOpenOnboarding, onOpenCollections, onOpenDailyReports, onOpenQuotations, onOpenApprovals, onOpenNotifications, onOpenActivityCentre, unreadCount = 0 }) {
  const [narrow, setNarrow] = useState(window.innerWidth < 560);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 560);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className={hidePageNavigation ? "engage-desktop-topbar" : undefined} style={{ position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", paddingTop: "calc(14px + env(safe-area-inset-top))", background: hidePageNavigation ? "#F4F5F7" : "linear-gradient(135deg, #0F3D3E 0%, #145C5D 100%)", color: hidePageNavigation ? "#334155" : "#fff", borderBottom: hidePageNavigation ? "1px solid #E4E8EB" : undefined, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!hidePageNavigation && <>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#145C5D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <LogoMark size={16} color="#fff" />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: 0.2 }}>Engage</div>
          </>}
          {!narrow && session && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: hidePageNavigation ? "#64748B" : "rgba(255,255,255,0.65)", marginRight: 4 }}>
              {session.fullName} · {session.role}
            </div>
          )}

          {!hidePageNavigation && page && onChangePage && (
            <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.14)", borderRadius: 7, padding: 2, border: "1px solid rgba(255,255,255,0.22)" }}>
              <button
                onClick={() => onChangePage("dashboard")}
                style={{
                  display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 5, cursor: "pointer", border: "none",
                  background: page === "dashboard" ? "#fff" : "transparent", color: page === "dashboard" ? "#0F3D3E" : "rgba(255,255,255,0.75)",
                }}
              >
                {narrow ? <Gauge size={13} /> : "Dashboard"}
              </button>
              <button
                onClick={() => onChangePage("reports")}
                style={{
                  display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 5, cursor: "pointer", border: "none",
                  background: page === "reports" ? "#fff" : "transparent", color: page === "reports" ? "#0F3D3E" : "rgba(255,255,255,0.75)",
                }}
              >
                <BarChart3 size={13} /> {narrow ? "" : "Reports"}
              </button>
            </div>
          )}

          {onAddExpense && !(narrow && session?.role === "admin") && (
            <button
              onClick={onAddExpense}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: 7, cursor: "pointer", border: hidePageNavigation ? "1px solid #E4E8EB" : "1px solid rgba(255,255,255,0.22)", background: hidePageNavigation ? "#fff" : "rgba(255,255,255,0.14)", color: hidePageNavigation ? "#334155" : "#fff" }}
            >
              <Wallet size={13} /> {narrow ? "" : "Expenses"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConnectionPill online={online} />
          {onOpenNotifications && <button type="button" onClick={onOpenNotifications} title="Notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} className={session?.role === "salesman" ? "employee-notification-button" : undefined} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: hidePageNavigation ? "1px solid #E4E8EB" : "1px solid rgba(255,255,255,0.22)", cursor: "pointer", background: hidePageNavigation ? "#fff" : "rgba(255,255,255,0.14)", color: hidePageNavigation ? "#334155" : "#fff" }}><Bell size={14} />{unreadCount > 0 && <span className="ft-notification-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>}
          {session?.role !== "salesman" && <AppMenu onExpenses={narrow && session?.role === "admin" ? onAddExpense : undefined} onCollections={onOpenCollections} signedIn={!!session} role={session?.role} onSettings={onOpenSettings} onOnboarding={onOpenOnboarding} onQuotations={onOpenQuotations} onApprovals={onOpenApprovals} onDailyReports={undefined} onActivityCentre={onOpenActivityCentre} />}
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
        <div style={{ width: 52, height: 52, borderRadius: 12, background: "#145C5D", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <LogoMark size={26} color="#fff" />
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>Connect Engage</div>
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
        <div style={{ fontSize: 12, color: T.warn, background: T.warnSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>
          {error}
          <button onClick={() => onSave(url.trim().replace(/\/+$/, ""))} style={{ display: "block", marginTop: 6, background: "none", border: "none", color: T.route, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12 }}>
            Save anyway
          </button>
        </div>
      )}
      <button
        onClick={handleConnect}
        disabled={!url.trim() || checking}
        style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: url.trim() ? "pointer" : "not-allowed", background: url.trim() ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {checking && <Loader2 size={16} className="spin" />}
        {checking ? "Checking…" : "Connect"}
      </button>
    </div>
  );
}

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
        <div style={{ width: 52, height: 52, borderRadius: 12, background: "#145C5D", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <LogoMark size={26} color="#fff" />
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>Sign in</div>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 6, fontFamily: "'IBM Plex Mono', monospace" }}>{apiBase}</div>
      </div>

      {!online && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.warn, background: T.warnSoft, padding: "9px 12px", borderRadius: 11, marginBottom: 14 }}>
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
          <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={!phone.trim() || !password || loading}
          style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: "pointer", background: T.route, color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: !phone.trim() || !password ? 0.6 : 1 }}
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

function SettingsModal({ onClose, onLogout, onOpenCrmSettings, onOpenDataHealth, onOpenOnboardingSettings, onOpenQuotationSettings, canInstall, installed, promptInstall, push }) {
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const [showIosHint, setShowIosHint] = useState(false);

  const isAdmin = getSession()?.role === "admin";
  const PREF_GROUPS = isAdmin ? [
    ["Lead Activity", [["hotLead","🔥 Hot leads"],["statusConversation","Conversation status"],["statusDemo","Demo status"],["statusNegotiation","Negotiation status"]]],
    ["Sales", [["dealWon","Deal Won"],["targetMilestone","Target Milestone"]]],
    ["Team Activity", [["dayStartedEnded","Day Started / Ended"],["dayClosingMissing","Day Closing Missing"],["dayActivitySummary","Day Activity Summary"]]],
    ["Reminders", [["renewalDue","Renewals due"],["followUpDue","Follow-ups due"],["dayStartDigest","Day-start report (~1pm)"],["salesBriefing","Daily sales briefing"]]],
  ] : [["Notifications", [["hotLead","🔥 Hot leads"],["statusConversation","Conversation status"],["statusNegotiation","Negotiation status"],["statusDemo","Demo status"],["renewalDue","Renewals due"],["followUpDue","Follow-ups due"],["dayStartDigest","Day-start report (~1pm)"],["salesBriefing","Daily sales briefing"]]]];

  return (
    <Overlay onClose={onClose} title="Settings">
      {!installed && (
        <div style={{ marginBottom: 18 }}>
          <button
            onClick={() => (canInstall ? promptInstall() : setShowIosHint((v) => !v))}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 11, border: `1px solid ${T.line}`, cursor: "pointer", background: T.paperDeep, color: T.ink, fontWeight: 700, fontSize: 13.5 }}
          >
            <Download size={14} /> Install as an app
          </button>
          {showIosHint && isIos && !canInstall && (
            <div style={{ marginTop: 8, background: T.paperDeep, borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.5, color: T.inkSoft }}>
              On iPhone/iPad: tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen."</strong>
            </div>
          )}
        </div>
      )}

      {onOpenQuotationSettings && <button type="button" onClick={onOpenQuotationSettings} style={{width:"100%",padding:11,borderRadius:11,border:`1px solid ${T.line}`,background:T.paperDeep,color:T.ink,fontWeight:700,fontSize:13.5,marginBottom:12,cursor:"pointer"}}>Quotation settings</button>}
      {onOpenOnboardingSettings && <button type="button" onClick={onOpenOnboardingSettings} style={{width:"100%",padding:11,borderRadius:11,border:`1px solid ${T.line}`,background:T.paperDeep,color:T.ink,fontWeight:700,fontSize:13.5,marginBottom:18,cursor:"pointer"}}>Edit onboarding checklist</button>}
      {onOpenCrmSettings && (
        <button
          onClick={onOpenCrmSettings}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 11, border: `1px solid ${T.line}`, cursor: "pointer", background: T.paperDeep, color: T.ink, fontWeight: 700, fontSize: 13.5, marginBottom: 18 }}
        >
          <Settings size={14} /> CRM Settings
        </button>
      )}
      {onOpenDataHealth && (
        <button type="button" onClick={onOpenDataHealth} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 11, border: `1px solid ${T.line}`, cursor: "pointer", background: T.paperDeep, color: T.ink, fontWeight: 700, fontSize: 13.5, marginTop: -6, marginBottom: 18 }}>
          <CheckCircle2 size={14} /> Data Health
        </button>
      )}

      {push && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Notifications</div>
          {!push.supported ? (
            <div style={{ fontSize: 12, color: T.inkSoft, background: T.paperDeep, borderRadius: 10, padding: 12 }}>
              Push notifications aren't supported in this browser. On iPhone, install the app first (Add to Home Screen), then try again from there.
            </div>
          ) : push.checking ? (
            <div style={{ fontSize: 12, color: T.inkSoft }}>Checking…</div>
          ) : !push.subscribed ? (
            <button
              onClick={push.enable}
              disabled={push.busy}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", borderRadius: 11, border: `1px solid ${T.line}`, cursor: push.busy ? "default" : "pointer", background: T.paperDeep, color: T.ink, fontWeight: 700, fontSize: 13.5, opacity: push.busy ? 0.7 : 1 }}
            >
              <Bell size={14} /> {push.busy ? "Turning on…" : "Turn on push notifications"}
            </button>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {PREF_GROUPS.map(([group, rows]) => (
                  <div key={group}>
                    {isAdmin && <div style={{fontSize:10.5,fontWeight:800,color:T.inkSoft,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{group}</div>}
                    {rows.map(([key,label]) => (
                      <label key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 2px",cursor:"pointer"}}>
                        <span style={{fontSize:13}}>{label}</span>
                        <input type="checkbox" checked={!!push.preferences[key]} onChange={(e)=>push.setPreference(key,e.target.checked)} style={{width:18,height:18,accentColor:T.route,cursor:"pointer"}} />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <button
                onClick={push.disable}
                disabled={push.busy}
                style={{ width: "100%", marginTop: 10, padding: "9px", borderRadius: 10, border: `1px solid ${T.line}`, cursor: push.busy ? "default" : "pointer", background: "#fff", color: T.inkSoft, fontWeight: 600, fontSize: 12.5, opacity: push.busy ? 0.7 : 1 }}
              >
                {push.busy ? "Turning off…" : "Turn off notifications"}
              </button>
            </>
          )}
          {push.error && <div style={{ fontSize: 11.5, color: T.danger, marginTop: 8 }}>{push.error}</div>}
        </div>
      )}

      {onLogout && (
        <>
          <div style={{ height: 1, background: T.line, margin: "18px 0 14px" }} />
          <button
            onClick={onLogout}
            style={{ width: "100%", padding: "11px", borderRadius: 11, border: `1px solid ${T.dangerSoft}`, cursor: "pointer", background: "#fff", color: T.danger, fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <LogOut size={14} /> Log out
          </button>
        </>
      )}
    </Overlay>
  );
}

function StatCard({ label, value, sub, color, icon: IconC, onClick, comparison, comparisonPeriod, variant }) {
  const labelText = typeof label === "string" ? label : "";
  const salesmanKpi = ["Today", "Hot", "Conversation", "Negotiation", "Won", "Renewals"].includes(labelText);
  const c = color || T.ink;
  const dashboardCard = variant === "dashboard";

  if (dashboardCard) {
    return (
      <div
        className={`ft-card engage-dashboard-stat${onClick ? " ft-row" : ""}`}
        onClick={onClick}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        <div className="engage-dashboard-stat-header">
          <div className="engage-dashboard-stat-label">{label}</div>
          {IconC && (
            <div className="engage-dashboard-stat-icon" style={{ background: `${c}14`, color: c }} aria-hidden="true">
              <IconC size={16} />
            </div>
          )}
        </div>
        <div className="engage-dashboard-stat-value engage-db-value">{value}</div>
        {sub && <div className="engage-dashboard-stat-sub">{sub}</div>}
        {comparison && (
          <div
            className="engage-dashboard-stat-comparison"
            style={{ color: comparison.pct == null ? T.verified : comparison.pct > 0 ? T.verified : comparison.pct < 0 ? T.danger : T.inkSoft }}
          >
            {comparison.pct == null ? "↑ New" : comparison.pct > 0 ? `↑ ${comparison.pct}%` : comparison.pct < 0 ? `↓ ${Math.abs(comparison.pct)}%` : "— Same"}{" "}
            <span>vs last {comparisonPeriod === "monthly" ? "month" : "week"}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${onClick ? "ft-card ft-row" : "ft-card"}${salesmanKpi ? " engage-salesman-water-card" : ""}`} data-kpi={salesmanKpi ? labelText.toLowerCase() : undefined}
      onClick={onClick}
      style={{
        background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "14px 16px",
        minWidth: 96, flex: 1, cursor: onClick ? "pointer" : "default", overflow: "hidden",
        boxShadow: "0 1px 2px rgba(20,20,30,0.04)", transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.2, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        {IconC && (
          <div style={{ width: 24, height: 24, borderRadius: 8, background: `${c}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconC size={13} color={c} />
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, color: c }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2, overflowWrap: "break-word" }}>{sub}</div>}
      {comparison && <div style={{fontSize:9.8,marginTop:4,fontWeight:700,color:comparison.pct==null?T.verified:comparison.pct>0?T.verified:comparison.pct<0?T.danger:T.inkSoft,whiteSpace:"nowrap"}}>{comparison.pct==null?"↑ New":comparison.pct>0?`↑ ${comparison.pct}%`:comparison.pct<0?`↓ ${Math.abs(comparison.pct)}%`:"— Same"} <span style={{fontWeight:500,color:T.inkSoft}}>vs last {comparisonPeriod==="monthly"?"month":"week"}</span></div>}
    </div>
  );
}

function VerificationStamp({ status, small }) {
  const map = {
    verified: { label: "Verified", color: T.verified, bg: T.verifiedSoft, IconC: CheckCircle2 },
    poor_accuracy: { label: "Low accuracy", color: T.warn, bg: T.warnSoft, IconC: AlertTriangle },
    unverified: { label: "Unverified", color: T.danger, bg: T.dangerSoft, IconC: AlertTriangle },
  };
  const s = map[status] || map.unverified;
  const IconC = s.IconC;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, color: s.color, background: s.bg, borderRadius: 999, padding: small ? "3px 9px" : "5px 12px", fontFamily: "Inter, sans-serif", fontSize: small ? 10.5 : 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      <IconC size={small ? 11 : 13} />
      {s.label}
    </div>
  );
}

function SyncBadge({ syncStatus }) {
  if (syncStatus !== "queued") return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: T.warn, background: T.warnSoft, borderRadius: 999, padding: "3px 9px", fontFamily: "Inter, sans-serif", fontWeight: 700 }}>
      <RefreshCw size={10} /> Queued — will sync
    </div>
  );
}

function NoLocationBadge({ small }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.inkSoft, background: T.paperDeep, borderRadius: 999, padding: small ? "3px 9px" : "5px 12px", fontFamily: "Inter, sans-serif", fontSize: small ? 10.5 : 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      No location
    </div>
  );
}

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

const EXPENSE_CATEGORIES = ["Salary", "Travel", "Fuel", "Food", "Other"];

function AddExpenseModal({ onClose }) {
  const [salesmen, setSalesmen] = useState([]);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [salesmanId, setSalesmanId] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminSalesmen().then((res) => setSalesmen((res.salesmen || []).map(mapSalesmanRow))).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true);
    setError("");
    try {
      await api.adminCreateExpense({ category, amount: num, salesmanId: salesmanId || undefined, note: note.trim() || undefined, spentOn });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save that expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay title="Add expense" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Category</label>
        <Select value={category} onChange={setCategory} options={EXPENSE_CATEGORIES.map((c) => [c, c])} />

        <div style={{ height: 10 }} />
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Employee (optional)</label>
        <Select value={salesmanId} onChange={setSalesmanId} options={[["", "Not linked to an employee"], ...salesmen.map((s) => [s.id, s.name])]} />

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Amount</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={inputStyle} autoFocus />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Date</label>
            <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Note (optional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. September salary" style={inputStyle} />

        {error && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{error}</div>}
        <button
          type="submit" disabled={saving}
          style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: T.route, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save expense"}
        </button>
      </form>
    </Overlay>
  );
}

function CrmSettingsModal({ onClose }) {
  const [leadSettings, setLeadSettings] = useState(null);
  const [locationSettings, setLocationSettings] = useState(null);
  const [messageSettings, setMessageSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminGetSettings()
      .then((res) => { setLeadSettings(res.leadSettings); setLocationSettings(res.locationSettings); setMessageSettings(res.messageSettings || { employeeRepliesEnabled: true }); })
      .catch((err) => setError(err.message || "Couldn't load settings."));
  }, []);

  const save = async (nextLead, nextLocation, nextMessage = messageSettings) => {
    setSaving(true);
    setError("");
    try {
      const res = await api.adminUpdateSettings({ leadSettings: nextLead, locationSettings: nextLocation, messageSettings: nextMessage });
      setLeadSettings(res.leadSettings);
      setLocationSettings(res.locationSettings);
      setMessageSettings(res.messageSettings || nextMessage);
    } catch (err) {
      setError(err.message || "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleLead = (key) => (val) => save({ ...leadSettings, [key]: val }, locationSettings);
  const toggleLocation = (key) => (val) => save(leadSettings, { ...locationSettings, [key]: val }, messageSettings);
  const toggleMessage = (key) => (val) => save(leadSettings, locationSettings, { ...messageSettings, [key]: val });

  return (
    <Overlay onClose={onClose} title="CRM Settings">
      {!leadSettings || !locationSettings || !messageSettings ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: 20 }}>
          <Loader2 size={16} className="spin" /> Loading settings…
        </div>
      ) : (
        <>
          {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 14 }}>{error}</div>}

          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>Lead Settings</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Controls which fields an employee must fill in when adding a lead.</div>
          <SettingToggle label="Require Business Name" checked={leadSettings.requireBusinessName} onChange={toggleLead("requireBusinessName")} />
          <SettingToggle label="Require Sub Location" checked={leadSettings.requireSubLocation} onChange={toggleLead("requireSubLocation")} />
          <SettingToggle label="Require POS Name" checked={leadSettings.requirePosName} onChange={toggleLead("requirePosName")} />
          <SettingToggle label="Require Contact Name" checked={leadSettings.requireContactName} onChange={toggleLead("requireContactName")} />
          <SettingToggle label="Require Contact Number" checked={leadSettings.requireContactNumber} onChange={toggleLead("requireContactNumber")} />
          <SettingToggle label="Require Status" checked={leadSettings.requireStatus} onChange={toggleLead("requireStatus")} />
          <SettingToggle label="Require Comments" checked={leadSettings.requireComments} onChange={toggleLead("requireComments")} />
          <SettingToggle label="Require Expected Deal Value" checked={leadSettings.requireDealValue} onChange={toggleLead("requireDealValue")} />
          <SettingToggle label="Require Next Follow-up Date" checked={leadSettings.requireFollowUpDate} onChange={toggleLead("requireFollowUpDate")} />

          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginTop: 22, marginBottom: 4 }}>Duplicate Protection</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Warns before the same restaurant is entered twice. Exact contact-number matches can be blocked.</div>
          <SettingToggle label="Duplicate Lead Check" checked={leadSettings.duplicateProtectionEnabled !== false} onChange={toggleLead("duplicateProtectionEnabled")} />
          <SettingToggle label="Check Contact Number" checked={leadSettings.duplicateCheckPhone !== false} onChange={toggleLead("duplicateCheckPhone")} />
          <SettingToggle label="Check Business Name + Sub Location" checked={leadSettings.duplicateCheckBusinessLocation !== false} onChange={toggleLead("duplicateCheckBusinessLocation")} />
          <SettingToggle label="Allow employee to add anyway" description="When off, an exact contact-number match is blocked." checked={leadSettings.allowDuplicateOverride === true} onChange={toggleLead("allowDuplicateOverride")} />

          <FieldOptionsSection />

          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginTop: 22, marginBottom: 4 }}>Message Settings</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Controls whether employees can reply to Admin messages attached to their leads.</div>
          <SettingToggle
            label="Employee Replies"
            description="When off, employees can still read lead messages but cannot reply."
            checked={messageSettings.employeeRepliesEnabled !== false}
            onChange={toggleMessage("employeeRepliesEnabled")}
          />

          <DashboardDisplaySettingsControl T={T} />

          {saving && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={12} className="spin" /> Saving…</div>}
        </>
      )}
    </Overlay>
  );
}

function FieldOptionsSection() {
  const [options, setOptions] = useState(null);
  const [error, setError] = useState("");
  const [newValue, setNewValue] = useState({ category: "", pos_name: "" });
  const [adding, setAdding] = useState("");

  const FIELDS = [
    { key: "category", label: "Category" },
    { key: "pos_name", label: "POS Name" },
  ];

  const load = useCallback(async () => {
    try {
      const res = await api.adminGetLeadOptions();
      setOptions(res.options);
    } catch (err) {
      setError(err.message || "Couldn't load field options.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (fieldKey) => {
    const value = newValue[fieldKey]?.trim();
    if (!value) return;
    setAdding(fieldKey);
    setError("");
    try {
      await api.adminAddLeadOption(fieldKey, value);
      setNewValue((v) => ({ ...v, [fieldKey]: "" }));
      await load();
    } catch (err) {
      setError(err.message || "Couldn't add that option.");
    } finally {
      setAdding("");
    }
  };

  const handleDelete = async (id) => {
    setOptions((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = next[k].filter((o) => o.id !== id);
      return next;
    });
    try {
      await api.adminDeleteLeadOption(id);
    } catch {
      load();
    }
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>Field Options</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Preset choices shown in the employee's Add Lead dropdowns — add your own (e.g. POS providers like Petpooja, Restrowork).</div>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}

      {!options ? (
        <div style={{ fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={13} className="spin" /> Loading…</div>
      ) : (
        FIELDS.map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>{label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {(options[key] || []).map((o) => (
                <span key={o.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: T.ink, background: T.paperDeep, borderRadius: 999, padding: "4px 6px 4px 11px" }}>
                  {o.value}
                  <button onClick={() => handleDelete(o.id)} style={{ border: "none", background: "none", cursor: "pointer", color: T.inkSoft, display: "flex", padding: 2 }} title="Remove">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {(options[key] || []).length === 0 && <span style={{ fontSize: 12, color: T.inkSoft }}>No options yet.</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={newValue[key] || ""}
                onChange={(e) => setNewValue((v) => ({ ...v, [key]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleAdd(key)}
                placeholder={`Add a new ${label.toLowerCase()}…`}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button
                onClick={() => handleAdd(key)}
                disabled={!newValue[key]?.trim() || adding === key}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 14px", borderRadius: 8, border: "none", background: T.route, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: newValue[key]?.trim() ? "pointer" : "not-allowed" }}
              >
                <Plus size={13} /> Create
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DownloadMenu({ onCsv, onXlsx, onSheets, onPdf, iconOnly = false, ariaLabel = "Download" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const pick = (fn) => () => { setOpen(false); fn(); };
  const options = [["CSV", onCsv], ["Excel", onXlsx], ["Google Sheets", onSheets]];
  if (onPdf) options.push(["PDF", onPdf]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        title={ariaLabel}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: iconOnly ? 0 : 6, fontSize: 12, fontWeight: 600, color: T.ink, background: "#fff", border: `1px solid ${T.line}`, borderRadius: iconOnly ? 9 : 6, padding: iconOnly ? 0 : "6px 10px", width: iconOnly ? 38 : undefined, height: iconOnly ? 38 : undefined, cursor: "pointer" }}
      >
        <Download size={iconOnly ? 16 : 12} />{!iconOnly && " Download"}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 11, boxShadow: "0 6px 20px rgba(28,36,48,0.15)", zIndex: 100, minWidth: 150, overflow: "hidden" }}>
          {options.map(([label, fn]) => (
            <button
              key={label}
              onClick={pick(fn)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 12.5, fontWeight: 600, color: T.ink, background: "none", border: "none", cursor: "pointer" }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
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
  return <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 11, background: color, display: "inline-block" }} />{label}</div>;
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

  return { LogoMark, TopBar, ConnectionPill, ConnectBackendScreen, LoginScreen, SettingsModal, StatCard, VerificationStamp, SyncBadge, NoLocationBadge, SettingToggle, AddExpenseModal, CrmSettingsModal, FieldOptionsSection, DownloadMenu, Tab, Select, LegendDot, Field, Overlay, inputStyle, EXPENSE_CATEGORIES };
}
