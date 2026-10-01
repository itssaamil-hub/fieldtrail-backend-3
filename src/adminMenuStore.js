const listeners = new Set();

export function requestAdminMenuOpen() {
  listeners.forEach((listener) => listener());
}

export function subscribeAdminMenuOpen(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
