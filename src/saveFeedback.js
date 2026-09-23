export function showSaveFeedback(message) {
  window.dispatchEvent(new window.CustomEvent('engage:save-feedback', { detail: message }));
}
export function savedActionMessage(path, method, body) {
  if (method === 'POST' && path === '/tasks') return 'Task saved';
  if (method === 'PATCH' && /^\/tasks\/[^/]+\/complete$/.test(path)) return 'Task completed';
  if (method === 'PATCH' && /^\/(admin|salesman)\/leads\/[^/]+$/.test(path) && Object.keys(body || {}).some(key => key !== 'status')) return 'Lead updated';
  if (method === 'POST' && path === '/quotations') return 'Quotation saved';
  if (method === 'POST' && /^\/quotations\/[^/]+\/revise$/.test(path)) return 'Quotation revision saved';
  if (method === 'POST' && /^\/collections\/[^/]+\/payments$/.test(path)) return 'Payment recorded';
  if (method === 'PUT' && path === '/day-closing/draft') return 'Day closing draft saved';
  return null;
}
