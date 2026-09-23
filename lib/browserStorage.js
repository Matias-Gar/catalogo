// Preferences and the cart must remain usable when browser storage is blocked
// or full. Failed writes live only in this tab until it is reloaded.
const temporaryValues = new Map();

export function getBrowserItem(key) {
  if (typeof window === 'undefined') return null;
  if (temporaryValues.has(key)) return temporaryValues.get(key);
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setBrowserItem(key, value) {
  if (typeof window === 'undefined') return;
  const text = String(value);
  try {
    window.localStorage.setItem(key, text);
    temporaryValues.delete(key);
  } catch {
    temporaryValues.set(key, text);
  }
}

export function removeBrowserItem(key) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
    temporaryValues.delete(key);
  } catch {
    // A tombstone prevents a previous persisted value from reappearing.
    temporaryValues.set(key, null);
  }
}
