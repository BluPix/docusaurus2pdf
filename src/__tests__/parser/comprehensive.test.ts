import { describe, it, expect } from 'vitest';
import { MDXParser } from '../../mdx/parser.js';

describe('MDXParser Comprehensive Tests', () => {
  const parser = new MDXParser();

  // ==================== CODE BLOCKS ====================
  describe('Code Blocks', () => {
    it('converts basic code block with language', async () => {
      const input = '# Test\n\n```js\nconst x = 1;\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('language=js');
      expect(result.Content).toContain('\\begin{lstlisting}');
    });

    it('supports code title attribute', async () => {
      const input = '# Test\n\n```js title="/src/index.js"\nconst x = 1;\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('caption={/src/index.js}');
    });

    it('supports showLineNumbers', async () => {
      const input = '# Test\n\n```js showLineNumbers\nconst x = 1;\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('numbers=left');
    });

    it('supports title and showLineNumbers together', async () => {
      const input = '# Test\n\n```js title="test.js" showLineNumbers\nconst x = 1;\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('caption={test.js}');
      expect(result.Content).toContain('numbers=left');
    });

    it('removes highlight-next-line comments and highlights', async () => {
      const input = '# Test\n\n```js\nconst x = 1;\n// highlight-next-line\nconst y = 2;\n```';
      const result = await parser.parse(input);
      expect(result.Content).not.toContain('highlight-next-line');
      expect(result.Content).toContain('highlightlines={2}');
      expect(result.Content).toContain('\\begin{Verbatim}');
    });

    it('removes highlight-start and highlight-end comments and highlights the block', async () => {
      const input = '# Test\n\n```js\nconst a = 1;\n// highlight-start\nconst b = 2;\nconst c = 3;\n// highlight-end\nconst d = 4;\n```';
      const result = await parser.parse(input);
      expect(result.Content).not.toContain('highlight-start');
      expect(result.Content).not.toContain('highlight-end');
      expect(result.Content).toContain('highlightlines={2-3}');
      expect(result.Content).toContain('\\begin{Verbatim}');
    });

    it('supports alternative comment highlight syntax (python and html comments)', async () => {
      const pyInput = '# Test\n\n```python\n# highlight-next-line\nx = 1\n```';
      const pyResult = await parser.parse(pyInput);
      expect(pyResult.Content).not.toContain('highlight-next-line');
      expect(pyResult.Content).toContain('highlightlines={1}');

      const htmlInput = '# Test\n\n```html\n<!-- highlight-next-line -->\n<div>Test</div>\n```';
      const htmlResult = await parser.parse(htmlInput);
      expect(htmlResult.Content).not.toContain('highlight-next-line');
      expect(htmlResult.Content).toContain('highlightlines={1}');
    });
  });

  // ==================== MATH EQUATIONS ====================
  describe('Math Equations', () => {
    it('preserves inline math $...$', async () => {
      const input = '# Test\n\nInline: $E = mc^2$';
      const result = await parser.parse(input);
      expect(result.Content).toContain('$E = mc^2$');
    });

    it('converts block math $$...$$ to \\[...\\]', async () => {
      const input = '# Test\n\n$$\\int_a^b f(x)dx$$';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\[');
      expect(result.Content).toContain('\\]');
    });

    it('does not escape special chars inside math', async () => {
      const input = '# Test\n\nMath: $x^2$ and $$y_1$$';
      const result = await parser.parse(input);
      expect(result.Content).toContain('$x^2');
    });
  });

  // ==================== ADMONITIONS ====================
  describe('Admonitions', () => {
    it('converts :::warning to tcolorbox', async () => {
      const input = '# Test\n\n:::warning\nSome content\n:::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{tcolorbox}');
      expect(result.Content).toContain('Warning');
    });

    it('supports :::warning[Title] syntax', async () => {
      const input = '# Test\n\n:::warning[Bezpe\\u010Dnostn\\u00ED doporu\\u010Den\\u00ED]\nContent\n:::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('Bezpe');
      expect(result.Content).toContain('\\faExclamationTriangle');
    });

    it('supports different types: tip, note, info, danger', async () => {
      const types = ['tip', 'note', 'info', 'warning', 'danger'];
      for (const type of types) {
        const input = `# Test\n\n:::${type}\nContent\n:::`;
        const result = await parser.parse(input);
        expect(result.Content).toContain(`\\begin{tcolorbox}`);
      }
    });

    it('supports custom admonition types with default styling', async () => {
      const input = '# Test\n\n:::custom-type[Custom]\nContent\n:::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{tcolorbox}');
      expect(result.Content.toLowerCase()).toContain('custom');
    });

    it('supports nested admonitions with double colons', async () => {
      const input = '# Test\n\n::::info[Parent]\nOuter content\n\n::::warning[Child]\nInner content\n::::\n::::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{tcolorbox}');
      expect(result.Content).toContain('Parent');
      expect(result.Content).toContain('Child');
      // Should have two tcolorbox environments
      const tcolorboxCount = (result.Content.match(/\\begin{tcolorbox}/g) || []).length;
      expect(tcolorboxCount).toBeGreaterThanOrEqual(2);
    });

    it('supports triple-colon nested admonitions', async () => {
      const input = '# Test\n\n:::::note[Level 1]\nContent 1\n\n::::info[Level 2]\nContent 2\n::::\n:::::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('Level 1');
      expect(result.Content).toContain('Level 2');
    });

    it('handles mixed nesting levels', async () => {
      const input = '# Test\n\n:::tip[Simple]\nSingle level\n:::\n\n::::warning[Nested]\nDouble level\n::::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('Simple');
      expect(result.Content).toContain('Nested');
    });
  });

  // ==================== DETAILS / TABS ====================
  describe('Details and Tabs', () => {
    it('converts <details><summary> to tcolorbox', async () => {
      const input = '# Test\n\n<details><summary>Click to expand</summary>Hidden content</details>';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{tcolorbox}');
      expect(result.Content).toContain('Click to expand');
    });

    it('converts <Tabs><TabItem> to tcolorbox', async () => {
      const input = `
<Tabs>
<TabItem value="a" label="Android">Install on Android</TabItem>
<TabItem value="i" label="iOS">Install on iOS</TabItem>
</Tabs>`;
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{tcolorbox}');
      expect(result.Content).toContain('title={Android}');
      expect(result.Content).toContain('title={iOS}');
    });
  });

  // ==================== MERMAID DIAGRAMS ====================
  describe('Mermaid Diagrams', () => {
    it('extracts mermaid code blocks', async () => {
      const input = '# Test\n\n```mermaid\ngraph TD;\nA-->B;\n```';
      const result = await parser.parse(input);
      expect(result.MermaidDiagrams).toHaveLength(1);
      expect(result.MermaidDiagrams?.[0].code).toContain('graph TD');
    });

    it('replaces mermaid blocks with image references', async () => {
      const input = '# Test\n\n```mermaid\ngraph TD;\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('mermaid_');
      expect(result.Content).toContain('\\docimage');
      expect(result.Content).toContain('.pdf');
    });

    it('handles multiple mermaid diagrams', async () => {
      const input = '# Test\n\n```mermaid\ngraph A\n```\n\n```mermaid\ngraph B\n```';
      const result = await parser.parse(input);
      expect(result.MermaidDiagrams).toHaveLength(2);
    });
  });

  // ==================== PLANTUML DIAGRAMS ====================
  describe('PlantUML Diagrams', () => {
    it('extracts plantuml code blocks', async () => {
      const input = '# Test\n\n```plantuml\n@startuml\nclass A\n@enduml\n```';
      const result = await parser.parse(input);
      expect(result.PlantUMLDiagrams).toHaveLength(1);
    });

    it('replaces plantuml blocks with image references', async () => {
      const input = '# Test\n\n```plantuml\n@startuml\n@enduml\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('plantuml_');
    });
  });

  // ==================== HEADINGS ====================
  describe('Headings', () => {
    it('maps an in-body # one level below the page title', async () => {
      // The page title itself becomes the \section, so a stray in-body h1
      // must not collide with it
      const input = '# Title\n\n# Main Title';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\subsection{Main Title}');
    });

    it('converts ## to \\subsection', async () => {
      const input = '# Title\n\n## Sub Title';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\subsection{Sub Title}');
    });

    it('converts ### to \\subsubsection', async () => {
      const input = '# Title\n\n### Sub Sub Title';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\subsubsection{Sub Sub Title}');
    });

    it('strips manual numbering when enabled', async () => {
      parser.setOptions({ stripManualNumbering: true });
      const input = '# Title\n\n### 1.4.3 Custom Title';
      const result = await parser.parse(input);
      expect(result.Content).toContain('Custom Title');
      expect(result.Content).not.toContain('1.4.3');
    });
  });

  // ==================== FORMATTING ====================
  describe('Text Formatting', () => {
    it('converts **bold** to \\textbf', async () => {
      const input = '# Test\n\nThis is **bold** text';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\textbf{bold}');
    });

    it('converts *italic* to \\textit', async () => {
      const input = '# Test\n\nThis is *italic* text';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\textit{italic}');
    });

    it('converts `code` to \\texttt', async () => {
      const input = '# Test\n\nUse `const x = 1`';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\texttt{const x = 1}');
    });

    it('converts markdown blockquotes to quote environment with italics', async () => {
      const input = '# Test\n\n> This is a quote.\n> It has multiple lines.';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{quote}\\itshape');
      expect(result.Content).toContain('This is a quote.');
      expect(result.Content).toContain('It has multiple lines.');
      expect(result.Content).toContain('\\end{quote}');
    });
  });

  // ==================== LINKS AND IMAGES ====================
  describe('Links and Images', () => {
    it('converts [text](url) to \\href', async () => {
      const input = '# Test\n\n[Link](https://example.com)';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\href{https://example.com}{Link}');
    });

    it('converts ![alt](path) to \\docimage', async () => {
      const input = '# Test\n\n![Diagram](img/diagram.png)';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\docimage');
      expect(result.Content).toContain('diagram.png');
    });
  });

  // ==================== LISTS ====================
  describe('Lists', () => {
    it('converts bullet lists to itemize', async () => {
      const input = '# Test\n\n- Item 1\n- Item 2';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{itemize}');
      expect(result.Content).toContain('\\item');
    });

    it('places all items in single itemize environment', async () => {
      const input = '# Test\n\n- Item 1\n- Item 2\n- Item 3';
      const result = await parser.parse(input);
      // Should have exactly one itemize environment for all items
      const itemizeCount = (result.Content.match(/\\begin\{itemize\}/g) || []).length;
      expect(itemizeCount).toBe(1);
      // All items should be inside
      expect(result.Content).toContain('\\item Item 1');
      expect(result.Content).toContain('\\item Item 2');
      expect(result.Content).toContain('\\item Item 3');
    });

    it('places all numbered items in single enumerate environment', async () => {
      const input = '# Test\n\n1. Item 1\n2. Item 2\n3. Item 3';
      const result = await parser.parse(input);
      const enumerateCount = (result.Content.match(/\\begin\{enumerate\}/g) || []).length;
      expect(enumerateCount).toBe(1);
      expect(result.Content).toContain('\\item Item 1');
      expect(result.Content).toContain('\\item Item 2');
      expect(result.Content).toContain('\\item Item 3');
    });

    it('converts lettered lists (a), b), c)) to enumerate', async () => {
      const input = '# Test\n\na) First item\nb) Second item\nc) Third item';
      const result = await parser.parse(input);
      const enumerateCount = (result.Content.match(/\\begin\{enumerate\}/g) || []).length;
      expect(enumerateCount).toBe(1);
      expect(result.Content).toContain('\\begin{enumerate}[label=\\alph*)]');
      expect(result.Content).toContain('\\item First item');
      expect(result.Content).toContain('\\item Second item');
      expect(result.Content).toContain('\\item Third item');
    });

    it('converts lettered lists with period (a., b., c.) to enumerate', async () => {
      const input = '# Test\n\na. Item A\nb. Item B';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{enumerate}[label=\\alph*)]');
      expect(result.Content).toContain('\\item Item A');
      expect(result.Content).toContain('\\item Item B');
    });
  });

  // ==================== TABLES ====================
  describe('Tables', () => {
    it('converts markdown tables to longtable with bold header', async () => {
      const input = '# Test\n\n| A | B |\n|---|---|\n| 1 | 2 |';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{longtable}');
      expect(result.Content).toContain('\\textbf{A} & \\textbf{B}');
      expect(result.Content).toContain('1 & 2');
    });

    it('honors column alignment and uses tabular inside boxes', async () => {
      const aligned = await parser.parse('| L | C | R |\n|:--|:-:|--:|\n| a | b | c |');
      expect(aligned.Content).toContain('>{\\raggedright\\arraybackslash}p');
      expect(aligned.Content).toContain('>{\\centering\\arraybackslash}p');
      expect(aligned.Content).toContain('>{\\raggedleft\\arraybackslash}p');

      const inBox = await parser.parse(':::note\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n:::');
      expect(inBox.Content).toContain('\\begin{tabular}');
      expect(inBox.Content).not.toContain('\\begin{longtable}');
    });
  });

  // ==================== NEW FEATURES ====================
  describe('Task Lists', () => {
    it('converts unchecked task list items', async () => {
      const input = '# Test\n\n- [ ] Task 1\n- [ ] Task 2';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\item[\\square]');
    });

    it('converts checked task list items', async () => {
      const input = '# Test\n\n- [x] Task 1\n- [x] Task 2';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\item[\\checkmark]');
    });
  });

  describe('Code Block Line Highlighting', () => {
    it('supports line highlighting syntax', async () => {
      const input = '# Test\n\n```js {1-3,5}\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('highlightlines={1-3,5}');
      expect(result.Content).toContain('\\begin{Verbatim}');
      expect(result.Content).toContain('const a = 1;');
    });
  });

  describe('Footnotes', () => {
    it('converts footnote references to \\footnote', async () => {
      const input = '# Test\n\nThis is text[^1]\n\n[^1]: This is a footnote';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\footnote{This is a footnote}');
    });

    it('handles multiple footnotes', async () => {
      const input = '# Test\n\nText[^1] and more[^2]\n\n[^1]: First note\n[^2]: Second note';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\footnote{First note}');
      expect(result.Content).toContain('\\footnote{Second note}');
    });
  });

  describe('Definition Lists', () => {
    it('converts definition lists to description environment', async () => {
      const input = '# Test\n\nTerm 1\n: Definition 1\n\nTerm 2\n: Definition 2';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{description}');
      expect(result.Content).toContain('\\item[Term 1]');
      expect(result.Content).toContain('\\item[Term 2]');
      expect(result.Content).toContain('\\end{description}');
    });

    it('handles single definition item', async () => {
      const input = '# Test\n\nAPI\n: Application Programming Interface';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{description}');
      expect(result.Content).toContain('\\item[API]');
      expect(result.Content).toContain('Application Programming Interface');
    });
  });

  describe('Cross-references', () => {
    it('adds labels to headings', async () => {
      const input = '# Test\n\n## Section One\n\n### Subsection';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\label{');
    });

    it('converts internal links to hyperref', async () => {
      const input = '# Test\n\n## Section One\n\nSee [Section One](#Section One)';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\hyperref[section-one]{Section One}');
    });
  });

  describe('Nested Lists', () => {
    it('handles nested bullet lists', async () => {
      const input = '# Test\n\n- Item 1\n  - Nested item 1.1\n  - Nested item 1.2\n- Item 2';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{itemize}');
      expect(result.Content).toContain('\\end{itemize}');
    });

    it('handles mixed bullet and numbered lists', async () => {
      const input = '# Test\n\n- Bullet item\n1. Numbered item\n2. Another numbered';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{itemize}');
      expect(result.Content).toContain('\\begin{enumerate}');
    });
  });

  describe('Frontmatter Variables', () => {
    it('substitutes {{ variable }} with frontmatter value', async () => {
      const input = '---\ntitle: Test\nauthor: John\n---\n\nContent\n\nWritten by {{ author }}';
      const result = await parser.parse(input);
      expect(result.Content).toContain('John');
    });

    it('keeps placeholder if variable not found', async () => {
      const input = '---\ntitle: Test\n---\n\nContent\n\nUnknown: {{ unknown }}';
      const result = await parser.parse(input);
      // escaped braces so the placeholder is actually visible in the PDF
      expect(result.Content).toContain('\\{\\{ unknown \\}\\}');
    });
  });

  describe('Head Metadata', () => {
    it('uses frontmatter for PDF metadata', async () => {
      const input = '---\ntitle: Test Document\ndescription: A test\nkeywords: test, pdf\nauthor: John\n---\n\nContent';
      const result = await parser.parse(input);
      expect(result.Frontmatter.title).toBe('Test Document');
      expect(result.Frontmatter.description).toBe('A test');
      expect(result.Frontmatter.keywords).toBe('test, pdf');
      expect(result.Frontmatter.author).toBe('John');
    });
  });

  describe('Code Block Line Ranges', () => {
    it('filters code to show only specified lines', async () => {
      const input = '# Test\n\n```js {1-2}\nline 1\nline 2\nline 3\nline 4\n```';
      const result = await parser.parse(input);
      expect(result.Content).toContain('line 1');
      expect(result.Content).toContain('line 2');
      expect(result.Content).not.toContain('line 3');
      expect(result.Content).not.toContain('line 4');
    });
  });

  describe('HTML Tags', () => {
    it('converts <strong> to \\textbf', async () => {
      const input = '# Test\n\n<strong>bold text</strong>';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\textbf{bold text}');
    });

    it('converts <em> to \\textit', async () => {
      const input = '# Test\n\n<em>italic text</em>';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\textit{italic text}');
    });

    it('converts <br> to LaTeX line break', async () => {
      const input = '# Test\n\nLine 1<br>Line 2';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\\\');
    });

    it('converts <dl><dt><dd> HTML tags to description environment', async () => {
      const input = '# Test\n\n<dl>\n<dt>Term 1</dt>\n<dd>Definition 1</dd>\n<dt>Term 2</dt>\n<dd>Definition 2</dd>\n</dl>';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{description}');
      expect(result.Content).toContain('\\item[Term 1]\n Definition 1');
      expect(result.Content).toContain('\\item[Term 2]\n Definition 2');
    });

    it('converts JSX <Admonition> component', async () => {
      const input = '# Test\n\n<Admonition type="tip" title="Tip Title">\nThis is a tip.\n</Admonition>';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{tcolorbox}');
      expect(result.Content).toContain('title={\\faLightbulb Tip Title');
      expect(result.Content).toContain('colback=green!5!white');
      expect(result.Content).toContain('This is a tip.');
    });

    it('converts JSX <iframe>, <video>, and <audio> elements', async () => {
      const input = '# Test\n\n<video src="video.mp4" />\n\n<iframe src="https://example.com" />\n\n<audio src="audio.mp3" />';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\textit{[Video: \\hyperref[doc:video.mp4]{video.mp4}]}');
      expect(result.Content).toContain('\\textit{[Iframe: \\href{https://example.com}{https://example.com}]}');
      expect(result.Content).toContain('\\textit{[Audio: \\hyperref[doc:audio.mp3]{audio.mp3}]}');
    });

    it('converts JSX <DocCardList> and <DocCard> components', async () => {
      const input = '# Test\n\n<DocCardList items="[{\'label\':\'API Reference\'}]" />\n\n<DocCard label="Setup" description="Get started" />';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{itemize}');
      expect(result.Content).toContain('\\item API Reference');
      expect(result.Content).toContain('\\textbf{Setup} - Get started');
    });
  });

  describe('Index', () => {
    it('converts :::index:::term::: to \\index{term}', async () => {
      const input = '# Test\n\nThis is :::index:::important term::: in the text';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\index{important term}');
    });
  });

  describe('Glossary', () => {
    it('converts :::glossary:::term:::definition::: to \\newglossaryentry', async () => {
      const input = '# Test\n\n:::glossary:::API:::Application Programming Interface:::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\newglossaryentry');
      expect(result.Content).toContain('name={API}');
      expect(result.Content).toContain('description={Application Programming Interface}');
    });
  });

  describe('Bibliography/Citations', () => {
    it('converts :::bib:::key:::details::: to \\bibitem', async () => {
      const input = '# Test\n\n:::bib:::smith2023:::John Smith, PDF Generation, 2023:::';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\bibitem{smith2023}');
      expect(result.Content).toContain('John Smith, PDF Generation, 2023');
    });

    it('converts [@key] to \\cite{key}', async () => {
      const input = '# Test\n\nAccording to [@smith2023], PDF generation is important.';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\cite{smith2023}');
    });
  });

  describe('Image Layout', () => {
    it('images without captions use figure environment with centering', async () => {
      const input = '# Test\n\nText before image\n\n![Alt text](img/example.png)\n\nText after image';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{figure}');
      expect(result.Content).toContain('\\centering');
      expect(result.Content).toContain('\\docimage');
      expect(result.Content).toContain('\\end{figure}');
    });

    it('images with captions use figure environment with caption', async () => {
      const input = '# Test\n\n![Alt text](img/example.png "Caption")';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{figure}');
      expect(result.Content).toContain('\\centering');
      expect(result.Content).toContain('\\docimage');
      expect(result.Content).toContain('\\caption{Caption}');
      expect(result.Content).toContain('\\end{figure}');
    });

    it('supports suppressing caption numbers with \caption*', async () => {
      const input = '# Test\n\n![Alt text](img/example.png "Caption")';
      const suppressParser = new MDXParser();
      suppressParser.setOptions({ suppressCaptionNumbers: true });
      const result = await suppressParser.parse(input);
      expect(result.Content).toContain('\\caption*{Caption}');
    });

    it('merges separate caption lines into figure environment', async () => {
      const input = '# Test\n\n![Alt text](img/example.png)\n\n*Obrázek 1.1 – Test description*\n\n---';
      const result = await parser.parse(input);
      expect(result.Content).toContain('\\begin{figure}');
      expect(result.Content).toContain('\\docimage');
      expect(result.Content).toContain('\\caption{Obrázek 1.1 – Test description}');
      expect(result.Content).toContain('\\end{figure}');
    });
  });
});
