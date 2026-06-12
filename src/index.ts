/**
 * Docusaurus2PDF - Convert Docusaurus docs to PDF with full MDX support
 * 
 * Programmatic API for building PDF documentation from Docusaurus sites.
 * 
 * @example
 * ```typescript
 * import { SiteLoader, Renderer, MDXParser } from 'docusaurus2pdf';
 * 
 * const loader = new SiteLoader();
 * const site = await loader.load('./my-docs');
 * 
 * const renderer = new Renderer({
 *   OutputDir: './output',
 *   Engine: 'lualatex'
 * });
 * 
 * await renderer.renderPerLanguage(site);
 * ```
 */

// Core classes
export { SiteLoader } from './docusaurus/site.js';
export { MDXParser } from './mdx/parser.js';
export { Renderer } from './renderer/index.js';
export { LatexGenerator } from './latex/generator.js';

// All types
export * from './types/index.js';

// Utility functions
export { colors } from './utils/colors.js';
export { 
  checkDockerAvailable, 
  checkDockerImage, 
  checkLocalTeX, 
  compileAllPDFs 
} from './utils/docker.js';

// Converters (for advanced usage)

// Version
export const version = '2.0.0';
