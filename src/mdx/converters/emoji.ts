export interface EmojiConverterOptions {
  // With LuaLaTeX + emoji package, we keep emoji as-is
  // For older engines, we could convert to text
}

export function convertEmoji(content: string, _options: EmojiConverterOptions = {}): string {
  // Keep emoji characters - LuaLaTeX with emoji package will render them
  // Just remove variation selectors that might cause issues
  return content.replace(/[\u{FE00}-\u{FE0F}]/gu, '');
}
