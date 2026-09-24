// Small desktop-only UX hardening for Exception Centre V2.
// Keeps the React workflow logic untouched while making snooze unmistakable.
let observer;
let toastTimer;

function toast(message, tone = 'success') {
  let node = document.querySelector('.exception-ux-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'exception-ux-toast';
    document.body.appendChild(node);
  }
  node.dataset.tone = tone;
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 2200);
}

function enhanceSnoozeButtons() {
  document.querySelectorAll('.exception-actions-v2 button[title="Snooze 1 day"], .exception-actions-v2 button[title="Pause 1 day"]').forEach(button => {
    if (button.dataset.snoozeEnhanced === '1') return;
    button.dataset.snoozeEnhanced = '1';
    button.classList.add('exception-snooze');
    button.title = 'Snooze for 1 day';
    const label = document.createElement('span');
    label.className = 'exception-snooze-label';
    label.textContent = 'Snooze';
    button.appendChild(label);

    button.addEventListener('click', () => {
      if (button.disabled) return;
      const row = button.closest('.exception-row-v2');
      const original = label.textContent;
      label.textContent = 'Snoozing…';
      button.classList.add('is-busy');
      setTimeout(() => {
        if (!row?.isConnected) {
          toast('Snoozed for 1 day');
          return;
        }
        label.textContent = original;
        button.classList.remove('is-busy');
        const warning = document.querySelector('.exception-warning');
        if (warning) toast(warning.textContent.trim() || 'Could not snooze this exception', 'error');
      }, 1200);
    }, { passive: true });
  });
}

function install() {
  if (observer) return;
  observer = new MutationObserver(enhanceSnoozeButtons);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceSnoozeButtons();
}

install();
