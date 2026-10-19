"""Build the static why.inbox.lv site from src/.

Run `python build.py` after editing src/i18n/*.json or the templates below.
It writes the landing page and the theme vote page in every language, plus
sitemap.xml, robots.txt and llms.txt. Generated files are committed because
GitHub Pages serves the repository as-is.
"""
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SITE = 'https://why.inbox.lv'
DEFAULT = 'lv'  # served without a language prefix
LANGS = ['lv', 'en', 'ru', 'lt', 'et']
# Legacy ?language= values on the old why.inbox.lv
LEGACY = {'lv': 'lv', 'en': 'en', 'ru': 'ru', 'lt': 'lt', 'ee': 'et', 'et': 'et'}
SIGNUP = '//login.inbox.lv/signup?go=portal&language={lang}'
SIGNIN = 'https://www.inbox.lv/'
GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=lv.inbox.mailapp&hl={lang}'
APP_STORE = 'https://apps.apple.com/lv/app/inbox.lv/id580527910'
SIGNUP_LANG = {'et': 'ee'}  # login.inbox.lv still uses the old code

I18N = {code: json.loads((ROOT / 'src' / 'i18n' / f'{code}.json').read_text('utf-8')) for code in LANGS}
ICONS = (ROOT / 'src' / 'icons.svg.html').read_text('utf-8').strip()

e = html.escape


def path_for(lang, page):
    """Site path of a page, e.g. ('ru', 'themes') -> '/ru/themes/'."""
    parts = ([] if lang == DEFAULT else [lang]) + ([page] if page != 'root' else [])
    return '/' + ''.join(p + '/' for p in parts)


def rel(from_path, to_path):
    """Relative link between two site paths, so the site also works from a sub-folder."""
    depth = from_path.count('/') - 1
    return ('../' * depth or './') + to_path.lstrip('/')


CONTEST = 'https://inboxtalismans.lv/'
UTM = 'utm_source=why.inbox.lv&utm_medium=header'
# Same services and order as the www.inbox.lv toolbar.
SERVICES = [('E-mail', '//login.inbox.lv/login?redirect_url=https%3A%2F%2Femail.inbox.lv%2Fmailbox'),
            ('Business', 'https://www.inbox.eu/{eu}/?' + UTM),
            ('Files', '//files.inbox.lv/?' + UTM),
            ('Foto', '//foto.inbox.lv/?' + UTM)]
MORE = SERVICES + [('Dating', '//dating.inbox.lv/?' + UTM), ('Calendar', '//calendar.inbox.lv/?' + UTM),
                   ('Games', '//games.inbox.lv/?' + UTM), ('Contacts', '//contacts.inbox.lv/?' + UTM),
                   ('Shortlink', '//inx.inbox.lv/?' + UTM), ('News', 'https://news.inbox.lv/?language={lang}&' + UTM),
                   ('PP.lv', 'https://pp.lv/{lang}?' + UTM), ('XTV', 'https://xtv.lv/?' + UTM)]
PREMIUM = 'https://billing.inbox.lv/premium/mail?' + UTM
GLOBE = '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3"/></svg>'
CHEVRON = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'
BALLOT = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 11 3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'


