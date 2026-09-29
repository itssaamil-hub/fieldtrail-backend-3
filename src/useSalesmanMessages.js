import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

const MESSAGE_POLL_BASE_MS = 30000;
const MESSAGE_POLL_JITTER_MS = 10000;

export default function useSalesmanMessages() {
  const [messages, setMessages] = useState([]);
  const [employeeRepliesEnabled, setEmployeeRepliesEnabled] = useState(true);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(null);

  const loadMessages = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = api.salesmanGetMessages()
      .then((res) => {
        if (mountedRef.current) setMessages(res.messages || []);
        return res;
      })
      .catch(() => null)
      .finally(() => {
        if (inFlightRef.current === request) inFlightRef.current = null;
      });

    inFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let timerId = null;
    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      const jitter = Math.floor(Math.random() * MESSAGE_POLL_JITTER_MS);
      timerId = window.setTimeout(run, MESSAGE_POLL_BASE_MS + jitter);
    };

    const run = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        await loadMessages();
      }
      schedule();
    };

    const onVisibilityOrOnline = () => {
      if (stopped || document.visibilityState !== "visible" || navigator.onLine === false) return;
      loadMessages();
    };

    loadMessages();
    schedule();
    document.addEventListener("visibilitychange", onVisibilityOrOnline);
    window.addEventListener("online", onVisibilityOrOnline);

    return () => {
      stopped = true;
      mountedRef.current = false;
      if (timerId) window.clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onVisibilityOrOnline);
      window.removeEventListener("online", onVisibilityOrOnline);
    };
  }, [loadMessages]);

  const markMessageRead = useCallback(async (id) => {
    setMessages((prev) => prev.map((message) =>
      message.id === id
        ? { ...message, read_at: message.read_at || new Date().toISOString() }
        : message
    ));
    try {
      await api.salesmanMarkMessageRead(id);
    } catch {
      // Non-critical; the next load reconciles.
    }
  }, []);

  const deleteMessage = useCallback(async (id) => {
    setMessages((prev) => prev.filter((message) => message.id !== id));
    try {
      await api.salesmanDeleteMessage(id);
    } catch {
      loadMessages();
    }
  }, [loadMessages]);

  const replyToMessage = useCallback(async (id, body) => {
    const res = await api.salesmanReplyMessage(id, body);
    await loadMessages();
    return res;
  }, [loadMessages]);

  return {
    messages,
    employeeRepliesEnabled,
    setEmployeeRepliesEnabled,
    markMessageRead,
    deleteMessage,
    replyToMessage,
  };
}
