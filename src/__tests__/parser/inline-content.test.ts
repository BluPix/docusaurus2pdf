import { describe, it, expect } from 'vitest';
import { MDXParser } from '../../mdx/parser.js';

describe('Inline content must never be silently dropped', () => {
  const parser = new MDXParser();

  it('keeps text around an inline image', async () => {
    const result = await parser.parse('Před obrázkem ![alt](./img/foo.png) a text po obrázku.');
    expect(result.Content).toContain('Před obrázkem');
    expect(result.Content).toContain('a text po obrázku');
    expect(result.Content).toContain('\\d2pdfimage{img/foo.png}');
    expect(result.Content).not.toContain('\\begin{figure}');
  });

  it('renders every image in a multi-image paragraph', async () => {
    const result = await parser.parse('![první](a.png) ![druhá](b.png)');
    expect(result.Content).toContain('img/a.png');
    expect(result.Content).toContain('img/b.png');
  });

  it('image-only paragraph becomes a figure', async () => {
    const result = await parser.parse('![alt](diagram.png)');
    expect(result.Content).toContain('\\begin{figure}[H]');
    expect(result.Content).toContain('img/diagram.png');
  });

  it('resolves reference-style links and images', async () => {
    const src = 'Viz [odkaz][ref] a ![logo][img].\n\n[ref]: https://example.com\n[img]: ./logo.png';
    const result = await parser.parse(src);
    expect(result.Content).toContain('\\href{https://example.com}{odkaz}');
    expect(result.Content).toContain('img/logo.png');
  });

  it('renders strikethrough with \\sout', async () => {
    const result = await parser.parse('Toto je ~~škrtnuté~~ slovo.');
    expect(result.Content).toContain('\\sout{škrtnuté}');
  });

  it('renders <img> JSX element with width', async () => {
    const result = await parser.parse('<img src="/img/screenshot.png" alt="Screenshot" width="400" />');
    expect(result.Content).toContain('img/screenshot.png');
    expect(result.Content).toContain('width=300.0pt');
  });

  it('renders <a href> as a hyperlink', async () => {
    const result = await parser.parse('Viz <a href="https://example.com">tento web</a>.');
    expect(result.Content).toContain('\\href{https://example.com}{tento web}');
  });

  it('renders sub/sup/kbd', async () => {
    const result = await parser.parse('H<sub>2</sub>O a E=mc<sup>2</sup>, stiskni <kbd>Ctrl</kbd>');
    expect(result.Content).toContain('\\textsubscript{2}');
    expect(result.Content).toContain('\\textsuperscript{2}');
    expect(result.Content).toContain('\\fbox{\\footnotesize\\texttt{Ctrl}}');
  });

  it('keeps image inside a link', async () => {
    const result = await parser.parse('[![badge](badge.png)](https://ci.example.com)');
    expect(result.Content).toContain('\\href{https://ci.example.com}');
    expect(result.Content).toContain('img/badge.png');
  });

  it('rewrites svg/gif/webp extensions to converted formats', async () => {
    const result = await parser.parse('![a](x.svg)\n\n![b](y.gif)\n\n![c](z.webp)');
    expect(result.Content).toContain('img/x.pdf');
    expect(result.Content).toContain('img/y.png');
    expect(result.Content).toContain('img/z.png');
  });
});
