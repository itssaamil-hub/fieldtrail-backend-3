import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getApiBase, getSession, setSession } from "./api.js";

function findDesktopTopbarLeft() {
  return document.querySelector(".engage-desktop-topbar > div > div:first-child");
}

export default function BusinessNameTopBar() {
  const [businessName, setBusinessName] = useState(() => getSession()?.businessName || "");
  const [target, setTarget] = useState(() => findDesktopTopbarLeft());

  useEffect(() => {
    let alive = true;
    const session = getSession();
    if (!session?.token || session?.role !== "admin") return undefined;

    let attempts = 0;
    const findTarget = () => {
      const node = findDesktopTopbarLeft();
      if (node) {
        setTarget(node);
        return true;
      }
      return false;
    };
    findTarget();
    const targetTimer = window.setInterval(() => {
      attempts += 1;
      if (findTarget() || attempts >= 50) window.clearInterval(targetTimer);
    }, 100);

    const syncSession = (event) => {
      const next = event?.detail || getSession();
      if (typeof next?.businessName === "string") setBusinessName(next.businessName);
    };
    window.addEventListener("engage:session-updated", syncSession);

    const controller = new AbortController();
    fetch(`${getApiBase()}/auth/business-profile`, {
      headers: { Authorization: `Bearer ${session.token}` },
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Business profile request failed (${res.status})`);
      return res.json();
    }).then((data) => {
      if (!alive) return;
      const name = String(data?.business?.business_name || "").trim();
      setBusinessName(name);
      const current = getSession();
      if (current?.token && current.businessName !== name) setSession({ ...current, businessName: name });
    }).catch((err) => {
      if (err?.name !== "AbortError") console.warn("Could not load business profile", err);
    });

    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(targetTimer);
      window.removeEventListener("engage:session-updated", syncSession);
    };
  }, []);

  const session = getSession();
  if (!target || session?.role !== "admin" || !businessName) return null;

  return createPortal(
    <div
      title={businessName}
      aria-label={`Business: ${businessName}`}
      style={{
        order: -1,
        maxWidth: 260,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 13,
        fontWeight: 750,
        color: "#334155",
        marginRight: 2,
      }}
    >
      {businessName}
    </div>,
    target
  );
}
