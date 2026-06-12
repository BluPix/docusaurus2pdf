import { readFileSync, accessSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load TeaVM PlantUML JS files
const possibleVendorPaths = [
  join(__dirname, '../../vendor'),
  join(__dirname, '../../../vendor'),
  join(__dirname, '../../../node_modules/docusaurus2pdf/vendor'),
];

let vendorDir = '';
for (const p of possibleVendorPaths) {
  try {
    accessSync(p);
    vendorDir = p;
    break;
  } catch {
    continue;
  }
}

const plantumlJsPath = vendorDir ? join(vendorDir, 'plantuml.js') : '';
const vizJsPath = vendorDir ? join(vendorDir, 'viz-global.js') : '';

export interface PlantUMLJSRenderer {
  render(diagram: string, format?: 'svg' | 'png'): Promise<string>;
}

export function createPlantUMLJSRenderer(): PlantUMLJSRenderer {
  // Read JS files
  const vizCode = readFileSync(vizJsPath, 'utf-8');
  const plantumlCode = readFileSync(plantumlJsPath, 'utf-8');

  let initialized = false;
  let renderFn: ((lines: string[], elementId: string, format?: string) => void) | null = null;
  let initError: Error | null = null;

  const init = async (): Promise<void> => {
    if (initialized || initError) return;

    try {
      // Use jsdom for better browser environment with WebAssembly support
      const { JSDOM } = await import('jsdom');

      // Create DOM with runScripts: 'dangerously' to allow script execution
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        resources: 'usable',
        url: 'file://' + dirname(vizJsPath) + '/',
      });

      const window = dom.window;

      // Load Viz.js by executing it in the DOM context
      const vizScript = window.document.createElement('script');
      vizScript.textContent = vizCode;
      window.document.head.appendChild(vizScript);

      // Wait for Viz to be available
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if Viz loaded
      if (!(window as unknown as Record<string, unknown>).Viz) {
        console.log('Viz not found in window, trying alternative loading...');
      }

      // Load PlantUML.js
      const plantumlScript = window.document.createElement('script');
      plantumlScript.textContent = plantumlCode;
      window.document.head.appendChild(plantumlScript);

      // Wait for plantuml to initialize
      await new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
          const win = window as unknown as Record<string, unknown>;
          const puml = win.plantuml || (win.B as Record<string, unknown> | undefined)?.plantuml;

          if (puml && typeof puml === 'object' && 'render' in puml) {
            renderFn = (puml as { render: (lines: string[], elementId: string, format?: string) => void }).render;
            console.log('PlantUML initialized successfully via jsdom');
            resolve();
          } else if (Date.now() - startTime > 15000) {
            reject(new Error('PlantUML.js initialization timeout after 15s'));
          } else {
            setTimeout(check, 300);
          }
        };
        check();
      });

      initialized = true;
    } catch (err) {
      initError = err as Error;
      console.error('Failed to initialize PlantUML.js:', err);
      throw initError;
    }
  };

  return {
    async render(diagram: string, format: 'svg' | 'png' = 'svg'): Promise<string> {
      await init();

      if (!renderFn) {
        throw new Error('PlantUML.js not initialized');
      }

      const elementId = `puml-${Date.now()}`;
      const lines = diagram.split(/\r?\n/);

      // Create output container
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        runScripts: 'dangerously',
      });

      // Create element for output
      const container = dom.window.document.createElement('div');
      container.id = elementId;
      dom.window.document.body.appendChild(container);

      // Create render function wrapper
      const win = dom.window as unknown as Record<string, unknown>;
      win.plantuml = { render: renderFn };

      // Call render (synchronously in jsdom)
      try {
        renderFn(lines, elementId, format);
      } catch (e) {
        console.error('Render error:', e);
      }

      // Get SVG from container
      const svg = container.innerHTML;
      if (!svg || !svg.includes('<svg')) {
        throw new Error('PlantUML render failed - no SVG output');
      }

      return svg;
    },
  };
}
