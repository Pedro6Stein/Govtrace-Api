import express from 'express';
import cors from 'cors';

import rotaStatus from './rotas/status.js';
import rotaAnalise from './rotas/analise.js';

/**
 * Configuração da aplicação Express (sem abrir porta).
 *
 * Separar "montar o app" de "subir o servidor" (server.js) permite importar
 * o app em testes automatizados sem ocupar uma porta de rede.
 */

// Origens autorizadas a consumir a API — por padrão, o Vite do front em dev.
// Em produção, defina CORS_ORIGIN (aceita lista separada por vírgula).
const origensPermitidas = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const app = express();

app.use(cors({ origin: origensPermitidas }));
app.use(express.json());

app.use('/api/status', rotaStatus);
app.use('/api/analise', rotaAnalise);

// 404 padronizado em JSON para qualquer rota inexistente
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada', caminho: req.originalUrl });
});

export default app;
