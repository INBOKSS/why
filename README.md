# why.inbokss.com

Static site served by GitHub Pages at **https://why.inbokss.com** (see `CNAME`).

| URL | Page |
| --- | --- |
| `/`, `/en/`, `/ru/`, `/lt/`, `/et/` | Landing page "Why Inbox.lv" (Latvian is the default, served at `/`) |
| `/themes/`, `/en/themes/`, … | Vote for the new Inbox Mail colour themes |
| `/themes/stats/` | Live aggregate vote statistics (English only) |

## Editing

All page text lives in `src/i18n/<lang>.json`; the HTML templates are in `build.py`.
After any change, regenerate the pages and commit the generated files together with the sources:

```bash
python build.py
```

The build writes every `index.html`, `sitemap.xml`, `robots.txt` and `llms.txt`.
Do not edit the generated `index.html` files by hand.

| File | Purpose |
| --- | --- |
| `assets/header.css`, `assets/header.js` | Shared inbox.lv-style header (both pages), fonts |
| `assets/site.css` | Landing page styles |
| `themes/themes.css`, `themes/app.js` | Theme picker and demo mailbox |
| `themes/poll.js`, `themes/config.js` | Vote submission to Supabase (publishable key only) |
| `*.sql` | Supabase schema, migrations and checks |

## SEO and AI discovery

Each page has its own title and description, a canonical URL, `hreflang` alternates (with `x-default` → Latvian),
Open Graph tags, and JSON-LD (Organization, WebSite/WebPage, MobileApplication, BreadcrumbList).
`sitemap.xml` lists every language version with alternates; `llms.txt` summarises the site for AI assistants.

## Local preview

```bash
python -m http.server 8790
```

Then open http://localhost:8790/. Note that submitting a vote locally records a real vote in Supabase.

## Fonts

Montserrat (SIL Open Font License) is self-hosted in `assets/fonts/` as a free stand-in for Proxima Nova.
