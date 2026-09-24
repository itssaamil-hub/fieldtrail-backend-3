import React from 'react';
import { createRoot } from 'react-dom/client';
import ExceptionCentre from './ExceptionCentre.jsx';

let root = null;
let host = null;
let observer = null;
let queued = false;
const hidden = new Map();

function exceptionButton() {
  return [...document.querySelectorAll('.engage-desktop-sidebar button')].find(button => (button.getAttribute('aria-label') || button.textContent || '').trim() === 'Exception Centre');
}

function active() {
  const button = exceptionButton();
  return Boolean(button && button.getAttribute('aria-current') === 'page' && window.matchMedia('(min-width:1024px)').matches);
}

function ensureHost(shell, topbar) {
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.className = 'engage-exception-centre-host';
  topbar.insertAdjacentElement('afterend', host);
  root = createRoot(host);
  root.render(<ExceptionCentre />);
  return host;
}

function hideNormalContent(shell, topbar) {
  [...shell.children].forEach(node => {
    if (node === host || node === topbar || node.classList?.contains('engage-desktop-sidebar')) return;
    if (!hidden.has(node)) hidden.set(node, node.style.display || '');
    node.style.display = 'none';
  });
}

function restoreNormalContent() {
  hidden.forEach((display, node) => {
    if (node?.isConnected) node.style.display = display;
  });
  hidden.clear();
  if (host?.isConnected) host.style.display = 'none';
}

function apply() {
  queued = false;
  const shell = document.querySelector('.engage-desktop-shell');
  const topbar = shell?.querySelector(':scope > .engage-desktop-topbar');
  if (!shell || !topbar || !active()) {
    restoreNormalContent();
    return;
  }
  const page = ensureHost(shell, topbar);
  page.style.display = 'block';
  hideNormalContent(shell, topbar);
}

function queue() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(apply);
}

function install() {
  if (observer) return;
  observer = new MutationObserver(queue);
  observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['aria-current','class'] });
  window.addEventListener('resize', queue);
  queue();
}

install();
