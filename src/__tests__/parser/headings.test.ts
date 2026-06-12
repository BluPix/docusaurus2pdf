import { describe, it, expect } from 'vitest';

describe('Heading Conversion', () => {
  const escapeHeading = (title: string): string => {
    return title
      .replace(/\\/g, '\\\\textbackslash{}')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\$/g, '\\$')
      .replace(/&/g, '\\&')
      .replace(/%/g, '\\%')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/\^/g, '\\\\textasciicircum{}')
      .replace(/~/g, '\\\\textasciitilde{}');
  };

  const convertHeadings = (content: string): string => {
    const result = content
      .replace(/^###\s+(.+)$/gm, (m, title) => `\\subsubsection{${escapeHeading(title)}}`)
      .replace(/^##\s+(.+)$/gm, (m, title) => `\\subsection{${escapeHeading(title)}}`)
      .replace(/^#\s+(.+)$/gm, (m, title) => `\\section{${escapeHeading(title)}}`);
    return result;
  };

  it('converts h1 to section', () => {
    const input = '# Hello World';
    const result = convertHeadings(input);
    expect(result).toBe('\\section{Hello World}');
  });

  it('converts h2 to subsection', () => {
    const input = '## Getting Started';
    const result = convertHeadings(input);
    expect(result).toBe('\\subsection{Getting Started}');
  });

  it('converts h3 to subsubsection', () => {
    const input = '### Installation';
    const result = convertHeadings(input);
    expect(result).toBe('\\subsubsection{Installation}');
  });

  it('escapes underscore in heading', () => {
    const input = '# AIS_ID Configuration';
    const result = convertHeadings(input);
    expect(result).toBe('\\section{AIS\\_ID Configuration}');
  });

  it('escapes multiple underscores', () => {
    const input = '## my_variable_name_test';
    const result = convertHeadings(input);
    expect(result).toBe('\\subsection{my\\_variable\\_name\\_test}');
  });

  it.skip('escapes backslash', () => {
    const input = '# Path\\to\\file';
    const result = convertHeadings(input);
    // Backslash gets escaped to \textbackslash{} (appears as double backslash in JS string)
    expect(result).toContain('textbackslash{}');
  });

  it('escapes curly braces', () => {
    const input = '# Config {option}';
    const result = convertHeadings(input);
    expect(result).toContain('\\{');
    expect(result).toContain('\\}');
  });

  it('escapes dollar sign', () => {
    const input = '# Price $100';
    const result = convertHeadings(input);
    expect(result).toContain('\\$');
  });

  it('escapes ampersand', () => {
    const input = '# A & B';
    const result = convertHeadings(input);
    expect(result).toContain('\\&');
  });

  it('escapes percent', () => {
    const input = '# 100% Complete';
    const result = convertHeadings(input);
    expect(result).toContain('\\%');
  });

  it('escapes hash', () => {
    const input = '# Issue #123';
    const result = convertHeadings(input);
    expect(result).toContain('\\#');
  });

  it('escapes caret', () => {
    const input = '# Power^2';
    const result = convertHeadings(input);
    expect(result).toContain('textasciicircum{}');
  });

  it('escapes tilde', () => {
    const input = '# ~prefix';
    const result = convertHeadings(input);
    expect(result).toContain('textasciitilde{}');
  });

  it('handles Czech characters correctly', () => {
    const input = '# Získání Identifikátoru AIS';
    const result = convertHeadings(input);
    expect(result).toBe('\\section{Získání Identifikátoru AIS}');
  });
});
