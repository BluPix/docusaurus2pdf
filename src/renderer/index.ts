import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import * as pako from 'pako';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { SiteLoader } from '../docusaurus/site.js';
import { MDXParser, MDXParserOptions } from '../mdx/parser.js';
import { LatexGenerator } from '../latex/generator.js';
import { Site, DocPage, RendererOptions, DocumentSection } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type { RendererOptions, DocumentSection } from '../types/index.js';

export class Renderer {
  private opts: RendererOptions;
  private siteLoader: SiteLoader;
  private mdxParser: MDXParser;
  private pendingRemoteImages: Map<string, string> = new Map();
  private enableMath: boolean = true;

  constructor(opts: RendererOptions) {
    this.opts = opts;
    this.siteLoader = new SiteLoader();
    this.mdxParser = new MDXParser();
    // Set MDX parser options
    // Use emoji commands for lualatex (has emoji package with Twemoji support)
    const useEmojiCommands = opts.Engine === 'lualatex';
    const parserOpts: MDXParserOptions = {
      stripManualNumbering: opts.StripManualNumbering,
      convertEmoji: opts.ConvertEmoji,
      useEmojiCommands,
      suppressCaptionNumbers: opts.SuppressCaptionNumbers,
    };
    this.mdxParser.setOptions(parserOpts);
  }

  async renderSingle(site: Site): Promise<void> {
    this.enableMath = site.UsesMath ?? true;
    // Copy static assets first
    await this.copyStaticAssets(site);

    const lang = site.DefaultLocale || 'en';
    const docs = await this.siteLoader.getAllDocs(site);
    const sections = await this.convertDocsToSections(docs, lang, site.DocsDir);
    await this.downloadRemoteImages();
    
    // Generate PlantUML diagrams
    await this.generatePlantUMLDiagrams(sections);
    
    // Generate Mermaid diagrams
    await this.generateMermaidDiagrams(sections);
    
    const texFile = path.join(this.opts.OutputDir, 'documentation.tex');
    
    const projectTitle = site.Config?.Title || 'Documentation';
    const generator = new LatexGenerator({
      Engine: this.opts.Engine,
      Title: projectTitle,
      Language: lang,
      Date: '', // No date on title page
    });

    await generator.generateDocument(texFile, sections);
    console.log(`Generated: ${texFile}`);
  }

  async renderPerLanguage(site: Site): Promise<void> {
    this.enableMath = site.UsesMath ?? true;
    // Copy static assets first
    await this.copyStaticAssets(site);
    
    const grouped = await this.siteLoader.getDocsByLanguage(site);
    const sectionsToInclude = this.opts.Sections;
    
    for (const [lang, docs] of grouped.entries()) {
      // Filter docs by section if specified
      let filteredDocs = docs;
      if (sectionsToInclude && sectionsToInclude.length > 0) {
        const allowedIds = new Set<string>();
        for (const cat of site.Sidebars) {
          if (sectionsToInclude.includes(cat.Label)) {
            const catDocs = await this.siteLoader.getDocsForCategory(site, cat);
            catDocs.forEach(d => allowedIds.add(d.ID));
          }
        }
        filteredDocs = docs.filter(d => allowedIds.has(d.ID));
        
        if (sectionsToInclude && filteredDocs.length === 0) {
          console.log(`Warning: No matching sections found for language ${lang}. Available: ${site.Sidebars.map(c => c.Label).join(', ')}`);
        }
      }
      
      const sections = await this.convertDocsToSections(filteredDocs, lang, site.DocsDir);
      await this.downloadRemoteImages();

      // Generate PlantUML diagrams
      await this.generatePlantUMLDiagrams(sections);
      
      // Generate Mermaid diagrams
      await this.generateMermaidDiagrams(sections);
      
      const texFile = path.join(this.opts.OutputDir, `documentation_${lang}.tex`);
      
      const projectTitle = site.Config?.Title || 'Documentation';
      const generator = new LatexGenerator({
        Engine: this.opts.Engine,
        Title: projectTitle,
        Language: lang,
        Date: '', // No date on title page
      });
      
      await generator.generateDocument(texFile, sections);
      console.log(`Generated: ${texFile}`);
    }
  }

