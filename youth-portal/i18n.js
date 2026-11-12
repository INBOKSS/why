/* Valodas (LV / EN) aptaujai un statistikai. Ielādē PĒC survey-core.js.
   Datubāzē vienmēr tiek glabātas LATVIEŠU vērtības (iemesli, idejas, vecums), lai LV un EN atbildes
   statistikā summējas kopā. Tāpēc latviešu teksts ir "kanoniskais ID", un angļu teksts ir tikai attēlojums (TRANS).
   Jaunu iemeslu/ideju pievieno survey-core.js (latviski) UN šeit TRANS (angliski). */
(function (global) {
  const Survey = global.Survey;
  const LS = Survey.LS;

  /* Kanoniskais latviešu teksts -> angļu teksts (iemesli, idejas, vecums) */
  const TRANS = {
    'Izskatās labi':'Looks good', 'Noderīgi man':'Useful to me', 'Viegli saprast':'Easy to understand', 'Gribu to lietot':'I want to use it',
    'Neko īpašu':'Nothing special', 'Nezinu, vai lietošu':"Not sure I'd use it", 'Var labāk':'Could be better', 'Pietrūkst kaut kā':'Something is missing',
    'Nesaprotu, kas tas':"I don't get what it is", 'Man to nevajag':"I don't need it", 'Izskatās slikti':'Looks bad', 'Par pārblīvētu':'Too cluttered', 'Grūti lietot':'Hard to use',
    'Spēles man neinteresē':"Games don't interest me", 'Gribu spēlēt katru dienu':'I want to play every day',
    'Par daudz reklāmas':'Too many ads', 'Atlaides ir foršas':'The discounts are great',
    'Palīdz atrast darbu/praksi':'Helps me find a job or internship',
    'Reklāma traucē':'The ad is annoying', 'Neuzbāzīga':'Not intrusive',
    'Ziņas neinteresē':"News doesn't interest me", 'Labi, ka ziņas ir te':'Good that news is here',
    'Tumšais režīms':'Dark mode', 'Vairāk spēļu':'More games', 'Mūzika un podkasti':'Music and podcasts', 'Kalendārs':'Calendar',
    'Integrēts AI palīgs labākai digitālajai ikdienai':'Built-in AI assistant for a better digital everyday life',
    'Čats ar draugiem':'Chat with friends', 'Pasākumu biļetes':'Event tickets', 'Personalizētas ziņas':'Personalized news',
    'CV un dokumentu šabloni':'CV and document templates', 'Atgriezeniskās saites poga':'Feedback button',
    'Sasaiste ar skolas portāliem (E-klase, Moodle u.c.)':'Connection to school portals (E-klase, Moodle, etc.)',
    'līdz 15':'under 15',
  };

  const DICT = {
    lv: {
      'title':'Inbox.lv jauniešiem: kā tev patīk?',
      'h1':'Inbox.lv jauniešiem: <em>kā tev patīk?</em>',
      'intro':'Pirms palaižam jauno portālu, gribam zināt, ko domā tu. Pasaki, kas patīk un kas ne - tas aizņems tikai 1 minūti.',
      'start':'Sākt ↓', 'openProto':'Atvērt lapu ↗',
      'pill.time':'⏱ ~1 min', 'pill.anon':'🕶 Anonīmi',
      'phone.cap':'👆 Spied uz zvaniņa, spēles un citiem elementiem', 'phone.alt':'Jaunā inbox.lv portāla prototips, visa lapa', 'phone.aria':'Jaunā portāla prototips',
      'jump':'Beigt', 'jump.send':'Nosūtīt',
      'ideas.h':'Ko vēl gribētu? ✨', 'ideas.lead':'Izvēlies līdz 3 lietām, ko vēlētos redzēt jaunajā inbox.lv.',
      'ideas.hint':'Izvēlēts {n} no {max}', 'ideas.max':'Maksimums {max} - noņem kādu, lai izvēlētos citu',
      'final.h':'Kopējais iespaids', 'final.lead':'Kā tev šķiet jaunā lapa kopumā?', 'final.aria':'Kopējais vērtējums',
      'scale.lo':'Nepatīk', 'scale.hi':'Super!', 'scale.n':'{n} no 5',
      'face.1':'Ļoti nepatīk', 'face.2':'Nepatīk', 'face.3':'Normāli', 'face.4':'Patīk', 'face.5':'Ļoti patīk', 'face.hint':'Spied uz emoji, lai novērtētu', 'face.tag':'Tavs vērtējums',
      'age.label':'Cik tev gadu?',
      'comment.label':'Vēl kaut kas?', 'optional':'(nav obligāti)', 'comment.ph':'Idejas, kļūdas, kas traucē vai kas jāpievieno…',
      'submit':'Nosūtīt atbildes', 'sending':'Sūtām…', 'thanks.foot':'Paldies par Tavu viedokli! <3',
      'foot.results':'Skatīt rezultātus', 'foot.back':'Atpakaļ uz aptauju', 'redo':'Aizpildīt vēlreiz',
      'toast.section':'Novērtē vismaz vienu sadaļu 👆', 'toast.age':'Norādi savu vecumu 👆', 'toast.fail':'Neizdevās nosūtīt, pamēģini vēlreiz',
      'card.next':'Tālāk ↓', 'card.note.ph':'Pastāsti vairāk (nav obligāti)', 'card.note.aria':'Komentārs: {t}',
      'card.img.alt':'Ekrānšāvums: {t}', 'card.votes.aria':'Tavs vērtējums: {t}',
      'vote.like':'Patīk', 'vote.ok':'Normāli', 'vote.dislike':'Nepatīk',
      'q.like':'Kas tieši patīk? 😍', 'q.ok':'Kas varētu būt labāk? 🤔', 'q.dislike':'Kas nepatīk? 😬',
      'res.thanks.h':'Paldies! <em>💛</em>', 'res.thanks.p':'Tavas atbildes ir saņemtas. Zemāk - ko domā citi jaunieši.',
      'res.warn.local':'Serveris nav pieejams - atbildes saglabātas tikai šajā ierīcē.',
      'res.warn.queued':'Nav interneta - atbildes nosūtīsim, tiklīdz savienojums atjaunosies. Neaizver lapu.',
      'res.h':'Rezultāti <em>📊</em>', 'res.count':'Atbildējuši <b>{n}</b> jaunieši.', 'res.none':'Vēl nav neviena atbilde.', 'res.demo':' (demo dati)',
      'res.empty':'Kad kāds atbildēs, te parādīsies rezultāti.', 'res.loading':'Ielādējam…',
      'res.rating.of':'no 5 · {n} {w}', 'rating.one':'vērtējums', 'rating.many':'vērtējumi',
      'res.bysec':'Pa sadaļām', 'res.legend':'Zaļš - patīk, dzeltens - normāli, sarkans - nepatīk.',
      'votes.one':'balss', 'votes.many':'balsis', 'res.aria':'Patīk {a}%, normāli {b}%, nepatīk {c}%',
      'res.want':'Ko vēl grib ✨', 'res.popular':'Populārākās idejas.',
      'sec.top.t':'Augša: laiks un dzimšanas dienas', 'sec.top.s':'Laika ziņa un draugu dzimšanas dienas',
      'sec.email.t':'E-pasts', 'sec.email.s':'Pēdējās vēstules un ātrās pogas',
      'sec.game.t':'Dienas spēle', 'sec.game.s':'Vārdu mīkla katru dienu',
      'sec.offers.t':'Sponsoru piedāvājumi', 'sec.offers.s':'Atlaides un kodi jauniešiem',
      'sec.opps.t':'Iespējas tev', 'sec.opps.s':'Prakses, darbs, stipendijas, pasākumi',
      'sec.ad.t':'Reklāmas baneris', 'sec.ad.s':'Reklāma starp sadaļām',
      'sec.widgets.t':'Logrīki un Premium', 'sec.widgets.s':'Faili, CV un Inbox Premium',
      'sec.news.t':'Ziņas', 'sec.news.s':'Ziņu plūsma ar kategorijām',
      /* statistika */
      'st.title':'Statistika | Inbox.lv jauniešiem', 'st.h':'Statistika',
      'st.connecting':'Savienojamies…', 'st.live':'Tiešraide', 'st.nocon':'Nav savienojuma',
      'st.mode.supabase':'Supabase', 'st.mode.server':'lokālais serveris', 'st.mode.local':'šīs ierīces dati',
      'st.unlock':'🔓 Komentāri', 'st.lock':'🔒 Aizvērt komentārus',
      'st.key.h':'Atvērt komentārus', 'st.key.p':'Ievadi statistikas atslēgu, lai redzētu atbilžu tekstus (komentāri, piezīmes pie sadaļām).',
      'st.key.ph':'Atslēga', 'st.key.go':'Atvērt', 'st.key.err':'Atslēga nav pareiza.',
      'st.total':'Atbildes kopā', 'st.today':'šodien {t} · pēdējā stundā {h}', 'st.last':'pēdējā {a}',
      'st.overall':'Kopējais iespaids', 'st.votesAll':'Sadaļu balsis kopā', 'st.nvotes':'{n} balsis',
      'st.devices':'Ierīces', 'st.devline':'{m} tālrunis · {d} dators',
      'st.bysec':'Pa sadaļām', 'st.sorted':'kārtots pēc tā, cik patīk', 'st.wait':'Gaidām pirmās atbildes…',
      'st.ideas':'Ko vēl grib', 'st.ideas.sub':'līdz 3 no katra', 'st.ideas.none':'Vēl nav izvēlētu ideju.',
      'st.age':'Vecums', 'st.hourly':'Atbildes pa stundām', 'st.hourly.sub':'pēdējās 24 h',
      'st.x24':'pirms 24 h', 'st.x12':'pirms 12 h', 'st.xnow':'tagad',
      'st.feed':'Jaunākās atbildes', 'st.feed.with':'ar komentāriem', 'st.feed.without':'bez komentāriem',
      'st.comment':'Komentārs:', 'st.noanswers':'Vēl nav atbilžu.',
      'ago.now':'tikko', 'ago.s':'pirms {n} s', 'ago.m':'pirms {n} min', 'ago.h':'pirms {n} h', 'ago.d':'pirms {n} d',
    },
    en: {
      'title':'Inbox.lv for young people: what do you think?',
      'h1':'Inbox.lv for young people: <em>what do you think?</em>',
      'intro':"Before we launch the new portal, we want to know what you think. Tell us what you like and what you don't - it takes only 1 minute.",
      'start':'Start ↓', 'openProto':'Open the page ↗',
      'pill.time':'⏱ ~1 min', 'pill.anon':'🕶 Anonymous',
      'phone.cap':'👆 Tap the bell, the game and other elements', 'phone.alt':'Prototype of the new inbox.lv portal, full page', 'phone.aria':'Prototype of the new portal',
      'jump':'Finish', 'jump.send':'Send',
      'ideas.h':'What else would you like? ✨', 'ideas.lead':'Pick up to 3 things you would like to see in the new inbox.lv.',
      'ideas.hint':'Selected {n} of {max}', 'ideas.max':'Maximum {max} - remove one to pick another',
      'final.h':'Overall impression', 'final.lead':'What do you think of the new page overall?', 'final.aria':'Overall rating',
      'scale.lo':"Don't like it", 'scale.hi':'Great!', 'scale.n':'{n} out of 5',
      'face.1':'Really dislike', 'face.2':'Dislike', 'face.3':'Okay', 'face.4':'Like', 'face.5':'Really like', 'face.hint':'Tap an emoji to rate', 'face.tag':'Your rating',
      'age.label':'How old are you?',
      'comment.label':'Anything else?', 'optional':'(optional)', 'comment.ph':'Ideas, bugs, what bothers you or what should be added…',
      'submit':'Send answers', 'sending':'Sending…', 'thanks.foot':'Thank you for your opinion! <3',
      'foot.results':'See results', 'foot.back':'Back to the survey', 'redo':'Fill in again',
      'toast.section':'Rate at least one section 👆', 'toast.age':'Please tell us your age 👆', 'toast.fail':'Could not send, please try again',
      'card.next':'Next ↓', 'card.note.ph':'Tell us more (optional)', 'card.note.aria':'Comment: {t}',
      'card.img.alt':'Screenshot: {t}', 'card.votes.aria':'Your rating: {t}',
      'vote.like':'Like', 'vote.ok':'Okay', 'vote.dislike':'Dislike',
      'q.like':'What exactly do you like? 😍', 'q.ok':'What could be better? 🤔', 'q.dislike':"What don't you like? 😬",
      'res.thanks.h':'Thank you! <em>💛</em>', 'res.thanks.p':'Your answers were received. Below is what other young people think.',
      'res.warn.local':'Server unavailable - answers were saved on this device only.',
      'res.warn.queued':'No internet - we will send your answers as soon as the connection returns. Keep this page open.',
      'res.h':'Results <em>📊</em>', 'res.count':'<b>{n}</b> young people have answered.', 'res.none':'No answers yet.', 'res.demo':' (demo data)',
      'res.empty':'Results will appear here once someone answers.', 'res.loading':'Loading…',
      'res.rating.of':'out of 5 · {n} {w}', 'rating.one':'rating', 'rating.many':'ratings',
      'res.bysec':'By section', 'res.legend':'Green - like, yellow - okay, red - dislike.',
      'votes.one':'vote', 'votes.many':'votes', 'res.aria':'Like {a}%, okay {b}%, dislike {c}%',
      'res.want':'What else they want ✨', 'res.popular':'Most popular ideas.',
      'sec.top.t':'Top: weather and birthdays', 'sec.top.s':"Weather and friends' birthdays",
      'sec.email.t':'Email', 'sec.email.s':'Latest messages and quick buttons',
      'sec.game.t':'Game of the day', 'sec.game.s':'A word puzzle every day',
      'sec.offers.t':'Sponsor offers', 'sec.offers.s':'Discounts and codes for young people',
      'sec.opps.t':'Opportunities for you', 'sec.opps.s':'Internships, jobs, scholarships, events',
      'sec.ad.t':'Ad banner', 'sec.ad.s':'An ad between sections',
      'sec.widgets.t':'Widgets and Premium', 'sec.widgets.s':'Files, CV and Inbox Premium',
      'sec.news.t':'News', 'sec.news.s':'News feed with categories',
      'st.title':'Statistics | Inbox.lv for young people', 'st.h':'Statistics',
      'st.connecting':'Connecting…', 'st.live':'Live', 'st.nocon':'No connection',
      'st.mode.supabase':'Supabase', 'st.mode.server':'local server', 'st.mode.local':'this device only',
      'st.unlock':'🔓 Comments', 'st.lock':'🔒 Hide comments',
      'st.key.h':'Unlock comments', 'st.key.p':'Enter the stats key to see the written answers (comments and notes on sections).',
      'st.key.ph':'Key', 'st.key.go':'Unlock', 'st.key.err':'The key is not correct.',
      'st.total':'Total answers', 'st.today':'today {t} · last hour {h}', 'st.last':'last {a}',
      'st.overall':'Overall impression', 'st.votesAll':'All section votes', 'st.nvotes':'{n} votes',
      'st.devices':'Devices', 'st.devline':'{m} phone · {d} desktop',
      'st.bysec':'By section', 'st.sorted':'sorted by how much they are liked', 'st.wait':'Waiting for the first answers…',
      'st.ideas':'What else they want', 'st.ideas.sub':'up to 3 each', 'st.ideas.none':'No ideas selected yet.',
      'st.age':'Age', 'st.hourly':'Answers per hour', 'st.hourly.sub':'last 24 h',
      'st.x24':'24 h ago', 'st.x12':'12 h ago', 'st.xnow':'now',
      'st.feed':'Latest answers', 'st.feed.with':'with comments', 'st.feed.without':'without comments',
      'st.comment':'Comment:', 'st.noanswers':'No answers yet.',
      'ago.now':'just now', 'ago.s':'{n} s ago', 'ago.m':'{n} min ago', 'ago.h':'{n} h ago', 'ago.d':'{n} d ago',
    },
  };

  /* ---------- valodas stāvoklis ---------- */
  const KEY = 'youth_lang';
  const fromUrl = new URLSearchParams(location.search).get('lang');
  let lang = (fromUrl === 'en' || fromUrl === 'lv') ? fromUrl : (LS.get(KEY, 'lv'));
  if(lang !== 'en' && lang !== 'lv') lang = 'lv';
  const listeners = [];

  const getLang = () => lang;
  const t = (key, vars) => {
    let s = DICT[lang][key] ?? DICT.lv[key] ?? key;
    if(vars) for(const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(v);
    return s;
  };
  /* kanoniskais latviešu teksts -> attēlojamais teksts */
  const tr = (canon) => lang === 'en' ? (TRANS[canon] ?? canon) : canon;
  /* skaitļa locījums: LV 1, 21, 31... ir vienskaitlis; EN tikai 1 */
  const isOne = (n) => lang === 'en' ? n === 1 : (n % 10 === 1 && n % 100 !== 11);
  const pl = (n, base) => t(base + (isOne(n) ? '.one' : '.many'));
  const secT = (s) => t('sec.' + s.id + '.t');
  const secS = (s) => t('sec.' + s.id + '.s');

  function applyStatic(root){
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(e => { e.innerHTML = t(e.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-ph]').forEach(e => { e.placeholder = t(e.dataset.i18nPh); });
    root.querySelectorAll('[data-i18n-alt]').forEach(e => { e.alt = t(e.dataset.i18nAlt); });
    root.querySelectorAll('[data-i18n-aria]').forEach(e => { e.setAttribute('aria-label', t(e.dataset.i18nAria)); });
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang [data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  function setLang(l, silent){
    if(l !== 'lv' && l !== 'en') return;
    lang = l; LS.set(KEY, l);
    if(!silent) listeners.forEach(fn => fn(l));
  }
  const onLang = (fn) => { listeners.push(fn); };

  /* LV | EN slēdža pogas: <div class="lang"><button data-lang="lv">LV</button><button data-lang="en">EN</button></div> */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.lang [data-lang]'); if(!b) return;
    setLang(b.dataset.lang);
  });

  Object.assign(Survey, {t, tr, pl, secT, secS, getLang, setLang, onLang, applyStatic, TRANS, DICT});
})(window);