def site_header(lang, page, here):
    """inbox.lv-style toolbar: logo, services, More menu, vote button, language picker."""
    t, h = I18N[lang], I18N[lang]['header']
    fill = lambda url: url.format(lang=lang if lang != 'et' else 'ee', eu=lang if lang in ('lv', 'ru') else 'en')
    links = ''.join(f'<a class="ix-link" href="{e(fill(u))}">{n}</a>' for n, u in SERVICES)
    more = ''.join(f'<a href="{e(fill(u))}">{n}</a>' for n, u in MORE)
    langs = ''.join(
        f'<a href="{rel(here, path_for(code, page))}" hreflang="{code}" lang="{code}"'
        + (' aria-current="page"' if code == lang else '') + f'>{e(I18N[code]["name"])}</a>'
        for code in LANGS)
    themes = rel(here, path_for(lang, 'themes'))
    return f'''<header class="ix-header">
<a class="ix-logo" href="{rel(here, path_for(lang, 'root'))}"><img src="{rel(here, '/assets/img/inbox-lv-logo.svg')}" alt="Inbox.lv" width="150" height="27"></a>
<nav class="ix-nav" aria-label="{e(h["menu"])}"><a class="ix-link" href="https://www.inbox.lv/?{UTM}">{e(h["home"])}</a>{links}<a class="ix-link" href="//pricelist.inbox.lv/">Advertising</a><a class="ix-link contest" href="{CONTEST}">{e(h["contest"])} <span class="ix-badge">{e(h["new"])}</span></a>
<details class="ix-more"><summary>{e(h["more"])}{CHEVRON}</summary><div class="ix-menu">{more}<a class="ix-premium" href="{PREMIUM}">{e(h["premium"])}</a></div></details></nav>
<div class="ix-right"><a class="ix-vote" href="{themes}"{' aria-current="page"' if page == 'themes' else ''}>{BALLOT}{e(h["vote"])}</a>
<details class="ix-lang"><summary aria-label="{e(t["languageNav"])}: {e(t["name"])}">{GLOBE}<span class="ix-name">{e(t["name"])}</span></summary><nav class="ix-menu" aria-label="{e(t["languageNav"])}">{langs}</nav></details></div>
</header>
'''


def head(lang, page, here, meta, extra_head, json_ld):
    t = I18N[lang]
    url = SITE + here
    alternates = ''.join(
        f'<link rel="alternate" hreflang="{code}" href="{SITE}{path_for(code, page)}">\n' for code in LANGS)
    alternates += f'<link rel="alternate" hreflang="x-default" href="{SITE}{path_for(DEFAULT, page)}">\n'
    og_alt = ''.join(
        f'<meta property="og:locale:alternate" content="{I18N[c]["ogLocale"]}">\n' for c in LANGS if c != lang)
    image = SITE + '/assets/img/og-image.png'
    return f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(meta["title"])}</title>
