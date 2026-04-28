const actionListeners = new Set();
const mediaListeners = new Set();
const mediaControlListeners = new Set();
const resultsListeners = new Set();
const searchControlListeners = new Set();

export function emitAction(payload) {
  for (const fn of actionListeners) fn(payload);
}

export function subscribeAction(fn) {
  actionListeners.add(fn);
  return () => actionListeners.delete(fn);
}

export function emitMedia(payload) {
  for (const fn of mediaListeners) fn(payload);
}

export function subscribeMedia(fn) {
  mediaListeners.add(fn);
  return () => mediaListeners.delete(fn);
}

export function emitMediaControl(payload) {
  for (const fn of mediaControlListeners) fn(payload);
}

export function subscribeMediaControl(fn) {
  mediaControlListeners.add(fn);
  return () => mediaControlListeners.delete(fn);
}

export function emitResults(payload) {
  for (const fn of resultsListeners) fn(payload);
}

export function subscribeResults(fn) {
  resultsListeners.add(fn);
  return () => resultsListeners.delete(fn);
}

export function emitSearchControl(payload) {
  for (const fn of searchControlListeners) fn(payload);
}

export function subscribeSearchControl(fn) {
  searchControlListeners.add(fn);
  return () => searchControlListeners.delete(fn);
}
