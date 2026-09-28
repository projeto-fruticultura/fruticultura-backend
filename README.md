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

### Pré-requisitos

- Node.js 18.18 ou superior;
- npm;
- acesso a um banco PostgreSQL (ex.: o do Render).

### Passo a passo

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o `.env.example` para `.env` e preencha os valores reais (a `DATABASE_URL` é a **External Database URL** do Render):

   ```bash
   cp .env.example .env
   ```

   No PowerShell: `Copy-Item .env.example .env`. O `.env` nunca vai para o Git.

3. Teste a conexão com o banco (só lê, não altera nada):

   ```bash
   npm run db:testar
   ```

   - `P4001 ... empty`: conectou e o banco está vazio;
   - aparecem models: conectou, mas o banco já tem tabelas. Não rode a migration sem conversar com o grupo, pois o Prisma pode propor apagar o banco;
   - `P1001` / `P1000`: servidor inacessível ou usuário/senha errados.

4. Crie as tabelas:

   ```bash
   npm run db:migrar
   ```

5. Popule o banco com o admin, as culturas e as fazendas de exemplo (pode rodar mais de uma vez sem duplicar):

   ```bash
   npm run db:seed
   ```

6. Suba o servidor:

   ```bash
   npm run dev
   ```

   Teste em `http://localhost:3000/api/health`, que deve responder `{ "status": "ok" }`.

O Prisma está fixado na versão 6.19.3. Não rode `npx prisma init` nem crie `prisma.config.ts`: com esse arquivo o `.env` deixa de ser carregado automaticamente.

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