  async renderPerSection(site: Site): Promise<void> {
    this.enableMath = site.UsesMath ?? true;
    // Copy static assets first
    await this.copyStaticAssets(site);
    
    // Filter sections if specified
    const sectionsToInclude = this.opts.Sections;
    const filteredCategories = sectionsToInclude
      ? site.Sidebars.filter(cat => sectionsToInclude.includes(cat.Label))
      : site.Sidebars;
    
    if (sectionsToInclude && filteredCategories.length === 0) {
      console.log(`Warning: No matching sections found. Available: ${site.Sidebars.map(c => c.Label).join(', ')}`);
    }
    
    const sectionLang = site.DefaultLocale || 'en';
    for (const category of filteredCategories) {
      const docs = await this.siteLoader.getDocsForCategory(site, category);
      if (docs.length === 0) continue;

      const sections = await this.convertDocsToSections(docs, sectionLang, site.DocsDir);
      await this.downloadRemoteImages();
      
      const safeName = this.sanitizeFilename(category.Label);
      const texFile = path.join(this.opts.OutputDir, `${safeName}.tex`);
      
      const projectTitle = site.Config?.Title || 'Documentation';
      const generator = new LatexGenerator({
        Engine: this.opts.Engine,
        Title: `${projectTitle} - ${category.Label}`,
        Language: sectionLang,
        Date: '', // No date on title page
      });
      
      await generator.generateDocument(texFile, sections);
      console.log(`Generated: ${texFile}`);
    }
  }

  private async convertDocsToSections(docs: DocPage[], language: string = 'en', docsDir?: string): Promise<DocumentSection[]> {
    const sections: DocumentSection[] = [];

    const docKey = (doc: DocPage): string => {
      if (!docsDir) return '';
      const rel = path.relative(docsDir, doc.Path).split(path.sep).join('/');
      return rel.startsWith('..') ? '' : MDXParser.canonicalDocKey(rel);
    };

    // Registry of all docs in this build so cross-document links can be
    // resolved to internal references (or gracefully degrade to text)
    const knownDocs = new Set<string>(docs.map(docKey).filter(Boolean));
    this.mdxParser.setOptions({ language, knownDocs, enableMath: this.enableMath });

    for (const doc of docs) {
      try {
        const content = await fs.readFile(doc.Path, 'utf-8');
        let docDir = '';
        if (docsDir) {
          const rel = path.relative(docsDir, path.dirname(doc.Path)).split(path.sep).join('/');
          docDir = rel.startsWith('..') ? '' : rel;
        }
        const labelKey = docKey(doc);
        const parsed = await this.mdxParser.parse(content, docDir, labelKey);
        for (const remote of parsed.RemoteImages || []) {
          this.pendingRemoteImages.set(remote.url, remote.filename);
        }

        // Use PlantUML diagrams extracted by the parser
        const plantumlDiagrams = parsed.PlantUMLDiagrams || [];
        const mermaidDiagrams = parsed.MermaidDiagrams || [];

        sections.push({
          Title: parsed.Title,
          Content: parsed.Content,
          Level: 1,
          LabelKey: labelKey || undefined,
          PlantUMLDiagrams: plantumlDiagrams.length > 0 ? plantumlDiagrams : undefined,
          MermaidDiagrams: mermaidDiagrams.length > 0 ? mermaidDiagrams : undefined,
        });
      } catch (err) {
        console.error(`Failed to parse ${doc.Path}:`, err);
        sections.push({
          Title: doc.Title,
          Content: doc.Content,
          Level: 1,
        });
      }
    }

    return sections;
  }

  private sanitizeFilename(s: string): string {
    return s
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .toLowerCase();
  }

  async copyStaticAssets(site: Site): Promise<void> {
    // Images referenced from docs are flattened into img/ using the same
    // path mapping as the MDX parser (MDXParser.flattenImagePath), so names
    // are unique and references always match the copied files.
    await this.copyImageTree(site.DocsDir, '');
    await this.copyImageTree(path.join(site.Root, 'static'), 'static');

    // Fonts and data files keep their original basenames
    const assetTypes = [
      { exts: ['.ttf', '.otf', '.woff', '.woff2'], subdir: 'fonts', desc: 'font' },
      { exts: ['.json', '.yaml', '.yml', '.csv', '.xml'], subdir: 'data', desc: 'data file' },
    ];

    try {
      const allFiles = await fs.readdir(site.DocsDir, { recursive: true });

      for (const file of allFiles) {
        const ext = path.extname(file).toLowerCase();
        const type = assetTypes.find(t => t.exts.includes(ext));
        if (!type) continue;

        const targetDir = path.join(this.opts.OutputDir, type.subdir);
        await fs.mkdir(targetDir, { recursive: true });
        const destPath = path.join(targetDir, path.basename(String(file)));
        await fs.copyFile(path.join(site.DocsDir, String(file)), destPath);
        console.log(`Copied ${type.desc}: ${type.subdir}/${path.basename(String(file))}`);
      }
    } catch {
      // No assets or error reading directory - ignore
    }
  }

