import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import YAML from 'yaml';
import { pathToFileURL } from 'url';
import { Site, Category, SidebarItem, DocPage, SiteConfig, OrderedEntry } from '../types/index.js';

export class SiteLoader {
  private defaultLocale: string = 'en';

  async load(root: string): Promise<Site> {
    const absRoot = path.resolve(root);
    
    // Detect default locale and load config from docusaurus config
    this.defaultLocale = await this.detectDefaultLocale(absRoot);
    const siteConfig = await this.loadSiteConfig(absRoot);
    const usesMath = await this.detectMathSupport(absRoot);

    const site: Site = {
      Root: absRoot,
      DocsDir: path.join(absRoot, 'docs'),
      Sidebars: [],
      Pages: [],
      Config: siteConfig,
      DefaultLocale: this.defaultLocale,
      UsesMath: usesMath,
    };

    // Load sidebars if exists (try .json, then .ts, then .js)
    const sidebarsLoaded = await this.tryLoadSidebars(site, absRoot);
    
    if (sidebarsLoaded) {
      // Also load pages from docs directory
      await this.loadPagesFromDir(site);
    } else {
      // If no sidebars found, build from directory
      await this.buildFromDir(site);
    }

    return site;
  }
  
  private async detectDefaultLocale(root: string): Promise<string> {
    // Try to read docusaurus.config.ts
    const configPath = path.join(root, 'docusaurus.config.ts');
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      // Extract defaultLocale from i18n config
      const match = content.match(/defaultLocale:\s*['"]([^'"]+)['"]/);
      if (match) {
        return match[1];
      }
    } catch {
      // Try .js config
      const jsConfigPath = path.join(root, 'docusaurus.config.js');
      try {
        const content = await fs.readFile(jsConfigPath, 'utf-8');
        const match = content.match(/defaultLocale:\s*['"]([^'"]+)['"]/);
        if (match) {
          return match[1];
        }
      } catch {
        // Fall back to 'en'
      }
    }
    return 'en';
  }

  /**
   * Sites that configure remark-math/rehype-katex want $...$ parsed as math;
   * for everyone else dollar signs are plain prose. Without a config file we
   * default to math enabled (no way to know, and math markup in plain text
   * is rare while genuine formulas are common in such standalone usage).
   */
  private async detectMathSupport(root: string): Promise<boolean> {
    for (const name of ['docusaurus.config.ts', 'docusaurus.config.js', 'docusaurus.config.mjs']) {
      try {
        const content = await fs.readFile(path.join(root, name), 'utf-8');
        return /remark-math|rehype-katex|katex/i.test(content);
      } catch {
        continue;
      }
    }
    return true;
  }

  private async loadSiteConfig(root: string): Promise<SiteConfig | undefined> {
    // Try to read docusaurus.config.ts
    const configPath = path.join(root, 'docusaurus.config.ts');
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      // Extract title from config
      const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
      const taglineMatch = content.match(/tagline:\s*['"]([^'"]+)['"]/);
      const urlMatch = content.match(/url:\s*['"]([^'"]+)['"]/);
      
      if (titleMatch) {
        return {
          Title: titleMatch[1],
          Tagline: taglineMatch ? taglineMatch[1] : undefined,
          URL: urlMatch ? urlMatch[1] : undefined,
        };
      }
    } catch {
      // Try .js config
      const jsConfigPath = path.join(root, 'docusaurus.config.js');
      try {
        const content = await fs.readFile(jsConfigPath, 'utf-8');
        const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
        const taglineMatch = content.match(/tagline:\s*['"]([^'"]+)['"]/);
        const urlMatch = content.match(/url:\s*['"]([^'"]+)['"]/);
        
        if (titleMatch) {
          return {
            Title: titleMatch[1],
            Tagline: taglineMatch ? taglineMatch[1] : undefined,
            URL: urlMatch ? urlMatch[1] : undefined,
          };
        }
      } catch {
        // No config found
      }
    }
    return undefined;
  }

  private async tryLoadSidebars(site: Site, absRoot: string): Promise<boolean> {
    // Try sidebars.json first
    const jsonPath = path.join(absRoot, 'sidebars.json');
    try {
      const data = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
      this.parseSidebarsData(site, data);
      return true;
    } catch {
      // Try sidebars.ts
      const tsPath = path.join(absRoot, 'sidebars.ts');
      try {
        await fs.access(tsPath);
        let data: any = null;
        try {
          const moduleUrl = pathToFileURL(tsPath).href;
          const module = await import(moduleUrl);
          data = module.default || module.sidebars || module;
        } catch (importErr) {
          // Fallback to regex extract if dynamic import fails
          const content = await fs.readFile(tsPath, 'utf-8');
          data = this.extractExportFromTS(content);
        }
        if (data) {
          this.parseSidebarsData(site, data);
          return true;
        }
      } catch {
        // Try sidebars.js
        const jsPath = path.join(absRoot, 'sidebars.js');
        try {
          await fs.access(jsPath);
          let data: any = null;
          try {
            const moduleUrl = pathToFileURL(jsPath).href;
            const module = await import(moduleUrl);
            data = module.default || module.sidebars || module;
          } catch (importErr) {
            // Fallback to regex extract if dynamic import fails
            const content = await fs.readFile(jsPath, 'utf-8');
            data = this.extractExportFromTS(content);
          }
          if (data) {
            this.parseSidebarsData(site, data);
            return true;
          }
        } catch {
          // No sidebars file found
        }
      }
    }
    return false;
  }

  private parseSidebarsData(site: Site, data: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        site.Sidebars.push({
          Type: 'sidebar',
          Label: name,
          Items: value.map((item) => this.parseSidebarItem(item)),
        });
      } else if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        site.Sidebars.push({
          Type: 'sidebar',
          Label: name,
          Items: Array.isArray(obj.items) ? obj.items.map((i) => this.parseSidebarItem(i)) : [],
        });
      }
    }
  }

  private extractExportFromTS(content: string): Record<string, unknown> | null {
    // Remove comments first
    const cleanContent = content
      .replace(/\/\/.*$/gm, '')  // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');  // Remove multi-line comments
    
    // Match: const sidebars: SidebarsConfig = { ... };
    const varMatch = cleanContent.match(/const\s+sidebars\s*:\s*\w+\s*=\s*(\{[\s\S]*?\});?$/m);
    if (!varMatch) return null;
    
    try {
      let jsonLike = varMatch[1];
      // Add quotes to unquoted keys (only at start of object or after comma)
      jsonLike = jsonLike.replace(/([{,])(\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1$2"$3"$4');
      // Replace single quotes with double quotes
      jsonLike = jsonLike.replace(/'/g, '"');
      // Remove trailing commas before closing braces/brackets
      jsonLike = jsonLike.replace(/,(\s*[}\]])/g, '$1');
      
      return JSON.parse(jsonLike);
    } catch (e) {
      console.error('Failed to parse sidebars:', e);
      return null;
    }
  }

  private parseSidebarItem(raw: unknown): SidebarItem {
    // Shorthand: a plain string is a doc id
    if (typeof raw === 'string') {
      return { Type: 'doc', ID: raw };
    }

    const data = (raw || {}) as Record<string, unknown>;
    const item: SidebarItem = {
      Type: (data.type as string) || 'doc',
    };

    if (data.id) item.ID = data.id as string;
    if (data.label) item.Label = data.label as string;
    if (data.dirName) item.DirName = data.dirName as string;

    if (data.link && typeof data.link === 'object') {
      const link = data.link as Record<string, unknown>;
      item.Link = { Type: String(link.type || ''), ID: String(link.id || '') };
    }

    if (data.items && Array.isArray(data.items)) {
      item.Items = data.items.map((i: unknown) => this.parseSidebarItem(i));
    }

    return item;
  }

  private async buildFromDir(site: Site): Promise<void> {
    await this.loadPagesFromDir(site);
  }

  private async loadPagesFromDir(site: Site): Promise<void> {
    const docsDir = site.DocsDir;

    try {
      // Load default language documents
      const files = (await glob('**/*.{md,mdx}', { cwd: docsDir })).sort();

      for (const file of files) {
        const relPosix = file.split(path.sep).join('/');

        // Docusaurus convention: files/folders starting with "_" are
        // partials, not standalone pages
        if (relPosix.split('/').some((seg) => seg.startsWith('_'))) {
          continue;
        }

        const fullPath = path.join(docsDir, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const frontmatter = this.extractFrontmatter(content);

        // Draft/unlisted pages are not published by Docusaurus
        if (frontmatter.draft === true || frontmatter.unlisted === true) {
          continue;
        }

        const pathId = relPosix.replace(/\.mdx?$/, '');
        // Frontmatter id overrides the last path segment (Docusaurus rule)
        const id = typeof frontmatter.id === 'string'
          ? [...pathId.split('/').slice(0, -1), frontmatter.id].join('/')
          : pathId;

        const page: DocPage = {
          Path: fullPath,
          ID: id,
          Title: this.extractTitle(content),
          Content: content,
          Language: this.defaultLocale,
          Frontmatter: frontmatter,
          RelPath: relPosix,
        };

        site.Pages.push(page);
      }

      // Load translated documents from i18n directory
      const i18nDir = path.join(site.Root, 'i18n');
      try {
        const i18nExists = await fs.access(i18nDir).then(() => true).catch(() => false);
        if (i18nExists) {
          const locales = await fs.readdir(i18nDir);
          for (const locale of locales) {
            if (locale.startsWith('.')) continue;

            const localeDocsDirs = [
              path.join(i18nDir, locale, 'docusaurus-plugin-content-docs', 'current'),
              path.join(i18nDir, locale, 'docusaurus-plugin-content-docs')
            ];

            let localeDocsDir = '';
            for (const dir of localeDocsDirs) {
              try {
                await fs.access(dir);
                localeDocsDir = dir;
                break;
              } catch {}
            }

            if (!localeDocsDir) continue;

            const localeFiles = (await glob('**/*.{md,mdx}', { cwd: localeDocsDir })).sort();
            for (const file of localeFiles) {
              const relPosix = file.split(path.sep).join('/');

              if (relPosix.split('/').some((seg) => seg.startsWith('_'))) {
                continue;
              }

              const fullPath = path.join(localeDocsDir, file);
              const content = await fs.readFile(fullPath, 'utf-8');
              const frontmatter = this.extractFrontmatter(content);

              if (frontmatter.draft === true || frontmatter.unlisted === true) {
                continue;
              }

              const pathId = relPosix.replace(/\.mdx?$/, '');
              const id = typeof frontmatter.id === 'string'
                ? [...pathId.split('/').slice(0, -1), frontmatter.id].join('/')
                : pathId;

              const page: DocPage = {
                Path: fullPath,
                ID: id,
                Title: this.extractTitle(content),
                Content: content,
                Language: locale,
                Frontmatter: frontmatter,
                RelPath: relPosix,
              };

              site.Pages.push(page);
            }
          }
        }
      } catch (err) {
        console.error('Error loading i18n pages:', err);
      }
    } catch (err) {
      console.error('Error loading pages from directory:', err);
    }
  }

  private extractFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!match) return {};
    try {
      return YAML.parse(match[1]) || {};
    } catch {
      return {};
    }
  }

  private extractTitle(content: string): string {
    // Frontmatter title wins; otherwise use the H1 only when it is the first
    // non-blank line after frontmatter (a "# ..." inside a code block must not match).
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    let body = content;
    if (fmMatch) {
      try {
        const fm = YAML.parse(fmMatch[1]);
        if (fm && typeof fm.title === 'string') return fm.title.trim();
      } catch {
        // ignore malformed frontmatter
      }
      body = content.slice(fmMatch[0].length);
    }
    const match = body.match(/^(?:[ \t]*\r?\n)* {0,3}#[ \t]+(.+?)[ \t]*#*[ \t]*(\r?\n|$)/);
    return match ? match[1].trim() : 'Untitled';
  }

  async getAllDocs(site: Site): Promise<DocPage[]> {
    return site.Pages;
  }

  /** Docusaurus ordering: sidebar_position frontmatter, then path. */
  private compareDocs(a: DocPage, b: DocPage): number {
    const posA = typeof a.Frontmatter.sidebar_position === 'number' ? (a.Frontmatter.sidebar_position as number) : Infinity;
    const posB = typeof b.Frontmatter.sidebar_position === 'number' ? (b.Frontmatter.sidebar_position as number) : Infinity;
    if (posA !== posB) return posA - posB;
    return a.ID.localeCompare(b.ID);
  }

  /**
   * Flatten the sidebars into an ordered outline: category headings and
   * docs in the order (and nesting) readers see on the website. Docs not
   * referenced by any sidebar are appended at the end.
   */
  getOrderedEntries(site: Site, docsSubset?: DocPage[], includeLeftovers: boolean = true): OrderedEntry[] {
    const pool = docsSubset ?? site.Pages;
    const byId = new Map(pool.map((p) => [p.ID, p]));
    const used = new Set<string>();
    const entries: OrderedEntry[] = [];

    const pushDoc = (id: string, level: number) => {
      const doc = byId.get(id);
      if (doc && !used.has(doc.ID)) {
        used.add(doc.ID);
        entries.push({ Type: 'doc', Doc: doc, Level: level });
      }
    };

    const pushAutogenerated = (dirName: string, level: number) => {
      const dir = dirName === '.' ? '' : dirName.replace(/\/+$/, '');
      const docs = pool
        .filter((p) => !used.has(p.ID) && (dir === '' || p.ID === dir || p.ID.startsWith(`${dir}/`)))
        .sort((a, b) => this.compareDocs(a, b));
      for (const doc of docs) {
        used.add(doc.ID);
        entries.push({ Type: 'doc', Doc: doc, Level: level });
      }
    };

    const walk = (items: SidebarItem[], level: number) => {
      for (const item of items) {
        if (item.Type === 'category') {
          entries.push({ Type: 'category', Label: item.Label || '', Level: level });
          if (item.Link?.Type === 'doc' && item.Link.ID) {
            pushDoc(item.Link.ID, level + 1);
          }
          walk(item.Items || [], level + 1);
        } else if (item.Type === 'autogenerated') {
          pushAutogenerated(item.DirName || '', level);
        } else if (item.Type === 'link' || item.Type === 'ref') {
          continue; // external links / refs have no PDF content
        } else if (item.ID) {
          pushDoc(item.ID, level);
        }
      }
    };

    for (const sidebar of site.Sidebars) {
      // The sidebar's own name is internal - walk its items at level 1
      walk(sidebar.Items, 1);
    }

    if (includeLeftovers) {
      const leftovers = pool.filter((p) => !used.has(p.ID)).sort((a, b) => this.compareDocs(a, b));
      for (const doc of leftovers) {
        entries.push({ Type: 'doc', Doc: doc, Level: 1 });
      }
    }

    return entries;
  }

  async getDocsForCategory(site: Site, category: Category): Promise<DocPage[]> {
    // Reuse the ordered walk so per-section output follows sidebar order
    const subSite: Site = { ...site, Sidebars: [{ ...category, Type: 'sidebar' }] };
    return this.getOrderedEntries(subSite, undefined, false)
      .filter((e) => e.Type === 'doc' && e.Doc)
      .map((e) => e.Doc!);
  }

  async getDocsByLanguage(site: Site): Promise<Map<string, DocPage[]>> {
    const grouped = new Map<string, DocPage[]>();
    
    const langs = new Set<string>();
    for (const page of site.Pages) {
      langs.add(this.detectLanguage(page));
    }
    
    const defaultLang = this.defaultLocale || 'en';
    const defaultDocs = site.Pages.filter(p => this.detectLanguage(p) === defaultLang);
    
    for (const lang of langs) {
      if (lang === defaultLang) {
        grouped.set(lang, defaultDocs);
        continue;
      }
      
      const langDocs = site.Pages.filter(p => this.detectLanguage(p) === lang);
      const langDocsMap = new Map(langDocs.map(d => [d.ID, d]));
      
      const merged: DocPage[] = [];
      for (const defDoc of defaultDocs) {
        if (langDocsMap.has(defDoc.ID)) {
          merged.push(langDocsMap.get(defDoc.ID)!);
        } else {
          merged.push(defDoc);
        }
      }
      
      const defDocsIds = new Set(defaultDocs.map(d => d.ID));
      for (const langDoc of langDocs) {
        if (!defDocsIds.has(langDoc.ID)) {
          merged.push(langDoc);
        }
      }
      
      grouped.set(lang, merged);
    }
    
    return grouped;
  }

  private detectLanguage(page: DocPage): string {
    // Use page.Language if set (from docusaurus config defaultLocale)
    if (page.Language && page.Language !== 'en') {
      return page.Language;
    }
    
    // Check path for i18n pattern
    const match = page.Path.match(/i18n[/\\]([^/\\]+)/);
    if (match) {
      return match[1];
    }
    
    // Check frontmatter
    if (page.Frontmatter.locale) {
      return String(page.Frontmatter.locale);
    }
    
    return page.Language || 'en';
  }
}
