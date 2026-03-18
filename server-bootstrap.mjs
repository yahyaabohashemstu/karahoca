import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;
const originalEnvKeys = new Set(Object.keys(process.env));

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const fileContent = readFileSync(filePath, 'utf8');
  const lines = fileContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, '');

    if (originalEnvKeys.has(key)) {
      continue;
    }

    // السماح للملفات الأحدث بتجاوز القيم القادمة من ملفات أقدم،
    // مع الحفاظ على أولوية متغيرات البيئة القادمة من النظام نفسه.
    process.env[key] = normalizedValue;
  }
};

const envMode = process.env.NODE_ENV;
const envFiles = ['.env', '.env.local'];

if (envMode) {
  envFiles.push(`.env.${envMode}`);
  envFiles.push(`.env.${envMode}.local`);
}

for (const envFile of envFiles) {
  loadEnvFile(path.join(projectRoot, envFile));
}

await import(pathToFileURL(path.join(projectRoot, 'server', 'server.mjs')).href);