  private static readonly IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.pdf', '.eps', '.svg', '.gif', '.webp', '.avif'];

  /**
   * Copy all images under rootDir into the flat img/ output directory.
   * prefix is '' for the docs tree and 'static' for the static/ tree.
   */
  private async copyImageTree(rootDir: string, prefix: string): Promise<void> {
    let allFiles: string[];
    try {
      allFiles = (await fs.readdir(rootDir, { recursive: true })).map(String);
    } catch {
      return;
    }

    const imgDir = path.join(this.opts.OutputDir, 'img');

    for (const file of allFiles) {
      const ext = path.extname(file).toLowerCase();
      if (!Renderer.IMAGE_EXTS.includes(ext)) continue;

      const relPosix = file.split(path.sep).join('/');
      const flatName = prefix
        ? MDXParser.flattenImagePath(`/${relPosix}`, '') // leading '/' maps to static/
        : MDXParser.flattenImagePath(relPosix, '');
      const srcPath = path.join(rootDir, file);
      const destPath = path.join(imgDir, flatName);
      await fs.mkdir(imgDir, { recursive: true });

      try {
        if (ext === '.svg') {
          await this.convertSvgToPdfWithPuppeteer(srcPath, destPath);
          console.log(`Converted SVG to PDF: img/${flatName}`);
        } else if (ext === '.gif' || ext === '.webp' || ext === '.avif') {
          await this.convertImageToPngWithPuppeteer(srcPath, destPath);
          console.log(`Converted ${ext.slice(1).toUpperCase()} to PNG: img/${flatName}`);
        } else {
          await fs.copyFile(srcPath, destPath);
          console.log(`Copied image: img/${flatName}`);
        }
      } catch (err) {
        console.error(`Failed to process image ${relPosix}:`, err);
      }
    }
  }

