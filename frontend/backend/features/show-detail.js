// Public detail facade for the app-specific metadata providers.
(() => {
  window.SplitAppDetails = Object.freeze({ loadRef: (ref, settings) => window.SplitAppDetailController.loadRef(ref, settings), load: (item, settings) => item?.metadataSource === "mix" ? window.SplitAppMix.load(item, settings) : window.SplitAppDetailController.load(item, settings) });
})();
