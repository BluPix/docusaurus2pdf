export interface ListConverterOptions {
  itemizeEnvironment?: string;
}

const DEFAULT_LIST_OPTIONS: Required<ListConverterOptions> = {
  itemizeEnvironment: 'itemize',
};

export function convertLists(content: string, options: ListConverterOptions = {}): string {
  const opts = { ...DEFAULT_LIST_OPTIONS, ...options };
  const lines = content.split('\n');
  const result: string[] = [];
  let inItemize = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const itemMatch = line.match(/^(\s*)-\s+(.+)$/);
    
    if (itemMatch) {
      if (!inItemize) {
        result.push(`\\begin{${opts.itemizeEnvironment}}`);
        inItemize = true;
      }
      result.push(`\\item ${itemMatch[2]}`);
    } else {
      if (inItemize) {
        result.push(`\\end{${opts.itemizeEnvironment}}`);
        inItemize = false;
      }
      result.push(line);
    }
  }
  
  if (inItemize) {
    result.push(`\\end{${opts.itemizeEnvironment}}`);
  }
  
  return result.join('\n');
}
