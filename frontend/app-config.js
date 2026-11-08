window.APP_CONFIG = {
  "name": "ScreenMark",
  "key": "screenmark",
  "tagline": "Keep your movies and TV progress in one place.",
  "addLabel": "title",
  "noun": "title",
  "nounPlural": "titles",
  "discoverNoun": "movie or series",
  "progressLabel": "Episode Increment",
  "statusRoles": { "queued": "Watchlist", "active": "In Progress", "hold": "On Hold", "dropped": "Dropped", "done": "Completed" },
  "categories": [
    {
      "key": "movie",
      "label": "Movies",
      "singular": "Movie",
      "icon": "▣",
      "unit": "minutes",
      "step": 10,
      "goalStep": 10,
      "goalLabel": "Runtime (minutes)",
      "progressLabel": "Minutes watched",
      "color": "#e05b68",
      "statuses": ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"]
    },
    {
      "key": "series",
      "label": "TV series",
      "singular": "TV series",
      "icon": "▤",
      "unit": "episodes",
      "step": 1,
      "goalStep": 1,
      "goalLabel": "Total episodes",
      "color": "#6657d9",
      "progressLabel": "Episodes watched",
      "statuses": ["Watchlist", "In Progress", "On Hold", "Dropped", "Completed"]
    }
  ],
  "version": "0.1.3"
};
