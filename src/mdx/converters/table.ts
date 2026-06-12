export interface TableConverterOptions {
  enableTextWrap?: boolean;
}

export function convertTables(content: string, options: TableConverterOptions = {}): string {
  const { enableTextWrap = true } = options;
  
  return content.replace(/^\|(.+)\|\n\|[-|\s]+\|\n((?:\|.+\|\n?)+)/gm, (_match, header, rows) => {
    const headers = header.split('|').map((h: string) => h.trim()).filter(Boolean);
    const rowLines = rows.trim().split('\n');
    const rowsData = rowLines.map((row: string) => 
      row.split('|').map((c: string) => c.trim()).filter(Boolean)
    );
    
    const numCols = headers.length;
    let colSpec: string;
    
    if (enableTextWrap) {
      const colWidth = `\\dimexpr\\textwidth/${numCols}-2\\tabcolsep-\\arrayrulewidth\\relax`;
      colSpec = headers.map(() => `p{${colWidth}}`).join('|');
    } else {
      colSpec = headers.map(() => 'l').join('|');
    }
    
    let latex = `\n\\vspace{1em}\n`;
    latex += `\\renewcommand{\\arraystretch}{1.5}\n`;
    latex += `\\begin{tabular}{|${colSpec}|}\n\\hline\n`;
    latex += headers.join(' & ') + ' \\\\\n\\hline\n';
    for (const row of rowsData) {
      latex += row.join(' & ') + ' \\\\\n\\hline\n';
    }
    latex += '\\end{tabular}\n';
    latex += `\\renewcommand{\\arraystretch}{1}\n`;
    latex += '\\vspace{1em}\n\n';
    
    return latex;
  });
}
