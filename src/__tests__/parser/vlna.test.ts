import { describe, it, expect } from 'vitest';
import { applyVlna } from '../../latex/vlna.js';
import { MDXParser } from '../../mdx/parser.js';

const F = '```';

describe('applyVlna rules', () => {
  it('ties single-letter prepositions to the next word', () => {
    expect(applyVlna('Šli jsme v lese a u potoka.')).toBe('Šli jsme v~lese a~u~potoka.');
  });

  it('handles consecutive prepositions', () => {
    expect(applyVlna('a v lese')).toBe('a~v~lese');
  });

  it('replaces (not duplicates) the space before a number', () => {
    expect(applyVlna('strana 5 a kapitola 10')).toBe('strana~5 a~kapitola~10');
  });

  it('does not join lines across paragraph breaks', () => {
    expect(applyVlna('konec a\n\nNový odstavec')).toBe('konec a\n\nNový odstavec');
  });

  it('is case-insensitive', () => {
    expect(applyVlna('V lese')).toBe('V~lese');
  });
});

describe('vlna integration in parser', () => {
  it('applies vlna to text but never to code blocks or URLs', async () => {
    const parser = new MDXParser();
    parser.setOptions({ language: 'cs' });
    const src = `Text s 5 jablky a v lese.\n\n${F}python\nx = 5\nfor i in range(10):\n    pass\n${F}\n\nOdkaz na [web](https://example.com/a%20b).`;
    const result = await parser.parse(src);

    expect(result.Content).toContain('s~5 jablky a~v~lese');
    expect(result.Content).toContain('x = 5');
    expect(result.Content).toContain('for i in range(10)');
    expect(result.Content).not.toContain('example.com/a~');

    parser.setOptions({ language: 'en' });
    const en = await parser.parse('Walking in a forest with 5 apples.');
    expect(en.Content).not.toContain('~');
  });
});
