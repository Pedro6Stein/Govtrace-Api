import { Router } from 'express';

/**
 * GET /api/status — Health check
 *
 * Responde se a API está no ar. Útil para o front exibir um aviso de
 * indisponibilidade e para monitoramento em produção.
 */
const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    servico: 'govtrace-api',
    uptimeSegundos: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