  /** Download remote images collected by the parser into img/. */
  private async downloadRemoteImages(): Promise<void> {
    if (this.pendingRemoteImages.size === 0) return;

    const imgDir = path.join(this.opts.OutputDir, 'img');
    await fs.mkdir(imgDir, { recursive: true });

    for (const [url, filename] of this.pendingRemoteImages) {
      const destPath = path.join(imgDir, filename);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Failed to download image ${url}: HTTP ${response.status}`);
          continue;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const srcExt = (url.split(/[?#]/)[0].match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();

        if (srcExt === '.svg' || srcExt === '.gif' || srcExt === '.webp' || srcExt === '.avif') {
          const tempPath = path.join(imgDir, `download_temp${srcExt}`);
          await fs.writeFile(tempPath, buffer);
          try {
            if (srcExt === '.svg') {
              await this.convertSvgToPdfWithPuppeteer(tempPath, destPath);
            } else {
              await this.convertImageToPngWithPuppeteer(tempPath, destPath);
            }
          } finally {
            await fs.unlink(tempPath).catch(() => {});
          }
        } else {
          await fs.writeFile(destPath, buffer);
        }
        console.log(`Downloaded image: img/${filename}`);
      } catch (err) {
        console.warn(`Failed to download image ${url}:`, err);
      }
    }
    this.pendingRemoteImages.clear();
  }

  // Backward compatibility alias
  async copyImages(site: Site): Promise<void> {
    return this.copyStaticAssets(site);
  }

  private extractPlantUMLDiagrams(content: string): Array<{ hash: string; code: string }> {
    const diagrams: Array<{ hash: string; code: string }> = [];
    const seen = new Set<string>();
    
    // Find all PlantUML code blocks in the content
    const plantumlRegex = /```plantuml\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    
    while ((match = plantumlRegex.exec(content)) !== null) {
      const code = match[1].trim();
      const hash = createHash('md5').update(code).digest('hex').slice(0, 8);
      
      if (!seen.has(hash)) {
        seen.add(hash);
        diagrams.push({ hash, code });
      }
    }
    
    return diagrams;
  }

  async generatePlantUMLDiagrams(sections: DocumentSection[]): Promise<void> {
    // Collect all unique PlantUML diagrams
    const allDiagrams = new Map<string, string>();
    for (const section of sections) {
      if (section.PlantUMLDiagrams) {
        for (const diagram of section.PlantUMLDiagrams) {
          allDiagrams.set(diagram.hash, diagram.code);
        }
      }
    }
    
    if (allDiagrams.size === 0) return;
    
    console.log(`Generating ${allDiagrams.size} PlantUML diagram(s)...`);
    
    for (const [hash, code] of allDiagrams) {
      try {
        await this.generatePlantUMLImage(hash, code);
      } catch (err) {
        console.error(`Failed to generate PlantUML diagram ${hash}:`, err);
      }
    }
  }

  private async generatePlantUMLImage(hash: string, code: string): Promise<void> {
    const imgDir = path.join(this.opts.OutputDir, 'img');
    await fs.mkdir(imgDir, { recursive: true });
    const outputPath = path.join(imgDir, `plantuml_${hash}.eps`);

    // Add LaTeX-compatible font settings to PlantUML
    const fontConfig = `skinparam defaultFontName Serif
skinparam classFontName Serif
skinparam componentFontName Serif
skinparam noteFontName Serif
skinparam packageFontName Serif
`;
    const codeWithFont = fontConfig + code.trim();

    // Try local PlantUML first (Java JAR) - EPS output for native LaTeX
    const localResult = await this.tryLocalPlantUML(outputPath, codeWithFont);
    if (localResult) {
      console.log(`Generated PlantUML diagram (local): img/plantuml_${hash}.eps`);
      return;
    }

    // Fallback to TeaVM PlantUML.js (pure JavaScript, no Java needed)
    const teaVmResult = await this.tryTeaVMPlantUML(outputPath, codeWithFont);
    if (teaVmResult) {
      console.log(`Generated PlantUML diagram (TeaVM): img/plantuml_${hash}.eps`);
      return;
    }

    throw new Error(
      'PlantUML generation failed. Install Java and PlantUML for best results, or ensure TeaVM files are present.'
    );
  }

  private async tryLocalPlantUML(outputPath: string, code: string): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      const tempDir = path.dirname(outputPath);
      // Use just filename (not full path) to avoid PlantUML duplicating directory structure
      const tempFileName = `temp_${Date.now()}.puml`;
      const tempPuml = path.join(tempDir, tempFileName);

      await fs.writeFile(tempPuml, code, 'utf-8');

      let plantumlJar = path.join(tempDir, 'plantuml.jar');

      // Check if plantuml command exists
      let useCommand = false;
      try {
        const plantumlPath = execSync('which plantuml', { encoding: 'utf-8' }).trim();
        console.log('Found plantuml command:', plantumlPath);
        execSync('plantuml -version', { stdio: 'ignore' });
        useCommand = true;
      } catch (e) {
        console.log('No plantuml command, will try Java');
        // Debug: check if Java is available - try multiple methods
        let javaPath = '';
        try {
          javaPath = execSync('which java', { encoding: 'utf-8' }).trim();
        } catch {
          try {
            javaPath = execSync('command -v java', { encoding: 'utf-8' }).trim();
          } catch {
            // Try common paths
            const commonPaths = ['/usr/bin/java', '/usr/local/bin/java'];
            for (const p of commonPaths) {
              try {
                await fs.access(p);
                javaPath = p;
                break;
              } catch {
                continue;
              }
            }
          }
        }

        if (javaPath) {
          try {
            const javaVersion = execSync(`${javaPath} -version 2>&1`, { encoding: 'utf-8' });
            console.log('Java found:', javaPath, javaVersion.split('\n')[0]);
          } catch {
            console.log('Java found at', javaPath, 'but version check failed');
          }
        } else {
          console.log('Java not found');
        }
        // Check for JAR in common locations (vendor first if installed via npm)
        const jarPaths = [
          path.join(__dirname, '../../vendor/plantuml.jar'),
          path.join(__dirname, '../../../vendor/plantuml.jar'),
          path.join(process.cwd(), 'node_modules/docusaurus2pdf/vendor/plantuml.jar'),
          '/usr/share/plantuml/plantuml.jar',
          '/usr/local/share/plantuml/plantuml.jar',
          '/opt/homebrew/share/plantuml/plantuml.jar',
          '/opt/plantuml/plantuml.jar',
          path.join(process.cwd(), 'plantuml.jar'),
          path.join(os.homedir(), 'plantuml.jar'),
          path.join(os.homedir(), '.local/share/plantuml/plantuml.jar'),
        ];

        for (const jarPath of jarPaths) {
          try {
            await fs.access(jarPath);
            plantumlJar = jarPath;
            console.log('Found PlantUML JAR at:', jarPath);
            break;
          } catch {
            // console.log('JAR not found at:', jarPath);
            continue;
          }
        }

        // If no JAR found, download it from GitHub
        if (plantumlJar === path.join(tempDir, 'plantuml.jar')) {
          console.log('No local PlantUML JAR found, downloading...');
          try {
            const response = await fetch('https://github.com/plantuml/plantuml/releases/download/v1.2024.0/plantuml-1.2024.0.jar');
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              await fs.writeFile(plantumlJar, Buffer.from(buffer));
              console.log('PlantUML JAR downloaded to:', plantumlJar);
            } else {
              console.log('Failed to download PlantUML: HTTP', response.status);
              return false;
            }
          } catch (e) {
            console.log('Failed to download PlantUML:', e);
            return false;
          }
        } else {
          console.log('Using PlantUML JAR:', plantumlJar);
        }

      }

