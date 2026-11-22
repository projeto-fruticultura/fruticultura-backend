# ValeSafra — Previsão de Produtividade Agrícola

## 1. Objetivo

Estimar a produtividade agrícola anual, em toneladas por hectare
(t/ha), para combinações de município e cultura.

As estimativas representam referências municipais e não previsões
específicas para propriedades rurais.

## 2. Base de dados

- Fonte declarada: IBGE/PAM.
- Período disponível no CSV: 2010 a 2025.
- Total de registros: 285.
- Municípios: 6.
- Culturas: Goiaba, Manga e Uva.

A procedência e a disponibilidade dos registros de 2025 ainda
precisam ser confirmadas.

## 3. Preparação dos dados

- Conversão da produtividade de kg/ha para t/ha.
- Organização cronológica por município e cultura.
- Criação de variáveis históricas de um e dois anos anteriores.
- Separação temporal dos dados.

## 4. Modelos avaliados

- Persistência (produtividade do ano anterior).
- Ridge Regression.
- Random Forest Regressor.
- Estratégia híbrida por cultura.

Também foram investigadas médias históricas e variáveis
adicionais de área colhida e produção.

## 5. Avaliação

Treinamento inicial: 2012 a 2022.
Teste: 2023 a 2025 (54 observações).

Validação temporal exploratória: 2018 a 2022.

Resultados no teste:

| Modelo | MAE (t/ha) | RMSE (t/ha) |
|---|---:|---:|
| Persistência | 3.048 | 4.840 |
| Estratégia híbrida | 3.421 | 5.294 |
| Ridge Regression | 3.759 | 4.818 |
| Random Forest | 3.931 | 5.442 |

O conjunto de teste foi consultado durante o desenvolvimento.
Portanto, os resultados não representam uma avaliação
completamente independente de todas as decisões experimentais.

## 6. Método selecionado

Persistência: a estimativa para o próximo ano corresponde
à produtividade registrada no ano anterior.

O método foi selecionado pelo menor MAE observado entre
as alternativas avaliadas.

Trata-se de uma referência estatística, não de um modelo
de Machine Learning treinado.

## 7. Previsões de 2026

Foram geradas 18 estimativas, correspondentes a seis municípios
e três culturas.

Arquivo: valesafra_previsoes_produtividade_2026.csv

## 8. Limitações e pendências

- Foram encontradas 16 divergências históricas entre produtividade
  informada e produtividade calculada por produção/área.
- Essas divergências precisam ser verificadas na fonte original.
- A procedência dos dados de 2025 precisa ser confirmada.
- A previsão não incorpora diretamente clima, pragas ou doenças.
- A estimativa é municipal, não específica de uma propriedade.
- A persistência não antecipa mudanças bruscas na produtividade.
- As previsões de 2026 são experimentais e não devem ser
  apresentadas como previsões agronômicas validadas.

## 9. Próximas etapas

- Auditoria da fonte de dados.
- Revisão das métricas após eventuais correções.
- Integração das previsões com o backend.
- Testes da funcionalidade no ValeSafra.
