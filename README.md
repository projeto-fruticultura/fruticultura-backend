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

## Objetivo

Disponibilizar uma API segura e organizada para conectar:

- frontend hospedado no Netlify;
- simulação IoT executada no Wokwi;
- NASA POWER API;
- banco PostgreSQL hospedado no Render.

## Arquitetura

```text
Frontend no Netlify
        ↕ HTTPS/REST/JSON
Backend Node.js no Render
        ↕ Prisma ORM
PostgreSQL no Render
```

Fontes de dados:

```text
Wokwi/ESP32 → Backend
Backend ↔ NASA POWER API
```

## Tecnologias

- Node.js;
- Express;
- JavaScript ou TypeScript;
- Prisma ORM;
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
└── server.ts

prisma/
├── migrations/
├── schema.prisma
└── seed.ts
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

## Regras do banco

- Quem for mexer no `schema.prisma` usa um **banco próprio** (Opção 2) e **avisa o grupo antes**.
- Toda mudança de tabela vira uma **migration versionada** em `prisma/migrations/`, criada com `npm run db:migrar` no banco próprio e enviada no pull request.
- No banco compartilhado, a migration só é aplicada **depois de a mudança ser revisada**, e sempre com:

  ```cmd
  npx prisma migrate deploy
  ```

  O `migrate deploy` só aplica as migrations novas. Ele nunca propõe reset.
- **Nunca** rode `npx prisma migrate reset` no banco compartilhado: ele apaga todos os dados.

## Pré-requisitos

- Node.js;
- npm;
- PostgreSQL;
- Git.

## Instalação

```bash
git clone URL_DO_REPOSITORIO
cd pi-vale-backend
npm install
```

## Variáveis de ambiente

Crie um arquivo `.env`:

```env
PORT=3000
DATABASE_URL=
JWT_SECRET=
NASA_POWER_BASE_URL=https://power.larc.nasa.gov/api
FRONTEND_URL=http://localhost:5173
```

Nunca publique credenciais reais.

## Configuração do banco

Gerar o Prisma Client:

```bash
npx prisma generate
```

Executar as migrations:

```bash
npx prisma migrate dev
```

Popular o banco com dados iniciais:

```bash
npx prisma db seed
```

## Execução local

```bash
npm run dev
```

## Testes

```bash
npm test
```

## Deploy

O backend e o PostgreSQL serão publicados no Render.

## Padrão de contribuição

1. Criar uma branch.
2. Implementar a tarefa.
3. Executar os testes.
4. Fazer commits objetivos.
5. Abrir um pull request.
6. Solicitar revisão.
7. Integrar após aprovação.

## Status

Projeto em fase inicial de desenvolvimento.
