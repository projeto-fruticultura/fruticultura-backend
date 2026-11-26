const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const ref = name => ({
  $ref: "#/components/schemas/" + name,
});

const obj = (properties, required = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

const arr = items => ({
  type: "array",
  items,
});

const str = options => ({
  type: "string",
  ...options,
});

const num = options => ({
  type: "number",
  ...options,
});

const int = options => ({
  type: "integer",
  ...options,
});

const bool = options => ({
  type: "boolean",
  ...options,
});

const en = (values, options) => ({
  type: "string",
  enum: values,
  ...options,
});

const extra = (schema, options) => ({
  ...schema,
  ...options,
});

const texto = (minLength, maxLength) =>
  str({ minLength, maxLength });

const numero = (minimum, maximum, multipleOf) =>
  num({
    minimum,
    maximum,
    ...(multipleOf ? { multipleOf } : {}),
  });

const inteiro = (minimum, maximum = 2147483647) =>
  int({ minimum, maximum });

const id = inteiro(1);
const status = en(["ATIVO", "INATIVO"]);
const perfil = en(["ADMIN", "PRODUTOR", "TECNICO"]);

const fases = [
  "VEGETATIVA",
  "FLORACAO_PANICULA",
  "FRUTIFICACAO",
  "MATURACAO",
];

const ufs = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF",
  "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS",
  "RO", "RR", "SC", "SP", "SE", "TO",
];

const area = numero(0.01, 99999999.99, 0.01);
const data = str({ format: "date" });
const instante = str({ format: "date-time" });

const textoNulo = str({ nullable: true });
const numeroNulo = num({ nullable: true });
const booleanoNulo = bool({ nullable: true });

const todos = ["ADMIN", "TECNICO", "PRODUTOR"];
const admin = ["ADMIN"];
const gestor = ["ADMIN", "PRODUTOR"];
const tecnico = ["ADMIN", "TECNICO"];
const produtor = ["PRODUTOR"];

const schemas = {};

schemas.Erro = extra(
  obj({
    erro: str(),
    campos: {
      type: "object",
      additionalProperties: str(),
    },
    totalSensores: inteiro(0),
  }, ["erro"]),
  {
    description:
      "Erros esperados não retornam stack trace ou segredos. " +
      "X-Request-Id identifica a requisição.",
  }
);

schemas.Paginacao = obj({
  pagina: id,
  limite: inteiro(1, 100),
  total: inteiro(0),
  totalPaginas: inteiro(0),
}, ["pagina", "limite", "total", "totalPaginas"]);

schemas.Usuario = obj({
  id,
  nome: str(),
  email: str({ format: "email" }),
  perfil,
  status,
}, ["id", "nome", "email", "perfil", "status"]);

schemas.LoginEntrada = extra(
  obj({
    email: texto(1, 254),
    senha: str({
      minLength: 1,
      format: "password",
      writeOnly: true,
      description:
        "Até 72 bytes UTF-8; espaços são preservados.",
    }),
  }, ["email", "senha"]),
  {
    example: {
      email: "produtor@example.com",
      senha: "SenhaExemplo123",
    },
  }
);

schemas.LoginResposta = obj({
  token: str(),
  usuario: ref("Usuario"),
}, ["token", "usuario"]);

schemas.UsuarioCriar = extra(
  obj({
    nome: texto(1, 150),
    email: str({
      minLength: 1,
      maxLength: 254,
      format: "email",
    }),
    perfil,
    senha: str({
      format: "password",
      writeOnly: true,
      description:
        "Obrigatória no cadastro: 8 a 72 bytes UTF-8.",
    }),
  }, ["nome", "email", "senha", "perfil"]),
  {
    example: {
      nome: "Produtor de exemplo",
      email: "produtor@example.com",
      perfil: "PRODUTOR",
      senha: "SenhaExemplo123",
    },
  }
);

schemas.UsuarioAtualizar = extra(
  obj({
    nome: texto(1, 150),
    email: str({
      minLength: 1,
      maxLength: 254,
      format: "email",
    }),
    perfil,
    status: en(["ATIVO"], {
      description:
        "Somente reativação. Use DELETE para inativar. " +
        "senha é ignorada neste PUT.",
    }),
  }),
  {
    description:
      "PUT parcial. ADMIN não pode alterar o próprio perfil. " +
      "Campos desconhecidos são ignorados.",
    example: {
      status: "ATIVO",
    },
  }
);

schemas.VinculosEntrada = extra(
  obj({
    propriedadeIds: arr(id),
  }, ["propriedadeIds"]),
  {
    description:
      "Substitui todos os vínculos do técnico. " +
      "Lista vazia desvincula tudo. Até 100 IDs distintos; " +
      "duplicatas são eliminadas pelo servidor.",
    example: {
      propriedadeIds: [1, 2],
    },
  }
);

schemas.CulturaEntrada = extra(
  obj({
    nome: texto(2, 100),
    variedade: str({
      maxLength: 100,
      nullable: true,
    }),
    descricao: str({
      maxLength: 1000,
      nullable: true,
    }),
    temperaturaMin: numero(-50, 60, 0.01),
    temperaturaMax: numero(-50, 60, 0.01),
    umidadeMin: numero(0, 100, 0.01),
    umidadeMax: numero(0, 100, 0.01),
  }, [
    "nome",
    "temperaturaMin",
    "temperaturaMax",
    "umidadeMin",
    "umidadeMax",
  ]),
  {
    description:
      "POST e PUT exigem os campos obrigatórios. " +
      "Mínimos não podem superar máximos. " +
      "Texto opcional vazio vira null.",
    example: {
      nome: "Uva",
      variedade: "Vitória",
      temperaturaMin: 20,
      temperaturaMax: 30,
      umidadeMin: 40,
      umidadeMax: 70,
    },
  }
);

schemas.Cultura = obj({
  id,
  ...schemas.CulturaEntrada.properties,
}, ["id", ...schemas.CulturaEntrada.required]);

schemas.CulturaResumo = obj({
  id,
  nome: str(),
  variedade: textoNulo,
}, ["id", "nome"]);

schemas.PropriedadeEntrada = extra(
  obj({
    nome: texto(3, 255),
    area,
    uf: en(ufs),
    cidade: texto(2, 100),
    latitude: num({
      minimum: -90,
      maximum: 90,
      nullable: true,
    }),
    longitude: num({
      minimum: -180,
      maximum: 180,
      nullable: true,
    }),
  }, ["nome", "area", "uf", "cidade"]),
  {
    description:
      "POST e PUT exigem nome, área, UF e cidade. " +
      "No cadastro, cada coordenada ausente recebe estimativa da UF. " +
      "O dono vem do JWT; usuarioId e status do corpo são ignorados. " +
      "No PUT, coordenadas omitidas mantêm o valor.",
    example: {
      nome: "Propriedade de exemplo",
      area: 5,
      cidade: "Petrolina",
      uf: "PE",
      latitude: -9.39,
      longitude: -40.5,
    },
  }
);

schemas.PropriedadeResumo = extra(
  obj({
    id,
    nome: str(),
    cidade: str(),
    uf: str(),
    coordenadasEstimadasUf: booleanoNulo,
    totalLotes: inteiro(0),
    totalSensores: inteiro(0),
  }, [
    "id", "nome", "cidade", "uf",
    "totalLotes", "totalSensores",
  ]),
  {
    description:
      "coordenadasEstimadasUf: true se alguma estimada; " +
      "false se ambas informadas; null se a origem é desconhecida.",
  }
);

schemas.Propriedade = obj({
  id,
  ...schemas.PropriedadeEntrada.properties,
  status,
  usuarioId: id,
  criadoEm: instante,
  atualizadoEm: instante,
  coordenadasEstimadasUf: booleanoNulo,
  totalLotes: inteiro(0),
  totalSensores: inteiro(0),
}, ["id", "nome", "area", "cidade", "uf"]);

