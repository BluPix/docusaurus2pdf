export interface LanguageMapOptions {
  customMappings?: Record<string, string>;
}

const DEFAULT_LANGUAGE_MAP: Record<string, string> = {
  json: 'javascript',
  yaml: 'python',
  yml: 'python',
  mermaid: 'none',
  'mermaid-js': 'none',
};

export function getLanguageMapping(lang: string | undefined, options: LanguageMapOptions = {}): string {
  const { customMappings = {} } = options;
  const langMap = { ...DEFAULT_LANGUAGE_MAP, ...customMappings };
  
  if (!lang) return '';
  return lang in langMap ? langMap[lang] : lang;
}

export function getLstListingLanguageParam(lang: string | undefined, options: LanguageMapOptions = {}): string {
  const mappedLang = getLanguageMapping(lang, options);
  if (mappedLang && mappedLang !== 'none') {
    return `[language=${mappedLang},escapechar=]`;
  }
  return '[escapechar=]';
}
