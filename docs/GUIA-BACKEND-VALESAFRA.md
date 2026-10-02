# Guia do Backend — ValeSafra

*Feito pelo Igor em 25/09/2026. Objetivo: todo mundo do backend (Igor, Arthur e Maria Clara) conseguir rodar o projeto e continuar do mesmo jeito.*

---

## 1. Como está o projeto

- **Stack:** Node.js + Express 5 + Prisma 6.19.3 + PostgreSQL (JavaScript).
- **Já pronto:** setup, banco (tabelas Usuário, Propriedade, Cultura, Lote, Sensor), seed e a **API de Propriedades** (listar, buscar, criar, editar, excluir). 19 testes passaram.
- **Onde está o código:** repositório `fruticultura-backend`, branch `feat/propriedades` (depois do PR ser aceito, na `main`).
- **A API de Propriedades é o modelo.** Cultura, Lote e Sensor seguem o mesmo padrão.

## 2. Decisões (e por quê)

- **PostgreSQL** (e não MySQL): a arquitetura e o material do PI pedem PostgreSQL. Com o Prisma o código é o mesmo nos dois, quase ninguém escreve SQL.
- **Banco no Render só até a 1ª entrega (13/10).** Ele é gratuito e expira em 20/10. Depois da entrega, vamos levar o banco pra **AWS**, como a 2ª entrega pede.
- **Prisma 6.19.3 fixo.** As versões novas (7 e 8) mudam onde a URL do banco fica e quebram os tutoriais. **Não atualizar.**

## 3. Como puxar o código e rodar na sua máquina

**Antes de começar:** ter o Node.js (versão 18.18 ou superior) e o Git instalados, e receber do Igor, no privado, o arquivo **`.env`** (ou só a URL do banco).

Use o terminal do VS Code (é **cmd**, então use `copy`).

**Passo 1. Pegar o código**
- Primeira vez: `git clone https://github.com/projeto-fruticultura/fruticultura-backend.git`, depois `cd fruticultura-backend`
- Já clonou antes: entre na pasta e rode `git fetch`
- Depois: `git checkout feat/propriedades` e `git pull`
  (quando o PR for aceito, troque `feat/propriedades` por `main`)

**Passo 2. Instalar as dependências:** `npm install`

**Passo 3. Configurar o `.env`**

*Forma A: o Igor mandou o arquivo `.env` pronto (mais simples)*
- Salve na raiz da pasta do projeto (o mesmo lugar do `package.json`). O nome tem que ser exatamente `.env`, sem `.txt` e sem `_` na frente. Se o Windows mudou o nome, renomeie. Depois vá para *Nas duas formas*, logo abaixo.

*Forma B: criar você mesmo (só com a URL do banco)*
1. `copy .env.example .env`
2. Abra o arquivo `.env` no VS Code.
3. Na linha `DATABASE_URL=`, cole a URL que o Igor mandou, **entre aspas**, sem espaço no começo nem no fim:
   `DATABASE_URL="cole-aqui-a-url"`
4. As outras linhas (`PORT`, `CORS_ORIGIN`...) já vêm no exemplo: deixe como estão.
5. Confira que o `.env` **não** aparece em `git status` (ele fica escondido de propósito, para a senha nunca ir pro GitHub).

*Nas duas formas: o seu `JWT_SECRET` (chave do login)*
1. Gere o seu, no terminal, na pasta do projeto: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. Acrescente no `.env` a linha `JWT_SECRET="cole-aqui-o-valor-gerado"`. Sem ela (ou com menos de 32 caracteres), o servidor não sobe.
3. Opcional: `JWT_EXPIRES_IN="2h"` (validade do login; se faltar, já é 2h).
4. **Cada um gera o seu.** Nunca mande o `JWT_SECRET` no grupo, no GitHub ou na IA: com ele, qualquer um cria um login falso de ADMIN.

**Passo 4. Testar a conexão:** `npm run db:testar`
Só lê o banco, não muda nada. Se funcionou, aparecem as tabelas (Usuario, Propriedade, Cultura, Lote, Sensor).

**Passo 5. Ligar o servidor:** `npm run dev`
Abra no navegador:
- `http://localhost:3000/api/health` (deve responder que está ok)
- `http://localhost:3000/api/propriedades` (deve listar as 3 fazendas do seed: São Jorge, do Vorcaro e Santa Luiza)

