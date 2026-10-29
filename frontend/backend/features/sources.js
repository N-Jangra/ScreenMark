// Frontend-facing source settings helpers backed by this app's provider registry.
(() => {
  const metadata = window.SplitAppMetadata;
  window.SplitAppSources = Object.freeze({
    list: category => metadata.list(category),
    isEnabled: (sourceKey, preferences) => metadata.isEnabled(sourceKey, preferences),
    available: (category, preferences) => metadata.available(category, preferences),
    setEnabled(preferences, sourceKey, enabled) {
      if (!metadata.list().some(source => source.key === sourceKey)) return false;
      if (!preferences.metadataSources || typeof preferences.metadataSources !== "object") preferences.metadataSources = {};
      preferences.metadataSources[sourceKey] = Boolean(enabled);
      return true;
    }
  });
})();
