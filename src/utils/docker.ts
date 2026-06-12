import { spawn } from 'child_process';
import * as path from 'path';
import { promises as fs } from 'fs';

export async function checkDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['version'], { stdio: 'ignore' });
    proc.on('exit', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

export async function checkDockerImage(image: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['images', '-q', image], { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    proc.stdout?.on('data', (data) => output += data);
    proc.on('exit', () => resolve(output.trim().length > 0));
    proc.on('error', () => resolve(false));
  });
}

export async function checkLocalTeX(): Promise<{ available: boolean; engine: string }> {
  const lualatex = await commandExists('lualatex');
  if (lualatex) return { available: true, engine: 'lualatex' };
  
  const xelatex = await commandExists('xelatex');
  if (xelatex) return { available: true, engine: 'xelatex' };
  
  const pdflatex = await commandExists('pdflatex');
  if (pdflatex) return { available: true, engine: 'pdflatex' };
  
  return { available: false, engine: '' };
}

async function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('which', [cmd], { stdio: 'ignore' });
    proc.on('exit', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function getLatexErrorFromLog(outputDir: string, basename: string): Promise<string> {
  const logFile = path.join(outputDir, basename.replace(/\.tex$/i, '.log'));
  try {
    const logContent = await fs.readFile(logFile, 'utf-8');
    const lines = logContent.split('\n');
    const errors: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('! ')) {
        errors.push(line);
        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('! ') && lines[j].trim() !== '') {
          errors.push(lines[j]);
          j++;
        }
        break; 
      }
    }
    
    if (errors.length > 0) {
      return errors.join('\n');
    }
    return 'No error message found in LaTeX log file.';
  } catch (err) {
    return `Could not read LaTeX log file: ${err}`;
  }
}

export async function buildPDF(
  texFile: string, 
  outputDir: string, 
  engine: 'lualatex' | 'xelatex' | 'tectonic' | 'pdflatex' = 'lualatex',
  useDocker: boolean = true
): Promise<void> {
  const absPath = path.resolve(outputDir);
  const basename = path.basename(texFile);
  
  if (!useDocker) {
    return buildPDFLocal(absPath, basename, engine);
  }
  
  return new Promise((resolve, reject) => {
    let cmd: string[];
    
    if (engine === 'tectonic') {
      cmd = [
        'run', '--rm',
        '-v', `${absPath}:/work`,
        '-w', '/work',
        'docusaurus2pdf-tectonic',
        'tectonic', basename
      ];
    } else {
      const texLiveImage = 'texlive/texlive:latest';
      const texEngine = engine === 'lualatex' ? 'lualatex' : 'xelatex';
      cmd = [
        'run', '--rm',
        '-v', `${absPath}:/work`,
        '-w', '/work',
        texLiveImage,
        'sh', '-c',
        `${texEngine} -shell-escape -interaction=nonstopmode "${basename}" && ${texEngine} -shell-escape -interaction=nonstopmode "${basename}"`
      ];
    }
    
    const proc = spawn('docker', cmd, { stdio: 'inherit' });
    
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`LaTeX compilation timed out after 60 seconds.`));
    }, 60000);

    proc.on('exit', async (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const logErr = await getLatexErrorFromLog(outputDir, basename);
        reject(new Error(`Docker build failed with exit code ${code}.\nLaTeX Log Details:\n${logErr}`));
      }
    });
    
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function buildPDFLocal(
  cwd: string,
  texFile: string,
  engine: string
): Promise<void> {
  const cmd = engine === 'pdflatex' ? 'pdflatex' : (engine === 'lualatex' ? 'lualatex' : 'xelatex');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('sh', ['-c', 
      `cd "${cwd}" && ${cmd} -shell-escape -interaction=nonstopmode "${texFile}" && ${cmd} -shell-escape -interaction=nonstopmode "${texFile}"`
    ], { stdio: 'inherit' });
    
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`LaTeX compilation timed out after 60 seconds.`));
    }, 60000);

    proc.on('exit', async (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const logErr = await getLatexErrorFromLog(cwd, texFile);
        reject(new Error(`${cmd} failed with exit code ${code}.\nLaTeX Log Details:\n${logErr}`));
      }
    });
    
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function compileAllPDFs(
  outputDir: string,
  engine: 'lualatex' | 'xelatex' | 'tectonic' | 'pdflatex' = 'lualatex',
  useDocker: boolean = true
): Promise<string[]> {
  const files = await fs.readdir(outputDir);
  const texFiles = files.filter(f => f.endsWith('.tex'));
  const built: string[] = [];
  
  for (const texFile of texFiles) {
    const fullPath = path.join(outputDir, texFile);
    try {
      await buildPDF(fullPath, outputDir, engine, useDocker);
      built.push(texFile.replace('.tex', '.pdf'));
    } catch (err) {
      console.error(`Failed to build ${texFile}:`, err);
    }
  }
  
  return built;
}
