import { getApiBase, getSession } from './api.js';

const COLORS = {
  ink: '#1A1D23', soft: '#6B7280', line: '#E7E9EE', paper: '#F4F5F7', card: '#FFFFFF',
  green: '#12805C', greenSoft: '#E6F6EF', warn: '#B8791F', warnSoft: '#FDF3E0',
  danger: '#C0392B', dangerSoft: '#FBEAE8', route: '#145C5D'
};

function buttonStyle() {
  return [
    'width:100%', 'display:flex', 'align-items:center', 'justify-content:center', 'gap:8px',
    'padding:11px', 'border-radius:11px', `border:1px solid ${COLORS.line}`, 'cursor:pointer',
    'background:#EDEEF2', `color:${COLORS.ink}`, 'font-weight:700', 'font-size:13.5px', 'margin-bottom:18px'
  ].join(';');
}

function closeOverlay() {
  document.getElementById('engage-data-health-overlay')?.remove();
}

function iconFor(check) {
  if (check.ok) return '✓';
  return check.severity === 'critical' ? '!' : '•';
}

function labelFor(key) {
  return String(key || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, m => m.toUpperCase());
}

function renderContent(body, data, error) {
  if (error) {
    body.innerHTML = `<div style="padding:18px;border-radius:12px;background:${COLORS.dangerSoft};color:${COLORS.danger};font-size:13px;font-weight:700">${escapeHtml(error)}</div>`;
    return;
  }
  if (!data) {
    body.innerHTML = `<div style="padding:28px;text-align:center;color:${COLORS.soft};font-size:13px">Checking backend data health…</div>`;
    return;
  }

  const summary = data.summary || {};
  const checks = Array.isArray(data.checks) ? data.checks : [];
  const critical = Number(summary.critical || 0);
  const warning = Number(summary.warning || 0);
  const allGood = critical === 0 && warning === 0;
  const topBg = critical ? COLORS.dangerSoft : warning ? COLORS.warnSoft : COLORS.greenSoft;
  const topColor = critical ? COLORS.danger : warning ? COLORS.warn : COLORS.green;
  const statusText = critical ? `${critical} critical issue${critical === 1 ? '' : 's'}` : warning ? `${warning} warning${warning === 1 ? '' : 's'}` : 'All checks passed';

  const rows = checks.map(check => {
    const bad = !check.ok;
    const criticalCheck = bad && check.severity === 'critical';
    const bg = bad ? (criticalCheck ? COLORS.dangerSoft : COLORS.warnSoft) : '#fff';
    const color = bad ? (criticalCheck ? COLORS.danger : COLORS.warn) : COLORS.green;
    return `<div style="display:flex;align-items:center;gap:11px;padding:12px 13px;border:1px solid ${COLORS.line};border-radius:11px;background:${bg}">
      <div style="width:25px;height:25px;min-width:25px;border-radius:50%;display:grid;place-items:center;background:${color};color:#fff;font-weight:900;font-size:12px">${iconFor(check)}</div>
      <div style="min-width:0;flex:1">
        <div style="font-size:12.5px;font-weight:800;color:${COLORS.ink}">${escapeHtml(labelFor(check.key))}</div>
        <div style="font-size:11px;color:${COLORS.soft};margin-top:2px">${bad ? `${Number(check.count || 0)} record${Number(check.count || 0) === 1 ? '' : 's'} need attention` : 'OK'}</div>
      </div>
      ${bad ? `<span style="font-size:10px;font-weight:900;text-transform:uppercase;color:${color};letter-spacing:.4px">${escapeHtml(check.severity || 'warning')}</span>` : ''}
    </div>`;
  }).join('');

  const checkedAt = data.checkedAt ? new Date(data.checkedAt).toLocaleString('en-IN') : '—';
  body.innerHTML = `<div style="display:flex;gap:10px;align-items:center;padding:14px 15px;border-radius:13px;background:${topBg};color:${topColor};margin-bottom:14px">
      <div style="font-size:22px;font-weight:900">${allGood ? '✓' : critical ? '!' : '•'}</div>
      <div><div style="font-size:14px;font-weight:900">${escapeHtml(statusText)}</div><div style="font-size:11px;margin-top:2px;color:${COLORS.soft}">Last checked ${escapeHtml(checkedAt)}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div style="padding:11px;border:1px solid ${COLORS.line};border-radius:11px;background:#fff"><div style="font-size:10px;color:${COLORS.soft};font-weight:800;text-transform:uppercase">Checks</div><div style="font-size:20px;font-weight:900;color:${COLORS.ink};margin-top:2px">${checks.length}</div></div>
      <div style="padding:11px;border:1px solid ${COLORS.line};border-radius:11px;background:#fff"><div style="font-size:10px;color:${COLORS.soft};font-weight:800;text-transform:uppercase">Critical</div><div style="font-size:20px;font-weight:900;color:${critical ? COLORS.danger : COLORS.green};margin-top:2px">${critical}</div></div>
      <div style="padding:11px;border:1px solid ${COLORS.line};border-radius:11px;background:#fff"><div style="font-size:10px;color:${COLORS.soft};font-weight:800;text-transform:uppercase">Warnings</div><div style="font-size:20px;font-weight:900;color:${warning ? COLORS.warn : COLORS.green};margin-top:2px">${warning}</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${rows || `<div style="padding:20px;text-align:center;color:${COLORS.soft}">No checks returned.</div>`}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function loadHealth(body, refreshButton) {
  renderContent(body, null, null);
  if (refreshButton) refreshButton.disabled = true;
  try {
    const base = getApiBase();
    const session = getSession();
    if (!base || !session?.token) throw new Error('Admin session or backend URL is missing.');
    const response = await fetch(`${base}/admin/data-health`, {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.error || `Data Health request failed (${response.status})`);
    renderContent(body, data, null);
  } catch (err) {
    renderContent(body, null, err?.message || 'Could not load Data Health.');
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

function openDataHealth() {
  closeOverlay();
  const overlay = document.createElement('div');
  overlay.id = 'engage-data-health-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(17,24,39,.44);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box';
  overlay.innerHTML = `<div role="dialog" aria-modal="true" style="width:min(720px,100%);max-height:min(82vh,760px);background:${COLORS.paper};border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.22);display:flex;flex-direction:column;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid ${COLORS.line};background:#fff">
      <div><div style="font-size:16px;font-weight:900;color:${COLORS.ink}">Data Health</div><div style="font-size:11.5px;color:${COLORS.soft};margin-top:2px">Backend integrity checks for Engage</div></div>
      <div style="display:flex;gap:8px"><button data-dh-refresh style="border:1px solid ${COLORS.line};background:#fff;color:${COLORS.ink};border-radius:9px;padding:7px 10px;font-weight:800;font-size:11.5px;cursor:pointer">Refresh</button><button data-dh-close aria-label="Close" style="width:32px;height:32px;border:1px solid ${COLORS.line};background:#fff;color:${COLORS.ink};border-radius:9px;font-size:18px;cursor:pointer">×</button></div>
    </div>
    <div data-dh-body style="padding:16px;overflow:auto"></div>
  </div>`;
  document.body.appendChild(overlay);
  const body = overlay.querySelector('[data-dh-body]');
  const refresh = overlay.querySelector('[data-dh-refresh]');
  overlay.querySelector('[data-dh-close]').addEventListener('click', closeOverlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
  refresh.addEventListener('click', () => loadHealth(body, refresh));
  loadHealth(body, refresh);
}

function installButton() {
  if (getSession()?.role !== 'admin') return;
  const buttons = [...document.querySelectorAll('button')];
  const crmButton = buttons.find(b => b.textContent?.trim() === 'CRM Settings');
  if (!crmButton || document.getElementById('engage-data-health-button')) return;

  const button = document.createElement('button');
  button.id = 'engage-data-health-button';
  button.type = 'button';
  button.style.cssText = buttonStyle();
  button.innerHTML = '<span style="font-size:14px">✓</span><span>Data Health</span>';
  button.addEventListener('click', openDataHealth);
  crmButton.insertAdjacentElement('afterend', button);
  crmButton.style.marginBottom = '12px';
}

const observer = new MutationObserver(() => installButton());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('load', installButton);
setTimeout(installButton, 0);
