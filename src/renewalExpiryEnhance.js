import { api } from './api.js';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let queued = false;

function monthFromDate(value){
  if(!value) return '';
  const m = Number(String(value).slice(5,7));
  return m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : '';
}

function normalizePayload(payload = {}){
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.renewalDate) return { ...payload, renewalMonth: monthFromDate(payload.renewalDate) || payload.renewalMonth || null };
  return payload;
}

function wrap(name){
  const original = api[name];
  if (typeof original !== 'function' || original.__engageRenewalUnified) return;
  const wrapped = function(...args){
    const payloadIndex = name.includes('UpdateLead') ? 1 : 0;
    if (args[payloadIndex] && typeof args[payloadIndex] === 'object') args[payloadIndex] = normalizePayload(args[payloadIndex]);
    return original.apply(api, args);
  };
  wrapped.__engageRenewalUnified = true;
  api[name] = wrapped;
}

function text(node){ return (node?.textContent || '').replace(/\s+/g,' ').trim(); }
function visible(node){
  if(!node || !node.isConnected || node.closest('[hidden]')) return false;
  const s = getComputedStyle(node);
  return s.display !== 'none' && s.visibility !== 'hidden' && node.getClientRects().length > 0;
}
function setReactValue(el, value){
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
  if(descriptor?.set) descriptor.set.call(el, value); else el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function enhanceContainer(root){
  if(!visible(root)) return;
  const labelNodes = [...root.querySelectorAll('div')].filter(visible);
  const monthLabel = labelNodes.find(n => text(n) === 'Renewal Month' || text(n) === 'Renewal / Expiry Month');
  const dateLabel = labelNodes.find(n => text(n) === 'Renewal Date' || text(n) === 'Exact Date (optional)');
  if(!monthLabel || !dateLabel) return;

  const monthField = monthLabel.parentElement;
  const dateField = dateLabel.parentElement;
  const monthSelect = monthField?.querySelector('select');
  const dateInput = dateField?.querySelector('input[type="date"]');
  if(!monthSelect || !dateInput) return;

  monthLabel.textContent = 'Renewal / Expiry Month';
  dateLabel.textContent = 'Exact Date (optional)';
  monthField.dataset.renewalMonthField = 'true';
  dateField.dataset.renewalDateField = 'true';
  const commonRow = monthField.parentElement === dateField.parentElement ? monthField.parentElement : null;
  if(commonRow) commonRow.dataset.renewalExpiryRow = 'true';

  if(!monthField.querySelector('[data-renewal-help]')){
    const help = document.createElement('div');
    help.dataset.renewalHelp = 'true';
    help.textContent = 'Use the month if the exact expiry date is not known.';
    help.style.cssText = 'font-size:10.5px;color:#8A919C;margin-top:4px;line-height:1.35;';
    monthField.appendChild(help);
  }
  if(!dateField.querySelector('[data-expiry-help]')){
    const help = document.createElement('div');
    help.dataset.expiryHelp = 'true';
    help.textContent = 'Choosing a date automatically sets the month.';
    help.style.cssText = 'font-size:10.5px;color:#8A919C;margin-top:4px;line-height:1.35;';
    dateField.appendChild(help);
  }

  const sync = () => {
    const derived = monthFromDate(dateInput.value);
    if(derived){
      if(monthSelect.value !== derived) setReactValue(monthSelect, derived);
      monthSelect.disabled = true;
      monthSelect.style.opacity = '.65';
      monthSelect.style.cursor = 'not-allowed';
      monthSelect.title = `Month is set automatically from ${dateInput.value}`;
    } else {
      monthSelect.disabled = false;
      monthSelect.style.opacity = '1';
      monthSelect.style.cursor = '';
      monthSelect.title = 'Choose a month when the exact date is not known';
    }
  };

  if(!dateInput.dataset.renewalExpiryBound){
    dateInput.dataset.renewalExpiryBound = 'true';
    dateInput.addEventListener('change', sync);
    dateInput.addEventListener('input', sync);
  }
  sync();
}

function apply(){
  queued = false;
  [...document.querySelectorAll('body *')].filter(node => {
    if(!visible(node)) return false;
    const t = text(node);
    return (t.includes('Renewal Month') || t.includes('Renewal / Expiry Month')) && (t.includes('Renewal Date') || t.includes('Exact Date (optional)'));
  }).forEach(enhanceContainer);
}
function queue(){ if(queued) return; queued = true; requestAnimationFrame(apply); }

wrap('adminCreateLead');
wrap('salesmanCreateLead');
wrap('adminUpdateLead');
wrap('salesmanUpdateLead');

new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
window.addEventListener('focus', queue);
setTimeout(queue,0);