<meta name="description" content="{e(meta["description"])}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{url}">
{alternates}<meta property="og:type" content="website">
<meta property="og:site_name" content="Inbox.lv">
<meta property="og:title" content="{e(meta["title"])}">
<meta property="og:description" content="{e(meta["description"])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{t["ogLocale"]}">
{og_alt}<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#cb0e22">
<link rel="icon" href="{rel(here, '/favicon.ico')}" sizes="any">
<link rel="icon" href="{rel(here, '/assets/img/favicon.svg')}" type="image/svg+xml">
{extra_head}<script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False, separators=(',', ':'))}</script>
</head>
'''


def organization():
    return {
        '@type': 'Organization', '@id': 'https://www.inbox.lv/#organization', 'name': 'Inbox.lv',
        'url': 'https://www.inbox.lv/', 'logo': SITE + '/assets/img/inbox-lv-logo.png',
        'sameAs': [GOOGLE_PLAY.format(lang='lv'), APP_STORE]}


def root_page(lang):
    t, r = I18N[lang], I18N[lang]['root']
    here = path_for(lang, 'root')
    themes = rel(here, path_for(lang, 'themes'))
    signup = SIGNUP.format(lang=SIGNUP_LANG.get(lang, lang))
    a = lambda p: rel(here, '/assets/' + p)
    ballot = BALLOT
    features = ''.join(
        f'<li class="feature"><img src="{a(f"img/features/feature-icon-{i}.png")}" alt="" width="120" height="120" loading="lazy" decoding="async">'
        f'<div><h3>{e(title)}</h3><p>{e(text)}</p></div></li>'
        for i, (title, text) in enumerate(r['features'], 1))
    photos = {'Liene': 1, 'Ilze': 3, 'Edgars': 2}
    reviews = ''.join(
        f'<li><figure class="review"><img src="{a(f"img/customers/customer-thumb-{photos[name]}.jpg")}" alt="{e(name)}" width="312" height="208" loading="lazy" decoding="async">'
        f'<figcaption><b>{e(name)}</b> \'{age}<small>{e(job)}</small></figcaption>'
        f'<blockquote><p>{e(quote)}</p></blockquote></figure></li>'
        for name, age, job, quote in r['reviews'])
    swatches = ''.join(f'<i style="background:#{c}"></i>' for c in ['C2DCF2', 'E4A0B7', 'B4C09C', 'FEC98F', '334B60'])
    json_ld = {'@context': 'https://schema.org', '@graph': [
        organization(),
        {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/', 'name': 'Inbox.lv',
         'publisher': {'@id': 'https://www.inbox.lv/#organization'}, 'inLanguage': LANGS},
        {'@type': 'WebPage', '@id': SITE + here, 'url': SITE + here, 'name': r['title'],
         'description': r['description'], 'inLanguage': lang, 'isPartOf': {'@id': SITE + '/#website'},
         'about': {'@id': 'https://www.inbox.lv/#organization'},
         'primaryImageOfPage': SITE + '/assets/img/hero-devices.png'},
        {'@type': 'MobileApplication', 'name': 'Inbox.lv', 'operatingSystem': 'Android, iOS',
         'applicationCategory': 'CommunicationApplication', 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR'},
         'downloadUrl': [GOOGLE_PLAY.format(lang=lang), APP_STORE], 'publisher': {'@id': 'https://www.inbox.lv/#organization'}},
    ]}
    legacy = ''
    if lang == DEFAULT:
        # Old links used /?language=xx; send them to the new language folder.
        targets = {k: path_for(v, 'root').lstrip('/') for k, v in LEGACY.items() if v != DEFAULT}
        legacy = ('<script>(function(){var m=/[?&]language=(\\w+)/.exec(location.search),t='
                  + json.dumps(targets, separators=(',', ':'))
                  + ';if(m&&t[m[1].toLowerCase()])location.replace(t[m[1].toLowerCase()])})()</script>\n')
    extra = (f'<link rel="preload" href="{a("img/hero-background.jpg")}" as="image">\n'
             f'<link rel="stylesheet" href="{a("header.css")}">\n'
             f'<link rel="stylesheet" href="{a("site.css")}">\n'
             f'<script src="{a("header.js")}" defer></script>\n' + legacy)
    return head(lang, 'root', here, r, extra, json_ld) + f'''<body>
