import { describe, it, expect, vi, beforeEach } from 'vitest';
import docusaurus2PDFPlugin from '../../plugin/index.js';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('Docusaurus Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load plugin via subpath import', async () => {
    const plugin = await import('../../plugin/index.js');
    expect(plugin.default).toBeDefined();
    expect(typeof plugin.default).toBe('function');
  });

  it('should export Docusaurus2PDFPluginOptions type', async () => {
    const plugin = await import('../../plugin/index.js');
    expect(plugin).toBeDefined();
  });

  it('postBuild calls execSync with properly quoted and escaped arguments', async () => {
    const mockContext = {
      siteDir: '/path/with spaces',
    } as any;

    const plugin = docusaurus2PDFPlugin(mockContext, {
      outputDir: 'custom output',
      single: true,
      texOnly: true,
      stripNumbering: true,
      suppressCaptionNumbers: true,
    });

    expect(plugin.name).toBe('docusaurus2pdf');
    expect(plugin.postBuild).toBeDefined();

    await plugin.postBuild!({ outDir: 'any' } as any);

    expect(execSync).toHaveBeenCalled();
    const command = (execSync as any).mock.calls[0][0];

    expect(command).toContain('npx docusaurus2pdf');
    expect(command).toContain('-i "/path/with spaces"');
    expect(command).toContain('-o "/path/with spaces/custom output"');
    expect(command).toContain('--single');
    expect(command).toContain('--tex-only');
    expect(command).toContain('--strip-numbering');
    expect(command).toContain('--suppress-caption-numbers');
    expect(command).toContain('--no-docker');
  });
});
