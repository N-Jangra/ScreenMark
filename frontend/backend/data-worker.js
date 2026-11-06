// Data worker: IndexedDB operations and multi-source metadata merges run here, off the UI thread.
importScripts("idb-store.js", "features/mix-merge.js");
const core = self.SplitAppIDBCore;
self.onmessage = async event => {
  const { id, op, args = [] } = event.data || {};
  try {
    let result;
    if (op === "merge") result = self.SplitAppMixMerge.merge(...args);
    else if (typeof core[op] === "function") result = await core[op](...args);
    else throw new Error(`Unknown data worker op: ${op}`);
    self.postMessage({ id, ok: true, result: op === "open" ? null : result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || String(error) });
  }
};
