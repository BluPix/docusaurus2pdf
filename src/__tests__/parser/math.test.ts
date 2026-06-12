import { describe, it, expect } from 'vitest';
import { MDXParser } from '../../mdx/parser.js';

describe('Math Equations', () => {
  const parser = new MDXParser();

  it('should preserve inline math $...$', async () => {
    const input = `# Math Test

Inline math: $E = mc^2$

More text`;

    const result = await parser.parse(input);
    expect(result.Content).toContain('$E = mc^2$');
  });

  it('should convert block math $$...$$ to \\[...\\]', async () => {
    const input = `# Math Test

Block math:

$$
\\int_{a}^{b} f(x) dx = F(b) - F(a)
$$

End`;

    const result = await parser.parse(input);
    expect(result.Content).toContain('\\[\\int_{a}^{b} f(x) dx = F(b) - F(a)\\]');
  });

  it('should handle complex math equations', async () => {
    const input = `# Formula

The equation $f(x) = \\sum_{i=0}^{n} a_i x^i$ is a polynomial.

$$
\\frac{d}{dx} \\left( \\int_{a}^{x} f(t) dt \\right) = f(x)
$$
`;

    const result = await parser.parse(input);
    expect(result.Content).toContain('$f(x) = \\sum_{i=0}^{n} a_i x^i$');
    expect(result.Content).toContain('\\[');
  });

  it('should not escape special chars inside math', async () => {
    const input = `
# Test

Math with special chars: $x^2 + y_1 = z$

$$a \\times b = c$$
`;
    const result = await parser.parse(input);
    // ^ should NOT be escaped to \textasciicircum{} inside math
    expect(result.Content).toContain('$x^2');
    // Block math is converted to \[...\]
    expect(result.Content).toContain('\\[a \\times b = c\\]');
  });
});
