import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SiteLoader } from '../../docusaurus/site.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleSite = path.resolve(__dirname, '../../../example-docusaurus');

describe('Sidebar ordering and hierarchy', () => {
  it('orders documents according to the sidebar, with category entries', async () => {
    const loader = new SiteLoader();
    const site = await loader.load(exampleSite);
    const entries = loader.getOrderedEntries(site);

    const outline = entries.map((e) =>
      e.Type === 'category' ? `[${e.Label}]` : e.Doc!.ID
    );

    // tutorialSidebar: intro, Getting Started (installation, configuration,
    // first-steps), Advanced Topics (customization, deployment)
    expect(outline.indexOf('intro')).toBeLessThan(outline.indexOf('[Getting Started]'));
    expect(outline.indexOf('[Getting Started]')).toBeLessThan(outline.indexOf('getting-started/installation'));
    expect(outline.indexOf('getting-started/installation')).toBeLessThan(outline.indexOf('getting-started/configuration'));
    expect(outline.indexOf('getting-started/configuration')).toBeLessThan(outline.indexOf('getting-started/first-steps'));

    // apiSidebar: Core API in sidebar order (authentication, endpoints, errors)
    expect(outline.indexOf('api/core/authentication')).toBeLessThan(outline.indexOf('api/core/endpoints'));
    expect(outline.indexOf('api/core/endpoints')).toBeLessThan(outline.indexOf('api/core/errors'));

    // docs inside a category sit one level below it
    const cat = entries.find((e) => e.Type === 'category' && e.Label === 'Getting Started')!;
    const doc = entries.find((e) => e.Type === 'doc' && e.Doc!.ID === 'getting-started/installation')!;
    expect(doc.Level).toBe(cat.Level + 1);
  });

  it('skips partials and draft pages', async () => {
    const loader = new SiteLoader();
    const site = await loader.load(exampleSite);
    for (const page of site.Pages) {
      expect(path.basename(page.Path).startsWith('_')).toBe(false);
      expect(page.Frontmatter.draft).not.toBe(true);
    }
  });
});
