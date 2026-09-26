import { api } from './api.js';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
let queued = false;

function monthFromDate(value){
  if(!value) return '';
  const m = Number(String(value).slice(5,7));
  return m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : '';
}

function formatDate(value){
  if(!value) return '';
  const [y,m,d] = String(value).split('-');
  if(!y || !m || !d) return value;
  return `${d}/${m}/${String(y).slice(-2)}`;
}

function generatedDateValue(){
  const inputs = [...document.querySelectorAll('[data-renewal-generated-date="true"]')];
  const active = inputs.find((el) => el.isConnected && el.value);
  return active?.value || '';
}

function normalizePayload(payload = {}){
  if (!payload || typeof payload !== 'object') return payload;
  const generated = !payload.renewalDate ? generatedDateValue() : '';
  const renewalDate = payload.renewalDate || generated || null;
  if (renewalDate) {
    return {
      ...payload,
      renewalDate,
      renewalMonth: monthFromDate(renewalDate) || payload.renewalMonth || null,
    };
  }
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

function commonAncestor(a, b, maxDepth = 4){
  let current = a;
  for(let depth = 0; current && depth <= maxDepth; depth += 1, current = current.parentElement){
    if(current.contains(b)) return current;
  }
  return null;
}

function buildGeneratedDateField(monthField){
  const monthWrap = monthField?.parentElement;
  if(!monthWrap?.parentElement) return null;
  const row = monthWrap.parentElement;
  if(row.querySelector('[data-renewal-generated-date-wrap="true"]')) {
    const wrap = row.querySelector('[data-renewal-generated-date-wrap="true"]');
    return {
      dateWrap: wrap,
      dateField: wrap.querySelector('[data-renewal-date-field="true"]'),
      dateLabel: wrap.querySelector('[data-renewal-date-label="true"]'),
      dateInput: wrap.querySelector('input[type="date"]'),
    };
  }

  const dateWrap = document.createElement('div');
  dateWrap.dataset.renewalDateWrap = 'true';
  dateWrap.dataset.renewalGeneratedDateWrap = 'true';
  dateWrap.style.minWidth = '0';

  const dateField = document.createElement('div');
  dateField.dataset.renewalDateField = 'true';

  const dateLabel = document.createElement('div');
  dateLabel.dataset.renewalDateLabel = 'true';
  dateLabel.textContent = '';

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.dataset.renewalGeneratedDate = 'true';
  dateInput.dataset.renewalNativeDate = 'true';
  dateInput.setAttribute('aria-label','Exact renewal or expiry date');

  dateField.appendChild(dateLabel);
  dateField.appendChild(dateInput);
  dateWrap.appendChild(dateField);
  monthWrap.insertAdjacentElement('afterend', dateWrap);
  row.dataset.renewalExpiryRow = 'true';

  return { dateWrap, dateField, dateLabel, dateInput };
}

function enhanceContainer(root){
  if(!visible(root)) return;
  const labelNodes = [...root.querySelectorAll('div')].filter(visible);
  const monthLabel = labelNodes.find(n => text(n) === 'Renewal Month' || text(n) === 'Renewal / Expiry Month' || text(n) === 'Renewal / Expiry');
  if(!monthLabel) return;

  const monthField = monthLabel.parentElement;
  const monthSelect = monthField?.querySelector('select');
  if(!monthSelect) return;

  let dateLabel = labelNodes.find(n => text(n) === 'Renewal Date' || text(n) === 'Exact Date (optional)');
  let dateField = dateLabel?.parentElement || null;
  let dateInput = dateField?.querySelector('input[type="date"]') || null;
  let dateWrap = dateField?.parentElement || null;

  // Some Add Lead variants render only Renewal Month. Create the exact-date
  // picker beside it so the combined control is always available.
  if(!dateInput){
    const generated = buildGeneratedDateField(monthField);
    if(!generated) return;
    ({ dateWrap, dateField, dateLabel, dateInput } = generated);
  }

  monthLabel.textContent = 'Renewal / Expiry';
  if(dateLabel){
    dateLabel.textContent = '';
    dateLabel.dataset.renewalDateLabel = 'true';
  }
  monthField.dataset.renewalMonthField = 'true';
  dateField.dataset.renewalDateField = 'true';

  const monthWrap = monthField.parentElement;
  if(monthWrap) monthWrap.dataset.renewalMonthWrap = 'true';
  if(dateWrap) dateWrap.dataset.renewalDateWrap = 'true';
  const commonRow = commonAncestor(monthWrap, dateWrap, 3);
  if(commonRow && commonRow !== root) commonRow.dataset.renewalExpiryRow = 'true';

  monthField.querySelector('[data-renewal-help]')?.remove();
  dateField.querySelector('[data-expiry-help]')?.remove();

  let pickerButton = dateField.querySelector('[data-renewal-date-picker]');
  if(!pickerButton){
    pickerButton = document.createElement('button');
    pickerButton.type = 'button';
    pickerButton.dataset.renewalDatePicker = 'true';
    pickerButton.setAttribute('aria-label','Choose exact renewal or expiry date');
    pickerButton.addEventListener('click', () => {
      try{
        if(typeof dateInput.showPicker === 'function') dateInput.showPicker();
        else dateInput.click();
      }catch{
        dateInput.focus();
        dateInput.click();
      }
    });
    dateInput.insertAdjacentElement('afterend', pickerButton);
  }

  dateInput.dataset.renewalNativeDate = 'true';

  const sync = () => {
    const derived = monthFromDate(dateInput.value);
    if(derived){
      if(monthSelect.value !== derived) setReactValue(monthSelect, derived);
      monthSelect.disabled = true;
      monthSelect.style.opacity = '.72';
      monthSelect.style.cursor = 'not-allowed';
      monthSelect.title = `Month is set automatically from ${dateInput.value}`;
      pickerButton.textContent = `📅 ${formatDate(dateInput.value)}`;
      pickerButton.dataset.hasDate = 'true';
    } else {
      monthSelect.disabled = false;
      monthSelect.style.opacity = '1';
      monthSelect.style.cursor = '';
      monthSelect.title = 'Choose a month when the exact date is not known';
      pickerButton.textContent = '📅 Exact date';
      pickerButton.dataset.hasDate = 'false';
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
    return t.includes('Renewal Month') || t.includes('Renewal / Expiry Month') || t.includes('Renewal / Expiry');
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