schemas.LoteCriar = extra(
  obj({
    identificacao: texto(1, 100),
    area,
    dataPlantacao: data,
    colheitaEstimada: str({
      format: "date",
      nullable: true,
    }),
    situacao: texto(1, 30),
    culturaId: id,
    latitude: num({
      minimum: -90,
      maximum: 90,
      nullable: true,
    }),
    longitude: num({
      minimum: -180,
      maximum: 180,
      nullable: true,
    }),
    faseFenologica: en([...fases, null], {
      nullable: true,
    }),
    propriedadeId: id,
  }, [
    "identificacao",
    "area",
    "dataPlantacao",
    "situacao",
    "culturaId",
    "propriedadeId",
  ]),
  {
    description:
      "Coordenadas: enviar ambas numéricas com até 8 casas, " +
      "ambas null ou omitir ambas. " +
      "Colheita não pode anteceder plantação. " +
      "situacao é texto livre.",
    example: {
      identificacao: "Lote de exemplo",
      area: 2,
      dataPlantacao: "2026-09-01",
      situacao: "PLANTADO",
      culturaId: 3,
      propriedadeId: 19,
      faseFenologica: "VEGETATIVA",
    },
  }
);

const {
  propriedadeId: propriedadeDoLote,
  ...loteFields
} = schemas.LoteCriar.properties;

schemas.LoteAtualizar = extra(
  obj(loteFields),
  {
    description:
      "PUT parcial. propriedadeId e status são ignorados. " +
      "Coordenadas: ambas numéricas, ambas null ou ambas omitidas. " +
      "Colheita não antecede plantação.",
    example: {
      faseFenologica: "MATURACAO",
    },
  }
);

schemas.Lote = obj({
  id,
  ...loteFields,
  propriedadeId: id,
  status,
  cultura: ref("CulturaResumo"),
  totalSensores: inteiro(0),
}, [
  "id", "identificacao", "propriedadeId",
  "culturaId", "area", "dataPlantacao",
  "status", "totalSensores",
]);

schemas.SensorEntrada = extra(
  obj({
    codigo: texto(1, 45),
    tipo: texto(1, 45),
    localizacao: str({
      maxLength: 150,
      nullable: true,
    }),
    dataInstalacao: str({
      format: "date",
      description: "Data real e não futura.",
    }),
    loteId: id,
  }, ["codigo", "tipo", "dataInstalacao", "loteId"]),
  {
    description:
      "POST e PUT exigem os campos obrigatórios. " +
      "channelId, readApiKey e status são ignorados no CRUD. " +
      "Configure a integração em POST /sensores/config.",
    example: {
      codigo: "SENSOR-EXEMPLO",
      tipo: "TEMPERATURA_UMIDADE",
      dataInstalacao: "2026-09-01",
      loteId: 19,
    },
  }
);

const decimalPrisma = {
  oneOf: [num(), str()],
};

schemas.Sensor = extra(
  obj({
    id,
    codigo: texto(1, 45),
    tipo: texto(1, 45),
    localizacao: str({
      maxLength: 150,
      nullable: true,
    }),
    dataInstalacao: instante,
    loteId: id,
    status,
    channelId: textoNulo,
    lote: obj({
      id,
      identificacao: str(),
      propriedadeId: id,
      propriedade: obj({
        id,
        nome: str(),
        usuarioId: id,
        status,
        area: decimalPrisma,
        latitude: decimalPrisma,
        longitude: decimalPrisma,
      }),
    }),
  }, ["id", "codigo", "tipo", "loteId", "status"]),
  {
    description:
      "Datas e relações são serializadas pelo Prisma. " +
      "Decimais de relações aninhadas podem ser texto. " +
      "readApiKey nunca é retornada.",
  }
);

schemas.ThingSpeakEntrada = extra(
  obj({
    sensorId: id,
    channelId: str({
      pattern: "^\\d{1,20}$",
    }),
    readApiKey: str({
      pattern: "^[A-Za-z0-9]{1,64}$",
      minLength: 1,
      maxLength: 64,
      format: "password",
      writeOnly: true,
    }),
  }, ["sensorId", "channelId", "readApiKey"]),
  {
    description:
      "Não aceita espaços nas credenciais. " +
      "Testa canal e chave antes de gravar. " +
      "A chave do exemplo é fictícia.",
    example: {
      sensorId: 40,
      channelId: "3500440",
      readApiKey: "CHAVEEXEMPLO123",
    },
  }
);

schemas.ThingSpeakResposta = obj({
  id,
  codigo: str(),
  channelId: str(),
  conectado: bool(),
}, ["id", "codigo", "channelId", "conectado"]);

schemas.Leitura = extra(
  obj({
    id,
    sensorId: id,
    temperatura: num(),
    umidade: num(),
    dataHoraLeitura: instante,
  }, [
    "id", "sensorId", "temperatura",
    "umidade", "dataHoraLeitura",
  ]),
  {
    description:
      "umidade é o campo legado; sua interpretação depende " +
      "do contrato do dispositivo.",
  }
);

schemas.LeiturasResposta = obj({
  dados: arr(ref("Leitura")),
  paginacao: ref("Paginacao"),
}, ["dados", "paginacao"]);

schemas.EstatisticasLeituras = extra(
  obj({
    totalLeituras: inteiro(0),
    temperaturaMedia: numeroNulo,
    temperaturaMin: numeroNulo,
    temperaturaMax: numeroNulo,
    umidadeMedia: numeroNulo,
    umidadeMin: numeroNulo,
    umidadeMax: numeroNulo,
  }, ["totalLeituras"]),
  {
    description:
      "Agregações do período inteiro, não somente da página. " +
      "Sem dados, os valores são null.",
  }
);

schemas.SensorLeiturasResposta = obj({
  periodoSelecionado: en(["24h", "7d", "30d"]),
  estatisticas: ref("EstatisticasLeituras"),
  leituras: arr(ref("Leitura")),
  paginacao: ref("Paginacao"),
}, [
  "periodoSelecionado", "estatisticas",
  "leituras", "paginacao",
]);

schemas.Alerta = obj({
  tipo: en([
    "TEMPERATURA_BAIXA",
    "TEMPERATURA_ALTA",
    "UMIDADE_BAIXA",
    "UMIDADE_ALTA",
  ]),
  valor: num(),
  limite: num(),
  dataHoraLeitura: instante,
  leituraDesatualizada: bool(),
  sensorId: id,
  sensorCodigo: str(),
  loteId: id,
  loteIdentificacao: str(),
  propriedadeId: id,
  culturaNome: str(),
}, [
  "tipo", "valor", "limite", "sensorId",
  "loteId", "propriedadeId",
  "dataHoraLeitura", "leituraDesatualizada",
]);

schemas.AlertasResposta = obj({
  total: inteiro(0),
  alertas: arr(ref("Alerta")),
}, ["total", "alertas"]);

schemas.AlertaRisco = obj({
  id,
  sensorId: id,
  tipo: str(),
  nivel: str(),
  inicio: instante,
  fim: instante,
  duracaoMinutos: num(),
  regraVersao: str(),
  criadoEm: instante,
}, [
  "sensorId", "tipo", "nivel", "inicio",
  "fim", "duracaoMinutos", "regraVersao",
]);

schemas.IndicadoresSensor = obj({
  sensorId: id,
  horasObservadas: num({ minimum: 0 }),
  horasForaFaixa: num({ minimum: 0 }),
  adequacaoPercentual: num({
    minimum: 0,
    maximum: 100,
    nullable: true,
  }),
  grausDiaObservados: numeroNulo,
  regraVersao: str(),
}, [
  "sensorId", "horasObservadas", "horasForaFaixa",
  "adequacaoPercentual", "grausDiaObservados",
  "regraVersao",
]);

