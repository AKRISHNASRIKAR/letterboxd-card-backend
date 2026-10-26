# Bundled card fonts

Inter 5.3.0, Latin regular (400) and bold (700), downloaded from Fontsource:

- https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.ttf
- https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-700-normal.ttf

Inter is distributed under the SIL Open Font License; see OFL.txt, obtained from
https://github.com/rsms/inter/blob/master/LICENSE.txt.

The renderer loads these files from assets/fonts/ relative to the project root.
Vercel's function build explicitly includes this directory. No font CDN request
is required when rendering a card.
