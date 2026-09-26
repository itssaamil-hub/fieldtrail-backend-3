import DesktopContacts from './DesktopContacts.jsx';
import DesktopDealsBoard from './DesktopDealsBoard';
import DesktopSidebar, { useDesktopSidebar } from "./DesktopSidebar.jsx";
import SaveFeedback from "./SaveFeedback.jsx";
import { showSaveFeedback } from "./saveFeedback.js";
import AdminMobileNav, { useAdminPhone, salesmanTabs } from "./AdminMobileNav.jsx";
import CollectionsPanel, {CollectionsEntry} from "./Collections.jsx";
import SalesmanBriefPopup from "./SalesmanBrief.jsx";
import {EmployeeSettings, DayClosingForm, DayClosingReports, DayClosingReportsEntry} from "./DayClosing.jsx";
import QuotationsPanel, { QuotationSettings } from "./Quotations.jsx";
import OnboardingPanel, { AppMenu, OnboardingTemplateEditor } from "./Onboarding.jsx";
import DealValueReport from "./DealValueReport.jsx";
import { TasksEntry, TasksModal } from "./Tasks.jsx";
import LeadBriefPopup from "./LeadBriefPopup.jsx";
import useUnreadNotifications from "./useUnreadNotifications.js";
import NotificationsPanel from "./NotificationsPanel.jsx";
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
  Pencil,
  Trash2,
  MessageSquare,
  Contact2,
  Search,
  Flame,
  Handshake,
  CalendarClock,
  Target as TargetIcon,
  BarChart3,
  Wallet,
  Receipt,
  LayoutGrid,
  Bell,
  Lock,
  LockOpen,
  Sparkles,
  Phone as PhoneIcon,
  MessageCircle as WhatsAppIcon,
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
// New "Swirl-inspired" light theme — same token names used throughout the
// whole file, so retargeting these values restyles the app without having
// to touch every individual component. Original ledger theme is preserved
// in the pwa-src-BACKUP-original-theme folder if this ever needs reverting.
const T = {
  ink: "#1A1D23",
  inkSoft: "#6B7280",
  paper: "#F4F5F7",
  paperDeep: "#EDEEF2",
  card: "#FFFFFF",
  line: "#E7E9EE",
  verified: "#12805C",
  verifiedSoft: "#E6F6EF",
  warn: "#B8791F",
  warnSoft: "#FDF3E0",
  danger: "#C0392B",
  dangerSoft: "#FBEAE8",
  route: "#145C5D",
  accent: "#F5793B",
};

const rand = (a, b) => a + Math.random() * (b - a);
const fmtTime = (d) => (d ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—");
// Compact currency for small stat-card sub-text — ₹45K, ₹1.2L, ₹3.4Cr — so
// a large closed-deal total never forces the tile to grow.
const fmtMoney = (n) => {
  if (n == null) return "";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};
// Calendar-day check (local time), not a rolling 24h window — this is what
// makes "Today's Leads" and the daily target actually reset at midnight
// instead of drifting on a 24-hours-since-creation basis.
const isToday = (d) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};
const isThisMonth = (d) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
const DASHBOARD_DISPLAY_KEY = "engage_dashboard_display_settings";
const getDashboardDisplaySettings = () => {
  try { return { showComparisons: true, comparisonPeriod: "weekly", ...JSON.parse(localStorage.getItem(DASHBOARD_DISPLAY_KEY) || "{}") }; }
  catch { return { showComparisons: true, comparisonPeriod: "weekly" }; }
};
const periodBounds = (period, previous = false) => {
  const now = new Date();
  if (period === "monthly") {
    const y = now.getFullYear(), m = now.getMonth() - (previous ? 1 : 0);
    const start = new Date(y, m, 1);
    const maxDay = new Date(y, m + 1, 0).getDate();
    const end = previous ? new Date(y, m, Math.min(now.getDate(), maxDay), 23, 59, 59, 999) : now;
    return [start, end];
  }
  const weekday = (now.getDay() + 6) % 7;
  const currentStart = new Date(now); currentStart.setHours(0,0,0,0); currentStart.setDate(currentStart.getDate() - weekday);
  const start = new Date(currentStart); if (previous) start.setDate(start.getDate() - 7);
  const end = previous ? new Date(start.getTime() + (now.getTime() - currentStart.getTime())) : now;
  return [start, end];
};
const comparisonFor = (items, period, predicate = () => true) => {
  const [cs, ce] = periodBounds(period, false), [ps, pe] = periodBounds(period, true);
  const current = items.filter(x => x.createdAt >= cs && x.createdAt <= ce && predicate(x)).length;
  const previous = items.filter(x => x.createdAt >= ps && x.createdAt <= pe && predicate(x)).length;
  if (previous === 0) return { current, previous, pct: current === 0 ? 0 : null };
  return { current, previous, pct: Math.round(((current - previous) / previous) * 100) };
};
// True if a date falls between today and `days` days from now (inclusive) —
// used for the "renewal/expiry coming up" box, not a rolling calendar month,
// so it stays useful no matter what day you're looking on.
const isWithinDays = (d, days) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return d >= start && d <= end;
};
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// A lead's Renewal Month alone (no exact date) still counts as "upcoming"
// if it names the current or next calendar month — e.g. typing "October"
// while today is in September should surface it right away.
const isUpcomingRenewalMonth = (monthName) => {
  if (!monthName) return false;
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
  if (idx === -1) return false;
  const now = new Date();
  const curMonth = now.getMonth();
  const nextMonth = (curMonth + 1) % 12;
  return idx === curMonth || idx === nextMonth;
};
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// Hot/Warm/Cold sit first per spec (the salesman's quick-triage picks),
// "New" stays as the backend's silent default status for leads nobody has
// explicitly classified yet — it's still valid, just not pushed to the top.
// The funnel: Cold → Conversation → Hot → Demo → Negotiation → Won/Lost/Nurture.
// This is what's shown in every status picker going forward.
const STATUSES = ["cold", "conversation", "hot", "demo", "negotiation", "won", "lost", "nurture"];
const STATUS_LABEL = {
  cold: "Cold", conversation: "Conversation", hot: "Hot", demo: "Demo",
  negotiation: "Negotiation", won: "Won", lost: "Lost", nurture: "Nurture",
  // Legacy values — no longer selectable, but kept here so any older lead
  // still using one of these displays correctly instead of showing blank.
  warm: "Warm", new: "New", contacted: "Contacted", follow_up: "Follow-up",
  demo_scheduled: "Demo Scheduled", proposal_sent: "Proposal Sent",
};

const STATUS_DESCRIPTOR = {
  cold: "a cold lead", conversation: "in early conversation", hot: "a hot lead",
  demo: "at the demo stage", negotiation: "in negotiation", won: "a won deal",
  lost: "a lost deal", nurture: "being nurtured",
};

// Builds a short, human-readable summary and a recommended next action for a
// lead, entirely from data already on the lead + its status history —
// plain JS conditions and template strings, no AI model or external API.

function leadInitials(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0][0] : words[0][0] + words[1][0]).toUpperCase();
}

function leadAvatarStyle(name) {
  const palettes = [
    ["#E8F5EF", "#147A5A"],
    ["#EEF3FF", "#4967B2"],
    ["#F4EEFF", "#7651A8"],
    ["#FFF2E7", "#A45E24"],
    ["#FDECEF", "#A84E63"],
    ["#EAF6F8", "#287C88"],
  ];
  const value = String(name || "?");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  const [background, color] = palettes[Math.abs(hash) % palettes.length];
  return {
    width: 30, height: 30, minWidth: 30, borderRadius: "50%",
    display: "grid", placeItems: "center", background, color,
    fontSize: 10.5, fontWeight: 800, letterSpacing: ".2px", flexShrink: 0
  };
}

