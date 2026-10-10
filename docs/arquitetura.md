# Arquitetura do ValeSafra (1ª entrega)

Diagrama em Mermaid. O GitHub desenha sozinho quando este arquivo está no repositório.

```mermaid
flowchart LR
  U["Usuários<br/>ADMIN, PRODUTOR, TECNICO"]

  subgraph FRONT["Frontend"]
    F["React + Vite + Tailwind, PWA<br/>hoje: localhost:5173<br/>alvo: Netlify"]
  end

  subgraph BACK["Backend: Node.js + Express + Prisma"]
    API["API REST em /api<br/>login com JWT e perfis"]
    AG["Agendador de leituras<br/>a cada 5 minutos"]
  end

  DB[("PostgreSQL<br/>Render, região Ohio")]

  subgraph IOT["IoT"]
    ESP["ESP32 + sensor DHT11<br/>temperatura e umidade"]
    TS["ThingSpeak<br/>canal de leituras"]
  end

  subgraph EXT["APIs externas"]
    OM["Open-Meteo<br/>clima atual"]
    IBGE["IBGE<br/>dados da região"]
    CONAB["CONAB<br/>preços, cache de 24 h"]
    NASA["NASA POWER<br/>clima histórico"]
  end

  U -->|"navegador"| F
  F -->|"HTTPS, token no cabeçalho"| API
  API -->|"Prisma"| DB

  ESP -->|"MQTT, a cada 16 s"| TS
  AG -->|"busca as últimas 100 leituras"| TS
  AG -->|"grava leituras novas"| DB

  API -->|"detalhes da cultura"| OM
  API -->|"detalhes da cultura"| IBGE
  API -->|"/api/precos"| CONAB
  API -->|"clima da propriedade"| NASA
```

## Como os dados andam

1. **Sensor até o banco:** o ESP32 publica temperatura e umidade no ThingSpeak por MQTT, a cada 16 segundos. O agendador do backend busca as últimas 100 leituras a cada 5 minutos, descarta as inválidas, ignora as que já existem e grava as novas no PostgreSQL.
2. **Banco até a tela:** o front pede os dados à API com o token de login. A API só devolve o que o perfil pode ver: o ADMIN vê tudo, e o PRODUTOR vê só as propriedades dele.
3. **Dados externos:** quando a tela de detalhes da cultura ou o clima da propriedade é aberto, a API consulta Open-Meteo, IBGE ou NASA. Os preços vêm da CONAB, com cache de 24 horas. Se uma API externa falhar, a tela recebe um aviso em vez de quebrar.

## Observações

- **Hoje tudo roda local** (1ª entrega). Netlify e Render são o destino planejado, e o banco já está no Render.
- O agendador deve rodar em **uma instância só**, para não buscar as mesmas leituras duas vezes.
- As credenciais (senha do banco, chave do JWT, chaves do ThingSpeak) ficam em variáveis de ambiente e não entram no repositório.
