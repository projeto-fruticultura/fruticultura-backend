# PI Vale do São Francisco — Backend/API REST

Backend principal da plataforma de monitoramento climático e logístico da fruticultura do Vale do São Francisco.

## Sobre o projeto

Este repositório contém a API REST responsável por centralizar:

- autenticação;
- autorização;
- regras de negócio;
- cadastros;
- recebimento das leituras IoT;
- integração com a NASA POWER API;
- acesso ao PostgreSQL;
- fornecimento de dados ao frontend.

Na primeira entrega, o projeto terá somente este backend.

Guia do backend (como rodar, regras do banco e padrão das tarefas): [docs/GUIA-BACKEND-VALESAFRA.md](docs/GUIA-BACKEND-VALESAFRA.md).

## Objetivo

Disponibilizar uma API segura e organizada para conectar:

- frontend hospedado no Netlify;
- simulação IoT executada no Wokwi;
- NASA POWER API;
- banco PostgreSQL hospedado no Render até a 1ª entrega (13/10/2026) e, depois, na AWS.

## Arquitetura

```text
Frontend no Netlify
        ↕ HTTPS/REST/JSON
Backend Node.js no Render
        ↕ Prisma ORM
PostgreSQL (Render até a 1ª entrega; depois AWS)
```

O banco fica no Render até a 1ª entrega (13/10/2026); o plano gratuito do Render expira em 20/10/2026. Depois da 1ª entrega, o banco vai para a AWS, conforme a 2ª entrega (08/12/2026).

Fontes de dados:

```text
Wokwi/ESP32 → Backend
Backend ↔ NASA POWER API
```

## Tecnologias

- Node.js;
- Express 5;
- JavaScript (CommonJS);
- Prisma ORM 6.19.3 (versão fixa);
- PostgreSQL;
- JWT;
- bcrypt;
- NASA POWER API;
- Render;
- Git e GitHub;
- ferramenta de testes a definir.

## Responsabilidades do backend

- receber requisições;
- validar dados;
- aplicar regras de negócio;
- autenticar usuários;
- verificar permissões;
- cadastrar e consultar informações;
- receber leituras simuladas;
- consultar dados meteorológicos externos;
- armazenar dados no PostgreSQL;
- responder ao frontend em JSON;
- tratar erros;
- registrar ações importantes.

## Estrutura planejada

```text
src/
├── config/
├── controllers/
├── integrations/
│   └── nasa-power/
├── middlewares/
├── repositories/
├── routes/
├── services/
├── tests/
├── validators/
└── server.js

prisma/
├── migrations/
├── schema.prisma
└── seed.js
```

## Entidades principais

- usuário;
- produtor ou empresa;
- propriedade;
- cultura;
- lote;
- sensor;
- leitura climática;
- dado meteorológico da NASA;
- dado de mercado;
- informação logística;
- registro de auditoria.

## Endpoints planejados

Os endpoints abaixo são uma proposta inicial e poderão ser ajustados. Já estão prontos: Propriedades, Culturas, Sensores, Lotes, `GET /api/leituras`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` e `POST /api/usuarios` (veja [Endpoints prontos: Autenticação e usuários](#endpoints-prontos-autenticação-e-usuários)).

### Autenticação

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Usuários

```text
GET    /api/usuarios
POST   /api/usuarios
GET    /api/usuarios/:id
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id
```

### Propriedades

```text
GET    /api/propriedades
POST   /api/propriedades
GET    /api/propriedades/:id
PUT    /api/propriedades/:id
DELETE /api/propriedades/:id
```

### Culturas

```text
GET    /api/culturas
POST   /api/culturas
GET    /api/culturas/:id
PUT    /api/culturas/:id
DELETE /api/culturas/:id
```

### Lotes

```text
GET    /api/lotes
POST   /api/lotes
GET    /api/lotes/:id
PUT    /api/lotes/:id
DELETE /api/lotes/:id
```

### Sensores

```text
GET    /api/sensores
POST   /api/sensores
GET    /api/sensores/:id
PUT    /api/sensores/:id
DELETE /api/sensores/:id
```

### Leituras

```text
GET /api/leituras
```

### Dados da NASA

```text
GET /api/clima/nasa
GET /api/clima/nasa/propriedades/:propriedadeId
```

## Exemplo de leitura IoT

```json
{
  "sensorId": 1,
  "temperatura": 29.5,
  "umidade": 62,
  "dataHora": "2026-09-01T10:00:00"
}
```

## Integração com a NASA POWER

O backend consultará a NASA POWER API utilizando a latitude e a longitude cadastradas para uma propriedade ou lote.

```text
Frontend solicita os dados
        ↓
Backend consulta as coordenadas
        ↓
Backend chama a NASA POWER API
        ↓
Backend valida e organiza a resposta
        ↓
