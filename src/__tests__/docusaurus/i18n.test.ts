import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SiteLoader } from '../../docusaurus/site.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleSite = path.resolve(__dirname, '../../../example-docusaurus');

describe('i18n loading and fallback', () => {
  it('loads translated pages and groups them with fallback', async () => {
    const loader = new SiteLoader();
    const site = await loader.load(exampleSite);

    // Verify page lists
    expect(site.Pages.length).toBeGreaterThan(0);
    
    // Check if translated pages exist in site.Pages
    const csPages = site.Pages.filter(p => p.Language === 'cs');
    expect(csPages.length).toBe(2); // instalace.md, intro.md

    const introCs = csPages.find(p => p.ID === 'intro');
    expect(introCs).toBeDefined();
    expect(introCs?.Language).toBe('cs');
    expect(introCs?.RelPath).toBe('intro.md');

    // Test getDocsByLanguage grouping
    const docsByLang = await loader.getDocsByLanguage(site);
    expect(docsByLang.has('en')).toBe(true);
    expect(docsByLang.has('cs')).toBe(true);

    const csDocs = docsByLang.get('cs')!;
    const enDocs = docsByLang.get('en')!;

    // cs docs should have 14 pages (13 default/fallbacks + 1 Czech-only page 'instalace')
    expect(csDocs.length).toBe(14);

    // csDocs should have cs version for intro
    const csIntro = csDocs.find(d => d.ID === 'intro')!;
    expect(csIntro.Language).toBe('cs');
    expect(csIntro.Title).toBe('Úvod'); // Úvod (czech translation)

    // getting-started/installation is not translated at the same path, so it falls back to English
    const fallbackInstallation = csDocs.find(d => d.ID === 'getting-started/installation')!;
    expect(fallbackInstallation.Language).toBe('en');

    // Czech-only instalace page exists and is Czech
    const csInstallation = csDocs.find(d => d.ID === 'instalace')!;
    expect(csInstallation.Language).toBe('cs');
    expect(csInstallation.Title).toBe('Instalace'); // Instalace (czech translation)

    // csDocs should fall back to english for getting-started/configuration (which is not translated)
    const csConfiguration = csDocs.find(d => d.ID === 'getting-started/configuration')!;
    expect(csConfiguration.Language).toBe('en');
  });

  it('detects language from path and frontmatter', () => {
    const loader = new SiteLoader() as any;
    
    const pageWithPath = {
      Path: '/project/i18n/de/docusaurus-plugin-content-docs/current/intro.md',
      Frontmatter: {},
    } as any;
    expect(loader.detectLanguage(pageWithPath)).toBe('de');

    const pageWithFrontmatter = {
      Path: '/project/docs/intro.md',
      Frontmatter: { locale: 'fr' },
    } as any;
    expect(loader.detectLanguage(pageWithFrontmatter)).toBe('fr');
  });
});