schemas.LogisticaCriar = extra(
  obj({
    origem: texto(1, 150),
    destino: texto(1, 150),
    modal: en([
      "RODOVIARIO",
      "FERROVIARIO",
      "AEREO",
      "MARITIMO",
    ]),
    tempoEstimadoHoras: numero(0.1, 99999.9, 0.1),
    custo: numero(0, 9999999999.99, 0.01),
    transportadora: texto(1, 150),
    situacao: en([
      "PLANEJADA",
      "EM_TRANSITO",
      "ENTREGUE",
      "CANCELADA",
    ]),
    exigeRefrigeracaoRapida: booleanoNulo,
    colhidoEm: str({
      format: "date-time",
      nullable: true,
    }),
    resfriadoEm: str({
      format: "date-time",
      nullable: true,
    }),
    temperaturaResfriamentoC: num({
      minimum: -273.15,
      maximum: 100,
      nullable: true,
    }),
    propriedadeId: id,
  }, [
    "propriedadeId", "origem", "destino",
    "modal", "tempoEstimadoHoras", "custo",
    "transportadora", "situacao",
  ]),
  {
    description:
      "exigeRefrigeracaoRapida é declaração do operador. " +
      "Medições de resfriamento: omitir todas, enviar as três null, " +
      "ou enviar as três válidas. Datas UTC com Z não futuras; " +
      "resfriamento não antecede colheita.",
    example: {
      propriedadeId: 19,
      origem: "Petrolina",
      destino: "Recife",
      modal: "RODOVIARIO",
      tempoEstimadoHoras: 10,
      custo: 1500,
      transportadora: "Transportadora de exemplo",
      situacao: "PLANEJADA",
      exigeRefrigeracaoRapida: true,
    },
  }
);

const {
  propriedadeId: propriedadeDaRota,
  ...logisticaFields
} = schemas.LogisticaCriar.properties;

schemas.LogisticaAtualizar = extra(
  obj(logisticaFields),
  {
    description:
      "PUT parcial. propriedadeId e status são ignorados. " +
      schemas.LogisticaCriar.description,
    example: {
      situacao: "EM_TRANSITO",
    },
  }
);

schemas.Logistica = obj({
  id,
  propriedadeId: id,
  ...logisticaFields,
  status,
  criadoEm: instante,
  atualizadoEm: instante,
  refrigeracao: obj({
    origem: en([
      "NAO_INFORMADO",
      "DECLARACAO_OPERADOR",
    ]),
    prazoReferenciaHoras: numeroNulo,
    comparadorPrazo: en(["MENOR_QUE", null], {
      nullable: true,
    }),
    temperaturaCargaVerificada: bool({
      enum: [false],
    }),
  }, [
    "origem", "prazoReferenciaHoras",
    "comparadorPrazo", "temperaturaCargaVerificada",
  ]),
}, [
  "id", "propriedadeId", "origem", "destino",
  "modal", "tempoEstimadoHoras", "custo",
  "transportadora", "situacao", "status",
]);

schemas.LogisticaLista = obj({
  dados: arr(ref("Logistica")),
  paginacao: ref("Paginacao"),
}, ["dados", "paginacao"]);

schemas.ComparacaoLogistica = obj({
  propriedadesComparadas: inteiro(2, 10),
  calculadoEm: instante,
  indicadores: arr(
    obj({
      id,
      nome: str(),
      cidade: str(),
      uf: str(),
      rotasAtivas: inteiro(0),
      custoTotalRotas: num({ minimum: 0 }),
      rotasPorSituacao: {
        type: "object",
        additionalProperties: inteiro(0),
      },
      rotasPorModal: {
        type: "object",
        additionalProperties: inteiro(0),
      },
      custoMedioRota: numeroNulo,
      custoMinimoRota: numeroNulo,
      custoMaximoRota: numeroNulo,
      prazoMedioHoras: numeroNulo,
      prazoMinimoHoras: numeroNulo,
      prazoMaximoHoras: numeroNulo,
    })
  ),
  observacao: str(),
}, [
  "propriedadesComparadas", "calculadoEm",
  "indicadores", "observacao",
]);

schemas.DashboardResumo = obj({
  ultimaLeitura: extra(
    obj({
      sensorId: id,
      sensorCodigo: str(),
      temperatura: num(),
      umidade: num(),
      dataHoraLeitura: instante,
    }),
    { nullable: true }
  ),
  totalAlertas: inteiro(0),
  sensoresAtivos: inteiro(0),
  totalLeituras: inteiro(0),
  temperaturaMedia: numeroNulo,
  umidadeMedia: numeroNulo,
  janelaMediasHoras: id,
}, [
  "ultimaLeitura", "totalAlertas", "sensoresAtivos",
  "totalLeituras", "temperaturaMedia",
  "umidadeMedia", "janelaMediasHoras",
]);

schemas.DashboardMedias = obj({
  agrupar: en(["hora", "dia"]),
  fuso: str({ example: "America/Recife" }),
  de: instante,
  ate: instante,
  dados: arr(
    obj({
      periodo: instante,
      temperaturaMedia: num(),
      umidadeMedia: num(),
      quantidade: inteiro(0),
    })
  ),
}, ["agrupar", "fuso", "de", "ate", "dados"]);

schemas.AreasProdutor = extra(
  obj({
    protecao: num({ minimum: 0 }),
    risco: num({ minimum: 0 }),
    semDados: num({ minimum: 0 }),
  }, ["protecao", "risco", "semDados"]),
  {
    description:
      "Áreas em hectares. Usa leituras de até 60 minutos " +
      "e cobertura dos sensores ativos do lote. " +
      "Não representa diagnóstico fitossanitário.",
  }
);

schemas.AlertasDoDia = extra(
  obj({
    total: inteiro(0),
    inicioDia: instante,
    fuso: str({ example: "America/Recife" }),
  }, ["total", "inicioDia", "fuso"]),
  {
    description:
      "Conta episódios que sobrepõem o dia local. " +
      "Mudanças de nível não duplicam sensor/tipo/início.",
  }
);

schemas.Auditoria = obj({
  id,
  usuarioId: id,
  operacao: en(["CREATE", "UPDATE", "DELETE"]),
  recurso: str(),
  recursoId: textoNulo,
  dataHora: instante,
  ip: str(),
}, [
  "id", "usuarioId", "operacao",
  "recurso", "dataHora", "ip",
]);

schemas.Metricas = extra(
  obj({
    requisicoes: num({ minimum: 0 }),
    erros4xx: num({ minimum: 0 }),
    erros5xx: num({ minimum: 0 }),
    duracaoTotalMs: num({ minimum: 0 }),
    latenciaMediaMs: num({ minimum: 0 }),
    taxaErros4xx: num({ minimum: 0 }),
    taxaErros5xx: num({ minimum: 0 }),
  }, [
    "requisicoes", "erros4xx", "erros5xx",
    "duracaoTotalMs", "latenciaMediaMs",
    "taxaErros4xx", "taxaErros5xx",
  ]),
  {
    description:
      "Contadores em memória, reiniciados com o processo. " +
      "Taxas são frações entre 0 e 1.",
  }
);

schemas.Saude = obj({
  status: en(["ok"]),
}, ["status"]);

schemas.ClimaPropriedade = extra(
  obj({
    propriedadeId: id,
    nomePropriedade: str(),
    coordenadas: obj({
      latitude: num(),
      longitude: num(),
    }),
    fonteClima: str(),
    periodo: obj({
      inicio: str({ pattern: "^\\d{8}$" }),
      fim: str({ pattern: "^\\d{8}$" }),
    }),
    parametrosClimaticos: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: numeroNulo,
      },
    },
  }, [
    "propriedadeId", "nomePropriedade",
    "coordenadas", "fonteClima", "periodo",
    "parametrosClimaticos",
  ]),
  {
    description:
      "NASA POWER dos últimos cinco dias até ontem. " +
      "Sentinela -999 torna-se null.",
  }
);

