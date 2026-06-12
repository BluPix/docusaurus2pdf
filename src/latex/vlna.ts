// Czech/Slovak typography rules - non-breaking spaces after single-letter
// prepositions/conjunctions and before numbers.
//
// This must be applied to plain text only (the parser calls it per text
// node, after LaTeX escaping). Applying it to generated LaTeX would corrupt
// code listings, URLs and math.
const PREPOSITIONS = 'aikosuvz';

// Single-letter preposition followed by a space: replace the space with "~".
// Uses a lookbehind-free two-pass approach because consecutive prepositions
// ("a v lese") overlap on the separating space.
const prepositionRegex = new RegExp(`(^|[\\s(~])([${PREPOSITIONS}])[ \\t]+(?=\\S)`, 'gi');

// A single space before a digit becomes non-breaking ("strana 5", "10 000").
const numberRegex = /([^\s]) (?=\d)/g;

export function applyVlna(content: string): string {
  let result = content;

  // Two passes so runs like "a v lese" get both spaces tied.
  result = result.replace(prepositionRegex, '$1$2~');
  result = result.replace(prepositionRegex, '$1$2~');

  result = result.replace(numberRegex, '$1~');

  return result;
}
