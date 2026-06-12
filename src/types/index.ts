/**
 * Core types for Docusaurus2PDF
 */

// Site and navigation types
export interface Site {
  Root: string;
  DocsDir: string;
  Sidebars: Category[];
  Pages: DocPage[];
  Config?: SiteConfig;
  DefaultLocale?: string;
}

export interface SiteConfig {
  Title: string;
  Tagline?: string;
  URL?: string;
}

export interface Category {
  Type: string;
  Label: string;
  Items: SidebarItem[];
  Link?: Link;
}

export interface SidebarItem {
  Type: string;
  ID?: string;
  Label?: string;
  Items?: SidebarItem[];
}

export interface Link {
  Type: string;
  ID: string;
}

export interface DocPage {
  Path: string;
  ID: string;
  Title: string;
  Content: string;
  Language: string;
  Frontmatter: Record<string, unknown>;
}

// LaTeX language configuration
export interface LanguageConfig {
  BabelLang: string;
  FontEnc: string;
  Packages: string[];
  Vlna: boolean;
  XeTeX: boolean;
}

export const SupportedLanguages: Record<string, LanguageConfig> = {
  cs: {
    BabelLang: 'czech',
    FontEnc: 'T1',
    Packages: [],
    Vlna: true,
    XeTeX: false,
  },
  en: {
    BabelLang: 'english',
    FontEnc: 'T1',
    Packages: [],
    Vlna: false,
    XeTeX: false,
  },
  de: {
    BabelLang: 'ngerman',
    FontEnc: 'T1',
    Packages: [],
    Vlna: false,
    XeTeX: false,
  },
  sk: {
    BabelLang: 'slovak',
    FontEnc: 'T1',
    Packages: [],
    Vlna: true,
    XeTeX: false,
  },
};

// Parser types
export interface ParsedPage {
  Title: string;
  Content: string;
  Frontmatter: Record<string, unknown>;
  PlantUMLDiagrams: Array<{ hash: string; code: string }>;
  MermaidDiagrams: Array<{ hash: string; code: string }>;
}

export interface MDXParserOptions {
  stripManualNumbering?: boolean;
  convertEmoji?: boolean;
  useEmojiCommands?: boolean;
  suppressCaptionNumbers?: boolean;
  /** Document language; enables language-specific typography (vlna for cs/sk). */
  language?: string;
}

// Renderer types
export interface RendererOptions {
  OutputDir: string;
  Engine: 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic';
  Sections?: string[];
  StripManualNumbering?: boolean;
  ConvertEmoji?: boolean;
  SuppressCaptionNumbers?: boolean;
  SkipDiagrams?: boolean;
}

// LaTeX generator types
export interface LatexGeneratorOptions {
  Engine: 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic';
  Title: string;
  Language: string;
  Date: string;
  Author?: string;
}

export interface DocumentSection {
  Title: string;
  Content: string;
  Level: number;
  PlantUMLDiagrams?: Array<{ hash: string; code: string }>;
  MermaidDiagrams?: Array<{ hash: string; code: string }>;
}

// CLI types
export interface CLIOptions {
  input: string;
  output: string;
  engine: 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic';
  single: boolean;
  perLanguage: boolean;
  texOnly: boolean;
  compileOnly: boolean;
  docker: boolean;
  stripNumbering: boolean;
  convertEmoji: boolean;
  suppressCaptionNumbers: boolean;
  sections?: string;
}

// Plugin types
export interface PluginOptions {
  outputDir?: string;
  engine?: 'lualatex' | 'xelatex' | 'pdflatex' | 'tectonic';
  sections?: string[];
}
