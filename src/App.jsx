import DesktopContacts from './DesktopContacts.jsx';
import MobileContacts from './MobileContacts.jsx';
import DesktopDealsBoard from './DesktopDealsBoard';
import DesktopSidebar, { useDesktopSidebar } from "./DesktopSidebar.jsx";
import SaveFeedback from "./SaveFeedback.jsx";
import { showSaveFeedback } from "./saveFeedback.js";
import AdminMobileNav, { useAdminPhone, salesmanTabs } from "./AdminMobileNav.jsx";
import useUnreadNotifications from "./useUnreadNotifications.js";
import useAttendanceGps from "./useAttendanceGps.js";
import useAttendanceDay from "./useAttendanceDay.js";
import useSalesmanMessages from "./useSalesmanMessages.js";
import useSalesmanLeads from "./useSalesmanLeads.js";
import useSalesmanSettings from "./useSalesmanSettings.js";
import SalesmanView from "./salesman/SalesmanView.jsx";
import AdminActivityOverview from "./AdminActivityOverview.jsx";
import AdminAddLeadModalV2 from "./AdminAddLeadModal.jsx";
import AdminEmployeesPanel from "./admin/AdminEmployeesPanel.jsx";
import AdminDashboardPanel from "./admin/AdminDashboardPanel.jsx";
import AdminLeadsPanel from "./admin/AdminLeadsPanel.jsx";
import AdminReportsPage from "./admin/AdminReportsPage.jsx";
import useAdminData from "./admin/useAdminData.js";
import { createReportFeatures } from "./reports/ReportFeatures.jsx";
import { createLeadFeatures } from "./lead/LeadFeatures.jsx";
import { createAppShellFeatures } from "./app/AppShellFeatures.jsx";
import { createAdminAppView } from "./admin/AdminAppView.jsx";
import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
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
  getSession,
  setSession,
  clearSession,
  getWsBase,
  getDeviceId,
  getDayStarted,
  setDayStartedFlag,
  mapSalesmanRow,
  mapLeadRow,
  buildExportUrl,
} from "./api.js";

