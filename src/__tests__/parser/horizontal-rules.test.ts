import { describe, it, expect } from 'vitest';
import { convertHorizontalRules } from '../../mdx/converters/horizontal-rule.js';

describe('Horizontal Rule Conversion', () => {
  it('converts --- to vspace by default', () => {
    const input = 'Some text\n---\nMore text';
    const result = convertHorizontalRules(input);
    expect(result).toContain('\\vspace{1em}');
    expect(result).not.toContain('---');
  });

  it('converts *** to vspace', () => {
    const input = 'Text\n***\nMore';
    const result = convertHorizontalRules(input);
    expect(result).toContain('\\vspace{1em}');
  });

  it('converts ___ to vspace', () => {
    const input = 'Text\n___\nMore';
    const result = convertHorizontalRules(input);
    expect(result).toContain('\\vspace{1em}');
  });

  it('converts to pagebreak when configured', () => {
    const input = 'Text\n---\nMore';
    const result = convertHorizontalRules(input, { latexCommand: 'pagebreak' });
    expect(result).toContain('\\pagebreak');
  });

  it('converts to newpage when configured', () => {
    const input = 'Text\n---\nMore';
    const result = convertHorizontalRules(input, { latexCommand: 'newpage' });
    expect(result).toContain('\\newpage');
  });

  it('converts to hrule when configured', () => {
    const input = 'Text\n---\nMore';
    const result = convertHorizontalRules(input, { latexCommand: 'hrule' });
    expect(result).toContain('\\hrule');
  });

  it('uses custom vspace amount when configured', () => {
    const input = 'Text\n---\nMore';
    const result = convertHorizontalRules(input, { vspaceAmount: '2em' });
    expect(result).toContain('\\vspace{2em}');
  });
});
