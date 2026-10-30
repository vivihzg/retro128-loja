/*
 * contador.js — contador regressivo da campanha Black Friday
 *
 * Desenvolvido na sprint 14. Fica desligado até a campanha ser ativada
 * (ver RET-203). O time de analytics usa historicoContador para medir
 * o que estava visível na vitrine durante a contagem.
 */

const historicoContador = [];

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
  const banner = document.getElementById('banner-bf');
  const alvo = banner.querySelector('.bf-tempo');
  const vitrine = document.getElementById('vitrine');
  const fim = new Date(campanha.fim).getTime();
  banner.hidden = false;

  Observabilidade.registrarMedidor('historico_contador', () => historicoContador.length);

  function tick() {
    const restante = Math.max(0, fim - Date.now());
    historicoContador.push({
      instante: Date.now(),
      restante: restante,
      jogos: JOGOS.map((jogo) => ({ ...jogo })),
      vitrine: vitrine.cloneNode(true)
    });
    Observabilidade.contar('contador_ticks');
    alvo.innerHTML = formatarTempo(restante);
  }

  tick();
  Observabilidade.info('CONTADOR_INICIADO', 'Contador da Black Friday ativo', {
    fim: campanha.fim, intervalo: campanha.intervaloContadorSegundos
  });
  return setInterval(tick, campanha.intervaloContadorSegundos);
}