// Feature-level lazy boundaries keep infrequently used admin/report screens out
// of the startup bundle. Each wrapper owns its Suspense boundary so opening one
// feature never blanks the rest of the CRM while its chunk is fetched.
const withLazyBoundary = (LazyComponent) => {
  function LazyFeature(props) {
    return (
      <Suspense fallback={<div style={{ padding: 24, textAlign: "center", color: "#6B7280", fontSize: 13 }}>Loading…</div>}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }
  return LazyFeature;
};
const lazyDefault = (loader) => withLazyBoundary(lazy(loader));
const lazyNamed = (loader, exportName) => withLazyBoundary(lazy(() => loader().then((mod) => ({ default: mod[exportName] }))));

const ActivityCentre = lazyDefault(() => import("./ActivityCentre.jsx"));
const CollectionsPanel = lazyDefault(() => import("./Collections.jsx"));
const CollectionsEntry = lazyNamed(() => import("./Collections.jsx"), "CollectionsEntry");
const SalesmanBriefPopup = lazyDefault(() => import("./SalesmanBrief.jsx"));
const EmployeeSettings = lazyNamed(() => import("./DayClosing.jsx"), "EmployeeSettings");
const DayClosingForm = lazyNamed(() => import("./DayClosing.jsx"), "DayClosingForm");
const DayClosingReports = lazyNamed(() => import("./DayClosing.jsx"), "DayClosingReports");
const DayClosingReportsEntry = lazyNamed(() => import("./DayClosing.jsx"), "DayClosingReportsEntry");
const QuotationsPanel = lazyDefault(() => import("./Quotations.jsx"));
const QuotationSettings = lazyNamed(() => import("./Quotations.jsx"), "QuotationSettings");
const OnboardingPanel = lazyDefault(() => import("./Onboarding.jsx"));
const AppMenu = lazyNamed(() => import("./Onboarding.jsx"), "AppMenu");
const OnboardingTemplateEditor = lazyNamed(() => import("./Onboarding.jsx"), "OnboardingTemplateEditor");
const DealValueReport = lazyDefault(() => import("./DealValueReport.jsx"));
const TasksEntry = lazyNamed(() => import("./Tasks.jsx"), "TasksEntry");
const TasksModal = lazyNamed(() => import("./Tasks.jsx"), "TasksModal");
const LeadBriefPopup = lazyDefault(() => import("./LeadBriefPopup.jsx"));
const NotificationsPanel = lazyDefault(() => import("./NotificationsPanel.jsx"));
const AdminMobileLeadTrend = lazyNamed(() => import("./AdminMobileEnhancements.jsx"), "AdminMobileLeadTrend");
const AdminTeamActivitySheet = lazyNamed(() => import("./AdminMobileEnhancements.jsx"), "AdminTeamActivitySheet");
const ExceptionCentre = lazyDefault(() => import("./ExceptionCentre.jsx"));
const DataHealth = lazyDefault(() => import("./DataHealth.jsx"));
const AttendanceReport = lazyDefault(() => import("./AttendanceReport.jsx"));
const EnhancedDailyActivityReport = lazyDefault(() => import("./EnhancedDailyActivityReport.jsx"));

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
const dailyComparisonFor = (items, period, predicate = () => true) => {
  const now = new Date();
  const currentStart = new Date(now); currentStart.setHours(0, 0, 0, 0);
  const previousNow = new Date(now);
  if (period === "monthly") previousNow.setMonth(previousNow.getMonth() - 1);
  else previousNow.setDate(previousNow.getDate() - 7);
  const previousStart = new Date(previousNow); previousStart.setHours(0, 0, 0, 0);
  const count = (start, end) => items.filter((x) => x.createdAt >= start && x.createdAt <= end && predicate(x)).length;
  const current = count(currentStart, now);
  const previous = count(previousStart, previousNow);
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
  const apiBase = getApiBase();
  const [session, setSessionState] = useState(getSession());
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDailyReports,setShowDailyReports] = useState(false);
  const [collectionView,setCollectionView]=useState(null);
  useEffect(()=>{const open=e=>{setQuotationView(null);setShowOnboarding(false);setShowSettings(false);setCollectionView({initialKey:e.detail?.key||null});};window.addEventListener('fieldtrail:open-collections',open);return()=>window.removeEventListener('fieldtrail:open-collections',open);},[]);

  const [quotationView, setQuotationView] = useState(null);
  const [showOnboardingSettings, setShowOnboardingSettings] = useState(false);
  const [showCrmSettings, setShowCrmSettings] = useState(false);
  const [showDataHealth, setShowDataHealth] = useState(false);
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
  useEffect(() => {
    if (!adminDesktop) return;
    const open = () => { setDesktopSection("activity"); setTopPage("dashboard"); };
    window.addEventListener("engage:open-activity-centre", open);
    return () => window.removeEventListener("engage:open-activity-centre", open);
  }, [adminDesktop]);
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
    body = <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.paper, padding: 24 }}>
      <div style={{ maxWidth: 460, width: "100%", background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.ink }}>Backend unavailable</div>
        <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 8 }}>The production backend is not configured for this app. Please contact the administrator.</div>
      </div>
    </div>;
  } else if (!session) {
    body = <LoginScreen apiBase={apiBase} online={online} onLoggedIn={handleLoggedIn} onOpenSettings={() => setShowSettings(true)} />;
  } else if (session.role === "admin") {
    body = adminDesktop && desktopSection === "payments" && topPage !== "reports"
      ? <CollectionsPanel embedded />
      : adminDesktop && desktopSection === "exceptions" && topPage !== "reports"
      ? <ExceptionCentre onNavigate={selectDesktopSection} />
      : adminDesktop && desktopSection === "activity" && topPage !== "reports"
      ? <ActivityCentre onOpenLead={lead => { selectDesktopSection("leads"); setNotificationLead({id:lead.id, lead, openedAt:Date.now()}); }} />
      : <AdminApp desktopSection={adminDesktop ? (topPage === "reports" ? "reports" : desktopSection === "reports" ? "dashboard" : desktopSection) : null} notificationLead={notificationLead} session={session} online={online} onLogout={handleLogout} page={topPage} />;
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
          onClose={() => setShowSettings(false)}
          onLogout={session ? () => { setShowSettings(false); handleLogout(); } : undefined}
          onOpenCrmSettings={session?.role === "admin" ? () => { setShowSettings(false); setShowCrmSettings(true); } : undefined}
          onOpenDataHealth={session?.role === "admin" ? () => { setShowSettings(false); setShowDataHealth(true); } : undefined}
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
      {showDataHealth && <DataHealth onClose={() => setShowDataHealth(false)} />}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
const { LogoMark, TopBar, ConnectionPill, ConnectBackendScreen, LoginScreen, SettingsModal, StatCard, VerificationStamp, SyncBadge, NoLocationBadge, SettingToggle, AddExpenseModal, CrmSettingsModal, FieldOptionsSection, DownloadMenu, Tab, Select, LegendDot, Field, Overlay, inputStyle, EXPENSE_CATEGORIES } = createAppShellFeatures({ useState, useEffect, useRef, useCallback, api, ApiError, getSession, T, DASHBOARD_DISPLAY_KEY, getDashboardDisplaySettings, mapSalesmanRow, AppMenu, Loader2, Gauge, BarChart3, Wallet, Bell, WifiOff, Settings, LogOut, Download, RefreshCw, X, Plus, CheckCircle2, AlertTriangle });

// A little more visual flair than a plain bar — gradient fill, a percentage
// chip that shifts to green once the target's hit, and a trophy nod for it.
// Tap a salesman's name to see just their leads, broken out by Hot/Warm/
// Cold/Converted/Pending — instead of hunting through the main filtered list.
const { DataQualityReport, SalesmanPerformanceReport, FunnelReport, RenewalsReport, PaymentDueReport, PaymentHistoryList, EditPaymentModal, RecordPaymentModal, ExpensesReport, ExpenseEditModal, DailyActivityReport, TimeInStageReport, LeadExportReport, LeadsBoardView, EmptyReportState, SalesmanReportsPage, MyPerformanceReport, SalesmanLeadsModal, SalesmanRouteModal, AttendanceSummary, MessageComposeModal } = createReportFeatures({ React, useState, useEffect, useRef, useCallback, api, ApiError, T, fmtMoney, fmtTime, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, STATUS_LABEL, STATUSES, inputStyle, Select, Overlay, Field, DownloadMenu, buildExportUrl, LeadBriefPopup, buildLeadBrief, leadAvatarStyle, leadInitials, L, EXPENSE_CATEGORIES, Loader2, CalendarClock, TargetIcon, Contact2, PhoneIcon, MapPin, Receipt, Wallet, CheckCircle2, RefreshCw, Route, Pencil, Trash2, Search, X, DayClosingReportsEntry });

const { DuplicateLeadWarning, AddLeadField, AddLeadSection, AdminAddLeadModal, SalesmanFormModal, LeadDetailDrawer, SalesmanApp, MessagesSection, AddLeadOverlay, AddLeadModal, GpsStatus, MyLeadsModal, EmbeddedLeads } = createLeadFeatures({ useState, useEffect, useRef, useCallback, api, ApiError, T, inputStyle, STATUSES, STATUS_LABEL, MONTH_NAMES, uuid, fmtMoney, fmtTime, isToday, isThisMonth, isWithinDays, isUpcomingRenewalMonth, LeadBriefPopup, buildLeadBrief, leadAvatarStyle, leadInitials, VerificationStamp, NoLocationBadge, Overlay, Select, Field, StatCard, SalesmanReportsPage, TasksEntry, getDeviceId, getDayStarted, setDayStartedFlag, useSalesmanMessages, useSalesmanSettings, useAttendanceGps, useSalesmanLeads, useAttendanceDay, SalesmanView, DayClosingForm, Loader2, AlertTriangle, WifiOff, Navigation, Contact2, Search, List, Sparkles, Trash2, PhoneIcon, WhatsAppIcon, MessageSquare, X });

const { LiveMap, AdminApp, AdminView } = createAdminAppView({ useState, useEffect, useRef, L, api, ApiError, T, fmtMoney, fmtTime, isToday, isWithinDays, isUpcomingRenewalMonth, comparisonFor, dailyComparisonFor, getDashboardDisplaySettings, STATUS_LABEL, STATUSES, useAdminPhone, AdminMobileNav, AdminAddLeadModalV2, AdminEmployeesPanel, AdminDashboardPanel, AdminLeadsPanel, AdminReportsPage, useAdminData, TasksModal, DataQualityReport, SalesmanPerformanceReport, FunnelReport, RenewalsReport, ExpensesReport, TimeInStageReport, LeadExportReport, LeadsBoardView, MessageComposeModal, LeadDetailDrawer, SalesmanFormModal, MyLeadsModal, SalesmanRouteModal, VerificationStamp, NoLocationBadge, leadAvatarStyle, leadInitials, Overlay, Select, Tab, LegendDot, DownloadMenu, inputStyle, Loader2, Radio, Lock, LockOpen, AlertTriangle, RefreshCw, AdminTeamActivitySheet, SalesmanBriefPopup, EmployeeSettings, showSaveFeedback });
