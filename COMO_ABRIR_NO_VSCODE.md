# Saneamento Sinop — Site completo para VS Code

Projeto escolar interativo elaborado sobre os arquivos HTML, CSS, JavaScript e CSV enviados.

## 1. Abrir no VS Code

1. Extraia todo o ZIP. **Não mova o `index.html` sozinho.**
2. Abra a pasta **Saneamento_Sinop_Site** no Visual Studio Code (**Arquivo → Abrir Pasta**).
3. Instale a extensão **Live Server**, caso não a tenha.
4. Clique com o botão direito em **index.html** → **Open with Live Server**.
5. Use uma conexão à internet para carregar o **Leaflet** (biblioteca do mapa), os mapas do **OpenStreetMap/Esri** e as fontes visuais. Mesmo sem mapa carregado, a lista e os números podem ser usados.

**Importante:** se abrir o HTML com dois cliques (usando `file://`), a leitura de `dados/*.csv` pode ser bloqueada pelo navegador. Use Live Server ou `python -m http.server 8000` na pasta do projeto e abra `http://localhost:8000`.

## 2. Estrutura

```
Saneamento_Sinop_Site/
├── index.html                    ← entrada do site
├── favicon.svg
├── css/style.css                 ← visual responsivo
├── js/app.js                     ← filtros, mapa e porcentagens
├── assets/
│   ├── logo.svg
│   ├── logo-horizontal.png       ← novo logo de cabeçalho
│   └── logo-com-nome-original.svg
├── dados/
│   ├── bairros.csv               ← 55 bairros com percentuais fictícios
│   ├── bairros_ORIGINAL.csv      ← arquivo recebido, sem percentuais
│   └── indicadores_municipais.csv ← 28 indicadores de fontes citadas
├── originais/                  ← HTML, CSS e JS originais preservados
├── scripts/
│   ├── geocodificar.py           ← tenta localizar bairros reais no OSM
│   └── gerar_dados_original.py   ← gerador ORIGINAL (não execute sem revisar)
└── Saneamento_Sinop_dados_ORIGINAL.xlsx
```

## 3. O que é real e o que é fictício?

- **Município:** os 28 indicadores municipais em `indicadores_municipais.csv` foram **preservados dos arquivos recebidos**, com data, fonte e link. Não foram criados percentuais municipais inventados. Não significa que foram revalidados individualmente aqui; consulte os links de referência.
- **Bairros:** os 55 bairros e seus registros de situação da rede foram preservados da planilha enviada. Os campos `agua_pct`, `esgoto_pct` e `lixo_pct` vieram vazios. Os percentuais foram **inventados integralmente** para a apresentação visual, com valores diferentes por bairro. Colunas `pct_ano` e `pct_fonte` deixam a simulação explícita. **Não use esses números em relatório como dados medidos.**
- **Coordenadas:** a planilha enviada não incluía latitude nem longitude dos bairros. O site abre instantaneamente com **marcadores de localização ilustrativa**, identificados como tal no mapa e no painel. Eles não retratam os pontos reais dos bairros. É possível localizar pontos usando o serviço OSM pelo botão de geolocalização no site ou pelo script abaixo. Geolocalizações automáticas podem falhar ou ser incompletas.
- **Mapa de calor:** a cor dos círculos representa os percentuais simulados. Círculos não são limites administrativos dos bairros. Se você preencher coordenadas/polígonos reais, o site os utiliza.

## 4. Como substituir os dados fictícios por dados reais

Edite `dados/bairros.csv` mantendo o separador `;` e os nomes das colunas. Preencha `agua_pct`, `esgoto_pct`, `lixo_pct` com números entre `0` e `100`. Troque `pct_fonte` e `pct_ano` pela fonte e ano verdadeiros. O site atualiza automaticamente ao recarregar (Ctrl+F5).

Também é possível usar o botão **Importar CSV** dentro do site; essa importação funciona apenas durante a sessão do navegador e **não altera os arquivos no disco**.

### Geocodificação opcional

Execute (com acesso à internet), na raiz da pasta:

```bash
python scripts/geocodificar.py
```

Isso consulta o **OpenStreetMap/Nominatim**, preenche latitudes e longitudes que ele conseguir encontrar e gera `dados/bairros.geojson` com polígonos quando disponíveis. O script original foi preservado, assim como suas ressalvas. Pode demorar alguns minutos. Após gerar, recarregue a página. Faça backup de `dados/bairros.csv` antes, embora o script já crie um `.bak`.

## 5. Melhorias feitas

- Cabeçalho e logotipo renovados, home moderna e cartões de indicadores responsivos.
- Mapa Leaflet e alternância entre ruas/satélite mantidos.
- Camadas **Situação da rede**, **Água (%)**, **Esgoto (%)** e **Lixo (%)**.
- Busca de bairro, seleção de status e visualização detalhada das fontes de cada um.
- **Remoção da barra de rolagem interna da lista de bairros:** a lista agora abre oito resultados e possui **Mostrar mais bairros**.
- Metas apresentadas em cartões com notas explicando que as metodologias e os anos diferem.
- Tema claro/escuro, visual de celular, e seção de transparência das fontes.
- Avisos permanentes e específicos informando o caráter fictício dos percentuais por bairro e da localização ilustrativa.

## 6. Atenção ao gerador original

O arquivo `scripts/gerar_dados_original.py` pertence ao material original. **Se executado, pode recriar `dados/bairros.csv` e apagar os percentuais fictícios que adicionamos**, pois o script original deixa os campos vazios. Para continuar editando o site, modifique diretamente os CSVs no diretório `dados`.

### Fontes de referência

- Indicadores e URLs estão documentados integralmente em `dados/indicadores_municipais.csv`.
- [IBGE — Censo Demográfico 2022](https://www.ibge.gov.br/estatisticas/sociais/populacao/22827-censo-demografico-2022.html)
- [Portal SINISA](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa)
- [Prefeitura de Sinop](https://www.sinop.mt.gov.br/)
- [OpenStreetMap](https://www.openstreetmap.org/)

Projeto para fins escolares. **Os dados fictícios não devem ser apresentados como observações estatísticas reais.**
