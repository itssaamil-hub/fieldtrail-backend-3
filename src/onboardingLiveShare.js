import { api, getApiBase, getSession } from './api.js';

let activeLeadId = null;
let stageValues = [];
let templateSteps = [];
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const leadPath = new RegExp(`/onboarding/(${UUID})(?:$|\\?)`, 'i');

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const input = args[0];
  const url = typeof input === 'string' ? input : input?.url || '';
  const method = String(args[1]?.method || input?.method || 'GET').toUpperCase();
  const match = url.match(leadPath);
  if (match && method === 'GET' && !url.includes('/summary') && !url.includes('/pdf')) activeLeadId = match[1];
  return originalFetch(...args);
};

// Optional stage support inside the existing Onboarding Settings page.
const originalTemplate = api.onboardingTemplate;
api.onboardingTemplate = async (...args) => {
  const result = await originalTemplate(...args);
  templateSteps = Array.isArray(result?.steps) ? result.steps : [];
  stageValues = templateSteps.map(step => step.stage || '');
  return result;
};

const originalSaveTemplate = api.onboardingSaveTemplate;
api.onboardingSaveTemplate = async body => {
  const steps = (body?.steps || []).map((step, index) => {
    const next = { ...step };
    const stage = stageValues[index] || '';
    if (stage) next.stage = stage;
    else delete next.stage;
    return next;
  });
  const result = await originalSaveTemplate({ ...body, steps });
  templateSteps = Array.isArray(result?.steps) ? result.steps : steps;
  stageValues = templateSteps.map(step => step.stage || '');
  return result;
};

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

async function requestShareLink() {
  if (!activeLeadId) throw new Error('Open a customer onboarding checklist first.');
  const response = await originalFetch(`${getApiBase()}/onboarding/${activeLeadId}/share-link`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getSession()?.token || ''}`, 'Content-Type': 'application/json' },
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || 'Could not create progress link.');
  return data;
}

function mountShareControl() {
  if (!activeLeadId || !['admin','salesman'].includes(getSession()?.role)) return;
  const panel = document.querySelector('.ft-onboarding');
  if (!panel || panel.querySelector('.ft-ob-live-share-addon')) return;
  const heading = panel.querySelector('.ft-ob-heading h3');
  const progress = panel.querySelector('progress');
  if (!heading || !progress) return;

  const host = document.createElement('div');
  host.className = 'ft-ob-live-share-addon';
  host.innerHTML = `
    <button type="button" class="ft-ob-primary ft-ob-live-share-button">Share live progress</button>
    <p class="ft-ob-muted" style="margin:7px 0 0">Share anytime. The customer sees the latest read-only checklist progress.</p>
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
      const data = await requestShareLink();
      const shareUrl = data.shareUrl;
      if (!shareUrl) throw new Error('Progress link was not returned by the server.');
      const progressText = `${data.completed} of ${data.total} completed`;
      const business = data.businessName || heading.textContent?.trim() || 'your restaurant';
      const phone = normalizePhone(data.phone);
      const message = `Hi, you can track ${business}'s onboarding progress here:\n${shareUrl}\n\nCurrent progress: ${progressText}.`;
      const whatsapp = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;
      result.innerHTML = `
        <p class="ft-ob-muted">${progressText} · Customer sees a read-only live checklist. Internal notes are hidden.</p>
        <input class="ft-ob-live-link ft-ob-live-link-desktop" readonly value="${shareUrl.replace(/"/g, '&quot;')}" aria-label="Customer progress link" />
        <div class="ft-ob-live-link-row">
          <button type="button" class="ft-ob-live-copy">Copy link</button>
          <a class="ft-ob-primary ft-ob-live-whatsapp" href="${whatsapp}" target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
        </div>
      `;
      result.hidden = false;
      result.querySelector('.ft-ob-live-copy').addEventListener('click', async event => {
        try {
          await navigator.clipboard.writeText(shareUrl);
          event.currentTarget.textContent = 'Copied ✓';
          setTimeout(() => { event.currentTarget.textContent = 'Copy link'; }, 1600);
        } catch {
          event.currentTarget.textContent = 'Copy failed';
          setTimeout(() => { event.currentTarget.textContent = 'Copy link'; }, 1600);
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

function mountStageSelectors() {
  const panel = document.querySelector('.ft-onboarding');
  if (!panel || panel.querySelector('#ft-onboarding-title')?.textContent?.trim() !== 'Onboarding checklist settings') return;
  [...panel.querySelectorAll('.ft-ob-edit')].forEach((row, index) => {
    if (row.querySelector('.ft-ob-stage-field')) return;
    const field = document.createElement('label');
    field.className = 'ft-ob-stage-field';
    field.style.cssText = 'display:block;margin-top:8px;font-size:11px;color:#6B7280;';
    field.append('Stage (optional)');
    const select = document.createElement('select');
    select.style.cssText = 'display:block;width:100%;margin-top:5px;padding:8px 9px;border:1px solid #E1E5E8;border-radius:9px;background:#fff;color:#1A1D23;font:inherit;';
    [['','No stage'],['setup','Setup'],['training','Training'],['go_live','Go Live']].forEach(([value,label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; select.appendChild(option);
    });
    select.value = stageValues[index] || templateSteps[index]?.stage || '';
    select.addEventListener('change', () => { stageValues[index] = select.value; });
    field.appendChild(select);
    const firstLabel = row.querySelector('label');
    if (firstLabel) firstLabel.insertAdjacentElement('afterend', field); else row.prepend(field);
  });
}

function enhance() {
  mountShareControl();
  mountStageSelectors();
}

const observer = new MutationObserver(() => requestAnimationFrame(enhance));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', enhance);
