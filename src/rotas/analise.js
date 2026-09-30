import { Router } from 'express';

import { ErroApi } from '../erros/ErroApi.js';
import { buscarDespesasTce } from '../servicos/tce.js';
import { normalizarDespesas } from '../dominio/normalizacao.js';
import { executarAuditoria } from '../dominio/auditoria.js';

/**
 * GET /api/analise?municipio=Bragança Paulista&ano=2026&mes=6
 *
 * Busca as despesas no TCE-SP, normaliza, roda todos os motores e devolve
 * um JSON pronto para a camada de apresentação.
 *
 * Sem try/catch: o Express 5 encaminha erros de rotas async ao middleware
 * global (src/middlewares/tratarErros.js), que registra e responde.
 */
const router = Router();

// Lança ErroApi 400 com o parâmetro exato que está errado
const validarParametros = ({ municipio, ano, mes }) => {
  const invalido = (parametro, mensagem) => {
    throw new ErroApi(400, 'PARAMETRO_INVALIDO', mensagem, { detalhes: { parametro } });
  };

  // typeof: "?municipio=a&municipio=b" chega como array
  if (typeof municipio !== 'string' || !municipio.trim()) {
    invalido('municipio', 'Parâmetro "municipio" é obrigatório (ex: Bragança Paulista).');
  }
  if (typeof ano !== 'string' || !/^\d{4}$/.test(ano)) {
    invalido('ano', 'Parâmetro "ano" deve ter 4 dígitos (ex: 2026).');
  }
  const numMes = Number(mes);
  if (typeof mes !== 'string' || !Number.isInteger(numMes) || numMes < 1 || numMes > 12) {
    invalido('mes', 'Parâmetro "mes" deve ser um número de 1 a 12.');
  }
};

router.get('/', async (req, res) => {
  validarParametros(req.query);

  const municipio = req.query.municipio.trim();
  const ano = req.query.ano;
  const mes = String(Number(req.query.mes)); // "06" → "6"

  const dadosBrutos = await buscarDespesasTce(municipio, ano, mes);
  const { despesas, valoresInvalidos } = normalizarDespesas(dadosBrutos);

  if (valoresInvalidos > 0) {
    console.warn(
      `⚠ [${new Date().toISOString()}] ${valoresInvalidos} valor(es) monetário(s) ilegível(is) do TCE-SP ` +
      `em ${municipio}/${ano}/${mes} — contabilizados como R$ 0,00`,
    );
  }

  res.json({
    parametros: { municipio, ano, mes },
    qualidadeDados: {
      registrosRecebidos: dadosBrutos.length,
      registrosAnalisados: despesas.length,
      valoresInvalidos,
    },
    ...executarAuditoria(despesas),
    despesas,
  });
});

export default router;
