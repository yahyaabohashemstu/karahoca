// Seeded posts are signed "فريق KARAHOCA" ("KARAHOCA Team"), which showed in
// Arabic script on the English, Turkish and Russian pages. Names an admin
// typed are shown as they are.
const TEAM_AUTHOR_AR = 'فريق KARAHOCA';
const TEAM_AUTHOR: Record<string, string> = {
  en: 'KARAHOCA Team',
  tr: 'KARAHOCA Ekibi',
  ru: 'Команда KARAHOCA',
};

export const localizeAuthorName = (name: string, lang: string): string =>
  name?.trim() === TEAM_AUTHOR_AR ? TEAM_AUTHOR[lang] ?? name : name;
