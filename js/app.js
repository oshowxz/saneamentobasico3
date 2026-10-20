'use strict';
/* Projeto baseado no código original enviado. A simulação está identificada
   no CSV e no site; não confundir percentuais fictícios dos bairros com
   indicadores municipais da planilha original. */
const BB = { s: -12.05, n: -11.65, w: -55.70, e: -55.30 };
const CENTRO = [-11.8608, -55.5095];
const ST = {
  operacao: { l: 'Rede em operação', c: '#08a78d' },
  implantada: { l: 'Rede implantada', c: '#278fe5' },
  obras: { l: 'Obras previstas/citadas', c: '#f0a53a' }
};
const LAY = { rede: 'Situação da rede', agua: 'Água (%)', esgoto: 'Esgoto (%)', lixo: 'Lixo (%)' };
const METRIC = { agua:'Água simulada (%)', esgoto:'Esgoto simulado (%)', lixo:'Lixo simulado (%)' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmt = (n, dec) => n == null ? '—' : Number(n).toLocaleString('pt-BR',{maximumFractionDigits:dec ?? 1});
const pct = (r,k) => { const n = num(r[k+'_pct']); return n != null && n>=0 && n<=100 ? n : null; };
const sleep = ms => new Promise(r => setTimeout(r,ms));
const safeLink = u => /^https?:\/\//i.test(u || '') ? u : '#';
const hasReal = r => Number.isFinite(r.lat) && Number.isFinite(r.lon);
let rows=[],ind={},layer='esgoto',filtro='todos',termo='',mostrar=8,selecionado=-1;
let map=null,grp=null,tiles=null,busy=false,ultimoPedido=0;

// Lê CSV com aspas, ponto-e-vírgula e vírgulas.
function parseCSV(t){
  t=t.replace(/^\uFEFF/,'').replace(/\r/g,'');
  const sep=t.split('\n')[0].includes(';')?';':',';
  const linhas=[];let linha=[],campo='',aspas=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(aspas){if(c==='"'){if(t[i+1]==='"'){campo+='"';i++;}else aspas=false;}else campo+=c;}
    else if(c==='"')aspas=true;
    else if(c===sep){linha.push(campo);campo='';}
    else if(c==='\n'){linha.push(campo);linhas.push(linha);linha=[];campo='';}
    else campo+=c;
  }
  if(campo!==''||linha.length){linha.push(campo);linhas.push(linha);}
  const cab=(linhas.shift()||[]).map(x=>x.trim());
  return linhas.filter(l=>l.some(x=>x.trim())).map(l=>Object.fromEntries(cab.map((h,i)=>[h,(l[i]||'').trim()])));
}
const HASH = s => { let h=2166136261;for(const c of s) {h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
// Localização cenográfica estável, SEM qualquer alegação de georreferenciamento.
// Apenas até que o CSV tenha coordenadas reais, ou Nominatim retorne uma.
function posicaoIlustrativa(r,i){
  const h=HASH(r.bairro),col=i%9,row=Math.floor(i/9),
    x=(col-4)*.0079+((h%127)/127-.5)*.0036,
    y=(row-3)*.0084+((Math.floor(h/127)%127)/127-.5)*.0036;
  return [CENTRO[0]+y,CENTRO[1]+x];
}
function cor(v){
  if(v==null)return '#94a3b8';
  const a=[[0,[214,231,251]],[35,[121,196,238]],[70,[46,180,190]],[100,[10,114,138]]];
  for(let i=1;i<a.length;i++){if(v<=a[i][0]){const p=a[i-1],q=a[i],t=(v-p[0])/(q[0]-p[0]);return `rgb(${p[1].map((x,j)=>Math.round(x+(q[1][j]-x)*t)).join(',')})`;}}
  return 'rgb(10,114,138)';
}
const corDe=r=>layer==='rede'?(ST[r.esgoto_rede]?.c||'#94a3b8'):cor(pct(r,layer));
const get=async u=>{const res=await fetch(u);if(!res.ok)throw Error(u+' ('+res.status+')');return res.text();};
const estadoFiltro=r=>filtro==='todos'||(filtro==='obras'?r.obras_2026==='sim':r.esgoto_rede===filtro);
const visivel=r=>estadoFiltro(r)&&(!termo||norm(r.bairro).includes(norm(termo)));
const textoSituacao=r=>ST[r.esgoto_rede]?.l||'Situação não informada';

async function boot(){
  $('tema').onclick=alternarTema;
  let remembered=null;try{remembered=localStorage.getItem('saneamento-tema');}catch(e){/* armazenamento indisponível */}
  if(remembered==='light'||remembered==='dark') document.documentElement.dataset.theme=remembered;
  atualizaTema();
  if(typeof L!=='undefined') iniciarMapa();
  else { $('map-unavailable').hidden=false; $('geoStatus').textContent='Mapa de ruas indisponível. Verifique a internet para carregar o Leaflet/OpenStreetMap.'; }
  try {
    const [b,i]=await Promise.all([get('dados/bairros.csv'),get('dados/indicadores_municipais.csv')]);
    rows=parseCSV(b).map((r,j)=>({...r,lat:num(r.lat),lon:num(r.lon),demo:posicaoIlustrativa(r,j)}));
    parseCSV(i).forEach(r=>ind[r.id]=r);
    try{
      const rr=await fetch('dados/bairros.geojson');
      if(rr.ok){const geo=await rr.json();
        for(const f of geo.features||[]){const r=rows.find(x=>norm(x.bairro)===norm(f.properties?.bairro));
          if(!r)continue;
          if(/Polygon/.test(f.geometry?.type||''))r.poly=f.geometry;
          if(f.geometry?.type==='Point'&&!hasReal(r)){r.lon=f.geometry.coordinates[0];r.lat=f.geometry.coordinates[1];}
        }
      }
    }catch(e){/* GeoJSON opcional */}
  } catch(e){
    console.error(e);
    $('geoStatus').innerHTML='Não foi possível carregar os CSVs. Abra <strong>index.html</strong> usando a extensão <strong>Live Server</strong> do VS Code e confira a pasta dados/.';
    $('kpis').innerHTML='<div class="placeholder">Falha ao ler indicadores. Verifique dados/indicadores_municipais.csv.</div>';
    return;
  }
  kpis();metas();tabela();render();
  $('busca').addEventListener('input',e=>{termo=e.target.value;mostrar=8;render();});
  $('mais').onclick=()=>{mostrar+=8;render();};
  $('geolocalizar').onclick=geolocalizar;
  $('csv').addEventListener('change',enviar);
}

const BASES={
  osm:['https://tile.openstreetmap.org/{z}/{x}/{y}.png','&copy; OpenStreetMap contributors'],
  sat:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}','Imagens &copy; Esri']
};
function iniciarMapa(){
  map=L.map('map',{zoomControl:true,scrollWheelZoom:false}).setView(CENTRO,13);
  grp=L.layerGroup().addTo(map);
  trocarBase('osm');
  $('base').onchange=e=>trocarBase(e.target.value);
  setTimeout(()=>map.invalidateSize(),250);
}
function escuro(){const v=document.documentElement.dataset.theme;return v?v==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;}
function atualizaTema(){$('temaIcone').textContent=escuro()?'☀':'☾';}
function alternarTema(){const t=escuro()?'light':'dark';document.documentElement.dataset.theme=t;try{localStorage.setItem('saneamento-tema',t);}catch(e){}atualizaTema();if(map)trocarBase($('base').value);}
function trocarBase(k){
  if(!map)return;
  if(tiles)map.removeLayer(tiles);
  tiles=L.tileLayer(BASES[k][0],{maxZoom:19,attribution:BASES[k][1]}).addTo(map);
  tiles.bringToBack();$('map').classList.toggle('dark-tiles',k==='osm'&&escuro());
}
function filtrarLista(){
  return rows.map((r,i)=>({r,i})).filter(x=>visivel(x.r))
    .sort((a,b)=>layer==='rede'?a.r.bairro.localeCompare(b.r.bairro,'pt-BR'):(pct(b.r,layer)??-1)-(pct(a.r,layer)??-1));
}
function render(){
  $('tabs').innerHTML=Object.entries(LAY).map(([k,l])=>`<button type="button" data-layer="${k}" class="${layer===k?'on':''}" aria-pressed="${layer===k}">${esc(l)}</button>`).join('');
  $('tabs').onclick=e=>{const t=e.target.closest('[data-layer]');if(t){layer=t.dataset.layer;mostrar=8;render();}};
  const filters=[['todos','Todos'],['operacao','Em operação'],['implantada','Implantada'],['obras','Obras em 2026']];
  $('chips').innerHTML=filters.map(([k,v])=>`<button type="button" class="chip ${filtro===k?'on':''}" data-filter="${k}" aria-pressed="${filtro===k}">${esc(v)}</button>`).join('');
  $('chips').onclick=e=>{const t=e.target.closest('[data-filter]');if(t){filtro=t.dataset.filter;mostrar=8;render();}};
  $('rankMetric').textContent=layer==='rede'?'Situação da rede':METRIC[layer];
  $('legend').innerHTML=layer==='rede'?Object.values(ST).map(s=>`<span class="legend-key"><i class="legend-dot" style="background:${s.c}"></i>${esc(s.l)}</span>`).join('')
    :'<span>0%</span><span class="legend-scale" aria-hidden="true"></span><span>100%</span><span>Cor indica percentual <b>fictício</b></span>';
  if(map)renderMapa();
  const all=filtrarLista(),lista=all.slice(0,mostrar);
  $('cont').textContent=String(all.length);
  $('rank').innerHTML=lista.length?lista.map(({r,i})=>{
    const n=layer==='rede'?null:pct(r,layer),c=corDe(r),valor=layer==='rede'?textoSituacao(r):n==null?'Sem dado':fmt(n)+'%';
    return `<li role="button" tabindex="0" data-i="${i}" class="${selecionado===i?'selected':''}"><b>${esc(r.bairro)}</b><span class="metric">${esc(valor)}</span><span class="rank-bar"><i style="--bar-color:${c};width:${layer==='rede'?100:n??0}%"></i></span></li>`;
  }).join(''):'<li class="empty">Nenhum bairro corresponde à busca.</li>';
  $('rank').onclick=e=>{const li=e.target.closest('[data-i]');if(li)sel(+li.dataset.i);};
  $('rank').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const li=e.target.closest('[data-i]');if(li){e.preventDefault();sel(+li.dataset.i);}}};
  $('mais').hidden=all.length<=mostrar;
  $('listInfo').textContent=all.length?`Exibindo ${lista.length} de ${all.length} bairros`:'Nenhum resultado';
  const reais=rows.filter(hasReal).length;
  $('map-overlay-label').textContent=reais===rows.length?'PERCENTUAIS FICTÍCIOS':`PONTOS ILUSTRATIVOS · ${reais} LOCALIZADOS`;
  if(!busy)$('geoStatus').textContent=reais===rows.length?'Coordenadas fornecidas/localizadas; os percentuais por bairro continuam fictícios.':`${reais} de ${rows.length} bairros com coordenadas verificadas ou fornecidas. Outros pontos são ilustrativos e não indicam o local exato dos bairros.`;
}
function renderMapa(){
  grp.clearLayers();
  rows.forEach((r,i)=>{
    if(!visivel(r))return;
    const c=corDe(r),pos=hasReal(r)?[r.lat,r.lon]:r.demo;
    if(r.poly){L.geoJSON(r.poly,{style:{color:'#fff',weight:2,fillColor:c,fillOpacity:.48}}).on('click',()=>sel(i)).addTo(grp);}
    else L.circle(pos,{radius:hasReal(r)?320:285,weight:1,color:c,opacity:.12,fillColor:c,fillOpacity:.32,interactive:false}).addTo(grp);
    const mark=L.circleMarker(pos,{radius:selecionado===i?10:6.2,color:'#fff',weight:2,fillColor:c,fillOpacity:1,opacity:1});
    mark.bindTooltip(esc(r.bairro)+(hasReal(r)?'':' (posição ilustrativa)'),{sticky:true});
    mark.on('click',()=>sel(i)).addTo(grp);
    if(r.obras_2026==='sim')L.circleMarker(pos,{radius:10,color:'#ee9e25',weight:1.5,fillOpacity:0,interactive:false}).addTo(grp);
  });
}
function sel(i){
  const r=rows[i];if(!r)return;
  selecionado=i;
  const coord=hasReal(r)?[r.lat,r.lon]:r.demo;
  if(map){map.flyTo(coord,Math.max(14,map.getZoom()),{duration:.7});}
  const pcts=['agua','esgoto','lixo'].map(k=>`<span>${LAY[k].replace(' (%)','')}<b>${pct(r,k)==null?'—':fmt(pct(r,k))+'%'}</b></span>`).join('');
  const U=(r.esgoto_url||'').split(' | '),N=(r.esgoto_fonte||'').split(' + '),F=(r.esgoto_ref||'').split(' + ');
  const fontes=N[0]?N.map((v,j)=>`<li><a target="_blank" rel="noopener noreferrer" href="${esc(safeLink(U[j]))}">${esc(v)}</a>${F[j]?' · '+esc(F[j]):''}</li>`).join(''):'';
  const status=ST[r.esgoto_rede]||{c:'#94a3b8',l:'Sem status'};
  const fict=/fict[ií]c|simula/i.test(r.pct_fonte||'');
  $('detalhe').hidden=false;
  $('detalhe').innerHTML=`<h4>${esc(r.bairro)}</h4><span class="status-tag" style="--tag-bg:${status.c}24;--tag-color:${status.c}">${esc(status.l)}</span>${r.obras_2026==='sim'?'<span class="status-tag" style="--tag-bg:#ffe8c9;--tag-color:#ac6a0c">Obras em 2026</span>':''}
  <div class="detail-pcts">${pcts}</div><p class="mini-fict">${fict?'VALORES FICTÍCIOS (DEMONSTRAÇÃO)':'VALORES IMPORTADOS — VERIFICAR FONTE'}</p>
  ${r.observacao?`<p><strong>Observação:</strong> ${esc(r.observacao)}</p>`:''}
  <p><strong>Percentuais:</strong> ${esc(r.pct_fonte||'Fonte não informada')} ${r.pct_ano?'· '+esc(r.pct_ano):''}</p>
  <p><strong>Mapa:</strong> ${hasReal(r)?esc(r.geo_fonte||'Coordenadas fornecidas no CSV'):'posição ilustrativa; localização real não confirmada'}</p>
  ${fontes?`<p><strong>Fontes da situação da rede:</strong></p><ul class="detail-source">${fontes}</ul>`:''}`;
  $('rank').querySelectorAll('[data-i]').forEach(el=>el.classList.toggle('selected',+el.dataset.i===i));
  if(map)renderMapa();
}
function kpis(){
  const K=[
    ['agua_rede_pct','Água por rede geral','💧','#087ce1','#e5f2ff','#1382e6','%'],
    ['esgoto_rede_pct','Esgoto por rede/fossa ligada','≋','#079d8e','#dff8f2','#099f8c','%'],
    ['lixo_pct','Lixo coletado','♻','#0b9875','#e2faef','#16936b','%'],
    ['bairros_rede','Bairros com rede','▦','#304eb2','#e7ecff','#5762cb','']
  ];
  $('kpis').innerHTML=K.filter(k=>ind[k[0]]).map(([id,label,icon,color,iconbg,iconink,unit])=>{
    const v=ind[id],valor=num(v.valor);
    return `<div class="kpi" style="--stat-color:${color};--icon-bg:${iconbg};--icon-ink:${iconink}"><div class="kpi-icon" aria-hidden="true">${icon}</div><div class="kpi-body"><small>${esc(label)}</small><strong>${esc(fmt(valor))}${unit}</strong><em>${esc(v.referencia)} · ${esc(v.fonte.split(' (')[0])}</em></div></div>`;
  }).join('');
}
function metas(){
  const M=[['esgoto_rede_pct','Censo 2022','#0a7ccd'],['esgoto_sinisa_pct','SINISA 2024','#24a9bb'],['esgoto_as_pct','Concessionária 2025','#4c9cf5'],['meta_2026_pct','Meta 2026','#328fea'],['meta_2032_pct','Meta 2032','#16b99f']];
  $('metasbars').innerHTML=M.filter(([id])=>ind[id]).map(([id,label,c])=>{
    const d=ind[id],v=num(d.valor);
    return `<div class="goal"><span class="goal-label">${esc(label)}</span><strong>${fmt(v)}%</strong><div class="tr"><i data-w="${Math.max(0,Math.min(100,v??0))}" style="--g:${c}"></i></div><small>${esc(d.referencia)}</small></div>`;
  }).join('');
  setTimeout(()=>document.querySelectorAll('.goal .tr i').forEach(el=>el.style.width=el.dataset.w+'%'),80);
}
function tabela(){
  $('tab').innerHTML=Object.values(ind).map(r=>`<tr><td>${esc(r.descricao)}</td><td>${esc(fmt(num(r.valor)))} ${esc(r.unidade)}</td><td>${esc(r.referencia)}</td><td><a href="${esc(safeLink(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.fonte)} ↗</a></td></tr>`).join('');
}
// BUSCA OPCIONAL NO OSM. Não realizada em todas as visitas: lenta e sujeita a limites da API.
async function nominatim(q){
  const espera=1200-(Date.now()-ultimoPedido);if(espera>0)await sleep(espera);
  ultimoPedido=Date.now();
  const u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&polygon_geojson=1&polygon_threshold=0.0005&countrycodes=br&bounded=1&viewbox='
    +[BB.w,BB.n,BB.e,BB.s].join(',')+'&q='+encodeURIComponent(q+', Sinop, Mato Grosso');
  const res=await fetch(u,{headers:{'Accept-Language':'pt-BR'}});
  if(!res.ok)throw new Error('Serviço OSM retornou HTTP '+res.status);
  return res.json();
}
const dentro=(la,lo)=>la>=BB.s&&la<=BB.n&&lo>=BB.w&&lo<=BB.e;
const pontos=r=>(['suburb','neighbourhood','quarter','residential'].includes(r.type)?3:0)+(['place','boundary'].includes(r.category)?2:0)+(/Polygon/.test(r.geojson?.type||'')?1:0);
function escolher(res){const ok=res.filter(r=>dentro(+r.lat,+r.lon));return ok.sort((a,b)=>pontos(b)-pontos(a))[0]||null;}
async function geolocalizar(){
  if(busy)return;const missing=rows.filter(r=>!hasReal(r));if(!missing.length){$('geoStatus').textContent='Todos os bairros já têm coordenadas.';return;}
  busy=true;$('geolocalizar').disabled=true;$('prog').hidden=false;
  let n=0,found=0,errosSeguidos=0;
  for(const r of missing){
    let item=null,erro=false;
    for(const q of (r.nome_busca||r.bairro).split('|').slice(0,3)){
      try{item=escolher(await nominatim(q.trim()));if(item)break;}
      catch(e){console.warn('Nominatim:',e);erro=true;}
    }
    n++;
    if(item){r.lat=+item.lat;r.lon=+item.lon;r.geo_fonte='OpenStreetMap/Nominatim: '+String(item.display_name||'').slice(0,120);r.poly=/Polygon/.test(item.geojson?.type||'')?item.geojson:null;found++;errosSeguidos=0;}
    else if(erro)errosSeguidos++;
    else errosSeguidos=0;
    $('progBar').style.width=(n/missing.length*100)+'%';
    $('progTxt').textContent=`Procurando localizações: ${n}/${missing.length}. Encontrados nesta busca: ${found}.`;
    $('geoStatus').textContent='Localizações vêm do OpenStreetMap. Percentuais do bairro permanecem fictícios.';
    if(n%3===0)render();
    if(errosSeguidos>=3){$('geoStatus').textContent='A consulta ao OpenStreetMap falhou repetidamente. A busca foi interrompida. Confira a conexão ou tente executar scripts/geocodificar.py depois.';break;}
  }
  busy=false;$('geolocalizar').disabled=false;$('prog').hidden=true;render();
  $('geoStatus').textContent=`Busca concluída: ${found} novos bairros localizados. ${rows.filter(r=>!hasReal(r)).length} ainda exibem posições ilustrativas. Para salvar resultados, use scripts/geocodificar.py.`;
}
// Permite substituir o CSV fictício por percentuais fornecidos pelo usuário.
async function enviar(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const importados=parseCSV(await file.text());if(!importados.length)throw Error('CSV vazio');
    const H=Object.keys(importados[0]),cBairro=H.find(x=>/bairro|nome/i.test(x))||H[0],
      achar=k=>H.find(h=>norm(h).includes(k)&&norm(h).includes('pct'))||H.find(h=>norm(h).includes(k)),
      campos={agua:achar('agua'),esgoto:achar('esgoto'),lixo:achar('lixo')};
    let editados=0,novos=0;
    for(const item of importados){
      if(!item[cBairro])continue;
      let r=rows.find(x=>norm(x.bairro)===norm(item[cBairro]));
      if(!r&&num(item.lat)!=null&&num(item.lon)!=null){r={bairro:item[cBairro],lat:num(item.lat),lon:num(item.lon),demo:[num(item.lat),num(item.lon)],esgoto_rede:'',obras_2026:''};rows.push(r);novos++;}
      if(!r)continue;
      let updated=false;
      for(const k of ['agua','esgoto','lixo']){const n=campos[k]?num(item[campos[k]]):null;if(n!=null&&n>=0&&n<=100){r[k+'_pct']=String(n);updated=true;}}
      if(updated){r.pct_fonte=item.pct_fonte||'CSV importado pelo usuário (não verificado)';r.pct_ano=item.pct_ano||'Data não informada';editados++;}
    }
    if(!editados)throw Error('Não encontrei correspondências entre os bairros e as colunas de percentuais.');
    layer='esgoto';mostrar=8;render();
    $('uploadStatus').textContent=`CSV importado: ${editados} bairros atualizados, ${novos} novos. Confirme a procedência dos valores importados antes de publicá-los como reais.`;
    $('csv').value='';
  }catch(err){$('uploadStatus').textContent='Não foi possível importar: '+err.message;}
}
if(typeof module!=='undefined')module.exports={parseCSV,norm,num,escolher,cor,pontos};
if(typeof window!=='undefined')boot();
