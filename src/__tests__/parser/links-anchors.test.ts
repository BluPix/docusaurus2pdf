import { describe, it, expect } from 'vitest';
import { MDXParser } from '../../mdx/parser.js';

describe('Slugs, anchors and cross-document links', () => {
  const parser = new MDXParser();

  it('keeps diacritics in slugs like Docusaurus does', async () => {
    const result = await parser.parse('## Úvod do systému\n\n[zpět](#úvod-do-systému)');
    expect(result.Content).toContain('\\label{úvod-do-systému}');
    expect(result.Content).toContain('\\hyperref[úvod-do-systému]{zpět}');
  });

  it('supports explicit {#custom-id} heading anchors', async () => {
    const result = await parser.parse('## Instalace {#custom-install}\n\nViz [odkaz](#custom-install).');
    expect(result.Content).toContain('\\subsection{Instalace}');
    expect(result.Content).not.toContain('custom-install\\}');
    expect(result.Content).toContain('\\label{custom-install}');
    expect(result.Content).toContain('\\hyperref[custom-install]{odkaz}');
  });

  it('gives duplicate headings distinct labels', async () => {
    const result = await parser.parse('## Přehled\n\na\n\n## Přehled\n\nb');
    expect(result.Content).toContain('\\label{přehled}');
    expect(result.Content).toContain('\\label{přehled-1}');
  });

  it('prefixes labels with the document key', async () => {
    const result = await parser.parse('## Setup\n\n[viz](#setup)', 'api/core', 'api__core__auth');
    expect(result.Content).toContain('\\label{api__core__auth:setup}');
    expect(result.Content).toContain('\\hyperref[api__core__auth:setup]{viz}');
  });

  it('resolves relative cross-document links with anchors', async () => {
    parser.setOptions({ knownDocs: new Set(['api__core__errors']) });
    const result = await parser.parse(
      'Viz [chyby](./errors.md#rate-limiting) a [celá stránka](./errors.md).',
      'api/core',
      'api__core__auth'
    );
    expect(result.Content).toContain('\\hyperref[api__core__errors:rate-limiting]{chyby}');
    expect(result.Content).toContain('\\hyperref[doc:api__core__errors]{celá stránka}');
    parser.setOptions({ knownDocs: undefined });
  });

  it('degrades unresolvable internal links to plain text', async () => {
    parser.setOptions({ knownDocs: new Set(['known']) });
    const result = await parser.parse('Viz [mrtvý odkaz](./neexistuje.md).');
    expect(result.Content).toContain('mrtvý odkaz');
    expect(result.Content).not.toContain('\\href');
    expect(result.Content).not.toContain('\\hyperref');
    parser.setOptions({ knownDocs: undefined });
  });

  it('keeps external links external', async () => {
    const result = await parser.parse('Viz [web](https://example.com/page) a [mail](mailto:a@b.cz).');
    expect(result.Content).toContain('\\href{https://example.com/page}{web}');
    expect(result.Content).toContain('\\href{mailto:a@b.cz}{mail}');
  });
});
