// Behaviour modules, one per section. Load order mirrors the reference
// static build; every module takes the reduced-motion flag and is
// responsible for degrading to a static layout when it is set.
import { init as nav } from './nav.js';
import { init as mobileNav } from './mobile-nav.js';
import { init as hero } from './hero.js';
import { init as whycards } from './why-cards.js';
import { init as delegation } from './delegation.js';
import { init as marquee } from './marquee.js';
import { init as pricing } from './pricing.js';
import { init as howitworks } from './how-it-works.js';
import { init as faq } from './faq.js';
import { init as forms } from './forms.js';
import { init as loadMore } from './load-more.js';
import { init as compareTable } from './compare-table.js';
import { init as lazyMedia } from './lazy-media.js';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
lazyMedia();
nav(reduced);
mobileNav(reduced);
hero(reduced);
whycards(reduced);
delegation(reduced);
marquee(reduced);
pricing(reduced);
howitworks(reduced);
faq(reduced);
forms(reduced);
loadMore(reduced);
compareTable(reduced);
