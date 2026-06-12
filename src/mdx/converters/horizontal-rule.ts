export interface HorizontalRuleOptions {
  latexCommand?: 'hrule' | 'pagebreak' | 'newpage' | 'vspace';
  vspaceAmount?: string;
}

export function convertHorizontalRules(
  content: string, 
  options: HorizontalRuleOptions = {}
): string {
  const { latexCommand = 'vspace', vspaceAmount = '1em' } = options;
  
  // Match horizontal rules: ---, ***, or ___ on their own line
  const hrRegex = /^(\s*[-*_]{3,}\s*)$/gm;
  
  return content.replace(hrRegex, () => {
    switch (latexCommand) {
      case 'hrule':
        return '\\hrule\\vspace{0.5em}';
      case 'pagebreak':
        return '\\pagebreak';
      case 'newpage':
        return '\\newpage';
      case 'vspace':
      default:
        return `\\vspace{${vspaceAmount}}`;
    }
  });
}
