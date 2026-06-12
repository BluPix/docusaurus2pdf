import { SupportedLanguages, LanguageConfig } from '../types/index.js';
import { getEnginePackages, getCommonPackages, getCustomPackages } from './packages/default.js';

export interface PreambleOptions {
  engine: string;
  language: string;
  customPackages?: string[];
  frontmatter?: Record<string, unknown>;
}

export function generatePreamble(options: PreambleOptions): string {
  const langConfig = SupportedLanguages[options.language] || SupportedLanguages['en'];
  
  const packages: string[] = [];
  
  // Engine-specific packages
  const enginePackages = getEnginePackages(options.engine, langConfig);
  packages.push(...enginePackages.packages);
  
  // Common packages
  const commonPackages = getCommonPackages();
  packages.push(...commonPackages.packages);
  
  // Custom packages if provided
  if (options.customPackages && options.customPackages.length > 0) {
    const customPkgs = getCustomPackages(options.customPackages);
    packages.push(...customPkgs.packages);
  }
  
  // Add PDF metadata from frontmatter
  if (options.frontmatter) {
    const metadata: string[] = [];
    const title = String(options.frontmatter.title || '');
    const description = String(options.frontmatter.description || '');
    const keywords = String(options.frontmatter.keywords || '');
    const author = String(options.frontmatter.author || '');
    
    if (title || description || keywords || author) {
      metadata.push('\\hypersetup{');
      if (title) metadata.push(`pdftitle={${title}},`);
      if (author) metadata.push(`pdfauthor={${author}},`);
      if (description) metadata.push(`pdfsubject={${description}},`);
      if (keywords) metadata.push(`pdfkeywords={${keywords}},`);
      metadata.push('}');
      packages.push(metadata.join('\n  '));
    }
  }
  
  // Begin document
  packages.push('\\begin{document}');
  
  return packages.join('\n');
}
