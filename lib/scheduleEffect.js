// Start external work after React finishes committing. Strict Mode's discarded
// effects and effects replaced before the microtask runs never start a request.
export function scheduleEffect(task) {
  let cancelled = false;
  let cleanup;
  queueMicrotask(() => {
    if (!cancelled) cleanup = task();
  });
  return () => {
    cancelled = true;
    if (typeof cleanup === 'function') cleanup();
  };
}