schemas.CotacaoEntrada = extra(
  obj({
    culturaId: id,
    mercadoDestino: en(["INTERNO", "EXPORTACAO"]),
    paisDestino: str({
      pattern: "^[A-Z]{2}$",
      description:
        "INTERNO: BR por padrão. " +
        "EXPORTACAO: obrigatório e diferente de BR.",
    }),
    precoMedio: numero(
      0.0001,
      9999999999.9999,
      0.0001
    ),
    unidade: en(["KG"]),
    moeda: en(["BRL", "USD", "EUR", "GBP"]),
    dataReferencia: str({
      format: "date",
      description: "Data real e não futura.",
    }),
    fonteNome: texto(3, 150),
    fonteReferencia: texto(3, 500),
    demandaEstimadaKg: num({
      minimum: 0,
      maximum: 999999999999.99,
      multipleOf: 0.01,
      nullable: true,
    }),
    demandaInicio: str({
      format: "date",
      nullable: true,
    }),
    demandaFim: str({
      format: "date",
      nullable: true,
    }),
    fonteDemanda: str({
      minLength: 3,
      maxLength: 500,
      nullable: true,
    }),
    metodoDemanda: str({
      minLength: 10,
      maxLength: 1000,
      nullable: true,
    }),
    unidadeDemanda: en(["KG"]),
  }, [
    "culturaId", "mercadoDestino", "precoMedio",
    "moeda", "dataReferencia",
    "fonteNome", "fonteReferencia",
  ]),
  {
    description:
      "POST e PUT validam o cadastro completo. " +
      "Se informar demandaEstimadaKg, informar período, fonte e método. " +
      "Fim da demanda não antecede início. " +
      "Não há estimativa automática de demanda nem câmbio.",
    example: {
      culturaId: 3,
      mercadoDestino: "INTERNO",
      precoMedio: 5,
      moeda: "BRL",
      dataReferencia: "2026-11-25",
      fonteNome: "Fonte de exemplo",
      fonteReferencia: "Documento de exemplo para testes",
    },
  }
);

schemas.Cotacao = obj({
  id,
  ...schemas.CotacaoEntrada.properties,
  cultura: ref("CulturaResumo"),
  status,
  origemRegistro: en(["DECLARADO_POR_ADMIN"]),
  verificacaoAutomaticaDaFonte: bool(),
  idadeDias: inteiro(0),
  desatualizada: bool(),
  aviso: str(),
  criadoEm: instante,
  atualizadoEm: instante,
}, [
  "id", "culturaId", "mercadoDestino",
  "precoMedio", "moeda", "dataReferencia",
  "origemRegistro", "desatualizada",
]);

schemas.CotacoesLista = obj({
  dados: arr(ref("Cotacao")),
  paginacao: ref("Paginacao"),
}, ["dados", "paginacao"]);

schemas.PrecoConab = obj({
  produto: str(),
  variedade: textoNulo,
  uf: str(),
  ceasa: str(),
  unidade: str(),
  data,
  preco: num({ minimum: 0 }),
}, [
  "produto", "uf", "ceasa",
  "unidade", "data", "preco",
]);

schemas.ResumoMercado = obj({
  cultura: str(),
  mercadoDestino: obj({
    tipo: en(["INTERNO"]),
    pais: en(["BR"]),
    uf: str(),
    ceasa: textoNulo,
    escopo: en(["FILTRO_CEASA", "CEASAS_DA_UF"]),
  }),
  moeda: en(["BRL"]),
  dataReferencia: str({
    format: "date",
    nullable: true,
  }),
  precoMedio: numeroNulo,
  unidade: textoNulo,
  precosMediosPorUnidade: arr(
    obj({
      unidade: str(),
      precoMedio: num(),
      quantidadeObservacoes: inteiro(0),
    })
  ),
  metodo: str(),
  demandaEstimada: numeroNulo,
  precoExportacao: numeroNulo,
  disponibilidade: obj({
    demandaEstimada: str(),
    precoExportacao: str(),
  }),
  limitacoes: arr(str()),
});

schemas.PrecosResposta = extra(
  obj({
    fonte: str(),
    origem: str(),
    consultadoEn: instante,
    filtros: obj({
      produto: str(),
      uf: str(),
      ceasa: textoNulo,
    }),
    resumoMercado: ref("ResumoMercado"),
    precoAtual: extra(
      obj(schemas.PrecoConab.properties),
      { nullable: true }
    ),
    historico: arr(ref("PrecoConab")),
    desatualizado: bool(),
  }, [
    "fonte", "origem", "consultadoEn",
    "filtros", "resumoMercado",
    "precoAtual", "historico",
  ]),
  {
    description:
      "Consulta CONAB/PROHORT. Pode retornar cache antigo " +
      "com desatualizado=true. Sem cotação compatível, histórico vazio. " +
      "Não fornece preço de exportação nem demanda estimada. " +
      "consultadoEn mantém a grafia atual da API.",
  }
);

schemas.CulturaDetalhes = obj({
  cultura: ref("Cultura"),
  condicoesAtuais: extra(
    obj({
      temperaturaAtual: num(),
      umidadeAtual: num(),
      velocidadeVento: num(),
    }),
    { nullable: true }
  ),
  alertas: extra(
    obj({
      temperaturaForaDoRango: bool(),
      umidadeForaDoRango: bool(),
    }),
    { nullable: true }
  ),
  cotacaoMercado: extra(
    obj(schemas.PrecosResposta.properties),
    { nullable: true }
  ),
  estatisticasAgricolas: obj({
    indicador: str(),
    anoReferencia: str(),
    valor: {
      oneOf: [
        str({ nullable: true }),
        num(),
      ],
    },
    aviso: str(),
    erro: str(),
  }),
  avisoMercado: str(),
  avisoClima: str(),
}, [
  "cultura", "condicoesAtuais", "alertas",
  "cotacaoMercado", "estatisticasAgricolas",
]);

const baseJanelas = {
  sensorId: id,
  dataHoraReferencia: str({
    format: "date-time",
    description:
      "UTC com segundos e Z; até 00:00 UTC de hoje " +
      "e no máximo 366 dias atrás.",
  }),
  grausDiaReferencia: numero(0, 100000),
  temperaturaBase: numero(-10, 60),
  grausDiaAlvo: numero(1, 100000),
  chuvaMaxMm: numero(0, 1000),
  umidadeArMaxPercentual: numero(0, 100),
  fonteParametros: texto(1, 200),
  versaoParametros: texto(1, 200),
};

const camposExportacao = {
  rotaLogisticaId: id,
  horasAteResfriamento: numero(0, 1000),
  vidaUtilHoras: numero(0.01, 10000),
  custoInternoKg: numero(0, 100000),
  custoExportacaoKg: numero(0, 100000),
  cadeiaFrioGarantida: bool(),
};

const cotacaoManual = {
  precoInternoKg: numero(0, 100000),
  precoExportacaoKg: numero(0, 100000),
  moeda: en(["BRL"]),
  dataHoraCotacao: str({
    format: "date-time",
    description:
      "UTC com segundos e Z; não futura e com até 7 dias.",
  }),
  fonteCotacao: texto(1, 200),
};

const cotacaoIds = {
  cotacaoInternaId: id,
  cotacaoExportacaoId: id,
};

const semCampos = fields => ({
  not: {
    anyOf: fields.map(field => ({
      required: [field],
    })),
  },
});

