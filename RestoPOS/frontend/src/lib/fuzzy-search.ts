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
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Score a single subsequence match.
 * Returns 0 when `query` chars can't all be found (in order) inside `text`.
 *
 * Scoring rewards:
 * - Exact prefix match (10 000+)
 * - Consecutive-character streaks
 * - Word-boundary & camelCase-boundary hits
 * - Matches near the start of the string
 */
function subsequenceScore(query: string, text: string): number {
  if (!query) return 1;

  // Exact substring → highest score
  const idx = text.indexOf(query);
  if (idx !== -1) {
    return 10_000 + query.length * 10 - idx;
  }

  let qi = 0;
  let score = 0;
  let streak = 0;
  let prevWasBoundary = false;

  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      qi += 1;
      streak += 1;
      score += 10 + streak * 5; // consecutive chars are worth more

      // Bonus for matching near the start
      score += Math.max(0, 8 - ti);

      // Word-boundary bonus (space, dash, or start of camelCase)
      const isBoundary =
        ti === 0 ||
        text[ti - 1] === " " ||
        text[ti - 1] === "-" ||
        text[ti - 1] === "_" ||
        (text[ti - 1] === text[ti - 1].toLowerCase() &&
          text[ti] === text[ti].toUpperCase());
      if (isBoundary) {
        score += 20;
        prevWasBoundary = true;
      } else {
        prevWasBoundary = false;
      }
    } else {
      streak = 0;
    }
  }

  return qi === query.length ? score : 0;
}

/**
 * Edit-distance (Damerau-Levenshtein) — used for typo tolerance on
 * short queries (≤ 4 chars the cost of a full DP is negligible).
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

/**
 * Public fuzzy-score function.
 *
 * The `hay` parameter should be the concatenated searchable text for an item
 * (title + description + category + SKUs, lowercased/normalized by the caller).
 *
 * Multi-word queries are split on spaces — every word must match independently
 * and scores are summed so more specific queries rank higher.
 *
 * Returns 0 when the item does NOT match.
 */
export function fuzzyScore(query: string, hay: string): number {
  const q = normalize(query);
  const h = normalize(hay);
  if (!q) return 1;

  const words = q.split(" ").filter(Boolean);
  if (words.length === 0) return 1;

  let total = 0;
  for (const word of words) {
    const seq = subsequenceScore(word, h);
    if (seq > 0) {
      total += seq;
    } else {
      // Typo tolerance: for short words, allow close matches (≤ 1 edit away)
      if (word.length <= 5) {
        // Check against individual words in the haystack for proximity
        const hayWords = h.split(/[\s\-_/]+/);
        let bestSim = 0;
        for (const hw of hayWords) {
          if (Math.abs(hw.length - word.length) <= 2) {
            bestSim = Math.max(bestSim, similarity(word, hw));
          }
        }
        if (bestSim >= 0.7) {
          total += Math.round(bestSim * 80);
        } else {
          return 0; // one word didn't match at all
        }
      } else {
        return 0; // one word didn't match
      }
    }
  }

  return total;
}
