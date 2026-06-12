import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import YAML from 'yaml';
import { pathToFileURL } from 'url';
import { Site, Category, SidebarItem, DocPage, Link, SiteConfig } from '../types/index.js';

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
      if (typeof value === 'object' && value !== null) {
        site.Sidebars.push(this.parseCategory(name, value as Record<string, unknown>));
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

  private parseCategory(name: string, data: Record<string, unknown>): Category {
    const cat: Category = {
      Type: 'category',
      Label: name,
      Items: [],
    };

    // Handle autogenerated sidebars - create categories from directory structure
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      const item = data[0] as Record<string, unknown>;
      if (item.type === 'autogenerated' && item.dirName) {
        // For autogenerated, create a category with the dirName as label
        cat.Label = item.dirName as string;
        return cat;
      }
    }

    if (data.items && Array.isArray(data.items)) {
      cat.Items = data.items.map((item: unknown) => this.parseSidebarItem(item as Record<string, unknown>));
    }

    if (data.link && typeof data.link === 'object') {
      cat.Link = data.link as Link;
    }

    return cat;
  }

  private parseSidebarItem(data: Record<string, unknown>): SidebarItem {
    const item: SidebarItem = {
      Type: (data.type as string) || 'doc',
    };

    if (data.id) item.ID = data.id as string;
    if (data.label) item.Label = data.label as string;
    
    if (data.items && Array.isArray(data.items)) {
      item.Items = data.items.map((i: unknown) => this.parseSidebarItem(i as Record<string, unknown>));
    }

    return item;
  }

  private async buildFromDir(site: Site): Promise<void> {
    await this.loadPagesFromDir(site);
  }

  private async loadPagesFromDir(site: Site): Promise<void> {
    const docsDir = site.DocsDir;
    
    try {
      const files = await glob('**/*.{md,mdx}', { cwd: docsDir });
      
      for (const file of files) {
        const fullPath = path.join(docsDir, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        const page: DocPage = {
          Path: fullPath,
          ID: file.replace(/\.mdx?$/, '').replace(/\//g, '-'),
          Title: this.extractTitle(content),
          Content: content,
          Language: this.defaultLocale,
          Frontmatter: {},
        };
        
        site.Pages.push(page);
      }
    } catch (err) {
      console.error('Error loading pages from directory:', err);
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

  async getDocsForCategory(site: Site, category: Category): Promise<DocPage[]> {
    const docIds: string[] = [];
    
    const collectIds = (items: SidebarItem[]) => {
      for (const item of items) {
        if (item.ID) docIds.push(item.ID);
        if (item.Items) collectIds(item.Items);
      }
    };
    
    collectIds(category.Items);
    
    // If no items collected (autogenerated), filter by directory name
    if (docIds.length === 0 && category.Label) {
      const dirName = category.Label;
      // Check if ID starts with the directory name (e.g., "manuals-intro")
      return site.Pages.filter(p => p.ID.startsWith(`${dirName}-`) || p.ID.includes(`/${dirName}/`) || p.ID.includes(`\\${dirName}\\`));
    }
    
    return site.Pages.filter(p => docIds.some(id => p.ID === id || p.ID.endsWith(`-${id}`)));
  }

  async getDocsByLanguage(site: Site): Promise<Map<string, DocPage[]>> {
    const grouped = new Map<string, DocPage[]>();
    
    for (const page of site.Pages) {
      const lang = this.detectLanguage(page);
      if (!grouped.has(lang)) {
        grouped.set(lang, []);
      }
      grouped.get(lang)!.push(page);
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
