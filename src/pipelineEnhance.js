const ROOT_CLASS = 'engage-pipeline-enhanced';

function dispatchValue(el, value) {
  if (!el) return;
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function findPipeline() {
  const board = document.querySelector('.engage-deals-board');
  if (!board) return null;
  const root = board.closest('.engage-desktop-deals') || board.parentElement;
  if (!root) return null;
  const selects = [...root.querySelectorAll('select')];
  const date = root.querySelector('input[type="date"]');
  const search = [...root.querySelectorAll('input')].find((input) => /search leads/i.test(input.placeholder || ''));
  if (selects.length < 2) return { root, board, selects, date, search, controls: null };
  const controls = selects[0].parentElement?.parentElement || selects[0].parentElement;
  return { root, board, selects, date, search, controls };
}

function activeFilters(found) {
  const [employee, status] = found.selects;
  return Boolean(
    (employee && employee.value !== 'all') ||
    (status && status.value !== 'all') ||
    found.date?.value ||
    found.search?.value?.trim()
  );
}

function reset(found) {
  const [employee, status] = found.selects;
  dispatchValue(employee, 'all');
  dispatchValue(status, 'all');
  dispatchValue(found.date, '');
  dispatchValue(found.search, '');
}

function enhance() {
  const found = findPipeline();
  if (!found) return;
  const { root, controls, board } = found;
  root.classList.add(ROOT_CLASS);
  board.classList.add('engage-pipeline-board-polished');

  if (found.search) found.search.classList.add('engage-pipeline-search');
  if (controls) {
    controls.classList.add('engage-pipeline-controls');
    let resetBtn = controls.querySelector('.engage-pipeline-reset');
    const show = activeFilters(found);
    if (!resetBtn) {
      resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'engage-pipeline-reset';
      resetBtn.textContent = 'Reset filters';
      resetBtn.addEventListener('click', () => reset(found));
      controls.appendChild(resetBtn);
    }
    resetBtn.hidden = !show;
  }
}

let queued = false;
function queueEnhance() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; enhance(); });
}

const observer = new MutationObserver(queueEnhance);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value'] });
document.addEventListener('input', queueEnhance, true);
document.addEventListener('change', queueEnhance, true);
window.addEventListener('resize', queueEnhance);
window.addEventListener('load', queueEnhance);
requestAnimationFrame(queueEnhance);
