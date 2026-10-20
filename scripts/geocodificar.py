#!/usr/bin/env python3
"""Descobre a localização real de cada bairro no OpenStreetMap (Nominatim) e grava em dados/bairros.csv.
Uso:  python scripts/geocodificar.py            (só preenche os que estão sem lat/lon)
      python scripts/geocodificar.py --forcar   (refaz todos)
Gera também dados/bairros.geojson com os contornos, quando o OSM tiver o desenho do bairro."""
import csv, json, shutil, sys, time, urllib.parse, urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSV, GEO = RAIZ / 'dados' / 'bairros.csv', RAIZ / 'dados' / 'bairros.geojson'
BB = dict(s=-12.05, n=-11.65, w=-55.70, e=-55.30)          # caixa em volta de Sinop
UA = 'saneamento-sinop-escolar/1.0 (trabalho escolar)'

def buscar(q):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
        'format': 'jsonv2', 'limit': 5, 'polygon_geojson': 1, 'polygon_threshold': 0.0005, 'countrycodes': 'br',
        'bounded': 1, 'viewbox': f"{BB['w']},{BB['n']},{BB['e']},{BB['s']}", 'q': f'{q}, Sinop, Mato Grosso'})
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'pt-BR'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def pontuar(r):
    return (3 if r.get('type') in ('suburb', 'neighbourhood', 'quarter', 'residential') else 0) \
         + (2 if r.get('category') in ('place', 'boundary') else 0) \
         + (1 if 'Polygon' in (r.get('geojson') or {}).get('type', '') else 0)

def escolher(res):
    ok = [r for r in res if BB['s'] <= float(r['lat']) <= BB['n'] and BB['w'] <= float(r['lon']) <= BB['e']]
    return max(ok, key=pontuar) if ok else None

def main():
    forcar = '--forcar' in sys.argv
    with open(CSV, encoding='utf-8-sig', newline='') as f:
        rd = csv.DictReader(f, delimiter=';'); campos = rd.fieldnames; linhas = list(rd)
    shutil.copy(CSV, CSV.with_suffix('.csv.bak'))
    feats, falhas = [], []
    for i, l in enumerate(linhas, 1):
        poly = None
        if forcar or not l['lat'] or not l['lon']:
            achou = None
            for q in (l['nome_busca'] or l['bairro']).split('|'):
                try:
                    achou = escolher(buscar(q.strip()))
                except Exception as e:
                    print('  erro em', q, e)
                time.sleep(1.1)                                  # regra do Nominatim: 1 consulta por segundo
                if achou: break
            if achou:
                l['lat'], l['lon'] = f"{float(achou['lat']):.6f}", f"{float(achou['lon']):.6f}"
                l['geo_fonte'] = 'OpenStreetMap/Nominatim: ' + achou['display_name'][:90]
                g = achou.get('geojson')
                poly = g if g and 'Polygon' in g.get('type', '') else None
            else:
                falhas.append(l['bairro'])
        print(f"[{i}/{len(linhas)}] {l['bairro']}: {l['lat'] or '—'}, {l['lon'] or '—'}")
        if l['lat'] and l['lon']:
            geom = poly or {'type': 'Point', 'coordinates': [float(l['lon']), float(l['lat'])]}
            feats.append({'type': 'Feature', 'properties': {'bairro': l['bairro']}, 'geometry': geom})
    with open(CSV, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, campos, delimiter=';'); w.writeheader(); w.writerows(linhas)
    GEO.write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, ensure_ascii=False), encoding='utf-8')
    print(f'\nPronto: {len(feats)} localizados.', 'Não encontrados (edite nome_busca no CSV):' if falhas else '', ', '.join(falhas))

if __name__ == '__main__':
    main()