schemas.JanelasEntrada = extra(
  obj({
    ...baseJanelas,
    ...camposExportacao,
    ...cotacaoManual,
    ...cotacaoIds,
  }, Object.keys(baseJanelas)),
  {
    description:
      "Sensor ativo deve pertencer ao lote autorizado. " +
      "Escolha só colheita, exportação com cotação manual, " +
      "ou exportação por dois IDs distintos. " +
      "IDs exigem cotações da cultura do lote, BRL/KG, " +
      "destinos interno/exportação e até 7 dias. " +
      "Não misture IDs com valores diretos de cotação. " +
      "Parâmetros precisam de validação agronômica.",
    oneOf: [
      semCampos([
        ...Object.keys(camposExportacao),
        ...Object.keys(cotacaoManual),
        ...Object.keys(cotacaoIds),
      ]),
      {
        required: [
          ...Object.keys(camposExportacao),
          ...Object.keys(cotacaoManual),
        ],
        ...semCampos(Object.keys(cotacaoIds)),
      },
      {
        required: [
          ...Object.keys(camposExportacao),
          ...Object.keys(cotacaoIds),
        ],
        ...semCampos(Object.keys(cotacaoManual)),
      },
    ],
    example: {
      sensorId: 40,
      dataHoraReferencia: "2026-11-25T00:00:00Z",
      grausDiaReferencia: 0,
      temperaturaBase: 10,
      grausDiaAlvo: 1500,
      chuvaMaxMm: 5,
      umidadeArMaxPercentual: 80,
      fonteParametros:
        "Parâmetros sintéticos de teste, sem validação agronômica",
      versaoParametros: "teste-v1",
    },
  }
);

const recomendacaoFields = {
  grausDiaAcumulados: numero(0, 100000),
  grausDiaAlvo: numero(1, 100000),
  chuvaPrevistaMm: numero(0, 1000),
  chuvaLimiteMm: numero(0, 1000),
  umidadePrevista: numero(0, 100),
  umidadeLimite: numero(0, 100),
  horasAteResfriamento: numero(0, 1000),
  tempoTransporteHoras: numero(0, 1000),
  vidaUtilHoras: numero(0.01, 10000),
  precoInternoKg: numero(0, 100000),
  precoExportacaoKg: numero(0, 100000),
  custoInternoKg: numero(0, 100000),
  custoExportacaoKg: numero(0, 100000),
  cadeiaFrioGarantida: bool(),
};

schemas.RecomendacaoEntrada = extra(
  obj(
    recomendacaoFields,
    Object.keys(recomendacaoFields)
  ),
  {
    description:
      "Simulação manual, diferente de /janelas e /previsao. " +
      "Todos os campos são obrigatórios; fase fenológica vem do lote. " +
      "Não calcula uma data futura.",
    example: {
      grausDiaAcumulados: 0,
      grausDiaAlvo: 1500,
      chuvaPrevistaMm: 0,
      chuvaLimiteMm: 0,
      umidadePrevista: 0,
      umidadeLimite: 0,
      horasAteResfriamento: 0,
      tempoTransporteHoras: 0,
      vidaUtilHoras: 100,
      precoInternoKg: 0,
      precoExportacaoKg: 0,
      custoInternoKg: 0,
      custoExportacaoKg: 0,
      cadeiaFrioGarantida: false,
    },
  }
);

schemas.RecomendacaoResposta = obj({
  natureza: en(["SIMULACAO_PARAMETRIZADA"]),
  regraVersao: str(),
  colheita: obj({
    favoravel: bool(),
    motivos: arr(str()),
  }),
  exportacao: obj({
    favoravel: bool(),
    margemInternaKg: num(),
    margemExportacaoKg: num(),
  }),
  observacao: str(),
}, [
  "natureza", "regraVersao",
  "colheita", "exportacao", "observacao",
]);

schemas.JanelaColheita = obj({
  inicio: instante,
  fim: instante,
}, ["inicio", "fim"]);

schemas.JanelaExportacao = obj({
  colheitaInicio: instante,
  colheitaFim: instante,
  embarqueInicio: instante,
  embarqueFim: instante,
  chegadaInicio: instante,
  chegadaFim: instante,
}, [
  "colheitaInicio", "colheitaFim",
  "embarqueInicio", "embarqueFim",
  "chegadaInicio", "chegadaFim",
]);

const contextoPrevisao = {
  loteId: id,
  sensorId: id,
  cultura: obj({
    nome: str(),
    variedade: textoNulo,
  }),
  faseFenologica: en([...fases, null], {
    nullable: true,
  }),
  coordenadasUtilizadas: obj({
    latitude: num(),
    longitude: num(),
    origem: en(["LOTE", "PROPRIEDADE"]),
    estimadasUf: bool(),
  }),
};

const statusColheita = [
  "FAVORAVEL",
  "AGUARDAR_MATURACAO",
  "SEM_JANELA_NO_HORIZONTE",
  "DADOS_INSUFICIENTES",
];

const statusExportacao = [
  "FAVORAVEL",
  "NAO_FAVORAVEL",
  "SEM_JANELA_COLHEITA",
  "DADOS_INSUFICIENTES",
];

schemas.JanelasResposta = obj({
  ...contextoPrevisao,
  natureza: str(),
  regraVersao: str(),
  calculadoEm: instante,
  parametros: obj({
    fonte: str(),
    versao: str(),
    temperaturaBase: num(),
    grausDiaAlvo: num(),
  }),
  historico: obj({
    suficiente: bool(),
    grausDia: num(),
    horasObservadas: num({ minimum: 0 }),
    coberturaPercentual: numero(0, 100),
    ate: instante,
    grausDiaReferencia: num(),
  }),
  previsao: obj({
    fonte: str(),
    consultadaEm: instante,
    timezone: str(),
  }),
  colheita: obj({
    status: en(statusColheita),
    janelas: arr(ref("JanelaColheita")),
    motivos: arr(str()),
  }),
  exportacao: obj({
    status: en(statusExportacao),
    janelas: arr(ref("JanelaExportacao")),
    motivos: arr(str()),
    margemInternaKg: num(),
    margemExportacaoKg: num(),
    moeda: str(),
    unidade: str(),
  }),
  avisos: arr(str()),
}, [
  "loteId", "sensorId", "calculadoEm",
  "colheita", "exportacao", "avisos",
]);

schemas.PrevisaoPythonResposta = extra(
  obj({
    ...contextoPrevisao,
    fonteModelo: en(["SERVICO_PYTHON"]),
    contractVersion: en(["1.0"]),
    modelVersion: str(),
    generatedAt: instante,
    harvest: obj({
      status: en(statusColheita),
      windows: arr(ref("JanelaColheita")),
      reasons: arr(str()),
    }, ["status", "windows", "reasons"]),
    export: obj({
      status: en(statusExportacao),
      windows: arr(ref("JanelaExportacao")),
      reasons: arr(str()),
    }, ["status", "windows", "reasons"]),
  }, [
    "loteId", "sensorId", "fonteModelo",
    "contractVersion", "modelVersion",
    "generatedAt", "harvest", "export",
  ]),
  {
    description:
      "O Node chama o serviço Python configurado. " +
      "Usa harvest/export; a resposta difere de /janelas.",
  }
);

schemas.ProdutividadeResposta = extra(
  obj({
    municipio: str(),
    produto: str(),
    anoPrevisao: inteiro(0, 9999),
    produtividadePrevistaTHa: num({ minimum: 0 }),
    metodo: str(),
    status: en(["EXPERIMENTAL"]),
    unidade: en(["t/ha"]),
    aviso: str(),
  }, [
    "municipio", "produto", "anoPrevisao",
    "produtividadePrevistaTHa", "metodo",
    "status", "unidade", "aviso",
  ]),
  {
    description:
      "Referência municipal anual lida de CSV. " +
      "Não é previsão individual do lote. " +
      "Fonte histórica ainda depende de auditoria.",
  }
);
const query = (name, schema, required = false) => ({
  in: "query",
  name,
  schema,
  required,
});

