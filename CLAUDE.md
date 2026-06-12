# R&B — Research and Beyond

Project rules and design system. Claude Code reads this at the start of every session.

## Brand

- Display name: **R&B** (always use the ampersand in visible UI text)
- Full name: **Research and Beyond**
- In CSS classes, IDs, file names, and JS variables → use `rb-` prefix (e.g. `.rb-hero`, `#rb-modes`, `rbHeroNetwork`). Ampersands are invalid in those contexts.
- In HTML `<title>` and meta tags → use `R&amp;B — Research and Beyond`
- Tagline: *From your first idea to your residency CV — in one intelligent workspace.*

## Audience

Early-career clinical researchers, mostly medical students preparing for US residency match. Heavily LMIC (Pakistan, India, Egypt, Nigeria, Philippines).

## Tech stack — strict

- Vanilla HTML5, CSS3, vanilla JavaScript. **No React, no Vue, no build tools, no bundlers, no TypeScript.**
- Only allowed external resources:
  - Google Fonts: Inter (400, 500, 600, 700) + Lora (400, 600, italic)
  - Lucide icons via CDN
- All CSS in `style.css`. All JS in `script.js`. No inline styles or scripts in HTML.
- Three files only: `index.html`, `style.css`, `script.js`. Do not create new files unless explicitly asked.

## Design system

### Color tokens (CSS custom properties on :root)

After every task, always run:

git add -A && git commit -m "[description]" && git push origin main

Never stop at commit without pushing.