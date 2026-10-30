/*
* precos.js -- regras de preço da campanha Black Friday (RET-202)
*/
function precoComDesconto(jogo, config) {
const campanha = config.blackFriday;
if (!campanha.ativa) {
return jogo.preco;
}
const promocao = campanha.promocoes[jogo.id];
const desconto = promocao.percentual / 100;
return Math.round(jogo.preco * (1 - desconto) * 100) / 100;
}