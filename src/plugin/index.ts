import type { Plugin, LoadContext } from '@docusaurus/types';
import { execSync } from 'child_process';
import * as path from 'path';

interface Docusaurus2PDFPluginOptions {
  outputDir?: string;
  single?: boolean;
  sections?: string[];
  texOnly?: boolean;
  stripNumbering?: boolean;
  suppressCaptionNumbers?: boolean;
  onSuccess?: (outputDir: string) => void;
}

const DEFAULT_OPTIONS: Docusaurus2PDFPluginOptions = {
  outputDir: './pdf-export',
  single: false,
  texOnly: false,
  stripNumbering: false,
  suppressCaptionNumbers: false,
};

export default function docusaurus2PDFPlugin(
  context: LoadContext,
  options: unknown
): Plugin<void> {
  const opts = { ...DEFAULT_OPTIONS, ...(options as Docusaurus2PDFPluginOptions) };

  return {
    name: 'docusaurus2pdf',

    async postBuild({ outDir }): Promise<void> {
      const siteDir = context.siteDir;
      const outputDir = path.isAbsolute(opts.outputDir!)
        ? opts.outputDir!
        : path.join(siteDir, opts.outputDir!);

      const args: string[] = ['-i', JSON.stringify(siteDir), '-o', JSON.stringify(outputDir)];

      if (opts.single) args.push('--single');
      if (opts.sections?.length) args.push('--sections', opts.sections.join(','));
      if (opts.texOnly) args.push('--tex-only');
      if (opts.stripNumbering) args.push('--strip-numbering');
      if (opts.suppressCaptionNumbers) args.push('--suppress-caption-numbers');
      args.push('--no-docker');

      try {
        console.log('[Docusaurus2PDF] Generating PDF...');
        execSync(`npx docusaurus2pdf ${args.join(' ')}`, {
          stdio: 'inherit',
          cwd: siteDir,
        });
        console.log(`[Docusaurus2PDF] PDF generated at: ${outputDir}`);
        opts.onSuccess?.(outputDir);
      } catch (error) {
        console.error('[Docusaurus2PDF] PDF generation failed:', error);
      }
    },
  };
}

// Re-export types for TypeScript users
export type { Docusaurus2PDFPluginOptions };
