'use strict';
// ====== Configuração ======
const BB = { s: -12.05, n: -11.65, w: -55.70, e: -55.30 };            // caixa em volta de Sinop
const CENTRO = [-11.8608, -55.5095];
const ST = { operacao: { l: 'Rede em operação', c: '#0D9488' }, implantada: { l: 'Rede implantada', c: '#0284C7' }, obras: { l: 'Obras em 2026', c: '#F59E0B' } };
const LAY = { rede: 'Rede de esgoto', agua: 'Água (%)', esgoto: 'Esgoto (%)', lixo: 'Lixo (%)' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; };
const fmt = n => Number(n).toLocaleString('pt-BR');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const link = u => /^https?:\/\//.test(u) ? u : '#';

function parseCSV(t) {                              // aceita campos entre aspas e ; ou , como separador
  t = t.replace(/^\uFEFF/, '').replace(/\r/g, '');
  const sep = t.split('\n')[0].includes(';') ? ';' : ',', R = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); R.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); R.push(row); }
  const H = R.shift().map(h => h.trim());
  return R.filter(r => r.some(x => x.trim())).map(r => { const o = {}; H.forEach((h, i) => o[h] = (r[i] || '').trim()); return o; });
}
function col(v) {                                  // 0% vermelho → 100% verde-água
  const s = [[0, [220, 38, 38]], [35, [245, 158, 11]], [70, [132, 204, 22]], [100, [13, 148, 136]]];
  v = Math.max(0, Math.min(100, v));
  for (let i = 1; i < 4; i++) if (v <= s[i][0]) { const a = s[i - 1], b = s[i], t = (v - a[0]) / (b[0] - a[0]); return `rgb(${a[1].map((c, k) => Math.round(c + (b[1][k] - c) * t)).join(',')})`; }
}

// ====== Localização real via OpenStreetMap (Nominatim) ======
let ultima = 0;
async function nominatim(q) {
  const w = 1100 - (Date.now() - ultima); if (w > 0) await sleep(w); ultima = Date.now();   // 1 consulta por segundo
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&polygon_geojson=1&polygon_threshold=0.0005&countrycodes=br&bounded=1&viewbox='
    + [BB.w, BB.n, BB.e, BB.s].join(',') + '&q=' + encodeURIComponent(q + ', Sinop, Mato Grosso');
  const r = await fetch(u, { headers: { 'Accept-Language': 'pt-BR' } }); if (!r.ok) throw new Error(r.status);
  return r.json();
}
const dentro = (la, lo) => la >= BB.s && la <= BB.n && lo >= BB.w && lo <= BB.e;
const pontos = r => (['suburb', 'neighbourhood', 'quarter', 'residential'].includes(r.type) ? 3 : 0) + (['place', 'boundary'].includes(r.category) ? 2 : 0) + (/Polygon/.test(r.geojson?.type || '') ? 1 : 0);
function escolher(res) { const ok = res.filter(r => dentro(+r.lat, +r.lon)); return ok.length ? ok.sort((a, b) => pontos(b) - pontos(a))[0] : null; }
async function localizar1(r) {
  const key = 'geo1:' + norm(r.bairro);
  try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  for (const q of (r.nome_busca || r.bairro).split('|')) {
    try {
      const p = escolher(await nominatim(q.trim()));
      if (p) {
        const o = { lat: +p.lat, lon: +p.lon, poly: /Polygon/.test(p.geojson?.type || '') ? p.geojson : null, nome: String(p.display_name || '').slice(0, 90) };
        try { localStorage.setItem(key, JSON.stringify(o)); } catch {}
        return o;
      }
    } catch (e) { console.warn(q, e); }
  }
  return null;
}

// ====== Estado ======
let rows = [], ind = {}, layer = 'rede', off = new Set(), termo = '', map, grp, tiles, selecionado = -1;

