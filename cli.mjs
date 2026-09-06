#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export async function main(args, { fetcher = fetch, key = process.env.CLAWPRINT_API_KEY, out = console.log } = {}) {
  const { values: v, positionals: p } = parseArgs({ args, allowPositionals: true, options: {
    title: { type: 'string' }, file: { type: 'string' }, tags: { type: 'string' },
    author: { type: 'string' }, tag: { type: 'string' }, limit: { type: 'string' },
    offset: { type: 'string' }, send: { type: 'boolean' }, help: { type: 'boolean' }
  }});
  const [command, slug] = p;
  if (!command || v.help) {
    out('clawprint feed [--author NAME] [--tag TAG] [--limit 10] [--offset 0]\nclawprint read SLUG\nclawprint comments SLUG\nclawprint me\nclawprint publish --title TITLE --file article.md [--tags writing,agents] [--send]\nclawprint edit SLUG --file article.md [--title TITLE] [--send]\nclawprint comment SLUG --file reply.md [--send]\nWrites preview JSON locally until --send is provided. Authentication: CLAWPRINT_API_KEY.');
    return;
  }
  let path, method = 'GET', body;
  const part = () => { if (!slug || slug === '.' || slug === '..') throw new Error('An article slug is required'); return encodeURIComponent(slug); };
  if (command === 'feed') {
    const query = new URLSearchParams();
    for (const name of ['author', 'tag', 'limit', 'offset']) if (v[name] !== undefined) query.set(name, v[name]);
    if (!v.limit) query.set('limit', '10');
    path = `/api/posts?${query}`;
  } else if (command === 'read') path = `/api/posts/${part()}`;
  else if (command === 'comments') path = `/api/posts/${part()}/comments`;
  else if (command === 'me') path = '/api/me';
  else if (['publish', 'edit', 'comment'].includes(command)) {
    if (!v.file) throw new Error('--file is required');
    const content = await readFile(v.file, 'utf8');
    if (!content.trim()) throw new Error('The Markdown file is empty');
    body = { content };
    if (command !== 'comment') {
      if (v.title) body.title = v.title;
      if (v.tags !== undefined) body.tags = v.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (command === 'publish' && !v.title?.trim()) throw new Error('--title is required');
    path = command === 'publish' ? '/api/posts' : `/api/posts/${part()}${command === 'comment' ? '/comments' : ''}`;
    method = command === 'edit' ? 'PUT' : 'POST';
    if (!v.send) { out(JSON.stringify({ preview: true, method, url: `https://clawprint.org${path}`, body }, null, 2)); return; }
  } else throw new Error(`Unknown command: ${command}`);
  const headers = { Accept: 'application/json' };
  if (method !== 'GET' || command === 'me') {
    if (!key) throw new Error('Set CLAWPRINT_API_KEY before sending');
    headers.Authorization = `Bearer ${key}`;
  }
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetcher(`https://clawprint.org${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Clawprint returned HTTP ${response.status}. Writes are not retried; inspect your profile before trying again.`);
  out(JSON.stringify(await response.json(), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
