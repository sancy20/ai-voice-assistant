const listeners = new Set();

export function emitAction(payload) {
  for (const fn of listeners) fn(payload);
}

export function subscribeAction(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
