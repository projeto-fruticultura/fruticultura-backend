const { sincronizarLeituras } = require("./leituraService");

// Chama sincronizarLeituras() de tempos em tempos, so com o setInterval nativo (sem biblioteca).
//
// Desligado por padrao: todo o grupo roda o backend localmente com o banco compartilhado, e sem
// esta trava cada maquina buscaria no ThingSpeak e gravaria no banco ao mesmo tempo.
// Em producao (Render) a variavel LEITURAS_AGENDADOR_ATIVO sera "true".

const INTERVALO_PADRAO_MIN = 5;
const INTERVALO_MINIMO_MIN = 1;
const INTERVALO_MAXIMO_MIN = 1440; // 24 horas

let timer = null;
// Evita duas buscas ao mesmo tempo: se a rodada anterior ainda nao terminou, a nova e pulada.
let executando = false;

function registrar(mensagem) {
  console.log(`${new Date().toISOString()} [agendador de leituras] ${mensagem}`);
}

// Le LEITURAS_INTERVALO_MIN (padrao 5). Valor invalido derruba a subida com erro claro:
// melhor descobrir na partida do que rodar num intervalo que ninguem escolheu.
function lerIntervaloMs() {
  const bruto = process.env.LEITURAS_INTERVALO_MIN;
  if (bruto === undefined || bruto.trim() === "") return INTERVALO_PADRAO_MIN * 60_000;

  const texto = bruto.trim();
  const minutos = Number(texto);
  // O formato e conferido antes: Number("1e2") e Number("0x10") dariam numeros "validos".
  if (!/^\d+$/.test(texto) || minutos < INTERVALO_MINIMO_MIN || minutos > INTERVALO_MAXIMO_MIN) {
    throw new Error(
      `A variável de ambiente LEITURAS_INTERVALO_MIN deve ser um número inteiro entre ${INTERVALO_MINIMO_MIN} e ${INTERVALO_MAXIMO_MIN} (em minutos).`
    );
  }
  return minutos * 60_000;
}

// Deixa a mensagem do erro em uma linha so, sem URL e sem a chave do ThingSpeak.
// Os servicos ja devolvem erros genericos; isto e uma segunda barreira, nunca o objeto de erro bruto.
function mensagemSegura(erro) {
  let mensagem = erro && erro.message ? String(erro.message) : "erro desconhecido";
  mensagem = mensagem.replace(/\s+/g, " ").trim();
  mensagem = mensagem.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url oculta]");
  const chave = process.env.THINGSPEAK_READ_KEY;
  if (chave) mensagem = mensagem.split(chave).join("[chave oculta]");
  return mensagem.slice(0, 300);
}

async function rodada(sincronizar) {
  if (executando) {
    registrar("rodada anterior ainda em andamento, esta foi pulada");
    return;
  }
  executando = true;
  try {
    const { recebidas, descartadas, gravadas } = await sincronizar();
    registrar(`leituras sincronizadas: recebidas ${recebidas}, descartadas ${descartadas}, gravadas ${gravadas}`);
  } catch (erro) {
    // Qualquer erro fica aqui dentro: uma busca que falha nunca pode derrubar o servidor.
    registrar(`falha ao sincronizar leituras: ${mensagemSegura(erro)}`);
  } finally {
    executando = false;
  }
}

// Retorna true se iniciou e false se o agendador esta desligado (ou ja estava rodando).
// intervaloMs existe so para testes; em uso normal vale LEITURAS_INTERVALO_MIN.
function iniciarAgendador({ intervaloMs, sincronizar = sincronizarLeituras } = {}) {
  if (process.env.LEITURAS_AGENDADOR_ATIVO !== "true") {
    registrar("desligado (defina LEITURAS_AGENDADOR_ATIVO=true para ligar)");
    return false;
  }
  if (timer) return false;

  const intervalo = intervaloMs ?? lerIntervaloMs();

  // A primeira rodada e disparada sem await: nao segura a subida do servidor.
  // rodada() nunca rejeita (captura tudo), entao nao ha promessa solta que derrube o processo.
  rodada(sincronizar);
  timer = setInterval(() => rodada(sincronizar), intervalo);
  // unref: o timer sozinho nao mantem o processo vivo (quem mantem e o servidor HTTP).
  timer.unref();

  registrar(`ligado, intervalo de ${Math.round(intervalo / 1000)} segundo(s)`);
  return true;
}

function pararAgendador() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { iniciarAgendador, pararAgendador };
