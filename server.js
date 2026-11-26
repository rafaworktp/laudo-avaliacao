/*
 * Servidor do LaudoAvaliacao — Node.js puro, sem dependências.
 * - Serve o painel e o formulário do cliente.
 * - Recebe solicitações do cliente por link (POST).
 * - Guarda laudos, solicitações e comparáveis em arquivos JSON.
 * - Painel protegido por senha (ADMIN_PASSWORD).
 *
 * Uso:
 *   node server.js
 *   PORT=8787 ADMIN_PASSWORD=... node server.js
 *   PUBLIC_URL=https://seu-dominio.com node server.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const LAUDOS = path.join(DATA, 'laudos');
const SOLICITACOES = path.join(DATA, 'solicitacoes');
const COMPARAVEIS = path.join(DATA, 'comparaveis.json');
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'laudo123';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const MAX_BODY = 80 * 1024 * 1024;

for (const dir of [DATA, LAUDOS, SOLICITACOES]) fs.mkdirSync(dir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon'
};

function safeId(v) {
  const s = String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return s || crypto.randomBytes(9).toString('base64url');
}
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers['content-length'] || 0);
    if (len > MAX_BODY) { reject(Object.assign(new Error('payload muito grande'), { status: 413 })); return; }
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('payload muito grande'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { reject(Object.assign(new Error('JSON inválido'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJson(file, obj) {
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function listFiles(dir) {
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch (e) { return []; }
}
function isAdmin(req) {
  return String(req.headers['x-admin-key'] || '') === ADMIN_PASSWORD;
}
function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  json(res, 401, { ok: false, erro: 'senha do painel inválida' });
  return false;
}
function publicBase(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host = String(req.headers.host || ('127.0.0.1:' + PORT));
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return proto + '://' + host;
}
function lanUrl() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return 'http://' + net.address + ':' + PORT;
    }
  }
  return 'http://127.0.0.1:' + PORT;
}

async function handleApi(req, res, url) {
  const p = url.pathname;
  if (req.method === 'OPTIONS') { json(res, 204, {}); return; }

  if (p === '/api/health' && req.method === 'GET') {
    json(res, 200, { ok: true, servico: 'laudo-avaliacao', versao: 2, hora: new Date().toISOString() });
    return;
  }
  if (p === '/api/login' && req.method === 'POST') {
    const b = await readBody(req);
    if (String(b.senha || b.password || '') !== ADMIN_PASSWORD) { json(res, 401, { ok: false, erro: 'senha inválida' }); return; }
    json(res, 200, { ok: true });
    return;
  }
  if (p === '/api/config' && req.method === 'GET') {
    json(res, 200, {
      empresa: process.env.EMPRESA || 'Avaliações Imobiliárias',
      engenheiro: process.env.ENGENHEIRO || 'Kathleen Alexandra Goulart',
      cidade: process.env.CIDADE || 'Três Pontas/MG',
      whatsapp: process.env.WHATSAPP || ''
    });
    return;
  }

  // ---------- solicitações do cliente ----------
  if (p === '/api/solicitacoes' && req.method === 'POST') {
    const b = await readBody(req);
    if (b.tipo !== 'solicitacao_cliente') { json(res, 400, { ok: false, erro: 'tipo inválido' }); return; }
    const token = safeId(b.token || ('SOL-' + crypto.randomBytes(5).toString('hex')));
    const payload = Object.assign({}, b, { token, recebido_em: new Date().toISOString(), base_url: publicBase(req) });
    writeJson(path.join(SOLICITACOES, token + '.json'), payload);
    json(res, 200, { ok: true, token, link: publicBase(req) + '/cliente.html?t=' + encodeURIComponent(token) });
    return;
  }
  if (p === '/api/solicitacoes' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const out = [];
    for (const f of listFiles(SOLICITACOES)) {
      const j = readJson(path.join(SOLICITACOES, f), null);
      if (!j) continue;
      out.push({
        token: j.token || f.replace(/\.json$/, ''),
        criado_em: j.criado_em || '',
        recebido_em: j.recebido_em || '',
        nome: (j.dados && j.dados.solicitante_nome) || '',
        contato: (j.dados && j.dados.solicitante_tel) || '',
        endereco: (j.dados && j.dados.end) || '',
        fotos: Array.isArray(j.fotos) ? j.fotos.length : 0,
        documentos: Array.isArray(j.documentos) ? j.documentos.length : 0
      });
    }
    out.sort((a, b) => String(b.recebido_em).localeCompare(String(a.recebido_em)));
    json(res, 200, { ok: true, solicitacoes: out });
    return;
  }
  const solMatch = p.match(/^\/api\/solicitacoes\/([^/]+)$/);
  if (solMatch) {
    if (!requireAdmin(req, res)) return;
    const token = safeId(decodeURIComponent(solMatch[1]));
    const file = path.join(SOLICITACOES, token + '.json');
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) { json(res, 404, { ok: false, erro: 'não encontrada' }); return; }
      json(res, 200, { ok: true, solicitacao: readJson(file, null) });
      return;
    }
    if (req.method === 'DELETE') {
      try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
      json(res, 200, { ok: true });
      return;
    }
  }

  // ---------- laudos ----------
  if (p === '/api/laudos' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const out = [];
    for (const f of listFiles(LAUDOS)) {
      const j = readJson(path.join(LAUDOS, f), null);
      if (!j) continue;
      out.push({ id: f.replace(/\.json$/, ''), nome: j.nome || 'Sem número', status: j.status || 'rascunho', atualizado: j.atualizado || j.atualizado_servidor || '' });
    }
    out.sort((a, b) => String(b.atualizado).localeCompare(String(a.atualizado)));
    json(res, 200, { ok: true, laudos: out });
    return;
  }
  if (p === '/api/laudos' && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const b = await readBody(req);
    const id = safeId(b.id || ('LAU-' + crypto.randomBytes(6).toString('hex')));
    const payload = Object.assign({}, b, { id, atualizado_servidor: new Date().toISOString() });
    writeJson(path.join(LAUDOS, id + '.json'), payload);
    json(res, 200, { ok: true, id });
    return;
  }
  const lauMatch = p.match(/^\/api\/laudos\/([^/]+)$/);
  if (lauMatch) {
    if (!requireAdmin(req, res)) return;
    const id = safeId(decodeURIComponent(lauMatch[1]));
    const file = path.join(LAUDOS, id + '.json');
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) { json(res, 404, { ok: false, erro: 'não encontrado' }); return; }
      json(res, 200, { ok: true, laudo: readJson(file, null) });
      return;
    }
    if (req.method === 'PUT') {
      const b = await readBody(req);
      writeJson(file, Object.assign({}, b, { id, atualizado_servidor: new Date().toISOString() }));
      json(res, 200, { ok: true, id });
      return;
    }
    if (req.method === 'DELETE') {
      try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
      json(res, 200, { ok: true });
      return;
    }
  }

  // ---------- comparáveis ----------
  if (p === '/api/comparaveis' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    json(res, 200, { ok: true, comparaveis: readJson(COMPARAVEIS, []) });
    return;
  }
  if (p === '/api/comparaveis' && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const b = await readBody(req);
    const arr = Array.isArray(b) ? b : (Array.isArray(b.comparaveis) ? b.comparaveis : null);
    if (!arr) { json(res, 400, { ok: false, erro: 'lista inválida' }); return; }
    writeJson(COMPARAVEIS, arr.slice(0, 5000));
    json(res, 200, { ok: true, total: arr.length });
    return;
  }

  json(res, 404, { ok: false, erro: 'rota não encontrada' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  // dados, código do servidor e arquivos ocultos nunca são públicos
  if (p === '/server.js' || p === '/data' || p.startsWith('/data/') || p.startsWith('/.') || p.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('forbidden'); return;
  }
  const file = path.resolve(ROOT, '.' + p);
  if (!file.toLowerCase().startsWith(ROOT.toLowerCase())) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
  if (url.pathname.startsWith('/api/')) {
    try { await handleApi(req, res, url); }
    catch (e) { json(res, e.status || 500, { ok: false, erro: e.message || 'erro interno' }); }
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  LaudoAvaliacao — servidor iniciado');
  console.log('  Painel:      http://127.0.0.1:' + PORT + '/index.html');
  console.log('  Cliente:     http://127.0.0.1:' + PORT + '/cliente.html?t=TESTE');
  console.log('  Rede local:  ' + lanUrl());
  console.log('  Senha:       ' + (ADMIN_PASSWORD === 'laudo123' ? 'laudo123 (TROQUE com ADMIN_PASSWORD)' : '(definida)'));
  console.log('  Dados:       ' + DATA);
  console.log('');
});