async function get(u) { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.text(); }
async function boot() {
  iniciarMapa(); $('tema').onclick = alternarTema;
  try {
    const [b, i] = await Promise.all([get('dados/bairros.csv'), get('dados/indicadores_municipais.csv')]);
    rows = parseCSV(b).map(r => ({ ...r, lat: num(r.lat), lon: num(r.lon) }));
    parseCSV(i).forEach(r => ind[r.id] = r);
    try { const g = await (await fetch('dados/bairros.geojson')).json(); g.features.forEach(f => { const r = rows.find(x => norm(x.bairro) === norm(f.properties.bairro)); if (r && /Polygon/.test(f.geometry.type)) r.poly = f.geometry; }); } catch {}
  } catch (e) {
    $('aviso').innerHTML = 'Não consegui ler a pasta <b>dados/</b>. Abra o site pelo <b>Live Server</b> do VS Code: abrir o HTML com dois cliques bloqueia a leitura dos arquivos.'; return;
  }
  kpis(); metas(); tabela(); render(); $('csv').onchange = enviar;
  const falta = rows.filter(r => r.lat == null);
  if (falta.length) {
    $('prog').style.display = 'block'; let n = 0;
    for (const r of falta) {
      const o = await localizar1(r); n++; $('prog').firstChild.style.width = (n / falta.length * 100) + '%';
      if (o) { r.lat = o.lat; r.lon = o.lon; r.poly = o.poly; r.geo_fonte = 'OpenStreetMap: ' + o.nome; if (n % 4 == 0) render(); }
    }
    $('prog').style.display = 'none';
  }
  render(); mensagem(); const ok = rows.filter(r => r.lat != null);
  if (ok.length) map.fitBounds(L.latLngBounds(ok.map(r => [r.lat, r.lon])).pad(.15));
}
function mensagem() {
  const ok = rows.filter(r => r.lat != null).length, sem = rows.filter(r => r.lat == null).map(r => r.bairro);
  $('aviso').innerHTML = `<b>${ok} de ${rows.length} bairros localizados no mapa.</b> Os pontos vêm do OpenStreetMap${sem.length ? '; não encontrei: ' + esc(sem.join(', ')) + ' (ajuste a coluna <code>nome_busca</code> do CSV)' : ''}. Cor ausente significa "sem informação", e não "sem rede".`;
}

// ====== Mapa ======
const BASES = {
  osm: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; colaboradores do OpenStreetMap'],
  sat: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 'Imagens &copy; Esri']
};
function iniciarMapa() {
  map = L.map('map', { zoomControl: true }).setView(CENTRO, 13); grp = L.layerGroup().addTo(map); trocarBase('osm');
  $('base').onchange = e => trocarBase(e.target.value);
  const m = L.control({ position: 'bottomleft' }); m.onAdd = () => { const d = L.DomUtil.create('div', 'wm'); d.innerHTML = '<img src="assets/logo.svg" alt="">'; return d; }; m.addTo(map);
}
function escuro() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function trocarBase(k) {
  if (tiles) map.removeLayer(tiles);
  tiles = L.tileLayer(BASES[k][0], { maxZoom: 19, attribution: BASES[k][1] }).addTo(map); tiles.bringToBack();
  $('map').classList.toggle('dark-tiles', k === 'osm' && escuro());
}
function alternarTema() { const d = document.documentElement; d.dataset.theme = escuro() ? 'light' : 'dark'; trocarBase($('base').value); }

const corDe = r => layer === 'rede' ? (ST[r.esgoto_rede]?.c || '#94A3B8') : (num(r[layer + '_pct']) == null ? '#94A3B8' : col(num(r[layer + '_pct'])));
const visivel = r => !off.has(r.esgoto_rede) && (!termo || norm(r.bairro).includes(norm(termo)));