// Os índices são usados na tabela de operações abaixo.
const parameters = [
  query("pagina", int({
    minimum: 1,
    maximum: 1000000,
    default: 1,
  })), // 0

  { $ref: "#/components/parameters/Id" }, // 1

  query("lat", numero(-90, 90), true), // 2
  query("lon", numero(-180, 180), true), // 3

  query("uf", en(ufs, { default: "PE" })), // 4

  query("periodo", en(
    ["24h", "7d", "30d"],
    { default: "24h" }
  )), // 5

  query("pagina", int({
    minimum: 1,
    maximum: 2147483647,
    default: 1,
  })), // 6

  query("limite", int({
    minimum: 1,
    maximum: 100,
    default: 20,
  })), // 7

  query("periodo", en(["24h", "7d", "30d"])), // 8
  query("de", str()), // 9
  query("ate", str()), // 10
  query("temperaturaBase", numero(-10, 60)), // 11
  query("propriedadeId", id), // 12
  query("confirmar", en(["true"])), // 13
  query("sensorId", id), // 14
  query("loteId", id), // 15

  query("modal", en([
    "RODOVIARIO",
    "FERROVIARIO",
    "AEREO",
    "MARITIMO",
  ])), // 16

  query("situacao", en([
    "PLANEJADA",
    "EM_TRANSITO",
    "ENTREGUE",
    "CANCELADA",
  ])), // 17

  query("propriedadeIds", str({
    pattern: "^\\d+(,\\d+){1,9}$",
    example: "1,2",
  }), true), // 18

  query("culturaId", id), // 19

  query("agrupar", en(
    ["hora", "dia"],
    { default: "hora" }
  )), // 20

  query("produto", en([
    "UVA", "MANGA", "BANANA", "GOIABA", "MELAO",
  ]), true), // 21

  query("uf", en(ufs), true), // 22
  query("ceasa", texto(1, 150)), // 23

  query("limite", int({
    minimum: 1,
    maximum: 100,
    default: 10,
  })), // 24

  query("mercadoDestino", en([
    "INTERNO", "EXPORTACAO",
  ])), // 25

  query("paisDestino", str({
    pattern: "^[A-Z]{2}$",
  })), // 26

  query("moeda", en([
    "BRL", "USD", "EUR", "GBP",
  ])), // 27

  query("de", data), // 28
  query("ate", data), // 29

  query("municipio", str({
    minLength: 1,
    maxLength: 200,
    example: "Petrolina (PE)",
  }), true), // 30

  query("produto", str({
    minLength: 1,
    maxLength: 200,
    example: "Uva",
  }), true), // 31

  query("ano", str({
    pattern: "^\\d{4}$",
    example: "2026",
  }), true), // 32
];

const propriedadesVinculadas = arr(
  obj({
    id,
    nome: str(),
    cidade: str(),
    uf: str(),
    status,
  })
);