<a class="skip" href="#main">{e(r["welcome"])}</a>
{site_header(lang, 'root', here)}<main id="main">
<section class="hero"><div class="wrap hero-in">
<div><h1><b>{e(r["heroBold"])}</b> {e(r["heroLight"])}</h1>
<div class="hero-cta"><a class="btn btn-red" href="{signup}">{e(r["signUp"])}</a></div></div>
<img class="hero-devices" src="{a("img/hero-devices.png")}" alt="{e(r["heroAlt"])}" width="535" height="345" fetchpriority="high">
</div></section>
<section class="features" aria-labelledby="welcome"><div class="wrap">
<h2 id="welcome">{e(r["welcome"])}</h2>
<ul class="feature-grid">{features}</ul>
</div></section>
<div class="wrap promos">
<section class="promo vote" aria-labelledby="vote-title"><h2 id="vote-title">{e(r["voteBanner"]["title"])}</h2><p>{e(r["voteBanner"]["text"])}</p><div class="swatches" aria-hidden="true">{swatches}</div><a class="btn btn-light" href="{themes}">{ballot}{e(r["voteBanner"]["button"])}</a></section>
<section class="promo contest" aria-labelledby="contest-title"><h2 id="contest-title">{e(r["contestCard"]["title"])}</h2><p>{e(r["contestCard"]["text"])}</p><a class="btn btn-outline" href="{CONTEST}">{e(r["contestCard"]["button"])}</a></section>
</div>
<section class="reviews" aria-labelledby="reviews"><div class="wrap">
<h2 id="reviews">{e(r["reviewsHeading"])}</h2>
<ul class="review-grid">{reviews}</ul>
<div class="center"><a class="btn btn-red" href="{signup}">{e(r["signUp"])}</a></div>
</div></section>
</main>
<footer class="footer"><div class="wrap">
<img class="mark" src="{a("img/inbox-lv-logo-gray.png")}" alt="Inbox.lv" width="167" height="38" loading="lazy">
<div class="apps"><span>{e(r["alsoAvailable"])}</span><span>
<a href="{GOOGLE_PLAY.format(lang=lang)}" aria-label="{e(r["googlePlay"])}"><img src="{a("img/app-android.png")}" alt="" width="40" height="40" loading="lazy"></a>
<a href="{APP_STORE}" aria-label="{e(r["appStore"])}"><img src="{a("img/app-apple.png")}" alt="" width="40" height="40" loading="lazy"></a>
</span></div>
</div></footer>
</body>
</html>
'''


def themes_page(lang):
    t, th = I18N[lang], I18N[lang]['themes']
    m = th['mailbox']
    here = path_for(lang, 'themes')
    s = lambda p: rel(here, '/themes/' + p)  # shared voting assets live in /themes/
    root = rel(here, path_for(lang, 'root'))
    client = {k: th[k] for k in ['previewOf', 'voteFor', 'families', 'colors', 'currentWhite', 'custom', 'poll', 'mailbox']}
    client_json = json.dumps(client, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    nav = ''.join(
        f'<button class="nav-item{" active" if i == 1 else ""}" type="button" data-info="{e(item.rstrip(" ▾"))}">{e(item)}</button>'
        for i, item in enumerate(m['nav']))
    ages = ''.join(f'<option value="{v}">{l}</option>' for v, l in [
        ('under_18', e(th['under18'])), ('18_24', '18–24'), ('25_34', '25–34'), ('35_44', '35–44'),
        ('45_54', '45–54'), ('55_64', '55–64'), ('65_plus', '65+')])
    json_ld = {'@context': 'https://schema.org', '@graph': [
        organization(),
        {'@type': 'WebPage', '@id': SITE + here, 'url': SITE + here, 'name': th['title'],
         'description': th['description'], 'inLanguage': lang, 'isPartOf': {'@id': SITE + '/#website'},
         'publisher': {'@id': 'https://www.inbox.lv/#organization'},
         'breadcrumb': {'@type': 'BreadcrumbList', 'itemListElement': [
             {'@type': 'ListItem', 'position': 1, 'name': 'Inbox.lv', 'item': SITE + path_for(lang, 'root')},
             {'@type': 'ListItem', 'position': 2, 'name': th['title'], 'item': SITE + here}]}},
    ]}
    extra = (f'<link rel="stylesheet" href="{rel(here, "/assets/header.css")}">\n'
             f'<link rel="stylesheet" href="{s("themes.css")}?v=6">\n'
             f'<script src="{rel(here, "/assets/header.js")}" defer></script>\n')
    return head(lang, 'themes', here, th, extra, json_ld) + f'''<body>
{ICONS}
{site_header(lang, 'themes', here)}<header class="study-heading"><h1>{e(th["h1"])}</h1><p>{e(th["intro"])}</p><p class="mobile-preview-note">{e(th["mobileNote"])}</p></header>
<main class="study-layout">
<section class="preview-controls" aria-label="{e(th["chooseAria"])}">
<div class="families" id="palettes"></div>
<form class="poll-panel" id="vote-form" autocomplete="off"><h2>{e(th["voteHeading"])}</h2><p>{e(th["demographicsNote"])}</p>
<div class="demographics"><label>{e(th["age"])} <select name="age"><option value="">{e(th["preferNot"])}</option>{ages}</select></label>
<label>{e(th["gender"])} <select name="gender"><option value="">{e(th["preferNot"])}</option><option value="woman">{e(th["woman"])}</option><option value="man">{e(th["man"])}</option><option value="other">{e(th["otherGender"])}</option></select></label></div>
<p id="vote-notice" class="vote-notice"></p>
<button type="submit" class="submit-vote" id="submit-vote" disabled>{e(th["poll"]["submit"])}</button><span class="vote-summary" id="vote-count" aria-live="polite"></span>
<p class="poll-status" id="vote-status" role="status" aria-live="polite"></p><p class="privacy-note">{e(th["privacy"])}</p></form>
</section>
<section class="preview-pane" id="preview-pane" aria-label="{e(th["previewAria"])}"><div class="preview-heading"><strong>{e(th["previewTitle"])}</strong><div class="preview-tools"><span>{e(th["previewHint"])}</span><button type="button" class="baseline" id="expand-mailbox">{e(th["fullScreen"])}</button></div></div>
  <div class="control-bottom"><div class="selected-color" aria-live="polite"><span class="selected-dot" id="selected-dot"></span><span id="color-name"></span><strong class="selected-hex" id="color-hex">#D6DAC4</strong></div><div class="options"><button type="button" class="baseline" id="baseline" aria-pressed="false">{e(th["currentWhite"])}</button><label class="custom-label">{e(th["customColor"])} <input id="custom-color" type="color" value="#d6dac4" aria-label="{e(th["customAria"])}"></label></div></div>
