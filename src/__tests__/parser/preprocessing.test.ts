import { describe, it, expect } from 'vitest';
import { MDXParser } from '../../mdx/parser.js';

const F = '```';

describe('Preprocessing must not touch code blocks', () => {
  const parser = new MDXParser();

  it('keeps lettered lines inside fenced code intact', async () => {
    const src = `Postup:\n\n${F}text\na) první krok\nb. druhý krok\n${F}`;
    const result = await parser.parse(src);
    expect(result.Content).toContain('a) první krok');
    expect(result.Content).toContain('b. druhý krok');
    expect(result.Content).not.toContain('1. první krok');
  });

  it('keeps "# comment" inside code when frontmatter has title', async () => {
    const src = `---\ntitle: Můj titul\n---\n\n${F}bash\n# install dependencies\nnpm install\n${F}`;
    const result = await parser.parse(src);
    expect(result.Title).toBe('Můj titul');
    expect(result.Content).toContain('# install dependencies');
  });

  it('removes the leading H1 used as title', async () => {
    const src = `# Titulek\n\nText pod nadpisem.`;
    const result = await parser.parse(src);
    expect(result.Title).toBe('Titulek');
    expect(result.Content).not.toContain('Titulek');
    expect(result.Content).toContain('Text pod nadpisem');
  });

  it('does not remove an H1 that is not at the start of the document', async () => {
    const src = `---\ntitle: FM titul\n---\n\nÚvodní odstavec.\n\n# Nadpis v těle`;
    const result = await parser.parse(src);
    expect(result.Title).toBe('FM titul');
    expect(result.Content).toContain('Nadpis v těle');
  });

  it('does not substitute {{ var }} inside code blocks', async () => {
    const src = `---\nversion: "1.0"\n---\n# T\n\nVerze {{ version }}.\n\n${F}\n{{ version }}\n${F}`;
    const result = await parser.parse(src);
    expect(result.Content).toContain('Verze 1.0');
    expect(result.Content).toMatch(/\{\{ version \}\}/);
  });

  it('does not convert prose lines like "v. Chod" to list items', async () => {
    const src = `v. Chod stroje\n\nx) nějaký text`;
    const result = await parser.parse(src);
    expect(result.Content).not.toContain('\\begin{enumerate}');
  });

  it('converts a genuine lettered run starting at "a."', async () => {
    const src = `a. první\nb. druhý\nc. třetí`;
    const result = await parser.parse(src);
    expect(result.Content).toContain('\\begin{enumerate}');
    expect(result.Content).toContain('\\item první');
    expect(result.Content).toContain('\\item třetí');
  });

  it('handles tilde fences and unclosed fences without corruption', async () => {
    const src = `~~~python\na) in code\n~~~\n\nText.\n\n${F}\na) unclosed fence`;
    const result = await parser.parse(src);
    expect(result.Content).toContain('a) in code');
    expect(result.Content).toContain('a) unclosed fence');
  });
});
