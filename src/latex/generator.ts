import { promises as fs } from 'fs';
import * as path from 'path';
import { applyVlna } from './vlna.js';
import { SupportedLanguages, LatexGeneratorOptions, DocumentSection } from '../types/index.js';
import { generatePreamble, PreambleOptions } from './preamble.js';
import { generateDocument } from './templates/document.js';

export type { LatexGeneratorOptions, DocumentSection } from '../types/index.js';

export class LatexGenerator {
  private opts: LatexGeneratorOptions;

  constructor(opts: LatexGeneratorOptions) {
    this.opts = opts;
  }

  async generateDocument(filename: string, sections: DocumentSection[]): Promise<void> {
    // Build preamble options
    const preambleOpts: PreambleOptions = {
      engine: this.opts.Engine,
      language: this.opts.Language || 'en',
    };
    
    const preamble = generatePreamble(preambleOpts);
    
    // Apply vlna for Czech/Slovak
    const lang = this.opts.Language || 'en';
    const processedSections = sections.map((section) => ({
      ...section,
      Content: SupportedLanguages[lang]?.Vlna ? applyVlna(section.Content) : section.Content,
    }));
    
    // Generate document
    const content = generateDocument(preamble, this.opts, processedSections);
    
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, content, 'utf-8');
  }

  // Preamble generation moved to ./preamble.ts

  // Section formatting moved to ./templates/document.ts
}
