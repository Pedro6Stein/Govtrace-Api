import { randomUUID } from 'node:crypto';

import { ErroApi } from '../erros/ErroApi.js';

/**
 * Tratamento global de erros do Express.
 *
 * Todo erro — lançado numa rota async (o Express 5 encaminha sozinho),
 * vindo do cliente do TCE-SP ou de um bug — termina aqui e vira:
 *   1. um bloco de log legível no console do Render;
 *   2. um JSON padronizado para o front-end.
 */

const EM_PRODUCAO = process.env.NODE_ENV === 'production';

// ─── Log ─────────────────────────────────────────────────────────────────────
const registrarErro = ({ idErro, status, codigo, req, erro }) => {
  const linhas = [
    `${status >= 500 ? '✖' : '⚠'} [${new Date().toISOString()}] ${status} ${codigo} — ${req.method} ${req.originalUrl}`,
    `  id:     ${idErro}`,
    `  motivo: ${erro.message}`,
  ];
  if (erro.cause?.message) linhas.push(`  causa:  ${erro.cause.message}`);
  if (erro.detalhes) linhas.push(`  dados:  ${JSON.stringify(erro.detalhes)}`);
  if (status >= 500 && !(erro instanceof ErroApi)) linhas.push(`  stack:\n${erro.stack}`);

  const texto = linhas.join('\n');
  status >= 500 ? console.error(texto) : console.warn(texto);
};

// ─── 404: rota inexistente ───────────────────────────────────────────────────
export const tratarRotaInexistente = (req, res, next) => {
  next(new ErroApi(404, 'ROTA_INEXISTENTE', `Rota não encontrada: ${req.method} ${req.path}`));
};

// ─── Middleware de erro (4 parâmetros = assinatura de erro do Express) ───────
export const tratarErros = (erro, req, res, next) => {
  if (res.headersSent) return next(erro); // Resposta já começou: delega ao Express

  const idErro = randomUUID().slice(0, 8);
  const operacional = erro instanceof ErroApi;

  // Erros do próprio Express/body-parser (ex: JSON malformado) trazem status 4xx
  const status = operacional ? erro.status : (erro.status ?? erro.statusCode ?? 500);
  const codigo = operacional ? erro.codigo : status < 500 ? 'REQUISICAO_INVALIDA' : 'ERRO_INTERNO';

  registrarErro({ idErro, status, codigo, req, erro });

  // Bugs (500) em produção: não expomos detalhes internos ao público — o
  // idErro liga a resposta ao log completo no Render.
  const mensagem = operacional || status < 500 || !EM_PRODUCAO
    ? erro.message
    : `Erro interno inesperado. Informe o código ${idErro} à equipe GovTrace.`;

  res.status(status).json({
    erro: mensagem,
    status,
    codigo,
    idErro,
    ...(erro.detalhes && { detalhes: erro.detalhes }),
    timestamp: new Date().toISOString(),
  });
};