function render() {
  $('tabs').innerHTML = Object.entries(LAY).map(([k, l]) => `<button class="${k == layer ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
  $('tabs').onclick = e => { if (e.target.dataset.k) { layer = e.target.dataset.k; render(); } };
  $('chips').innerHTML = Object.entries(ST).map(([k, s]) => `<button class="chip ${off.has(k) ? 'off' : ''}" data-k="${k}" style="--c:${s.c}"><i></i>${s.l}</button>`).join('');
  $('chips').onclick = e => { const k = e.target.closest('.chip')?.dataset.k; if (k) { off.has(k) ? off.delete(k) : off.add(k); render(); } };
  $('busca').oninput = e => { termo = e.target.value; render(); };
  $('legend').innerHTML = layer === 'rede' ? Object.values(ST).map(s => `<span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.c};margin-right:5px"></i>${s.l}</span>`).join(' ')
    : '<span>0%</span><i></i><span>100% atendido</span>';
  grp.clearLayers();
  rows.forEach((r, i) => {
    if (r.lat == null || !visivel(r)) return; const c = corDe(r);
    if (r.poly) L.geoJSON(r.poly, { style: { color: c, weight: 2, fillColor: c, fillOpacity: .35 }, interactive: false }).addTo(grp);
    else L.circle([r.lat, r.lon], { radius: 520, stroke: false, fillColor: c, fillOpacity: .22 }).addTo(grp);
    L.circleMarker([r.lat, r.lon], { radius: 7, color: '#fff', weight: 2.5, fillColor: c, fillOpacity: 1 }).bindTooltip(r.bairro).on('click', () => sel(i)).addTo(grp);
    if (r.obras_2026 === 'sim') L.circleMarker([r.lat, r.lon], { radius: 9, color: ST.obras.c, weight: 2, fill: false, className: 'pulse', interactive: false }).addTo(grp);
  });
  const lista = rows.map((r, i) => ({ r, i })).filter(x => visivel(x.r)).sort((a, b) => layer === 'rede' ? a.r.bairro.localeCompare(b.r.bairro, 'pt') : (num(b.r[layer + '_pct']) ?? -1) - (num(a.r[layer + '_pct']) ?? -1));
  $('cont').textContent = `${lista.length} bairros`;
  $('rank').innerHTML = lista.map(({ r, i }) => `<li data-i="${i}"><b>${esc(r.bairro)}</b><span>${layer === 'rede' ? (ST[r.esgoto_rede]?.l || '—') : (num(r[layer + '_pct']) == null ? 'sem dado' : num(r[layer + '_pct']) + '%')}</span><div class="bar"><i style="width:${layer === 'rede' ? 100 : (num(r[layer + '_pct']) || 0)}%;background:${corDe(r)}"></i></div></li>`).join('');
  $('rank').onclick = e => { const li = e.target.closest('li'); if (li) sel(+li.dataset.i); };
}
function sel(i) {
  const r = rows[i]; selecionado = i; if (r.lat != null) map.flyTo([r.lat, r.lon], 15);
  const U = (r.esgoto_url || '').split(' | '), N = (r.esgoto_fonte || '').split(' + '), F = (r.esgoto_ref || '').split(' + ');
  const pct = ['agua', 'esgoto', 'lixo'].filter(k => num(r[k + '_pct']) != null).map(k => `${LAY[k].replace(' (%)', '')}: ${num(r[k + '_pct'])}%`).join(' · ');
  const s = ST[r.esgoto_rede];
  $('detalhe').style.display = 'block';
  $('detalhe').innerHTML = `<h3>${esc(r.bairro)}</h3>${s ? `<span class="st" style="--c:${s.c}">${s.l}</span>` : ''}${r.obras_2026 === 'sim' ? ' <span class="st" style="--c:#F59E0B">Obras em 2026</span>' : ''}`
    + (r.observacao ? `<p>${esc(r.observacao)}</p>` : '') + (pct ? `<p>${esc(pct)}${r.pct_ano ? ' (' + esc(r.pct_ano) + ')' : ''}</p>` : '')
    + (N[0] ? `<p>Fontes: ${N.map((n, k) => `<a href="${link(U[k])}" target="_blank" rel="noopener">${esc(n)}</a> (${esc(F[k] || '')})`).join('; ')}</p>` : '')
    + `<p>Localização: ${esc(r.geo_fonte || 'a localizar')}</p>`;
}

