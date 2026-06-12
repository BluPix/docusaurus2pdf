#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { promises as fs } from 'fs';
import { SiteLoader } from './docusaurus/site.js';
import { Renderer } from './renderer/index.js';
import { checkDockerAvailable, checkDockerImage, checkLocalTeX, compileAllPDFs } from './utils/docker.js';
import { colors } from './utils/colors.js';

const program = new Command();

program
  .name('docusaurus2pdf')
  .description('Convert Docusaurus docs to PDF with full MDX support')
  .version('2.0.0')
  .option('-i, --input <path>', 'Input directory containing Docusaurus site')
  .option('-o, --output <path>', 'Output directory for PDFs', './pdf-export')
  .option('-e, --engine <engine>', 'LaTeX engine (lualatex, xelatex, pdflatex, or tectonic)', 'lualatex')
  .option('-s, --single', 'Generate single PDF with all content', false)
  .option('-l, --per-language', 'Generate separate PDF per language', true)
  .option('--tex-only', 'Generate .tex files only, skip PDF compilation', false)
  .option('--compile-only', 'Compile existing .tex files to PDF (skip generation)', false)
  .option('--no-docker', 'Use local TeX installation instead of Docker')
  .option('--sections <names>', 'Comma-separated list of section names to generate (from sidebar)')
  .option('--strip-numbering', 'Strip manual numbering from headings (e.g., "3. Title" -> "Title")', false)
  .option('--convert-emoji', 'Convert emoji characters to text (e.g., "📷" -> "[Camera]")', false)
  .option('--suppress-caption-numbers', 'Suppress automatic figure numbering in captions', false)
  .option('--skip-diagrams', 'Skip Mermaid diagram generation', false)
  .parse();

interface CLIOptions {
  input: string;
  output: string;
  engine: 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic';
  single: boolean;
  perLanguage: boolean;
  texOnly: boolean;
  compileOnly: boolean;
  docker: boolean;
  stripNumbering: boolean;
  convertEmoji: boolean;
  suppressCaptionNumbers: boolean;
  skipDiagrams: boolean;
  sections?: string;
}

async function main() {
  const opts = program.opts() as CLIOptions;
  
  colors.title('Docusaurus2PDF - TypeScript Edition');
  console.log('');
  
  // Validate input is required unless compile-only mode
  if (!opts.compileOnly && !opts.input) {
    colors.error('Error: required option -i, --input <path> not specified');
    program.help();
    process.exit(1);
  }
  
  // Validate input directory exists (if provided)
  if (opts.input) {
    try {
    const stats = await fs.stat(opts.input);
    if (!stats.isDirectory()) {
      colors.error('Input path is not a directory');
      process.exit(1);
    }
  } catch {
    colors.error(`Input directory not found: ${opts.input}`);
    process.exit(1);
  }
  }
  
  // Create output directory
  await fs.mkdir(opts.output, { recursive: true });
  
  // Check TeX environment
  let useDocker = opts.docker;
  let localTeXEngine = '';
  
  if (!opts.texOnly && !opts.compileOnly) {
    if (useDocker) {
      const dockerAvailable = await checkDockerAvailable();
      if (!dockerAvailable) {
        colors.warning('Docker not available');
        // Try local TeX as fallback
        const localTeX = await checkLocalTeX();
        if (localTeX.available) {
          colors.info(`Using local TeX: ${localTeX.engine}`);
          useDocker = false;
          localTeXEngine = localTeX.engine;
        } else {
          colors.warning('No LaTeX installation found - will generate .tex files only');
          opts.texOnly = true;
        }
      } else {
        const imageName = opts.engine === 'tectonic' ? 'docusaurus2pdf-tectonic' : 'texlive/texlive:latest';
        const hasImage = await checkDockerImage(imageName);
        if (!hasImage) {
          colors.warning(`Docker image '${imageName}' not found`);
          // Try local TeX as fallback
          const localTeX = await checkLocalTeX();
          if (localTeX.available) {
            colors.info(`Using local TeX: ${localTeX.engine}`);
            useDocker = false;
            localTeXEngine = localTeX.engine;
          } else {
            colors.info('Run: docker pull texlive/texlive:latest');
            colors.info('Continuing with .tex file generation only...\n');
            opts.texOnly = true;
          }
        }
      }
    } else {
      // --no-docker flag set, check local TeX
      const localTeX = await checkLocalTeX();
      if (localTeX.available) {
        colors.info(`Using local TeX: ${localTeX.engine}`);
        localTeXEngine = localTeX.engine;
      } else {
        colors.error('No local LaTeX installation found (lualatex/xelatex/pdflatex)');
        colors.info('Install TeX Live or use Docker mode (default)');
        process.exit(1);
      }
    }
  }
  
  // Handle compile-only mode (pipeline step 2)
  if (opts.compileOnly) {
    console.log('');
    colors.info('Compile-only mode: building PDFs from existing .tex files...');
    
    const built = await compileAllPDFs(
      opts.output, 
      (localTeXEngine || opts.engine) as 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic', 
      useDocker
    );
    
    console.log('');
    colors.success(`Built ${built.length} PDF(s)`);
    colors.success(`Output: ${path.resolve(opts.output)}`);
    return;
  }
  
  // Step 1: Generate .tex files
  colors.info('Loading Docusaurus site...');
  const siteLoader = new SiteLoader();
  const site = await siteLoader.load(opts.input);
  colors.success(`Loaded ${site.Pages.length} pages`);
  
  // Parse sections filter
  const sections = opts.sections ? opts.sections.split(',').map(s => s.trim()) : undefined;
  
  // Render
  const renderer = new Renderer({
    OutputDir: opts.output,
    Engine: (localTeXEngine || opts.engine) as 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic',
    Sections: sections,
    StripManualNumbering: opts.stripNumbering,
    ConvertEmoji: opts.convertEmoji,
    SuppressCaptionNumbers: opts.suppressCaptionNumbers,
    SkipDiagrams: opts.skipDiagrams,
  });
  
  colors.info('Generating LaTeX files...');
  
  try {
    if (opts.single) {
      await renderer.renderSingle(site);
    } else if (opts.perLanguage) {
      await renderer.renderPerLanguage(site);
    } else {
      await renderer.renderPerSection(site);
    }
    
    colors.success('LaTeX files generated');
  } catch (err) {
    colors.error(`Rendering failed: ${err}`);
    process.exit(1);
  }
  
  // Step 2: Build PDFs (if not --tex-only)
  if (!opts.texOnly) {
    console.log('');
    colors.info(useDocker ? 'Building PDFs with Docker...' : 'Building PDFs with local TeX...');
    
    const built = await compileAllPDFs(
      opts.output,
      (localTeXEngine || opts.engine) as 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic',
      useDocker
    );
    
    console.log('');
    colors.success(`Built ${built.length} PDF(s)`);
  }
  
  console.log('');
  colors.success(`Output: ${path.resolve(opts.output)}`);
}

main().catch((err) => {
  colors.error(`Fatal error: ${err}`);
  process.exit(1);
});
