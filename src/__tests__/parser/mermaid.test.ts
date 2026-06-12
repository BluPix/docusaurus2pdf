import { describe, it, expect } from 'vitest';
import { MDXParser } from '../../mdx/parser.js';

describe('Mermaid Diagrams', () => {
  const parser = new MDXParser();

  it('should extract mermaid code blocks', async () => {
    const input = `# Test

Some text

\`\`\`mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`

More text`;

    const result = await parser.parse(input);
    expect(result.MermaidDiagrams).toHaveLength(1);
    expect(result.MermaidDiagrams?.[0].code).toContain('graph TD');
    expect(result.Content).toContain('mermaid_');
  });

  it('should handle multiple mermaid diagrams', async () => {
    const input = `# Test

\`\`\`mermaid
graph LR
    X-->Y
\`\`\`

Some text

\`\`\`mermaid
pie title Pets
    "Dogs" : 386
    "Cats" : 85
\`\`\`
`;

    const result = await parser.parse(input);
    expect(result.MermaidDiagrams).toHaveLength(2);
  });

  it('should replace mermaid blocks with image references in content', async () => {
    const input = `# Test

\`\`\`mermaid
flowchart LR
    A[B] --> C
\`\`\`
`;

    const result = await parser.parse(input);
    expect(result.Content).toContain('\\docimage');
    expect(result.Content).toContain('mermaid_');
    expect(result.Content).toContain('.pdf');
  });
});
