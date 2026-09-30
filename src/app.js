import express from 'express';
import cors from 'cors';

import rotaStatus from './rotas/status.js';
import rotaAnalise from './rotas/analise.js';
import { tratarRotaInexistente, tratarErros } from './middlewares/tratarErros.js';

/**
 * Configuração da aplicação Express (sem abrir porta).
 *
 * Separar "montar o app" de "subir o servidor" (server.js) permite importar
 * o app em testes automatizados sem ocupar uma porta de rede.
 */

// Padroniza uma origem para comparação: remove espaços, aspas coladas por
// engano no painel da hospedagem, barras finais e diferença de caixa.
// "  'https://Gov-Trace.vercel.app/' " → "https://gov-trace.vercel.app"
const normalizarOrigem = (origem) =>
  origem.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '').toLowerCase();

// Origens autorizadas a consumir a API — por padrão, o Vite do front em dev.
// Em produção, defina CORS_ORIGIN (aceita lista separada por vírgula).
const origensPermitidas = new Set(
  (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(normalizarOrigem)
    .filter(Boolean),
);

console.log('[cors] origens permitidas:', [...origensPermitidas].join(', '));

const opcoesCors = {
  origin(origem, callback) {
    // Sem cabeçalho Origin = não é um navegador em outro domínio (curl,
    // health check do Render, chamada servidor-a-servidor). CORS é uma
    // proteção do navegador, então não há o que bloquear aqui.
    if (!origem) return callback(null, true);

    if (origensPermitidas.has(normalizarOrigem(origem))) return callback(null, true);

    // Recusa sem lançar erro: a API responde normalmente, mas sem os
    // cabeçalhos CORS — o navegador é quem bloqueia a leitura.
    console.warn(`[cors] origem recusada: ${origem}`);
    return callback(null, false);
  },
};

const app = express();

app.use(cors(opcoesCors));
app.use(express.json());

app.use('/api/status', rotaStatus);
app.use('/api/analise', rotaAnalise);

// Sempre por último: 404 e tratamento global de erros (JSON padronizado + log)
app.use(tratarRotaInexistente);
app.use(tratarErros);

export default app;
