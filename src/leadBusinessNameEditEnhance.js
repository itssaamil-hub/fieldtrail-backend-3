import { api } from './api.js';

let observer = null;
let queued = false;
let reloadScheduled = false;

function text(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function visible(node) {
  if (!node || !node.isConnected || node.closest('[hidden]')) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
}

function currentDrawer() {
  return [...document.querySelectorAll('.ft-lead-detail-panel')].find(visible) || null;
}

function editForm(drawer) {
  if (!drawer) return null;
  const save = [...drawer.querySelectorAll('button')].find((button) => visible(button) && ['Save changes', 'Saving…'].includes(text(button)));
  if (!save) return null;
  const fields = [...drawer.querySelectorAll('div')];
  const subLocationLabel = fields.find((node) => visible(node) && text(node) === 'Sub Location');
  const field = subLocationLabel?.parentElement;
  return field?.parentElement || null;
}

function readCurrentBusinessName(drawer) {
  const remembered = drawer?.dataset?.engageBusinessName;
  if (remembered) return remembered;

  const candidates = [...drawer.querySelectorAll('div')].filter((node) => {
    if (!visible(node)) return false;
    const style = getComputedStyle(node);
    return parseFloat(style.fontSize || '0') >= 19 && Number(style.fontWeight || 0) >= 600 && text(node).length > 0;
  });
  const name = text(candidates[0]);
  if (name) drawer.dataset.engageBusinessName = name;
  return name;
}

function mountBusinessField(drawer) {
  const form = editForm(drawer);
  if (!form || form.querySelector('[data-engage-business-name-field]')) return;

  const currentName = readCurrentBusinessName(drawer);
  const firstField = form.firstElementChild;
  if (!firstField) return;

  const wrapper = document.createElement('div');
  wrapper.dataset.engageBusinessNameField = 'true';
  wrapper.style.marginBottom = '10px';

  const label = document.createElement('div');
  label.textContent = 'Business Name';
  label.style.cssText = 'font-size:11.5px;color:#6B7280;font-weight:600;margin-bottom:4px;';

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName || '';
  input.required = true;
  input.autocomplete = 'organization';
  input.dataset.engageBusinessNameInput = 'true';
  input.dataset.originalValue = currentName || '';
  input.style.cssText = 'width:100%;padding:9px 10px;border-radius:7px;border:1px solid #E7E9EE;font-size:13.5px;font-family:Inter,system-ui,sans-serif;background:#fff;color:#1A1D23;box-sizing:border-box;';

  const help = document.createElement('div');
  help.textContent = 'Updates the restaurant/company name everywhere this lead is shown.';
  help.style.cssText = 'font-size:10.5px;color:#8A919C;margin-top:4px;line-height:1.35;';

  input.addEventListener('input', () => {
    input.value = input.value.replace(/^\s+/, '');
    input.style.borderColor = input.value.trim() ? '#E7E9EE' : '#C0392B';
  });

  wrapper.append(label, input, help);
  form.insertBefore(wrapper, firstField);
}

function businessInput() {
  const drawer = currentDrawer();
  if (!drawer) return null;
  const input = drawer.querySelector('[data-engage-business-name-input]');
  return input && visible(input) ? input : null;
}

function scheduleRefreshIfRenamed(input) {
  const next = input?.value?.trim() || '';
  const previous = input?.dataset?.originalValue?.trim() || '';
  if (!next || next === previous || reloadScheduled) return;
  reloadScheduled = true;
  // The shared drawer keeps its own local copy of the lead. A short refresh after
  // a successful rename guarantees every dashboard/list/brief uses the new name
  // immediately instead of waiting for a background refetch.
  setTimeout(() => window.location.reload(), 450);
}

function wrapUpdate(methodName) {
  const original = api[methodName];
  if (typeof original !== 'function' || original.__engageBusinessNameWrapped) return;

  const wrapped = async function wrappedLeadUpdate(id, payload = {}, ...rest) {
    const input = businessInput();
    const name = input?.value?.trim();
    if (input && !name) {
      input.focus();
      input.style.borderColor = '#C0392B';
      throw new Error('Business name is required.');
    }

    const nextPayload = input && name ? { ...payload, businessName: name } : payload;
    const result = await original.call(api, id, nextPayload, ...rest);
    if (input && name) {
      const drawer = currentDrawer();
      if (drawer) drawer.dataset.engageBusinessName = name;
      scheduleRefreshIfRenamed(input);
    }
    return result;
  };
  wrapped.__engageBusinessNameWrapped = true;
  api[methodName] = wrapped;
}

function apply() {
  queued = false;
  const drawer = currentDrawer();
  if (drawer) mountBusinessField(drawer);
}

function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(apply);
}

wrapUpdate('adminUpdateLead');
wrapUpdate('salesmanUpdateLead');

observer = new MutationObserver(queue);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener('focus', queue);
setTimeout(queue, 0);
