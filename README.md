# Retrô 128 — Loja de jogos de PS2

Loja fictícia (títulos e capas inventados) usada na atividade **Caos em produção: investigação de incidentes** (DevOps — FAG).

- `index.html` — vitrine, filtros e carrinho
- `logs.html` — **Painel de logs** (lê a telemetria gravada no navegador)
- `config/app-config.json` — configuração da aplicação
- `data/catalogo.json` — catálogo de jogos
- `js/` — código da aplicação (`app.js`, `contador.js`, `observabilidade.js`)
- `.github/workflows/deploy.yml` — deploy no GitHub Pages (push na `main`) e **rollback** (Run workflow com uma versão)

## Rodar localmente
```bash
python -m http.server 8000
# abra http://localhost:8000
```