<div class="frame" id="mail-app" style="--theme:#d6dac4">
 <header class="mail-header"><div class="brand"><img class="brand-logo" src="{s("mail-logo.svg")}" width="127" height="40" alt="mail inbox.lv"></div><nav class="global-nav" aria-label="{e(m["servicesAria"])}">{nav}</nav><div class="header-right"><span class="language">◎ {e(t["name"])}</span><div class="avatar" aria-label="{e(m["demoAccount"])}">JD</div><button type="button" class="square-button" aria-label="{e(m["accountMenu"])}" data-info="{e(m["accountMenu"])}"><svg aria-hidden="true"><use href="#i-menu"/></svg></button></div></header>
 <div class="app-body"><aside class="sidebar"><button type="button" class="compose" id="compose"><svg aria-hidden="true"><use href="#i-compose"/></svg>{e(m["compose"])}</button><nav class="folders" id="folders" aria-label="{e(m["foldersAria"])}"></nav><div class="folder-heading"><svg aria-hidden="true"><use href="#i-down"/></svg>{e(m["foldersHeading"])}<svg aria-hidden="true"><use href="#i-settings"/></svg></div><div id="custom-folders"></div><div class="folder-heading"><svg aria-hidden="true"><use href="#i-down"/></svg>{e(m["labelsHeading"])}</div><button class="folder" type="button" data-folder="Work"><span style="color:#8b74be">●</span>{e(m["labels"]["Work"])}</button><button class="folder" type="button" data-folder="Personal"><span style="color:#75985c">●</span>{e(m["labels"]["Personal"])}</button><div class="storage"><span>{e(m["storageFull"])}</span><div class="storage-track"><div class="storage-fill"></div></div><div class="storage-bottom"><span>{e(m["storageUsed"])}</span><span>{e(m["moreSpace"])}</span></div></div></aside>
 <div class="main" id="main"><div class="toolbar" id="list-toolbar"><label class="select-all"><input type="checkbox" class="check" id="select-all" aria-label="{e(m["selectAll"])}"></label><div class="search-box"><svg aria-hidden="true"><use href="#i-search"/></svg><input type="search" id="search" placeholder="{e(m["search"])}" aria-label="{e(m["searchAria"])}"><svg aria-hidden="true"><use href="#i-settings"/></svg></div><div class="selection-actions"><span id="selection-count"></span><button class="icon-button" type="button" id="mark-read" aria-label="{e(m["markRead"])}"><svg aria-hidden="true"><use href="#i-mail"/></svg></button></div><button type="button" class="filter" id="unread-filter">{e(m["all"])}<svg aria-hidden="true"><use href="#i-down"/></svg></button><span class="filter sort">{e(m["newest"])}</span><button type="button" class="icon-button" id="previous" aria-label="{e(m["previous"])}" disabled><svg aria-hidden="true"><use href="#i-left"/></svg></button><button type="button" class="icon-button" id="next" aria-label="{e(m["next"])}"><svg aria-hidden="true"><use href="#i-right"/></svg></button></div><div class="inbox-list" id="mail-list" aria-label="{e(m["listAria"])}"></div><div class="list-footer"><span id="folder-status"></span><div class="paging"><span class="page-number" id="page-number">1</span><span>/ 2</span></div></div></div>
 </div>
