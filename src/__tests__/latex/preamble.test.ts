import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generatePreamble } from '../../latex/preamble.js';
import { LatexGenerator } from '../../latex/generator.js';

describe('LaTeX Preamble Generation', () => {
  it('generates preamble with lualatex engine packages', () => {
    const preamble = generatePreamble({
      engine: 'lualatex',
      language: 'cs',
    });

    expect(preamble).toContain('\\directlua{luaotfload.add_fallback("d2pfallback", {');
    expect(preamble).toContain('\\setmainlanguage{czech}');
    expect(preamble).toContain('\\usepackage{enumitem}');
    expect(preamble).toContain('\\begin{document}');
  });

  it('generates preamble with xelatex engine packages', () => {
    const preamble = generatePreamble({
      engine: 'xelatex',
      language: 'en',
    });

    expect(preamble).toContain('\\setmainlanguage{english}');
    expect(preamble).not.toContain('\\directlua');
    expect(preamble).toContain('\\begin{document}');
  });

  it('generates preamble with pdflatex engine packages', () => {
    const preamble = generatePreamble({
      engine: 'pdflatex',
      language: 'en',
    });

    expect(preamble).toContain('\\usepackage[T1]{fontenc}');
    expect(preamble).toContain('\\usepackage[english]{babel}');
    expect(preamble).toContain('\\begin{document}');
  });

  it('supports custom packages in preamble', () => {
    const preamble = generatePreamble({
      engine: 'lualatex',
      language: 'en',
      customPackages: ['tcolorbox', 'tikz'],
    });

    expect(preamble).toContain('\\usepackage{tcolorbox}');
    expect(preamble).toContain('\\usepackage{tikz}');
  });

  it('generates PDF metadata from frontmatter', () => {
    const preamble = generatePreamble({
      engine: 'lualatex',
      language: 'en',
      frontmatter: {
        title: 'Document Title',
        author: 'Jane Doe',
        description: 'A comprehensive guide',
        keywords: 'pdf, guide, markdown',
      },
    });

    expect(preamble).toContain('\\hypersetup{');
    expect(preamble).toContain('pdftitle={Document Title},');
    expect(preamble).toContain('pdfauthor={Jane Doe},');
    expect(preamble).toContain('pdfsubject={A comprehensive guide},');
    expect(preamble).toContain('pdfkeywords={pdf, guide, markdown},');
  });
});

describe('LatexGenerator', () => {
  let tempDir: string;
  let outputFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docusaurus2pdf-generator-'));
    outputFile = path.join(tempDir, 'document.tex');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('LatexGenerator creates directory and writes document contents', async () => {
    const generator = new LatexGenerator({
      Engine: 'lualatex',
      Language: 'cs',
      Title: 'Test Document',
      Author: 'Author Name',
    } as any);

    const sections = [
      {
        Title: 'Introduction',
        Content: 'This is the introduction paragraph.',
        Level: 1,
      },
    ];

    await generator.generateDocument(outputFile, sections);

    const writtenContent = await fs.readFile(outputFile, 'utf-8');
    
    // Check that it contains preamble, title page, content and end document
    expect(writtenContent).toContain('\\setmainlanguage{czech}');
    expect(writtenContent).toContain('\\title{Test Document}');
    expect(writtenContent).toContain('\\author{Author Name}');
    expect(writtenContent).toContain('\\section{Introduction}');
    expect(writtenContent).toContain('This is the introduction paragraph.');
    expect(writtenContent).toContain('\\end{document}');
  });
});