function buildLeadBrief(lead, history) {
  const parts = [];
  const today = new Date(new Date().toDateString());
  const daysAgo = (d) => Math.floor((Date.now() - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  const relativeDay = (d) => {
    const n = daysAgo(d);
    if (n <= 0) return "today";
    if (n === 1) return "yesterday";
    return `${n} days ago`;
  };
  const relativeDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0) return "overdue";
    if (diff === 0) return "due today";
    if (diff === 1) return "due tomorrow";
    return `due ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  };

  let opening = `${lead.business} is ${STATUS_DESCRIPTOR[lead.status] || `at the ${STATUS_LABEL[lead.status] || lead.status} stage`}`;
  if (lead.salesmanName) opening += `, assigned to ${lead.salesmanName}`;
  parts.push(opening + ".");

  if (lead.posName) parts.push(`They currently use ${lead.posName}.`);
  if (lead.createdAt) parts.push(`Added ${relativeDay(lead.createdAt)}.`);

  const lastChange = history && history.length > 0 ? history[history.length - 1] : null;
  if (lastChange) {
    parts.push(`Moved to ${STATUS_LABEL[lastChange.new_status] || lastChange.new_status} ${relativeDay(lastChange.changed_at)}.`);
  }
  const demoDone = lead.status !== "demo" && history?.some((h) => h.new_status === "demo");
  if (lead.status === "demo") parts.push("This lead is currently in the demo stage.");
  else if (demoDone) parts.push("This lead was previously in the demo stage.");

  if (lead.nextFollowUpDate) parts.push(`Next follow-up is ${relativeDateLabel(lead.nextFollowUpDate)}.`);
  if (lead.renewalDate) parts.push(`Renewal is ${relativeDateLabel(lead.renewalDate)}.`);
  else if (lead.renewalMonth) parts.push(`Renewal expected in ${lead.renewalMonth}.`);

  if (lead.dealValue) parts.push(`Expected deal value is ${fmtMoney(lead.dealValue)}.`);
  if (lead.notes) parts.push(`Latest note: "${lead.notes.length > 110 ? lead.notes.slice(0, 110) + "…" : lead.notes}"`);

  const summary = parts.join(" ");

  // Recommended next action — simple priority rules, most urgent first.
  let nextAction;
  const fuOverdue = lead.nextFollowUpDate && new Date(lead.nextFollowUpDate) < today;
  const fuToday = lead.nextFollowUpDate && new Date(new Date(lead.nextFollowUpDate).toDateString()).getTime() === today.getTime();
  if (lead.status === "won") nextAction = "Deal is closed — no action needed.";
  else if (lead.status === "lost") nextAction = "Deal is lost — consider re-engaging in a few months.";
  else if (fuOverdue) nextAction = "Follow-up is overdue — contact them today.";
  else if (fuToday) nextAction = "Follow-up is due today — call or visit to move this forward.";
  else if (lead.status === "hot") nextAction = "This is a hot lead — prioritize a call or visit soon.";
  else if (lead.status === "negotiation") nextAction = "Push to close — confirm terms and get a decision.";
  else if (demoDone) nextAction = "Confirm the demo outcome and agree on the next steps.";
  else if (lead.status === "demo") nextAction = "Confirm the demo appointment and prepare the presentation.";
  else if (lead.status === "cold") nextAction = "Re-engage with a call to warm this lead up.";
  else nextAction = "Check in to keep the conversation moving.";

  return { summary, nextAction };
}

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

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const NOTIFICATION_PREF_DEFAULTS = {
  hotLead: true, statusConversation: true, statusNegotiation: true,
  statusDemo: true, renewalDue: true, followUpDue: true, dayStartDigest: true, salesBriefing: true, dayActivity: true, dealWon: true, targetMilestone: true, dayStartedEnded: true, dayClosingMissing: true, dayActivitySummary: true,
};

function usePushNotifications(session) {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState(NOTIFICATION_PREF_DEFAULTS);

  useEffect(() => {
    if (!supported) return;
    // One-time cleanup: an earlier version of this feature registered push-sw.js
    // at the root scope, which collided with the main app's service worker and
    // caused a reload loop. Remove that old registration wherever it's found.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        if (reg.active?.scriptURL?.endsWith("/push-sw.js") && reg.scope.endsWith("/")  && !reg.scope.endsWith("/push/")) {
          reg.unregister();
        }
      });
    }).catch(() => {});
  }, [supported]);

  useEffect(() => {
    if (!supported || !session) { setChecking(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/push/push-sw.js", { scope: "/push/" });
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setSubscribed(!!sub);

        // Self-heal an existing browser subscription by re-syncing its current
        // endpoint/keys with the logged-in account. This is idempotent on the
        // backend and repairs stale server-side subscription rows without
        // prompting the user or creating a second browser subscription.
        if (sub && Notification.permission === "granted") {
          try {
            await api.notificationsSubscribe(sub.toJSON());
          } catch {
            // Keep the existing local subscription usable; a temporary API
            // failure should not turn notifications off in the UI.
          }
        }
      } catch {
        // Existing behaviour: unsupported/registration failures are surfaced
        // by the explicit Enable action rather than breaking app startup.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supported, session]);

  useEffect(() => {
    if (!subscribed) return;
    api.notificationsGetPreferences().then((res) => setPreferences(res.preferences)).catch(() => {});
  }, [subscribed]);

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setError("Notifications are blocked — allow them for this site in your browser settings to turn this on."); return; }
      const reg = await navigator.serviceWorker.register("/push/push-sw.js", { scope: "/push/" });
      const { publicKey } = await api.notificationsVapidKey();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await api.notificationsSubscribe(sub.toJSON());
      setSubscribed(true);
    } catch (err) {
      setError(err.message || "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    try {
      // Unsubscribe locally on this browser (whatever registration is currently active).
      const reg = await navigator.serviceWorker.register("/push/push-sw.js", { scope: "/push/" });
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe().catch(() => {});

      // Also wipe every subscription row this account has on the server —
      // including any stale one left over from a device/browser that's
      // since changed, so a dead subscription can never silently swallow
      // sends the person can no longer see.
      await api.notificationsUnsubscribeAll().catch(() => {});
      setSubscribed(false);
    } catch (err) {
      setError(err.message || "Couldn't turn off notifications.");
    } finally {
      setBusy(false);
    }
  };

  const setPreference = async (key, value) => {
    setPreferences((p) => ({ ...p, [key]: value }));
    try {
      await api.notificationsSetPreferences({ [key]: value });
    } catch (err) {
      setError(err.message || "Couldn't save that preference.");
    }
  };

  return { supported, subscribed, checking, busy, error, preferences, enable, disable, setPreference };
}

// ---------------------------------------------------------------------------
export default function App() {
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [session, setSessionState] = useState(getSession());
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDailyReports,setShowDailyReports] = useState(false);
  const [collectionView,setCollectionView]=useState(null);
  useEffect(()=>{const open=e=>{setQuotationView(null);setShowOnboarding(false);setShowSettings(false);setCollectionView({initialKey:e.detail?.key||null});};window.addEventListener('fieldtrail:open-collections',open);return()=>window.removeEventListener('fieldtrail:open-collections',open);},[]);

  const [quotationView, setQuotationView] = useState(null);
  const [showOnboardingSettings, setShowOnboardingSettings] = useState(false);
  const [showCrmSettings, setShowCrmSettings] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationLead, setNotificationLead] = useState(null);
  const desktop = useDesktopSidebar();
  const [desktopSection, setDesktopSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("engage:sidebar-collapsed") === "true"; } catch { return false; }
  });
  const adminDesktop = desktop && session?.role === "admin";
  const selectDesktopSection = section => {
    setDesktopSection(section);
    setTopPage(section === "reports" ? "reports" : "dashboard");
  };
  const toggleSidebar = () => setSidebarCollapsed(value => {
    try { localStorage.setItem("engage:sidebar-collapsed", String(!value)); } catch { /* optional preference */ }
    return !value;
  });
  const [topPage, setTopPage] = useState("dashboard"); // "dashboard" | "reports" — lives here so the toggle can live in the dark TopBar, for both roles
  const online = useOnlineStatus();
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const pushNotifications = usePushNotifications(session);
  const unreadCount = useUnreadNotifications(session, online);

  useEffect(() => {
    const openFromLocation = () => {
      if (!session) return;
      if (window.location.hash === "#sales-briefing") {
        setShowSettings(false); setShowCrmSettings(false); setShowAddExpense(false);
        setShowNotifications(true);
        return;
      }
      const leadMatch = window.location.hash.match(/^#lead=([0-9a-f-]+)$/i);
      if (leadMatch) {
        setShowSettings(false); setShowCrmSettings(false); setShowAddExpense(false); setShowNotifications(false);
        setTopPage("dashboard"); setNotificationLead({ id: leadMatch[1], openedAt: Date.now() });
      }
    };
    const onNotification = event => {
      if (event.data?.type !== "OPEN_NOTIFICATION") return;
      try {
        const url = new URL(event.data.url, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.hash !== "#sales-briefing" && !/^#lead=[0-9a-f-]+$/i.test(url.hash)) return;
        if (window.location.hash !== url.hash) window.location.hash = url.hash;
        openFromLocation();
      } catch { /* Ignore malformed messages. */ }
    };
    openFromLocation();
    window.addEventListener("hashchange", openFromLocation);
    navigator.serviceWorker?.addEventListener("message", onNotification);
    return () => { window.removeEventListener("hashchange", openFromLocation); navigator.serviceWorker?.removeEventListener("message", onNotification); };
  }, [session]);

  const closeNotifications = () => {
    setShowNotifications(false);
    if (window.location.hash === "#sales-briefing") window.history.replaceState(null, "", window.location.pathname + window.location.search);
  };

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
    setDesktopSection("dashboard");
    setTopPage("dashboard");
    closeNotifications();
    setNotificationLead(null);
    setShowOnboarding(false); setShowOnboardingSettings(false); setQuotationView(null); setShowDailyReports(false); setCollectionView(null);
  };

  useEffect(() => {
    if (session?.role !== "salesman") return;
    const open = event => {
      const action = event.detail;
      if (!["quotations", "onboarding", "payments", "daily", "settings"].includes(action)) return;
      closeNotifications(); setShowSettings(false); setShowOnboarding(false);
      setQuotationView(null); setCollectionView(null); setShowDailyReports(false);
      if (action === "quotations") setQuotationView({});
      if (action === "onboarding") setShowOnboarding(true);
      if (action === "payments") setCollectionView({});
      if (action === "daily") setShowDailyReports(true);
      if (action === "settings") setShowSettings(true);
    };
    window.addEventListener("engage:salesman-more", open);
    return () => window.removeEventListener("engage:salesman-more", open);
  }, [session?.role]);

  let body;
  if (!apiBase) {
    body = <ConnectBackendScreen onSave={handleSaveApiBase} />;
  } else if (!session) {
    body = <LoginScreen apiBase={apiBase} online={online} onLoggedIn={handleLoggedIn} onOpenSettings={() => setShowSettings(true)} />;
  } else if (session.role === "admin") {
    body = <AdminApp desktopSection={adminDesktop ? (topPage === "reports" ? "reports" : desktopSection === "reports" ? "dashboard" : desktopSection) : null} notificationLead={notificationLead} session={session} online={online} onLogout={handleLogout} page={topPage} />;
  } else {
    body = <SalesmanApp key={`salesman-${session.id}`} notificationLead={notificationLead} session={session} online={online} onLogout={handleLogout} page={topPage} />;
  }

  return (
    <div className={adminDesktop ? `engage-desktop-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}` : undefined} style={{ fontFamily: "Inter, system-ui, sans-serif", background: T.paper, minHeight: "100vh", color: T.ink }}>
      {adminDesktop && <DesktopSidebar active={topPage === "reports" ? "reports" : desktopSection === "reports" ? "dashboard" : desktopSection} collapsed={sidebarCollapsed} onCollapse={toggleSidebar} onSelect={selectDesktopSection} settingsOpen={showSettings} onSettings={() => { closeNotifications(); setShowOnboarding(false); setShowSettings(true); }} />}
      <TopBar
        hidePageNavigation={adminDesktop}
        online={online}
        session={session}
        page={session ? topPage : undefined}
        onChangePage={session ? setTopPage : undefined}
        onAddExpense={session?.role === "admin" ? () => setShowAddExpense(true) : undefined}
        unreadCount={unreadCount}
        onOpenNotifications={session ? () => { setShowSettings(false); setShowNotifications(true); } : undefined}
        onOpenSettings={() => { closeNotifications(); setShowOnboarding(false); setShowSettings(true); }}
        onOpenCollections={()=>{closeNotifications();setShowSettings(false);setShowOnboarding(false);setQuotationView(null);setShowDailyReports(false);setCollectionView({});}}
        onOpenDailyReports={() => { closeNotifications(); setShowSettings(false); setShowOnboarding(false); setQuotationView(null); setShowDailyReports(true); }}
        onOpenOnboarding={() => { closeNotifications(); setQuotationView(null); setShowSettings(false); setShowOnboarding(true); }}
        onOpenQuotations={() => { closeNotifications(); setShowSettings(false); setShowOnboarding(false); setQuotationView({}); }}
        onOpenApprovals={session?.role === "admin" ? () => { closeNotifications(); setShowSettings(false); setShowOnboarding(false); setQuotationView({approvals:true}); } : undefined}
      />
      {body}
      {session && <SaveFeedback key={session.id} />}
      {session && showNotifications && <NotificationsPanel key={`notifications-${session.id}`} session={session} online={online} onClose={closeNotifications} onOpenQuote={id => { closeNotifications(); setQuotationView({initialId:id}); }} onOpenLead={id => {
        closeNotifications(); setTopPage("dashboard"); setNotificationLead({ id, openedAt: Date.now() });
      }} />}
      {showSettings && (
        <SettingsModal
          apiBase={apiBase}
          onClose={() => setShowSettings(false)}
          onSave={(url) => { handleSaveApiBase(url); setShowSettings(false); }}
          onLogout={session ? () => { setShowSettings(false); handleLogout(); } : undefined}
          onOpenCrmSettings={session?.role === "admin" ? () => { setShowSettings(false); setShowCrmSettings(true); } : undefined}
          onOpenQuotationSettings={session?.role === "admin" ? () => { setShowSettings(false); setQuotationView({settings:true}); } : undefined}
          onOpenOnboardingSettings={session?.role === "admin" ? () => { setShowSettings(false); setShowOnboardingSettings(true); } : undefined}
          canInstall={canInstall}
          installed={installed}
          promptInstall={promptInstall}
          push={pushNotifications}
        />
      )}
      {session && quotationView && (quotationView.settings ? session.role === "admin" && <QuotationSettings onClose={() => setQuotationView(null)} /> : <QuotationsPanel key={`${session.id}-${quotationView.initialId||"list"}-${!!quotationView.approvals}`} {...quotationView} onClose={() => setQuotationView(null)} />)}
      {session && collectionView && <CollectionsPanel {...collectionView} onClose={()=>setCollectionView(null)}/>}
      {session && showDailyReports && <DayClosingReports onClose={()=>setShowDailyReports(false)}/>}
      {session && showOnboarding && <OnboardingPanel key={session.id} onClose={() => setShowOnboarding(false)} />}
      {session?.role === "admin" && showOnboardingSettings && <OnboardingTemplateEditor onClose={() => setShowOnboardingSettings(false)} />}
      {showCrmSettings && <CrmSettingsModal onClose={() => setShowCrmSettings(false)} />}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
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

function TopBar({ hidePageNavigation = false, online, session, page, onChangePage, onAddExpense, onOpenSettings, onOpenOnboarding, onOpenCollections, onOpenDailyReports, onOpenQuotations, onOpenApprovals, onOpenNotifications, unreadCount = 0 }) {
  const [narrow, setNarrow] = useState(window.innerWidth < 560);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 560);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className={hidePageNavigation ? "engage-desktop-topbar" : undefined} style={{ position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", paddingTop: "calc(14px + env(safe-area-inset-top))", background: "linear-gradient(135deg, #0F3D3E 0%, #145C5D 100%)", color: "#fff", borderBottom: hidePageNavigation ? "1px solid rgba(255,255,255,0.12)" : undefined, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!hidePageNavigation && <>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#145C5D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <LogoMark size={16} color="#fff" />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: 0.2 }}>Engage</div>
          </>}
          {!narrow && session && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.65)", marginRight: 4 }}>
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

          {onAddExpense && (
            <button
              onClick={onAddExpense}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "6px 10px", borderRadius: 7, cursor: "pointer", border: "1px solid rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.14)", color: "#fff" }}
            >
              <Wallet size={13} /> {narrow ? "" : "Expenses"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConnectionPill online={online} />
          {onOpenNotifications && <button type="button" onClick={onOpenNotifications} title="Notifications" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(255,255,255,0.22)", cursor: "pointer", background: "rgba(255,255,255,0.14)", color: "#fff" }}><Bell size={14} />{unreadCount > 0 && <span className="ft-notification-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>}
          <AppMenu onCollections={onOpenCollections} signedIn={!!session} role={session?.role} onSettings={onOpenSettings} onOnboarding={onOpenOnboarding} onQuotations={onOpenQuotations} onApprovals={onOpenApprovals} onDailyReports={session?.role === "salesman" ? onOpenDailyReports : undefined} />
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

function SettingsModal({ apiBase, onClose, onSave, onLogout, onOpenCrmSettings, onOpenOnboardingSettings, onOpenQuotationSettings, canInstall, installed, promptInstall, push }) {
  const [url, setUrl] = useState(apiBase || "");
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

      <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Backend</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 12 }}>
        Changing this will sign you out, since sessions are tied to a specific backend.
      </div>
      <Field label="Backend URL">
        <input style={inputStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-backend.up.railway.app" autoCapitalize="none" autoCorrect="off" />
      </Field>
      <button
        onClick={() => onSave(url.trim().replace(/\/+$/, ""))}
        disabled={!url.trim()}
        style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: url.trim() ? "pointer" : "not-allowed", background: url.trim() ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5 }}
      >
        Save
      </button>
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

// ---------------------------------------------------------------------------
// Shared small pieces
// ---------------------------------------------------------------------------
function StatCard({ label, value, sub, color, icon: IconC, onClick, comparison, comparisonPeriod, variant }) {
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
      className={onClick ? "ft-card ft-row" : "ft-card"}
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

// Shown instead of VerificationStamp when GPS Location is turned off in
// Location Settings — this is a neutral "not applicable" state, distinct
// from an actual failed/unverified GPS reading.
function NoLocationBadge({ small }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.inkSoft, background: T.paperDeep, borderRadius: 999, padding: small ? "3px 9px" : "5px 12px", fontFamily: "Inter, sans-serif", fontSize: small ? 10.5 : 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
      No location
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
  const [displaySettings, setDisplaySettings] = useState(getDashboardDisplaySettings);
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

          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginTop: 22, marginBottom: 4 }}>Location Settings</div>
          <SettingToggle
            label="GPS Location"
            description="If off, leads can be saved with no location at all."
            checked={locationSettings.gpsLocation}
            onChange={toggleLocation("gpsLocation")}
          />
          <SettingToggle
            label="Location Mandatory for New Lead"
            description="Only applies when GPS Location is on — employee must capture location before saving."
            checked={locationSettings.locationMandatoryForNewLead}
            onChange={toggleLocation("locationMandatoryForNewLead")}
          />
          <SettingToggle
            label="Continuous GPS Tracking"
            description="Live location pings while the employee's day is active."
            checked={locationSettings.continuousGpsTracking}
            onChange={toggleLocation("continuousGpsTracking")}
          />

          <FieldOptionsSection />

          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginTop: 22, marginBottom: 4 }}>Message Settings</div>
          <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Controls whether employees can reply to Admin messages attached to their leads.</div>
          <SettingToggle
            label="Employee Replies"
            description="When off, employees can still read lead messages but cannot reply."
            checked={messageSettings.employeeRepliesEnabled !== false}
            onChange={toggleMessage("employeeRepliesEnabled")}
          />
          <div style={{fontSize:11,textTransform:"uppercase",color:T.inkSoft,fontWeight:700,letterSpacing:.4,marginTop:22,marginBottom:4}}>Display Settings</div>
          <div style={{fontSize:12,color:T.inkSoft,marginBottom:8}}>Controls comparison indicators inside dashboard cards.</div>
          <SettingToggle label="Show KPI Comparisons" description="Turn dashboard comparisons on or off." checked={displaySettings.showComparisons!==false} onChange={(val)=>{const next={...displaySettings,showComparisons:val};setDisplaySettings(next);localStorage.setItem(DASHBOARD_DISPLAY_KEY,JSON.stringify(next));window.dispatchEvent(new Event("engage-display-settings"));}} />
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"9px 2px"}}>
            <div><div style={{fontSize:13,fontWeight:600}}>Comparison Period</div><div style={{fontSize:11.5,color:T.inkSoft,marginTop:2}}>Current period vs previous period.</div></div>
            <select value={displaySettings.comparisonPeriod||"weekly"} onChange={(e)=>{const next={...displaySettings,comparisonPeriod:e.target.value};setDisplaySettings(next);localStorage.setItem(DASHBOARD_DISPLAY_KEY,JSON.stringify(next));window.dispatchEvent(new Event("engage-display-settings"));}} style={{border:`1px solid ${T.line}`,borderRadius:8,padding:"7px 9px",background:"#fff",fontSize:12.5}}>
              <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>

          {saving && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={12} className="spin" /> Saving…</div>}
        </>
      )}
    </Overlay>
  );
}

// Lets admin add/remove preset dropdown values for Category and POS Name
// on the salesman's Add Lead form — no code change needed to add e.g. a
// new POS provider.
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
    }); // optimistic
    try {
      await api.adminDeleteLeadOption(id);
    } catch {
      load(); // reconcile if it actually failed
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

// Single "Download" button that reveals CSV/Excel/Sheets on click, instead
// of showing all three as separate buttons all the time.
function DownloadMenu({ onCsv, onXlsx, onSheets, onPdf }) {
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
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: T.ink, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}
      >
        <Download size={12} /> Download
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

// ---------------------------------------------------------------------------
// Live map — Leaflet + OpenStreetMap (free, no API key). Salesman and lead
// markers are plain Leaflet layers kept in refs so live position updates
// just move existing markers instead of re-creating the map on every render.
// ---------------------------------------------------------------------------
function LiveMap({ salesmen, leads, onSelectLead, title = "Live Employees & Lead Map", subtitle }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const salesmanMarkersRef = useRef({});
  const leadMarkersRef = useRef({});
  const onSelectLeadRef = useRef(onSelectLead);
  const flownOnceRef = useRef(false);
  const [locked, setLocked] = useState(true); // frozen by default so an accidental touch/scroll doesn't drag the map
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
    const map = L.map(containerRef.current, { center: [26.847, 80.975], zoom: 12, scrollWheelZoom: false, dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false });
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
    const toggle = (name) => (locked ? map[name].disable() : map[name].enable());
    toggle("dragging");
    toggle("scrollWheelZoom");
    toggle("touchZoom");
    toggle("doubleClickZoom");
    toggle("boxZoom");
    if (map.keyboard) toggle("keyboard");
  }, [locked]);

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
    <div className="ft-card" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: subtitle ? 2 : 8 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{title}</div>
        {!subtitle && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.verified, fontFamily: "'IBM Plex Mono', monospace" }}><Radio size={12} /> LIVE</div>}
      </div>
      {subtitle && <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 8 }}>{subtitle}</div>}
      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: subtitle ? 460 : 360, borderRadius: 11, overflow: "hidden" }} />
        <button
          onClick={() => setLocked((v) => !v)}
          title={locked ? "Map is locked — tap to unlock and move it" : "Map is unlocked — tap to lock it in place"}
          style={{
            position: "absolute", top: 10, right: 10, zIndex: 1000, display: "flex", alignItems: "center", gap: 6,
            padding: "7px 11px", borderRadius: 999, border: "none", cursor: "pointer",
            background: locked ? "rgba(26,29,35,0.85)" : T.route, color: "#fff", fontSize: 11.5, fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          {locked ? <Lock size={13} /> : <LockOpen size={13} />} {locked ? "Locked" : "Movable"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", fontSize: 11, color: T.inkSoft }}>
        {salesmen.length > 0 && <LegendDot color={T.route} label="Employee (online)" />}
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
function AdminApp({ desktopSection, session, online, page, notificationLead }) {
  const [conversationCount, setConversationCount] = useState(null);
  const [salesmen, setSalesmen] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      const [salesmenRes, leadsRes, summaryRes] = await Promise.all([api.adminSalesmen(), api.adminLeads(), api.adminSummary()]);
      setConversationCount(summaryRes.conversationLeads ?? null);
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
      business: payload.businessName ?? l.business,
      subLocation: payload.subLocation, posName: payload.posName,
      renewalMonth: payload.renewalMonth, renewalDate: payload.renewalDate || "",
      owner: payload.contactName, phone: payload.phone, notes: payload.notes,
      dealValue: payload.dealValue,
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

  const onAddLead = async (payload) => {
    await api.adminCreateLead(payload);
    await loadAll(); // simplest way to get the new lead mapped + inserted in the right sorted position
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
      setLoadError(err instanceof ApiError ? err.message : "Couldn't update employee.");
      loadAll();
    }
  };

  const onEditSalesman = async (id, payload) => {
    await api.adminUpdateSalesman(id, payload);
    await loadAll();
  };

  const onDeleteSalesman = async (id) => {
    await api.adminDeleteSalesman(id); // no optimistic removal — surfaces the "still has leads" error cleanly if blocked
    await loadAll();
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
      desktopSection={desktopSection}
      conversationCount={conversationCount}
      salesmen={salesmen}
      leads={leads}
      onStatusChange={onStatusChange}
      onUpdateLead={onUpdateLead}
      onDeleteLead={onDeleteLead}
      onAddLead={onAddLead}
      onAddSalesman={onAddSalesman}
      onEditSalesman={onEditSalesman}
      onDeleteSalesman={onDeleteSalesman}
      onToggleSalesmanActive={onToggleSalesmanActive}
      loadError={loadError}
      wsConnected={wsConnected}
      online={online}
      page={page}
      notificationLead={notificationLead}
    />
  );
}

function AdminView({ desktopSection, conversationCount, salesmen, leads, onStatusChange, onUpdateLead, onDeleteLead, onAddLead, onAddSalesman, onEditSalesman, onDeleteSalesman, onToggleSalesmanActive, loadError, wsConnected, online, page, notificationLead }) {
  const phone = useAdminPhone();
  const [mobileTab, setMobileTab] = useState("dashboard");
  const [tasksVisited, setTasksVisited] = useState(false);
  const desktopPositions = useRef({});
  const previousDesktopSection = useRef(null);
  useEffect(() => {
    if (!desktopSection) return;
    if (desktopSection === "tasks") setTasksVisited(true);
    const previous = previousDesktopSection.current;
    if (previous) desktopPositions.current[previous] = window.scrollY;
    previousDesktopSection.current = desktopSection;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: desktopPositions.current[desktopSection] || 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [desktopSection]);
  const section = desktopSection || mobileTab;
  const sectionNavigation = phone || Boolean(desktopSection);
  const [expensesVisited, setExpensesVisited] = useState(false);
  const scrollPositions = useRef({});
  const switchMobileTab = (tab) => {
    scrollPositions.current[mobileTab] = window.scrollY;
    if (tab === "expenses") setExpensesVisited(true);
    setMobileTab(tab);
  };
  useEffect(() => {
    if (!phone) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollPositions.current[mobileTab] || 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [mobileTab, phone]);
  const desktopDeals = desktopSection === "deals";
  const desktopContacts = desktopSection === "leads";
  const showDashboard = !sectionNavigation || section === "dashboard";
  const showLeads = showDashboard || section === "leads" || section === "deals";
  const [conversationError, setConversationError] = useState("");
  const [filterSalesman, setFilterSalesman] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [leadsViewMode, setLeadsViewMode] = useState("board"); // "list" | "board"
  const [showAdminAddLead, setShowAdminAddLead] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);
  const LEADS_PER_PAGE = 50;
  const [selectedLead, setSelectedLead] = useState(null);
  useEffect(() => {
    if (!notificationLead?.id) return;
    const lead = leads.find((item) => item.id === notificationLead.id);
    if (lead) setSelectedLead(lead);
  }, [notificationLead, leads]);
  const [showAddSalesman, setShowAddSalesman] = useState(false);
  const [editSalesman, setEditSalesman] = useState(null);
  const [employeeSettings,setEmployeeSettings]=useState(null);
  const [briefSalesman,setBriefSalesman]=useState(null);
  const [deleteSalesmanConfirm, setDeleteSalesmanConfirm] = useState(null);
  const [deleteSalesmanError, setDeleteSalesmanError] = useState("");
  const [messageTarget, setMessageTarget] = useState(null); // salesman object | "all" | null
  const [routeSalesman, setRouteSalesman] = useState(null);
  const [viewingSalesmanLeads, setViewingSalesmanLeads] = useState(null);
  const [mapView, setMapView] = useState("live"); // "live" | "leads"
  const [dashboardSalesman, setDashboardSalesman] = useState("all");
  const [dashboardDisplay, setDashboardDisplay] = useState(getDashboardDisplaySettings);
  useEffect(() => { const sync=()=>setDashboardDisplay(getDashboardDisplaySettings()); window.addEventListener("engage-display-settings",sync); return()=>window.removeEventListener("engage-display-settings",sync); }, []);
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");
  const [statLeadsModal, setStatLeadsModal] = useState(null); // { title, leads } | null

  const dashboardLeads = dashboardSalesman === "all" ? leads : leads.filter((l) => l.salesmanId === dashboardSalesman);
  const todayLeads = dashboardLeads.filter((l) => isToday(l.createdAt));
  const hotLeadsToday = todayLeads.filter((l) => l.status === "hot");
  const inNegotiation = dashboardLeads.filter((l) => l.status === "negotiation");
  const upcomingRenewals = dashboardLeads.filter((l) =>
    (l.renewalDate && isWithinDays(new Date(l.renewalDate), 30)) ||
    (!l.renewalDate && isUpcomingRenewalMonth(l.renewalMonth))
  );
  const converted = dashboardLeads.filter((l) => l.status === "won").length;
  const convertedValue = dashboardLeads.filter((l) => l.status === "won" && l.dealValue != null).reduce((sum, l) => sum + l.dealValue, 0);
  const pending = dashboardLeads.filter((l) => !["won", "lost"].includes(l.status)).length;
  const upcomingFollowUps = dashboardLeads.filter((l) => l.nextFollowUpDate && new Date(l.nextFollowUpDate) >= new Date(new Date().toDateString()));
  const activeSalesmen = salesmen.filter((s) => s.status === "online").length;
  const dashboardComparison = dashboardDisplay.showComparisons !== false ? comparisonFor(dashboardLeads, dashboardDisplay.comparisonPeriod || "weekly") : null;
  const hotComparison = dashboardDisplay.showComparisons !== false ? comparisonFor(dashboardLeads, dashboardDisplay.comparisonPeriod || "weekly", (l) => l.status === "hot") : null;

  const filteredLeads = leads.filter(
    (l) =>
      (filterSalesman === "all" || l.salesmanId === filterSalesman) &&
      (filterStatus === "all" || l.status === filterStatus) &&
      (!filterDate || l.createdAt.toISOString().slice(0, 10) === filterDate) &&
      (!searchQuery.trim() || [l.business, l.owner, l.phone, l.subLocation].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase())))
  );

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const currentPage = Math.min(leadsPage, totalPages);
  const pagedLeads = filteredLeads.slice((currentPage - 1) * LEADS_PER_PAGE, currentPage * LEADS_PER_PAGE);

  useEffect(() => { setLeadsPage(1); }, [filterSalesman, filterStatus, filterDate, searchQuery]);

  return (
    <div className={phone && page !== "reports" ? "engage-admin-mobile-content" : undefined} style={{ padding: desktopDeals || desktopContacts ? "20px 28px" : "20px 24px", maxWidth: desktopDeals || desktopContacts ? 1500 : 1180, margin: "0 auto" }}>
      {page === "reports" ? (
        <ReportsPage salesmen={salesmen} leads={leads} />
      ) : (
        <>
      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "9px 12px", marginBottom: 14 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}
      {online && !wsConnected && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.warn, background: T.warnSoft, borderRadius: 11, padding: "8px 12px", marginBottom: 14 }}>
          <RefreshCw size={12} className="spin" /> Reconnecting live updates… data still refreshes every 15s in the meantime.
        </div>
      )}

      <div hidden={!showDashboard}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard variant="dashboard" label="Total Employees" value={salesmen.length} sub={<span style={{color:T.verified}}>{activeSalesmen} active now</span>} icon={Contact2} color="#64748B" />
        <StatCard variant="dashboard" label="Conversation" value={conversationCount ?? "—"} icon={MessageSquare} color={T.route} onClick={async () => { try { setConversationError(""); const result=await api.adminLeads({status:"conversation"}); setStatLeadsModal({title:conversationCount>500?"Conversation Leads · Latest 500":"Conversation Leads",leads:(result.leads||[]).map(mapLeadRow)}); } catch(e) { setConversationError(e.message); } }} />
        <StatCard variant="dashboard" label="Leads Today" value={todayLeads.length} icon={TargetIcon} color="#3B82F6" onClick={() => setStatLeadsModal({ title: "Leads Today", leads: todayLeads })} />
        <StatCard variant="dashboard" label={<>Hot Leads <span style={{ fontSize: 8.5, opacity: 0.65 }}>TODAY</span></>} value={hotLeadsToday.length} icon={Flame} comparison={hotComparison} comparisonPeriod={dashboardDisplay.comparisonPeriod} color={T.danger} onClick={() => setStatLeadsModal({ title: "Hot Leads Today", leads: hotLeadsToday })} />
        <StatCard variant="dashboard" label="In Negotiation" value={inNegotiation.length} icon={Handshake} color="#8B5CF6" onClick={() => setStatLeadsModal({ title: "In Negotiation", leads: inNegotiation })} />
        <StatCard variant="dashboard" label="Total Leads" value={dashboardLeads.length} comparison={dashboardComparison} comparisonPeriod={dashboardDisplay.comparisonPeriod} icon={Contact2} color="#0891B2" />
        <StatCard variant="dashboard" label="Won" value={converted} icon={CheckCircle2} color={T.verified} onClick={() => setStatLeadsModal({ title: "Won Leads", leads: dashboardLeads.filter((l) => l.status === "won") })} />
        <StatCard variant="dashboard" label="Upcoming Follow-up" value={upcomingFollowUps.length} icon={CalendarClock} color={T.warn} onClick={() => setStatLeadsModal({ title: "Upcoming Follow-ups", leads: upcomingFollowUps })} />
        <StatCard variant="dashboard" label="Renewals Due" sub="next 30 days" value={upcomingRenewals.length} icon={RefreshCw} color={T.accent} onClick={() => setStatLeadsModal({ title: "Renewals Due (Next 30 Days)", leads: upcomingRenewals })} />
      </div>

      {conversationError && <p role="alert" style={{color:T.danger}}>{conversationError}</p>}
      <TasksEntry />
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: phone ? "nowrap" : "wrap", alignItems: "center", width: phone ? "100%" : "auto" }}>
        <div style={{ flex: phone ? "1 1 0" : "0 0 auto", minWidth: 0 }}><Tab active={mapView === "live"} onClick={() => setMapView("live")} label="Live Map" /></div>
        <div style={{ flex: phone ? "1.25 1 0" : "0 0 auto", minWidth: 0 }}><Tab active={mapView === "leads"} onClick={() => setMapView("leads")} label="Lead Locations" /></div>
        <select
          aria-label="Dashboard employee"
          value={dashboardSalesman}
          onChange={(e) => setDashboardSalesman(e.target.value)}
          style={{ flex: phone ? "1.15 1 0" : "0 0 auto", minWidth: 0, width: phone ? 0 : "auto", fontSize: 12.5, fontWeight: 600, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, cursor: "pointer" }}
        >
          <option value="all">👥 All Team</option>
          {salesmen.map((s) => <option key={s.id} value={s.id}>👤 {s.name}</option>)}
        </select>
      </div>

      </div>
      <div hidden={!showDashboard && section !== "employees"}>
      {mapView === "live" || (sectionNavigation && section === "employees") ? (
        <div className={sectionNavigation && section === "employees" ? undefined : "ft-dashboard-grid"}>
          {showDashboard && <LiveMap salesmen={salesmen} leads={leads} onSelectLead={setSelectedLead} />}
          <SalesmenPanel
            salesmen={salesmen}
            leads={leads}
            onAddClick={() => setShowAddSalesman(true)}
            onSettingsClick={setEmployeeSettings}
            onBriefClick={setBriefSalesman}
            onDeleteClick={setDeleteSalesmanConfirm}
            onViewRoute={setRouteSalesman}
            onMessageClick={setMessageTarget}
            onOpenSalesmanLeads={setViewingSalesmanLeads}
          />
        </div>
      ) : (
        <LiveMap salesmen={[]} leads={filteredLeads} onSelectLead={setSelectedLead} title="Lead Locations" subtitle="Respects the employee/status/date filters below" />
      )}

      </div>
      <div hidden={!showLeads}>
      <div className={`ft-card${desktopDeals ? " engage-desktop-deals" : desktopContacts ? " engage-desktop-contacts" : ""}`} style={{ marginTop: 20, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div><div className={desktopDeals ? "engage-deals-title" : desktopContacts ? "engage-contacts-heading" : undefined} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{sectionNavigation && section === "deals" ? (desktopSection ? "Pipeline" : "Deals") : desktopContacts ? "Contacts" : "Leads"}</div>{desktopContacts && <div className="engage-contacts-summary">{filteredLeads.length} contact records · Your restaurant connections</div>}{desktopDeals && <div className="engage-deals-summary">{filteredLeads.length} deals · {fmtMoney(filteredLeads.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0))} recorded value</div>}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: sectionNavigation && section !== "dashboard" && !desktopDeals ? "none" : "flex", gap: 2, background: T.paperDeep, borderRadius: 8, padding: 2 }}>
              <button
                onClick={() => setLeadsViewMode("list")}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: leadsViewMode === "list" ? "#fff" : "transparent", color: leadsViewMode === "list" ? T.ink : T.inkSoft, boxShadow: leadsViewMode === "list" ? "0 1px 2px rgba(20,20,30,0.08)" : "none" }}
              >
                <List size={13} /> List
              </button>
              <button
                onClick={() => setLeadsViewMode("board")}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: leadsViewMode === "board" ? "#fff" : "transparent", color: leadsViewMode === "board" ? T.ink : T.inkSoft, boxShadow: leadsViewMode === "board" ? "0 1px 2px rgba(20,20,30,0.08)" : "none" }}
              >
                <LayoutGrid size={13} /> Board
              </button>
            </div>
            {onAddLead && (
              <button
                onClick={() => setShowAdminAddLead(true)}
                title="Add lead"
                className={desktopDeals ? "engage-deals-add" : desktopContacts ? "engage-contacts-add" : undefined}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", background: T.route, color: "#fff" }}
              >
                <Plus size={16} />{(desktopDeals || desktopContacts) && "Add Lead"}
              </button>
            )}
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={desktopContacts ? "Search contacts" : "Search leads"}
            placeholder={desktopContacts ? "Search by contact, company, phone, or area…" : "Search leads by business, contact, phone, or area…"}
            style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13.5, boxSizing: "border-box" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}>
              <X size={14} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Select value={filterSalesman} onChange={setFilterSalesman} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
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
            <DownloadMenu
              onCsv={() => window.open(buildExportUrl("csv", { salesmanId: filterSalesman, status: filterStatus, date: filterDate }), "_blank")}
              onXlsx={() => window.open(buildExportUrl("xlsx", { salesmanId: filterSalesman, status: filterStatus, date: filterDate }), "_blank")}
              onSheets={async () => {
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
          <div style={{ fontSize: 12, background: T.paperDeep, borderRadius: 11, padding: "10px 12px", marginBottom: 12 }}>
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

        {(sectionNavigation && section === "leads") || ((desktopDeals || !(sectionNavigation && section === "deals")) && leadsViewMode === "list") ? (
          <>
        {desktopContacts ? <DesktopContacts leads={pagedLeads} onSelectLead={setSelectedLead} renderVerification={l=>l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pagedLeads.map((l) => (
            <div key={l.id} className="ft-row" onClick={() => setSelectedLead(l)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", border: `1px solid ${T.line}`, borderRadius: 11, cursor: "pointer", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{l.business}</div>
                  <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {l.salesmanName} · {fmtTime(l.createdAt)}{l.hasLocation ? ` · ${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {l.hasLocation ? <VerificationStamp status={l.verification} small /> : <NoLocationBadge small />}
                <span style={{ fontSize: 12, fontWeight: 700, color: T.route, background: "#EEF1FD", padding: "5px 12px", borderRadius: 999 }}>{STATUS_LABEL[l.status]}</span>
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
        )}

        {filteredLeads.length > LEADS_PER_PAGE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 12, color: T.inkSoft }}>
              Showing {(currentPage - 1) * LEADS_PER_PAGE + 1}–{Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12.5, cursor: currentPage <= 1 ? "not-allowed" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <span style={{ fontSize: 12.5, color: T.inkSoft }}>Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setLeadsPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12.5, cursor: currentPage >= totalPages ? "not-allowed" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
          </>
        ) : (
          desktopDeals ? <DesktopDealsBoard leads={filteredLeads} visibleStatus={filterStatus} onStatusChange={onStatusChange} onSelectLead={setSelectedLead} /> : <LeadsBoardView leads={filteredLeads} onStatusChange={onStatusChange} onSelectLead={setSelectedLead} />
        )}
      </div>

      </div>
      {expensesVisited && <div hidden={!phone || mobileTab !== "expenses"}><ExpensesReport salesmen={salesmen} /></div>}
      {tasksVisited && <div hidden={desktopSection !== "tasks"}><TasksModal embedded active={desktopSection === "tasks"} /></div>}
      <AdminMobileNav active={mobileTab} onChange={switchMobileTab} />

      {selectedLead && <LeadDetailDrawer lead={leads.find((l) => l.id === selectedLead.id) || selectedLead} onClose={() => setSelectedLead(null)} onStatusChange={onStatusChange} onUpdate={onUpdateLead} onDelete={onDeleteLead} fetchHistory={api.adminLeadHistory} isAdmin />}
      {routeSalesman && <SalesmanRouteModal salesman={routeSalesman} onClose={() => setRouteSalesman(null)} />}
      {showAdminAddLead && (
        <AdminAddLeadModal
          salesmen={salesmen}
          onClose={() => setShowAdminAddLead(false)}
          onSubmit={async (payload) => {
            await onAddLead(payload);
            showSaveFeedback("Lead saved");
            setShowAdminAddLead(false);
          }}
        />
      )}
      {viewingSalesmanLeads && (
        <SalesmanLeadsModal
          salesman={viewingSalesmanLeads}
          leads={leads}
          onClose={() => setViewingSalesmanLeads(null)}
          onSelectLead={(l) => { setViewingSalesmanLeads(null); setSelectedLead(l); }}
        />
      )}
      {showAddSalesman && (
        <SalesmanFormModal
          existingCount={salesmen.length}
          onClose={() => setShowAddSalesman(false)}
          onSubmit={async (s) => { await onAddSalesman(s); setShowAddSalesman(false); }}
        />
      )}
      {briefSalesman && <SalesmanBriefPopup key={briefSalesman.id} salesman={briefSalesman} onClose={()=>setBriefSalesman(null)} />}
      {employeeSettings && <EmployeeSettings employee={employeeSettings} isActive={salesmen.find(x=>x.id===employeeSettings.id)?.isActive!==false} onToggleActive={()=>onToggleSalesmanActive(employeeSettings.id, salesmen.find(x=>x.id===employeeSettings.id)?.isActive===false)} onClose={()=>setEmployeeSettings(null)} onEdit={()=>{setEditSalesman(employeeSettings);setEmployeeSettings(null)}} onDelete={()=>{setDeleteSalesmanConfirm(employeeSettings);setEmployeeSettings(null)}} />}
      {editSalesman && (
        <SalesmanFormModal
          salesman={editSalesman}
          onClose={() => setEditSalesman(null)}
          onSubmit={async (payload) => { await onEditSalesman(editSalesman.id, payload); setEditSalesman(null); }}
        />
      )}
      {deleteSalesmanConfirm && (
        <Overlay onClose={() => { setDeleteSalesmanConfirm(null); setDeleteSalesmanError(""); }} title={`Delete ${deleteSalesmanConfirm.name}?`}>
          <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>
            This permanently removes their account. If they still have any leads, this will be blocked — delete those first.
          </div>
          {deleteSalesmanError && (
            <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{deleteSalesmanError}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setDeleteSalesmanConfirm(null); setDeleteSalesmanError(""); }} style={{ flex: 1, padding: 10, borderRadius: 11, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button
              onClick={async () => {
                try {
                  await onDeleteSalesman(deleteSalesmanConfirm.id);
                  setDeleteSalesmanConfirm(null);
                  setDeleteSalesmanError("");
                } catch (err) {
                  setDeleteSalesmanError(err instanceof ApiError ? err.message : "Couldn't delete this employee.");
                }
              }}
              style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", background: T.danger, color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Delete permanently
            </button>
          </div>
        </Overlay>
      )}
      {statLeadsModal && (
        <MyLeadsModal
          leads={statLeadsModal.leads}
          title={statLeadsModal.title}
          onClose={() => setStatLeadsModal(null)}
          onSelectLead={(l) => { setStatLeadsModal(null); setSelectedLead(l); }}
        />
      )}
      {messageTarget && (
        <MessageComposeModal
          salesman={messageTarget === "all" ? null : messageTarget}
          onClose={() => setMessageTarget(null)}
          onSend={(body) => api.adminSendMessage({ recipientId: messageTarget === "all" ? null : messageTarget.id, body })}
        />
      )}
      </>
      )}
    </div>
  );
}

