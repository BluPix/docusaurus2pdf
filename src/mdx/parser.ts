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

interface ParseContext {
  /** All heading anchor slugs defined on the current page. */
  anchors: Set<string>;
  footnoteDefs: Map<string, string>;
  definitions: Map<string, { url: string; title?: string }>;
}

export class MDXParser {
  private stripManualNumbering: boolean = false;
  private convertEmoji: boolean = false;
  private useEmojiCommands: boolean = false;
  private suppressCaptionNumbers: boolean = false;
  private useVlna: boolean = false;
  private ctx: ParseContext = {
    anchors: new Set(),
    footnoteDefs: new Map(),
    definitions: new Map(),
  };
  private static readonly SECTION_LADDER = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];

  private enableMath: boolean = true;
  private currentDocDir: string = '';
  private currentLabelPrefix: string = '';
  private currentBaseLevel: number = 0;
  private knownDocs?: Set<string>;
  private remoteImages: Array<{ url: string; filename: string }> = [];

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
    if ('knownDocs' in opts) {
      this.knownDocs = opts.knownDocs;
    }
    if (opts.enableMath !== undefined) {
      this.enableMath = opts.enableMath;
    }
  }

  /**
   * Docusaurus-compatible slug (github-slugger keeps Unicode letters, so
   * Czech anchors like #úvod-do-systému must keep their diacritics).
   */
  static slugify(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s+/g, '-');
  }

  /** Canonical document key shared between labels and cross-doc links. */
  static canonicalDocKey(docPath: string): string {
    const parts: string[] = [];
    for (const p of docPath.replace(/\\/g, '/').replace(/\.(mdx?|MDX?)$/, '').split('/')) {
      if (!p || p === '.') continue;
      if (p === '..') {
        parts.pop();
        continue;
      }
      parts.push(p);
    }
    return parts.join('__');
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

  /**
   * Docusaurus explicit heading anchors: "## Title {#custom-id}".
   * In MDX mode the trailing "{#custom-id}" arrives as an mdxTextExpression
   * child; in fallback mode it is part of the trailing text node. Either way
   * it must be removed from the rendered title and used as the anchor.
   */
  private extractExplicitHeadingId(node: any): string | null {
    const children = node.children || [];
    if (children.length === 0) return null;
    const last = children[children.length - 1];

    if (last.type === 'mdxTextExpression') {
      const val = (last.value || '').trim();
      const m = val.match(/^#([^\s{}]+)$/);
      if (m) {
        children.pop();
        // trim trailing whitespace of the preceding text node
        const prev = children[children.length - 1];
        if (prev && prev.type === 'text') prev.value = prev.value.replace(/\s+$/, '');
        return m[1];
      }
      return null;
    }

    if (last.type === 'text') {
      const m = (last.value || '').match(/^(.*?)\s*\{#([^\s{}]+)\}\s*$/);
      if (m) {
        if (m[1]) {
          last.value = m[1];
        } else {
          children.pop();
        }
        return m[2];
      }
    }

    return null;
  }

  private getJsxAttr(node: any, name: string): string | undefined {
    const attr = node.attributes?.find((a: any) => a.name === name);
    if (!attr) return undefined;
    if (typeof attr.value === 'string') return attr.value;
    if (attr.value && typeof attr.value.value === 'string') return attr.value.value;
    return undefined;
  }

  private buildHref(url: string, text: string): string {
    // Same-page anchor
    if (url.startsWith('#')) {
      const anchor = this.resolveAnchorSlug(decodeURIComponent(url.substring(1)));
      return `\\hyperref[${this.currentLabelPrefix}${anchor}]{${text}}`;
    }

    // Protocol-relative URL is external
    if (url.startsWith('//')) {
      return `\\href{https:${url.replace(/%/g, '\\%').replace(/#/g, '\\#').replace(/_/g, '\\_').replace(/&/g, '\\&')}}{${text}}`;
    }

    // Cross-document link (./other.md, ../dir/doc.mdx, /docs/foo#bar)
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
      const resolved = this.resolveDocLink(url);
      if (resolved) {
        return `\\hyperref[${resolved}]{${text}}`;
      }
      // Unresolvable internal link: keep the text, drop the dead URL
      return text;
    }

    const escapedUrl = url
      .replace(/%/g, '\\%')
      .replace(/#/g, '\\#')
      .replace(/_/g, '\\_')
      .replace(/&/g, '\\&');
    return `\\href{${escapedUrl}}{${text}}`;
  }

  /** Match a written anchor against the page's heading slugs. */
  private resolveAnchorSlug(anchor: string): string {
    if (this.ctx.anchors.has(anchor)) return anchor;
    const slugged = MDXParser.slugify(anchor);
    if (this.ctx.anchors.has(slugged)) return slugged;
    return anchor;
  }

  /**
   * Resolve a relative or site-absolute doc link to a LaTeX label.
   * Returns null when the target is not part of this build.
   */
  private resolveDocLink(url: string): string | null {
    const [pathPartRaw, anchorRaw] = url.split('#');
    let pathPart = decodeURIComponent(pathPartRaw || '');
    const anchor = anchorRaw ? MDXParser.slugify(decodeURIComponent(anchorRaw)) : '';

    if (!pathPart) {
      // "#..." handled by caller; bare empty url
      return null;
    }

    if (pathPart.startsWith('/')) {
      // Site-absolute: strip the routeBasePath segment (usually /docs)
      pathPart = pathPart.replace(/^\/+/, '').replace(/^docs\//, '');
    } else {
      pathPart = this.currentDocDir ? `${this.currentDocDir}/${pathPart}` : pathPart;
    }

    const canonical = MDXParser.canonicalDocKey(pathPart.replace(/\/+$/, ''));
    if (!canonical) return null;

    if (this.knownDocs) {
      const candidates = [canonical, `${canonical}__index`, `${canonical}__README`];
      const found = candidates.find((c) => this.knownDocs!.has(c));
      if (!found) return null;
      return anchor ? `${found}:${anchor}` : `doc:${found}`;
    }

    // No registry available (direct API use): resolve optimistically
    return anchor ? `${canonical}:${anchor}` : `doc:${canonical}`;
  }

  /**
   * Map an image URL to the flat img/ directory used in the LaTeX output.
   * The mapping must stay in sync with Renderer.copyStaticAssets:
   * - relative URLs are resolved against the doc's directory and flattened
   *   with "__" (collision-free, unlike plain basenames)
   * - "/..." and "@site/..." resolve against the static/ dir or site root
   * - remote URLs get a hash-based name; the renderer downloads them
   * - SVG -> PDF, GIF/WebP/AVIF -> PNG (the renderer converts)
   */
  private imageUrlToLatexPath(url: string): string {
    const clean = url.split(/[?#]/)[0];

    if (/^https?:\/\//i.test(clean)) {
      const extMatch = clean.match(/\.[a-z0-9]+$/i);
      const ext = extMatch ? extMatch[0].toLowerCase() : '.png';
      const finalName = MDXParser.rewriteImageExt(`remote_${this.simpleHash(url)}${ext}`);
      if (!this.remoteImages.some((r) => r.url === url)) {
        this.remoteImages.push({ url, filename: finalName });
      }
      return `img/${finalName}`;
    }

    return `img/${MDXParser.flattenImagePath(clean, this.currentDocDir)}`;
  }

  static rewriteImageExt(name: string): string {
    return name.replace(/\.svg$/i, '.pdf').replace(/\.(gif|webp|avif)$/i, '.png');
  }

  /** Flatten a doc-relative or site-absolute image path to a unique filename. */
  static flattenImagePath(urlPath: string, docDir: string): string {
    let joined: string;
    if (urlPath.startsWith('@site/')) {
      joined = urlPath.slice('@site/'.length);
    } else if (urlPath.startsWith('/')) {
      joined = `static${urlPath}`;
    } else {
      joined = docDir ? `${docDir}/${urlPath}` : urlPath;
    }

    const parts: string[] = [];
    for (const p of joined.replace(/\\/g, '/').split('/')) {
      if (!p || p === '.') continue;
      if (p === '..') {
        parts.pop();
        continue;
      }
      parts.push(p);
    }
    return MDXParser.rewriteImageExt(parts.join('__'));
  }

  /**
   * Emit graphics inclusion wrapped in \docimage (defined in the preamble),
   * which caps size at the text block while keeping small images at natural
   * size, and typesets a visible placeholder when the file is missing.
   */
  private buildIncludeGraphics(url: string, size?: string): string {
    const texPath = this.imageUrlToLatexPath(url);
    if (size) {
      const widthMatch = size.match(/width=(\d+)\s*%/);
      if (widthMatch) {
        const percent = parseInt(widthMatch[1], 10) / 100;
        return `\\docimage[width=${percent}\\textwidth]{${texPath}}`;
      }
      const pxMatch = size.match(/width=(\d+)(px)?\s*$/);
      if (pxMatch) {
        // CSS px -> pt (96dpi -> 72.27pt/in); px is not a XeTeX unit
        const pt = (parseInt(pxMatch[1], 10) * 0.75).toFixed(1);
        return `\\docimage[width=${pt}pt]{${texPath}}`;
      }
    }
    return `\\docimage{${texPath}}`;
  }

  /**
   * @param docDir directory of the document relative to the docs root
   *               (POSIX style, e.g. "api/core"); used to resolve image paths
   * @param labelPrefix unique per-document prefix for LaTeX labels so that
   *               headings with the same text on different pages don't clash
   * @param baseLevel 0-based sectioning index of the page title itself
   *               (0 = \section); content headings nest below it
   */
  async parse(source: string, docDir: string = '', labelPrefix: string = '', baseLevel: number = 0): Promise<ParsedPage> {
    this.currentDocDir = docDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    this.currentLabelPrefix = labelPrefix ? `${labelPrefix}:` : '';
    this.currentBaseLevel = Math.max(0, baseLevel);
    this.remoteImages = [];
    const { content, frontmatter } = this.extractFrontmatter(source);
    const processedContent = this.preprocessContent(content, frontmatter);
    const contentWithoutTitle = this.removeFirstHeading(processedContent);
    const title = String(frontmatter.title || this.extractTitle(processedContent));

    const plantumlDiagrams: Array<{ hash: string; code: string }> = [];
    const mermaidDiagrams: Array<{ hash: string; code: string }> = [];

    // remark-math is enabled only when the site actually uses math
    // (KaTeX); otherwise "$5 and $10" in prose would be eaten as a formula
    const mathPlugins: any[] = this.enableMath ? [remarkMath] : [];

    let ast: any;
    try {
      let processor = remark().use(remarkFrontmatter).use(remarkGfm);
      for (const plugin of mathPlugins) processor = processor.use(plugin);
      ast = processor.use(remarkDirective).use(remarkMdx).parse(contentWithoutTitle);
    } catch (err) {
      console.warn('MDX parse warning, falling back to standard Markdown parser:', err);
      let processor = remark().use(remarkFrontmatter).use(remarkGfm);
      for (const plugin of mathPlugins) processor = processor.use(plugin);
      ast = processor.use(remarkDirective).parse(contentWithoutTitle);
    }

    visit(ast, 'code', (node: any) => {
      const code = node.value || '';
      if (node.lang === 'plantuml') {
        plantumlDiagrams.push({ hash: this.simpleHash(code), code });
      } else if (node.lang === 'mermaid') {
        mermaidDiagrams.push({ hash: this.simpleHash(code), code });
      }
    });

    // Assign a Docusaurus-compatible slug to every heading. Explicit
    // {#custom-id} anchors win; duplicates get -1, -2... suffixes. The slug
    // is stored on the node itself so repeated heading texts cannot clash.
    const anchors = new Set<string>();
    const usedSlugs = new Map<string, number>();

    visit(ast, 'heading', (node: any) => {
      const explicitId = this.extractExplicitHeadingId(node);
      let slug = explicitId ?? MDXParser.slugify(this.getPlainText(node));
      if (!explicitId) {
        const count = usedSlugs.get(slug) || 0;
        usedSlugs.set(slug, count + 1);
        if (count > 0) slug = `${slug}-${count}`;
      }
      node.data = { ...node.data, d2pSlug: slug };
      anchors.add(slug);
    });

    // Reference-style link/image definitions ([ref]: https://...)
    const definitions = new Map<string, { url: string; title?: string }>();
    visit(ast, 'definition', (node: any) => {
      definitions.set(node.identifier, { url: node.url || '', title: node.title || undefined });
    });

    this.ctx = { anchors, footnoteDefs: new Map(), definitions };

    visit(ast, 'footnoteDefinition', (node: any) => {
      // depth 1: footnote text cannot contain page-breaking environments
      const compiled = node.children.map((c: any) => this.compileNode(c, node, 1)).join('\n\n').trim();
      this.ctx.footnoteDefs.set(node.identifier, compiled);
    });

    const latexContent = this.compileNode(ast, null, 0);

    return {
      Title: title,
      Content: latexContent,
      Frontmatter: frontmatter,
      PlantUMLDiagrams: plantumlDiagrams,
      MermaidDiagrams: mermaidDiagrams,
      RemoteImages: this.remoteImages,
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

      const indent = start[1];
      const runIndices: number[] = [i];
      let j = i + 1;
      while (j < lines.length) {
        if (lines[j].trim() === '') {
          let k = j;
          while (k < lines.length && lines[k].trim() === '') {
            k++;
          }
          if (k < lines.length) {
            const m = lines[k].match(itemRegex);
            if (m && m[1] === indent) {
              j = k;
              continue;
            }
          }
          break;
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

      const firstIdx = runIndices[0];
      const lastIdx = runIndices[runIndices.length - 1];
      lines[firstIdx] = `<lettered-list>\n\n${lines[firstIdx]}`;
      lines[lastIdx] = `${lines[lastIdx]}\n\n</lettered-list>`;

      i = lastIdx;
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

  private compileNode(node: any, parent: any, depth: number): string {
    if (!node) return '';

    const getPlainText = (n: any): string => this.getPlainText(n);
    const compileChildren = (children: any[], parentNode: any, currentDepth: number): string[] =>
      this.compileChildren(children, parentNode, currentDepth);

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
        // quote environment with italic shape - block children (paragraphs,
        // lists) keep their structure instead of being glued into \textit
        return `\\begin{quote}\\itshape\n${compileChildren(node.children, node, depth + 1).join('\n\n')}\n\\end{quote}`;

      case 'break':
        return '\\\\';

      case 'thematicBreak':
        return '\\begin{center}\\rule{0.45\\linewidth}{0.4pt}\\end{center}';

      case 'inlineCode': {
        return `\\texttt{${this.escapeLatex(node.value)}}`;
      }

      case 'code': {
        const lang = node.lang || '';
        const code = node.value || '';
        const meta = node.meta || '';

        if (lang === 'plantuml') {
          const hash = this.simpleHash(code);
          return `\\begin{center}\\docimage[width=0.8\\textwidth]{img/plantuml_${hash}.eps}\\end{center}`;
        }
        if (lang === 'mermaid') {
          const hash = this.simpleHash(code);
          return `\\begin{center}\\docimage[width=0.8\\textwidth]{img/mermaid_${hash}.pdf}\\end{center}`;
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
            if (braceContent.match(/^\d+-\d+$/)) {
              lineRange = braceContent;
            } else {
              highlightLines = braceContent;
            }
          }
        }

        let cleanCode = code;
        if (lineRange) {
          const [start, end] = lineRange.split('-').map(Number);
          const codeLines = code.split('\n');
          cleanCode = codeLines.slice(start - 1, end).join('\n');
        }

        const highlightCommentResult = this.parseHighlightComments(cleanCode);
        cleanCode = highlightCommentResult.cleanCode;
        let highlightedLines = highlightCommentResult.highlightedLines;

        if (highlightLines) {
          const metaLines = this.parseMetadataHighlight(highlightLines);
          highlightedLines = Array.from(new Set([...highlightedLines, ...metaLines])).sort((a, b) => a - b);
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

        const codeBody = cleanCode.endsWith('\n') ? cleanCode : `${cleanCode}\n`;
        const hasNonLatin = /[^\t-\r -ӿḀ-ỿ–—‘-‟…]/u.test(cleanCode);
        const useVerbatim = highlightedLines.length > 0 || hasNonLatin;

        if (useVerbatim) {
          const vparams = ['breaklines=true', 'frame=single', 'rulecolor=\\color{black!20}', 'fontsize=\\footnotesize'];
          if (showLineNumbers) vparams.push('numbers=left');
          if (highlightedLines.length > 0) {
            vparams.push(`highlightlines={${this.formatHighlightLines(highlightedLines)}}`);
          }
          const titleStr = blockTitle ? `\\noindent\\textbf{${this.escapeLatex(blockTitle)}}\\\\*\\vspace{-0.5em}\n` : '';
          return `${titleStr}\\begin{Verbatim}[${vparams.join(',')}]\n${codeBody}\\end{Verbatim}`;
        }

        const params: string[] = [];
        if (mappedLang && supportedListingsLangs.has(mappedLang)) {
          params.push(`language=${mappedLang}`);
        }

        if (showLineNumbers) {
          params.push('numbers=left');
        }

        if (blockTitle) {
          const safeTitle = this.escapeLatex(blockTitle)
            .replace(/\[/g, '{[}')
            .replace(/\]/g, '{]}');
          params.push(`caption={${safeTitle}}`);
        }

        const paramsStr = params.length > 0 ? `[${params.join(',')}]` : '';
        return `\\begin{lstlisting}${paramsStr}\n${codeBody}\\end{lstlisting}`;
      }

      case 'heading': {
        const hDepth = node.depth;
        const hTitle = compileChildren(node.children, node, depth).join('').trim();
        const cleanedTitle = this.stripManualNumbering
          ? hTitle.replace(/^(\d+(?:\.\d+)*[\)\.]?\s+|\d+[â£ï¿½]\s*\.\s*)/, '')
          : hTitle;

        const slug = node.data?.d2pSlug;

        // Content headings nest one level below the page title; h2 is the
        // top content level in Docusaurus (h1 is the page title), and a
        // stray in-body h1 maps to the same level as h2 instead of
        // colliding with the page title's section level.
        const idx = Math.min(this.currentBaseLevel + Math.max(1, hDepth - 1), MDXParser.SECTION_LADDER.length - 1);
        const cmd = MDXParser.SECTION_LADDER[idx];

        if (slug) {
          return `\\${cmd}{${cleanedTitle}}\\label{${this.currentLabelPrefix}${slug}}`;
        }
        return `\\${cmd}{${cleanedTitle}}`;
      }

      case 'list': {
        const isLettered = node.parent &&
          (node.parent.type === 'mdxJsxFlowElement' || node.parent.type === 'html' || node.parent.type === 'mdxJsxTextElement') &&
          node.parent.name === 'lettered-list';
        
        const body = compileChildren(node.children, node, depth + 1).join('\n');
        if (isLettered) {
          return `\\begin{enumerate}[label=\\alph*)]\n${body}\n\\end{enumerate}`;
        }
        const listType = node.ordered ? 'enumerate' : 'itemize';
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
          const content = this.compileNode(c, node, depth);
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
        return this.buildHref(url, text);
      }

      case 'image':
        // Inline image (inside a paragraph with text, a link, a table cell...).
        // Image-only paragraphs are turned into figures in compileChildren.
        return this.buildIncludeGraphics(node.url || '');

      case 'imageReference': {
        const def = this.ctx.definitions.get(node.identifier);
        if (def) {
          return this.buildIncludeGraphics(def.url);
        }
        // Unresolved reference: render as Docusaurus would (literal text)
        return this.escapeTextAndEmoji(`![${node.alt || ''}][${node.identifier}]`);
      }

      case 'linkReference': {
        const def = this.ctx.definitions.get(node.identifier);
        const refText = compileChildren(node.children, node, depth).join('');
        if (def) {
          return this.buildHref(def.url, refText);
        }
        return refText;
      }

      case 'definition':
        return '';

      case 'delete':
        return `\\sout{${compileChildren(node.children, node, depth).join('')}}`;

      case 'footnoteReference': {
        const id = node.identifier;
        const def = this.ctx.footnoteDefs.get(id) || '';
        return `\\footnote{${def}}`;
      }

      case 'footnoteDefinition':
        return '';

      case 'math': {
        const mathValue = (node.value || '').trim();
        // Display environments must not be wrapped in \[...\]
        if (/^\\begin\{(align|align\*|gather|gather\*|alignat|alignat\*|equation|equation\*|eqnarray|multline|multline\*)\}/.test(mathValue)) {
          return `\n${mathValue}\n`;
        }
        // KaTeX allows line breaks in display math; plain \[...\] does not
        if (mathValue.includes('\\\\') && !mathValue.includes('\\begin{')) {
          return `\n\\begin{gather*}\n${mathValue}\n\\end{gather*}\n`;
        }
        return `\n\\[${mathValue}\\]\n`;
      }

      case 'inlineMath':
        return `$${node.value.trim()}$`;

      case 'table': {
        const headerRow = node.children[0];
        const numCols = headerRow ? headerRow.children.length : 0;
        if (numCols === 0) return '';

        // Column alignment from the |:--|:-:|--:| markers
        const colWidth = `\\dimexpr\\textwidth/${numCols}-2\\tabcolsep-\\arrayrulewidth\\relax`;
        const alignPrefix = (align: string | null): string => {
          if (align === 'center') return '>{\\centering\\arraybackslash}';
          if (align === 'right') return '>{\\raggedleft\\arraybackslash}';
          return '>{\\raggedright\\arraybackslash}';
        };
        const aligns: Array<string | null> = node.align || [];
        const colSpec = Array.from({ length: numCols }, (_, i) =>
          `${alignPrefix(aligns[i] ?? null)}p{${colWidth}}`
        ).join('|');

        const compileRow = (rowNode: any, bold: boolean): string => {
          const cells = rowNode.children.map((cellNode: any) => {
            const cell = compileChildren(cellNode.children, cellNode, depth).join('').trim();
            return bold ? `\\textbf{${cell}}` : cell;
          });
          // pad missing cells so ragged author rows still compile
          while (cells.length < numCols) cells.push('');
          return `${cells.slice(0, numCols).join(' & ')} \\\\\n\\hline`;
        };

        const headerLatex = compileRow(headerRow, true);
        const bodyLatex = node.children.slice(1).map((r: any) => compileRow(r, false)).join('\n');

        // longtable breaks across pages and repeats the header, but cannot
        // live inside boxes/lists - use tabular there
        if (depth > 0) {
          return [
            '',
            '\\vspace{1em}',
            '{\\renewcommand{\\arraystretch}{1.3}',
            `\\begin{tabular}{|${colSpec}|}`,
            '\\hline',
            headerLatex,
            bodyLatex,
            '\\end{tabular}}',
            '\\vspace{1em}',
            '',
          ].filter((l) => l !== '').join('\n');
        }

        return [
          '',
          '{\\renewcommand{\\arraystretch}{1.3}',
          `\\begin{longtable}{|${colSpec}|}`,
          '\\hline',
          headerLatex,
          '\\endfirsthead',
          '\\hline',
          headerLatex,
          '\\endhead',
          bodyLatex,
          '\\end{longtable}}',
          '',
        ].filter((l) => l !== '').join('\n');
      }

      case 'containerDirective': {
        // Docusaurus admonition aliases: caution -> warning; important -> info
        const aliasMap: Record<string, string> = { caution: 'warning', important: 'info' };
        const directiveName = aliasMap[node.name] || node.name;

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

        // Default title: original name capitalized (as Docusaurus shows it)
        let titleText = this.escapeLatex(node.name.charAt(0).toUpperCase() + node.name.slice(1));
        let contentChildren = node.children;

        if (node.children.length > 0 && node.children[0].data?.directiveLabel) {
          titleText = compileChildren(node.children[0].children, node.children[0], depth).join('').trim();
          contentChildren = node.children.slice(1);
        }

        // title must be brace-wrapped: commas or brackets in the text would
        // otherwise be parsed as pgfkeys option separators
        const titleWithIcon = `title={${icon}\\ ${titleText}}`;

        const boxOptions = depth > 0
          ? `[breakable,colback=${color}!5!white,colframe=${color}!75!black,${titleWithIcon},sharp corners,nobeforeafter,boxrule=0.5pt]`
          : `[breakable,colback=${color}!5!white,colframe=${color}!75!black,${titleWithIcon}]`;

        const body = compileChildren(contentChildren, node, depth + 1).join('\n\n');
        return `\\begin{tcolorbox}${boxOptions}\n${body}\n\\end{tcolorbox}`;
      }

      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement': {
        const elName = node.name;
        if (elName === 'br') {
          return '\\\\';
        }
        if (elName === 'lettered-list') {
          return compileChildren(node.children, node, depth).join('\n');
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
        if (elName === 'img') {
          const src = this.getJsxAttr(node, 'src');
          if (!src) return '';
          const width = this.getJsxAttr(node, 'width');
          let sizeSpec: string | undefined;
          if (width) {
            sizeSpec = width.endsWith('%') ? `width=${width}` : `width=${width.replace(/px$/, '')}px`;
          }
          const graphic = this.buildIncludeGraphics(src, sizeSpec);
          if (node.type === 'mdxJsxTextElement') {
            return graphic;
          }
          return `\\begin{figure}[H]\n\\centering\n${graphic}\n\\end{figure}`;
        }
        if (elName === 'a') {
          const href = this.getJsxAttr(node, 'href') || '';
          const text = compileChildren(node.children, node, depth).join('');
          return href ? this.buildHref(href, text) : text;
        }
        if (elName === 'sub') {
          return `\\textsubscript{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 'sup') {
          return `\\textsuperscript{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 'kbd') {
          return `\\fbox{\\footnotesize\\texttt{${compileChildren(node.children, node, depth).join('')}}}`;
        }
        if (elName === 'u' || elName === 'ins') {
          return `\\underline{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 's' || elName === 'del' || elName === 'strike') {
          return `\\sout{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 'mark') {
          return `\\colorbox{yellow!30}{${compileChildren(node.children, node, depth).join('')}}`;
        }
        if (elName === 'center') {
          return `\\begin{center}\n${compileChildren(node.children, node, depth).join('\n\n')}\n\\end{center}`;
        }
        if (elName === 'Admonition') {
          const type = this.getJsxAttr(node, 'type') || 'info';
          const title = this.getJsxAttr(node, 'title') || '';
          
          let titleText = title ? String(title) : type.charAt(0).toUpperCase() + type.slice(1);
          let color = 'blue';
          let icon = '\\faInfoCircle';
          
          if (type === 'tip') {
            color = 'green';
            icon = '\\faLightbulb';
          } else if (type === 'warning') {
            color = 'orange';
            icon = '\\faExclamationTriangle';
          } else if (type === 'danger') {
            color = 'red';
            icon = '\\faTimesCircle';
          } else if (type === 'note') {
            color = 'gray';
            icon = '\\faEdit';
          }

          let summaryText = titleText;
          let contentChildren = node.children;
          let summaryNode: any = null;
          let summaryParent: any = null;

          for (const c of node.children) {
            if (c.type === 'mdxJsxFlowElement' && c.name === 'summary') {
              summaryNode = c;
              break;
            }
            if (c.children && c.children.length > 0) {
              for (const inner of c.children) {
                if (inner.type === 'mdxJsxFlowElement' && inner.name === 'summary') {
                  summaryNode = inner;
                  summaryParent = c;
                  break;
                }
              }
            }
          }

          if (summaryNode) {
            summaryText = getPlainText(summaryNode).trim();
            contentChildren = node.children.filter((c: any) => c !== summaryNode && c !== summaryParent);
          }

          const body = compileChildren(contentChildren, node, depth + 1).join('\n\n');
          return `\\begin{tcolorbox}[breakable,title={${icon} ${this.escapeLatex(summaryText)},colback=${color}!5!white,colframe=${color}!75!black,sharp corners,boxrule=0.5pt}]\n${body}\n\\end{tcolorbox}`;
        }
        if (elName === 'video' || elName === 'iframe' || elName === 'audio') {
          const src = this.getJsxAttr(node, 'src') || '';
          const kind = elName.charAt(0).toUpperCase() + elName.slice(1);
          return src
            ? `\\textit{[${kind}: ${this.buildHref(src, this.escapeLatex(src))}]}`
            : `\\textit{[${kind}]}`;
        }
        if (elName === 'details') {
          let summaryText = 'Details';
          let bodyChildren = node.children;
          // <summary> may be a direct child or wrapped in a paragraph
          let summaryNode = node.children.find((c: any) => c.name === 'summary');
          let summaryParent: any = null;
          if (!summaryNode) {
            for (const c of node.children) {
              if (c.type === 'paragraph' && c.children) {
                const inner = c.children.find((cc: any) => cc.name === 'summary');
                if (inner) {
                  summaryNode = inner;
                  summaryParent = c;
                  break;
                }
              }
            }
          }
          if (summaryNode) {
            summaryText = this.escapeLatex(getPlainText(summaryNode).trim());
            bodyChildren = node.children.filter((c: any) => c !== summaryNode && c !== summaryParent);
          }
          const body = compileChildren(bodyChildren, node, depth).join('\n\n');
          return `\\begin{tcolorbox}[breakable,title={${summaryText}}]\n${body}\n\\end{tcolorbox}`;
        }
        if (elName === 'Tabs') {
          return compileChildren(node.children, node, depth).join('\n\n');
        }
        if (elName === 'TabItem') {
          const label = this.getJsxAttr(node, 'label') || this.getJsxAttr(node, 'value') || '';
          const body = compileChildren(node.children, node, depth).join('\n\n');
          return `\\begin{tcolorbox}[breakable,title={${this.escapeLatex(String(label))}},colback=black!2!white,colframe=black!30!white,boxrule=0.5pt,arc=1.5pt,coltitle=black,fonttitle=\\bfseries]\n${body}\n\\end{tcolorbox}`;
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
              return `\\begin{itemize}\n${items.map(item => `\\item ${this.escapeLatex(String(item.label || ''))}`).join('\n')}\n\\end{itemize}`;
            } catch {
              return '';
            }
          }
          return '';
        }
        if (elName === 'DocCard') {
          const label = this.escapeLatex(this.getJsxAttr(node, 'label') || '');
          const description = this.escapeLatex(this.getJsxAttr(node, 'description') || '');
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
          const summaryText = summaryMatch ? this.escapeLatex(summaryMatch[1].trim()) : 'Details';
          return `\\begin{tcolorbox}[breakable,title={${summaryText}}]\n`;
        }
        if (htmlVal === '</details>') {
          return '\n\\end{tcolorbox}';
        }

        // <img> in raw-HTML fallback mode: keep the image
        const imgMatch = htmlVal.match(/^<img\s[^>]*src=["']([^"']+)["'][^>]*\/?>$/i);
        if (imgMatch) {
          const widthMatch = htmlVal.match(/\swidth=["']([^"']+)["']/i);
          const sizeSpec = widthMatch
            ? (widthMatch[1].endsWith('%') ? `width=${widthMatch[1]}` : `width=${widthMatch[1].replace(/px$/, '')}px`)
            : undefined;
          const graphic = this.buildIncludeGraphics(imgMatch[1], sizeSpec);
          return `\\begin{figure}[H]\n\\centering\n${graphic}\n\\end{figure}`;
        }

        // <a href="...">text</a> on a single html node
        const aMatch = htmlVal.match(/^<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*)<\/a>$/i);
        if (aMatch) {
          return this.buildHref(aMatch[1], this.escapeTextAndEmoji(aMatch[2].replace(/<[^>]+>/g, '')));
        }
        if (htmlVal.match(/^<a\s/i)) {
          // opening <a> tag split from its text: drop the tag, keep the flow
          return '';
        }
        if (htmlVal === '</a>') {
          return '';
        }

        if (htmlVal === '<sub>') return '\\textsubscript{';
        if (htmlVal === '</sub>') return '}';
        if (htmlVal === '<sup>') return '\\textsuperscript{';
        if (htmlVal === '</sup>') return '}';
        if (htmlVal === '<kbd>') return '\\fbox{\\footnotesize\\texttt{';
        if (htmlVal === '</kbd>') return '}}';
        if (htmlVal === '<u>') return '\\underline{';
        if (htmlVal === '</u>') return '}';
        if (htmlVal === '<s>' || htmlVal === '<del>') return '\\sout{';
        if (htmlVal === '</s>' || htmlVal === '</del>') return '}';

        // Unknown HTML: strip tags but keep the text content rather than
        // silently dropping it.
        const stripped = htmlVal.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return stripped ? this.escapeTextAndEmoji(stripped) : '';
      }

      case 'mdxFlowExpression':
      case 'mdxTextExpression': {
        const val = (node.value || '').trim();
        // JSX comments
        if (val.startsWith('/*') && val.endsWith('*/')) {
          return '';
        }
        // String and number literals render their value
        const strMatch = val.match(/^['"`]([\s\S]*)['"`]$/);
        if (strMatch) {
          return this.escapeTextAndEmoji(strMatch[1]);
        }
        if (/^-?\d+(\.\d+)?$/.test(val)) {
          return val;
        }
        // "{{ name }}" is this tool's template-variable syntax; an
        // unresolved variable stays visible so authors can spot it
        const varMatch = val.match(/^\{\s*(\w+)\s*\}$/);
        if (varMatch) {
          return this.escapeTextAndEmoji(`{{ ${varMatch[1]} }}`);
        }
        // Dynamic expressions ({props.x}, {siteConfig.y}) cannot be
        // evaluated in a static export - dropping them beats printing
        // literal {{ ... }} garbage into the PDF
        return '';
      }

      default:
        return node.children ? compileChildren(node.children, node, depth).join('') : '';
    }
  }

  private compileChildren(children: any[], parentNode: any, currentDepth: number): string[] {
    if (!children) return [];
    const results: string[] = [];

    for (let idx = 0; idx < children.length; idx++) {
      const child = children[idx];
      child.parent = parentNode;

      // A paragraph consisting only of images (plus optional {width=X%} size
      // specs) becomes one figure per image. Paragraphs that mix text and
      // images are compiled normally - the images render inline and no text
      // is ever dropped.
      const figureImages = child.type === 'paragraph' ? this.extractFigureImages(child) : null;

      if (figureImages && figureImages.length > 0) {
        // A following "Obrázek ..." / "Figure ..." paragraph is used as the
        // caption when this paragraph holds a single image.
        let caption = figureImages.length === 1 ? (figureImages[0].title || '') : '';
        if (figureImages.length === 1 && idx + 1 < children.length) {
          const nextSibling = children[idx + 1];
          if (nextSibling.type === 'paragraph') {
            const siblingText = this.getPlainText(nextSibling).trim();
            if (siblingText.startsWith('Obrázek') || siblingText.startsWith('Figure')) {
              caption = siblingText;
              idx++; // consume caption sibling
            }
          }
        }

        const captionCmd = this.suppressCaptionNumbers ? '\\caption*' : '\\caption';
        for (const img of figureImages) {
          const includeGraphics = this.buildIncludeGraphics(img.url, img.sizeSpec);
          let figureContent = `\\begin{figure}[H]\n\\centering\n${includeGraphics}\n`;
          const figCaption = figureImages.length === 1 ? caption : (img.title || '');
          if (figCaption) {
            figureContent += `${captionCmd}{${this.escapeTextAndEmoji(figCaption)}}\n`;
          }
          figureContent += `\\end{figure}`;
          results.push(figureContent);
        }
        continue;
      }

      results.push(this.compileNode(child, parentNode, currentDepth));
    }

    return results;
  }

  /**
   * If the paragraph contains only images, size specs ({width=50%} text
   * right after an image), whitespace and line breaks, return the images.
   * Otherwise return null - the paragraph must be compiled as regular
   * inline content.
   */
  private extractFigureImages(paragraph: any): Array<{ url: string; title?: string; sizeSpec?: string }> | null {
    const images: Array<{ url: string; title?: string; sizeSpec?: string }> = [];

    for (const node of paragraph.children) {
      if (node.type === 'image') {
        images.push({ url: node.url || '', title: node.title || undefined });
      } else if (node.type === 'imageReference') {
        const def = this.ctx.definitions.get(node.identifier);
        if (!def) return null;
        images.push({ url: def.url, title: def.title });
      } else if (node.type === 'text') {
        const trimmed = node.value.trim();
        if (trimmed === '') continue;
        if (trimmed.startsWith('{') && trimmed.endsWith('}') && images.length > 0) {
          images[images.length - 1].sizeSpec = trimmed.slice(1, -1);
        } else {
          return null;
        }
      } else if (node.type === 'break') {
        continue;
      } else if (node.type === 'mdxTextExpression' && /^\s*width\s*=/.test(node.value || '') && images.length > 0) {
        images[images.length - 1].sizeSpec = (node.value || '').trim();
      } else {
        return null;
      }
    }

    return images.length > 0 ? images : null;
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

  private parseHighlightComments(code: string): { cleanCode: string; highlightedLines: number[] } {
    const lines = code.split('\n');
    const cleanLines: string[] = [];
    const highlightedLines: number[] = [];
    let highlightActive = false;
    let highlightNext = false;

    const nextRegex = /(?:\/\/|#|<!--|\/\*)\s*highlight-next-line\s*(?:-->|\*\/)?/;
    const startRegex = /(?:\/\/|#|<!--|\/\*)\s*highlight-start\s*(?:-->|\*\/)?/;
    const endRegex = /(?:\/\/|#|<!--|\/\*)\s*highlight-end\s*(?:-->|\*\/)?/;

    for (const line of lines) {
      if (nextRegex.test(line)) {
        highlightNext = true;
        continue;
      }
      if (startRegex.test(line)) {
        highlightActive = true;
        continue;
      }
      if (endRegex.test(line)) {
        highlightActive = false;
        continue;
      }

      cleanLines.push(line);
      const lineIndex = cleanLines.length;

      if (highlightNext) {
        highlightedLines.push(lineIndex);
        highlightNext = false;
      } else if (highlightActive) {
        highlightedLines.push(lineIndex);
      }
    }

    return {
      cleanCode: cleanLines.join('\n'),
      highlightedLines,
    };
  }

  private parseMetadataHighlight(spec: string): number[] {
    const lines: number[] = [];
    const parts = spec.split(',');
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            lines.push(i);
          }
        }
      } else {
        const num = Number(part);
        if (!isNaN(num)) {
          lines.push(num);
        }
      }
    }
    return lines;
  }

  private formatHighlightLines(lines: number[]): string {
    if (lines.length === 0) return '';
    const parts: string[] = [];
    let start = lines[0];
    let end = lines[0];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === end + 1) {
        end = lines[i];
      } else {
        if (start === end) {
          parts.push(`${start}`);
        } else {
          parts.push(`${start}-${end}`);
        }
        start = lines[i];
        end = lines[i];
      }
    }

    if (start === end) {
      parts.push(`${start}`);
    } else {
      parts.push(`${start}-${end}`);
    }

    return parts.join(',');
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