// ====== Indicadores, metas e fontes ======
function contar(el, alvo, dec, u) {
  const t0 = performance.now(); (function f(t) { const p = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = (alvo * e).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + u; if (p < 1) requestAnimationFrame(f); })(t0);
}
function kpis() {
  const K = [['agua_rede_pct', 'Água por rede geral', '#0284C7', '%'], ['esgoto_rede_pct', 'Esgoto em rede (ou fossa ligada)', '#F59E0B', '%'], ['lixo_pct', 'Lixo coletado', '#0D9488', '%'], ['bairros_rede', 'Bairros com rede de esgoto', '#84CC16', '']];
  $('kpis').innerHTML = K.filter(k => ind[k[0]]).map(([id, t, c, u]) => `<div class="kpi" style="--c:${c}"><small>${t}</small><strong data-v="${ind[id].valor}">0${u}</strong><em>${esc(ind[id].referencia)} · ${esc(ind[id].fonte.split(' (')[0])}</em></div>`).join('');
  document.querySelectorAll('.kpi strong').forEach(el => { const u = el.textContent.replace(/[0-9.,\s]/g, ''), v = num(el.dataset.v); contar(el, v, v % 1 ? 1 : 0, u); });
}
function metas() {
  const M = [['esgoto_rede_pct', '#DC2626'], ['esgoto_sinisa_pct', '#F59E0B'], ['esgoto_as_pct', '#84CC16'], ['meta_2026_pct', '#0D9488'], ['meta_2032_pct', '#0284C7']];
  $('metasbars').innerHTML = M.filter(m => ind[m[0]]).map(([id, c]) => `<div class="goal"><span>${esc(ind[id].descricao)} <small style="color:var(--mut)">(${esc(ind[id].referencia)})</small></span><div class="tr"><i data-w="${num(ind[id].valor)}" style="background:${c}"></i></div><b>${fmt(num(ind[id].valor))}%</b></div>`).join('');
  setTimeout(() => document.querySelectorAll('.goal i').forEach(i => i.style.width = i.dataset.w + '%'), 200);
}
function tabela() {
  $('tab').innerHTML = Object.values(ind).map(r => `<tr><td>${esc(r.descricao)}</td><td><b>${fmt(num(r.valor))}</b> ${esc(r.unidade)}</td><td>${esc(r.referencia)}</td><td><a href="${link(r.url)}" target="_blank" rel="noopener">${esc(r.fonte)}</a></td></tr>`).join('');
}

// ====== Enviar planilha com percentuais ======
async function enviar(e) {
  const f = e.target.files[0]; if (!f) return;
  const L = parseCSV(await f.text()); if (!L.length) return;
  const H = Object.keys(L[0]), achar = k => H.find(h => norm(h).includes(k) && norm(h).includes('pct')) || H.find(h => norm(h).includes(k)), c = { b: H.find(h => /bairro|nome/i.test(h)) || H[0], agua: achar('agua'), esgoto: achar('esgoto'), lixo: achar('lixo'), lat: H.find(h => /^lat/i.test(h)), lon: H.find(h => /^lon/i.test(h)) };
  let ok = 0, novos = 0;
  L.forEach(l => {
    let r = rows.find(x => norm(x.bairro) === norm(l[c.b]));
    if (!r && c.lat && c.lon && num(l[c.lat]) != null) { r = { bairro: l[c.b], lat: num(l[c.lat]), lon: num(l[c.lon]), esgoto_rede: '', obras_2026: '', geo_fonte: 'planilha enviada' }; rows.push(r); novos++; }
    if (!r) return; ok++;
    ['agua', 'esgoto', 'lixo'].forEach(k => { if (c[k] && num(l[c[k]]) != null) r[k + '_pct'] = String(num(l[c[k]])); });
  });
  layer = 'agua'; render(); $('aviso').innerHTML = `<b>Planilha lida:</b> ${ok} bairros com percentuais (${novos} novos). Linhas sem correspondência e sem lat/lon foram ignoradas.`;
}

if (typeof module !== 'undefined') module.exports = { parseCSV, norm, num, escolher, col, pontos };
if (typeof window !== 'undefined') boot();
