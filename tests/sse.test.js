const test = require('node:test'), assert = require('node:assert/strict');
require('./_ambiente');

test('parseSSE(): separa eventos completos, junta linhas data, guarda o resto incompleto', () => {
  const a = parseSSE('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Olá"}}\n\nevent: ping\ndata: {"type":"ping"}\n\ndata: {"parcial":');
  assert.equal(a.eventos.length, 2);
  assert.equal(a.eventos[0].event, 'content_block_delta'); assert.equal(a.eventos[0].json.delta.text, 'Olá');
  assert.equal(a.eventos[1].event, 'ping');
  assert.equal(a.resto, 'data: {"parcial":', 'o evento incompleto fica para a próxima leitura');
  const b = parseSSE(a.resto + ' 1}\n\n');
  assert.deepEqual(b.eventos[0].json, {parcial: 1}); assert.equal(b.resto, '');
});

test('parseSSE(): CRLF, [DONE] da OpenAI sem JSON e bloco sem data ignorado', () => {
  const r = parseSSE('data: {"choices":[{"delta":{"content":"a"}}]}\r\n\r\ndata: [DONE]\r\n\r\n: comentário\r\n\r\n');
  assert.equal(r.eventos.length, 2);
  assert.equal(r.eventos[0].json.choices[0].delta.content, 'a');
  assert.equal(r.eventos[1].data, '[DONE]'); assert.equal(r.eventos[1].json, null);
});
