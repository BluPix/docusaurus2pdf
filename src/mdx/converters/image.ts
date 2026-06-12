export interface ImageConverterOptions {
  imageSubdirectory?: string;
  maxWidth?: string;
  maxHeight?: string;
}

const DEFAULT_OPTIONS: Required<ImageConverterOptions> = {
  imageSubdirectory: 'img',
  maxWidth: '0.95\\textwidth',
  maxHeight: '0.5\\textheight',
};

export function convertImages(content: string, options: ImageConverterOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, path) => {
    const cleanPath = path.replace(/^\.\//, '');
    const imagePath = `${opts.imageSubdirectory}/${cleanPath.split('/').pop()}`;
    return `\\begin{center}\\includegraphics[width=${opts.maxWidth},height=${opts.maxHeight},keepaspectratio]{${imagePath}}\\end{center}`;
  });
}
