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
        '% Fallback fonts: box-drawing chars (directory trees) come from',
        '% DejaVu, raw emoji from Twemoji - otherwise these glyphs silently',
        '% disappear from the PDF ("Missing character" warnings)',
        '\\directlua{luaotfload.add_fallback("d2pfallback", {',
        '  "DejaVuSans:mode=harf;",',
        '  "DejaVuSansMono:mode=harf;",',
        '  "TwemojiMozilla:mode=harf;",',
        '})}',
        '\\setmainfont{Latin Modern Roman}[RawFeature={fallback=d2pfallback}]',
        '\\setsansfont{Latin Modern Sans}[RawFeature={fallback=d2pfallback}]',
        '% Mono font with native box-drawing glyphs: fallback-font glyphs',
        '% break line layout inside lstlisting, so code needs a font that',
        '% covers directory trees directly',
        '\\setmonofont{DejaVu Sans Mono}[Scale=MatchLowercase]',
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
      '\\usepackage{amsmath}', // \\text, align/gather, matrices (KaTeX parity)
      '\\usepackage{xcolor}',
      '\\usepackage[hidelinks]{hyperref}', // Completely hide link borders and colors
      '\\usepackage{bookmark}', // Better PDF bookmarks
      '\\usepackage{microtype}', // Better typography and hyphenation
      '\\usepackage{fvextra}', // Unicode-clean verbatim for non-Latin code blocks
      '\\usepackage{csquotes}', // Czech quotes support (after fvextra)
      '\\usepackage{listings}',
      '% Global listings style: wrap long lines (with a return marker) so',
      '% code never overflows the page; light frame and background',
      '\\lstset{',
      '  basicstyle=\\ttfamily\\footnotesize,',
      '  breaklines=true,',
      '  breakatwhitespace=false,',
      '  postbreak=\\mbox{\\textcolor{gray}{$\\hookrightarrow$}\\space},',
      '  columns=fullflexible,',
      '  keepspaces=true,',
      '  showstringspaces=false,',
      '  tabsize=2,',
      '  frame=single,',
      '  rulecolor=\\color{black!20},',
      '  backgroundcolor=\\color{black!4},',
      '  numberstyle=\\tiny\\color{black!50},',
      '  keywordstyle=\\bfseries,',
      '  commentstyle=\\color{black!55}\\itshape,',
      '  stringstyle=\\color{black!70},',
      '  captionpos=b,',
      '  aboveskip=1em,',
      '  belowskip=1em,',
      '}',
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
      '\\usepackage{tcolorbox}',
      '\\tcbuselibrary{skins,breakable}',
      '\\usepackage{graphicx}',
      '\\DeclareGraphicsExtensions{.pdf,.png,.jpg,.eps}',
      '\\usepackage{epstopdf}', // EPS support
      '% Image inclusion helper: natural size, capped at the line width and',
      '% 0.45\\textheight; typesets a visible placeholder when a file is missing',
      '\\newsavebox{\\dtopimgbox}',
      '\\newcommand{\\docimage}[2][]{%',
      '  \\IfFileExists{#2}{%',
      '    \\sbox{\\dtopimgbox}{\\includegraphics[#1]{#2}}%',
      '    \\ifdim\\wd\\dtopimgbox>\\linewidth',
      '      \\resizebox{\\linewidth}{!}{\\usebox{\\dtopimgbox}}%',
      '    \\else\\ifdim\\ht\\dtopimgbox>0.45\\textheight',
      '      \\resizebox{!}{0.45\\textheight}{\\usebox{\\dtopimgbox}}%',
      '    \\else',
      '      \\usebox{\\dtopimgbox}%',
      '    \\fi\\fi',
      '  }{%',
      '    \\fbox{\\footnotesize\\texttt{missing image: \\detokenize{#2}}}%',
      '  }%',
      '}',
      '\\usepackage[normalem]{ulem}', // \\sout strikethrough without changing \\emph
      '\\usepackage{amssymb}',
      '\\usepackage{array}',
      '\\usepackage{longtable}', // Tables that break across pages
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