Dados são armazenados ou enviados ao frontend
```

A NASA POWER é uma fonte meteorológica externa. Ela não substitui as leituras simuladas pelo Wokwi.

## Autenticação e autorização

A autenticação usa JWT e o login já está pronto (veja [Endpoints prontos: Autenticação e usuários](#endpoints-prontos-autenticação-e-usuários)). Exigem token: `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/usuarios`, `/api/propriedades`, `/api/sensores`, `/api/lotes` e `/api/leituras`. Cada usuário vê só o que é dele (veja [Quem vê o quê](#quem-vê-o-quê-propriedades-sensores-e-lotes)). `/api/culturas` e `/api/precos` continuam abertas por enquanto.

Fluxo planejado:

```text
Usuário envia e-mail e senha
        ↓
Backend verifica a senha com bcrypt
        ↓
Backend gera o JWT
        ↓
Frontend envia o token nas próximas requisições
        ↓
RBAC verifica as permissões do usuário
```

Perfis inicialmente sugeridos:

- administrador;
- produtor;
- analista;
- operador.

Os perfis definitivos deverão ser validados com o professor.

## Responsáveis principais

- **Integrante 3:** API REST, controllers, services e regras de negócio;
- **Integrante 4:** Prisma, PostgreSQL, migrations e seeds;
- **Integrante 6:** NASA POWER, autenticação, segurança e testes.

Os demais integrantes deverão ajudar em endpoints, revisões, integrações, correções e testes.

## Como rodar localmente

> [!WARNING]
> **Não rode `npm run db:migrar`, `npm run db:seed` nem `npx prisma migrate reset` no banco compartilhado do grupo.**
> Quando o banco tem tabelas ou migrations que não batem com a sua cópia do projeto, o Prisma pode propor um *reset*, que apaga **todos** os dados do banco, e isso não tem volta. No banco compartilhado, só se testa a conexão e roda o servidor.

Existem três formas de rodar o projeto:

- **Opção 1: banco compartilhado do grupo**, para quem vai desenvolver ou testar endpoints sem mexer no `schema.prisma`;
- **Opção 2: banco próprio e vazio**, para quem vai mexer no `schema.prisma` (criar ou alterar tabelas);
- **Opção 3: ambiente de teste local**, para testar migration, seed e endpoints num banco na sua máquina, sem encostar no compartilhado.

### Pré-requisitos

- Node.js 18.18 ou superior;
- npm;
- Git.

Os comandos abaixo são para o **cmd** do Windows, que é o terminal padrão do VS Code do grupo.

### Opção 1: banco compartilhado do grupo

1. Clone o repositório e instale as dependências:

   ```cmd
   git clone https://github.com/projeto-fruticultura/fruticultura-backend.git
   cd fruticultura-backend
   npm install
   ```

2. Coloque na raiz do projeto (a mesma pasta do `package.json`) o arquivo `.env` que o Igor mandou no privado. Não reenvie e não publique esse arquivo.

   Acrescente nele o **seu próprio** `JWT_SECRET` (cada pessoa gera o seu; veja [Variáveis de ambiente](#variáveis-de-ambiente)). Sem ele, o servidor não sobe.

3. Teste a conexão com o banco (só lê, não altera nada):

   ```cmd
   npm run db:testar
   ```

   No banco compartilhado, o esperado é **aparecerem models** (`Usuario`, `Propriedade`, `Cultura`, `Lote`, `Sensor`, `Leitura`): o banco já tem as tabelas. **Não rode `db:migrar` nem `db:seed`.** Se aparecer outro resultado, veja [Resultados do `db:testar`](#resultados-do-dbtestar) e [Erros comuns](#erros-comuns).

4. Suba o servidor:

   ```cmd
   npm run dev
   ```

5. Confira no navegador:
   - `http://localhost:3000/api/health` deve responder `{ "status": "ok" }`;
   - `http://localhost:3000/api/propriedades` exige login: no navegador, sem token, responde `{ "erro": "Não autenticado." }` (401). Isso é o esperado. Para ver a lista, faça login em `POST /api/auth/login` e envie o token no header `Authorization: Bearer <token>`. Com o admin do seed, a lista traz todas as propriedades ativas, cada uma com `totalLotes` e `totalSensores`.

### Opção 2: banco próprio e vazio

