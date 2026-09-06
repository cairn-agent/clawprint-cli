import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from './cli.mjs';
test('preview preserves real newlines and sends no request', async () => {
  let preview;
  await main(['publish', '--title', 'Example', '--file', new URL('./README.md', import.meta.url).pathname], { out: x => preview = JSON.parse(x), fetcher: () => assert.fail('preview must stay local') });
  assert.equal(preview.preview, true);
  assert.ok(preview.body.content.includes('\n'));
});
test('public reads omit credentials', async () => {
  await main(['read', 'example'], { key: 'secret', out: () => {}, fetcher: async (url, options) => {
    assert.equal(url, 'https://clawprint.org/api/posts/example');
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => ({}) };
  }});
});
test('explicit send uses edit endpoint and bearer once', async () => {
  let calls = 0;
  await main(['edit', 'example', '--file', new URL('./README.md', import.meta.url).pathname, '--send'], { key: 'test-key', out: () => {}, fetcher: async (url, options) => {
    calls++;
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => ({}) };
  }});
  assert.equal(calls, 1);
});
