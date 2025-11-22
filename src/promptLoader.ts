import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadPrompt(relativePath: string): string {
  const basePath = path.join(__dirname, '..', 'bluekit-prompts');
  const fullPath = path.join(basePath, relativePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Prompt not found: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, 'utf8');
}

