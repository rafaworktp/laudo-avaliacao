import { copyFile, mkdir, rm } from 'node:fs/promises';

const files = ['index.html', 'app.js', 'cliente.html', 'config.js', 'logo.png', '_headers'];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of files) await copyFile(file, `dist/${file}`);
console.log('dist pronto: ' + files.join(', '));