// Cada linha:
// método, caminho, grupo, título, perfis,
// sucesso, resposta, entrada, filtros, erros.
const operations = [
  [
    "post", "/auth/login", "Autenticação",
    "Realizar login", [], 200,
    ref("LoginResposta"), "LoginEntrada", [],
    [400, 401, 413, 415, 429, 500],
  ],
  [
    "get", "/auth/me", "Autenticação",
    "Consultar usuário autenticado", todos, 200,
    obj({ usuario: ref("Usuario") }, ["usuario"]),
    null, [], [401, 500],
  ],
  [
    "post", "/auth/logout", "Autenticação",
    "Encerrar sessão no cliente", todos, 204,
    null, null, [], [401, 500],
  ],
  [
    "get", "/health", "Sistema",
    "Verificar disponibilidade", [], 200,
    ref("Saude"), null, [], [500],
  ],
  [
    "get", "/metricas", "Sistema",
    "Consultar métricas", admin, 200,
    ref("Metricas"), null, [], [401, 403, 500],
  ],
  [
    "get", "/auditoria", "Sistema",
    "Consultar auditoria", admin, 200,
    arr(ref("Auditoria")), null, [0],
    [400, 401, 403, 500],
  ],
  [
    "get", "/culturas", "Culturas",
    "Listar culturas", [], 200,
    arr(ref("Cultura")), null, [], [500],
  ],
  [
    "post", "/culturas", "Culturas",
    "Cadastrar cultura", admin, 201,
    ref("Cultura"), "CulturaEntrada", [],
    [400, 401, 403, 413, 415, 500],
  ],
  [
    "get", "/culturas/{id}", "Culturas",
    "Consultar cultura", [], 200,
    ref("Cultura"), null, [1], [400, 404, 500],
  ],
  [
    "put", "/culturas/{id}", "Culturas",
    "Atualizar cultura", admin, 200,
    ref("Cultura"), "CulturaEntrada", [1],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "delete", "/culturas/{id}", "Culturas",
    "Remover cultura", admin, 204,
    null, null, [1],
    [400, 401, 403, 404, 409, 500],
  ],
  [
    "get", "/culturas/{id}/detalhes", "Culturas",
    "Consultar detalhes da cultura", [], 200,
    ref("CulturaDetalhes"), null, [1, 2, 3, 4],
    [400, 404, 500],
  ],
  [
    "get", "/propriedades", "Propriedades",
    "Listar propriedades", todos, 200,
    arr(ref("PropriedadeResumo")), null, [],
    [401, 500],
  ],
  [
    "post", "/propriedades", "Propriedades",
    "Cadastrar propriedade", gestor, 201,
    ref("Propriedade"), "PropriedadeEntrada", [],
    [400, 401, 403, 413, 415, 500],
  ],
  [
    "get", "/propriedades/{id}", "Propriedades",
    "Consultar propriedade", todos, 200,
    ref("Propriedade"), null, [1],
    [400, 401, 404, 500],
  ],
  [
    "put", "/propriedades/{id}", "Propriedades",
    "Atualizar propriedade", gestor, 200,
    ref("Propriedade"), "PropriedadeEntrada", [1],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "delete", "/propriedades/{id}", "Propriedades",
    "Remover propriedade", gestor, 204,
    null, null, [1],
    [400, 401, 403, 404, 409, 500],
  ],
  [
    "get", "/propriedades/{id}/clima", "Propriedades",
    "Consultar clima da propriedade", todos, 200,
    ref("ClimaPropriedade"), null, [1],
    [400, 401, 404, 500, 502],
  ],
  [
    "get", "/sensores", "Sensores",
    "Listar sensores", todos, 200,
    arr(ref("Sensor")), null, [], [401, 500],
  ],
  [
    "post", "/sensores", "Sensores",
    "Cadastrar sensor", gestor, 201,
    ref("Sensor"), "SensorEntrada", [],
    [400, 401, 403, 404, 409, 413, 415, 500],
  ],
  [
    "post", "/sensores/config", "Sensores",
    "Configurar integração ThingSpeak", tecnico, 200,
    ref("ThingSpeakResposta"), "ThingSpeakEntrada", [],
    [400, 401, 403, 404, 413, 415, 422, 429, 500, 502, 504],
  ],
  [
    "get", "/sensores/{id}", "Sensores",
    "Consultar sensor", todos, 200,
    ref("Sensor"), null, [1],
    [400, 401, 404, 500],
  ],
  [
    "put", "/sensores/{id}", "Sensores",
    "Atualizar sensor", gestor, 200,
    ref("Sensor"), "SensorEntrada", [1],
    [400, 401, 403, 404, 409, 413, 415, 500],
  ],
  [
    "delete", "/sensores/{id}", "Sensores",
    "Remover sensor", gestor, 204,
    null, null, [1],
    [400, 401, 403, 404, 500],
  ],
  [
    "get", "/sensores/{id}/leituras", "Sensores",
    "Consultar leituras do sensor", todos, 200,
    ref("SensorLeiturasResposta"), null, [1, 5, 6, 7],
    [400, 401, 404, 500],
  ],
  [
    "get", "/sensores/{id}/indicadores", "Sensores",
    "Consultar indicadores climáticos", todos, 200,
    ref("IndicadoresSensor"), null, [1, 8, 9, 10, 11],
    [400, 401, 404, 500],
  ],
  [
    "get", "/lotes", "Lotes",
    "Listar lotes", todos, 200,
    arr(ref("Lote")), null, [12],
    [400, 401, 500],
  ],
  [
    "post", "/lotes", "Lotes",
    "Cadastrar lote", gestor, 201,
    ref("Lote"), "LoteCriar", [],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "get", "/lotes/{id}", "Lotes",
    "Consultar lote", todos, 200,
    ref("Lote"), null, [1],
    [400, 401, 404, 500],
  ],
  [
    "put", "/lotes/{id}", "Lotes",
    "Atualizar lote", gestor, 200,
    ref("Lote"), "LoteAtualizar", [1],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "delete", "/lotes/{id}", "Lotes",
    "Remover lote", gestor, 204,
    null, null, [1, 13],
    [400, 401, 403, 404, 409, 500],
  ],
  [
    "post", "/lotes/{id}/recomendacoes", "Lotes",
    "Gerar recomendações", tecnico, 200,
    ref("RecomendacaoResposta"), "RecomendacaoEntrada", [1],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "post", "/lotes/{id}/janelas", "Recomendações",
    "Consultar janelas recomendadas", todos, 200,
    ref("JanelasResposta"), "JanelasEntrada", [1],
    [400, 401, 404, 413, 415, 422, 429, 500, 503],
  ],
  [
    "post", "/lotes/{id}/previsao", "Recomendações",
    "Consultar previsão por modelo Python", todos, 200,
    ref("PrevisaoPythonResposta"), "JanelasEntrada", [1],
    [400, 401, 404, 413, 415, 422, 429, 500, 502, 503, 504],
  ],
  [
    "get", "/leituras", "Leituras",
    "Listar leituras", todos, 200,
    ref("LeiturasResposta"), null,
    [14, 15, 12, 8, 9, 10, 6, 7],
    [400, 401, 404, 500],
  ],
  [
    "get", "/alertas", "Alertas",
    "Listar alertas calculados", todos, 200,
    ref("AlertasResposta"), null, [12, 15],
    [400, 401, 500],
  ],
  [
    "get", "/alertas/riscos", "Alertas",
    "Consultar histórico de alertas de risco", todos, 200,
    arr(ref("AlertaRisco")), null,
    [14, 15, 12, 8, 9, 10, 6, 7],
    [400, 401, 500],
  ],
  [
    "get", "/logistica", "Logística",
    "Listar opções logísticas", todos, 200,
    ref("LogisticaLista"), null,
    [12, 6, 7, 16, 17],
    [400, 401, 500],
  ],
  [
    "post", "/logistica", "Logística",
    "Cadastrar opção logística", gestor, 201,
    ref("Logistica"), "LogisticaCriar", [],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "get", "/logistica/comparar", "Logística",
    "Comparar logística", todos, 200,
    ref("ComparacaoLogistica"), null, [18],
    [400, 401, 404, 500],
  ],
  [
    "get", "/logistica/{id}", "Logística",
    "Consultar opção logística", todos, 200,
    ref("Logistica"), null, [1],
    [400, 401, 404, 500],
  ],
  [
    "put", "/logistica/{id}", "Logística",
    "Atualizar opção logística", gestor, 200,
    ref("Logistica"), "LogisticaAtualizar", [1],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "delete", "/logistica/{id}", "Logística",
    "Remover opção logística", gestor, 204,
    null, null, [1],
    [400, 401, 403, 404, 500],
  ],
  [
    "get", "/dashboard/resumo", "Dashboard",
    "Consultar resumo do dashboard", todos, 200,
    ref("DashboardResumo"), null,
    [12, 15, 19, 14],
    [400, 401, 404, 500],
  ],
  [
    "get", "/dashboard/medias", "Dashboard",
    "Consultar médias do dashboard", todos, 200,
    ref("DashboardMedias"), null,
    [12, 15, 19, 14, 20, 9, 10],
    [400, 401, 404, 500],
  ],
  [
    "get", "/precos", "Mercado",
    "Consultar preços públicos da CONAB", [], 200,
    ref("PrecosResposta"), null,
    [21, 22, 23, 24],
    [400, 500, 503],
  ],
  [
    "get", "/mercado/cotacoes", "Cotações de mercado",
    "Listar cotações", todos, 200,
    ref("CotacoesLista"), null,
    [0, 7, 19, 25, 26, 27, 28, 29],
    [400, 401, 500],
  ],
  [
    "post", "/mercado/cotacoes", "Cotações de mercado",
    "Cadastrar cotação", admin, 201,
    ref("Cotacao"), "CotacaoEntrada", [],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "get", "/mercado/cotacoes/{id}", "Cotações de mercado",
    "Consultar cotação", todos, 200,
    ref("Cotacao"), null, [1],
    [400, 401, 404, 500],
  ],
  [
    "put", "/mercado/cotacoes/{id}", "Cotações de mercado",
    "Atualizar cotação", admin, 200,
    ref("Cotacao"), "CotacaoEntrada", [1],
    [400, 401, 403, 404, 413, 415, 500],
  ],
  [
    "delete", "/mercado/cotacoes/{id}", "Cotações de mercado",
    "Remover cotação", admin, 204,
    null, null, [1],
    [400, 401, 403, 404, 500],
  ],
  [
    "get", "/usuarios", "Usuários",
    "Listar usuários", admin, 200,
    arr(ref("Usuario")), null, [],
    [401, 403, 500],
  ],
  [
    "post", "/usuarios", "Usuários",
    "Cadastrar usuário", admin, 201,
    ref("Usuario"), "UsuarioCriar", [],
    [400, 401, 403, 404, 409, 413, 415, 500],
  ],
  [
    "put", "/usuarios/{id}", "Usuários",
    "Atualizar usuário", admin, 200,
    ref("Usuario"), "UsuarioAtualizar", [1],
    [400, 401, 403, 404, 409, 413, 415, 500],
  ],
  [
    "delete", "/usuarios/{id}", "Usuários",
    "Inativar usuário", admin, 204,
    null, null, [1],
    [400, 401, 403, 404, 409, 500],
  ],
  [
    "get", "/usuarios/{id}/propriedades", "Usuários",
    "Listar propriedades vinculadas ao técnico", admin, 200,
    propriedadesVinculadas, null, [1],
    [400, 401, 403, 404, 409, 500],
  ],
  [
    "put", "/usuarios/{id}/propriedades", "Usuários",
    "Substituir vínculos do técnico", admin, 200,
    propriedadesVinculadas, "VinculosEntrada", [1],
    [400, 401, 403, 404, 409, 413, 415, 500],
  ],
  [
    "get", "/dashboard/produtor/areas", "Dashboard",
    "Consultar áreas classificadas do produtor", produtor, 200,
    ref("AreasProdutor"), null, [12],
    [400, 401, 403, 500],
  ],
  [
    "get", "/dashboard/produtor/alertas-do-dia", "Dashboard",
    "Consultar episódios de risco do dia do produtor", produtor, 200,
    ref("AlertasDoDia"), null, [12],
    [400, 401, 403, 500],
  ],
  [
    "get", "/produtividade/previsoes", "Produtividade",
    "Consultar produtividade municipal experimental", todos, 200,
    ref("ProdutividadeResposta"), null, [30, 31, 32],
    [400, 401, 404, 500],
  ],
];
const errorDescriptions = {
  400: "Dados ou parâmetros inválidos.",
  401:
    "Token ausente, inválido ou expirado; conta inativa. " +
    "No login, credenciais inválidas.",
  403: "Perfil sem autorização.",
  404: "Recurso inexistente, inativo ou fora do escopo.",
  409: "Conflito de vínculo, duplicidade ou proteção da operação.",
  413: "Corpo JSON excede 100kb.",
  415: "Codificação do corpo não suportada.",
  422:
    "Entrada válida sintaticamente, mas condição de negócio " +
    "ou integração impede processar.",
  429: "Limite de consultas atingido.",
  500: "Erro interno inesperado, sem stack trace.",
  502: "Falha, recusa ou resposta inválida de serviço externo.",
  503: "Serviço externo indisponível ou não configurado.",
  504: "Tempo limite excedido ao consultar serviço externo.",
};

