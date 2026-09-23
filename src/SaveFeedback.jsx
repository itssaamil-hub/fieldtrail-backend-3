import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import './save-feedback.css';
export default function SaveFeedback() {
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    const receive = event => {
      if (typeof event.detail !== 'string' || !event.detail) return;
      clearTimeout(timer.current);
      setNotice({ text: event.detail, id: Date.now() });
      timer.current = setTimeout(() => setNotice(null), 4000);
    };
    window.addEventListener('engage:save-feedback', receive);
    return () => { clearTimeout(timer.current); window.removeEventListener('engage:save-feedback', receive); };
  }, []);
  return <div className="engage-save-feedback" role="status" aria-live="polite" aria-atomic="true">
    {notice && <div key={notice.id} className="engage-save-feedback-message"><CheckCircle2 size={17} aria-hidden="true"/><span>{notice.text}</span><button type="button" aria-label="Dismiss confirmation" onClick={() => { clearTimeout(timer.current); setNotice(null); }}><X size={15}/></button></div>}
  </div>;
}