// A little more visual flair than a plain bar — gradient fill, a percentage
// chip that shifts to green once the target's hit, and a trophy nod for it.
// Tap a salesman's name to see just their leads, broken out by Hot/Warm/
// Cold/Converted/Pending — instead of hunting through the main filtered list.
const REPORT_CARDS = [
  { key: "deal-values", title: "Deal Value", desc: "Total deal value for Cold, Hot, Negotiation and every stage.", icon: Wallet, color: "#145C5D" },
  { key: "performance", title: "Employee performance", desc: "Weekly/monthly leads, follow-ups, quotations, wins, sales and collections.", icon: Contact2, color: "#145C5D" },
  { key: "funnel", title: "Funnel and conversion", desc: "Lead count and drop-off at each pipeline stage.", icon: Handshake, color: "#7B4FC9" },
  { key: "renewals", title: "Renewals due", desc: "Everything renewing in the next 30, 60 or 90 days.", icon: CalendarClock, color: "#B8791F" },
  { key: "payments", title: "Payments", desc: "Collections, pending balances, overdue payments and receipts in one place.", icon: Wallet, color: "#C0392B" },
  { key: "expenses", title: "Expenses", desc: "Salary and other spending, broken down by category.", icon: Receipt, color: "#993C1D" },
  { key: "daily", title: "Daily activity", desc: "Visits, leads touched and distance travelled per day.", icon: MapPin, color: "#12805C" },
  { key: "stage", title: "Time in stage", desc: "Average days a lead spends at each status.", icon: Clock, color: "#8B5E00" },
  { key: "quality", title: "Data quality", desc: "Find leads missing important sales information and fix them.", icon: AlertTriangle, color: "#B8791F" },
  { key: "export", title: "Lead export", desc: "Download leads as CSV, Excel, or push to Google Sheets.", icon: Download, color: "#1D7A8C" },
];

function ReportsPage({ salesmen, leads }) {
  const [active, setActive] = useState(null);
  const activeCard = REPORT_CARDS.find((c) => c.key === active);

  if (!active) {
    return (
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Reports</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 16 }}>Choose a report to view</div>
        <DayClosingReportsEntry />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {REPORT_CARDS.map((c) => (
            <div
              key={c.key}
              onClick={() => setActive(c.key)}
              className="ft-card"
              style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, cursor: "pointer", boxShadow: "0 1px 2px rgba(20,20,30,0.04)" }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${c.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <c.icon size={17} color={c.color} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setActive(null)}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16 }}
      >
        ← Back to reports
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {activeCard && <activeCard.icon size={18} color={activeCard.color} />}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{activeCard?.title}</div>
      </div>
      {active === "deal-values" && <DealValueReport />}
      {active === "performance" && <SalesmanPerformanceReport salesmen={salesmen} leads={leads} />}
      {active === "funnel" && <FunnelReport leads={leads} />}
      {active === "renewals" && <RenewalsReport leads={leads} />}
      {active === "payments" && <CollectionsPanel embedded />}
      {active === "expenses" && <ExpensesReport salesmen={salesmen} />}
      {active === "daily" && <DailyActivityReport salesmen={salesmen} />}
      {active === "stage" && <TimeInStageReport />}
      {active === "quality" && <DataQualityReport salesmen={salesmen} />}
      {active === "export" && <LeadExportReport salesmen={salesmen} />}
    </div>
  );
}


function DataQualityReport({ salesmen }) {
  const [employee, setEmployee] = useState("");
  const [issue, setIssue] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    api.dataQualityReport({ ...(employee ? { salesmanId: employee } : {}), ...(issue !== "all" ? { issue } : {}) })
      .then(setData).catch((e) => setError(e.message || "Couldn't load data quality.")).finally(() => setLoading(false));
  }, [employee, issue]);
  useEffect(() => { load(); }, [load]);

  const labels = { followup:"No follow-up", contact:"No contact", location:"No location", pos:"Missing POS", deal_value:"Deal value" };
  const issueCards = [
    ["followup","No follow-up",CalendarClock],
    ["contact","No contact",PhoneIcon],
    ["location","No location",MapPin],
    ["pos","Missing POS",Receipt],
    ["deal_value","Deal value",Wallet],
  ];
  const totalIssues = data ? Object.keys(labels).reduce((n,k)=>n+Number(data.counts?.[k]||0),0) : 0;
  const affected = Number(data?.counts?.total || 0);

  return <div>
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:"'Space Grotesk', sans-serif",fontWeight:750,fontSize:19,color:T.ink}}>Data quality</div>
      <div style={{fontSize:12.5,color:T.inkSoft,marginTop:3}}>Keep your CRM complete and sales-ready.</div>
    </div>

    {loading && <div style={{fontSize:13,color:T.inkSoft,display:"flex",gap:7,alignItems:"center"}}><Loader2 size={14} className="spin"/> Checking CRM data…</div>}
    {error && <div style={{fontSize:13,color:T.danger}}>{error}</div>}
    {data && !loading && <>
      <div style={{background:"linear-gradient(135deg, #123F3D 0%, #17635C 100%)",borderRadius:16,padding:"18px 18px 16px",color:"#fff",marginBottom:14,boxShadow:"0 8px 24px rgba(18,63,61,.12)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.7,opacity:.72,fontWeight:700}}>CRM DATA CHECK</div>
            <div style={{fontSize:28,fontWeight:800,marginTop:5,lineHeight:1}}>{affected}</div>
            <div style={{fontSize:13,opacity:.9,marginTop:5}}>{affected === 1 ? "lead needs fixing" : "leads need fixing"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:800}}>{totalIssues}</div>
            <div style={{fontSize:11.5,opacity:.75}}>missing items</div>
          </div>
        </div>
      </div>

      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.55,color:T.inkSoft,fontWeight:800,margin:"16px 0 9px"}}>Issues</div>
      <div className="dq-issue-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(125px,1fr))",gap:8,marginBottom:15}}>
        {issueCards.map(([key,label,Icon])=>{
          const selected=issue===key;
          return <button key={key} onClick={()=>setIssue(selected?"all":key)} style={{textAlign:"left",background:selected?"#EAF5F0":"#fff",border:`1px solid ${selected?T.route:T.line}`,borderRadius:12,padding:"11px 12px",cursor:"pointer",color:T.ink,minHeight:76}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span style={{width:27,height:27,borderRadius:8,background:selected?T.route:"#F3F7F5",color:selected?"#fff":T.route,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Icon size={14}/></span>
              <span style={{fontSize:18,fontWeight:800}}>{data.counts?.[key]||0}</span>
            </div>
            <div style={{fontSize:11.5,fontWeight:700,marginTop:7,color:selected?T.route:T.inkSoft}}>{label}</div>
          </button>
        })}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:11}}>
        <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.55,color:T.inkSoft,fontWeight:800}}>Leads to fix · {affected}</div>
        <div style={{display:"flex",gap:7}}>
          <select value={employee} onChange={e=>setEmployee(e.target.value)} style={{height:34,border:`1px solid ${T.line}`,borderRadius:9,padding:"0 9px",background:"#fff",color:T.ink,fontSize:12}}>
            <option value="">All employees</option>
            {salesmen.map(x=><option key={x.id} value={x.id}>{x.name || x.fullName || x.full_name}</option>)}
          </select>
          {issue!=="all" && <button onClick={()=>setIssue("all")} style={{height:34,border:`1px solid ${T.line}`,borderRadius:9,padding:"0 10px",background:"#fff",color:T.inkSoft,fontSize:12,cursor:"pointer"}}>Clear</button>}
        </div>
      </div>

      <div style={{display:"grid",gap:8}}>
        {(data.leads||[]).map(lead=><div key={lead.id} style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:13,padding:"12px 13px",boxShadow:"0 1px 2px rgba(20,20,30,.025)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{display:"flex",gap:10,minWidth:0}}>
              <div style={{...leadAvatarStyle(lead.business_name),width:34,height:34,minWidth:34,fontSize:11}}>{leadInitials(lead.business_name)}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13.5,fontWeight:750,color:T.ink,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.business_name}</div>
                <div style={{fontSize:11.5,color:T.inkSoft,marginTop:2}}>{STATUS_LABEL[lead.status]||lead.status} · {lead.salesman_name}</div>
              </div>
            </div>
            <span style={{fontSize:17,color:T.inkSoft}}>›</span>
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:9,paddingLeft:44}}>
            {lead.issues.map(k=><span key={k} style={{fontSize:10.5,padding:"4px 7px",borderRadius:999,background:"#FFF7E8",border:"1px solid #F3DFC0",color:"#8B5E00",fontWeight:650}}>⚠ {labels[k]}</span>)}
          </div>
        </div>)}
        {!data.leads?.length && <div style={{padding:"28px 18px",textAlign:"center",background:"#fff",border:`1px solid ${T.line}`,borderRadius:13}}>
          <CheckCircle2 size={24} color={T.route}/>
          <div style={{fontSize:13.5,fontWeight:700,color:T.ink,marginTop:8}}>Everything looks clean</div>
          <div style={{fontSize:12,color:T.inkSoft,marginTop:3}}>No data-quality issues for this filter.</div>
        </div>}
      </div>
    </>}
  </div>;
}

function SalesmanPerformanceReport({ salesmen }) {
  const now = new Date();
  const localDay = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  const [anchor,setAnchor]=useState(localDay);
  const [employee,setEmployee]=useState("");
  const [data,setData]=useState(null);
  const [targets,setTargets]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const money=n=>fmtMoney(Number(n||0));

  const load=useCallback(()=>{
    setLoading(true);setError("");
    Promise.all([
      api.performanceReport({period:"month",anchor,...(employee?{salesmanId:employee}:{})}),
      api.performanceTargets({month:anchor})
    ]).then(([p,t])=>{setData(p);setTargets(t.targets||[])}).catch(e=>setError(e.message||"Couldn't load performance.")).finally(()=>setLoading(false));
  },[anchor,employee]);
  useEffect(()=>{load()},[load]);

  const targetFor=id=>targets.find(t=>t.salesman_id===id)||{};
  const pct=(value,target)=>target>0?Math.min(100,Math.round((Number(value||0)/Number(target))*100)):null;
  const monthLabel=new Date(`${anchor.slice(0,7)}-01T00:00:00`).toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  const metric=(label,value,target,format=false)=>{
    const progress=pct(value,target);
    return <div style={{marginTop:10}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:11.5}}>
        <span style={{color:T.inkSoft}}>{label}</span>
        <span style={{fontWeight:750,color:T.ink}}>{format?money(value):value}{target>0?` / ${format?money(target):target}`:""}</span>
      </div>
      {target>0&&<><div style={{height:5,borderRadius:99,background:"#E9EFEC",overflow:"hidden",marginTop:5}}><div style={{height:"100%",width:`${progress}%`,background:T.route,borderRadius:99}}/></div><div style={{fontSize:10,color:T.inkSoft,textAlign:"right",marginTop:2}}>{progress}%</div></>}
    </div>
  };

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:10,flexWrap:"wrap",marginBottom:15}}>
      <div><div style={{fontSize:15,fontWeight:750,color:T.ink}}>Monthly performance & targets</div><div style={{fontSize:12,color:T.inkSoft,marginTop:3}}>{monthLabel} · Restaurant visits → Leads → Demos → Won → Sales value.</div></div>
      <div style={{display:"flex",gap:7}}>
        <input type="month" value={anchor.slice(0,7)} onChange={e=>setAnchor(`${e.target.value}-01`)} style={{height:36,border:`1px solid ${T.line}`,borderRadius:9,padding:"0 9px",background:"#fff",color:T.ink}}/>
        <select value={employee} onChange={e=>setEmployee(e.target.value)} style={{height:36,border:`1px solid ${T.line}`,borderRadius:9,padding:"0 9px",background:"#fff",color:T.ink}}>
          <option value="">All employees</option>{salesmen.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
    </div>
    {error&&<div style={{padding:11,borderRadius:10,background:"#fff3f0",color:T.danger,marginBottom:12,fontSize:12.5}}>{error}</div>}
    {loading?<div style={{padding:24,color:T.inkSoft}}>Loading performance…</div>:data&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:8,marginBottom:17}}>
        {[
          ["Leads",data.totals.leads],
          ["Restaurant visits",data.totals.visits],
          ["Demos",data.totals.demos],
          ["Won",data.totals.won],
          ["Sales value",money(data.totals.sales_value)]
        ].map(([l,v])=><div key={l} style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:12,padding:"12px 13px"}}><div style={{fontSize:10.5,color:T.inkSoft,textTransform:"uppercase",letterSpacing:.4,fontWeight:700}}>{l}</div><div style={{fontSize:20,fontWeight:800,color:T.ink,marginTop:4}}>{v}</div></div>)}
      </div>

      <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:.55,color:T.inkSoft,fontWeight:800,marginBottom:9}}>Employee progress</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:10}}>
        {data.rows.map(r=>{const tg=targetFor(r.id);return <div key={r.id} style={{background:"#fff",border:`1px solid ${T.line}`,borderRadius:14,padding:14,boxShadow:"0 1px 2px rgba(20,20,30,.03)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <div><div style={{fontSize:14,fontWeight:800,color:T.ink}}>{r.full_name}</div><div style={{fontSize:11.5,color:T.inkSoft,marginTop:2}}>{r.won} won · {money(r.sales_value)} sales</div></div>
            <span style={{fontSize:10.5,color:T.inkSoft}}>Targets set in Employee Settings</span>
          </div>
          <>
            {metric("Restaurant visits",r.visits,tg.visits_target)}
            {metric("New leads",r.leads,tg.leads_target)}
            {metric("Demos",r.demos,tg.demos_target)}
            {metric("Deals won",r.won,tg.won_target)}
            {metric("Sales value",r.sales_value,tg.sales_value_target,true)}
            {(()=>{
              const earned =
                Math.max(0,Number(r.visits||0)-Number(tg.visits_target||0))*Number(tg.visits_incentive||0) +
                Math.max(0,Number(r.leads||0)-Number(tg.leads_target||0))*Number(tg.leads_incentive||0) +
                Math.max(0,Number(r.demos||0)-Number(tg.demos_target||0))*Number(tg.demos_incentive||0) +
                Math.max(0,Number(r.won||0)-Number(tg.won_target||0))*Number(tg.won_incentive||0) +
                Math.max(0,Number(r.sales_value||0)-Number(tg.sales_value_target||0))*Number(tg.sales_value_incentive_pct||0)/100;
              return earned>0?<div style={{marginTop:12,padding:"9px 10px",borderRadius:9,background:"#F0F8F4",color:T.route,fontSize:12,fontWeight:750}}>Calculated incentive · {money(earned)}</div>:null;
            })()}
          </>
        </div>})}
      </div>
      {!data.rows.length&&<EmptyReportState text="No employees found for this filter."/>}
    </>}
  </div>;
}


