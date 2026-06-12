import { describe, it, expect } from 'vitest';
import { MDXParser } from '../../mdx/parser.js';

describe('Horizontal Rule Conversion', () => {
  const parser = new MDXParser();

  it('renders a thematic break as a centered rule', async () => {
    const result = await parser.parse('před\n\n---\n\npo');
    expect(result.Content).toContain('\\rule{0.45\\linewidth}{0.4pt}');
    expect(result.Content).toContain('před');
    expect(result.Content).toContain('po');
  });

  it('supports *** and ___ variants', async () => {
    for (const hr of ['***', '___']) {
      const result = await parser.parse(`Text\n\n${hr}\n\nMore`);
      expect(result.Content).toContain('\\rule{0.45\\linewidth}{0.4pt}');
    }
  });
});
