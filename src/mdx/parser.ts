import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import YAML from 'yaml';
import { ParsedPage, MDXParserOptions, SupportedLanguages } from '../types/index.js';
import { applyVlna } from '../latex/vlna.js';

export type { ParsedPage, MDXParserOptions } from '../types/index.js';

export class MDXParser {
  private stripManualNumbering: boolean = false;
  private convertEmoji: boolean = false;
  private useEmojiCommands: boolean = false;
  private suppressCaptionNumbers: boolean = false;
  private useVlna: boolean = false;

  setOptions(opts: MDXParserOptions): void {
    if (opts.stripManualNumbering !== undefined) {
      this.stripManualNumbering = opts.stripManualNumbering;
    }
    if (opts.convertEmoji !== undefined) {
      this.convertEmoji = opts.convertEmoji;
    }
    if (opts.useEmojiCommands !== undefined) {
      this.useEmojiCommands = opts.useEmojiCommands;
    }
    if (opts.suppressCaptionNumbers !== undefined) {
      this.suppressCaptionNumbers = opts.suppressCaptionNumbers;
    }
    if (opts.language !== undefined) {
      this.useVlna = SupportedLanguages[opts.language]?.Vlna ?? false;
    }
  }

  private escapeLatex(s: string): string {
    let result = '';
    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      switch (char) {
        case '\\': result += '\\textbackslash{}'; break;
        case '{': result += '\\{'; break;
        case '}': result += '\\}'; break;
        case '$': result += '\\$'; break;
        case '&': result += '\\&'; break;
        case '%': result += '\\%'; break;
        case '#': result += '\\#'; break;
        case '_': result += '\\_'; break;
        case '^': result += '\\textasciicircum{}'; break;
        case '~': result += '\\textasciitilde{}'; break;
        case '✓': result += '\\checkmark'; break;
        case '✗': result += '\\texttimes'; break;
        default: result += char;
      }
    }
    return result;
  }

  private convertEmojiToText(content: string): string {
    const emojiMap: Record<string, string> = {
      '📸': '[Camera]',
      '📹': '[Video]',
      '📱': '[Phone]',
      '💻': '[Computer]',
      '⚠️': '[Warning]',
      '🔥': '[Fire]',
      '✔️': '[OK]',
      '❌': '[Error]',
      '➡️': '->',
      '⬅️': '<-',
      '⬆️': '^',
      '⬇️': 'v',
      '①': '[1]',
      '②': '[2]',
      '③': '[3]',
      '④': '[4]',
      '⑤': '[5]',
      '⑥': '[6]',
      '⑦': '[7]',
      '⑧': '[8]',
      '⑨': '[9]',
      '⓿': '[0]',
    };
    
    let result = content;
    for (const [emoji, text] of Object.entries(emojiMap)) {
      result = result.split(emoji).join(text);
    }
    result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '[emoji]');
    return result;
  }

  private convertEmojiToLatexCommand(content: string): string {
    const emojiMap: Record<string, string> = {
      '📸': 'camera',
      '📹': 'video-camera',
      '📱': 'mobile-phone',
      '💻': 'computer',
      '⚠️': 'warning',
      '🔥': 'fire',
      '✔️': 'white-check-mark',
      '❌': 'cross-mark',
      '➡️': 'right-arrow',
      '⬅️': 'left-arrow',
      '⬆️': 'up-arrow',
      '⬇️': 'down-arrow',
    };
    
    let result = content;
    for (const [emoji, cmd] of Object.entries(emojiMap)) {
      result = result.split(emoji).join(`\\emoji{${cmd}}`);
    }
    result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, (match) => {
      const codepoint = match.codePointAt(0);
      if (!codepoint) return match;
      
      const nameMap: Record<number, string> = {
        0x1F527: 'wrench',
        0x1F4F7: 'camera',
        0x1F4F8: 'camera-with-flash',
        0x1F4F9: 'video-camera',
        0x1F4E0: 'outbox-tray',
        0x1F4E4: 'inbox-tray',
        0x2705: 'check-mark',
        0x274C: 'cross-mark',
        0x1F504: 'arrows-counterclockwise',
        0x1F503: 'up-down-arrow',
      };
      
      const name = nameMap[codepoint];
      return name ? `\\emoji{${name}}` : match;
    });
    return result;
  }

  private buildIncludeGraphics(filename: string, size?: string): string {
    const pdfFilename = filename.replace(/\.svg$/i, '.pdf');
    if (size) {
      const widthMatch = size.match(/width=(\d+)%/);
      if (widthMatch) {
        const percent = parseInt(widthMatch[1], 10) / 100;
        return `\\includegraphics[width=${percent}\\textwidth,keepaspectratio]{img/${pdfFilename}}`;
      }
    }
    return `\\includegraphics[width=0.95\\textwidth,height=0.5\\textheight,keepaspectratio]{img/${pdfFilename}}`;
  }

  async parse(source: string): Promise<ParsedPage> {
    const { content, frontmatter } = this.extractFrontmatter(source);
    const processedContent = this.preprocessContent(content, frontmatter);
    const contentWithoutTitle = this.removeFirstHeading(processedContent);
    const title = String(frontmatter.title || this.extractTitle(processedContent));

    const plantumlDiagrams: Array<{ hash: string; code: string }> = [];
    const mermaidDiagrams: Array<{ hash: string; code: string }> = [];

    let ast: any;
    try {
      ast = remark()
        .use(remarkFrontmatter)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkDirective)
        .use(remarkMdx)
        .parse(contentWithoutTitle);
    } catch (err) {
      console.warn('MDX parse warning, falling back to standard Markdown parser:', err);
      ast = remark()
        .use(remarkFrontmatter)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkDirective)
        .parse(contentWithoutTitle);
    }

    visit(ast, 'code', (node: any) => {
      const code = node.value || '';
      if (node.lang === 'plantuml') {
        plantumlDiagrams.push({ hash: this.simpleHash(code), code });
      } else if (node.lang === 'mermaid') {
        mermaidDiagrams.push({ hash: this.simpleHash(code), code });
      }
    });

    const headingLabels = new Map<string, string>();
    const usedLabels = new Map<string, number>();

    visit(ast, 'heading', (node: any) => {
      const rawText = this.getPlainText(node).trim();
      let label = rawText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      
      const count = usedLabels.get(label) || 0;
      if (count > 0) {
        label = `${label}-${count}`;
      }
      usedLabels.set(label, count + 1);
      headingLabels.set(rawText, label);
    });

    const footnoteDefinitionsMap = new Map<string, string>();
    // Need to define compileNode / compileChildren context before visiting
    const localCompileNode = (node: any, parent: any, depth: number): string => 
      this.compileNode(node, parent, depth, headingLabels, footnoteDefinitionsMap);

    visit(ast, 'footnoteDefinition', (node: any) => {
      const compiled = node.children.map((c: any) => localCompileNode(c, node, 0)).join('\n\n').trim();
      footnoteDefinitionsMap.set(node.identifier, compiled);
    });

    const latexContent = this.compileNode(ast, null, 0, headingLabels, footnoteDefinitionsMap);

    return {
      Title: title,
      Content: latexContent,
      Frontmatter: frontmatter,
      PlantUMLDiagrams: plantumlDiagrams,
      MermaidDiagrams: mermaidDiagrams,
    };
  }

  /**
   * Split content into alternating text/code segments based on fenced code
   * blocks (``` or ~~~). Preprocessing transforms must never touch code.
   */
  private splitByCodeFences(content: string): Array<{ type: 'text' | 'code'; text: string }> {
    const segments: Array<{ type: 'text' | 'code'; text: string }> = [];
    const lines = content.split('\n');
    let buffer: string[] = [];
    let fence: { char: string; length: number } | null = null;

    const flush = (type: 'text' | 'code') => {
      if (buffer.length > 0) {
        segments.push({ type, text: buffer.join('\n') });
        buffer = [];
      }
    };

    for (const line of lines) {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (!fence && fenceMatch) {
        flush('text');
        fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
        buffer.push(line);
      } else if (fence && fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length && line.trim() === fenceMatch[1]) {
        buffer.push(line);
        flush('code');
        fence = null;
      } else {
        buffer.push(line);
      }
    }
    flush(fence ? 'code' : 'text');
    return segments;
  }

  private preprocessContent(content: string, frontmatter: Record<string, unknown>): string {
    return this.splitByCodeFences(content)
      .map((seg) => (seg.type === 'code' ? seg.text : this.preprocessTextSegment(seg.text, frontmatter)))
      .join('\n');
  }

  private preprocessTextSegment(content: string, frontmatter: Record<string, unknown>): string {
    let result = content;

    // 1. Substitute frontmatter variables like {{ key }}
    result = result.replace(/\{\{(\s*\w+\s*)\}\}/g, (match, varName) => {
      const key = varName.trim();
      const value = frontmatter[key];
      if (value !== undefined) {
        return String(value);
      }
      return match;
    });

    // 2. Preprocess block math on single lines to multiple lines
    result = result.replace(/\$\$([^\n$]+)\$\$/g, '\n$$$$\n$1\n$$$$\n');

    // 3. Preprocess lettered lists to numbered lists. Only convert runs that
    // start with "a." / "a)" so prose lines like "v. Chod" are left alone.
    result = this.preprocessLetteredLists(result);

    // 4. Preprocess definition lists (Term\n: Definition) to custom HTML tags
    result = this.preprocessDefinitionLists(result);

    // 5. Preprocess spaces in internal links so they are parsed as links
    result = result.replace(/\[([^\]]+)\]\((#[^)]+)\)/g, (match, text, url) => {
      return `[${text}](${url.replace(/\s+/g, '%20')})`;
    });

    return result;
  }

  private preprocessLetteredLists(content: string): string {
    const lines = content.split('\n');
    const itemRegex = /^(\s*)([a-zA-Z])[.)]\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const start = lines[i].match(itemRegex);
      if (!start || start[2].toLowerCase() !== 'a') continue;

      // Collect the run of lettered items with the same indentation,
      // allowing blank lines between items.
      const indent = start[1];
      const runIndices: number[] = [i];
      let j = i + 1;
      while (j < lines.length) {
        if (lines[j].trim() === '') {
          j++;
          continue;
        }
        const m = lines[j].match(itemRegex);
        if (m && m[1] === indent) {
          runIndices.push(j);
          j++;
        } else {
          break;
        }
      }

      for (const idx of runIndices) {
        const m = lines[idx].match(itemRegex)!;
        lines[idx] = `${m[1]}1. ${m[3]}`;
      }
      i = j - 1;
    }

    return lines.join('\n');
  }
  
  private preprocessDefinitionLists(content: string): string {
    const lines = content.split('\n');
    const processed: string[] = [];
    let inDl = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1] || '';
      
      if (line.trim() && nextLine.trim().startsWith(': ')) {
        if (!inDl) {
          processed.push('<dl>');
          inDl = true;
        }
        processed.push(`<dt>${line.trim()}</dt>`);
        processed.push(`<dd>${nextLine.trim().substring(2)}</dd>`);
        i++;
      } else {
        if (inDl && line.trim() === '') {
          let hasMore = false;
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim() === '') continue;
            if (lines[j + 1] && lines[j + 1].trim().startsWith(': ')) {
              hasMore = true;
            }
            break;
          }
          if (!hasMore) {
            processed.push('</dl>');
            inDl = false;
          }
        } else if (inDl && line.trim() !== '') {
          processed.push('</dl>');
          inDl = false;
          processed.push(line);
        } else {
          processed.push(line);
        }
      }
    }
    
    if (inDl) {
      processed.push('</dl>');
    }
    
    return processed.join('\n');
  }

  private compileNode(node: any, parent: any, depth: number, headingLabels: Map<string, string>, footnoteDefinitionsMap: Map<string, string>): string {
    if (!node) return '';

    const getPlainText = (n: any): string => this.getPlainText(n);
    const compileChildren = (children: any[], parentNode: any, currentDepth: number): string[] => 
      this.compileChildren(children, parentNode, currentDepth, headingLabels, footnoteDefinitionsMap);

    switch (node.type) {
      case 'root':
        return compileChildren(node.children, node, depth).join('\n\n');

      case 'paragraph':
        return compileChildren(node.children, node, depth).join('');

      case 'text':
        return this.processSpecialText(node.value);

      case 'emphasis':
        return `\\textit{${compileChildren(node.children, node, depth).join('')}}`;

      case 'strong':
        return `\\textbf{${compileChildren(node.children, node, depth).join('')}}`;

      case 'blockquote':
        return `\\textit{${compileChildren(node.children, node, depth).join('')}}`;

      case 'break':
        return '\\\\';

      case 'thematicBreak':
        return '\\vspace{1em}';

      case 'inlineCode': {
        return `\\texttt{${this.escapeLatex(node.value)}}`;
      }

      case 'code': {
        const lang = node.lang || '';
        const code = node.value || '';
        const meta = node.meta || '';

        if (lang === 'plantuml') {
          const hash = this.simpleHash(code);
          return `\\begin{center}\\includegraphics[width=0.8\\textwidth]{img/plantuml_${hash}.eps}\\end{center}`;
        }
        if (lang === 'mermaid') {
          const hash = this.simpleHash(code);
          return `\\begin{center}\\includegraphics[width=0.8\\textwidth]{img/mermaid_${hash}.pdf}\\end{center}`;
        }

        // Options parsing
        let blockTitle = '';
        let showLineNumbers = false;
        let highlightLines = '';
        let lineRange = '';

        if (meta) {
          const titleMatch = meta.match(/title="([^"]+)"/);
          if (titleMatch) blockTitle = titleMatch[1];
          if (meta.includes('showLineNumbers')) showLineNumbers = true;

          const braceMatch = meta.match(/\{([^}]+)\}/);
          if (braceMatch) {
            const braceContent = braceMatch[1];
            if (braceContent.includes(',')) {
              highlightLines = braceContent;
            } else if (braceContent.match(/^\d+-\d+$/)) {
              lineRange = braceContent;
            }
          }
        }

        let cleanCode = code;
        if (lineRange) {
          const [start, end] = lineRange.split('-').map(Number);
          const codeLines = code.split('\n');
          const filteredLines = codeLines.slice(start - 1, end);
          cleanCode = filteredLines.join('\n');
        }

        const langMap: Record<string, string> = {
          json: 'javascript',
          yaml: 'python',
          yml: 'python',
          shell: 'bash',
          zsh: 'bash',
          sh: 'sh',
          bash: 'bash',
        };
        
        const supportedListingsLangs = new Set([
          'abap', 'ada', 'algol', 'ant', 'assembler', 'awk', 'bash', 'basic', 'c', 'c++', 
          'cobol', 'clean', 'delphi', 'eiffel', 'elixir', 'erlang', 'fortran', 'gnuplot', 
          'haskell', 'html', 'idl', 'java', 'lisp', 'logo', 'lua', 'make', 'mathematica', 
          'matlab', 'mercury', 'octave', 'oz', 'pascal', 'perl', 'php', 'postscript', 
          'prolog', 'python', 'r', 'rexx', 'ruby', 'sas', 'scilab', 'sh', 'sql', 'tcl', 
          'tex', 'vbscript', 'verilog', 'vhdl', 'vrml', 'xml',
          'javascript', 'typescript', 'js', 'ts'
        ]);

        const langLower = lang.toLowerCase();
        const mappedLang = langLower in langMap ? langMap[langLower] : langLower;

        const params: string[] = [];
        if (mappedLang && supportedListingsLangs.has(mappedLang)) {
          params.push(`language=${mappedLang}`);
        }

        let chosenEscapeChar = '';
        const candidates = ['`', '|', '!', '@', '~'];
        for (const char of candidates) {
          if (!cleanCode.includes(char)) {
            chosenEscapeChar = char;
            break;
          }
        }
        if (chosenEscapeChar) {
          params.push(`escapechar=${chosenEscapeChar}`);
        }

        if (showLineNumbers) {
          params.push('numbers=left');
        }
        if (highlightLines) {
          params.push(`highlightlines=${highlightLines}`);
        }
        if (blockTitle) {
          params.push(`caption=${blockTitle}`);
        }

        cleanCode = cleanCode
          .replace(/^\s*\/\/\s*highlight-next-line\s*$/gm, '')
          .replace(/^\s*\/\/\s*highlight-start[\s\S]*?\/\/\s*highlight-end\s*$/gm, '')
          .replace(/\/\*\s*highlight-next-line\s*\*\//g, '')
          .replace(/\/\*\s*highlight-start[\s\S]*?\*\/\s*\/\*\s*highlight-end\s*\*\//g, '')
          .replace(/\{#\s*highlight-next-line\s*\}/g, '')
          .replace(/\{#\s*highlight-start[\s\S]*?\{#\s*highlight-end\s*\}/g, '');

        const paramsStr = params.length > 0 ? `[${params.join(',')}]` : '';
        return `\\begin{lstlisting}${paramsStr}\n${cleanCode}\\end{lstlisting}`;
      }

      case 'heading': {
        const hDepth = node.depth;
        const hTitle = compileChildren(node.children, node, depth).join('').trim();
        const cleanedTitle = this.stripManualNumbering
          ? hTitle.replace(/^(\d+(?:\.\d+)*[\)\.]?\s+|\d+[â£ï¿½]\s*\.\s*)/, '')
          : hTitle;

        const rawText = getPlainText(node).trim();
        const label = headingLabels.get(rawText);

        let cmd = 'section';
        if (hDepth === 2) cmd = 'subsection';
        else if (hDepth >= 3) cmd = 'subsubsection';

        if (label) {
          return `\\${cmd}{${cleanedTitle}}\\label{${label}}`;
        }
        return `\\${cmd}{${cleanedTitle}}`;
      }

      case 'list': {
        const listType = node.ordered ? 'enumerate' : 'itemize';
        const body = compileChildren(node.children, node, depth).join('\n');
        return `\\begin{${listType}}\n${body}\n\\end{${listType}}`;
      }

      case 'listItem': {
        const check = node.checked;
        let prefix = '\\item ';
        if (check !== null && check !== undefined) {
          prefix = check ? '\\item[\\checkmark] ' : '\\item[\\square] ';
        }

        const compiled = node.children.map((c: any, index: number) => {
          c.parent = node;
          const content = this.compileNode(c, node, depth, headingLabels, footnoteDefinitionsMap);
          if (c.type === 'paragraph' && index === 0) {
            return content.trim();
          }
          return content;
        }).join('\n');

        return `${prefix}${compiled}`;
      }

      case 'link': {
        const url = node.url || '';
        const text = compileChildren(node.children, node, depth).join('');
        if (url.startsWith('#')) {
          const headingText = url.substring(1);
          const label = headingLabels.get(decodeURIComponent(headingText)) || headingLabels.get(headingText) || headingText;
          return `\\hyperref[${label}]{${text}}`;
        }
        const escapedUrl = url
          .replace(/%/g, '\\%')
          .replace(/#/g, '\\#')
          .replace(/_/g, '\\_')
          .replace(/&/g, '\\&');
        return `\\href{${escapedUrl}}{${text}}`;
      }

      case 'footnoteReference': {
        const id = node.identifier;
        const def = footnoteDefinitionsMap.get(id) || '';
        return `\\footnote{${def}}`;
      }

      case 'footnoteDefinition':
        return '';

      case 'math':
        return `\n\\[${node.value.trim()}\\]\n`;

      case 'inlineMath':
        return `$${node.value.trim()}$`;

      case 'table': {
        const headerRow = node.children[0];
        const numCols = headerRow ? headerRow.children.length : 0;
        if (numCols === 0) return '';

        const colWidth = `\\dimexpr\\textwidth/${numCols}-2\\tabcolsep-\\arrayrulewidth\\relax`;
        const colSpec = Array(numCols).fill(`p{${colWidth}}`).join('|');

        let latex = `\n\\vspace{1em}\n`;
        latex += `\\renewcommand{\\arraystretch}{1.5}\n`;
        latex += `\\begin{tabular}{|${colSpec}|}\n\\hline\n`;

        const rows = node.children.map((rowNode: any) => {
          const cells = rowNode.children.map((cellNode: any) => {
            return compileChildren(cellNode.children, cellNode, depth).join('').trim();
          }).join(' & ');
          return `${cells} \\\\\n\\hline`;
        }).join('\n');

        latex += rows + '\n';
        latex += '\\end{tabular}\n';
        latex += `\\renewcommand{\\arraystretch}{1}\n`;
        latex += '\\vspace{1em}\n';
        return latex;
      }

      case 'containerDirective': {
        const directiveName = node.name;
        const colors: Record<string, string> = {
          tip: 'green',
          note: 'blue',
          info: 'cyan',
          warning: 'yellow',
          danger: 'red',
        };
        const color = colors[directiveName] || 'gray';

        const icons: Record<string, string> = {
          tip: '\\faLightbulb',
          note: '\\faInfoCircle',
          info: '\\faInfoCircle',
          warning: '\\faExclamationTriangle',
          danger: '\\faExclamationCircle',
        };
        const icon = icons[directiveName] || '\\faInfoCircle';

        let titleText = directiveName;
        let contentChildren = node.children;

        if (node.children.length > 0 && node.children[0].data?.directiveLabel) {
          titleText = compileChildren(node.children[0].children, node.children[0], depth).join('').trim();
          contentChildren = node.children.slice(1);
        }

        const titleWithIcon = `${icon} ${titleText}`;

        const boxOptions = depth > 0
          ? `[colback=${color}!5!white,colframe=${color}!75!black,title=${titleWithIcon},sharp corners,nobeforeafter,boxrule=0.5pt]`
          : `[colback=${color}!5!white,colframe=${color}!75!black,title=${titleWithIcon}]`;

        const body = compileChildren(contentChildren, node, depth + 1).join('\n\n');
        return `\\begin{tcolorbox}${boxOptions}\n${body}\n\\end{tcolorbox}`;
      }

      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement': {
        const elName = node.name;
        if (elName === 'br') {
          return '\\\\';
        }
        if (elName === 'strong' || elName === 'b') {
          return `\\textbf{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 'em' || elName === 'i') {
          return `\\textit{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 'code') {
          return `\\texttt{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 'details') {
          let summaryText = 'Details';
          let bodyChildren = node.children;
          const summaryNode = node.children.find((c: any) => c.name === 'summary' || (c.type === 'mdxJsxFlowElement' && c.name === 'summary'));
          if (summaryNode) {
            summaryText = getPlainText(summaryNode).trim();
            bodyChildren = node.children.filter((c: any) => c !== summaryNode);
          }
          const body = compileChildren(bodyChildren, node, depth).join('\n\n');
          return `\\begin{tcolorbox}[title=${summaryText}]\n${body}\n\\end{tcolorbox}`;
        }
        if (elName === 'Tabs') {
          return compileChildren(node.children, node, depth).join('\n\n');
        }
        if (elName === 'TabItem') {
          const labelAttr = node.attributes?.find((a: any) => a.name === 'label');
          const label = labelAttr ? labelAttr.value : '';
          const body = compileChildren(node.children, node, depth).join('\n\n');
          return `\\textbf{${label}:} ${body}`;
        }
        if (elName === 'DocCardList') {
          const itemsAttr = node.attributes?.find((a: any) => a.name === 'items');
          if (itemsAttr && itemsAttr.value) {
            try {
              let items: any[] = [];
              if (typeof itemsAttr.value === 'string') {
                items = JSON.parse(itemsAttr.value.replace(/'/g, '"'));
              } else if (itemsAttr.value.value) {
                items = JSON.parse(itemsAttr.value.value.replace(/'/g, '"'));
              }
              return `\\begin{itemize}\n${items.map(item => `\\item ${item.label || ''}`).join('\n')}\n\\end{itemize}`;
            } catch {
              return '';
            }
          }
          return '';
        }
        if (elName === 'DocCard') {
          const labelAttr = node.attributes?.find((a: any) => a.name === 'label');
          const descAttr = node.attributes?.find((a: any) => a.name === 'description');
          const label = labelAttr ? String(labelAttr.value) : '';
          const description = descAttr ? String(descAttr.value) : '';
          return description ? `\\textbf{${label}} - ${description}` : `\\textbf{${label}}`;
        }

        // custom dl/dt/dd definitions
        if (elName === 'dl') {
          return `\\begin{description}\n${compileChildren(node.children, node, depth).join('\n')}\n\\end{description}`;
        }
        if (elName === 'dt') {
          return `\\item[${compileChildren(node.children, node, depth).join('')}]`;
        }
        if (elName === 'dd') {
          return ` ${compileChildren(node.children, node, depth).join('')}`;
        }

        return compileChildren(node.children, node, depth).join('');
      }

      case 'html': {
        const htmlVal = node.value.trim();
        if (htmlVal.startsWith('<!--')) return '';

        if (htmlVal === '<br>' || htmlVal === '<br/>' || htmlVal === '<br />') {
          return '\\\\';
        }
        if (htmlVal === '<strong>' || htmlVal === '<b>') {
          return '\\textbf{';
        }
        if (htmlVal === '</strong>' || htmlVal === '</b>') {
          return '}';
        }
        if (htmlVal === '<em>' || htmlVal === '<i>') {
          return '\\textit{';
        }
        if (htmlVal === '</em>' || htmlVal === '</i>') {
          return '}';
        }
        if (htmlVal.startsWith('<code')) {
          return '\\texttt{';
        }
        if (htmlVal === '</code>') {
          return '}';
        }

        if (htmlVal.startsWith('<details>')) {
          const summaryMatch = htmlVal.match(/<summary>([^<]*)<\/summary>/i);
          const summaryText = summaryMatch ? summaryMatch[1].trim() : 'Details';
          return `\\begin{tcolorbox}[title=${summaryText}]\n`;
        }
        if (htmlVal === '</details>') {
          return '\n\\end{tcolorbox}';
        }

        return '';
      }

      case 'mdxFlowExpression':
      case 'mdxTextExpression': {
        const val = (node.value || '').trim();
        if (val.startsWith('/*') && val.endsWith('*/')) {
          return '';
        }
        if (val.startsWith('{') && val.endsWith('}')) {
          const inner = val.slice(1, -1).trim();
          return `{{ ${this.escapeLatex(inner)} }}`;
        }
        return `{{ ${this.escapeLatex(val)} }}`;
      }

      default:
        return node.children ? compileChildren(node.children, node, depth).join('') : '';
    }
  }

  private compileChildren(children: any[], parentNode: any, currentDepth: number, headingLabels: Map<string, string>, footnoteDefinitionsMap: Map<string, string>): string[] {
    if (!children) return [];
    const results: string[] = [];

    for (let idx = 0; idx < children.length; idx++) {
      const child = children[idx];
      child.parent = parentNode;

      // Image caption and size pairing logic
      let isImageParagraph = false;
      let imageNode: any = null;
      let sizeSpec = '';

      if (child.type === 'paragraph') {
        const imageIdx = child.children.findIndex((c: any) => c.type === 'image');
        if (imageIdx !== -1) {
          isImageParagraph = true;
          imageNode = child.children[imageIdx];

          // Check next element inside paragraph for size attribute {width=X%}
          if (imageIdx + 1 < child.children.length) {
            const nextNode = child.children[imageIdx + 1];
            if (nextNode.type === 'text' && nextNode.value.trim().startsWith('{') && nextNode.value.trim().endsWith('}')) {
              sizeSpec = nextNode.value.trim().slice(1, -1);
            }
          }
        }
      }

      if (isImageParagraph && imageNode) {
        const filename = imageNode.url.replace(/^.*[\\/]/, '');
        const imageTitle = imageNode.title || '';

        let caption = imageTitle || '';
        let hasNextCaption = false;

        // Check next sibling paragraph for Obrázek/Figure text caption
        if (idx + 1 < children.length) {
          const nextSibling = children[idx + 1];
          if (nextSibling.type === 'paragraph') {
            const siblingText = this.getPlainText(nextSibling).trim();
            if (siblingText.startsWith('Obrázek') || siblingText.startsWith('Figure') || siblingText.startsWith('Obrázek:') || siblingText.startsWith('Figure:')) {
              caption = siblingText;
              hasNextCaption = true;
              idx++; // consume caption sibling
            }
          }
        }

        const captionCmd = this.suppressCaptionNumbers ? '\\caption*' : '\\caption';
        const includeGraphics = this.buildIncludeGraphics(filename, sizeSpec);
        let figureContent = `\\begin{figure}[H]\n\\centering\n${includeGraphics}\n`;
        if (caption) {
          const escapedCaption = this.escapeLatex(caption);
          figureContent += `${captionCmd}{${escapedCaption}}\n`;
        }
        figureContent += `\\end{figure}`;
        results.push(figureContent);
        continue;
      }

      results.push(this.compileNode(child, parentNode, currentDepth, headingLabels, footnoteDefinitionsMap));
    }

    return results;
  }

  /**
   * The leading H1 is only treated as the page title when it is the first
   * non-blank line of the document (mirrors Docusaurus's contentTitle).
   * Matching anywhere would corrupt e.g. "# comment" lines in code blocks.
   */
  private matchLeadingHeading(content: string): { title: string; rest: string } | null {
    const match = content.match(/^(?:[ \t]*\r?\n)* {0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*(\r?\n|$)([\s\S]*)$/);
    if (!match) return null;
    return { title: match[1].trim(), rest: match[3] };
  }

  private extractTitle(content: string): string {
    const match = this.matchLeadingHeading(content);
    return match ? match.title : 'Untitled';
  }

  private removeFirstHeading(content: string): string {
    const match = this.matchLeadingHeading(content);
    return match ? match.rest.replace(/^\n+/, '') : content;
  }

  private simpleHash(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  private getPlainText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.value || '';
    if (node.value) return node.value;
    if (node.children) return node.children.map((c: any) => this.getPlainText(c)).join('');
    return '';
  }

  private processSpecialText(val: string): string {
    const regex = /(:::glossary:::(.+?):::(.+?):::|:::bib:::(.+?):::(.+?):::|:::index:::(.+?):::|\[@([^\]]+)\])/g;
    
    let lastIndex = 0;
    let result = '';
    let match;
    
    while ((match = regex.exec(val)) !== null) {
      const textBefore = val.slice(lastIndex, match.index);
      result += this.escapeTextAndEmoji(textBefore);
      
      if (match[0].startsWith(':::glossary:::')) {
        const term = match[2];
        const definition = match[3];
        result += `\\newglossaryentry{${term.replace(/\s+/g, '-')}}{name={${term}},description={${definition}}}`;
      } else if (match[0].startsWith(':::bib:::')) {
        const key = match[4];
        const details = match[5];
        result += `\\bibitem{${key}} ${details}`;
      } else if (match[0].startsWith(':::index:::')) {
        const term = match[6];
        result += `\\index{${term}}`;
      } else if (match[0].startsWith('[@')) {
        const key = match[7];
        result += `\\cite{${key}}`;
      }
      
      lastIndex = regex.lastIndex;
    }
    
    const textAfter = val.slice(lastIndex);
    result += this.escapeTextAndEmoji(textAfter);
    
    return result;
  }

  private escapeTextAndEmoji(text: string): string {
    let escaped = this.escapeLatex(text);
    if (this.useEmojiCommands) {
      escaped = this.convertEmojiToLatexCommand(escaped);
    } else if (this.convertEmoji) {
      escaped = this.convertEmojiToText(escaped);
    }
    if (this.useVlna) {
      escaped = applyVlna(escaped);
    }
    return escaped;
  }

  private extractFrontmatter(source: string): { content: string; frontmatter: Record<string, unknown> } {
    const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (match) {
      try {
        const frontmatter = YAML.parse(match[1]) || {};
        return { content: match[2], frontmatter };
      } catch {
        return { content: source, frontmatter: {} };
      }
    }
    return { content: source, frontmatter: {} };
  }
}
