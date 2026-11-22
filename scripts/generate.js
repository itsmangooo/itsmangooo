import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { login } from './config.js';
import { fetchSnapshot, validateSnapshot } from './github.js';
import { renderAssets, renderReadme } from './render.js';

export async function generate({ root, offline = false, token, now, fetchImpl, sleep } = {}) {
  const snapshot = offline
    ? JSON.parse(await readFile(resolve(root,'data/snapshot.json'),'utf8'))
    : await fetchSnapshot({ token, login, now, fetchImpl, sleep });
  validateSnapshot(snapshot,login);
  // Compute and validate everything before touching the previous good outputs.
  const outputs = new Map([...renderAssets(snapshot)].map(([name,content])=>[`assets/${name}`,content]));
  outputs.set('README.md',renderReadme(snapshot));
  outputs.set('data/snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
  let changed = 0;
  for (const [path,content] of outputs) {
    const target = resolve(root,path);
    let old;
    try { old = await readFile(target,'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (old === content) continue;
    await mkdir(dirname(target),{recursive:true});
    await writeFile(target,content,'utf8');
    changed++;
  }
  return { changed, snapshot };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await generate({ root: fileURLToPath(new URL('../',import.meta.url)),
      offline:process.argv.includes('--offline'), token:process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN });
    console.log(`${result.changed} files changed. Public snapshot: ${result.snapshot.capturedOn}.`);
  } catch (error) {
    // All upstream failures happen before writes. Leave the committed images and
    // dated README untouched, fail visibly in Actions, and retry next schedule.
    console.error(`Refresh failed: ${error.message}`);
    process.exitCode=1;
  }
}