**Se der erro:**

| Erro | O que costuma ser |
|---|---|
| `Environment variable not found: DATABASE_URL` | O `.env` não existe ou a linha está com o nome errado |
| `Can't reach database server` | URL errada ou sem internet |
| `Authentication failed` | Senha ou usuário errado na URL |
| Erro falando de `Prisma Client` | Rode `npx prisma generate` |

Continuou com erro? Mande no grupo, **sem a URL**.

**Regras da URL e do `.env`:** eles têm a senha do banco. **Nunca** no grupo, no GitHub ou na IA. Depois de 13/10 o banco vai mudar de lugar e o Igor manda o `.env` ou a URL nova.

## 4. Como desenvolver uma tarefa nova

1. Crie uma **branch** a partir da `main` (`feat/nome-da-tarefa`). Nada direto na `main`.
2. Use como modelo a API de Propriedades.
3. **Teste cada endpoint assim que ficar pronto**, inclusive os casos de erro.
4. Se mudou algo que afeta como rodar o projeto, **atualize o README**.
5. Abra um **PR** (pedido para juntar na `main`). Outra pessoa revisa antes.

## 5. Regras do banco (importante)

**Só vai usar o que já existe (testar, chamar a API)?** Use o **banco compartilhado**, com a URL do Igor. Se criar dados de teste, apague depois.

**Vai mudar ou criar tabela (mexer no `schema.prisma`)?** Aí use um **banco próprio**:
1. **Avise no grupo antes**, para duas pessoas não mudarem a mesma coisa.
2. Crie o seu banco PostgreSQL grátis (o passo a passo o Igor manda à parte).
3. Troque a `DATABASE_URL` do seu `.env` pela URL do **seu** banco e **confira que trocou**.
4. Só então rode `npm run db:migrar`. Isso gera a migration, que vai no seu PR.

**Depois que o PR for aceito:** a migration é aplicada no banco compartilhado com `npx prisma migrate deploy`. Qualquer um dos três pode rodar (com a URL do compartilhado), só depois da revisão.

**Por que separar:** se alguém muda a tabela direto no banco de todos antes do código ser aceito, o banco fica diferente do código. O Prisma pede para resetar, e o reset apaga os dados.

- **NUNCA** rode `migrate reset` no banco compartilhado.
- **NUNCA** rode `npm run db:migrar` com a URL do banco compartilhado no `.env`.

## 6. Usando IA (chat) para desenvolver

Pode usar a IA do jeito que preferir. Só cole o bloco abaixo **no começo** da conversa, para ela seguir o nosso padrão:

```
Contexto: backend do projeto ValeSafra. Stack: Node.js + Express 5 + Prisma 6.19.3 (versão FIXA, não sugerir atualizar) + PostgreSQL. JavaScript (CommonJS).

Regras:
- NÃO usar Prisma 7 ou 8, NÃO criar prisma.config.ts, NÃO rodar "prisma init". A URL fica no schema.prisma com env("DATABASE_URL").
- NÃO usar MySQL. O banco é PostgreSQL.
- Estrutura: src/config, controllers, services, validators, routes, middlewares; prisma/schema.prisma e seed.js. Seguir o padrão da API de Propriedades já pronta.
- Nomes em português, iguais ao schema. Comentários curtos explicando o porquê. Sem emoji.
- Segurança: validar tudo no backend; id, status e dono NUNCA vêm do body; exclusão lógica (status INATIVO); nunca devolver stack trace; senha só com bcrypt; nunca usar $queryRawUnsafe com dado vindo do usuário.
- Mudança de tabela vira migration. Nunca sugerir "migrate reset" no banco compartilhado.
- Quando eu pedir código, explique o porquê das decisões, porque estou aprendendo.
```

**Cuidados com a IA:**
- **Nunca cole a URL do banco, senha ou o `.env` no chat da IA.**
- Se a IA sugerir "atualize o Prisma" ou "rode o `prisma init`", **não faça** e me pergunte.
- Leia o que a IA gerou antes de aplicar. Código que "parece certo" pode ter falha de segurança.

## 7. Travou? Peça ajuda

Perguntar cedo economiza tempo de todo mundo. Pode mandar no grupo, ou pedir à sua IA para ajudar a entender o erro (colando o erro, **sem a URL**).
