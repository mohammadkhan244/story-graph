/* Card art and menu layout. Art is static, trusted SVG (drawn for the Fictioneering
   card system: ink face, sage field lines, paper linework). Rendered with innerHTML. */
import ART from './cards-art.json';

/* slug -> art key */
export const CARD_FOR = {
  'handle-more-demand': 'handle-more-demand',
  'build-or-buy': 'build-or-buy',
  'automate-a-process': 'automate-a-process',
  'replace-a-system': 'replace-a-system',
  'your-career': 'career-10-years',
  'your-business': 'business-10-years',
  'keep-circling': 'keep-circling',
  'professional-learning': 'professional-learning',
  'innovation-vs-efficiency': 'innovation-vs-efficiency',
  'hierarchy-vs-democratization': 'hierarchy-vs-democratization',
  'specialist-vs-generalist': 'specialist-vs-generalist',
  'relationships-and-advancement': 'relationships-advancement',
  'anonymity-vs-authentication': 'anonymity-vs-authentication',
  'proof-of-work': 'proof-of-work',
};

/* Four cards at a time. The first set is what a visitor sees first. */
export const SETS = [
  { label: 'A decision', slugs: ['handle-more-demand', 'build-or-buy', 'automate-a-process', 'replace-a-system'] },
  { label: 'Your future', slugs: ['your-career', 'your-business', 'keep-circling', 'professional-learning'] },
  { label: 'Work & power', slugs: ['innovation-vs-efficiency', 'hierarchy-vs-democratization', 'specialist-vs-generalist', 'relationships-and-advancement'] },
  { label: 'Identity', slugs: ['anonymity-vs-authentication', 'proof-of-work'] },
];

export function cardArt(slug) {
  return ART[CARD_FOR[slug]] || ART['keep-circling'];
}

const P = '#fffdf6', S = '#afbeb1';
const L = `fill="none" stroke="${P}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const G = `fill="none" stroke="${S}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;

/* Small marks for the five signal types, same line language as the cards. */
export const SIGNAL_ICON = {
  Patent: `<path ${L} d="M30 18h28l12 12v42H30z"/><path ${G} d="M58 18v12h12M38 44h22M38 54h22M38 64h14"/>`,
  Headline: `<rect x="18" y="20" width="64" height="52" rx="4" ${L}/><path ${G} d="M28 32h44M28 44h20M28 54h20M28 64h20"/><rect x="54" y="42" width="18" height="22" rx="2" ${G}/>`,
  Trend: `<path ${G} d="M18 74h64"/><path ${L} d="M22 66l16-14 14 8 24-26"/><path ${L} d="M64 34h12v12"/>`,
  Product: `<path ${L} d="M50 20l28 14v30L50 78 22 64V34z"/><path ${G} d="M22 34l28 14 28-14M50 48v30M36 27l28 14"/>`,
  'Sci-fi': `<path ${L} d="M50 18c12 10 16 26 12 42H38c-4-16 0-32 12-42z"/><path ${G} d="M38 60l-8 12h12M62 60l8 12H58M46 72v8M54 72v8"/><circle cx="50" cy="38" r="5" ${G}/>`,
};
export function signalIcon(type) {
  const key = Object.keys(SIGNAL_ICON).find((k) => k.toLowerCase() === String(type || '').toLowerCase());
  return SIGNAL_ICON[key] || SIGNAL_ICON.Trend;
}

/* Shapes so signals can be told apart without extra colors (one-accent rule). */
export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hex'];

const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Full card face as an SVG string: ink face, frame, suit label, art, Gilda title. */
export function cardSvg(slug, title) {
  const a = cardArt(slug);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 270" aria-hidden="true">
<rect x="1" y="1" width="198" height="268" rx="12" fill="#0c1012" stroke="#8d9d9d" stroke-width="2"/>
<rect x="9" y="9" width="182" height="252" rx="7" fill="none" stroke="#344245" stroke-width="1.5"/>
<text x="100" y="30" text-anchor="middle" font-family="Josefin Sans, Arial, sans-serif" font-size="10" font-weight="600" letter-spacing="2" fill="#d4dfdc">${esc(a.label.toUpperCase())}</text>
<g transform="translate(0,22)">${a.svg}</g>
<foreignObject x="14" y="204" width="172" height="58"><div xmlns="http://www.w3.org/1999/xhtml" style="font:19px/1.15 'Gilda Display',Georgia,serif;color:#fffdf6;text-align:center">${esc(title || a.title)}</div></foreignObject>
</svg>`;
}

/* Art only (no frame/title), for small marks. */
export function artSvg(slug, size = 200) {
  const a = cardArt(slug);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" aria-hidden="true"><rect width="200" height="200" rx="16" fill="#0c1012"/><g transform="translate(0,4)">${a.svg}</g></svg>`;
}
