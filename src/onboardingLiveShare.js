import { api, getSession } from './api.js';

let activeLeadId = null;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const leadPath = new RegExp(`/onboarding/(${UUID})(?:$|\\?)`, 'i');

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const input = args[0];
  const url = typeof input === 'string' ? input : input?.url || '';
  const method = String(args[1]?.method || input?.method || 'GET').toUpperCase();
  const match = url.match(leadPath);
  if (match && method === 'GET' && !url.includes('/summary') && !url.includes('/pdf')) {
    activeLeadId = match[1];
  }
  return originalFetch(...args);
};

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

function mountShareControl() {
  if (getSession()?.role !== 'admin' || !activeLeadId) return;
  const panel = document.querySelector('.ft-onboarding');
  if (!panel || panel.querySelector('.ft-ob-live-share-addon')) return;
  const heading = panel.querySelector('.ft-ob-heading h3');
  const progress = panel.querySelector('progress');
  if (!heading || !progress) return;

  const host = document.createElement('div');
  host.className = 'ft-ob-live-share-addon';
  host.innerHTML = `
    <button type="button" class="ft-ob-primary ft-ob-live-share-button">Share live progress</button>
    <div class="ft-ob-live-share-result" hidden></div>
  `;
  const status = progress.nextElementSibling;
  (status?.parentNode || progress.parentNode).insertBefore(host, status?.nextSibling || progress.nextSibling);

  const button = host.querySelector('.ft-ob-live-share-button');
  const result = host.querySelector('.ft-ob-live-share-result');
  button.addEventListener('click', async () => {
    if (!activeLeadId || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Preparing…';
    result.hidden = true;
    try {
      const response = await api.onboardingSummary(activeLeadId);
      const summary = response.summary || {};
      const shareUrl = summary.shareUrl;
      if (!shareUrl) throw new Error('Progress link was not returned by the server.');
      const progressText = status?.textContent?.trim() || '';
      const business = heading.textContent?.trim() || summary.businessName || 'your restaurant';
      const phone = normalizePhone(summary.phone);
      const message = `Hi${summary.ownerName ? ` ${summary.ownerName}` : ''}, you can track ${business}'s onboarding progress here:\n${shareUrl}${progressText ? `\n\nCurrent progress: ${progressText}.` : ''}`;
      const whatsapp = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      result.innerHTML = `
        <p class="ft-ob-muted">Customer sees a read-only live checklist. Internal notes are hidden.</p>
        <div class="ft-ob-live-link-row">
          <input class="ft-ob-live-link" readonly value="${shareUrl.replace(/"/g, '&quot;')}" aria-label="Customer progress link" />
          <button type="button" class="ft-ob-live-copy">Copy link</button>
        </div>
        <a class="ft-ob-primary ft-ob-live-whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
      `;
      result.hidden = false;
      const input = result.querySelector('.ft-ob-live-link');
      input.addEventListener('focus', () => input.select());
      result.querySelector('.ft-ob-live-copy').addEventListener('click', async event => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          event.currentTarget.textContent = 'Copied ✓';
          setTimeout(() => { event.currentTarget.textContent = 'Copy link'; }, 1600);
        } catch {
          input.focus();
          input.select();
        }
      });
    } catch (error) {
      result.innerHTML = `<p class="ft-ob-live-error"></p>`;
      result.querySelector('p').textContent = error?.message || 'Could not create progress link.';
      result.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = 'Share live progress';
    }
  });
}

const observer = new MutationObserver(() => requestAnimationFrame(mountShareControl));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', mountShareControl);
