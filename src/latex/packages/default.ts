import { LanguageConfig } from '../../docusaurus/types.js';

export interface PackageSet {
  name: string;
  packages: string[];
}

export function getEnginePackages(engine: string, langConfig: LanguageConfig): PackageSet {
  if (engine === 'lualatex') {
    return {
      name: 'lualatex',
      packages: [
        '\\documentclass[11pt,a4paper]{article}',
        '\\usepackage{fontspec}',
        '\\newfontfamily\\emojifont{Twemoji Mozilla}',
        '\\usepackage{emoji}',
        '\\setemojifont{Twemoji Mozilla}',
        '\\usepackage{polyglossia}',
        `\\setmainlanguage{${langConfig.BabelLang}}`,
      ],
    };
  }
  
  if (engine === 'xelatex') {
    return {
      name: 'xelatex',
      packages: [
        '\\documentclass[11pt,a4paper]{article}',
        '\\usepackage{fontspec}',
        '\\usepackage{emoji}', // Emoji support for XeLaTeX
        '\\usepackage{polyglossia}',
        `\\setmainlanguage{${langConfig.BabelLang}}`,
      ],
    };
  }
  
  // pdflatex fallback
  return {
    name: 'pdflatex',
    packages: [
      '\\documentclass[11pt,a4paper]{article}',
      '\\usepackage[utf8]{inputenc}',
      `\\usepackage[${langConfig.FontEnc || 'T1'}]{fontenc}`,
      '\\usepackage{lmodern}',
      `\\usepackage[${langConfig.BabelLang}]{babel}`,
    ],
  };
}

export function getCommonPackages(): PackageSet {
  return {
    name: 'common',
    packages: [
      '\\usepackage{geometry}',
      '\\geometry{margin=2.5cm}',
      '\\usepackage[hidelinks]{hyperref}', // Completely hide link borders and colors
      '\\usepackage{bookmark}', // Better PDF bookmarks
      '\\usepackage{microtype}', // Better typography and hyphenation
      '\\usepackage{csquotes}', // Czech quotes support
      '\\usepackage{listings}',
      '\\lstdefinelanguage{javascript}{',
      '  keywords={break, case, catch, continue, debugger, default, delete, do, else, false, finally, for, function, if, in, instanceof, new, null, return, switch, this, throw, true, try, typeof, var, void, while, with, let, const, class, export, import},',
      '  morecomment=[l]{//},',
      '  morecomment=[s]{/*}{*/},',
      '  morestring=[b]\',',
      '  morestring=[b]"',
      '}',
      '\\lstdefinelanguage{typescript}{',
      '  keywords={break, case, catch, continue, debugger, default, delete, do, else, false, finally, for, function, if, in, instanceof, new, null, return, switch, this, throw, true, try, typeof, var, void, while, with, let, const, class, export, import, as, constructor, interface, type, from, any, number, string, boolean},',
      '  morecomment=[l]{//},',
      '  morecomment=[s]{/*}{*/},',
      '  morestring=[b]\',',
      '  morestring=[b]"',
      '}',
      '\\lstalias{js}{javascript}',
      '\\lstalias{ts}{typescript}',
      '\\usepackage{xcolor}',
      '\\usepackage{tcolorbox}',
      '\\tcbuselibrary{skins,breakable}',
      '\\usepackage{graphicx}',
      '\\DeclareGraphicsExtensions{.pdf,.png,.jpg,.eps}',
      '\\usepackage{epstopdf}', // EPS support
      '\\usepackage{amssymb}',
      '\\usepackage{array}',
      '\\usepackage{fontawesome5}', // Icons for admonitions
      '\\usepackage{float}', // Force exact placement with [H]
      '\\usepackage{caption}', // Better caption control
      '\\captionsetup{justification=centering, singlelinecheck=false}', // Center captions
      '',
      '\\tolerance=3000', // Higher tolerance for line breaking
      '\\emergencystretch=3em', // Allow more stretching
    ],
  };
}

export function getCustomPackages(packages: string[]): PackageSet {
  return {
    name: 'custom',
    packages: packages.map((p) => `\\usepackage{${p}}`),
  };
}
