import { Router } from 'express';

import { buscarDespesasTce } from '../servicos/tce.js';
import { normalizarDespesas } from '../dominio/normalizacao.js';
import { executarAuditoria } from '../dominio/auditoria.js';

/**
 * GET /api/analise?municipio=Bragança Paulista&ano=2026&mes=6
 *
 * Busca as despesas no TCE-SP, normaliza, roda todos os motores e devolve
 * um JSON pronto para a camada de apresentação.
 */
const router = Router();

// Valida os parâmetros; retorna uma mensagem de erro ou null
const validarParametros = ({ municipio, ano, mes }) => {
  if (!municipio?.trim()) return 'Parâmetro "municipio" é obrigatório.';
  if (!/^\d{4}$/.test(ano ?? '')) return 'Parâmetro "ano" deve ter 4 dígitos (ex: 2026).';
  const numMes = Number(mes);
  if (!Number.isInteger(numMes) || numMes < 1 || numMes > 12) {
    return 'Parâmetro "mes" deve ser um número de 1 a 12.';
  }
  return null;
};

router.get('/', async (req, res) => {
  const erroValidacao = validarParametros(req.query);
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

  const municipio = req.query.municipio.trim();
  const ano = req.query.ano;
  const mes = String(Number(req.query.mes)); // "06" → "6"

  let dadosBrutos;
  try {
    dadosBrutos = await buscarDespesasTce(municipio, ano, mes);
  } catch (erro) {
    // Falha na fonte externa: 504 se estourou o tempo, 502 para os demais casos
    const timeout = erro.code === 'ECONNABORTED' || erro.code === 'ETIMEDOUT';
    console.error(`[analise] Falha no TCE-SP (${municipio}/${ano}/${mes}):`, erro.message);
    return res.status(timeout ? 504 : 502).json({
      erro: timeout
        ? 'O TCE-SP demorou demais para responder. Tente novamente.'
        : 'Não foi possível consultar o TCE-SP no momento.',
      statusTce: erro.response?.status ?? null,
    });
  }

  const despesas = normalizarDespesas(dadosBrutos);
  const resultado = executarAuditoria(despesas);

  res.json({
    parametros: { municipio, ano, mes },
    ...resultado,
    despesas,
  });
});

export default router;
