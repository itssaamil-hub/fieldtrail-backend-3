import React, { Suspense, lazy, useEffect, useState } from 'react';
import { History, Gauge, Contact2, Columns3, Users, ClipboardList, ShieldAlert, BarChart3, Settings, UserRound, PanelLeftClose, PanelLeftOpen, Wallet, ReceiptText, FileText } from 'lucide-react';
import './desktop-sidebar.css';

const QuotationsPanel = lazy(() => import('./Quotations.jsx'));

export function useDesktopSidebar() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
}
const sections = [['dashboard', 'Dashboard', Gauge], ['leads', 'Contacts', Contact2], ['deals', 'Pipeline', Columns3], ['quotations', 'Quotations', FileText], ['employees', 'Employees', Users], ['tasks', 'Tasks', ClipboardList], ['payments', 'Payments', Wallet], ['expenses', 'Expenses', ReceiptText], ['activity', 'Activity Centre', History], ['exceptions', 'Exception Centre', ShieldAlert], ['reports', 'Reports', BarChart3]];
export default function DesktopSidebar({ active, collapsed, onCollapse, onSelect, onSettings, settingsOpen }) {
  const [directActive, setDirectActive] = useState(null);
  const [quotationsOpen, setQuotationsOpen] = useState(false);
  useEffect(() => { if (active !== 'reports') setDirectActive(null); }, [active]);
  const item = ([key, label, Icon]) => {
    const selected = !settingsOpen && (key === 'quotations' ? quotationsOpen : (directActive ? directActive === key : active === key));
    const activate = () => {
      if (key === 'quotations') {
        setDirectActive(null);
        setQuotationsOpen(true);
        return;
      }
      setQuotationsOpen(false);
      if (key === 'expenses') {
        setDirectActive('expenses');
        sessionStorage.setItem('engage:open-report', 'expenses');
        window.dispatchEvent(new CustomEvent('engage:open-expenses'));
        onSelect('reports');
        return;
      }
      setDirectActive(null);
      onSelect(key);
    };
    return <button key={key} type="button" aria-label={label} title={collapsed ? label : undefined} aria-current={selected ? 'page' : undefined} onClick={activate}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>;
  };
  const openAccount = () => window.dispatchEvent(new CustomEvent('engage:open-account-settings'));
  return <>
    <aside className={`engage-desktop-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Admin sidebar">
      <div className="engage-sidebar-brand"><img src="/engage-logo.png" alt="" width="28" height="28"/><span>Engage</span></div>
      <nav aria-label="Admin sections">{sections.map(item)}</nav>
      <div className="engage-sidebar-footer">
        <button type="button" aria-label="My Account" title={collapsed ? 'My Account' : undefined} onClick={openAccount}><UserRound size={19} aria-hidden="true"/><span>My Account</span></button>
        <button type="button" aria-label="Settings" title={collapsed ? 'Settings' : undefined} aria-pressed={settingsOpen} onClick={()=>{setQuotationsOpen(false);onSettings();}}><Settings size={19} aria-hidden="true"/><span>Settings</span></button>
        <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onCollapse}>{collapsed ? <PanelLeftOpen size={19} aria-hidden="true"/> : <PanelLeftClose size={19} aria-hidden="true"/>}<span>Collapse sidebar</span></button>
      </div>
    </aside>
    {quotationsOpen&&<Suspense fallback={null}><QuotationsPanel onClose={()=>setQuotationsOpen(false)}/></Suspense>}
  </>;
}
