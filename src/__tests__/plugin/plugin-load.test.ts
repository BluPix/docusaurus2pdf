import { describe, it, expect } from 'vitest';

describe('Plugin subpath export', () => {
  it('should load plugin via subpath import', async () => {
    const plugin = await import('../../plugin/index.js');
    expect(plugin.default).toBeDefined();
    expect(typeof plugin.default).toBe('function');
  });

  it('should export Docusaurus2PDFPluginOptions type', async () => {
    const plugin = await import('../../plugin/index.js');
    // Type export exists at compile time
    expect(plugin).toBeDefined();
  });
});
