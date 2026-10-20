# Gera dados/bairros.csv e dados/indicadores_municipais.csv a partir das fontes pesquisadas.
import csv, pathlib, re
D = pathlib.Path(__file__).resolve().parent.parent / 'dados'
S = {
 'S1': ('Prefeitura de Sinop — ETE Curupy (1ª etapa)', 'data não informada', 'https://www.sinop.mt.gov.br/portal/noticias/0/3/6923/inaugurada-primeira-estacao-de-tratamento-de-esgoto-de-sinop'),
 'S2': ('SóNotícias — Bacia do Córrego Neuza', 'c. 2023', 'https://www.sonoticias.com.br/geral/sinop-obra-de-rede-de-esgoto-atendera-moradores-de-11-bairros-e-fica-pronta-em-4-meses/'),
 'S3': ('SóNotícias — integração em 8 bairros', '27/02/2024', 'https://www.sonoticias.com.br/geral/sinop-concluida-integracao-do-sistema-de-esgotamento-sanitario-em-oito-bairros/'),
 'S4': ('Aegea MT — conexão e tarifação liberadas', 'c. 2020', 'https://www.aegeamt.com.br/aguas-de-sinop-orienta-populacao-para-uso-correto-da-rede-de-esgoto/'),
 'S5': ('GC Notícias — rede em 3 bairros', 'c. 2022', 'https://www.gcnoticias.com.br/geral/empresa-implanta-rede-de-esgoto-em-3-bairros/140459040'),
 'S6': ('GC Notícias — obras de 2026', '23/03/2026', 'https://www.gcnoticias.com.br/geral/aguas-de-sinop-retoma-obras-de-esgoto-com-foco-na-qualidade/243256336'),
 'S8': ('Aegea MT — ampliação da rede (obras de 2025)', 'c. 2025', 'https://www.aegeamt.com.br/ampliacao-da-rede-de-esgoto-em-sinop-vai-beneficiar-44-mil-pessoas-ate-dezembro/'),
 'S9': ('CDL Sinop — pacote de obras de 2026', '05/05/2026', 'https://www.cdlsinop.com.br/comunicacao/noticias/aguas-de-sinop-apresenta-a-cdl-sinop-pacote-de-obras-deste-ano/11181'),
 'S7': ('Aegea MT — cronograma semanal de obras', '31/08/2026', 'https://www.aegeamt.com.br/cronograma-de-obras-da-rede-de-esgoto-aguas-de-sinop-%C2%B7-entre-os-dias-31-08-e-05-09/'),
}
O, I, B = 'operacao', 'implantada', 'obras'
# (bairro como aparece na fonte, nomes para busca no OSM separados por |, situação, obras 2026, fontes, observação)
R = [
 ('Jardim das Violetas','Jardim das Violetas',O,'sim','S1,S4,S6','parte do bairro em 2020; novas obras em 2026'),
 ('Jardim das Palmeiras','Jardim das Palmeiras',O,'sim','S1,S4,S5,S6','parte do bairro em 2020; novas obras em 2026'),
 ('Jardim Primaveras','Jardim Primaveras|Jardim das Primaveras',O,'','S1,S4',''),
 ('Parque das Araras','Parque das Araras',O,'','S1,S4',''),
 ('Jardim Califórnia','Jardim Califórnia|Califórnia',O,'','S1','na fonte aparece como "Califórnia"'),
 ('Jardim das Azaléias','Jardim das Azaléias|Jardim Azaléias',O,'','S1','na fonte aparece como "Azaléias"'),
 ('Maria Carolina','Jardim Maria Carolina|Maria Carolina',O,'','S1,S4',''),
 ('Maria Vindilina','Jardim Maria Vindilina|Maria Vindilina',O,'','S1',''),
 ('Jardim das Orquídeas','Jardim das Orquídeas|Orquídeas',O,'','S1,S4',''),
 ('Jardim das Oliveiras','Jardim das Oliveiras|Oliveiras',O,'','S1,S4','Oliveiras I e II'),
 ('Jardim das Nações','Jardim das Nações|Nações',O,'','S1','na fonte aparece como "Nações"'),
 ('Jardim das Rosas','Jardim das Rosas',O,'','S1',''),
 ('Residencial Veneza','Residencial Veneza',O,'','S1',''),
 ('Setor Industrial Norte','Setor Industrial Norte',O,'','S1,S4','parte do bairro em 2020'),
 ('Setor Residencial Norte','Setor Residencial Norte',O,'','S1,S4,S5','parte do bairro em 2020'),
 ('Centro','Centro|Setor Comercial',O,'sim','S1,S6',''),
 ('Setor Comercial','Setor Comercial',O,'','S1',''),
 ('Residencial Daury Riva','Residencial Daury Riva|Daury Riva',O,'','S1,S4',''),
 ('Jardim Europa','Jardim Europa',O,'','S2,S3',''),
 ('Residencial Vitória Régia','Residencial Vitória Régia|Vitória Régia',O,'','S2,S3',''),
 ('Jardim Imperial','Jardim Imperial',O,'sim','S2,S3,S6',''),
 ('Jardim Santa Rita','Jardim Santa Rita|Santa Rita',O,'','S2,S3',''),
 ('Residencial Novo Estado','Residencial Novo Estado|Novo Estado',O,'','S2,S3',''),
 ('Carandá Bosque','Carandá Bosque',O,'','S2,S3',''),
 ('Jardim dos Ipês','Jardim dos Ipês|Jardim Ipês',O,'','S2,S3',''),
 ('Figueiras Residencial','Figueiras Residencial|Figueiras',O,'','S2,S3',''),
 ('Residencial Santa Cecília','Residencial Santa Cecília|Santa Cecília',I,'','S2','rede implantada; integração às casas não confirmada nas fontes'),
 ('Loteamento Santa Cecília','Loteamento Santa Cecília',I,'','S2','rede implantada; integração às casas não confirmada nas fontes'),
 ('Moinho dos Ventos','Moinho dos Ventos',I,'','S2','rede implantada; integração às casas não confirmada nas fontes'),
 ('Residencial Cidade Jardim','Residencial Cidade Jardim|Cidade Jardim',O,'','S4','2020'),
 ('Jardim dos Cravos','Jardim dos Cravos',O,'','S4','parte do bairro em 2020'),
 ('Residencial Caribe','Residencial Caribe|Caribe',O,'','S4','2020'),
 ('Residencial Copacabana','Residencial Copacabana|Copacabana',O,'','S4','2020'),
 ('Jardim Gramado','Jardim Gramado',I,'','S5','obra em fase final na época (c. 2022); confirmar situação atual'),
 ('Jardim Maringá','Jardim Maringá|Maringá',B,'sim','S6',''),
 ('Setor Residencial Sul','Setor Residencial Sul|Setor Sul',B,'sim','S6','na fonte aparece como "Setor Sul"'),
 ('Residencial Ipanema','Residencial Ipanema|Ipanema',B,'sim','S6,S7',''),
 ('Terra Rica','Terra Rica|Residencial Terra Rica',B,'sim','S6,S7',''),
 ('Belvedere Residencial III','Belvedere Residencial III|Belvedere III',B,'sim','S6',''),
 ('Toscana II','Residencial Toscana II|Toscana II',B,'sim','S6',''),
 ('Canarinho I','Canarinho I|Residencial Canarinho',B,'sim','S6',''),
 ('Canarinho II','Canarinho II|Residencial Canarinho II',B,'sim','S6',''),
 ('Rhodivi','Residencial Rhodivi|Rhodivi',B,'sim','S6',''),
 ('Safira','Residencial Safira|Safira',B,'sim','S6',''),
 ('Iguatemi','Residencial Iguatemi|Iguatemi',B,'sim','S6',''),
 ('Residencial Jardim Araguaia','Residencial Jardim Araguaia|Araguaia',B,'sim','S6','na fonte aparece como "Araguaia"'),
 ('Residencial Paris','Residencial Paris|Paris',B,'sim','S6,S7',''),
 ('Residencial Gente Feliz','Residencial Gente Feliz|Gente Feliz I',B,'sim','S6,S7','na fonte aparece como "Gente Feliz I"'),
 ('Residencial Portinari','Residencial Portinari|Portinari',B,'sim','S7',''),
 ('Jardim Itália III','Jardim Itália III|Jardim Itália 3',I,'','S8','obra iniciada em 2025 com conclusão prevista até dez/2025 — confirmar situação atual'),
 ('Boa Esperança','Jardim Boa Esperança|Boa Esperança',I,'','S8','obra iniciada em 2025 com conclusão prevista até dez/2025 — confirmar situação atual'),
 ('Araguaia II','Araguaia II|Jardim Araguaia II',I,'','S8','obra iniciada em 2025 com conclusão prevista até dez/2025 — confirmar situação atual'),
 ('Novo Horizonte','Novo Horizonte|Residencial Novo Horizonte',I,'','S8','obra iniciada em 2025 com conclusão prevista até dez/2025 — confirmar situação atual'),
 ('Jardim São Paulo II','Jardim São Paulo II|Jardim São Paulo 2',I,'','S8','obra iniciada em 2025 com conclusão prevista até dez/2025 — confirmar situação atual'),
 ('Nossa Senhora Aparecida','Nossa Senhora Aparecida|Jardim Nossa Senhora Aparecida',I,'','S8','obra iniciada em 2025 com conclusão prevista até dez/2025 — confirmar situação atual'),
]
CDL = {'Jardim das Palmeiras','Centro','Jardim das Violetas','Residencial Ipanema','Terra Rica','Belvedere Residencial III','Toscana II','Canarinho I','Canarinho II','Rhodivi','Safira','Iguatemi','Residencial Jardim Araguaia','Residencial Paris','Jardim Imperial','Residencial Gente Feliz'}
H = ['bairro','nome_busca','lat','lon','geo_fonte','esgoto_rede','obras_2026','esgoto_fonte','esgoto_ref','esgoto_url','agua_pct','esgoto_pct','lixo_pct','pct_ano','pct_fonte','observacao']
with open(D/'bairros.csv','w',newline='',encoding='utf-8-sig') as f:
    w = csv.writer(f, delimiter=';'); w.writerow(H)
    for b,q,st,ob,fs,obs in R:
        ks = fs.split(',')
        if b in CDL and 'S9' not in ks: ks.append('S9')
        obs = re.sub(r'"([^"]*)"', r'“\1”', obs.replace('; ',' — '))          # ';' no texto quebraria as colunas no site
        w.writerow([b,q,'','','',st,ob,' + '.join(S[k][0] for k in ks),' + '.join(S[k][1] for k in ks),' | '.join(S[k][2] for k in ks),'','','','','',obs])