</div>
</section></main>
<dialog class="theme-preview-dialog" id="theme-preview-dialog" aria-label="{e(th["fullScreenAria"])}"><div class="dialog-bar"><strong id="modal-color-name">{e(th["previewTitle"])}</strong><button type="button" id="close-theme-preview">{e(th["backToThemes"])}</button></div></dialog>
<p class="preview-note">{e(th["previewNote"])}</p>
<dialog id="demo-dialog"><h2 id="dialog-title">{e(m["composeMail"])}</h2><p>{e(th["demoNote"])}</p><button type="button" id="dialog-close">{e(th["close"])}</button></dialog>
<script type="application/json" id="i18n">{client_json}</script>
<script src="{s("app.js")}?v=5"></script>
<script src="{s("config.js")}"></script>
<script src="{s("poll.js")}?v=5"></script>
</body>
</html>
'''


def write(path, text):
    out = ROOT / path.lstrip('/')
    if path.endswith('/'):
        out = out / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, 'utf-8', newline='\n')
    print('wrote', out.relative_to(ROOT))


def sitemap():
    urls = []
    for page in ['root', 'themes']:
        links = ''.join(
            f'    <xhtml:link rel="alternate" hreflang="{c}" href="{SITE}{path_for(c, page)}"/>\n' for c in LANGS)
        links += f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}{path_for(DEFAULT, page)}"/>\n'
        for code in LANGS:
            urls.append(f'  <url>\n    <loc>{SITE}{path_for(code, page)}</loc>\n{links}  </url>\n')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
            + ''.join(urls) + '</urlset>\n')


def llms():
    en = I18N['en']
    lines = ['# Inbox.lv', '',
             '> Inbox.lv is a free Latvian email service (webmail and mobile apps for Android and iOS). '
             'This site, why.inbox.lv, explains why to choose Inbox.lv and hosts an open vote on new colour themes for Inbox.lv mail.', '',
             '## Key facts', '']
    lines += [f'- {title}: {text}' for title, text in en['root']['features']]
    lines += ['', '## Pages', '']
    for page, key in [('root', 'root'), ('themes', 'themes')]:
        for code in LANGS:
            lines.append(f'- [{I18N[code][key]["title"]}]({SITE}{path_for(code, page)}) ({I18N[code]["name"]})')
    lines += ['', '## Actions', '',
              f'- Create a free account: https://login.inbox.lv/signup?go=portal',
              f'- Sign in to webmail: {SIGNIN}',
              f'- Android app: {GOOGLE_PLAY.format(lang="en")}',
              f'- iOS app: {APP_STORE}',
              f'- Vote for new mail themes (no account needed): {SITE}/en/themes/', '']
    return '\n'.join(lines)


def main():
    for code in LANGS:
        write(path_for(code, 'root'), root_page(code))
        write(path_for(code, 'themes'), themes_page(code))
    write('sitemap.xml', sitemap())
    write('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')
    write('llms.txt', llms())


if __name__ == '__main__':
    main()
