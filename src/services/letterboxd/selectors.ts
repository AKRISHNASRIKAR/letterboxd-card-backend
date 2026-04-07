export const SELECTORS = {
  // username lives in the `title` attribute of the displayname tooltip span
  username:    ".displayname.tooltip",
  // display name is the .label inside the h1
  displayName: ".person-display-name .label",
  memberSince: ".profile-metadata dd",
  totalFilms:  'a[href*="/films/"] .value',
  thisYear:    'a[href*="/diary/for/"] .value',
  following:   'a[href*="/following/"] .value',
  followers:   'a[href*="/followers/"] .value',
  lists:       'a[href*="/lists/"] .value',
  // avatar is the first img inside .profile-avatar
  avatar:      ".profile-avatar img",
  // recent films are react-component divs with data-item-slug inside the poster-grid
  recentFilms: ".poster-grid .react-component[data-item-slug]",
  filmRating:  ".rating",
} as const
