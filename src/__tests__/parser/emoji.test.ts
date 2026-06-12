import { describe, it, expect } from 'vitest';

describe('Emoji Conversion', () => {
  const convertEmoji = (content: string): string => {
    let result = content;
    
    const emojiMap: Record<string, string> = {
      'camera': '[Camera]',
      'video': '[Video]',
      'phone': '[Phone]',
      'computer': '[Computer]',
      'warning': '[Warning]',
      'lightning': '[Lightning]',
      'fire': '[Fire]',
      'ok': '[OK]',
      'error': '[Error]',
      'arrow_right': '->',
      'arrow_left': '<-',
      'arrow_up': '^',
      'arrow_down': 'v',
    };
    
    for (const [emoji, text] of Object.entries(emojiMap)) {
      result = result.replace(new RegExp(emoji, 'g'), text);
    }
    
    // Remove remaining emoji and variation selectors
    result = result.replace(/[\u{FE00}-\u{FE0F}]/gu, '');
    result = result.replace(/[\u{1F300}-\u{1F9FF}]/gu, '[emoji]');
    
    return result;
  };

  it('replaces camera emoji', () => {
    const input = 'Take a photo camera';
    const result = convertEmoji(input);
    expect(result).toContain('[Camera]');
  });

  it('removes variation selectors', () => {
    const input = 'Test\uFE0F';
    const result = convertEmoji(input);
    expect(result).toBe('Test');
  });

  it('replaces unknown emoji with placeholder', () => {
    const input = 'Test \u{1F600}';
    const result = convertEmoji(input);
    expect(result).toContain('[emoji]');
  });
});
