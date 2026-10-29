# ScreenMark backend and source scope

This app supports movies and TV series. Its source registry is the single source of truth for the Settings toggles, discovery adapters, and detail loaders.

| Source | App categories |
|---|---|
| TVmaze | TV series |
| Wikidata | Movies |
| AniList | TV series |
| OMDb | Movies and TV series |

Every Discover result stores its provider ID. The Details route loads the corresponding provider's detail endpoint and displays a local fallback plus a source error if a request fails. API-key preferences and cache entries use this app's own namespace. The development proxy only accepts this app's source hosts.
