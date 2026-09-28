const yup = require('yup');

const culturaSchema = yup.object().shape({
  nome: yup
    .string()
    .max(100, 'O nome deve ter no máximo 100 caracteres')
    .required('O nome da cultura é obrigatório'),
  variedade: yup
    .string()
    .max(100, 'A variedade deve ter no máximo 100 caracteres')
    .nullable(),
  descricao: yup
    .string()
    .nullable(),
  temperaturaMin: yup
    .number()
    .typeError('A temperatura mínima deve ser um número')
    .required('A temperatura mínima é obrigatória'),
  temperaturaMax: yup
    .number()
    .typeError('A temperatura máxima deve ser um número')
    .required('A temperatura máxima é obrigatória'),
  umidadeMin: yup
    .number()
    .min(0, 'A umidade mínima não pode ser menor que 0%')
    .max(100, 'A umidade mínima não pode ser maior que 100%')
    .typeError('A umidade mínima deve ser um número')
    .required('A umidade mínima é obrigatória'),
  umidadeMax: yup
    .number()
    .min(0, 'A umidade máxima não pode ser menor que 0%')
    .max(100, 'A umidade máxima não pode ser maior que 100%')
    .typeError('A umidade máxima deve ser um número')
    .required('A umidade máxima é obrigatória'),
});

module.exports = { culturaSchema };