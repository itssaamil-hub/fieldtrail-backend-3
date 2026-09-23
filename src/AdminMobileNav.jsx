import React, { useEffect, useState } from "react";
import { Gauge, Contact2, Handshake, Users, Wallet } from "lucide-react";
import "./admin-mobile-nav.css";

export function useAdminPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 600px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setPhone(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}

const tabs = [["dashboard", "Dashboard", Gauge], ["leads", "Leads", Contact2], ["deals", "Deals", Handshake], ["employees", "Employees", Users], ["expenses", "Expenses", Wallet]];
export default function AdminMobileNav({ active, onChange }) {
  const phone = useAdminPhone();
  const [hidden, setHidden] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!phone) return;
    let anchor = window.scrollY, frame = 0;
    const scroll = () => {
      const y = Math.max(0, window.scrollY);
      if (y <= 12) { setHidden(false); anchor = y; }
      else if (Math.abs(y - anchor) > 12) { setHidden(y > anchor); anchor = y; }
    };
    const inspect = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const editing = document.activeElement?.matches('input, textarea, select, [contenteditable="true"]');
        const overlay = [...document.querySelectorAll('[role="dialog"], [style*="position: fixed"]')].some(el => {
          const style = getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.zIndex) >= 1000 && el.getClientRects().length > 0;
        });
        setBlocked(Boolean(editing || overlay));
      });
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("focusin", inspect);
    document.addEventListener("focusout", inspect);
    inspect();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("focusin", inspect);
      document.removeEventListener("focusout", inspect);
    };
  }, [phone]);
  useEffect(() => setHidden(false), [active]);
  if (!phone) return null;
  return <nav className={`engage-admin-bottom-nav${hidden || blocked ? " is-hidden" : ""}`} aria-label="Admin navigation" aria-hidden={hidden || blocked}>
    {tabs.map(([key, label, Icon]) => <button key={key} type="button" aria-current={active === key ? "page" : undefined} tabIndex={hidden || blocked ? -1 : 0} onClick={() => onChange(key)}><Icon size={21} strokeWidth={1.8} /><span>{label}</span></button>)}
  </nav>;
}