const document = {
  openapi: "3.0.3",

  info: {
    title: "ValeSafra — API",
    version: "1.0.0",
    description:
      "Documentação alinhada à main 5269209. " +
      "Use JWT em Authorize para rotas protegidas. " +
      "ADMIN possui escopo global; PRODUTOR acessa propriedades próprias; " +
      "TECNICO acessa propriedades vinculadas. " +
      "Recursos fora do escopo podem retornar 404. " +
      "IDs dos exemplos precisam existir no ambiente. " +
      "Credenciais dos exemplos são fictícias. " +
      "Corpo JSON limitado a 100kb.",
  },

  servers: [
    {
      url: "/api",
      description:
        "Mesmo servidor da documentação — recomendado",
    },
    {
      url: "http://localhost:3000/api",
      description: "Desenvolvimento local",
    },
    {
      url: "https://d2nmqrbqvtvva2.cloudfront.net/api",
      description: "API AWS indicada no README da main",
    },
  ],

  tags: [
    "Sistema",
    "Autenticação",
    "Usuários",
    "Culturas",
    "Propriedades",
    "Lotes",
    "Sensores",
    "Leituras",
    "Alertas",
    "Dashboard",
    "Logística",
    "Mercado",
    "Cotações de mercado",
    "Recomendações",
    "Produtividade",
  ].map(name => ({ name })),

  security: [
    {
      bearerAuth: [],
    },
  ],

  paths: {},

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Informe somente o JWT. " +
          "O prefixo Bearer é aplicado automaticamente.",
      },
    },

    parameters: {
      Id: {
        name: "id",
        in: "path",
        required: true,
        description: "Identificador numérico do recurso.",
        schema: id,
      },
    },

    schemas,
  },
};

for (const [
  method,
  url,
  tag,
  summary,
  roles,
  code,
  result,
  input,
  filters,
  errors,
] of operations) {
  const responses = {
    [code]: result
      ? {
          description: "Sucesso.",
          content: {
            "application/json": {
              schema: result,
            },
          },
        }
      : {
          description: "Sem corpo.",
        },
  };

  for (const error of errors) {
    responses[error] = {
      description: errorDescriptions[error],
      content: {
        "application/json": {
          schema: ref("Erro"),
        },
      },
    };
  }

  const operation = {
    summary,

    operationId:
      method +
      url
        .replace(/[{}]/g, "")
        .split(/[/-]/)
        .filter(Boolean)
        .map(
          part =>
            part[0].toUpperCase() +
            part.slice(1)
        )
        .join(""),

    tags: [tag],

    description: roles.length
      ? "Perfis: " +
        roles.join(", ") +
        ". Escopo aplicado no backend."
      : "Público, sem JWT.",

    security: roles.length
      ? [{ bearerAuth: [] }]
      : [],

    "x-perfis-autorizados": roles,

    parameters: filters.map(
      index => parameters[index]
    ),

    responses,
  };

  if (input) {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: ref(input),
        },
      },
    };
  }

  document.paths[url] ||= {};
  document.paths[url][method] = operation;
}

const exemploColheita =
  schemas.JanelasEntrada.example;

const exemploExportacaoBase = {
  ...exemploColheita,
  rotaLogisticaId: 1,
  horasAteResfriamento: 2,
  vidaUtilHoras: 72,
  custoInternoKg: 2,
  custoExportacaoKg: 3,
  cadeiaFrioGarantida: true,
};

const predictionExamples = {
  colheita: {
    summary: "Só colheita — parâmetros de teste",
    value: exemploColheita,
  },

  exportacaoManual: {
    summary: "Exportação com preços informados",
    value: {
      ...exemploExportacaoBase,
      precoInternoKg: 5,
      precoExportacaoKg: 8,
      moeda: "BRL",
      dataHoraCotacao: "2026-11-25T12:00:00Z",
      fonteCotacao: "Cotação sintética de teste",
    },
  },

  exportacaoIds: {
    summary: "Exportação por cotações cadastradas",
    value: {
      ...exemploExportacaoBase,
      cotacaoInternaId: 1,
      cotacaoExportacaoId: 2,
    },
  },
};

for (const route of [
  "/lotes/{id}/janelas",
  "/lotes/{id}/previsao",
]) {
  const operation =
    document.paths[route].post;

  operation.requestBody
    .content["application/json"]
    .examples = predictionExamples;

  operation.description +=
    " Até 20 consultas por usuário/minuto. " +
    "A requisição usa o contrato do Node, " +
    "não o contrato interno em inglês do Python. " +
    "Atualize datas e IDs dos exemplos antes de executar.";
}

document.paths["/auth/login"].post.description +=
  " Até 10 falhas por IP a cada 15 minutos; " +
  "sucessos não contam. Conta inativa retorna 401.";

document.paths["/auth/logout"].post.description +=
  " O JWT continua válido até expirar; " +
  "o cliente deve descartá-lo. Resposta 204 sem corpo.";

document.paths["/sensores/config"].post.description +=
  " Até 10 consultas por usuário a cada 15 minutos. " +
  "O teste externo ocorre antes da gravação. " +
  "Falha não altera a configuração do sensor. " +
  "Read API Key não é retornada.";

document.paths[
  "/sensores/{id}/leituras"
].get.description +=
  " Aceita período relativo e paginação. " +
  "Padrão: 24h. Não combine com de/ate.";

document.paths[
  "/sensores/{id}/indicadores"
].get.description +=
  " Sem de/ate ou periodo, usa 24h. " +
  "O cálculo não é paginado.";

for (const route of [
  "/leituras",
  "/alertas/riscos",
  "/sensores/{id}/indicadores",
]) {
  document.paths[route].get.description +=
    " Não combine periodo com de/ate. " +
    "Datas sem hora representam dias UTC, " +
    "com limites inclusivos.";
}

document.paths[
  "/dashboard/medias"
].get.description +=
  " Datas sem hora representam dias em America/Recife. " +
  "hora: padrão 24h, máximo 7 dias. " +
  "dia: padrão 7 dias, máximo 90 dias.";

document.paths[
  "/logistica/comparar"
].get.description +=
  " Informe de 2 a 10 IDs distintos, sem espaços, " +
  "dentro do seu escopo. Destinos e modais diferentes " +
  "não são cotações equivalentes.";

document.paths[
  "/lotes/{id}"
].delete.description +=
  " confirmar=true permite inativar sensores ativos " +
  "em conjunto. Sem confirmação pode retornar 409.";

document.paths[
  "/produtividade/previsoes"
].get.description +=
  " Use município com UF, como Petrolina (PE). " +
  "Referência municipal experimental; " +
  "não é previsão individual da propriedade.";

const output = path.join(
  __dirname,
  "../docs/openapi.yaml"
);

fs.mkdirSync(
  path.dirname(output),
  { recursive: true }
);

fs.writeFileSync(
  output,
  YAML.stringify(
    document,
    {
      aliasDuplicateObjects: false,
      lineWidth: 110,
    }
  )
);

console.log(
  "Swagger atualizado: " +
  operations.length +
  " operações."
);
