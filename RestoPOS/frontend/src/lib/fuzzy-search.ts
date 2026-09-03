/**
 * Persian / Arabic character normalization map.
 * Collapses variant glyphs so searches are accent-insensitive.
 */
const NORMALIZE_MAP: Record<string, string> = {
  ي: "ی",
  ك: "ک",
  ة: "ه",
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ٱ: "ا",
  ى: "ی",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

function normalize(text: string): string {
  let s = text.normalize("NFKC").toLowerCase();
  for (const [from, to] of Object.entries(NORMALIZE_MAP)) {
    s = s.replaceAll(from, to);
  }
  return s.replace(/[\u200c\u200f\s]+/g, " ").trim();
}

/**
 * Edit-distance (Damerau-Levenshtein) — used for typo tolerance on short
 * Latin queries (e.g. "expresso" → "espresso").
 *
 * Returns a similarity score 0..1 where 1 = identical.
 */
function similarity(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0 && lb === 0) return 1;
  if (la === 0 || lb === 0) return 0;

  // Quick bail: if length difference > 2 they're not close
  if (Math.abs(la - lb) > 2) return 0;

  // standard DP matrix
  const d: number[][] = Array.from({ length: la + 1 }, () =>
    new Array<number>(lb + 1).fill(0) as number[],
  );
  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      // transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  const maxLen = Math.max(la, lb);
  return 1 - d[la][lb] / maxLen;
}

/** Everything that separates independently searchable words. */
const WORD_SEP = /[\s\-_/،؛&()]+/;

/**
 * Tight in-order match of `query` inside `text`.
 *
 * The matched characters must stay nearly contiguous — at most
 * `MAX_FOREIGN` unrelated characters may sit inside the run. This is what
 * stops query letters from collecting across different words of the haystack
 * (the old matcher let the 4 letters of "ماچا" scatter over any چای item's
 * title/description/category/SKU text and match everything).
 *
 * Exact substrings bypass the cap (they are real matches) and score highest.
 */
const MAX_FOREIGN = 1;

function tightSpanScore(query: string, text: string): number {
  if (!query) return 1;

  const idx = text.indexOf(query);
  if (idx !== -1) return 10_000 + query.length * 10 - idx;

  let qi = 0;
  let first = -1;
  let last = -1;
  let score = 0;
  let streak = 0;

  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (first === -1) first = ti;
      qi += 1;
      last = ti;
      streak += 1;
      score += 10 + streak * 5; // consecutive characters are worth more

      // Bonus for matches near the start
      score += Math.max(0, 8 - ti);
    } else {
      streak = 0;
    }
  }

  if (qi !== query.length) return 0;
  // Scattered: count the non-matched characters sitting inside the run and
  // reject when they exceed the cap (foreign = (last - first + 1) - query.length).
  if (last - first + 1 - query.length > MAX_FOREIGN) return 0;
  return score;
}

/**
 * Public fuzzy-score function.
 *
 * The `hay` parameter should be the concatenated searchable text for an item
 * (title + description + category + SKUs, lowercased/normalized by the caller).
 *
 * Multi-word queries are split on spaces — every word must match
 * independently and scores are summed so more specific queries rank higher.
 *
 * Each query word matches when:
 *   1. it appears as an exact substring of the haystack, or
 *   2. it matches tightly inside a SINGLE hay word (a stray character or two
 *      is tolerated, but letters never collect across word boundaries), or
 *   3. it matches tightly in the space-free haystack — this only rescues
 *      queries typed without spaces ("ماچا لاته" → "ماچالاته"), or
 *   4. it is a plausible one-edit typo of a short LATIN word with the same
 *      first letter (Persian words are excluded: 1-edit pairs like
 *      لاته/لایه or چیلو/چیلی are legitimately different menu words).
 *
 * Returns 0 when the item does NOT match.
 */
export function fuzzyScore(query: string, hay: string): number {
  const q = normalize(query);
  const h = normalize(hay);
  if (!q) return 1;

  const words = q.split(" ").filter(Boolean);
  if (words.length === 0) return 1;

  const hayWords = h.split(WORD_SEP).filter(Boolean);
  const compact = h.replace(/\s+/g, "");

  let total = 0;
  for (const word of words) {
    // 1) Exact substring anywhere in the haystack — strongest signal.
    const idx = h.indexOf(word);
    let score = idx !== -1 ? 10_000 + word.length * 10 - idx : 0;

    // 2) Tight in-order match inside one hay word.
    if (score === 0) {
      for (const hayWord of hayWords) {
        const s = tightSpanScore(word, hayWord);
        if (s > score) score = s;
      }
    }

    // 3) Tight in-order match over the whole space-free haystack (rescues
    //    space-less compound queries).
    if (score === 0) score = tightSpanScore(word, compact);

    if (score > 0) {
      total += score;
      continue;
    }

    // 4) Typo tolerance for short Latin words only (English names), sharing
    //    the first character.
    if (/^[a-z0-9]{3,12}$/.test(word)) {
      let bestSim = 0;
      for (const hayWord of hayWords) {
        if (
          /^[a-z0-9]/.test(hayWord) &&
          hayWord[0] === word[0] &&
          Math.abs(hayWord.length - word.length) <= 2
        ) {
          const s = similarity(word, hayWord);
          if (s > bestSim) bestSim = s;
        }
      }
      if (bestSim >= 0.75) {
        total += Math.round(bestSim * 80);
        continue;
      }
    }

    return 0; // one word didn't match at all
  }

  return total;
}
