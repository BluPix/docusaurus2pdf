import { LatexGeneratorOptions, DocumentSection } from '../../types/index.js';

export interface DocumentTemplateOptions {
  includeTitlePage: boolean;
  includeTableOfContents: boolean;
  includeNewPageAfterToc: boolean;
}

const DEFAULT_TEMPLATE_OPTIONS: DocumentTemplateOptions = {
  includeTitlePage: true,
  includeTableOfContents: true,
  includeNewPageAfterToc: true,
};

export function generateTitlePage(opts: LatexGeneratorOptions): string[] {
  if (!opts.Title) return [];
  
  const lines: string[] = [];
  lines.push(`\\title{${escapeString(opts.Title)}}`);
  
  if (opts.Author) {
    lines.push(`\\author{${escapeString(opts.Author)}}`);
  }
  
  if (opts.Date !== undefined) {
    lines.push(`\\date{${opts.Date || ''}}`);
  } else {
    lines.push('\\date{\\today}');
  }
  lines.push('\\maketitle');
  
  return lines;
}

export function generateTableOfContents(options: DocumentTemplateOptions): string[] {
  if (!options.includeTableOfContents) return [];
  
  const lines: string[] = [];
  lines.push('\\tableofcontents');
  
  if (options.includeNewPageAfterToc) {
    lines.push('\\newpage');
  }
  
  return lines;
}

export function generateDocument(
  preamble: string,
  opts: LatexGeneratorOptions,
  sections: DocumentSection[],
  templateOptions: Partial<DocumentTemplateOptions> = {}
): string {
  const options = { ...DEFAULT_TEMPLATE_OPTIONS, ...templateOptions };
  const lines: string[] = [];
  
  // Preamble
  lines.push(preamble);
  
  // Title page
  lines.push(...generateTitlePage(opts));
  
  // Table of contents
  lines.push(...generateTableOfContents(options));
  
  // Content sections
  for (const section of sections) {
    lines.push(formatSection(section));
  }
  
  // End document
  lines.push('\\end{document}');
  
  return lines.join('\n');
}

const SECTION_LADDER = ['\\section', '\\subsection', '\\subsubsection', '\\paragraph', '\\subparagraph'];

function formatSection(section: DocumentSection): string {
  const cmd = SECTION_LADDER[Math.min(Math.max(section.Level - 1, 0), SECTION_LADDER.length - 1)];
  const label = section.LabelKey ? `\\label{doc:${section.LabelKey}}` : '';
  return `${cmd}{${escapeString(section.Title)}}${label}\n${section.Content}`;
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}
