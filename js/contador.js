
/*
 * contador.js — contador regressivo da campanha Black Friday
 */

const historicoContador = [];
const LIMITE_HISTORICO = 100;

let intervaloContador = null;

function formatarTempo(ms) {
  const total = Math.floor(ms / 1000);
  const dias = Math.floor(total / 86400);
  const horas = Math.floor((total % 86400) / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dois = (n) => String(n).padStart(2, '0');

  return `<b>${dias}</b>d <b>${dois(horas)}</b>h <b>${dois(minutos)}</b>m <b>${dois(segundos)}</b>s`;
}

function iniciarContador(campanha) {
  if (intervaloContador !== null) {
    clearInterval(intervaloContador);
    intervaloContador = null;
  }

  const banner = document.getElementById('banner-bf');
  const alvo = banner.querySelector('.bf-tempo');
  const fim = new Date(campanha.fim).getTime();

  banner.hidden = false;

  Observabilidade.registrarMedidor(
    'historico_contador',
    () => historicoContador.length
  );

  function tick() {
    const instante = Date.now();
    const restante = Math.max(0, fim - instante);

    historicoContador.push({
      instante,
      restante,
      quantidadeJogos: JOGOS.length
    });

    if (historicoContador.length > LIMITE_HISTORICO) {
      historicoContador.shift();
    }

    Observabilidade.contar('contador_ticks');
    alvo.innerHTML = formatarTempo(restante);

    if (restante <= 0 && intervaloContador !== null) {
      clearInterval(intervaloContador);
      intervaloContador = null;
    }
  }

  tick();

  if (fim <= Date.now()) {
    return null;
  }

  Observabilidade.info(
    'CONTADOR_INICIADO',
    'Contador da Black Friday ativo',
    {
      fim: campanha.fim,
      intervalo: campanha.intervaloContadorSegundos
    }
  );

  intervaloContador = setInterval(
    tick,
    campanha.intervaloContadorSegundos * 1000
  );

  return intervaloContador;
}
