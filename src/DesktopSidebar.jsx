import React, { useEffect, useState } from 'react';
import { Gauge, Contact2, Columns3, Users, ClipboardList, ShieldAlert, BarChart3, Settings, UserRound, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import './desktop-sidebar.css';

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
const sections = [['dashboard', 'Dashboard', Gauge], ['leads', 'Contacts', Contact2], ['deals', 'Pipeline', Columns3], ['employees', 'Employees', Users], ['tasks', 'Tasks', ClipboardList], ['exceptions', 'Exception Centre', ShieldAlert], ['reports', 'Reports', BarChart3]];
export default function DesktopSidebar({ active, collapsed, onCollapse, onSelect, onSettings, settingsOpen }) {
  const item = ([key, label, Icon]) => <button key={key} type="button" aria-label={label} title={collapsed ? label : undefined} aria-current={!settingsOpen && active === key ? 'page' : undefined} onClick={() => onSelect(key)}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>;
  const openAccount = () => window.dispatchEvent(new CustomEvent('engage:open-account-settings'));
  return <aside className={`engage-desktop-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-label="Admin sidebar">
    <div className="engage-sidebar-brand"><img src="/engage-logo.png" alt="" width="28" height="28"/><span>Engage</span></div>
    <nav aria-label="Admin sections">{sections.map(item)}</nav>
    <div className="engage-sidebar-footer">
      <button type="button" aria-label="My Account" title={collapsed ? 'My Account' : undefined} onClick={openAccount}><UserRound size={19} aria-hidden="true"/><span>My Account</span></button>
      <button type="button" aria-label="Settings" title={collapsed ? 'Settings' : undefined} aria-pressed={settingsOpen} onClick={onSettings}><Settings size={19} aria-hidden="true"/><span>Settings</span></button>
      <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onCollapse}>{collapsed ? <PanelLeftOpen size={19} aria-hidden="true"/> : <PanelLeftClose size={19} aria-hidden="true"/>}<span>Collapse sidebar</span></button>
    </div>
  </aside>;
}

