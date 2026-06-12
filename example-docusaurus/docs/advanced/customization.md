---
title: Customization
sidebar_position: 1
---

# Customization

## LaTeX Template

The converter uses a default LaTeX template. You can override it by providing a custom template file.

### Template Variables

- `{{TITLE}}` - Document title
- `{{AUTHOR}}` - Document author
- `{{CONTENT}}` - Main content body
- `{{TOC}}` - Table of contents placeholder

### Custom Preamble

Add custom LaTeX packages:

```latex
\usepackage{custom-package}
\definecolor{brand}{RGB}{255,100,50}
```

## Styling Admonitions

Docusaurus admonitions are converted to `tcolorbox` environments. Customize colors:

```latex
\definecolor{customnote}{RGB}{100,150,200}
\newtcolorbox{custombox}{
  colback=customnote!5,
  colframe=customnote,
  title=Note
}
```

## Code Highlighting

The converter uses `listings` package for code blocks. Customize styles:

```latex
\lstset{
  backgroundcolor=\color{gray!10},
  basicstyle=\ttfamily\small,
  keywordstyle=\color{blue}\bfseries,
  commentstyle=\color{green!50!black},
}
```

:::tip
For better UTF-8 support, use XeLaTeX or LuaLaTeX instead of pdfLaTeX.
:::

## Output Directories

Structure your output:

```
output/
├── documentation.pdf      # Single mode
├── tutorial.pdf           # Per-section mode
├── api.pdf
└── assets/
    └── images/
```
