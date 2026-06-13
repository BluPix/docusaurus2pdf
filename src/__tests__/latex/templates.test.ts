import { describe, it, expect } from 'vitest';
import { generateTitlePage, generateTableOfContents } from '../../latex/templates/document.js';

describe('LaTeX Templates and Escaping', () => {
  describe('generateTitlePage', () => {
    it('generates basic title page', () => {
      const result = generateTitlePage({
        Title: 'My Title',
        Author: 'Author Name',
        Date: '2026-06-13',
      } as any);

      expect(result).toContain('\\title{My Title}');
      expect(result).toContain('\\author{Author Name}');
      expect(result).toContain('\\date{2026-06-13}');
      expect(result).toContain('\\maketitle');
    });

    it('escapes LaTeX special characters on title page without double-escaping braces', () => {
      // Test characters: \, {, }, $, &, %, #, _, ^, ~
      const result = generateTitlePage({
        Title: 'Title & Co. % #1',
        Author: 'John_Doe \\ & {Sub}',
      } as any);

      // & -> \&, % -> \%, # -> \#
      expect(result.find(l => l.startsWith('\\title'))).toBe('\\title{Title \\& Co. \\% \\#1}');
      
      // _ -> \_, \ -> \textbackslash{}, & -> \&, { -> \{, } -> \}
      // Crucial: \textbackslash{} must NOT have its braces escaped to \textbackslash\{\}
      expect(result.find(l => l.startsWith('\\author'))).toBe('\\author{John\\_Doe \\textbackslash{} \\& \\{Sub\\}}');
    });

    it('falls back to \\today if date is undefined', () => {
      const result = generateTitlePage({
        Title: 'Test Document',
      } as any);
      expect(result).toContain('\\date{\\today}');
    });
  });

  describe('generateTableOfContents', () => {
    it('generates TOC when enabled', () => {
      const result = generateTableOfContents({
        includeTableOfContents: true,
        includeNewPageAfterToc: true,
        includeTitlePage: true,
      });
      expect(result).toContain('\\tableofcontents');
      expect(result).toContain('\\newpage');
    });

    it('returns empty array when TOC disabled', () => {
      const result = generateTableOfContents({
        includeTableOfContents: false,
        includeNewPageAfterToc: true,
        includeTitlePage: true,
      });
      expect(result).toEqual([]);
    });
  });
});
