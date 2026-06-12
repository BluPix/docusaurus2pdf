import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Renderer } from '../../renderer/index.js';
import { Site } from '../../docusaurus/types.js';

describe('Renderer Static Assets', () => {
  let tempDir: string;
  let outputDir: string;
  let docsDir: string;
  let renderer: Renderer;
  let site: Site;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docusaurus2pdf-test-'));
    outputDir = path.join(tempDir, 'output');
    docsDir = path.join(tempDir, 'docs');
    
    await fs.mkdir(docsDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    
    renderer = new Renderer({
      OutputDir: outputDir,
      Engine: 'lualatex',
    });
    
    site = {
      Root: tempDir,
      DocsDir: docsDir,
      Config: { Title: 'Test' },
      Sidebars: [],
      Pages: [],
    } as Site;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('copies image files to img/ subdirectory', async () => {
    // Create test image files
    await fs.writeFile(path.join(docsDir, 'image1.png'), 'fake png data');
    await fs.mkdir(path.join(docsDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(docsDir, 'subdir', 'image2.jpg'), 'fake jpg data');
    
    await (renderer as any).copyStaticAssets(site);
    
    // Check images were copied
    const imgDir = path.join(outputDir, 'img');
    const files = await fs.readdir(imgDir);
    expect(files).toContain('image1.png');
    expect(files).toContain('subdir__image2.jpg');
  });

  it('copies font files to fonts/ subdirectory', async () => {
    // Create test font files
    await fs.writeFile(path.join(docsDir, 'custom.ttf'), 'fake font data');
    await fs.writeFile(path.join(docsDir, 'icons.woff2'), 'fake woff2 data');
    
    await (renderer as any).copyStaticAssets(site);
    
    // Check fonts were copied
    const fontsDir = path.join(outputDir, 'fonts');
    const files = await fs.readdir(fontsDir);
    expect(files).toContain('custom.ttf');
    expect(files).toContain('icons.woff2');
  });

  it('copies data files to data/ subdirectory', async () => {
    // Create test data files
    await fs.writeFile(path.join(docsDir, 'config.json'), '{"key": "value"}');
    await fs.writeFile(path.join(docsDir, 'data.yaml'), 'key: value');
    await fs.writeFile(path.join(docsDir, 'table.csv'), 'a,b,c\n1,2,3');
    
    await (renderer as any).copyStaticAssets(site);
    
    // Check data files were copied
    const dataDir = path.join(outputDir, 'data');
    const files = await fs.readdir(dataDir);
    expect(files).toContain('config.json');
    expect(files).toContain('data.yaml');
    expect(files).toContain('table.csv');
  });

  it('keeps same-named images from different directories distinct', async () => {
    await fs.mkdir(path.join(docsDir, 'dir1'), { recursive: true });
    await fs.mkdir(path.join(docsDir, 'dir2'), { recursive: true });
    await fs.writeFile(path.join(docsDir, 'dir1', 'image.png'), 'fake data 1');
    await fs.writeFile(path.join(docsDir, 'dir2', 'image.png'), 'fake data 2');
    
    await (renderer as any).copyStaticAssets(site);
    
    // Flattened names match what the parser generates for each reference
    const imgDir = path.join(outputDir, 'img');
    const files = await fs.readdir(imgDir);
    expect(files).toContain('dir1__image.png');
    expect(files).toContain('dir2__image.png');
  });

  it('copies images from the static/ directory with static__ prefix', async () => {
    const staticImgDir = path.join(tempDir, 'static', 'img');
    await fs.mkdir(staticImgDir, { recursive: true });
    await fs.writeFile(path.join(staticImgDir, 'logo.png'), 'fake logo');

    await (renderer as any).copyStaticAssets(site);

    const imgDir = path.join(outputDir, 'img');
    const files = await fs.readdir(imgDir);
    expect(files).toContain('static__img__logo.png');
  });

  it('ignores non-asset files', async () => {
    // Create various files
    await fs.writeFile(path.join(docsDir, 'readme.md'), '# Readme');
    await fs.writeFile(path.join(docsDir, 'script.js'), 'console.log("hello");');
    await fs.writeFile(path.join(docsDir, 'styles.css'), 'body {}');
    
    await (renderer as any).copyStaticAssets(site);
    
    // Check only img, fonts, data directories exist (or don't exist if empty)
    const outputFiles = await fs.readdir(outputDir);
    // Should not create directories for non-assets
    expect(outputFiles).not.toContain('js');
    expect(outputFiles).not.toContain('css');
  });

  it('handles empty docs directory gracefully', async () => {
    // No files in docs dir
    await expect((renderer as any).copyStaticAssets(site)).resolves.not.toThrow();
  });

  it('supports backward compatible copyImages alias', async () => {
    await fs.writeFile(path.join(docsDir, 'test.png'), 'fake data');
    
    // Should work via alias
    await (renderer as any).copyImages(site);
    
    const imgDir = path.join(outputDir, 'img');
    const files = await fs.readdir(imgDir);
    expect(files).toContain('test.png');
  });

  it('converts SVG files to PDF', async () => {
    // Create test SVG file
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="red"/>
    </svg>`;
    await fs.writeFile(path.join(docsDir, 'diagram.svg'), svgContent);
    
    await (renderer as any).copyStaticAssets(site);
    
    // Check SVG was converted to PDF
    const imgDir = path.join(outputDir, 'img');
    const files = await fs.readdir(imgDir);
    expect(files).toContain('diagram.pdf');
    expect(files).not.toContain('diagram.svg'); // Original SVG should not be copied
  });
});
