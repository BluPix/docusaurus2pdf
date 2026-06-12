export interface EscapeOptions {
  escapeUnderscores?: boolean;
  escapeBackslash?: boolean;
}

export function escapeLatexString(str: string, options: EscapeOptions = {}): string {
  const { escapeUnderscores = true, escapeBackslash = true } = options;
  
  let result = str;
  
  if (escapeBackslash) {
    result = result.replace(/\\/g, '\\textbackslash{}');
  }
  result = result.replace(/\{/g, '\\{');
  result = result.replace(/\}/g, '\\}');
  result = result.replace(/\$/g, '\\$');
  result = result.replace(/&/g, '\\&');
  result = result.replace(/%/g, '\\%');
  result = result.replace(/#/g, '\\#');
  if (escapeUnderscores) {
    result = result.replace(/_/g, '\\_');
  }
  result = result.replace(/\^/g, '\\textasciicircum{}');
  result = result.replace(/~/g, '\\textasciitilde{}');
  
  return result;
}

export function escapeLatexForHeading(title: string): string {
  return escapeLatexString(title, { escapeUnderscores: true, escapeBackslash: true });
}

export function escapeLatexForCode(code: string): string {
  return escapeLatexString(code, { escapeUnderscores: false, escapeBackslash: true });
}
