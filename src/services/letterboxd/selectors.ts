// Profile root page (`/<user>/`) — the single page that carries every statistic.
// Cloudflare currently challenges this path for non-browser clients, so treat it
// as a bonus source rather than a dependency; see PROFILE_PAGE below.
export const SELECTORS = {
  // username lives in the `title` attribute of the displayname tooltip span
  username:    ".displayname.tooltip",
  // display name is the .label inside the h1
  displayName: ".person-display-name .label",
  memberSince: ".profile-metadata dd",
  totalFilms:  '.profile-stats a[href*="/films/"] .value',
  thisYear:    '.profile-stats a[href*="/diary/for/"] .value',
  following:   '.profile-stats a[href*="/following/"] .value',
  followers:   '.profile-stats a[href*="/followers/"] .value',
  lists:       '.profile-stats a[href*="/lists/"] .value',
  // avatar is the first img inside .profile-avatar
  avatar:      ".profile-avatar img",
  // recent watches live in #recent-activity (NOT the favorites .poster-grid)
  recentFilms: "#recent-activity .react-component[data-item-slug]",
  filmRating:  ".rating",
} as const

// Member sub-pages, which Cloudflare still serves to plain HTTP clients. Between
// them they cover every statistic the profile root would have given us.
export const PAGE_SELECTORS = {
  // `/<user>/films/`
  films: {
    // every member sub-page carries a mini profile header
    person:      ".profile-header[data-person]",
    avatar:      ".profile-mini-person .avatar img",
    displayName: ".profile-mini-person h1.title-3 a",
    // <h1 class="section-heading"><span class="tooltip" title="2,506 films">Watched</span>
    totalFilms:  "#content-nav .section-heading .tooltip",
    grid:        ".poster-grid .griditem .react-component[data-item-slug]",
  },
  // `/<user>/followers/` — its sub-nav links carry BOTH network counts, so one
  // request covers `following` and `followers`.
  network: {
    following: '.sub-nav a[href$="/following/"]',
    followers: '.sub-nav a[href$="/followers/"]',
  },
  // `/<user>/lists/`
  lists: {
    // <h2 class="section-heading"><span class="tooltip" title="11 lists">Lists</span>
    count:   "#content-nav .section-heading .tooltip",
    summary: ".list-summary",
    title:   "h2 a",
    value:   ".value",
  },
} as const
