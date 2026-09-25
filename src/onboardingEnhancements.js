import { api, getApiBase, getSession } from './api.js';

let currentOnboardingId = null;
let stageValues = [];
let templateSteps = [];

// Capture the currently opened onboarding without changing the existing panel API.
const originalOnboardingGet = api.onboardingGet;
api.onboardingGet = async (id) => {
  currentOnboardingId = id;
  return originalOnboardingGet(id);
};

// Keep stage optional and persist it through the existing template save flow.
const originalTemplate = api.onboardingTemplate;
api.onboardingTemplate = async (...args) => {
  const result = await originalTemplate(...args);
  templateSteps = Array.isArray(result?.steps) ? result.steps : [];
  stageValues = templateSteps.map((step) => step.stage || '');
  return result;
};

const originalSaveTemplate = api.onboardingSaveTemplate;
api.onboardingSaveTemplate = async (body) => {
  const steps = (body?.steps || []).map((step, index) => {
    const stage = stageValues[index] || '';
    const next = { ...step };
    if (stage) next.stage = stage;
    else delete next.stage;
    return next;
  });
  const result = await originalSaveTemplate({ ...body, steps });
  templateSteps = Array.isArray(result?.steps) ? result.steps : steps;
  stageValues = templateSteps.map((step) => step.stage || '');
  return result;
};

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

async function createShareLink() {
  if (!currentOnboardingId) throw new Error('Open a customer onboarding checklist first.');
  const base = getApiBase();
  const token = getSession()?.token || '';
  const response = await fetch(`${base}/onboarding/${encodeURIComponent(currentOnboardingId)}/share-link`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data?.error || 'Could not create the progress link.');
  return data;
}

function copyText(text, button) {
  const done = () => {
    const previous = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = previous; }, 1400);
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => {});
  else {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try { document.execCommand('copy'); done(); } catch {}
    input.remove();
  }
}

function addShareButton(panel) {
  if (panel.querySelector('.engage-ob-live-share')) return;
  const heading = panel.querySelector('.ft-ob-heading');
  if (!heading || panel.querySelector('.ft-ob-summary')) return;

  const paymentsButton = [...panel.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'View customer payments');
  if (!paymentsButton) return;

  const wrap = document.createElement('div');
  wrap.className = 'engage-ob-live-share';
  wrap.style.cssText = 'margin:12px 0 14px;padding:12px;border:1px solid #DDE8E6;border-radius:12px;background:#F7FBFA;';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ft-ob-primary';
  button.textContent = 'Share live progress';
  button.style.width = '100%';

  const hint = document.createElement('p');
  hint.className = 'ft-ob-muted';
  hint.style.margin = '7px 0 0';
  hint.textContent = 'Share anytime. The customer sees the latest checklist progress in read-only mode.';

  wrap.append(button, hint);
  paymentsButton.insertAdjacentElement('afterend', wrap);

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Creating link…';
    try {
      const data = await createShareLink();
      wrap.querySelector('.engage-ob-share-result')?.remove();
      const result = document.createElement('div');
      result.className = 'engage-ob-share-result';
      result.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid #E2EBE9;';

      const progress = document.createElement('div');
      progress.style.cssText = 'font-size:12px;font-weight:700;color:#145C5D;margin-bottom:8px;';
      progress.textContent = `${data.completed} of ${data.total} completed · live link ready`;

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = 'Copy link';
      copy.addEventListener('click', () => copyText(data.shareUrl, copy));
      actions.appendChild(copy);

      const phone = normalizePhone(data.phone);
      const message = `Hi, you can track ${data.businessName || 'your'} onboarding progress here:\n${data.shareUrl}\n\nCurrent progress: ${data.completed} of ${data.total} completed.`;
      const whatsapp = document.createElement('a');
      whatsapp.className = 'ft-ob-primary';
      whatsapp.target = '_blank';
      whatsapp.rel = 'noopener noreferrer';
      whatsapp.textContent = 'Share on WhatsApp';
      whatsapp.href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
      actions.appendChild(whatsapp);

      result.append(progress, actions);
      wrap.appendChild(result);
      button.textContent = 'Refresh live link';
    } catch (error) {
      hint.textContent = error.message || 'Could not create the progress link.';
      hint.style.color = '#C0392B';
      button.textContent = 'Share live progress';
    } finally {
      button.disabled = false;
    }
  });
}

function addStageSelectors(panel) {
  const title = panel.querySelector('#ft-onboarding-title')?.textContent?.trim();
  if (title !== 'Onboarding checklist settings') return;
  const rows = [...panel.querySelectorAll('.ft-ob-edit')];
  rows.forEach((row, index) => {
    if (row.querySelector('.engage-ob-stage-field')) return;
    const field = document.createElement('label');
    field.className = 'engage-ob-stage-field';
    field.style.cssText = 'display:block;margin-top:8px;font-size:11px;color:#6B7280;';
    field.append('Stage (optional)');
    const select = document.createElement('select');
    select.style.cssText = 'display:block;width:100%;margin-top:5px;padding:8px 9px;border:1px solid #E1E5E8;border-radius:9px;background:#fff;color:#1A1D23;font:inherit;';
    [['','No stage'],['setup','Setup'],['training','Training'],['go_live','Go Live']].forEach(([value,label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = stageValues[index] || templateSteps[index]?.stage || '';
    select.addEventListener('change', () => { stageValues[index] = select.value; });
    field.appendChild(select);
    const firstLabel = row.querySelector('label');
    (firstLabel || row).insertAdjacentElement(firstLabel ? 'afterend' : 'beforeend', field);
  });
}

function enhance() {
  document.querySelectorAll('.ft-onboarding').forEach((panel) => {
    addShareButton(panel);
    addStageSelectors(panel);
  });
}

const observer = new MutationObserver(enhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
queueMicrotask(enhance);
