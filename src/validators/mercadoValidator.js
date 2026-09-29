const UFS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
  
  function validarFiltrosPrecos(dadosOrigem) {
    const dados = dadosOrigem || {};
    const erros = {};
  
    const produto = dados.produto ? String(dados.produto).trim() : null;
    if (!produto) {
      erros.produto = "O campo produto é obrigatório.";
    }
  
    const uf = dados.uf ? String(dados.uf).trim().toUpperCase() : null;
    if (!uf || !UFS.includes(uf)) {
      erros.uf = "UF inválida ou não informada.";
    }
  
    const ceasa = dados.ceasa ? String(dados.ceasa).trim() : null;
  
    let limite = dados.limite ? parseInt(dados.limite, 10) : 10;
    if (isNaN(limite) || limite <= 0) {
      limite = 10;
    } else if (limite > 100) {
      limite = 100;
    }
  
    if (Object.keys(erros).length > 0) {
      const error = new Error("Filtro inválido.");
      error.status = 400;
      error.errors = erros;
      throw error;
    }
  
    return {
      produto: produto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(),
      uf,
      ceasa,
      limite
    };
  }
  
  module.exports = { validarFiltrosPrecos };