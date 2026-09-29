import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

export default function useSalesmanMessages() {
  const [messages, setMessages] = useState([]);
  const [employeeRepliesEnabled, setEmployeeRepliesEnabled] = useState(true);

  const loadMessages = useCallback(async () => {
    try {
      const res = await api.salesmanGetMessages();
      setMessages(res.messages || []);
    } catch {
      // Messages are non-critical; the next poll retries.
    }
  }, []);

  useEffect(() => {
    loadMessages();
    const intervalId = setInterval(loadMessages, 30000);
    return () => clearInterval(intervalId);
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
