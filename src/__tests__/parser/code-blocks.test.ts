import { describe, it, expect } from 'vitest';

describe('Code Block Conversion', () => {
  const convertCodeBlocks = (content: string): string => {
    return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const langMap: Record<string, string> = {
        json: 'javascript',
        yaml: 'python',
        yml: 'python',
        mermaid: 'none',
        'mermaid-js': 'none',
      };
      const mappedLang = lang in langMap ? langMap[lang] : (lang || '');
      const langParam = (mappedLang && mappedLang !== 'none') ? `[language=${mappedLang},escapechar=]` : '[escapechar=]';
      return `\\begin{lstlisting}${langParam}\n${code}\\end{lstlisting}`;
    });
  };

  it('converts javascript code block', () => {
    const input = '```javascript\nconst x = 1;\n```';
    const result = convertCodeBlocks(input);
    expect(result).toContain('language=javascript');
    expect(result).toContain('const x = 1;');
  });

  it('converts python code block', () => {
    const input = '```python\nprint("hello")\n```';
    const result = convertCodeBlocks(input);
    expect(result).toContain('language=python');
  });

  it('converts json code block to javascript', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = convertCodeBlocks(input);
    expect(result).toContain('language=javascript');
  });

  it('converts yaml code block to python', () => {
    const input = '```yaml\nkey: value\n```';
    const result = convertCodeBlocks(input);
    expect(result).toContain('language=python');
  });

  it('handles mermaid as plain text without language', () => {
    const input = '```mermaid\ngraph TD;\nA-->B;\n```';
    const result = convertCodeBlocks(input);
    expect(result).toContain('[escapechar=]');
    expect(result).not.toContain('language=');
  });

  it('handles unknown language with language param', () => {
    const input = '```unknownlang\nsome code\n```';
    const result = convertCodeBlocks(input);
    // Unknown languages are passed through as-is
    expect(result).toContain('language=unknownlang');
    expect(result).toContain('escapechar=');
  });

  it('handles code block without language', () => {
    const input = '```\nsome code\n```';
    const result = convertCodeBlocks(input);
    expect(result).toContain('[escapechar=]');
  });

  it('preserves code content correctly', () => {
    const input = '```javascript\nfunction test() {\n  return true;\n}\n```';
    const result = convertCodeBlocks(input);
    expect(result).toContain('function test()');
    expect(result).toContain('return true;');
  });
});