      const outputDir = path.dirname(outputPath);
      const baseName = path.basename(tempPuml, '.puml');
      // Use just the filename (relative to cwd) for PlantUML
      const tempFileNameOnly = path.basename(tempPuml);

      try {
        if (useCommand) {
          console.log('Running plantuml command...');
          execSync(`plantuml -teps "${tempFileNameOnly}"`, {
            stdio: 'inherit',
            timeout: 30000,
            cwd: outputDir,
          });
        } else {
          console.log('Running PlantUML with Java:', plantumlJar);
          execSync(`java -jar "${plantumlJar}" -teps "${tempFileNameOnly}"`, {
            stdio: 'inherit',
            timeout: 30000,
            cwd: outputDir,
          });
        }
        console.log('PlantUML execution succeeded');
      } catch (e) {
        console.log('PlantUML execution failed:', e);
        await fs.unlink(tempPuml).catch(() => {});
        return false;
      }

      // Rename output file to expected name
      const generatedFile = path.join(outputDir, `${baseName}.eps`);
      try {
        await fs.rename(generatedFile, outputPath);
      } catch {
        console.log('Failed to rename', generatedFile, 'to', outputPath);
        await fs.unlink(tempPuml).catch(() => {});
        return false;
      }

      await fs.unlink(tempPuml).catch(() => {});
      return true;
    } catch (e) {
      console.log('tryLocalPlantUML error:', e);
      return false;
    }
  }

  private async tryTeaVMPlantUML(outputPath: string, code: string): Promise<boolean> {
    try {
      // Use Node.js vm to run TeaVM PlantUML.js
      const { createPlantUMLJSRenderer } = await import('../utils/plantuml-js.js');
      const renderer = createPlantUMLJSRenderer();

      // TeaVM only supports SVG, write to .eps path (will be SVG content)
      const svg = await renderer.render(code, 'svg');

      if (typeof svg === 'string') {
        await fs.writeFile(outputPath, svg, 'utf-8');
        return true;
      }
      return false;
    } catch (err) {
      console.log('TeaVM PlantUML.js failed:', err);
      return false;
    }
  }

  private encodePlantUML(text: string): string {
    // PlantUML uses deflate + custom encoding with ~1 header for huffman encoding
    const compressed = pako.deflate(Buffer.from(text, 'utf8'), { level: 9 });
    return '~1' + this.plantumlEncode(Buffer.from(compressed));
  }

  private plantumlEncode(buffer: Buffer): string {
    // PlantUML specific encoding
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
    let result = '';
    
    for (let i = 0; i < buffer.length; i += 3) {
      const b1 = buffer[i];
      const b2 = i + 1 < buffer.length ? buffer[i + 1] : 0;
      const b3 = i + 2 < buffer.length ? buffer[i + 2] : 0;
      
      const c1 = b1 >> 2;
      const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
      const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
      const c4 = b3 & 0x3f;
      
      result += chars.charAt(c1) + chars.charAt(c2);
      if (i + 1 < buffer.length) result += chars.charAt(c3);
      if (i + 2 < buffer.length) result += chars.charAt(c4);
    }
    return result;
  }

  async generateMermaidDiagrams(sections: DocumentSection[]): Promise<void> {
    // Collect all unique Mermaid diagrams
    const allDiagrams = new Map<string, string>();
    for (const section of sections) {
      if (section.MermaidDiagrams) {
        for (const diagram of section.MermaidDiagrams) {
          allDiagrams.set(diagram.hash, diagram.code);
        }
      }
    }
    
    if (allDiagrams.size === 0) return;
    
    console.log(`Generating ${allDiagrams.size} Mermaid diagram(s)...`);

    for (const [hash, code] of allDiagrams) {
      try {
        await this.generateMermaidImage(hash, code);
      } catch (err) {
        console.error(`Failed to generate Mermaid diagram ${hash}:`, err);
      }
    }
  }

  private async generateMermaidImage(hash: string, code: string): Promise<void> {
    const imgDir = path.join(this.opts.OutputDir, 'img');
    await fs.mkdir(imgDir, { recursive: true });
    const outputPath = path.join(imgDir, `mermaid_${hash}.svg`);

    try {
      // Setup DOMPurify BEFORE importing mermaid (it checks at load time)
      const DOMPurify = (await import('isomorphic-dompurify')).default;
      (global as unknown as Record<string, unknown>).DOMPurify = DOMPurify;

      // Setup jsdom environment for mermaid
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      const window = dom.window;

      // Mock getBBox on SVG elements (required by mermaid for layout calculations)
      const doc = window.document;
      const originalCreateElementNS = doc.createElementNS.bind(doc);
      (doc as unknown as Record<string, unknown>).createElementNS = (ns: string, tag: string) => {
        const el = originalCreateElementNS(ns, tag);
        if (tag === 'svg' || ns === 'http://www.w3.org/2000/svg') {
          // Add getBBox mock that returns dimensions
          (el as unknown as Record<string, unknown>).getBBox = () => ({
            x: 0,
            y: 0,
            width: 800,
            height: 600,
          });
        }
        return el;
      };

      global.window = window as unknown as Window & typeof globalThis;
      global.document = window.document;
      (window as unknown as Record<string, unknown>).DOMPurify = DOMPurify;

      // NOW import mermaid
      const { default: mermaid } = await import('mermaid');

      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
      });

      // Use mermaid CLI for PDF generation (vector output)
      const tempDir = path.dirname(outputPath);
      const tempMd = path.join(tempDir, `temp_${hash}.mmd`);
      const pdfPath = outputPath.replace('.svg', '.pdf');

      await fs.writeFile(tempMd, code.trim(), 'utf-8');

      try {
        // Try multiple possible locations for mmdc
        const possiblePaths = [
          path.join(__dirname, '../../node_modules/.bin/mmdc'),
          path.join(__dirname, '../../../node_modules/.bin/mmdc'),
          path.join(process.cwd(), 'node_modules/.bin/mmdc'),
        ];

        let mmdcPath = '';
        for (const p of possiblePaths) {
          try {
            await fs.access(p);
            mmdcPath = p;
            break;
          } catch {
            continue;
          }
        }

        if (!mmdcPath) {
          throw new Error('mmdc not found');
        }

        const { execSync } = await import('child_process');

        execSync(`"${mmdcPath}" -i "${tempMd}" -o "${pdfPath}" -e pdf`, {
          stdio: 'inherit',
          timeout: 30000,
        });

        await fs.unlink(tempMd).catch(() => {});

        console.log(`Generated Mermaid diagram: img/mermaid_${hash}.pdf`);
      } catch (e) {
        console.log('Mermaid CLI failed, using Puppeteer fallback:', e);
        // Fallback: use puppeteer directly with system Chrome
        await this.generateMermaidWithPuppeteer(hash, code, outputPath.replace('.svg', '.pdf'));
        console.log(`Generated Mermaid diagram: img/mermaid_${hash}.pdf`);
      }
    } catch (err) {
      console.error(`Failed to render mermaid diagram ${hash}:`, err);
      throw err;
    }
  }

  private async generateMermaidWithPuppeteer(hash: string, code: string, outputPath: string): Promise<void> {
    const chromePath = await this.findSystemChrome();

    // Use puppeteer to render Mermaid directly in browser
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      
      // Find local mermaid bundle
      const mermaidPaths = [
        path.join(process.cwd(), 'node_modules/mermaid/dist/mermaid.min.js'),
        path.join(__dirname, '../../node_modules/mermaid/dist/mermaid.min.js'),
        path.join(__dirname, '../../../node_modules/mermaid/dist/mermaid.min.js'),
      ];
      let mermaidBundlePath = '';
      for (const p of mermaidPaths) {
        try {
          await fs.access(p);
          mermaidBundlePath = p;
          break;
        } catch {
          continue;
        }
      }
      if (!mermaidBundlePath) {
        throw new Error('Mermaid bundle not found');
      }
      const mermaidCode = await fs.readFile(mermaidBundlePath, 'utf-8');
      
      // Create HTML page with bundled Mermaid
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { margin: 0; padding: 20px; }
            .mermaid { display: flex; justify-content: center; }
          </style>
          <script>${mermaidCode}</script>
        </head>
        <body>
          <div class="mermaid">
${code.trim()}
          </div>
          <script>
            mermaid.initialize({ startOnLoad: true, theme: 'default' });
          </script>
        </body>
        </html>
      `;
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for Mermaid to render
      await page.waitForSelector('.mermaid svg', { timeout: 30000 });
      
      // Get rendered SVG dimensions
      const dimensions = await page.evaluate(() => {
        const svg = document.querySelector('.mermaid svg');
        const rect = svg?.getBoundingClientRect();
        return { width: rect?.width || 800, height: rect?.height || 600 };
      });

      await page.pdf({
        path: outputPath,
        width: dimensions.width + 40,
        height: dimensions.height + 40,
        printBackground: true,
      });
    } finally {
      await browser.close();
    }
  }

  /**
   * Convert a raster image (GIF/WebP/AVIF) to PNG locally via headless
   * Chrome - no online service involved. Vector sources (SVG) go through
   * convertSvgToPdfWithPuppeteer instead so they stay vector.
   */
  private async convertImageToPngWithPuppeteer(srcPath: string, outputPath: string): Promise<void> {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: (await this.findSystemChrome()) || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      const fileUrl = `file://${path.resolve(srcPath)}`;
      await page.setContent(`
        <!DOCTYPE html>
        <html><body style="margin:0;padding:0;">
          <img src="${fileUrl}" style="display:block;">
        </body></html>
      `, { waitUntil: 'networkidle0' });

      const dimensions = await page.evaluate(() => {
        const img = document.querySelector('img');
        return { width: img?.naturalWidth || 800, height: img?.naturalHeight || 600 };
      });
      await page.setViewport({ width: Math.max(1, dimensions.width), height: Math.max(1, dimensions.height) });

      const img = await page.$('img');
      if (!img) throw new Error('Image failed to load');
      await img.screenshot({ path: outputPath as `${string}.png`, omitBackground: true });
    } finally {
      await browser.close();
    }
  }

  private async findSystemChrome(): Promise<string> {
    const { execSync } = await import('child_process');
    const possibleChromePaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/chrome',
      '/usr/local/bin/chromium',
      '/opt/google/chrome/chrome',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    for (const p of possibleChromePaths) {
      try {
        execSync(`test -f "${p}"`, { stdio: 'ignore' });
        return p;
      } catch {
        continue;
      }
    }
    return '';
  }

  private async convertSvgToPdfWithPuppeteer(svgPath: string, outputPath: string): Promise<void> {
    const chromePath = await this.findSystemChrome();

    const svgContent = await fs.readFile(svgPath, 'utf-8');

    // Use puppeteer to convert SVG to PDF
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:20px;">
          ${svgContent}
        </body>
        </html>
      `);

      // Get SVG dimensions
      const dimensions = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        const rect = svg?.getBoundingClientRect();
        return { width: rect?.width || 800, height: rect?.height || 600 };
      });

      await page.pdf({
        path: outputPath,
        width: dimensions.width + 40,
        height: dimensions.height + 40,
        printBackground: true,
      });
    } finally {
      await browser.close();
    }
  }
}
