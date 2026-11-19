const {
  validarUsuario,
} = require("../src/validators/usuarioValidator");

const {
  validarComparacaoLogistica,
} = require("../src/validators/comparacaoLogisticaValidator");

test("aceita reativação explícita", () => {
  expect(
    validarUsuario(
      { status: "ATIVO" },
      "atualizar"
    )
  ).toEqual({
    status: "ATIVO",
  });
});

test("não aceita inativação pelo PUT", () => {
  expect(() =>
    validarUsuario(
      { status: "INATIVO" },
      "atualizar"
    )
  ).toThrow();
});

test("reativação não permite alterar senha", () => {
  expect(
    validarUsuario(
      {
        status: "ATIVO",
        senha: "senha-nao-permitida",
      },
      "atualizar"
    )
  ).toEqual({
    status: "ATIVO",
  });
});

test("aceita comparação entre duas propriedades", () => {
  expect(
    validarComparacaoLogistica({
      propriedadeIds: "1,2",
    })
  ).toEqual([1, 2]);
});

test("recusa IDs repetidos", () => {
  expect(() =>
    validarComparacaoLogistica({
      propriedadeIds: "1,1",
    })
  ).toThrow();
});

test("recusa comparação de uma propriedade", () => {
  expect(() =>
    validarComparacaoLogistica({
      propriedadeIds: "1",
    })
  ).toThrow();
});

test("recusa IDs inválidos", () => {
  expect(() =>
    validarComparacaoLogistica({
      propriedadeIds: "1,abc",
    })
  ).toThrow();
});