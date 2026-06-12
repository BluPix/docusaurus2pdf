import { escapeLatexForHeading } from '../utils/escape.js';

export function convertHeadings(content: string): string {
  return content
    .replace(/^###\s+(.+)$/gm, (_match, title) => `\\subsubsection{${escapeLatexForHeading(title)}}`)
    .replace(/^##\s+(.+)$/gm, (_match, title) => `\\subsection{${escapeLatexForHeading(title)}}`)
    .replace(/^#\s+(.+)$/gm, (_match, title) => `\\section{${escapeLatexForHeading(title)}}`);
}