function FunnelReport({ leads }) {
  const total = leads.length;
  const counts = STATUSES.map((s) => ({ status: s, count: leads.filter((l) => l.status === s).length }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  if (total === 0) return <EmptyReportState text="No leads yet." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {counts.map((c) => {
        const pctOfTotal = total ? Math.round((c.count / total) * 100) : 0;
        const barPct = Math.round((c.count / maxCount) * 100);
        return (
          <div key={c.status}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{STATUS_LABEL[c.status]}</span>
              <span style={{ color: T.inkSoft }}>{c.count} leads · {pctOfTotal}%</span>
            </div>
            <div style={{ height: 9, background: T.paperDeep, borderRadius: 11, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${barPct}%`, background: T.route, borderRadius: 11, transition: "width 0.3s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RenewalsReport({ leads }) {
  const [days, setDays] = useState(30);
  const upcoming = leads.filter((l) =>
    (l.renewalDate && isWithinDays(new Date(l.renewalDate), days)) ||
    (!l.renewalDate && days >= 30 && isUpcomingRenewalMonth(l.renewalMonth))
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${days === d ? T.route : T.line}`, background: days === d ? T.route : "#fff", color: days === d ? "#fff" : T.ink, fontWeight: 600 }}
          >
            Next {d} days
          </button>
        ))}
      </div>
      {upcoming.length === 0 ? (
        <EmptyReportState text={`No renewals due in the next ${days} days.`} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((l) => (
            <div key={l.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 11, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.business}</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{l.owner} · {l.phone}</div>
              </div>
              <div style={{ fontSize: 12.5, color: T.accent, fontWeight: 600, textAlign: "right" }}>
                {l.renewalDate || l.renewalMonth || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentDueReport({ salesmen }) {
  const [salesmanId, setSalesmanId] = useState("all");
  const [onlyPending, setOnlyPending] = useState(true);
  const [payments, setPayments] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [recordingFor, setRecordingFor] = useState(null); // the payment row being paid against
  const [expandedLeadId, setExpandedLeadId] = useState(null);
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(() => {
    setPayments(null);
    setError("");
    api.adminPayments({ salesmanId, onlyPending: onlyPending ? "true" : "" })
      .then((res) => { setPayments(res.payments || []); setSummary(res.summary || null); })
      .catch((err) => setError(err.message || "Couldn't load payments."));
  }, [salesmanId, onlyPending]);

  useEffect(() => { load(); window.addEventListener("fieldtrail:payments-updated",load); return()=>window.removeEventListener("fieldtrail:payments-updated",load); }, [load]);

  const exportParams = { salesmanId, onlyPending: onlyPending ? "true" : "" };

  return (
    <div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
          <StatCard label="Pending" value={fmtMoney(summary.pendingTotal)} icon={Wallet} color={T.danger} />
          <StatCard label="Collected this month" value={fmtMoney(summary.collectedThisMonth)} icon={CalendarClock} color={T.verified} />
          <StatCard label="Collected all time" value={fmtMoney(summary.collectedAllTime)} icon={CheckCircle2} color={T.route} />
          <StatCard label="Total deal value" value={fmtMoney(summary.dealValueTotal)} icon={TargetIcon} color={T.accent} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Select value={salesmanId} onChange={setSalesmanId} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
          <button
            onClick={() => setOnlyPending((v) => !v)}
            style={{ fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${onlyPending ? T.route : T.line}`, background: onlyPending ? T.route : "#fff", color: onlyPending ? "#fff" : T.ink, fontWeight: 600 }}
          >
            {onlyPending ? "Showing pending only" : "Showing all Won deals"}
          </button>
        </div>
        <DownloadMenu
          onCsv={() => window.open(buildExportUrl("csv", exportParams, "payments"), "_blank")}
          onXlsx={() => window.open(buildExportUrl("xlsx", exportParams, "payments"), "_blank")}
          onPdf={() => window.open(buildExportUrl("pdf", exportParams, "payments"), "_blank")}
          onSheets={async () => {
            setSheetsError("");
            try {
              const info = await api.adminExportPaymentsSheetsInfo(exportParams);
              setSheetsInfo(info);
            } catch (err) {
              setSheetsError(err.message || "Couldn't prepare the Sheets export.");
            }
          }}
        />
      </div>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by business, contact, or phone…"
          style={{ ...inputStyle, marginBottom: 0, width: "100%", padding: "9px 12px 9px 32px", boxSizing: "border-box" }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}>
            <X size={14} />
          </button>
        )}
      </div>
      {sheetsError && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{sheetsError}</div>}
      {sheetsInfo && (
        <div style={{ fontSize: 12, background: T.paperDeep, borderRadius: 11, padding: "10px 12px", marginBottom: 14 }}>
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
      {error && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>{error}</div>}
      {payments === null && !error && (
        <div style={{ fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      )}
      {payments && payments.length === 0 && <EmptyReportState text={onlyPending ? "Nothing pending — everything's been paid." : "No Won deals with a deal value yet."} />}

      {(() => {
        const filteredPayments = (payments || []).filter(
          (p) => !searchQuery.trim() || [p.business, p.contactName, p.phone].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        );
        if (!payments || payments.length === 0) return null;
        if (filteredPayments.length === 0) return <EmptyReportState text="No payments match that search." />;
        return (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredPayments.map((p) => {
              const isExpanded = expandedLeadId === p.leadId;
              return (
                <div key={p.leadId} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.business}</div>
                      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>{p.salesmanName} · {p.contactName} · {p.phone}</div>
                    </div>
                    {p.pending > 0 && (
                      <button
                        onClick={() => setRecordingFor(p)}
                        style={{ fontSize: 11.5, fontWeight: 700, padding: "6px 10px", borderRadius: 7, border: "none", background: T.route, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Record payment
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12.5 }}>
                    <div><span style={{ color: T.inkSoft }}>Total </span><span style={{ fontWeight: 700 }}>{fmtMoney(p.dealValue)}</span></div>
                    <div><span style={{ color: T.inkSoft }}>Paid </span><span style={{ fontWeight: 700, color: T.verified }}>{fmtMoney(p.paidTotal)}</span></div>
                    <div><span style={{ color: T.inkSoft }}>Pending </span><span style={{ fontWeight: 700, color: p.pending > 0 ? T.danger : T.verified }}>{fmtMoney(p.pending)}</span></div>
                  </div>
                  {p.paymentCount > 0 && (
                    <button
                      onClick={() => setExpandedLeadId(isExpanded ? null : p.leadId)}
                      style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {isExpanded ? "Hide" : "View"} {p.paymentCount} payment{p.paymentCount === 1 ? "" : "s"} {isExpanded ? "▲" : "▼"}
                    </button>
                  )}
                  {isExpanded && <PaymentHistoryList leadId={p.leadId} onChanged={load} />}
                </div>
              );
            })}
          </div>
        </>
        );
      })()}

      {recordingFor && (
        <RecordPaymentModal
          row={recordingFor}
          onClose={() => setRecordingFor(null)}
          onRecorded={() => { setRecordingFor(null); load(); }}
        />
      )}
    </div>
  );
}

function PaymentHistoryList({ leadId, onChanged }) {
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // the payment being edited

  const load = useCallback(() => {
    api.adminLeadPayments(leadId).then((res) => setPayments(res.payments || [])).catch((err) => setError(err.message || "Couldn't load payment history."));
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const del = async (paymentId) => {
    try {
      await api.adminDeletePayment(leadId, paymentId);
      load();
      onChanged();
    } catch (err) {
      setError(err.message || "Couldn't delete that payment.");
    }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 6 }}>
      {error && <div style={{ fontSize: 11.5, color: T.danger }}>{error}</div>}
      {payments === null && !error && <div style={{ fontSize: 12, color: T.inkSoft }}>Loading…</div>}
      {payments && payments.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12 }}>
          <div>
            <span style={{ fontWeight: 700 }}>{fmtMoney(p.amount)}</span>
            <span style={{ color: T.inkSoft }}> · {new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{p.note ? ` · ${p.note}` : ""} · {p.recordedByName}</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={() => setEditing(p)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4 }} aria-label="Edit payment">
              <Pencil size={13} />
            </button>
            <button onClick={() => del(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4 }} aria-label="Delete payment">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
      {editing && (
        <EditPaymentModal
          leadId={leadId}
          payment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged(); }}
        />
      )}
    </div>
  );
}

function EditPaymentModal({ leadId, payment, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [note, setNote] = useState(payment.note || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a valid amount."); return; }
    setSaving(true);
    setError("");
    try {
      await api.adminEditPayment(leadId, payment.id, { amount: num, note: note.trim() || undefined });
      onSaved();
    } catch (err) {
      setError(err.message || "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay title="Edit payment" onClose={onClose}>
      <form onSubmit={submit}>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Amount</label>
        <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} autoFocus />
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Note (optional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
        {error && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{error}</div>}
        <button
          type="submit" disabled={saving}
          style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: T.route, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Overlay>
  );
}

function RecordPaymentModal({ row, onClose, onRecorded }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) { setError("Enter a valid amount."); return; }
    if (num > row.pending + 0.01) { setError(`That's more than the ${fmtMoney(row.pending)} still pending.`); return; }
    setSaving(true);
    setError("");
    try {
      await api.adminRecordPayment(row.leadId, { amount: num, note: note.trim() || undefined });
      onRecorded();
    } catch (err) {
      setError(err.message || "Couldn't record that payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay title={`Record payment — ${row.business}`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>
        {fmtMoney(row.pending)} pending of {fmtMoney(row.dealValue)} total.
      </div>
      <form onSubmit={submit}>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Amount received</label>
        <input
          type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder={`Up to ${row.pending}`} style={inputStyle} autoFocus
        />
        <label style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.3 }}>Note (optional)</label>
        <input
          type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. UPI, part payment" style={inputStyle}
        />
        {error && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{error}</div>}
        <button
          type="submit" disabled={saving}
          style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: T.route, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Record payment"}
        </button>
      </form>
    </Overlay>
  );
}

function ExpensesReport({ salesmen }) {
  const [category, setCategory] = useState("all");
  const [salesmanId, setSalesmanId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setExpenses(null);
    setError("");
    api.adminExpenses({ category, salesmanId, from, to })
      .then((res) => setExpenses(res.expenses || []))
      .catch((err) => setError(err.message || "Couldn't load expenses."));
  }, [category, salesmanId, from, to]);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    try {
      await api.adminDeleteExpense(id);
      load();
    } catch (err) {
      setError(err.message || "Couldn't delete that expense.");
    }
  };

  const total = (expenses || []).reduce((sum, e) => sum + e.amount, 0);
  const byCategory = {};
  (expenses || []).forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...categoryRows.map(([, v]) => v));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Select value={category} onChange={setCategory} options={[["all", "All categories"], ...EXPENSE_CATEGORIES.map((c) => [c, c])]} />
        <Select value={salesmanId} onChange={setSalesmanId} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 135 }} />
        <span style={{ fontSize: 12, color: T.inkSoft }}>to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 135 }} />
      </div>

      {error && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>{error}</div>}
      {expenses === null && !error && (
        <div style={{ fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      )}
      {expenses && expenses.length === 0 && <EmptyReportState text="No expenses recorded for these filters." />}

      {expenses && expenses.length > 0 && (
        <>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>Total spend: <span style={{ fontWeight: 700, color: T.ink }}>{fmtMoney(total)}</span></div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {categoryRows.map(([cat, amt]) => (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{cat}</span>
                  <span style={{ color: T.inkSoft }}>{fmtMoney(amt)}</span>
                </div>
                <div style={{ height: 8, background: T.paperDeep, borderRadius: 11, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((amt / maxCategory) * 100)}%`, background: T.danger, borderRadius: 11 }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {expenses.map((e) => (
              <div key={e.id} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.category} · {fmtMoney(e.amount)}</div>
                  <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>
                    {e.spentOn}{e.salesmanName ? ` · ${e.salesmanName}` : ""}{e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
                <button onClick={() => del(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft, padding: 4 }} aria-label="Delete expense">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DailyActivityReport({ salesmen }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    api.adminReportDailyActivity({ date })
      .then((res) => { if (!cancelled) setData(res.salesmen || []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load activity."); });
    return () => { cancelled = true; };
  }, [date]);

  return (
    <div>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 14, width: 180 }} />
      {error && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>{error}</div>}
      {data === null && !error && (
        <div style={{ fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="spin" /> Loading…
        </div>
      )}
      {data && data.length === 0 && <EmptyReportState text="No salesmen found." />}
      {data && data.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.line}` }}>
                {["Employee", "Day started", "Visits", "Leads added", "Distance"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: T.inkSoft, fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.salesmanId} style={{ borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 10px", fontWeight: 600 }}>{r.salesmanName}</td>
                  <td style={{ padding: "9px 10px", color: r.dayStarted ? T.ink : T.inkSoft }}>
                    {r.dayStarted ? new Date(r.dayStarted).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "Didn't start"}
                  </td>
                  <td style={{ padding: "9px 10px" }}>{r.visitCount}</td>
                  <td style={{ padding: "9px 10px" }}>{r.leadsCount}</td>
                  <td style={{ padding: "9px 10px" }}>{r.distanceKm.toFixed(1)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimeInStageReport() {
  const [stages, setStages] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.adminReportTimeInStage()
      .then((res) => { if (!cancelled) setStages(res.stages || []); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load this report."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div style={{ fontSize: 12.5, color: T.danger }}>{error}</div>;
  if (stages === null) {
    return (
      <div style={{ fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6 }}>
        <Loader2 size={14} className="spin" /> Loading…
      </div>
    );
  }
  if (stages.length === 0) return <EmptyReportState text="Not enough status changes yet to compute this." />;

  const maxDays = Math.max(1, ...stages.map((s) => s.avgDays));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {stages.map((s) => (
        <div key={s.status}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{STATUS_LABEL[s.status] || s.status}</span>
            <span style={{ color: T.inkSoft }}>{s.avgDays.toFixed(1)} days avg · {s.completedCount} leads</span>
          </div>
          <div style={{ height: 9, background: T.paperDeep, borderRadius: 11, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round((s.avgDays / maxDays) * 100)}%`, background: T.danger, borderRadius: 11, transition: "width 0.3s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadExportReport({ salesmen }) {
  const [salesmanId, setSalesmanId] = useState("all");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [sheetsInfo, setSheetsInfo] = useState(null);
  const [sheetsError, setSheetsError] = useState("");

  return (
    <div>
      <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 14 }}>Exports the same 9 fields every time: business, sub location, POS name, renewal month/date, status, contact name, phone, and comments.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Select value={salesmanId} onChange={setSalesmanId} options={[["all", "All employees"], ...salesmen.map((s) => [s.id, s.name])]} />
        <Select value={status} onChange={setStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        {date && (
          <button onClick={() => setDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer" }}>Clear date</button>
        )}
      </div>
      {sheetsError && <div style={{ fontSize: 12, color: T.danger, marginBottom: 10 }}>{sheetsError}</div>}
      <DownloadMenu
        onCsv={() => window.open(buildExportUrl("csv", { salesmanId, status, date }), "_blank")}
        onXlsx={() => window.open(buildExportUrl("xlsx", { salesmanId, status, date }), "_blank")}
        onSheets={async () => {
          setSheetsError("");
          try {
            const info = await api.adminExportSheetsInfo({ salesmanId, status, date });
            setSheetsInfo(info);
          } catch (err) {
            setSheetsError(err.message || "Couldn't prepare the Sheets export.");
          }
        }}
      />
      {sheetsInfo && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: T.inkSoft }}>
          <a href={sheetsInfo.url || sheetsInfo.sheetUrl} target="_blank" rel="noreferrer" style={{ color: T.route, fontWeight: 600 }}>Open in Google Sheets →</a>
        </div>
      )}
    </div>
  );
}

function LeadsBoardView({ leads, onStatusChange, onSelectLead, visibleStatus = "all" }) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  const columns = STATUSES.filter((s) => visibleStatus === "all" || s === visibleStatus)
    .map((s) => ({ status: s, leads: leads.filter((l) => l.status === s) }));

  const handleDrop = (status) => {
    if (draggingId) {
      const lead = leads.find((l) => l.id === draggingId);
      if (lead && lead.status !== status) onStatusChange(draggingId, status);
    }
    setDraggingId(null);
    setDragOverStatus(null);
  };

  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
      {columns.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
          onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
          onDrop={(e) => { e.preventDefault(); handleDrop(col.status); }}
          style={{
            flex: "0 0 240px", background: dragOverStatus === col.status ? T.paperDeep : "transparent",
            border: `1.5px dashed ${dragOverStatus === col.status ? T.route : T.line}`, borderRadius: 12, padding: 8,
            display: "flex", flexDirection: "column", minHeight: 120, transition: "background 0.12s ease, border-color 0.12s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 8px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{STATUS_LABEL[col.status]}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.inkSoft, background: T.paperDeep, borderRadius: 999, padding: "1px 7px" }}>{col.leads.length}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {col.leads.map((l) => (
              <div
                key={l.id}
                draggable
                onDragStart={() => setDraggingId(l.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                onClick={() => onSelectLead(l)}
                style={{
                  background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 10px", cursor: "grab",
                  opacity: draggingId === l.id ? 0.4 : 1, boxShadow: "0 1px 2px rgba(20,20,30,0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 3 }}>{l.business}</div>
                    <div style={{ fontSize: 11, color: T.inkSoft }}>{l.salesmanName}</div>
                  </div>
                </div>
                {l.status === "won" && l.dealValue != null && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.verified, marginTop: 4, paddingLeft: 38 }}>{fmtMoney(l.dealValue)}</div>
                )}
              </div>
            ))}
            {col.leads.length === 0 && (
              <div style={{ fontSize: 11, color: T.inkSoft, textAlign: "center", padding: "14px 4px" }}>Drop here</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyReportState({ text }) {
  return <div style={{ fontSize: 13, color: T.inkSoft, textAlign: "center", padding: "30px 0" }}>{text}</div>;
}

const SALESMAN_REPORT_CARDS = [
  { key: "performance", title: "My performance", desc: "Your leads, conversion rate and target progress.", icon: Contact2, color: "#145C5D" },
  { key: "renewals", title: "Renewals due", desc: "Your leads renewing in the next 30, 60 or 90 days.", icon: CalendarClock, color: "#B8791F" },
];

function SalesmanReportsPage({ leads, dailyTarget, monthlyTarget }) {
  const [active, setActive] = useState(null);
  const activeCard = SALESMAN_REPORT_CARDS.find((c) => c.key === active);

  if (!active) {
    return (
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Reports</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginBottom: 16 }}>Choose a report to view</div>
        <DayClosingReportsEntry />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SALESMAN_REPORT_CARDS.map((c) => (
            <div
              key={c.key}
              onClick={() => setActive(c.key)}
              className="ft-card"
              style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, cursor: "pointer", boxShadow: "0 1px 2px rgba(20,20,30,0.04)" }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${c.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <c.icon size={17} color={c.color} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setActive(null)}
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16 }}
      >
        ← Back to reports
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {activeCard && <activeCard.icon size={18} color={activeCard.color} />}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{activeCard?.title}</div>
      </div>
      {active === "performance" && <MyPerformanceReport leads={leads} dailyTarget={dailyTarget} monthlyTarget={monthlyTarget} />}
      {active === "renewals" && <RenewalsReport leads={leads} />}
    </div>
  );
}

function MyPerformanceReport({ leads = [] }) {
  const now = new Date();
  const monthKey = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit"}).format(now) + "-01";
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  useEffect(()=>{let live=true;api.myPerformance(monthKey).then(v=>{if(live){setData(v);setError("")}}).catch(e=>{if(live)setError(e.message||"Couldn't load performance.")});return()=>{live=false}},[monthKey]);

  const monthLabel = now.toLocaleDateString("en-IN",{month:"long",year:"numeric",timeZone:"Asia/Kolkata"});
  const end = data?.end_day ? new Date(`${String(data.end_day).slice(0,10)}T23:59:59+05:30`) : new Date(now.getFullYear(),now.getMonth()+1,0);
  const daysLeft = Math.max(0,Math.ceil((end-now)/86400000));
  const pct=(v,t)=>t>0?Math.round((Number(v||0)/Number(t))*100):0;
  const bar=(v,t)=>Math.min(100,pct(v,t));
  const won=Number(data?.won||0), wonTarget=Number(data?.won_target||0);
  const sales=Number(data?.sales_value||0), salesTarget=Number(data?.sales_value_target||0);
  const monthLeads=leads.filter(l=>isThisMonth(l.createdAt));
  const monthWon=monthLeads.filter(l=>l.status==="won").length;
  const conversion=monthLeads.length?Math.round((monthWon/monthLeads.length)*100):0;
  const wonRemaining=Math.max(0,wonTarget-won), salesRemaining=Math.max(0,salesTarget-sales);

  if(error) return <div style={{padding:14,border:`1px solid ${T.line}`,borderRadius:12,color:T.danger,fontSize:13}}>{error}</div>;
  if(!data) return <div style={{padding:18,color:T.inkSoft,fontSize:13}}>Loading your performance…</div>;

  const Progress=({label,value,target,remaining,money=false})=><div style={{marginTop:label==="Deals Won"?0:22}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:8}}>
      <div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.72)",marginBottom:3}}>{label}</div>
        <div style={{fontSize:22,fontWeight:800,letterSpacing:"-.3px"}}>{money?fmtMoney(value):value} <span style={{fontSize:13,fontWeight:600,opacity:.7}}>/ {money?fmtMoney(target):target}</span></div>
      </div>
      <div style={{fontSize:17,fontWeight:800}}>{pct(value,target)}%</div>
    </div>
    <div style={{height:8,borderRadius:99,background:"rgba(255,255,255,.16)",overflow:"hidden"}}>
      <div style={{height:"100%",width:`${bar(value,target)}%`,borderRadius:99,background:"#fff",transition:"width .3s ease"}}/>
    </div>
    <div style={{fontSize:11.5,marginTop:7,color:"rgba(255,255,255,.78)"}}>
      {target<=0 ? "No target set for this month" : remaining<=0 ? "Target achieved ✓" : money ? `${fmtMoney(remaining)} remaining` : `${remaining} more ${remaining===1?"deal":"deals"} to reach your target`}
    </div>
  </div>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,marginBottom:12}}>
      <div>
        <div style={{fontFamily:"'Space Grotesk', sans-serif",fontSize:17,fontWeight:800,color:T.ink}}>MY PERFORMANCE</div>
        <div style={{fontSize:12.5,color:T.inkSoft,marginTop:2}}>{monthLabel}</div>
      </div>
      <div style={{fontSize:11.5,fontWeight:700,color:T.route,background:"#EAF5F0",borderRadius:999,padding:"5px 9px"}}>{daysLeft} days left</div>
    </div>
    <div className="ft-card" style={{background:"linear-gradient(145deg,#123F3D 0%,#17635C 100%)",color:"#fff",borderRadius:17,padding:"18px 17px 17px",boxShadow:"0 10px 26px rgba(18,63,61,.16)"}}>
      <div style={{fontSize:10.5,fontWeight:800,letterSpacing:.8,opacity:.65,marginBottom:16}}>YOUR MONTH</div>
      <Progress label="Deals Won" value={won} target={wonTarget} remaining={wonRemaining}/>
      <Progress label="Sales" value={sales} target={salesTarget} remaining={salesRemaining} money/>
    </div>

    <div style={{marginTop:16}}>
      <div style={{fontSize:10.5,fontWeight:800,letterSpacing:.65,color:T.inkSoft,marginBottom:8}}>THIS MONTH</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",background:"#fff",border:`1px solid ${T.line}`,borderRadius:13,overflow:"hidden"}}>
        {[
          ["Leads",monthLeads.length],
          ["Won",monthWon],
          ["Conversion",`${conversion}%`]
        ].map(([label,value],i)=><div key={label} style={{padding:"13px 8px",textAlign:"center",borderLeft:i?`1px solid ${T.line}`:"none"}}>
          <div style={{fontSize:18,fontWeight:800,color:T.ink}}>{value}</div>
          <div style={{fontSize:10.5,color:T.inkSoft,marginTop:3}}>{label}</div>
        </div>)}
      </div>
    </div>
  </div>;
}


function SalesmanLeadsModal({ salesman, leads, onClose, onSelectLead }) {
  const [briefLead, setBriefLead] = useState(null);
  const [tab, setTab] = useState("all");
  const mine = leads.filter((l) => l.salesmanId === salesman.id);

  const groups = {
    all: mine,
    hot: mine.filter((l) => l.status === "hot"),
    negotiation: mine.filter((l) => l.status === "negotiation"),
    cold: mine.filter((l) => l.status === "cold"),
    converted: mine.filter((l) => l.status === "won"),
    pending: mine.filter((l) => !["won", "lost"].includes(l.status)),
  };
  const TABS = [
    ["all", "All"], ["hot", "🔥 Hot"], ["negotiation", "Negotiation"], ["cold", "Cold"],
    ["converted", "Won"], ["pending", "Pending"],
  ];
  const shown = groups[tab];

  return (
    <Overlay onClose={onClose} title={`${salesman.name}'s Leads`}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "6px 12px", borderRadius: 8, border: `1px solid ${tab === key ? T.route : T.line}`,
              background: tab === key ? T.route : "#fff", color: tab === key ? "#fff" : T.ink,
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}
          >
            {label} ({groups[key].length})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "30px 8px" }}>
            <List size={22} style={{ opacity: 0.5 }} />
            No leads in this category.
          </div>
        )}
        {shown.map((l) => (
          <div key={l.id} className="ft-row" onClick={() => onSelectLead(l)} style={{ border: `1px solid ${T.line}`, borderRadius: 11, padding: 10, background: "#fff", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>{l.business}</div>
                  <button type="button" className="ft-lead-brief-pill" aria-label={`Brief for ${l.business}`} onClick={event => { event.stopPropagation(); setBriefLead(l); }}><Sparkles size={11} /> Brief</button>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{STATUS_LABEL[l.status]} · {fmtTime(l.createdAt)}{l.dealValue != null ? ` · ${fmtMoney(l.dealValue)}` : ""}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {briefLead && <LeadBriefPopup key={briefLead.id} lead={briefLead} buildBrief={buildLeadBrief} onClose={() => setBriefLead(null)} />}
    </Overlay>
  );
}

function MonthlyProgressBar({ salesmanId, target, leads }) {
  const achieved = leads.filter((l) => l.salesmanId === salesmanId && isThisMonth(l.createdAt)).length;
  const goal = target || 200;
  const pct = Math.min(100, Math.round((achieved / goal) * 100));
  const met = achieved >= goal;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>This month</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: met ? T.verified : T.route }}>
          {met && "🏆"} {achieved} / {goal}
          <span style={{
            fontSize: 9.5, padding: "1px 6px", borderRadius: 999,
            background: met ? T.verifiedSoft : "#EEF1FD", color: met ? T.verified : T.route,
          }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 6, background: T.paperDeep, borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 999, transition: "width 0.4s ease",
          background: met ? T.verified : `linear-gradient(90deg, ${T.route}, #6E8BF2)`,
        }} />
      </div>
    </div>
  );
}

function SalesmenPanel({ salesmen, leads, onAddClick, onSettingsClick, onBriefClick, onDeleteClick, onViewRoute, onMessageClick, onOpenSalesmanLeads }) {
  return (
    <div className="ft-card" style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Employees</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onMessageClick("all")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: `1px solid ${T.line}`, cursor: "pointer", background: "#fff", color: T.ink, fontWeight: 700, fontSize: 12 }}>
            <MessageSquare size={13} /> Message all
          </button>
          <button onClick={onAddClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: T.route, color: "#fff", fontWeight: 700, fontSize: 12 }}>
            <Plus size={13} /> Add Employee
          </button>
        </div>
      </div>
      {salesmen.length === 0 && <div style={{ fontSize: 12.5, color: T.inkSoft }}>No salesmen yet — add your first one.</div>}
      {salesmen.map((s) => (
        <div key={s.id} className="ft-row" style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 12, background: "#fff", opacity: s.isActive === false ? 0.55 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div onClick={() => onOpenSalesmanLeads(s)} style={{ fontWeight: 700, fontSize: 13.5, cursor: "pointer", color: T.route }}>{s.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" className="ft-lead-brief-pill" aria-label={`Brief for ${s.name}`} onClick={() => onBriefClick(s)}><Sparkles size={11} /> Brief</button>
              <span style={{
                fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
                background: s.isActive === false ? "#EEE" : s.status === "online" ? T.verifiedSoft : "#EEE",
                color: s.isActive === false ? "#888" : s.status === "online" ? T.verified : "#888",
              }}>
                {s.isActive === false ? "Deactivated" : s.status === "online" ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3 }}>{s.area}{s.employeeCode ? ` · ${s.employeeCode}` : ""}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Battery size={12} /> {s.battery != null ? `${Math.round(s.battery)}%` : "—"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Gauge size={12} /> {s.speed.toFixed(1)} km/h</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={12} /> {fmtTime(s.lastUpdate)}</span>
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{(s.distanceM / 1000).toFixed(1)} km travelled today</div>
          <MonthlyProgressBar salesmanId={s.id} target={s.monthlyTarget} leads={leads} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onViewRoute(s)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <Route size={12} /> View route
            </button>
            <button
              onClick={() => onMessageClick(s)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.route, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <MessageSquare size={12} /> Message
            </button>
            <button onClick={()=>onSettingsClick(s)} style={{display:"flex",alignItems:"center",gap:5,fontSize:11.5,fontWeight:700,color:T.inkSoft,background:"none",border:"none",cursor:"pointer",padding:0}}><Settings size={12}/> Settings</button>
          </div>
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
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <div ref={containerRef} style={{ width: "100%", height: 320, borderRadius: 11, background: T.paperDeep }} />
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
      {!loading && <AttendanceSummary attendance={data?.attendance} date={date} />}
    </Overlay>
  );
}

// Day Start / Day End: when, and where (as a tappable maps link), plus
// total hours worked — computed live if the day hasn't ended yet.
function AttendanceSummary({ attendance, date }) {
  if (!attendance || !attendance.start_day_at) {
    return (
      <div style={{ fontSize: 12.5, color: T.inkSoft, background: T.paperDeep, borderRadius: 11, padding: "10px 12px", marginTop: 14 }}>
        No "Start Day" recorded for this date.
      </div>
    );
  }

  const start = new Date(attendance.start_day_at);
  const end = attendance.end_day_at ? new Date(attendance.end_day_at) : null;
  const isToday = date === new Date().toISOString().slice(0, 10);
  const durationMs = (end || (isToday ? new Date() : start)) - start;
  const hours = Math.floor(durationMs / 3600000);
  const mins = Math.round((durationMs % 3600000) / 60000);

  const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div style={{ marginTop: 14, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 10 }}>Attendance</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11.5, color: T.inkSoft }}>Day started</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{fmtTime(start)}</div>
          {attendance.start_lat != null && (
            <a href={mapsLink(attendance.start_lat, attendance.start_lng)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: T.route, fontWeight: 600 }}>
              View location ↗
            </a>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: T.inkSoft }}>{end ? "Day ended" : isToday ? "Still active" : "Not ended"}</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{end ? fmtTime(end) : "—"}</div>
          {attendance.end_lat != null && (
            <a href={mapsLink(attendance.end_lat, attendance.end_lng)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: T.route, fontWeight: 600 }}>
              View location ↗
            </a>
          )}
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontSize: 13, fontWeight: 700, color: T.ink }}>
        Total: {hours}h {mins}m {!end && isToday ? "(so far)" : ""}
      </div>
    </div>
  );
}


function MessageComposeModal({ salesman, onClose, onSend }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!salesman) { setHistoryLoading(false); return; } // broadcast target has no single history to show
    setHistoryLoading(true);
    try {
      const res = await api.adminGetMessages(salesman.id);
      setHistory(res.messages || []);
    } catch {
      /* history is a nice-to-have — send still works even if this fails */
    } finally {
      setHistoryLoading(false);
    }
  }, [salesman]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      await onSend(body.trim());
      setBody("");
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send this message.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    setHistory((prev) => prev.filter((m) => m.id !== id)); // optimistic
    try {
      await api.adminDeleteMessage(id);
    } catch {
      loadHistory(); // reconcile if it actually failed
    }
  };

  return (
    <Overlay onClose={onClose} title={salesman ? `Messages — ${salesman.name}` : "Message all salesmen"}>
      {salesman && (
        <>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 700, letterSpacing: 0.4, marginBottom: 8 }}>Sent history</div>
          {historyLoading ? (
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>Loading…</div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.inkSoft, marginBottom: 14 }}>No messages sent yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
              {history.map((m) => (
                <div key={m.id} style={{ padding: "10px 12px", borderRadius: 11, background: "#fff", border: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 13, color: T.ink, whiteSpace: "pre-wrap" }}>{m.body}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 10.5, color: T.inkSoft }}>
                      {fmtTime(new Date(m.created_at))} {m.read_at ? "· Read" : "· Unread"}
                    </span>
                    <button
                      onClick={() => handleDelete(m.id)}
                      style={{ border: "none", background: "none", cursor: "pointer", color: T.inkSoft, padding: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}
                      title="Delete message"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Field label="New message / task">
        <textarea style={{ ...inputStyle, minHeight: 90 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="e.g. Please prioritize Gomti Nagar leads today" />
      </Field>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <button
        disabled={!body.trim() || sending}
        onClick={handleSend}
        style={{ width: "100%", padding: 12, borderRadius: 11, border: "none", cursor: body.trim() ? "pointer" : "not-allowed", background: body.trim() ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5 }}
      >
        {sending ? "Sending…" : "Send"}
      </button>
    </Overlay>
  );
}


function DuplicateLeadWarning({ result }) {
  if (!result?.matches?.length) return null;
  const m = result.matches[0];
  const exact = m.matchType === "phone";
  return (
    <div style={{ border: `1px solid ${exact ? "#F4B8B8" : "#F0D69A"}`, background: exact ? "#FFF5F5" : "#FFFBEB", borderRadius: 11, padding: "10px 11px", margin: "-2px 0 12px" }}>
      <div style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, fontWeight: 800, color: exact ? T.danger : T.warn }}><AlertTriangle size={14} /> {exact ? "Lead already exists" : "Possible duplicate found"}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>{m.business_name}</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2 }}>{[m.sub_location, m.salesman_name ? `Assigned to ${m.salesman_name}` : null, m.phone].filter(Boolean).join(" · ")}</div>
      {result.blocking && <div style={{ fontSize: 11.5, color: T.danger, marginTop: 6 }}>This contact number is already in Engage, so a second lead cannot be saved.</div>}
    </div>
  );
}

// Compact presentation shared only by the two Add Lead forms.
function AddLeadField({ label, children }) {
  return <div style={{ marginBottom: 8, minWidth: 0 }}><div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 600, marginBottom: 4 }}>{label}</div>{children}</div>;
}

function AddLeadSection({ children }) {
  return <div role="heading" aria-level={3} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, color: T.route, marginBottom: 6 }}><span>{children}</span><span aria-hidden="true" style={{ flex: 1, height: 1, background: T.line }} /></div>;
}

function AdminAddLeadModal({ salesmen, onClose, onSubmit }) {
  const activeSalesmen = salesmen.filter((s) => s.isActive);
  const [form, setForm] = useState({
    salesmanId: activeSalesmen[0]?.id || "",
    business: "", subLocation: "", posName: "", renewalMonth: "", renewalDate: "",
    owner: "", phone: "", status: "cold", notes: "", dealValue: "", nextFollowUpDate: "",
  });
  const [leadSettings, setLeadSettings] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateResult, setDuplicateResult] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    api.adminGetSettings().then((res) => setLeadSettings(res.leadSettings || null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!leadSettings || leadSettings.duplicateProtectionEnabled === false) { setDuplicateResult(null); return; }
    if (!form.phone.trim() && !(form.business.trim() && form.subLocation.trim())) { setDuplicateResult(null); return; }
    const timer = setTimeout(() => {
      api.adminCheckDuplicateLead({ phone: form.phone, businessName: form.business, subLocation: form.subLocation })
        .then(setDuplicateResult).catch(() => setDuplicateResult(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [form.phone, form.business, form.subLocation, leadSettings]);

  const canSubmit =
    form.salesmanId && form.business.trim().length > 0 &&
    (!leadSettings?.requireFollowUpDate || form.nextFollowUpDate.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        salesmanId: form.salesmanId,
        businessName: form.business.trim(),
        subLocation: form.subLocation || null,
        posName: form.posName || null,
        renewalMonth: form.renewalMonth || null,
        renewalDate: form.renewalDate || null,
        contactName: form.owner || null,
        phone: form.phone || null,
        status: form.status,
        notes: form.notes || null,
        dealValue: form.dealValue ? Number(form.dealValue) : null,
        nextFollowUpDate: form.nextFollowUpDate || null,
        allowDuplicate: duplicateResult?.allowOverride === true,
      });
    } catch (err) {
      setError(err.message || "Couldn't create that lead.");
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose} title="Add Lead">
      {activeSalesmen.length === 0 ? (
        <div style={{ fontSize: 13, color: T.inkSoft }}>Add an active employee first before creating a lead for them.</div>
      ) : (
        <>
          <AddLeadField label="Assign to">
            <select style={inputStyle} value={form.salesmanId} onChange={set("salesmanId")}>
              {activeSalesmen.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </AddLeadField>
          <AddLeadSection>Restaurant details</AddLeadSection>
          <AddLeadField label="Business Name"><input style={inputStyle} value={form.business} onChange={set("business")} placeholder="e.g. Ganga Cafe" autoFocus /></AddLeadField>
          <AddLeadField label="Sub Location"><input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} /></AddLeadField>
          <AddLeadField label="POS Name"><input style={inputStyle} value={form.posName} onChange={set("posName")} /></AddLeadField>
          <AddLeadSection>Contact details</AddLeadSection>
          <AddLeadField label="Contact Name"><input style={inputStyle} value={form.owner} onChange={set("owner")} /></AddLeadField>
          <AddLeadField label="Contact Number"><input style={inputStyle} value={form.phone} onChange={set("phone")} /></AddLeadField>
          <DuplicateLeadWarning result={duplicateResult} />
          <AddLeadSection>Deal &amp; follow-up</AddLeadSection>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label="Renewal Month">
              <select style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")}>
                <option value="">Select…</option>
                {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </AddLeadField></div>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></AddLeadField></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label="Stage">
              <select style={inputStyle} value={form.status} onChange={set("status")}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </AddLeadField></div>
            <div style={{ flex: 1, minWidth: 0 }}><AddLeadField label={`Next Follow-up${leadSettings?.requireFollowUpDate ? " *" : ""}`}><input style={inputStyle} type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} /></AddLeadField></div>
          </div>
          <AddLeadField label="Expected Deal Value"><input style={inputStyle} type="number" min="0" value={form.dealValue} onChange={set("dealValue")} placeholder="₹ e.g. 45000" /></AddLeadField>
          <AddLeadField label="Comments"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} /></AddLeadField>

          {error && <div style={{ fontSize: 12.5, color: T.danger, marginBottom: 10 }}>{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || duplicateResult?.blocking}
            style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: canSubmit && !submitting && !duplicateResult?.blocking ? "pointer" : "not-allowed", background: canSubmit && !duplicateResult?.blocking ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5 }}
          >
            {submitting ? "Adding…" : "Add Lead"}
          </button>
        </>
      )}
    </Overlay>
  );
}

function SalesmanFormModal({ existingCount, salesman, onClose, onSubmit }) {
  const isEdit = !!salesman;
  const [form, setForm] = useState({
    name: salesman?.name || "", phone: salesman?.phone || "", password: "",
    area: salesman?.area && salesman.area !== "Unassigned" ? salesman.area : "",
    employeeCode: salesman?.employeeCode || "", dailyTarget: String(salesman?.dailyTarget || 8),
    monthlyTarget: String(salesman?.monthlyTarget || 200),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSubmit = form.name.trim().length > 0 && form.phone.trim().length > 0 && (isEdit || form.password.length >= 6);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        fullName: form.name.trim(),
        phone: form.phone.trim(),
        employeeCode: form.employeeCode.trim() || (isEdit ? null : `EMP-${1000 + existingCount + 1}`),
        dailyTarget: Number(form.dailyTarget) || 8,
        monthlyTarget: Number(form.monthlyTarget) || 200,
        area: form.area.trim() || null,
      };
      if (form.password) payload.password = form.password; // only send if actually changing it
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Couldn't ${isEdit ? "save changes" : "create employee"}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Overlay onClose={onClose} title={isEdit ? "Edit Employee" : "Add Employee"}>
      {!isEdit && (
        <div style={{ fontSize: 12, color: T.inkSoft, background: T.paperDeep, borderRadius: 11, padding: "8px 10px", marginBottom: 14 }}>
          They'll show up as <strong>OFFLINE</strong> on the map until they install Engage, sign in with this phone + password, and tap Start Day.
        </div>
      )}
      <Field label="Full name *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="e.g. Priya Sharma" /></Field>
      <Field label="Phone number * (their login)"><input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="10-digit phone" inputMode="tel" /></Field>
      <Field label={isEdit ? "Password (leave blank to keep current)" : "Password * (min 6 characters, share with them securely)"}>
        <input style={inputStyle} type="text" value={form.password} onChange={set("password")} placeholder={isEdit ? "Leave blank to keep unchanged" : "Set an initial password"} />
      </Field>
      <Field label="Area / territory"><input style={inputStyle} value={form.area} onChange={set("area")} placeholder="e.g. Alambagh" /></Field>
      <Field label="Employee code"><input style={inputStyle} value={form.employeeCode} onChange={set("employeeCode")} placeholder="Auto-generated if left blank" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Daily lead target"><input style={inputStyle} type="number" min="1" value={form.dailyTarget} onChange={set("dailyTarget")} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Monthly lead target"><input style={inputStyle} type="number" min="1" value={form.monthlyTarget} onChange={set("monthlyTarget")} /></Field></div>
      </div>
      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}
      <button
        disabled={!canSubmit || submitting}
        onClick={handleSubmit}
        style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: canSubmit ? "pointer" : "not-allowed", background: canSubmit ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {submitting && <Loader2 size={16} className="spin" />}
        {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create Employee")}
      </button>
    </Overlay>
  );
}

// Shared between Admin and Salesman — the fields shown adapt automatically
// to whatever the lead actually has (nullable GPS when Location Settings
// have GPS off, optional sub-location/POS/renewal fields, etc).
const FOLLOWUP_QUICK = [["Tomorrow", 1], ["+3 days", 3]];
function isoDaysFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// wa.me needs the country code. Indian numbers are often saved as 10 digits or with a leading 0.
function whatsappLink(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) digits = "91" + digits;
  return `https://wa.me/${digits}`;
}

function LeadDetailDrawer({ lead, onClose, onStatusChange, onUpdate, onDelete, fetchHistory, isAdmin = false, employeeRepliesEnabled = true }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(null); // null = loading, [] = loaded & empty
  const [historyError, setHistoryError] = useState("");
  const [showBrief, setShowBrief] = useState(false);
  const [detailTab, setDetailTab] = useState("overview");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpExpanded, setFollowUpExpanded] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [statusToast, setStatusToast] = useState(null);
  const statusToastTimer = useRef(null);
  const [mentionText, setMentionText] = useState(isAdmin && lead.salesmanName ? `@${lead.salesmanName} ` : "");
  const [mentionSending, setMentionSending] = useState(false);
  const [mentionError, setMentionError] = useState("");
  const [mentionSaved, setMentionSaved] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [showLeadConversation, setShowLeadConversation] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [form, setForm] = useState({
    business: lead.business || "", subLocation: lead.subLocation || "", posName: lead.posName || "",
    renewalMonth: lead.renewalMonth || "", renewalDate: lead.renewalDate || "",
    owner: lead.owner || "", phone: lead.phone || "", notes: lead.notes || "",
    dealValue: lead.dealValue != null ? String(lead.dealValue) : "",
    nextFollowUpDate: lead.nextFollowUpDate || "",
  });
  const [saving, setSaving] = useState(false);
  const [savedOverrides, setSavedOverrides] = useState({}); // reflects the drawer's own last successful save immediately, so it never shows stale data while waiting on a full reload
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const displayLead = { ...lead, ...savedOverrides };

  // Compact sales-age indicators for the header.
  const ageInDays = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.floor((today - start) / 86400000));
  };
  const dealAgeDays = ageInDays(displayLead.createdAt || displayLead.created_at);
  const latestStatusChange = history && history.length
    ? [...history].filter((h) => (h.action || "lead.status_changed") === "lead.status_changed" && h.changed_at)
        .sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))[0]
    : null;
  const statusAgeDays = ageInDays(latestStatusChange?.changed_at || displayLead.createdAt || displayLead.created_at);

  useEffect(() => {
    if (!fetchHistory) return;
    let cancelled = false;
    setHistory(null);
    setHistoryError("");
    fetchHistory(lead.id)
      .then((res) => { if (!cancelled) setHistory(res.history || []); })
      .catch((err) => { if (!cancelled) setHistoryError(err.message || "Couldn't load status history."); });
    return () => { cancelled = true; };
  }, [lead.id, lead.status, fetchHistory, historyRefresh]);


  const sendLeadMention = async () => {
    if (mentionSending || (!isAdmin && !employeeRepliesEnabled)) return;
    const body = mentionText.trim();
    if (!body) return;
    setMentionSending(true); setMentionError(""); setMentionSaved("");
    try {
      if (isAdmin) {
        await api.adminSendLeadMention(lead.id, body);
        setMentionSaved(`Sent to ${lead.salesmanName || "salesman"}.`);
        setMentionText(lead.salesmanName ? `@${lead.salesmanName} ` : "");
      } else {
        const latestAdminMessage = [...(history || [])]
          .filter(h => h.action === "lead.admin_mention" && h.message_id)
          .sort((a,b) => new Date(b.changed_at) - new Date(a.changed_at))[0];
        if (!latestAdminMessage) throw new Error("Admin needs to send the first message for this lead.");
        await api.salesmanReplyMessage(latestAdminMessage.message_id, body);
        setMentionSaved("Reply sent.");
        setMentionText("");
      }
      setHistoryRefresh(v => v + 1);
    } catch (err) { setMentionError(err.message || "Couldn't send message."); }
    finally { setMentionSending(false); }
  };

  const deleteLeadConversationMessage = async (messageId) => {
    if (!isAdmin || !messageId || deletingMessageId) return;
    if (!window.confirm("Delete this message?")) return;
    setDeletingMessageId(messageId);
    try {
      await api.adminDeleteMessage(messageId);
      setHistoryRefresh(v => v + 1);
    } catch (err) {
      setMentionError(err.message || "Couldn't delete message.");
    } finally {
      setDeletingMessageId(null);
    }
  };

  const saveEdit = async () => {
    const businessName = form.business.trim();
    if (!businessName) return;
    setSaving(true);
    const payload = {
      businessName,
      subLocation: form.subLocation, posName: form.posName,
      renewalMonth: form.renewalMonth, renewalDate: form.renewalDate || null,
      contactName: form.owner, phone: form.phone, notes: form.notes,
      dealValue: form.dealValue ? Number(form.dealValue) : null,
      nextFollowUpDate: form.nextFollowUpDate || null,
    };
    await onUpdate(lead.id, payload);
    setSavedOverrides((prev) => ({
      ...prev,
      business: payload.businessName,
      subLocation: payload.subLocation, posName: payload.posName,
      renewalMonth: payload.renewalMonth, renewalDate: payload.renewalDate || "",
      owner: payload.contactName, phone: payload.phone, notes: payload.notes,
      dealValue: payload.dealValue,
      nextFollowUpDate: payload.nextFollowUpDate || "",
    }));
    setSaving(false);
    setEditing(false);
  };

  const followUpDate = displayLead.nextFollowUpDate ? new Date(displayLead.nextFollowUpDate) : null;
  const followUpDay = followUpDate && !Number.isNaN(followUpDate.getTime())
    ? new Date(followUpDate.getFullYear(), followUpDate.getMonth(), followUpDate.getDate())
    : null;
  const todayDay = new Date();
  todayDay.setHours(0, 0, 0, 0);
  const followUpDaysDiff = followUpDay ? Math.round((followUpDay - todayDay) / 86400000) : null;
  const followUpLabel = followUpDaysDiff == null ? "" : followUpDaysDiff < 0
    ? `${Math.abs(followUpDaysDiff)} day${Math.abs(followUpDaysDiff) === 1 ? "" : "s"} overdue`
    : followUpDaysDiff === 0 ? "Due today"
    : `In ${followUpDaysDiff} day${followUpDaysDiff === 1 ? "" : "s"}`;
  const formattedFollowUp = followUpDate && !Number.isNaN(followUpDate.getTime())
    ? followUpDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const markFollowUpDone = async () => {
    if (!onUpdate || followUpSaving) return;
    setFollowUpSaving(true);
    try {
      await onUpdate(lead.id, { nextFollowUpDate: null });
      setSavedOverrides((prev) => ({ ...prev, nextFollowUpDate: "" }));
      setForm((prev) => ({ ...prev, nextFollowUpDate: "" }));
    } finally {
      setFollowUpSaving(false);
    }
  };

  const saveReschedule = async () => {
    if (!onUpdate || !rescheduleDate || followUpSaving) return;
    setFollowUpSaving(true);
    try {
      await onUpdate(lead.id, { nextFollowUpDate: rescheduleDate });
      setSavedOverrides((prev) => ({ ...prev, nextFollowUpDate: rescheduleDate }));
      setForm((prev) => ({ ...prev, nextFollowUpDate: rescheduleDate }));
      setShowReschedule(false);
      setRescheduleDate("");
    } finally {
      setFollowUpSaving(false);
    }
  };

  const applyFollowUp = async (iso) => {
    if (!onUpdate || !iso || followUpSaving) return;
    setFollowUpSaving(true);
    try {
      await onUpdate(lead.id, { nextFollowUpDate: iso });
      setSavedOverrides((prev) => ({ ...prev, nextFollowUpDate: iso }));
      setForm((prev) => ({ ...prev, nextFollowUpDate: iso }));
      setShowReschedule(false);
    } finally {
      setFollowUpSaving(false);
    }
  };

  const changeStatus = (next) => {
    if (!onStatusChange || next === lead.status) return;
    const previous = lead.status;
    onStatusChange(lead.id, next);
    setStatusExpanded(false);
    setStatusToast({ label: STATUS_LABEL[next] || next, previous });
    clearTimeout(statusToastTimer.current);
    statusToastTimer.current = setTimeout(() => setStatusToast(null), 5000);
  };

  const undoStatus = () => {
    if (!statusToast) return;
    clearTimeout(statusToastTimer.current);
    onStatusChange(lead.id, statusToast.previous);
    setStatusToast(null);
  };

  useEffect(() => () => clearTimeout(statusToastTimer.current), []);

  const detailRows = [
    ["Business Name", displayLead.business],
    ["Sub Location", displayLead.subLocation],
    ["POS Name", displayLead.posName],
    ["Renewal Month", displayLead.renewalMonth],
    ["Renewal Date", displayLead.renewalDate],
    ["Contact Name", displayLead.owner],
    ["Contact Number", displayLead.phone],
    ["Expected Deal Value", displayLead.dealValue != null ? `₹${displayLead.dealValue.toLocaleString("en-IN")}` : null],
  ].filter(([, v]) => v);

  let briefNext = null;
  if (history !== null || historyError || !fetchHistory) {
    try { briefNext = buildLeadBrief(displayLead, history || []).nextAction || null; } catch { briefNext = null; }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,36,48,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 2000 }} onClick={onClose}>
      <div className="ft-lead-detail-panel" style={{ width: "min(620px, 100vw)", maxWidth: "100vw", background: "#F8FAF9", height: "100%", padding: "18px clamp(14px, 4vw, 24px) 28px", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: T.route, fontSize: 13, fontWeight: 700, padding: 0 }}>← Back to Leads</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onUpdate && !editing && (
              <button onClick={() => setEditing(true)} style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, cursor: "pointer", color: T.ink, padding: "8px 12px", fontSize: 12.5, fontWeight: 700 }}>✎ Edit</button>
            )}
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ ...leadAvatarStyle(displayLead.business), width: 58, height: 58, minWidth: 58, fontSize: 18 }}>{leadInitials(displayLead.business)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>{displayLead.business}</div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.route, background: "#EAF5F0", padding: "5px 9px", borderRadius: 999 }}>{STATUS_LABEL[lead.status]}</span>
              </div>

            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 11.5, color: T.inkSoft, fontWeight: 650, minWidth: 0, whiteSpace: "nowrap" }}>
              {dealAgeDays != null ? <span style={{ color: T.ink, fontWeight: 750 }}>{dealAgeDays} day{dealAgeDays === 1 ? "" : "s"} old</span> : <span style={{ color: T.inkSoft }}>Age —</span>}
              <span style={{ margin: "0 6px", color: T.line }}>·</span>
              {statusAgeDays != null ? <span style={{ color: statusAgeDays >= 14 ? T.danger : statusAgeDays >= 7 ? "#B7791F" : T.inkSoft, fontWeight: statusAgeDays >= 7 ? 750 : 650 }}>{statusAgeDays >= 7 ? "⚠ " : ""}{statusAgeDays} day{statusAgeDays === 1 ? "" : "s"} in stage</span> : <span style={{ color: T.inkSoft }}>Stage age —</span>}
            </div>
            {displayLead.phone && (
              <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                <a aria-label="Call lead" title="Call" href={`tel:${displayLead.phone}`} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.route, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><PhoneIcon size={14} /></a>
                <a aria-label="WhatsApp lead" title="WhatsApp" href={whatsappLink(displayLead.phone)} target="_blank" rel="noreferrer" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.route, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><WhatsAppIcon size={14} /></a>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {lead.hasLocation ? <VerificationStamp status={lead.verification} /> : <NoLocationBadge />}
          <SyncBadge syncStatus={lead.syncStatus} />
          <TasksEntry lead={lead} compact />
          <button
            onClick={() => setShowBrief(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer", background: "#F0EBFB", color: "#6B46C1", fontSize: 11.5, fontWeight: 700 }}
          >
            <Sparkles size={13} /> Brief
          </button>
          <button
            onClick={() => setShowLeadConversation(true)}
            aria-label={`Open chat for ${displayLead.business}`}
            title="Open lead chat"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: "none", cursor: "pointer", background: "#EAF5F0", color: T.route, fontSize: 11.5, fontWeight: 700 }}
          >
            <MessageSquare size={13} /> Chat
          </button>
        </div>

        {showBrief && <LeadBriefPopup key={lead.id} lead={displayLead} buildBrief={buildLeadBrief} onClose={() => setShowBrief(false)} />}

        {onStatusChange && !editing && (
          <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 13 }}>
            <div role="button" tabIndex={0} aria-expanded={statusExpanded} onClick={() => setStatusExpanded((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setStatusExpanded((v) => !v); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: T.inkSoft, fontWeight: 600, letterSpacing: 0.3 }}>Update status</div>
                <div style={{ marginTop: 5, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{STATUS_LABEL[lead.status]}</div>
              </div>
              <span aria-hidden="true" style={{ fontSize: 18, color: T.inkSoft }}>{statusExpanded ? "⌃" : "›"}</span>
            </div>
            {statusExpanded && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                {STATUSES.map((s) => (
                  <button key={s} onClick={(e) => { e.stopPropagation(); changeStatus(s); }} style={{ fontSize: 11.5, padding: "5px 9px", borderRadius: 6, cursor: "pointer", border: `1px solid ${lead.status === s ? T.route : T.line}`, background: lead.status === s ? T.route : "#fff", color: lead.status === s ? "#fff" : T.ink, fontWeight: 600 }}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
            )}
          </div>
        )}

                {!editing && (
          <div style={{ display: "flex", borderBottom: `1px solid ${T.line}`, marginTop: 16, background: "#fff", borderRadius: "12px 12px 0 0" }}>
            {["overview", "activity"].map((tab) => (
              <button key={tab} onClick={() => setDetailTab(tab)} style={{ flex: 1, padding: "11px 8px", border: "none", borderBottom: detailTab === tab ? `2px solid ${T.route}` : "2px solid transparent", background: "transparent", color: detailTab === tab ? T.route : T.inkSoft, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>{tab}</button>
            ))}
          </div>
        )}


        
        {editing ? (
          <div style={{ marginTop: 16 }}>
            <Field label="Business Name *"><input style={inputStyle} value={form.business} onChange={set("business")} placeholder="Business / Restaurant name" /></Field>
            <Field label="Sub Location"><input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} /></Field>
            <Field label="POS Name"><input style={inputStyle} value={form.posName} onChange={set("posName")} /></Field>
            <Field label="Contact Name"><input style={inputStyle} value={form.owner} onChange={set("owner")} /></Field>
            <Field label="Contact Number"><input style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Renewal Month">
                <select style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")}>
                  <option value="">Select…</option>
                  {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field></div>
              <div style={{ flex: 1 }}><Field label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></Field></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><Field label="Expected Deal Value"><input style={inputStyle} type="number" min="0" value={form.dealValue} onChange={set("dealValue")} placeholder="₹ e.g. 45000" /></Field></div>
              <div style={{ flex: 1 }}><Field label="Next Follow-up Date"><input style={inputStyle} type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} /></Field></div>
            </div>
            <Field label="Comments"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 10, borderRadius: 11, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving || !form.business.trim()} style={{ flex: 1, padding: 10, borderRadius: 11, border: "none", background: T.route, color: "#fff", fontWeight: 700, cursor: saving || !form.business.trim() ? "not-allowed" : "pointer", opacity: saving || !form.business.trim() ? .6 : 1 }}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        ) : detailTab === "overview" ? (
          <>
            {formattedFollowUp && (
              <div style={{ marginTop: 12, background: followUpDaysDiff < 0 ? "#FFF1F1" : followUpDaysDiff === 0 ? "#FFF8E8" : "#F0F7FF", border: `1px solid ${followUpDaysDiff < 0 ? "#F6B8B8" : followUpDaysDiff === 0 ? "#F0D89A" : "#C9DDF7"}`, borderRadius: 14, padding: 14 }}>
                <div role="button" tabIndex={0} aria-expanded={followUpExpanded} onClick={() => setFollowUpExpanded((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFollowUpExpanded((v) => !v); }} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                    <div style={{ fontSize: 20, lineHeight: 1 }}>📅</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: followUpDaysDiff < 0 ? "#D92D20" : T.ink }}>Next Follow-up</div>
                      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 600, color: followUpDaysDiff < 0 ? "#D92D20" : T.ink }}>{formattedFollowUp}{followUpLabel ? ` · ${followUpLabel}` : ""}</div>
                    </div>
                  </div>
                  <span aria-hidden="true" style={{ fontSize: 18, color: T.inkSoft }}>{followUpExpanded ? "⌃" : "›"}</span>
                </div>
                {followUpExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 9 }}>
                      <button disabled={followUpSaving} onClick={markFollowUpDone} style={{ minHeight: 30, padding: "0 9px", border: `1px solid ${T.route}`, borderRadius: 8, background: "#fff", color: T.route, fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{followUpSaving ? "Saving…" : "✓ Mark Done"}</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                      {FOLLOWUP_QUICK.map(([label, days]) => (
                        <button key={label} disabled={followUpSaving} onClick={() => { const date = isoDaysFromToday(days); if (window.confirm(`Set next follow-up to ${label.toLowerCase()}?`)) applyFollowUp(date); }} style={{ minHeight: 36, padding: "0 11px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                      ))}
                      <label aria-label="Reschedule follow-up" title="Reschedule" style={{ minWidth: 40, minHeight: 36, padding: "0 10px", border: `1px solid ${T.line}`, borderRadius: 10, background: "#fff", color: T.ink, fontSize: 17, fontWeight: 700, cursor: followUpSaving ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", boxSizing: "border-box" }}>
                        📅
                        <input type="date" disabled={followUpSaving} value="" onChange={(e) => { if (e.target.value) applyFollowUp(e.target.value); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!formattedFollowUp && onUpdate && (
              <div style={{ marginTop: 12, background: T.warnSoft, border: "1px solid #F0D89A", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink }}>Next Follow-up</div>
                <div style={{ marginTop: 3, fontSize: 12.5, color: T.inkSoft }}>Not set. Pick a quick date:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {FOLLOWUP_QUICK.map(([label, days]) => (
                    <button key={label} disabled={followUpSaving} onClick={() => { const date = isoDaysFromToday(days); if (window.confirm(`Set next follow-up to ${label.toLowerCase()}?`)) applyFollowUp(date); }} style={{ minHeight: 40, padding: "0 13px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                  ))}
                  <label aria-label="Schedule follow-up date" title="Choose date" style={{ minWidth: 40, minHeight: 36, padding: "0 10px", border: `1px solid ${T.line}`, borderRadius: 8, background: "#fff", color: T.ink, fontSize: 17, fontWeight: 700, cursor: followUpSaving ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", boxSizing: "border-box" }}>
                    📅
                    <input type="date" disabled={followUpSaving} value="" onChange={(e) => { if (e.target.value) applyFollowUp(e.target.value); }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
                  </label>
                </div>
              </div>
            )}
            {displayLead.notes && (
              <div style={{ marginTop: 12, background: "#EAF5F0", border: "1px solid #CFE6DC", borderRadius: 12, padding: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.route, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Comments</div>
                <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{displayLead.notes}</div>
              </div>
            )}

            <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8, color: T.ink }}>Lead Information</div>
              {detailRows.map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 }}>
                  <span style={{ color: T.inkSoft }}>{label}</span>
                  {label === "Contact Number" ? (
                    <a href={`tel:${value}`} style={{ fontWeight: 700, textAlign: "right", color: T.route, textDecoration: "none" }}>
                      {value}
                    </a>
                  ) : (
                    <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 }}>
                <span style={{ color: T.inkSoft }}>Created</span>
                <span style={{ fontWeight: 600 }}>{lead.createdAt.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {lead.hasLocation ? (
              <div style={{ marginTop: 12, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, fontSize: 12.5 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>Location</div>
                    <div style={{ color: T.inkSoft }}>{displayLead.subLocation || `${lead.lat.toFixed(5)}, ${lead.lng.toFixed(5)}`}</div>
                  </div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${lead.lat},${lead.lng}`} target="_blank" rel="noreferrer" style={{ border: `1px solid ${T.route}`, borderRadius: 9, padding: "7px 10px", color: T.route, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>Directions</a>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, fontSize: 12, color: T.inkSoft, background: T.paperDeep, borderRadius: 11, padding: "8px 10px" }}>
                No location captured for this lead.
              </div>
            )}

          </>
        ) : null}

        {fetchHistory && !editing && detailTab === "activity" && (
          <div style={{ marginTop: 14 }}>
            {isAdmin && !(history || []).some(h => h.action === "lead.admin_mention" || h.action === "lead.employee_reply") && (
              <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Send instruction</div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 9 }}>This note stays in the lead activity and is also sent to {lead.salesmanName || "the assigned salesman"} in Messages.</div>
                <textarea value={mentionText} onChange={e => { setMentionText(e.target.value); setMentionSaved(""); }} maxLength={2000} rows={3} placeholder={lead.salesmanName ? `@${lead.salesmanName} Type an instruction…` : "Type an instruction…"} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 11px", font: "inherit", fontSize: 13, color: T.ink, outline: "none" }} />
                {mentionError && <div style={{ color: T.danger, fontSize: 11.5, marginTop: 6 }}>{mentionError}</div>}
                {mentionSaved && <div style={{ color: T.route, fontSize: 11.5, marginTop: 6 }}>{mentionSaved}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 9 }}>
                  <button disabled={mentionSending || !mentionText.trim()} onClick={sendLeadMention} style={{ border: "none", borderRadius: 9, background: T.route, color: "#fff", padding: "8px 13px", fontSize: 12.5, fontWeight: 800, cursor: mentionSending ? "default" : "pointer", opacity: mentionSending ? .65 : 1 }}>{mentionSending ? "Sending…" : "Send instruction"}</button>
                </div>
              </div>
            )}
            {history === null && !historyError && (
              <div style={{ fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 6, padding: "12px 2px" }}>
                <Loader2 size={13} className="spin" /> Loading activity…
              </div>
            )}
            {historyError && (
              <div style={{ fontSize: 12.5, color: T.danger, padding: "12px 2px" }}>{historyError}</div>
            )}
            {history && history.length === 0 && (
              <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, fontSize: 12.5, color: T.inkSoft }}>
                No status activity yet — current status is {STATUS_LABEL[lead.status]}.
              </div>
            )}
            {history && history.length > 0 && (() => {
              const now = new Date();
              const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
              const yesterday = new Date(now);
              yesterday.setDate(now.getDate() - 1);
              const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

              const rawSorted = [...history].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
              const conversationMessages = rawSorted
                .filter(h => h.action === "lead.admin_mention" || h.action === "lead.employee_reply")
                .sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
              const nonConversation = rawSorted.filter(h => h.action !== "lead.admin_mention" && h.action !== "lead.employee_reply");
              const sorted = conversationMessages.length
                ? [
                    ...nonConversation,
                    {
                      id: `lead-conversation-${lead.id}`,
                      action: "lead.conversation",
                      changed_at: conversationMessages[conversationMessages.length - 1].changed_at,
                      changed_by_name: conversationMessages[conversationMessages.length - 1].changed_by_name,
                      message_body: conversationMessages[conversationMessages.length - 1].message_body,
                      conversation_messages: conversationMessages,
                    },
                  ].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
                : nonConversation;
              const groups = [];
              sorted.forEach((h) => {
                const d = new Date(h.changed_at);
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                let group = groups.find((g) => g.key === key);
                if (!group) {
                  const label = key === todayKey
                    ? "Today"
                    : key === yesterdayKey
                      ? "Yesterday"
                      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                  group = { key, label, items: [] };
                  groups.push(group);
                }
                group.items.push(h);
              });

              return (
                <div>
                  {groups.map((group, groupIndex) => (
                    <div key={group.key} style={{ marginTop: groupIndex === 0 ? 0 : 18 }}>
                      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.55, color: T.inkSoft, fontWeight: 800, marginBottom: 10 }}>
                        {group.label}
                      </div>
                      <div style={{ position: "relative" }}>
                        {group.items.map((h, i) => (
                          <div key={h.id || `${group.key}-${i}`} style={{ display: "flex", gap: 12, minHeight: 58 }}>
                            <div style={{ width: 12, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                              <div style={{ width: 9, height: 9, borderRadius: 99, background: T.route, marginTop: 5, boxShadow: "0 0 0 3px #EAF5F0", zIndex: 1 }} />
                              {i !== group.items.length - 1 && <div style={{ width: 1.5, flex: 1, background: T.line, marginTop: 4 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: i === group.items.length - 1 ? 2 : 14 }}>
                              {(() => {
                                const action = h.action || "lead.status_changed";
                                const oldValue = h.old_value ?? h.old_status;
                                const newValue = h.new_value ?? h.new_status;
                                const titles = {
                                  "lead.created": "Lead created",
                                  "lead.created_by_admin": "Lead created",
                                  "lead.status_changed": "Status changed",
                                  "lead.follow_up_scheduled": "Follow-up scheduled",
                                  "lead.follow_up_rescheduled": "Follow-up rescheduled",
                                  "lead.follow_up_done": "Follow-up completed",
                                  "lead.comment_updated": "Comment updated",
                                  "lead.edited": "Lead information updated",
                                  "lead.admin_mention": "Admin instruction",
                                  "lead.employee_reply": "Employee reply",
                                  "lead.conversation": "Lead Conversation",
                                };
                                const fmtDate = (v) => {
                                  if (!v) return "";
                                  const d = new Date(`${String(v).slice(0,10)}T00:00:00`);
                                  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                                };
                                let detail = null;
                                if (action === "lead.status_changed") {
                                  detail = <>{oldValue && <><span style={{ color: T.inkSoft }}>{STATUS_LABEL[oldValue] || oldValue}</span><span style={{ color: T.inkSoft }}> → </span></>}<span style={{ fontWeight: 700, color: T.route }}>{STATUS_LABEL[newValue] || newValue}</span></>;
                                } else if (action === "lead.follow_up_scheduled") {
                                  detail = <span style={{ fontWeight: 700, color: T.route }}>{fmtDate(newValue)}</span>;
                                } else if (action === "lead.follow_up_rescheduled") {
                                  detail = <><span style={{ color: T.inkSoft }}>{fmtDate(oldValue)}</span><span style={{ color: T.inkSoft }}> → </span><span style={{ fontWeight: 700, color: T.route }}>{fmtDate(newValue)}</span></>;
                                } else if (action === "lead.follow_up_done") {
                                  detail = <span style={{ color: T.inkSoft }}>{oldValue ? `Completed follow-up for ${fmtDate(oldValue)}` : "Marked done"}</span>;
                                } else if (action === "lead.conversation") {
                                  const msgs = h.conversation_messages || [];
                                  const latest = msgs[msgs.length - 1];
                                  detail = <button onClick={() => setShowLeadConversation(true)} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer", color: T.ink }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                      <span style={{ color: T.inkSoft }}>{latest?.changed_by_name || "User"} · “{String(latest?.message_body || "").slice(0, 95)}{String(latest?.message_body || "").length > 95 ? "…" : ""}”</span>
                                      <span style={{ flexShrink: 0, fontWeight: 800, color: T.route }}>{msgs.length} ›</span>
                                    </div>
                                  </button>;
                                } else if (action === "lead.admin_mention") {
                                  detail = <div><span style={{ fontWeight: 800, color: T.route }}>{h.recipient_name ? `@${h.recipient_name}` : "Salesman"}</span><div style={{ marginTop: 4, color: T.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{h.message_body || "Instruction sent"}</div></div>;
                                } else if (action === "lead.employee_reply") {
                                  detail = <div style={{ color: T.ink, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{h.message_body || "Reply sent"}</div>;
                                } else if (action === "lead.comment_updated") {
                                  const text = String(newValue || "").trim();
                                  detail = text ? <span style={{ color: T.inkSoft }}>“{text.length > 90 ? `${text.slice(0, 90)}…` : text}”</span> : <span style={{ color: T.inkSoft }}>Comment cleared</span>;
                                } else if (action === "lead.edited" && h.changes) {
                                  const names = { businessName:"Business Name", subLocation:"Sub Location", posName:"POS Name", renewalMonth:"Renewal Month", renewalDate:"Renewal Date", contactName:"Contact Name", phone:"Contact Number", dealValue:"Deal Value" };
                                  const fields = Object.keys(h.changes).map((k) => names[k] || k);
                                  detail = <span style={{ color: T.inkSoft }}>{fields.length ? fields.join(", ") : "Lead details updated"}</span>;
                                }
                                return <>
                                  <div style={{ fontSize: 13, fontWeight: 750, color: T.ink }}>{titles[action] || "Lead updated"}</div>
                                  {detail && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3, fontSize: 13 }}>{detail}</div>}
                                </>;
                              })()}
                              <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 4 }}>
                                {h.changed_by_name || "User"} · {new Date(h.changed_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {showLeadConversation && (() => {
          const messages = (history || [])
            .filter(h => h.action === "lead.admin_mention" || h.action === "lead.employee_reply")
            .sort((a,b) => new Date(a.changed_at) - new Date(b.changed_at));
          return (
            <div style={{ position: "fixed", inset: 0, zIndex: 2300, background: "rgba(28,36,48,.28)", display: "flex", justifyContent: "flex-end" }} onClick={() => setShowLeadConversation(false)}>
              <div style={{ width: "min(500px,100vw)", height: "100%", background: "#F8FAF9", display: "flex", flexDirection: "column", boxShadow: "-12px 0 30px rgba(0,0,0,.12)" }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: "16px 16px 12px", background: "#fff", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div><div style={{ fontWeight: 850, fontSize: 16 }}>{displayLead.business}</div><div style={{ fontSize: 11.5, color: T.inkSoft }}>Conversation with {lead.salesmanName || "salesman"}</div></div>
                  <button onClick={() => setShowLeadConversation(false)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6 }}><X size={19}/></button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                  {messages.map(m => {
                    const adminMessage = m.action === "lead.admin_mention";
                    return <div key={m.message_id || m.id} style={{ display: "flex", justifyContent: adminMessage ? "flex-start" : "flex-end", marginBottom: 14 }}>
                      <div style={{ maxWidth: "82%" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: adminMessage ? "flex-start" : "flex-end", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: T.inkSoft }}>{adminMessage ? "Admin" : (m.changed_by_name || lead.salesmanName || "Employee")}</span>
                          {isAdmin && m.message_id && <button title="Delete message" disabled={deletingMessageId === m.message_id} onClick={() => deleteLeadConversationMessage(m.message_id)} style={{ border: "none", background: "transparent", color: T.danger, padding: 2, cursor: "pointer", opacity: deletingMessageId === m.message_id ? .45 : .8 }}><Trash2 size={13}/></button>}
                        </div>
                        <div style={{ background: adminMessage ? "#fff" : T.paperDeep, border: `1px solid ${T.line}`, borderRadius: 12, padding: "9px 11px", fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.message_body}</div>
                        <div style={{ marginTop: 3, fontSize: 10.5, color: T.inkSoft, textAlign: adminMessage ? "left" : "right" }}>{new Date(m.changed_at).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}</div>
                      </div>
                    </div>;
                  })}
                </div>
                {(isAdmin || employeeRepliesEnabled) && <div style={{ padding: 12, background: "#fff", borderTop: `1px solid ${T.line}` }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea value={mentionText} onChange={e => { setMentionText(e.target.value); setMentionError(""); }} rows={2} maxLength={2000} placeholder={isAdmin ? "Write a message…" : "Reply to Admin…"} style={{ flex: 1, resize: "none", border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 10px", font: "inherit", fontSize: 13 }} />
                    <button disabled={mentionSending || !mentionText.trim()} onClick={sendLeadMention} style={{ border: "none", borderRadius: 9, background: T.route, color: "#fff", padding: "10px 13px", fontWeight: 800, cursor: "pointer", opacity: mentionSending || !mentionText.trim() ? .55 : 1 }}>{mentionSending ? "…" : (isAdmin ? "Send" : "Reply")}</button>
                  </div>
                  {mentionError && <div style={{ color: T.danger, fontSize: 11.5, marginTop: 5 }}>{mentionError}</div>}
                </div>}
              </div>
            </div>
          );
        })()}

        {statusToast && (
          <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "max(18px, env(safe-area-inset-bottom))", width: "min(420px, calc(100vw - 24px))", zIndex: 2200, background: T.ink, color: "#fff", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
            <span>Status changed to {statusToast.label}</span>
            <button onClick={undoStatus} style={{ minHeight: 36, border: "none", background: "none", color: "#fff", fontWeight: 800, textDecoration: "underline", cursor: "pointer" }}>Undo</button>
          </div>
        )}

        {onDelete && !editing && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
            {confirmingDelete ? (
              <div style={{ background: T.dangerSoft, borderRadius: 11, padding: 12 }}>
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

function SalesmanApp({ session, online, page, notificationLead }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dayStarted, setDayStartedState] = useState(getDayStarted(session.id));
  const [togglingDay, setTogglingDay] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | tracking | denied | unavailable
  const [queuedCount, setQueuedCount] = useState(getQueuedLeads().length);
  const [continuousTracking, setContinuousTracking] = useState(true); // safe default until settings load
  const [allowLeadWithoutStartDay, setAllowLeadWithoutStartDay] = useState(false);
  const [dailyTarget, setDailyTarget] = useState(8); // overwritten by the salesman's actual profile below
  const [monthlyTarget, setMonthlyTarget] = useState(200);
  const lastPingSentRef = useRef(0);

  useEffect(() => {
    let live=true;
    const sync=()=>api.closingStatus().then(v=>{if(live){setDayStartedState(v.active);setDayStartedFlag(session.id,v.active);}}).catch(()=>{});
    sync();window.addEventListener('focus',sync);
    return()=>{live=false;window.removeEventListener('focus',sync);};
  },[session.id]);

  useEffect(() => {
    api.salesmanGetProfile()
      .then((res) => {
        setDailyTarget(res.profile?.daily_target || 8);
        setMonthlyTarget(res.profile?.monthly_target || 200);
      })
      .catch(() => { /* keep defaults on failure */ });
  }, []);

  useEffect(() => {
    api.salesmanGetSettings()
      .then((res) => {
        setContinuousTracking(res.locationSettings?.continuousGpsTracking ?? true);
        setAllowLeadWithoutStartDay(!!res.employeePermissions?.allowLeadWithoutStartDay);
        setEmployeeRepliesEnabled(res.messageSettings?.employeeRepliesEnabled !== false);
      })
      .catch(() => {
        // Fail closed: if settings cannot load, Start Day remains required.
        setAllowLeadWithoutStartDay(false);
      });
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

  const [messages, setMessages] = useState([]);
  const [employeeRepliesEnabled, setEmployeeRepliesEnabled] = useState(true);
  const loadMessages = useCallback(async () => {
    try {
      const res = await api.salesmanGetMessages();
      setMessages(res.messages || []);
    } catch {
      /* messages are non-critical — fail silently, next poll retries */
    }
  }, []);
  useEffect(() => {
    loadMessages();
    const iv = setInterval(loadMessages, 30000); // light polling, no push infra for this yet
    return () => clearInterval(iv);
  }, [loadMessages]);

  const markMessageRead = async (id) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read_at: m.read_at || new Date().toISOString() } : m))); // optimistic
    try {
      await api.salesmanMarkMessageRead(id);
    } catch {
      /* not critical if this fails silently — next load reconciles */
    }
  };

  const deleteMessage = async (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id)); // optimistic
    try {
      await api.salesmanDeleteMessage(id);
    } catch {
      loadMessages(); // reconcile if it actually failed
    }
  };

  const replyToMessage = async (id, body) => {
    const res = await api.salesmanReplyMessage(id, body);
    await loadMessages();
    return res;
  };

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

  const [showClosing,setShowClosing]=useState(false);
  const [justToggled, setJustToggled] = useState(false); // brief "Started"/"Ended" confirmation flash

  const handleToggleDay = async closing => {
    if(dayStarted && !closing){setShowClosing(true);return;}
    if (togglingDay) return; // guard against double-taps while a request is already in flight
    setTogglingDay(true);
    try {
      const pos = await getCurrentPositionAsync().catch(() => null);
      const lat = pos?.coords.latitude;
      const lng = pos?.coords.longitude;
      if (dayStarted) {
        await api.endDayWithClosing({...closing,lat,lng});
        setShowClosing(false);
        setDayStartedFlag(session.id, false);
        setDayStartedState(false);
      } else {
        await api.salesmanDayStart(lat, lng);
        setDayStartedFlag(session.id, true);
        setDayStartedState(true);
      }
      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 1600);
    } catch (err) {
      if(closing)throw err;
      setLoadError(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.");
    } finally {
      setTogglingDay(false);
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
      business: payload.businessName ?? l.business,
      subLocation: payload.subLocation, posName: payload.posName,
      renewalMonth: payload.renewalMonth, renewalDate: payload.renewalDate || "",
      owner: payload.contactName, phone: payload.phone, notes: payload.notes,
      dealValue: payload.dealValue,
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
    <>
    {showClosing && <DayClosingForm onClose={()=>setShowClosing(false)} onEnd={handleToggleDay}/>}
    <SalesmanView
      notificationLead={notificationLead}
      session={session}
      leads={leads}
      dayStarted={dayStarted}
      allowLeadWithoutStartDay={allowLeadWithoutStartDay}
      onToggleDay={()=>handleToggleDay()}
      togglingDay={togglingDay}
      justToggledDay={justToggled}
      onAddLead={handleAddLead}
      onUpdateLeadStatus={handleUpdateLeadStatus}
      onUpdateLeadDetails={handleUpdateLeadDetails}
      online={online}
      gpsStatus={gpsStatus}
      queuedCount={queuedCount}
      loadError={loadError}
      messages={messages}
      onMarkMessageRead={markMessageRead}
      onDeleteMessage={deleteMessage}
      onReplyMessage={replyToMessage}
      employeeRepliesEnabled={employeeRepliesEnabled}
      dailyTarget={dailyTarget}
      monthlyTarget={monthlyTarget}
      page={page}
    />
    </>
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

function SalesmanView({ notificationLead, session, leads, dayStarted, allowLeadWithoutStartDay, onToggleDay, togglingDay, justToggledDay, onAddLead, onUpdateLeadStatus, onUpdateLeadDetails, online, gpsStatus, queuedCount, loadError, messages, onMarkMessageRead, onDeleteMessage, onReplyMessage, employeeRepliesEnabled = true, dailyTarget, monthlyTarget, page }) {
  const [pendingTasks, setPendingTasks] = useState(null);
  const phone = useAdminPhone();
  const [mobileTab, setMobileTab] = useState("dashboard");
  const [visited, setVisited] = useState({});
  const positions = useRef({});
  const switchTab = tab => {
    positions.current[mobileTab] = window.scrollY;
    setVisited(current => ({ ...current, [tab]: true }));
    setMobileTab(tab);
  };
  useEffect(() => {
    if (!phone) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: positions.current[mobileTab] || 0, behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [phone, mobileTab]);
  const dashboard = !phone || mobileTab === "dashboard";
  const [showAddLead, setShowAddLead] = useState(false);
  const [showMyLeads, setShowMyLeads] = useState(false);
  const [viewingLead, setViewingLead] = useState(null);
  const [showTodayLeads, setShowTodayLeads] = useState(false);
  const [showHotLeads, setShowHotLeads] = useState(false);
  const [showConverted, setShowConverted] = useState(false);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [showRenewals, setShowRenewals] = useState(false);

  const [notificationLeadError, setNotificationLeadError] = useState("");
  useEffect(() => {
    if (!notificationLead) return;
    let cancelled = false;
    setNotificationLeadError("");
    setShowAddLead(false); setShowMyLeads(false); setShowTodayLeads(false); setShowHotLeads(false);
    setShowConverted(false); setShowNegotiation(false); setShowConversation(false); setShowRenewals(false);
    setViewingLead(null);
    api.salesmanLead(notificationLead.id).then(res => {
      if (!cancelled) setViewingLead(mapLeadRow(res.lead));
    }).catch(err => { if (!cancelled) setNotificationLeadError(err.message || "Couldn't open this lead. Please refresh your briefing."); });
    return () => { cancelled = true; };
  }, [notificationLead]);

  const todayLeads = leads.filter((l) => isToday(l.createdAt));
  const monthLeads = leads.filter((l) => isThisMonth(l.createdAt));
  const allHotLeads = leads.filter((l) => l.status === "hot");
  const converted = leads.filter((l) => l.status === "won").length;
  const convertedValue = leads.filter((l) => l.status === "won" && l.dealValue != null).reduce((sum, l) => sum + l.dealValue, 0);
  const pending = leads.filter((l) => !["won", "lost"].includes(l.status)).length;
  const inConversation = leads.filter((l) => l.status === "conversation");
  const inNegotiation = leads.filter((l) => l.status === "negotiation");
  const upcomingRenewals = leads.filter((l) =>
    (l.renewalDate && isWithinDays(new Date(l.renewalDate), 30)) ||
    (!l.renewalDate && isUpcomingRenewalMonth(l.renewalMonth))
  );
  const target = dailyTarget || 8;
  const monthTarget = monthlyTarget || 200;

  return (
    <div className={phone && page !== "reports" ? "engage-admin-mobile-content" : undefined} style={{ maxWidth: 480, margin: "0 auto", padding: "18px 16px 40px" }}>
      {page === "reports" ? (
        <SalesmanReportsPage leads={leads} dailyTarget={target} monthlyTarget={monthTarget} />
      ) : (
        <>
      <div hidden={!dashboard}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>{session.fullName}</div>
          <div style={{ fontSize: 12, color: T.inkSoft }}>{session.phone}</div>
        </div>
        <button
          onClick={onToggleDay}
          disabled={togglingDay}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 11, border: "none",
            cursor: togglingDay ? "default" : "pointer", opacity: togglingDay ? 0.75 : 1,
            background: justToggledDay ? T.verifiedSoft : dayStarted ? T.dangerSoft : T.verifiedSoft,
            color: justToggledDay ? T.verified : dayStarted ? T.danger : T.verified, fontWeight: 700, fontSize: 13,
          }}
        >
          {togglingDay ? <Loader2 size={14} className="spin" /> : justToggledDay ? <CheckCircle2 size={14} /> : dayStarted ? <Square size={14} /> : <Play size={14} />}
          {togglingDay ? (dayStarted ? "Ending…" : "Starting…") : justToggledDay ? (dayStarted ? "Started" : "Ended") : dayStarted ? "End Day" : "Start Day"}
        </button>
      </div>

      {notificationLeadError && <div role="alert" style={{ padding: 12, color: T.danger, background: T.dangerSoft, marginBottom: 14 }}>{notificationLeadError}</div>}
      {loadError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "9px 12px", marginBottom: 14 }}>
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {(!online || queuedCount > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.warn, background: T.warnSoft, padding: "9px 12px", borderRadius: 11, marginBottom: 14 }}>
          <WifiOff size={14} />
          {!online
            ? "No connection — leads you capture now are saved on this device and will sync automatically once you're back online."
            : `Syncing ${queuedCount} queued lead${queuedCount === 1 ? "" : "s"}…`}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
        <StatCard label="Today" value={todayLeads.length} icon={TargetIcon} color={T.route} onClick={() => setShowTodayLeads(true)} />
        <StatCard label="Hot" value={allHotLeads.length} icon={Flame} color={T.danger} onClick={() => setShowHotLeads(true)} />
        <StatCard label="Conversation" value={inConversation.length} icon={MessageSquare} color={T.accent} onClick={() => setShowConversation(true)} />
        <StatCard label="Negotiation" value={inNegotiation.length} icon={Handshake} color={T.warn} onClick={() => setShowNegotiation(true)} />
        <StatCard label="Won" value={converted} sub={convertedValue > 0 ? fmtMoney(convertedValue) : undefined} icon={CheckCircle2} color={T.verified} onClick={() => setShowConverted(true)} />
        <StatCard label="Renewals" value={upcomingRenewals.length} sub="next 30 days" icon={CalendarClock} color={T.accent} onClick={() => setShowRenewals(true)} />
      </div>

      <div
        className="ft-card"
        style={{
          background: `linear-gradient(155deg, ${T.card} 0%, ${T.paperDeep} 100%)`,
          border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 18px 16px",
          marginBottom: 16, boxShadow: "0 1px 3px rgba(20,20,30,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
          <TargetIcon size={14} color={T.route} />
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13.5 }}>Your Targets</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>
          <span>Today</span>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>{Math.min(todayLeads.length, target)} / {target}</span>
        </div>
        <div style={{ height: 7, background: T.paperDeep, borderRadius: 11, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (todayLeads.length / target) * 100)}%`, background: T.route, transition: "width 0.3s ease", borderRadius: 11 }} />
        </div>

        <div style={{ height: 1, background: T.line, margin: "16px 0 14px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, color: T.inkSoft, marginBottom: 6 }}>
          <span>This month</span>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>{monthLeads.length} / {monthTarget}</span>
        </div>
        <div style={{ height: 7, background: T.paperDeep, borderRadius: 11, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (monthLeads.length / monthTarget) * 100)}%`, background: T.accent, transition: "width 0.3s ease", borderRadius: 11 }} />
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 6 }}>
          {monthLeads.length >= monthTarget ? "🎉 Target reached!" : `${monthTarget - monthLeads.length} more to hit this month's target`}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <BigButton icon={Plus} label="Add Lead" onClick={() => setShowAddLead(true)} primary disabled={!dayStarted && !allowLeadWithoutStartDay} />
        <BigButton icon={List} label="My Leads" onClick={() => setShowMyLeads(true)} />
      </div>

      {!dayStarted && !allowLeadWithoutStartDay && <div style={{ marginTop: 12, fontSize: 12, color: T.warn, background: T.warnSoft, padding: "8px 10px", borderRadius: 11 }}>Start your day to enable lead capture.</div>}

      </div>
      <div hidden={!dashboard && mobileTab !== "messages"}>
      <MessagesSection messages={messages} onMarkRead={onMarkMessageRead} onDelete={onDeleteMessage} onReply={onReplyMessage} employeeRepliesEnabled={employeeRepliesEnabled} onOpenLead={(id) => { const found = leads.find(l => l.id === id); if (found) setViewingLead(found); else api.salesmanLead(id).then(r => setViewingLead(mapLeadRow(r.lead))).catch(() => setNotificationLeadError("Couldn't open this lead.")); }} />
      </div>
      <div hidden={!dashboard}><TasksEntry onPendingChange={setPendingTasks} /></div>
      {visited.leads && <div hidden={!phone || mobileTab !== "leads"}>
        <MyLeadsModal embedded leads={leads} onSelectLead={setViewingLead} allowDateFilter />
      </div>}
      {visited.tasks && <div hidden={!phone || mobileTab !== "tasks"}><TasksModal embedded active={phone && mobileTab === "tasks"} /></div>}
      {phone && mobileTab === "more" && <section className="engage-salesman-more"><h2>More</h2>
        {[["quotations", "Quotations"], ["onboarding", "Onboarding checklist"], ["payments", "Payment due"], ["daily", "My Daily Reports"], ["settings", "Settings"]].map(([key, label]) => <button type="button" key={key} onClick={() => window.dispatchEvent(new CustomEvent("engage:salesman-more", { detail: key }))}>{label}<span aria-hidden="true">›</span></button>)}
      </section>}
      <AdminMobileNav active={mobileTab} onChange={switchTab} items={salesmanTabs} counts={{ tasks: pendingTasks, messages: messages.filter(message => !message.read_at).length }} label="Salesman navigation" />

      {showAddLead && (
        <AddLeadModal
          session={session}
          online={online}
          onClose={() => setShowAddLead(false)}
          onSubmit={onAddLead}
          onSaved={(lead) => { showSaveFeedback(lead.syncStatus === "queued" ? "Lead saved on device · Sync pending" : "Lead saved"); setShowAddLead(false); setViewingLead(lead); }}
        />
      )}
      {showMyLeads && <MyLeadsModal leads={leads} onClose={() => setShowMyLeads(false)} onSelectLead={setViewingLead} allowDateFilter />}
      {showTodayLeads && (
        <MyLeadsModal
          leads={todayLeads}
          title="Today's Leads"
          onClose={() => setShowTodayLeads(false)}
          onSelectLead={(l) => { setShowTodayLeads(false); setViewingLead(l); }}
        />
      )}
      {showHotLeads && (
        <MyLeadsModal
          leads={allHotLeads}
          title="🔥 Hot Leads"
          onClose={() => setShowHotLeads(false)}
          onSelectLead={(l) => { setShowHotLeads(false); setViewingLead(l); }}
        />
      )}
      {showConverted && (
        <MyLeadsModal
          leads={leads.filter((l) => l.status === "won")}
          title="Won Leads"
          onClose={() => setShowConverted(false)}
          onSelectLead={(l) => { setShowConverted(false); setViewingLead(l); }}
        />
      )}
      {showNegotiation && (
        <MyLeadsModal
          leads={inNegotiation}
          title="In Negotiation"
          onClose={() => setShowNegotiation(false)}
          onSelectLead={(l) => { setShowNegotiation(false); setViewingLead(l); }}
        />
      )}
      {showConversation && (
        <MyLeadsModal
          leads={inConversation}
          title="In Conversation"
          onClose={() => setShowConversation(false)}
          onSelectLead={(l) => { setShowConversation(false); setViewingLead(l); }}
        />
      )}
      {showRenewals && (
        <MyLeadsModal
          leads={upcomingRenewals}
          title="Renewals Due (Next 30 Days)"
          onClose={() => setShowRenewals(false)}
          onSelectLead={(l) => { setShowRenewals(false); setViewingLead(l); }}
        />
      )}
      {viewingLead && <LeadDetailDrawer lead={leads.find((l) => l.id === viewingLead.id) || viewingLead} onClose={() => setViewingLead(null)} onStatusChange={onUpdateLeadStatus} onUpdate={onUpdateLeadDetails} fetchHistory={api.salesmanLeadHistory} employeeRepliesEnabled={employeeRepliesEnabled} />}
      </>
      )}
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
  requireDealValue: false, requireFollowUpDate: false,
  duplicateProtectionEnabled: true, duplicateCheckPhone: true, duplicateCheckBusinessLocation: true, allowDuplicateOverride: false,
};
const DEFAULT_LOCATION_SETTINGS = { gpsLocation: true, locationMandatoryForNewLead: true, continuousGpsTracking: true };

// Tasks/messages sent by admin, shown right below the lead buttons on the
// salesman's own dashboard. Unread ones are visually distinct; tapping one
// marks it read.
function MessagesSection({ messages, onMarkRead, onDelete, onReply, employeeRepliesEnabled = true, onOpenLead }) {
  const unreadCount = messages.filter((m) => !m.read_at).length;
  // Lead-linked messages are conversations: one row per lead, while normal messages stay individual.
  const displayMessages = (() => {
    const leadThreads = new Map();
    const rows = [];
    messages.forEach((m) => {
      if (!m.lead_id) {
        rows.push({ ...m, _rowKey: `message:${m.id}`, _threadMessages: [m], _unreadCount: m.read_at ? 0 : 1 });
        return;
      }
      const key = String(m.lead_id);
      const existing = leadThreads.get(key);
      if (!existing) {
        const thread = { ...m, _rowKey: `lead:${key}`, _threadMessages: [m], _unreadCount: m.read_at ? 0 : 1 };
        leadThreads.set(key, thread);
        rows.push(thread);
      } else {
        existing._threadMessages.push(m);
        if (!m.read_at) existing._unreadCount += 1;
        if (new Date(m.created_at).getTime() > new Date(existing.created_at).getTime()) {
          const keep = { _rowKey: existing._rowKey, _threadMessages: existing._threadMessages, _unreadCount: existing._unreadCount };
          Object.assign(existing, m, keep);
        }
      }
    });
    return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  })();
  const markThreadRead = (m) => {
    (m._threadMessages || [m]).filter((item) => !item.read_at).forEach((item) => onMarkRead(item.id));
  };
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState("");
  const sendReply = async () => {
    if (!replyingTo || !replyText.trim() || replyBusy) return;
    setReplyBusy(true); setReplyError("");
    try { await onReply(replyingTo.id, replyText.trim()); setReplyingTo(null); setReplyText(""); }
    catch (e) { setReplyError(e.message || "Could not send reply."); }
    finally { setReplyBusy(false); }
  };

  return (
    <div className="ft-card" style={{ marginTop: 16, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: displayMessages.length ? 10 : 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 7 }}>
          <MessageSquare size={15} /> Messages
        </div>
        {unreadCount > 0 && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: T.danger, borderRadius: 999, padding: "2px 8px" }}>{unreadCount} new</span>
        )}
      </div>
      {displayMessages.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.inkSoft }}>No messages from admin yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayMessages.slice(0, 20).map((m) => (
            <div
              key={m._rowKey || m.id}
              style={{
                padding: "10px 12px", borderRadius: 11,
                background: m._unreadCount > 0 ? T.warnSoft : "#fff",
                border: `1px solid ${m._unreadCount > 0 ? "transparent" : T.line}`,
              }}
            >
              {m.lead_id && <div style={{ fontSize: 10.5, fontWeight: 800, color: T.route, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4, display:"flex", justifyContent:"space-between", gap:8 }}><span>Lead conversation{m.business_name ? ` · ${m.business_name}` : ""}</span>{m._threadMessages?.length > 1 && <span style={{color:T.inkSoft,textTransform:"none",letterSpacing:0}}>{m._threadMessages.length} messages</span>}</div>}
              <div onClick={() => m._unreadCount > 0 && markThreadRead(m)} style={{ fontSize: 13, color: T.ink, whiteSpace: "pre-wrap", cursor: m._unreadCount > 0 ? "pointer" : "default" }}>{m.body}</div>
              {m.lead_id && onOpenLead && <button onClick={() => { markThreadRead(m); onOpenLead(m.lead_id); }} style={{ marginTop: 8, border: `1px solid ${T.route}`, background: "#fff", color: T.route, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>Open Lead →</button>}
              {m.lead_id && employeeRepliesEnabled && onReply && <button onClick={() => { markThreadRead(m); setReplyingTo(m); setReplyText(""); setReplyError(""); }} style={{ marginTop: 8, marginLeft: 7, border: `1px solid ${T.line}`, background: T.paperDeep, color: T.ink, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>Reply</button>}
              {m.lead_id && !employeeRepliesEnabled && <div style={{ marginTop: 7, fontSize: 10.5, color: T.inkSoft }}>Replies disabled by Admin</div>}
              {replyingTo?.id === m.id && <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.line}` }}>
                <textarea autoFocus rows={3} maxLength={2000} value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Reply to Admin…" style={{ width:"100%", boxSizing:"border-box", resize:"vertical", border:`1px solid ${T.line}`, borderRadius:9, padding:"8px 9px", font:"inherit", fontSize:12.5, outline:"none" }} />
                {replyError && <div style={{fontSize:11,color:T.danger,marginTop:4}}>{replyError}</div>}
                <div style={{display:"flex",justifyContent:"flex-end",gap:7,marginTop:7}}><button disabled={replyBusy} onClick={()=>{setReplyingTo(null);setReplyText("");setReplyError("");}} style={{border:`1px solid ${T.line}`,background:"#fff",borderRadius:8,padding:"6px 9px",fontSize:11.5}}>Cancel</button><button disabled={replyBusy||!replyText.trim()} onClick={sendReply} style={{border:"none",background:T.route,color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:11.5,fontWeight:800,opacity:replyBusy?.65:1}}>{replyBusy?"Sending…":"Send Reply"}</button></div>
              </div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 10.5, color: T.inkSoft }}>{fmtTime(new Date(m.created_at))}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {m._unreadCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: T.warn }}>{m._unreadCount > 1 ? `${m._unreadCount} unread` : "Tap to mark read"}</span>}
                  {onDelete && !m.lead_id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                      style={{ border: "none", background: "none", cursor: "pointer", color: T.inkSoft, padding: 0, display: "flex", alignItems: "center" }}
                      title="Delete message"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function AddLeadModal({ session, online, onClose, onSubmit, onSaved }) {
  const [form, setForm] = useState({
    business: "", subLocation: "", posName: "", renewalMonth: "", renewalDate: "",
    owner: "", phone: "", category: "", status: "cold", notes: "", dealValue: "", nextFollowUpDate: "",
  });
  const [leadSettings, setLeadSettings] = useState(DEFAULT_LEAD_SETTINGS);
  const [locationSettings, setLocationSettings] = useState(DEFAULT_LOCATION_SETTINGS);
  const [fieldOptions, setFieldOptions] = useState({ category: [], pos_name: [], sub_location: [] });
  const [gps, setGps] = useState({ state: "locating" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [duplicateResult, setDuplicateResult] = useState(null);
  const [contactPickerSupported] = useState(() => typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window);

  const pickContact = async () => {
    try {
      const contacts = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (contacts.length > 0) {
        const c = contacts[0];
        const rawPhone = c.tel?.[0] || "";
        const digitsOnly = rawPhone.replace(/\D/g, "").slice(-10); // keep last 10 digits, strip +91 etc.
        setForm((f) => ({ ...f, phone: digitsOnly || rawPhone, owner: f.owner || c.name?.[0] || "" }));
      }
    } catch {
      /* user cancelled the picker, or it failed — no error needed, they can still type it in */
    }
  };

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
    api.salesmanGetLeadOptions()
      .then((res) => {
        setFieldOptions(res.options || { category: [], pos_name: [] });
        if (res.options?.category?.length) setForm((f) => (f.category ? f : { ...f, category: res.options.category[0] }));
      })
      .catch(() => { /* dropdowns just show empty if this fails — not fatal */ });
  }, []);

  useEffect(() => {
    if (!online || leadSettings.duplicateProtectionEnabled === false) { setDuplicateResult(null); return; }
    if (!form.phone.trim() && !(form.business.trim() && form.subLocation.trim())) { setDuplicateResult(null); return; }
    const timer = setTimeout(() => {
      api.salesmanCheckDuplicateLead({ phone: form.phone, businessName: form.business, subLocation: form.subLocation })
        .then(setDuplicateResult).catch(() => setDuplicateResult(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [online, form.phone, form.business, form.subLocation, leadSettings]);

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
    (!leadSettings.requireDealValue || form.dealValue.trim().length > 0) &&
    (!leadSettings.requireFollowUpDate || form.nextFollowUpDate.trim().length > 0) &&
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
      dealValue: form.dealValue ? Number(form.dealValue) : null,
      nextFollowUpDate: form.nextFollowUpDate || null,
      lat: hasGps ? gps.lat : null,
      lng: hasGps ? gps.lng : null,
      accuracyM: hasGps ? gps.accuracy : null,
      isMockSuspected: false,
      capturedAt: hasGps ? new Date().toISOString() : null,
      deviceId: getDeviceId(),
      allowDuplicate: duplicateResult?.allowOverride === true,
    };
    const result = await onSubmit(payload);
    setSubmitting(false);
    if (result.ok) onSaved(result.lead);
    else setError(result.error || "Couldn't save the lead — try again.");
  };

  return (
    <Overlay onClose={onClose} title="Add Lead">
      {!online && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.warn, background: T.warnSoft, padding: "8px 10px", borderRadius: 11, marginBottom: 12 }}>
          <WifiOff size={13} /> Offline — this will save to your device and sync when reconnected.
        </div>
      )}

      {locationSettings.gpsLocation && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
          <GpsStatus gps={gps} verification={verification} />
        </div>
      )}

      <AddLeadSection>Restaurant details</AddLeadSection>
      <AddLeadField label={`Business / Restaurant name${leadSettings.requireBusinessName ? " *" : ""}`}>
        <input style={inputStyle} value={form.business} onChange={set("business")} placeholder="e.g. Ganga Cafe" />
      </AddLeadField>
      <AddLeadField label={`Sub Location${leadSettings.requireSubLocation ? " *" : ""}`}>
        <input style={inputStyle} value={form.subLocation} onChange={set("subLocation")} placeholder="e.g. Gomti Nagar" list="sub-location-options" />
        <datalist id="sub-location-options">
          {(fieldOptions.sub_location || []).map((v) => <option key={v} value={v} />)}
        </datalist>
      </AddLeadField>
      <AddLeadField label={`POS Name${leadSettings.requirePosName ? " *" : ""}`}>
        <input style={inputStyle} value={form.posName} onChange={set("posName")} placeholder="Current POS/software being used" list="pos-name-options" />
        <datalist id="pos-name-options">
          {(fieldOptions.pos_name || []).map((v) => <option key={v} value={v} />)}
        </datalist>
      </AddLeadField>
      <AddLeadField label="Category">
        <input style={inputStyle} value={form.category} onChange={set("category")} placeholder="e.g. Cafe" list="category-options" />
        <datalist id="category-options">
          {(fieldOptions.category?.length ? fieldOptions.category : ["Cafe", "QSR", "Casual Dining", "Fine Dining", "Cloud Kitchen", "Bakery"]).map((v) => <option key={v} value={v} />)}
        </datalist>
      </AddLeadField>
      <AddLeadSection>Contact details</AddLeadSection>
      <AddLeadField label={`Contact Name${leadSettings.requireContactName ? " *" : ""}`}>
        <input style={inputStyle} value={form.owner} onChange={set("owner")} />
      </AddLeadField>
      <AddLeadField label={`Contact Number${leadSettings.requireContactNumber ? " *" : ""}`}>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={form.phone} onChange={set("phone")} />
          {contactPickerSupported && (
            <button
              type="button"
              onClick={pickContact}
              title="Pick from contacts"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.route, fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <Contact2 size={14} /> Pick
            </button>
          )}
        </div>
      </AddLeadField>
      <DuplicateLeadWarning result={duplicateResult} />
      <AddLeadSection>Deal &amp; follow-up</AddLeadSection>
      <AddLeadField label={`Stage${leadSettings.requireStatus ? " *" : ""}`}>
        <select style={inputStyle} value={form.status} onChange={set("status")}>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </AddLeadField>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label={`Expected Deal Value${leadSettings.requireDealValue ? " *" : ""}`}>
            <input style={inputStyle} type="number" min="0" inputMode="decimal" value={form.dealValue} onChange={set("dealValue")} placeholder="₹ e.g. 45000" />
          </AddLeadField>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label={`Next Follow-up${leadSettings.requireFollowUpDate ? " *" : ""}`}>
            <input style={inputStyle} type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} />
          </AddLeadField>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label="Renewal Month">
            <select style={inputStyle} value={form.renewalMonth} onChange={set("renewalMonth")}>
              <option value="">Select…</option>
              {MONTH_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </AddLeadField>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AddLeadField label="Renewal Date"><input style={inputStyle} type="date" value={form.renewalDate} onChange={set("renewalDate")} /></AddLeadField>
        </div>
      </div>
      <AddLeadField label={`Comments${leadSettings.requireComments ? " *" : ""}`}>
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.notes} onChange={set("notes")} />
      </AddLeadField>

      {error && <div style={{ fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px", marginBottom: 12 }}>{error}</div>}

      <button
        disabled={!canSubmit || submitting || duplicateResult?.blocking}
        onClick={handleSubmit}
        style={{ width: "100%", padding: "12px", borderRadius: 11, border: "none", cursor: canSubmit && !duplicateResult?.blocking ? "pointer" : "not-allowed", background: canSubmit && !duplicateResult?.blocking ? T.route : "#C7CDD6", color: "#fff", fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
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
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.danger, background: T.dangerSoft, borderRadius: 11, padding: "8px 10px" }}>
        <AlertTriangle size={14} />
        {gps.state === "denied" ? "Location permission denied — allow it to capture a lead." : "GPS unavailable on this device/browser."}
      </div>
    );
  }
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 11, padding: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
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

function MyLeadsModal({ leads, onClose, onSelectLead, title = "My Leads", allowDateFilter = false, embedded = false }) {
  const [briefLead, setBriefLead] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState("all"); // "all" | "month" — only shown for the Won Leads modal
  const isWonModal = title === "Won Leads";

  const shown = leads.filter(
    (l) =>
      (!filterDate || l.createdAt.toISOString().slice(0, 10) === filterDate) &&
      (filterStatus === "all" || l.status === filterStatus) &&
      (!isWonModal || revenuePeriod === "all" || isThisMonth(l.createdAt)) &&
      (!searchQuery.trim() || [l.business, l.owner, l.phone, l.subLocation].some((f) => f && f.toLowerCase().includes(searchQuery.trim().toLowerCase())))
  );

  const totalRevenue = isWonModal ? shown.reduce((sum, l) => sum + (l.dealValue || 0), 0) : 0;

  const Frame = embedded ? EmbeddedLeads : Overlay;
  return (
    <Frame onClose={onClose} title={title}>
      {isWonModal && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, padding: "10px 12px", background: T.paperDeep, borderRadius: 11 }}>
          <div>
            <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{revenuePeriod === "all" ? "All-time revenue" : "This month's revenue"}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: T.verified }}>{fmtMoney(totalRevenue)}</div>
          </div>
          <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 8, padding: 2, border: `1px solid ${T.line}` }}>
            <button
              onClick={() => setRevenuePeriod("all")}
              style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer", background: revenuePeriod === "all" ? T.route : "transparent", color: revenuePeriod === "all" ? "#fff" : T.inkSoft }}
            >
              All time
            </button>
            <button
              onClick={() => setRevenuePeriod("month")}
              style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 6, border: "none", cursor: "pointer", background: revenuePeriod === "month" ? T.route : "transparent", color: revenuePeriod === "month" ? "#fff" : T.inkSoft }}
            >
              This month
            </button>
          </div>
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.inkSoft }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by business, contact, phone, or area…"
          style={{ ...inputStyle, marginBottom: 0, width: "100%", padding: "9px 12px 9px 32px", boxSizing: "border-box" }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: T.inkSoft }}>
            <X size={14} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {!isWonModal && (
          <Select value={filterStatus} onChange={setFilterStatus} options={[["all", "All statuses"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])]} />
        )}
        {allowDateFilter && (
          <>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: 130 }} />
            {filterDate && (
              <button onClick={() => setFilterDate("")} style={{ fontSize: 11.5, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                Clear date
              </button>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: T.inkSoft, fontSize: 13, padding: "30px 8px" }}>
            <List size={22} style={{ opacity: 0.5 }} />
            {filterDate || filterStatus !== "all" || searchQuery.trim() ? "No leads match these filters." : 'No leads yet — tap "Add Lead" to create one.'}
          </div>
        )}
        {shown.map((l) => (
          <div key={l.id} className="ft-row" onClick={() => onSelectLead(l)} style={{ border: `1px solid ${T.line}`, borderRadius: 11, padding: 10, background: "#fff", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div aria-hidden="true" style={leadAvatarStyle(l.business)}>{leadInitials(l.business)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, minWidth: 0, overflowWrap: "anywhere" }}>{l.business}</div>
                  <button type="button" className="ft-lead-brief-pill" aria-label={`Brief for ${l.business}`} onClick={event => { event.stopPropagation(); setBriefLead(l); }}><Sparkles size={11} /> Brief</button>
                </div>
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 3, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{STATUS_LABEL[l.status]} · {fmtTime(l.createdAt)}</span>
              {l.renewalDate && (
                <span style={{ fontWeight: 700, color: T.accent }}>
                  Renews {new Date(l.renewalDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
              <SyncBadge syncStatus={l.syncStatus} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {briefLead && <LeadBriefPopup key={briefLead.id} lead={briefLead} buildBrief={buildLeadBrief} onClose={() => setBriefLead(null)} />}
    </Frame>
  );
}


function EmbeddedLeads({ title, children }) {
  return <section><h2 style={{ fontSize: 18, margin: "0 0 14px" }}>{title}</h2>{children}</section>;
}



