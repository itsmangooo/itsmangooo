import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { login } from './config.js';
import { validateSnapshot } from './github.js';
import { renderAssets, renderReadme } from './render.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = validateSnapshot(JSON.parse(await readFile(resolve(root,'data/snapshot.json'),'utf8')),login);
const expected = renderAssets(data);
assert.equal((await readdir(resolve(root,'assets'))).filter(name=>name.endsWith('.svg')).length, expected.size);
for (const [name,content] of expected) {
  assert.equal(await readFile(resolve(root,'assets',name),'utf8'),content,`Stale asset: ${name}`);
  assert.match(content,/<svg[^>]+viewBox=/);
  assert.match(content,/<title id="title">/);
  assert.match(content,/<desc id="desc">/);
  assert.doesNotMatch(content,/<(?:script|foreignObject|image|animate)\b|(?:href|onload)=|@import|url\(/i);
  assert.doesNotMatch(content,/NaN|undefined|Infinity/);
}
const readme=await readFile(resolve(root,'README.md'),'utf8');
assert.equal(readme,renderReadme(data),'README differs from its generator.');
const refs=[...readme.matchAll(/(?:src|srcset)="(assets\/[^" ]+)"/g)].map(match=>match[1]);
for (const path of refs) await readFile(resolve(root,path));
assert.doesNotMatch(readme,/<style|<script|style=/i);
console.log(`Verified ${expected.size} SVGs, ${refs.length} image references, snapshot arithmetic, and generated README.`);
