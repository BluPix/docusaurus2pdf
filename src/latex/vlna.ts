// Czech/Slovak typography rules - non-breaking spaces
const prepositions = ['v', 'k', 's', 'z', 'o', 'u', 'a', 'i'];
const vlnaRegexes: RegExp[] = prepositions.map(
  (prep) => new RegExp(`(\\s)(${prep})(\\s+)([^0-9\\s])`, 'gi')
);
const numberRegex = /(\s)(\d)/g;

export function applyVlna(content: string): string {
  let result = content;
  
  // Apply preposition regexes
  for (const regex of vlnaRegexes) {
    result = result.replace(regex, '$1$2~$4');
  }
  
  // Add non-breaking space before numbers
  result = result.replace(numberRegex, '$1~$2');
  
  return result;
}
