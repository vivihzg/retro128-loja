/*
 * observabilidade.js — telemetria da loja Retrô 128
 *
 * Registra eventos estruturados (logs), erros não tratados, falhas de
 * carregamento de recursos, chamadas HTTP e métricas de consumo de recursos.
 * Os registros ficam no localStorage do navegador e podem ser consultados
 * na página logs.html (Painel de Logs).
 *
 * Este arquivo é infraestrutura compartilhada: não faz parte da release 2.0.
 */
(function () {
  'use strict';

  var BASE = location.pathname.replace(/[^/]*$/, '');
  var CHAVE = 'retro128.logs:' + BASE;
  var MAXIMO_REGISTROS = 600;
  var JANELA_DEDUP_MS = 3000;

  var sessao = Math.random().toString(36).slice(2, 8);
  var contexto = { versaoApp: '?', commit: '?', ref: '?' };
  var contadores = {};        // nome -> total acumulado
  var ultimaLeitura = {};     // nome -> total na última amostra
  var medidores = {};         // nome -> função que retorna um número

  function lerTodos() {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) || '[]');
    } catch (e) {
      return [];
    }
  }

  function gravarTodos(lista) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(lista.slice(-MAXIMO_REGISTROS)));
    } catch (e) {
      /* armazenamento cheio ou bloqueado: segue sem persistir */
    }
  }

  function registrar(nivel, evento, mensagem, dados) {
    var agora = new Date();
    var entrada = {
      ts: agora.toISOString(),
      nivel: nivel,
      evento: evento,
      mensagem: String(mensagem || ''),
      versaoApp: contexto.versaoApp,
      commit: contexto.commit,
      ref: contexto.ref,
      sessao: sessao,
      pagina: location.pathname.split('/').pop() || 'index.html',
      repeticoes: 1,
      dados: dados || null
    };

    var lista = lerTodos();
    var ultima = lista[lista.length - 1];
    if (ultima && ultima.nivel === nivel && ultima.evento === evento &&
        ultima.mensagem === entrada.mensagem && ultima.sessao === sessao &&
        agora - new Date(ultima.tsUltima || ultima.ts) < JANELA_DEDUP_MS) {
      ultima.repeticoes += 1;
      ultima.tsUltima = entrada.ts;
    } else {
      lista.push(entrada);
    }
    gravarTodos(lista);

    var saida = nivel === 'ERRO' ? console.error : nivel === 'ALERTA' ? console.warn : console.info;
    saida.call(console, '[' + nivel + '] ' + evento + ' — ' + entrada.mensagem, dados || '');
  }

  /* ---------- Captura automática de falhas ---------- */

  window.addEventListener('error', function (ev) {
    var alvo = ev.target;
    if (alvo && alvo !== window && alvo.tagName) {
      var url = alvo.getAttribute('src') || alvo.getAttribute('href') || '(desconhecido)';
      registrar('ERRO', 'RECURSO_FALHOU',
        'Falha ao carregar <' + alvo.tagName.toLowerCase() + '> ' + url,
        { url: url, urlAbsoluta: alvo.src || alvo.href || null });
      return;
    }
    registrar('ERRO', 'ERRO_JS', ev.message, {
      arquivo: ev.filename, linha: ev.lineno, coluna: ev.colno,
      pilha: ev.error && ev.error.stack ? ev.error.stack : null
    });
  }, true);

  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason || {};
    registrar('ERRO', 'PROMISE_REJEITADA', r.message || String(r), { pilha: r.stack || null });
  });

  /* ---------- Métricas ---------- */

  function contar(nome, delta) {
    contadores[nome] = (contadores[nome] || 0) + (delta || 1);
  }

  function registrarMedidor(nome, fn) {
    medidores[nome] = fn;
  }

  var atrasoMaximoMs = 0;
  (function medirAtrasoDoEventLoop() {
    var esperado = performance.now() + 500;
    setTimeout(function () {
      var atraso = performance.now() - esperado;
      if (atraso > atrasoMaximoMs) atrasoMaximoMs = atraso;
      medirAtrasoDoEventLoop();
    }, 500);
  })();

  var tarefasLongas = 0;
  try {
    new PerformanceObserver(function (lista) {
      tarefasLongas += lista.getEntries().length;
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) { /* navegador sem suporte */ }

  var INTERVALO_AMOSTRA_S = 10;
  var inicioAmostra = performance.now();

  function amostrarRecursos() {
    var segundos = (performance.now() - inicioAmostra) / 1000;
    inicioAmostra = performance.now();

    var taxas = {};
    Object.keys(contadores).forEach(function (n) {
      var delta = contadores[n] - (ultimaLeitura[n] || 0);
      ultimaLeitura[n] = contadores[n];
      taxas[n + '_por_s'] = Math.round((delta / segundos) * 10) / 10;
    });

    var valores = {};
    Object.keys(medidores).forEach(function (n) {
      try { valores[n] = medidores[n](); } catch (e) { valores[n] = null; }
    });

    var heapMB = null;
    if (performance.memory) {
      heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
    }

    var dados = {
      heap_js_mb: heapMB,
      nos_dom: document.getElementsByTagName('*').length,
      atraso_event_loop_ms: Math.round(atrasoMaximoMs),
      tarefas_longas: tarefasLongas,
      taxas: taxas,
      medidores: valores
    };

    var motivos = [];
    Object.keys(taxas).forEach(function (n) {
      if (taxas[n] > 50) motivos.push(n + '=' + taxas[n]);
    });
    if (atrasoMaximoMs > 200) motivos.push('atraso_event_loop_ms=' + Math.round(atrasoMaximoMs));
    if (heapMB !== null && heapMB > 150) motivos.push('heap_js_mb=' + heapMB);
    if (dados.nos_dom > 4000) motivos.push('nos_dom=' + dados.nos_dom);

    var resumo = 'heap=' + (heapMB === null ? 'n/d' : heapMB + 'MB') +
      ' dom=' + dados.nos_dom +
      ' atraso_loop=' + Math.round(atrasoMaximoMs) + 'ms';
    Object.keys(valores).forEach(function (n) { resumo += ' ' + n + '=' + valores[n]; });

    if (motivos.length) {
      registrar('ALERTA', 'RECURSOS_ACIMA_DO_LIMITE', motivos.join(' | ') + ' || ' + resumo, dados);
    } else {
      registrar('INFO', 'RECURSOS', resumo, dados);
    }
    atrasoMaximoMs = 0;
    tarefasLongas = 0;
  }

  /* ---------- HTTP ---------- */

  function buscarJSON(url) {
    var t0 = performance.now();
    return fetch(url, { cache: 'no-store' }).then(function (resp) {
      var ms = Math.round(performance.now() - t0);
      if (!resp.ok) {
        registrar('ERRO', 'HTTP_ERRO', 'GET ' + url + ' → ' + resp.status, { url: url, status: resp.status, ms: ms });
        throw new Error('HTTP ' + resp.status + ' ao buscar ' + url);
      }
      registrar('INFO', 'HTTP', 'GET ' + url + ' → ' + resp.status + ' (' + ms + ' ms)', { url: url, status: resp.status, ms: ms });
      return resp.text().then(function (texto) {
        try {
          return JSON.parse(texto);
        } catch (e) {
          registrar('ERRO', 'JSON_INVALIDO', url + ': ' + e.message, { url: url, inicio: texto.slice(0, 200) });
          throw e;
        }
      });
    });
  }

  /* ---------- Inicialização ---------- */

  function iniciar() {
    return fetch('build-info.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (info) {
        if (info) {
          contexto.commit = info.commit || '?';
          contexto.ref = info.ref || '?';
        } else {
          contexto.commit = 'local';
          contexto.ref = 'local';
        }
        registrar('INFO', 'PAGINA_CARREGADA', location.href, {
          navegador: navigator.userAgent, build: info
        });
        setInterval(amostrarRecursos, INTERVALO_AMOSTRA_S * 1000);
        return info;
      });
  }

  window.Observabilidade = {
    iniciar: iniciar,
    definirVersaoApp: function (v) { contexto.versaoApp = v; },
    contexto: function () { return Object.assign({}, contexto); },
    info: function (evento, msg, dados) { registrar('INFO', evento, msg, dados); },
    alerta: function (evento, msg, dados) { registrar('ALERTA', evento, msg, dados); },
    erro: function (evento, msg, dados) { registrar('ERRO', evento, msg, dados); },
    contar: contar,
    registrarMedidor: registrarMedidor,
    buscarJSON: buscarJSON,
    chave: CHAVE,
    lerTodos: lerTodos,
    limpar: function () { localStorage.removeItem(CHAVE); }
  };
})();
