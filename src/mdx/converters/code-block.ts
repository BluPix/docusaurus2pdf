import { getLstListingLanguageParam } from '../utils/language-map.js';

export interface CodeBlockConverterOptions {
  customLanguageMappings?: Record<string, string>;
}

export function convertCodeBlocks(content: string, options: CodeBlockConverterOptions = {}): string {
  const { customLanguageMappings = {} } = options;
  
  return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const langParam = getLstListingLanguageParam(lang, { customMappings: customLanguageMappings });
    return `\\begin{lstlisting}${langParam}\n${code}\\end{lstlisting}`;
  });
}
