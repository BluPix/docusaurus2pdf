import { promises as fs } from 'fs';
import * as path from 'path';
import { LatexGeneratorOptions, DocumentSection } from '../types/index.js';
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

    // Vlna (non-breaking spaces for cs/sk) is applied by the MDX parser on
    // plain-text nodes only - never here on generated LaTeX, where it would
    // corrupt code listings, URLs and math.
    const content = generateDocument(preamble, this.opts, sections);
    
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, content, 'utf-8');
  }

  // Preamble generation moved to ./preamble.ts

  // Section formatting moved to ./templates/document.ts
}
