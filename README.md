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

Os endpoints abaixo são uma proposta inicial e poderão ser ajustados.

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
GET  /api/leituras
POST /api/leituras
GET  /api/leituras/:id
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

A autenticação será baseada em JWT.

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

Existem duas formas de rodar o projeto:

- **Opção 1: banco compartilhado do grupo**, para quem vai desenvolver ou testar endpoints sem mexer no `schema.prisma`;
- **Opção 2: banco próprio e vazio**, para quem vai mexer no `schema.prisma` (criar ou alterar tabelas).

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

2. Coloque na raiz do projeto (a mesma pasta do `package.json`) o arquivo `.env` que o Igor mandou no privado. Não altere o conteúdo, não reenvie e não publique esse arquivo.

3. Teste a conexão com o banco (só lê, não altera nada):

   ```cmd
   npm run db:testar
   ```

   No banco compartilhado, o esperado é **aparecerem models** (`Usuario`, `Propriedade`, `Cultura`, `Lote`, `Sensor`): o banco já tem as tabelas. **Não rode `db:migrar` nem `db:seed`.** Se aparecer outro resultado, veja [Resultados do `db:testar`](#resultados-do-dbtestar) e [Erros comuns](#erros-comuns).

4. Suba o servidor:

   ```cmd
   npm run dev
   ```

5. Confira no navegador:
   - `http://localhost:3000/api/health` deve responder `{ "status": "ok" }`;
   - `http://localhost:3000/api/propriedades` deve responder uma lista em JSON com as propriedades ativas do banco (por exemplo, as fazendas de exemplo do seed), cada uma com `totalLotes` e `totalSensores`.

### Opção 2: banco próprio e vazio

Use esta opção quando for mexer no `schema.prisma`. Avise o grupo antes (veja [Regras do banco](#regras-do-banco)).

1. Clone o repositório e instale as dependências (igual ao passo 1 da Opção 1).

2. Crie o `.env` a partir do modelo:

   ```cmd
   copy .env.example .env
   ```

   Abra o `.env` e preencha:
   - `DATABASE_URL`: a URL do **seu** banco PostgreSQL, que precisa estar vazio (no Render, é a **External Database URL**);
   - `SEED_ADMIN_SENHA`: troque por uma senha sua.

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
| `@prisma/client did not initialize yet` (ou outro erro dizendo para rodar `prisma generate`) | O Prisma Client não foi gerado depois do `npm install` ou de uma mudança no `schema.prisma`. | Rode `npx prisma generate` e suba o servidor de novo. |

### Versão do Prisma

O Prisma está fixado na versão 6.19.3. Não rode `npx prisma init` nem crie `prisma.config.ts`: com esse arquivo, o `.env` deixa de ser carregado automaticamente. Nunca instale o Prisma sem versão (`npm install prisma`), porque isso pode trazer uma versão de teste.

### Endpoints prontos: Propriedades

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/api/health` | Confere se o servidor está no ar | 200 |
| GET | `/api/propriedades` | Lista as propriedades ativas por nome, com `totalLotes` e `totalSensores` | 200 |
| GET | `/api/propriedades/:id` | Detalhe de uma propriedade ativa, com as contagens | 200 |
| POST | `/api/propriedades` | Cadastra uma propriedade | 201 |
| PUT | `/api/propriedades/:id` | Edita os campos do cadastro | 200 |
| DELETE | `/api/propriedades/:id` | Exclusão lógica (status passa a `INATIVO`) | 204 |

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

Erros respondem em JSON no formato `{ "erro": "mensagem" }`. Validação inválida (400) inclui também `campos`, com uma mensagem por campo. Id não numérico: 400. Propriedade inexistente ou inativa: 404.

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

### Endpoints prontos: Sensores

| Verbo | Rota | O que faz | Sucesso |
|---|---|---|---|
| GET | `/api/sensores` | Lista os sensores ativos por código, cada um com o lote (`id` e `identificacao`) | 200 |
| GET | `/api/sensores/:id` | Detalhe de um sensor ativo, com o lote | 200 |
| POST | `/api/sensores` | Cadastra um sensor. Código repetido: 409 | 201 |
| PUT | `/api/sensores/:id` | Edita os campos do cadastro. Código repetido: 409 | 200 |
| DELETE | `/api/sensores/:id` | Exclusão lógica (status passa a `INATIVO`) | 204 |

Corpo do POST/PUT (`localizacao` é opcional; `dataInstalacao` em `AAAA-MM-DD`, data real e não futura; `loteId` precisa ser número e de um lote de propriedade ativa; outros campos são ignorados):

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

> **Ainda não há login:** todas as rotas acima estão abertas por enquanto. A autenticação (JWT) entra numa próxima tarefa.

## Regras do banco

- Quem for mexer no `schema.prisma` usa um **banco próprio** (Opção 2) e **avisa o grupo antes**.
- Toda mudança de tabela vira uma **migration versionada** em `prisma/migrations/`, criada com `npm run db:migrar` no banco próprio e enviada no pull request.
- No banco compartilhado, a migration só é aplicada **depois de a mudança ser revisada**, e sempre com:

  ```cmd
  npx prisma migrate deploy
  ```

  O `migrate deploy` só aplica as migrations novas. Ele nunca propõe reset.
- **Nunca** rode `npx prisma migrate reset` no banco compartilhado: ele apaga todos os dados.

## Variáveis de ambiente

O `.env` fica na raiz do projeto e **nunca vai para o Git** (está no `.gitignore`). O modelo é o `.env.example`. Nunca publique credenciais reais: os exemplos abaixo são fictícios.

| Variável | Para que serve | Exemplo fictício |
|---|---|---|
| `DATABASE_URL` | Endereço de conexão com o PostgreSQL, lido pelo Prisma (`schema.prisma`). | `postgresql://USUARIO:SENHA@HOST.render.com/NOME_DO_BANCO?sslmode=require` |
| `PORT` | Porta em que o servidor sobe. Se faltar, usa 3000. | `3000` |
| `CORS_ORIGIN` | Única origem (endereço do frontend) que pode chamar a API pelo navegador. Se faltar, nenhuma origem externa é liberada. | `http://localhost:5173` |
| `SEED_ADMIN_EMAIL` | E-mail do usuário ADMIN criado pelo seed. Também é usado pela API como dono das propriedades cadastradas, até o login ficar pronto. | `admin@valesafra.local` |
| `SEED_ADMIN_SENHA` | Senha do ADMIN criado pelo seed (salva no banco como hash bcrypt). | `troque-esta-senha` |

**Ainda não usadas** (entram nas próximas tarefas):

| Variável | Para que vai servir | Exemplo fictício |
|---|---|---|
| `JWT_SECRET` | Chave para assinar os tokens de login (JWT). | `troque-por-uma-chave-longa-e-aleatoria` |
| `NASA_POWER_BASE_URL` | Endereço base da NASA POWER API. | `https://power.larc.nasa.gov/api` |

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

- Pronto: Propriedades, Culturas e Sensores (APIs em `/api/propriedades`, `/api/culturas` e `/api/sensores`).
- Próximas tarefas: Lote, Leituras (ThingSpeak) e login.
