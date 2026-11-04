// Data worker: IndexedDB diffing and writes run here, off the UI thread.
importScripts("idb-store.js");
const core = self.SplitAppIDBCore;
self.onmessage = async event => {
  const { id, op, args = [] } = event.data || {};
  try {
    if (typeof core[op] !== "function") throw new Error(`Unknown data worker op: ${op}`);
    const result = await core[op](...args);
    self.postMessage({ id, ok: true, result: op === "open" ? null : result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) });
  }
};
