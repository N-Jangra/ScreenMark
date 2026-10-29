// Search page template for this app.
(() => {
  window.SplitAppPages = window.SplitAppPages || {};
  window.SplitAppPages.search = context => {
    const { esc, libraryQuery } = context;
    const { listOrEmpty, filteredItems } = window.SplitAppLibrary.create(context);
  function renderSearch() {
    const q = libraryQuery;
    const list = filteredItems(q);
    return `<section class="search-page"><label class="search-box collection-search"><span aria-hidden="true">⌕</span><input id="library-search" type="search" placeholder="Search your collection" value="${esc(q)}" autofocus aria-label="Search your collection"></label><div id="search-results">${listOrEmpty(list, "No matches found.")}</div></section>`;
  }
    return renderSearch();
  };
})();