Use esta opção quando for mexer no `schema.prisma`. Avise o grupo antes (veja [Regras do banco](#regras-do-banco)).

1. Clone o repositório e instale as dependências (igual ao passo 1 da Opção 1).

2. Crie na raiz do projeto o seu `.env` a partir do modelo `.env.example` (no cmd: `copy .env.example .env`; as variáveis estão em [Variáveis de ambiente](#variáveis-de-ambiente)) e preencha:
   - `DATABASE_URL`: a URL do **seu** banco PostgreSQL, que precisa estar vazio (no Render, é a **External Database URL**);
   - `SEED_ADMIN_SENHA`: troque por uma senha sua;
   - `JWT_SECRET`: gere o seu com o comando indicado lá.

   O `.env` nunca vai para o Git.

3. Teste a conexão:

   ```cmd
   npm run db:testar
   ```

   O esperado é `P4001 ... empty`: conectou, e o banco está vazio. Se **aparecerem models**, o banco não está vazio: pare e não rode a migration.

4. Crie as tabelas:

   ```cmd
   npm run db:migrar
   ```

5. Popule o banco com o admin, as culturas e as fazendas de exemplo (pode rodar mais de uma vez sem duplicar):

   ```cmd
   npm run db:seed
   ```

6. Suba o servidor e confira como no passo 5 da Opção 1:

   ```cmd
   npm run dev
   ```

### Opção 3: ambiente de teste local

Use esta opção para testar migration, seed e endpoints num banco **local**, sem encostar no banco compartilhado. Você precisa de um PostgreSQL instalado na sua máquina.

1. Crie um banco vazio nele (por exemplo, `valesafra_teste`).

2. Crie na raiz do projeto o arquivo `.env.teste`: copie o modelo (`copy .env.example .env.teste`) e troque a `DATABASE_URL` pela URL do banco **local** (por exemplo, `postgresql://USUARIO:SENHA@localhost:5432/valesafra_teste`). As outras variáveis são as mesmas do `.env` (veja [Variáveis de ambiente](#variáveis-de-ambiente)); deixe `LEITURAS_AGENDADOR_ATIVO="false"`. O `.env.teste` está no `.gitignore` e nunca vai para o Git.

3. Use os scripts abaixo, que leem o `.env.teste` no lugar do `.env`:

   | Script | O que faz |
   |---|---|
   | `npm run db:teste:migrar` | Aplica as migrations (`prisma migrate deploy`) no banco do `.env.teste`. |
   | `npm run db:teste:seed` | Roda o seed no banco do `.env.teste`. |
   | `npm run dev:teste` | Sobe o servidor usando o `.env.teste`. |

O `npm run dev` continua usando o `.env`. Por isso, para testar no banco local, suba o servidor com `npm run dev:teste`. Se quiser rodar o `dev` e o `dev:teste` ao mesmo tempo, troque a `PORT` do `.env.teste` para `3001`, para os dois não disputarem a porta 3000. Migration e seed no banco compartilhado são evitados: lá, só `npx prisma migrate deploy`, depois de a mudança ser revisada e com o grupo avisado (veja [Regras do banco](#regras-do-banco)).

### Resultados do `db:testar`

O `npm run db:testar` só lê a estrutura do banco e não altera nada.

| Resultado | O que significa |
|---|---|
| `P4001 ... empty` | Conectou, e o banco está vazio. Esperado na Opção 2. |
| Aparecem models | Conectou, e o banco já tem tabelas. Esperado na Opção 1. Na Opção 2, pare: o banco não está vazio. |
| `P1001` | Não conseguiu chegar ao servidor do banco (endereço errado ou banco fora do ar). |
| `P1000` | Chegou ao servidor, mas o usuário ou a senha da URL estão errados. |

### Erros comuns

| Mensagem | Causa provável | Como resolver |
|---|---|---|
| `Environment variable not found: DATABASE_URL` | O `.env` não está na raiz do projeto, foi salvo com outro nome (ex.: `.env.txt`) ou a variável está com o nome errado. | Confira se o arquivo se chama exatamente `.env`, se está na mesma pasta do `package.json` e se tem a linha `DATABASE_URL=...`. |
| `Can't reach database server` (`P1001`) | O endereço da URL está errado, foi usada a URL interna em vez da External Database URL do Render, ou o banco está fora do ar. | Confira a URL (Opção 2) ou peça o `.env` atualizado ao Igor (Opção 1). |
| `Authentication failed` (`P1000`) | O usuário ou a senha dentro da `DATABASE_URL` estão errados, ou a senha do banco foi trocada. | Copie a URL de novo (Opção 2) ou peça o `.env` atualizado (Opção 1). |
| `A variável de ambiente JWT_SECRET não foi definida no .env` (ou `precisa ter pelo menos 32 caracteres`) | Falta o `JWT_SECRET` no `.env`, ou ele é curto demais. O servidor não sobe sem ele. | Gere um com o comando de [Variáveis de ambiente](#variáveis-de-ambiente) e acrescente a linha `JWT_SECRET="..."` no `.env`. |
| `@prisma/client did not initialize yet` (ou outro erro dizendo para rodar `prisma generate`) | O Prisma Client não foi gerado depois do `npm install` ou de uma mudança no `schema.prisma`. | Rode `npx prisma generate` e suba o servidor de novo. |

### Versão do Prisma

O Prisma está fixado na versão 6.19.3. Não rode `npx prisma init` nem crie `prisma.config.ts`: com esse arquivo, o `.env` deixa de ser carregado automaticamente. Nunca instale o Prisma sem versão (`npm install prisma`), porque isso pode trazer uma versão de teste.

### Endpoints prontos: Propriedades

Exigem token. Cada usuário vê só as próprias propriedades (veja [Quem vê o quê](#quem-vê-o-quê-propriedades-sensores-e-lotes)).

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/api/health` | Confere se o servidor está no ar (público) | 200 |
| GET | `/api/propriedades` | Lista as propriedades ativas do usuário por nome, com `totalLotes` e `totalSensores` | 200 |
| GET | `/api/propriedades/:id` | Detalhe de uma propriedade ativa do usuário, com as contagens | 200 |
| POST | `/api/propriedades` | Cadastra uma propriedade; o dono é o usuário logado (ADMIN ou PRODUTOR) | 201 |
| PUT | `/api/propriedades/:id` | Edita os campos do cadastro (ADMIN ou PRODUTOR, só da própria) | 200 |
| DELETE | `/api/propriedades/:id` | Exclusão lógica (status passa a `INATIVO`) (ADMIN ou PRODUTOR, só da própria) | 204 |

Corpo do POST/PUT (todos obrigatórios; outros campos são ignorados):

```json
{
  "nome": "Fazenda São Jorge",
  "area": 120.5,
  "cidade": "Petrolina",
  "uf": "PE",
  "latitude": -9.3346,
  "longitude": -40.6072
}
```

Erros respondem em JSON no formato `{ "erro": "mensagem" }`. Validação inválida (400) inclui também `campos`, com uma mensagem por campo. Id não numérico: 400. Propriedade inexistente, inativa ou de outra pessoa: 404. Sem token: 401. `TECNICO` ao criar, editar ou apagar: 403.

### Endpoints prontos: Culturas

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/api/culturas` | Lista as culturas por nome | 200 |
| GET | `/api/culturas/:id` | Detalhe de uma cultura | 200 |
| GET | `/api/culturas/:id/detalhes?lat=&lon=` | Cultura com clima atual nas coordenadas, alertas de faixa, cotação de mercado e estatísticas do IBGE. `lat` e `lon` são obrigatórios (400 se faltarem ou estiverem fora da faixa) | 200 |
| POST | `/api/culturas` | Cadastra uma cultura | 201 |
| PUT | `/api/culturas/:id` | Edita os campos do cadastro | 200 |
| DELETE | `/api/culturas/:id` | Apaga a cultura. Se ela tem lotes, não apaga e responde 409 | 204 |

Corpo do POST/PUT (`variedade` e `descricao` são opcionais; mínimo não pode ser maior que máximo; outros campos são ignorados):

```json
{
  "nome": "Manga",
  "variedade": "Tommy Atkins",
  "descricao": null,
  "temperaturaMin": 24,
  "temperaturaMax": 32,
  "umidadeMin": 40,
  "umidadeMax": 70
}
```

### Endpoints prontos: Preços de mercado (CONAB)

Não exige token (como Culturas, por enquanto). Traz os preços diários de atacado das CEASAs, lidos do arquivo ProHort da CONAB, só de UVA, MANGA, BANANA, GOIABA e MELAO.

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/api/precos?produto=&uf=&ceasa=&limite=` | Lista os preços do filtro, do mais novo para o mais antigo | 200 |

Filtros:

- `produto` (obrigatório): `UVA`, `MANGA`, `BANANA`, `GOIABA` ou `MELAO` (maiúscula e acento não importam: `Melão` vale). Qualquer outro produto dá **400**, e a mensagem lista os aceitos;
- `uf` (obrigatório): sigla do estado, como `PE`;
- `ceasa` (opcional): trecho do nome da CEASA, sem diferença de maiúscula ou acento (por exemplo, `recife`);
- `limite` (opcional): de 1 a 100, padrão 10.

Exemplo de resposta (`GET /api/precos?produto=UVA&uf=PE&limite=1`):

```json
{
  "fonte": "CONAB/PROHORT",
  "origem": "https://portaldeinformacoes.conab.gov.br/downloads/arquivos/ProhortDiario.txt",
  "consultadoEn": "2026-10-08T13:10:57.394Z",
  "filtros": { "produto": "UVA", "uf": "PE", "ceasa": null },
  "precoAtual": {
    "municipio": "RECIFE-PE",
    "uf": "PE",
    "ceasa": "CEASA/PE - RECIFE",
    "produto": "UVA",
    "variedade": "ITALIA",
    "unidade": "KG",
    "data": "2026-10-07",
    "preco": 5.56
  },
  "historico": [ { "...": "mesmo formato do precoAtual" } ]
}
```

Como ler a resposta:

- `data` vem em `AAAA-MM-DD`. `variedade` pode ser `null` (MANGA e GOIABA não têm variedade no arquivo).
- `precoAtual` é o primeiro item do `historico`: o registro **mais novo entre todas as variedades e CEASAs do filtro**. Como cada variedade e cada CEASA têm preço próprio, ele pode mudar de uma para outra de um dia para o outro. Para um preço estável, use `ceasa=`.
- Sem nenhum registro para o filtro: `historico` vem `[]` e `precoAtual` vem `null`. Nunca há preço inventado.
- `consultadoEn` é a hora em que o arquivo da CONAB foi baixado pela última vez, e não a hora do seu pedido.

Como funciona por dentro:

- O arquivo da CONAB tem mais de 170 MB. O backend baixa **uma vez**, em fluxo, guarda em memória só os 5 produtos dos últimos 12 meses e usa esse cache por **24 horas**. O primeiro pedido depois de subir o servidor leva alguns segundos, a menos que `CONAB_AQUECER_AO_INICIAR=true` esteja ligada (veja [Variáveis de ambiente](#variáveis-de-ambiente)); os seguintes saem do cache.
- Limites do download: 120 segundos e 400 MB. Se o cabeçalho do arquivo mudar, o backend recusa o arquivo em vez de ler colunas erradas.
- O backend faz **até 3 tentativas** no mesmo download, com pausa de 2 s e depois de 5 s, mas só em falha passageira (conexão cortada ou sem resposta, HTTP 429 ou 5xx). Erro que se repetiria igual (arquivo mudado, HTTP 4xx, estouro dos 120 s) não é repetido, e nenhuma tentativa nova começa depois de 90 s de download.
- Se a CONAB falhar nas 3 tentativas e **não** houver cache: **503** com `{ "erro": "Dados de mercado indisponíveis no momento. ..." }`. Se falhar, mas houver cache antigo: devolve o cache com `"desatualizado": true`. Depois dessa falha total de um pedido, o backend espera 5 minutos antes de tentar de novo (uma falha só do aquecimento ao ligar o servidor não ativa essa espera: o primeiro pedido tenta de novo).
- O `POST /api/precos` foi removido (responde 404).

### Endpoints prontos: Sensores

Exigem token. Cada usuário vê só os sensores das próprias propriedades (veja [Quem vê o quê](#quem-vê-o-quê-propriedades-sensores-e-lotes)).

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/api/sensores` | Lista os sensores ativos do usuário por código, cada um com o lote (`id` e `identificacao`) | 200 |
| GET | `/api/sensores/:id` | Detalhe de um sensor ativo do usuário, com o lote | 200 |
| POST | `/api/sensores` | Cadastra um sensor (ADMIN ou PRODUTOR). Código repetido: 409 | 201 |
| PUT | `/api/sensores/:id` | Edita os campos do cadastro (ADMIN ou PRODUTOR, só dos próprios). Código repetido: 409 | 200 |
| DELETE | `/api/sensores/:id` | Exclusão lógica (status passa a `INATIVO`) (ADMIN ou PRODUTOR, só dos próprios) | 204 |

Corpo do POST/PUT (`localizacao` é opcional; `dataInstalacao` em `AAAA-MM-DD`, data real e não futura; `loteId` precisa ser número e de um lote ativo visível ao usuário; outros campos são ignorados):

```json
{
  "codigo": "SJ-L1-S1",
  "tipo": "TEMPERATURA_UMIDADE",
  "localizacao": "Lote 1, ponto 1",
  "dataInstalacao": "2021-03-15",
  "loteId": 1
}
```

Nas respostas, `dataInstalacao` também vem em `AAAA-MM-DD`.

Erros do cadastro e da edição: `loteId` inexistente, de outra pessoa ou de lote `INATIVO`: 404 "Lote não encontrado." (a mesma resposta nos três casos); lote ativo de propriedade excluída (`INATIVO`): 400. Sensor de outra pessoa: 404.

### Endpoints prontos: Lotes

Exigem token. Cada usuário vê só os lotes das próprias propriedades (veja [Quem vê o quê](#quem-vê-o-quê-propriedades-sensores-e-lotes)).

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/api/lotes?propriedadeId=` | Lista os lotes ativos visíveis ao usuário. O filtro `propriedadeId` é opcional e precisa ser um inteiro positivo (senão, 400 com `campos`). Com `propriedadeId` de outra pessoa, a lista vem vazia | 200 |
| GET | `/api/lotes/:id` | Detalhe de um lote ativo. Lote de outra pessoa, inativo ou de propriedade inativa: 404 | 200 |
| POST | `/api/lotes` | Cadastra um lote (ADMIN ou PRODUTOR). A propriedade precisa ser do usuário | 201 |
| PUT | `/api/lotes/:id` | Edita o lote de forma **parcial**: o que for omitido mantém o valor salvo (ADMIN ou PRODUTOR, só dos próprios). O `propriedadeId` nunca muda | 200 |
| DELETE | `/api/lotes/:id?confirmar=true` | Exclusão lógica: o lote vira `INATIVO` e a linha nunca é apagada. Com sensores ativos, pede confirmação (veja abaixo) | 204 |

Corpo do POST (`colheitaEstimada`, `latitude` e `longitude` são opcionais; os outros campos são obrigatórios):

```json
{
  "identificacao": "Lote 5",
  "area": 12.5,
  "dataPlantacao": "2026-01-10",
  "colheitaEstimada": "2026-12-20",
  "situacao": "EM_CRESCIMENTO",
  "propriedadeId": 1,
  "culturaId": 2,
  "latitude": -9.3346,
  "longitude": -40.6072
}
```

No PUT, mande só o que quer mudar. `"colheitaEstimada": null` limpa a data, e `"latitude": null` com `"longitude": null` (as duas juntas) limpam o ponto no mapa. Os campos `id`, `status` e, no PUT, `propriedadeId` enviados no corpo são **ignorados**: o lote novo nasce `ATIVO`.

Exemplo de lote na resposta:

```json
{
  "id": 1,
  "identificacao": "Lote 1",
  "area": 30,
  "dataPlantacao": "2021-03-15",
  "colheitaEstimada": "2026-11-20",
  "situacao": "EM_PRODUCAO",
  "status": "ATIVO",
  "latitude": null,
  "longitude": null,
  "propriedadeId": 1,
  "culturaId": 2,
  "cultura": { "id": 2, "nome": "Manga", "variedade": "Tommy Atkins" },
  "totalSensores": 2
}
```

`area` vem como número, as datas em `AAAA-MM-DD` (`colheitaEstimada` pode ser `null`), `latitude` e `longitude` como número ou `null`, e `totalSensores` conta só os sensores ativos.

**Regras de validação** (erro 400 com `campos`, uma mensagem por campo):

- `identificacao` de 1 a 100 caracteres e `situacao` de 1 a 30 (texto livre), sem espaços sobrando nas pontas.
- `area` é número maior que 0, com até 2 casas decimais.
- `dataPlantacao` e `colheitaEstimada` em `AAAA-MM-DD`, datas reais. A `colheitaEstimada` não pode ser **anterior** à `dataPlantacao` (datas iguais são aceitas). No PUT, a regra vale sobre o resultado final: o que veio combinado com o que já está salvo.
- **Coordenadas: as duas juntas ou nenhuma.** Mandar só uma dá 400. Números (não texto), `latitude` de -90 a 90, `longitude` de -180 a 180, até 8 casas decimais. São opcionais: os lotes que já existiam ficam com `latitude` e `longitude` nulas, sem valor inventado.
- No cadastro, `propriedadeId` inexistente ou de outra pessoa: 404; propriedade `INATIVA`: 400; `culturaId` inexistente: 404.
- `TECNICO` não vê nem escreve nada em lotes (lista vazia, e 403 ao criar, editar ou apagar).

**Exclusão (`DELETE`)**

| Situação | Resposta |
|---|---|
| Lote **sem** sensores ativos | 204. O lote vira `INATIVO` |
| Lote **com** sensores ativos, sem `confirmar` | **409** com `{ "erro": "...", "totalSensores": N }`. Nada é alterado |
| `?confirmar=true` | 204. Os sensores ativos do lote e o próprio lote viram `INATIVOS`, numa única transação (tudo ou nada) |
| `confirmar` com qualquer outro valor (`false`, `abc`, vazio) | 400 |

Um lote `INATIVO` fica escondido de todos, **inclusive do ADMIN**: some da lista e responde 404 em `GET`, `PUT` e `DELETE`. Não existe rota para reativar. O histórico é preservado: os sensores e as leituras de um lote inativo continuam consultáveis em `/api/sensores` e `/api/leituras`. Sensores inativos não recebem novas leituras, e cadastrar ou mover um sensor para um lote inativo dá 404.

### Quem vê o quê (propriedades, sensores e lotes)

`/api/propriedades`, `/api/sensores` e `/api/lotes` exigem token (`Authorization: Bearer <token>`) e mostram só o que pertence ao usuário logado:

| Perfil | O que vê e o que pode fazer |
|---|---|
| `ADMIN` | Vê e mexe em tudo. |
| `PRODUTOR` | Vê e mexe só no que é dele: as propriedades em que ele é o dono, e os lotes e sensores dessas propriedades. Um PRODUTOR novo, sem propriedades, recebe lista vazia. |
| `TECNICO` | Não vê nada por enquanto (lista vazia; 404 por id; 403 ao criar, editar ou apagar), porque o banco ainda não liga técnico a propriedade. |
| Outro perfil | Tratado como `TECNICO`: nega por padrão. |

Regras:

- O dono de uma propriedade nova é sempre o usuário logado (para ADMIN, ele mesmo). `usuarioId` nunca vem do corpo da requisição.
- Acesso a um recurso de outra pessoa responde **404**, e não 403, para não revelar que o id existe.
- Sem token: 401.
- A regra de visibilidade fica num lugar só: `src/services/escopoDono.js`.
- As propriedades que já existiam no banco pertencem a usuários ADMIN. Um PRODUTOR novo não as vê até cadastrar as dele.

### Endpoints prontos: Autenticação e usuários

| Verbo | Rota | Acesso | O que faz | Sucesso |
|---|---|---|---|---|
| POST | `/api/auth/login` | público | Confere e-mail e senha e devolve o token e o usuário. Limite: 10 tentativas com falha a cada 15 minutos por IP (depois, 429) | 200 |
| GET | `/api/auth/me` | token | Devolve o usuário dono do token | 200 |
| POST | `/api/auth/logout` | token | Só responde 204: o servidor não guarda sessão. Quem "desloga" é o front, apagando o token, que expira sozinho (padrão: 2h) | 204 |
| POST | `/api/usuarios` | token de ADMIN | Cria um usuário com perfil `PRODUTOR`, `TECNICO` ou `ADMIN` | 201 |

Não existe cadastro público: só um ADMIN logado cria usuários, **inclusive outros ADMIN**. O primeiro ADMIN é o do seed (`SEED_ADMIN_EMAIL`). **Não abra essa rota**: se o `POST /api/usuarios` ficar sem login, qualquer pessoa poderia criar uma conta ADMIN.

Corpo do login (o e-mail aceita maiúsculas e espaços nas pontas; a senha tem no máximo 72 bytes):

```json
{ "email": "admin@valesafra.local", "senha": "sua-senha" }
```

Resposta do login (a senha, nem em hash, nunca aparece em nenhuma resposta):

```json
{
  "token": "eyJ...",
  "usuario": { "id": 1, "nome": "Administrador", "email": "admin@valesafra.local", "perfil": "ADMIN", "status": "ATIVO" }
}
```

Nas rotas que exigem login, envie o token no header:

```text
Authorization: Bearer <token>
```

Corpo do `POST /api/usuarios` (todos obrigatórios; o usuário sempre nasce `ATIVO`, e `id`, `status` e outros campos são ignorados):

```json
{ "nome": "Maria Silva", "email": "maria@exemplo.com", "senha": "no-minimo-8-bytes", "perfil": "TECNICO" }
```

Regras: `nome` com 1 a 150 caracteres; `email` em formato válido, até 254 caracteres, gravado em minúsculas; `senha` de 8 a 72 bytes (o bcrypt ignora o que passa de 72); `perfil` `PRODUTOR`, `TECNICO` ou `ADMIN`.

| Status | Quando |
|---|---|
| 400 | Dados inválidos, com `campos` (uma mensagem por campo). |
| 401 `"E-mail ou senha inválidos."` | Login com e-mail inexistente, senha errada ou usuário `INATIVO`: a mesma mensagem nos três casos, para não revelar quais e-mails existem. |
| 401 `"Não autenticado."` | Sem token, token inválido ou expirado, ou usuário do token inexistente ou `INATIVO`. Desativar um usuário corta o acesso na hora, mesmo com o token no prazo. |
| 403 `"Sem permissão para esta ação."` | Usuário logado sem o perfil exigido (ex.: `TECNICO` em `POST /api/usuarios`). |
| 409 `"E-mail já cadastrado."` | `POST /api/usuarios` com e-mail que já existe (sem diferenciar maiúsculas). |
| 429 | Muitas tentativas de login com falha. |

> **`/api/culturas` e `/api/precos` continuam abertas:** ainda não exigem login (a tela de Culturas do front chama sem token). A proteção delas entra numa próxima tarefa. `/api/auth/esqueci-senha` e `/api/auth/redefinir-senha` ainda não existem (respondem 404).

## Regras do banco

- Quem for mexer no `schema.prisma` usa um **banco próprio** (Opção 2) e **avisa o grupo antes**.
- Toda mudança de tabela vira uma **migration versionada** em `prisma/migrations/`, criada com `npm run db:migrar` no banco próprio e enviada no pull request.
- No banco compartilhado, a migration só é aplicada **depois de a mudança ser revisada**, e sempre com:

  ```cmd
  npx prisma migrate deploy
  ```

  O `migrate deploy` só aplica as migrations novas. Ele nunca propõe reset.
- Depois que um pull request com migration for mesclado, alguém precisa aplicá-la no banco compartilhado com o `migrate deploy` acima. Enquanto isso não acontece, o código novo pode falhar ao usar tabelas ou colunas que o banco ainda não tem.
- **Nunca** rode `npx prisma migrate reset` no banco compartilhado: ele apaga todos os dados.

## Variáveis de ambiente

O `.env` fica na raiz do projeto e **nunca vai para o Git** (está no `.gitignore`). O repositório tem o modelo `.env.example`, só com nomes e exemplos falsos: copie e preencha (no cmd: `copy .env.example .env`). Nunca coloque valor real no `.env.example` nem em qualquer arquivo que vai para o Git: os exemplos abaixo são fictícios.

| Variável | Para que serve | Exemplo fictício |
|---|---|---|
| `DATABASE_URL` | **Obrigatória.** Endereço de conexão com o PostgreSQL, lido pelo Prisma (`schema.prisma`). | `postgresql://USUARIO:SENHA@HOST/NOME_DO_BANCO?sslmode=require` |
| `PORT` | Opcional. Porta em que o servidor sobe. Se faltar, usa 3000. | `3000` |
| `CORS_ORIGIN` | Opcional. Única origem (endereço do frontend) que pode chamar a API pelo navegador. Se faltar, nenhuma origem externa é liberada. | `http://localhost:5173` |
| `JWT_SECRET` | **Obrigatória.** Chave que assina os tokens de login. Mínimo de 32 caracteres; sem ela, o servidor não sobe. | gerada pelo comando abaixo |
| `JWT_EXPIRES_IN` | Opcional. Validade do token, com unidade (`30m`, `2h`, `1d`). Se faltar, usa `2h`. | `2h` |
| `SEED_ADMIN_EMAIL` | Obrigatória só para rodar o seed. E-mail do usuário ADMIN criado pelo seed. Só o seed usa: a API não depende mais dele (o dono de uma propriedade é o usuário logado). | `admin@valesafra.local` |
| `SEED_ADMIN_SENHA` | Obrigatória só para rodar o seed. Senha do ADMIN criado pelo seed (salva no banco como hash bcrypt). | `troque-esta-senha` |
| `THINGSPEAK_CHANNEL_ID` | Obrigatória só se o agendador de leituras estiver ligado. Número do canal do ThingSpeak de onde vêm a temperatura e a umidade. | `1234567` |
| `THINGSPEAK_READ_KEY` | Obrigatória só se o agendador estiver ligado. Chave de leitura do canal. É segredo. | `troque-pela-chave-de-leitura` |
| `THINGSPEAK_SENSOR_CODIGO` | Obrigatória só se o agendador estiver ligado. Código do sensor, cadastrado e ativo no banco, que recebe as leituras. | `ESP32-EXEMPLO-01` |
| `LEITURAS_AGENDADOR_ATIVO` | Opcional. O agendador que busca as leituras no ThingSpeak vem **desligado** por padrão; só liga com exatamente `true`. | `false` |
| `LEITURAS_INTERVALO_MIN` | Opcional. De quanto em quanto tempo o agendador busca, em minutos (inteiro de 1 a 1440). Se faltar, usa 5. | `5` |
| `CONAB_AQUECER_AO_INICIAR` | Opcional. Vem **desligada** por padrão; só liga com exatamente `true`. Ligada, o servidor baixa o arquivo da CONAB (cerca de 180 MB) ao subir, em segundo plano, e o primeiro pedido a `/api/precos` já sai rápido. Para a demonstração, ligue-a. | `false` |

Como gerar o seu `JWT_SECRET` (no cmd, na pasta do projeto):

```cmd
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copie o valor gerado para a linha `JWT_SECRET="..."` do seu `.env`.

> [!IMPORTANT]
> **Cada dev gera o próprio `JWT_SECRET`.** Nunca versione, nunca mande no grupo e nunca cole em chat de IA: quem tem o segredo consegue criar tokens válidos de qualquer usuário, inclusive ADMIN. Trocar o segredo invalida todos os tokens já emitidos (todos precisam entrar de novo).

> [!IMPORTANT]
> **A `THINGSPEAK_READ_KEY` nunca vai para o Git, para log ou para chat.** E, num banco compartilhado, só **uma** pessoa deve ligar o agendador (`LEITURAS_AGENDADOR_ATIVO="true"`): se várias ligarem, cada máquina busca e grava as mesmas leituras ao mesmo tempo.

## Testes

Ainda não há testes automatizados (não existe o script `npm test`). Os endpoints são testados manualmente: cada endpoint é testado assim que fica pronto, incluindo os casos de erro (dados inválidos, id inexistente, JSON malformado).

## Deploy

O backend será publicado no Render.

O PostgreSQL fica no Render até a 1ª entrega (13/10/2026); o plano gratuito do Render expira em 20/10/2026. Depois disso, o banco vai para a AWS, conforme a 2ª entrega (08/12/2026).

## Padrão de contribuição

1. Criar uma branch.
2. Implementar a tarefa.
3. Testar manualmente os endpoints afetados.
4. Fazer commits objetivos.
5. Abrir um pull request.
6. Solicitar revisão.
7. Integrar após aprovação.

Regras:

- Nada direto na `main`.
- Atualizar o README quando a mudança afetar como rodar o projeto (variáveis do `.env`, scripts, endpoints, migrations).
- Avisar no grupo antes de mexer no `schema.prisma`.

## Status

MVP em desenvolvimento. A 1ª entrega é em 13/10/2026.

- Pronto: Propriedades, Culturas, Sensores e Lotes (APIs em `/api/propriedades`, `/api/culturas`, `/api/sensores` e `/api/lotes`), login (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`), criação de usuários por ADMIN (`POST /api/usuarios`) e visibilidade por dono em propriedades, sensores e lotes.
- Próximas tarefas: exigir login em Culturas e Preços, ligar técnico a propriedades, colocar as Leituras para rodar no Render (a busca por agendamento no ThingSpeak e o `GET /api/leituras` já existem; falta criar o sensor e as variáveis no Render) e recuperação de senha.