IB='https://www.ibge.gov.br/cidades-e-estados/mt/sinop.html'; AS='https://www.aguaesaneamento.org.br/municipios-e-saneamento/mt/sinop'
SN='https://sounews.com.br/sinop-avanca-no-saneamento-basico-e-se-torna-a-cidade-de-mt-que-mais-investiu-no-setor-em-2025/'; GC=S['S6'][2]
PN='https://www.sinop.mt.gov.br/portal/noticias/0/3/13809/sinop-ultrapassa-231-mil-habitantes-e-registra-crescimento-de-74-em-uma-decada-aponta-ibge'
CDLU=S['S9'][2]
GC2='https://www.gcnoticias.com.br/geral/aguas-de-sinop-pretende-instalar-64-km-de-rede-de-esgoto-em-2026/244790624'
PS='https://www.sinop.mt.gov.br/portal/noticias/0/3/12506/populacao-de-sinop-ultrapassa-os-223-mil-habitantes-e-prefeito-atribui-ao-planejamento-do-municipio'
IND = [
 ('pop_2022','População residente (Censo 2022)',196312,'pessoas','2022','IBGE',IB),
 ('pop_2025','População estimada 2025',223780,'pessoas','2025','IBGE (divulgado pela Prefeitura de Sinop)',PS),
 ('pop_2026','População estimada 2026',231452,'pessoas','1º/jul/2026','IBGE (divulgado pela Prefeitura de Sinop)',PN),
 ('agua_rede_pct','Moradores com água por rede geral',88.9,'%','Censo 2022','IBGE (via Água e Saneamento)',AS),
 ('agua_poco_pct','Moradores com água de poço profundo ou artesiano',10,'%','Censo 2022','IBGE (via Água e Saneamento)',AS),
 ('esgoto_rede_pct','Moradores com esgoto por rede geral, pluvial ou fossa ligada à rede',17.3,'%','Censo 2022','IBGE (via Água e Saneamento)',AS),
 ('fossa_sep_pct','Moradores com fossa séptica ou fossa filtro não ligada à rede',28.1,'%','Censo 2022','IBGE (via Água e Saneamento)',AS),
 ('fossa_rud_pct','Moradores com fossa rudimentar ou buraco',54.5,'%','Censo 2022','IBGE (via Água e Saneamento)',AS),
 ('lixo_pct','Moradores com lixo coletado',96.5,'%','Censo 2022','IBGE (via Água e Saneamento)',AS),
 ('lixo_sinisa_pct','População atendida com coleta de resíduos domiciliares',97.1,'%','SINISA 2024','SINISA (via Água e Saneamento)',AS),
 ('sem_banheiro','Moradores sem banheiro nem sanitário',8,'pessoas','Censo 2022','IBGE (via Água e Saneamento)',AS),
 ('agua_sinisa_pct','População com acesso a serviço público de água',97,'%','SINISA 2024','SINISA (via Água e Saneamento)',AS),
 ('esgoto_sinisa_pct','População com acesso a serviço público de esgoto',33.9,'%','SINISA 2024','SINISA (via Água e Saneamento)',AS),
 ('esgoto_as_pct','Cobertura de esgoto informada pela concessionária',40,'%','2025','Águas de Sinop (via GC Notícias)',GC),
 ('meta_2026_pct','Meta de cobertura de esgoto após as obras de 2026',50,'%','2026','Águas de Sinop (via GC Notícias)',GC),
 ('meta_2032_pct','Meta de cobertura de esgoto',98,'%','2032','Águas de Sinop (via GC Notícias)',GC),
 ('rede_km','Rede de esgoto instalada',589,'km','início de 2026','Águas de Sinop (via SóNews)',SN),
 ('rede_oper_km','Rede de esgoto já em operação (do total instalado)',310,'km','fev/2026','Águas de Sinop (via SóNews)',SN),
 ('rede_km_abr26','Rede de esgoto implantada (informada pelo diretor-presidente)',650,'km','abr/2026','Águas de Sinop (via GC Notícias)',GC2),
 ('bairros_total','Bairros legalizados em Sinop',323,'bairros','fev/2026','Prefeitura de Sinop (via SóNews)',SN),
 ('bairros_rede','Bairros alcançados pela rede de esgoto',135,'bairros','dez/2025','Águas de Sinop (via SóNews)',SN),
 ('bairros_trat','Bairros que já usam o sistema de tratamento',61,'bairros','dez/2025','Águas de Sinop (via SóNews)',SN),
 ('ete_l_dia','Capacidade das ETEs Curupy e Teles Pires',4838400,'litros/dia','início de 2026','Águas de Sinop (via SóNews)',SN),
 ('rede_2025_km','Rede de esgoto construída em 2025',82.5,'km','2025','Águas de Sinop (via GC Notícias)',GC),
 ('moradores_2025','Moradores beneficiados pelas obras de 2025',44000,'pessoas','2025','Águas de Sinop (via GC Notícias)',GC),
 ('moradores_2026','Moradores a serem atendidos pelas obras de 2026',23000,'pessoas','2026','Águas de Sinop (via CDL Sinop)',CDLU),
 ('meta_2026_moradores','Moradores com coleta de esgoto previstos ao fim de 2026 (50% da cidade)',110000,'pessoas','2026','Águas de Sinop (via GC Notícias)',GC2),
 ('obras_2026_km','Rede de esgoto planejada para 2026',64,'km','2026','Águas de Sinop (via GC Notícias)',GC),
]
with open(D/'indicadores_municipais.csv','w',newline='',encoding='utf-8-sig') as f:
    w = csv.writer(f, delimiter=';'); w.writerow(['id','descricao','valor','unidade','referencia','fonte','url'])
    for r in IND: w.writerow(r)
print(len(R),'bairros;',len(IND),'indicadores')
