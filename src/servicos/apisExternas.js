import axios from 'axios';

/**
 * Clientes da BrasilAPI (CNPJ → CNAE) e do IBGE (divisão CNAE → descrição).
 *
 * Contrato: as funções exportadas NUNCA lançam erro. Qualquer falha vira
 * `null` e o domínio cai no Regex como fallback.
 *
 * Quatro proteções de infraestrutura:
 *  1. Cache em memória com "voo único": resultado pronto sai do Map; se a
 *     mesma chave já está sendo buscada, quem chega depois aguarda a MESMA
 *     promessa — nunca há duas requisições para o mesmo CNPJ/divisão.
 *  2. Limitador global FIFO: no máximo N requisições simultâneas por API,
 *     somando todas as análises em andamento (protege serviço público
 *     gratuito de rajadas e o nosso IP de bloqueio por HTTP 429).
 *  3. Erro definitivo × transitório: 404 ("CNPJ não existe") é cacheado como
 *     null; timeout/429/5xx NÃO são — a próxima análise tenta de novo.
 *  4. Disjuntor para HTTP 429: atingido o limite da API, pausa as consultas
 *     em vez de insistir (a BrasilAPI aceita ~100 consultas por minuto).
 */

const TIMEOUT_MS = 6000;
const LIMITE_CACHE = 20_000;  // ~1 MB; evicção FIFO quando lota
const AVISO_A_CADA_MS = 60_000;

// A BrasilAPI (atrás da Vercel) responde 403 ao User-Agent padrão do fetch do
// Node. Um UA identificado é boa prática com APIs públicas e evita bloqueios.
const http = axios.create({
  timeout: TIMEOUT_MS,
  headers: {
    'User-Agent': 'GovTrace/1.0 (+https://github.com/Pedro6Stein/Govtrace-Api)',
    Accept: 'application/json',
  },
});

// ─── Limitador de concorrência (semáforo FIFO) ───────────────────────────────
const criarLimitador = (maximo) => {
  let ativos = 0;
  const fila = [];

  const proximo = () => {
    if (ativos >= maximo || fila.length === 0) return;
    ativos++;
    const { tarefa, resolver } = fila.shift();
    tarefa()
      .catch(() => ({ valor: null, definitivo: false })) // Defesa: nunca deixa a fila travada
      .then(resolver)
      .finally(() => {
        ativos--;
        proximo();
      });
  };

  return (tarefa) => new Promise((resolver) => {
    fila.push({ tarefa, resolver });
    proximo();
  });
};

// ─── Cache com limite + deduplicação de chamadas em voo ──────────────────────
const criarCacheMemoizado = (limite) => {
  const resultados = new Map(); // chave → valor definitivo (pode ser null)
  const emVoo = new Map();      // chave → Promise em andamento

  return (chave, buscar) => {
    if (resultados.has(chave)) return Promise.resolve(resultados.get(chave));
    if (emVoo.has(chave)) return emVoo.get(chave);

    const promessa = buscar()
      .then(({ valor, definitivo }) => {
        if (definitivo) {
          // Map preserva ordem de inserção: o primeiro da fila é o mais antigo
          if (resultados.size >= limite) resultados.delete(resultados.keys().next().value);
          resultados.set(chave, valor);
        }
        return valor;
      })
      .catch(() => null)
      .finally(() => emVoo.delete(chave));

    emVoo.set(chave, promessa);
    return promessa;
  };
};

// ─── Falhas: silenciosas para quem chama, visíveis no log (sem spam) ─────────
const falhas = new Map(); // api → { quantidade, ultimoAviso, ultimoMotivo }

const registrarFalha = (api, erro) => {
  if (erro.response?.status === 429) return; // O disjuntor já registra o 429
  const estado = falhas.get(api) ?? { quantidade: 0, ultimoAviso: 0 };
  estado.quantidade++;
  estado.ultimoMotivo = erro.response?.status ? `HTTP ${erro.response.status}` : (erro.code ?? erro.message);
  if (Date.now() - estado.ultimoAviso >= AVISO_A_CADA_MS) {
    console.warn(`⚠ [${new Date().toISOString()}] ${api}: ${estado.quantidade} falha(s) transitória(s) no último minuto (última: ${estado.ultimoMotivo}) — usando fallback Regex`);
    estado.ultimoAviso = Date.now();
    estado.quantidade = 0;
  }
  falhas.set(api, estado);
};

// 404/400: o recurso não existe — repetir não muda a resposta
const ehErroDefinitivo = (erro) => [400, 404].includes(erro.response?.status);

// ─── Disjuntor (circuit breaker) para HTTP 429 ───────────────────────────────
// Ao estourar o limite, insistir só gasta cota e prolonga o bloqueio. O
// disjuntor "abre": as próximas consultas voltam null na hora (sem rede) até
// a pausa terminar. A BrasilAPI não envia Retry-After; se vier, é respeitado.
const PAUSA_APOS_429_MS = 60_000;

const criarDisjuntor = (api) => {
  let abertoAte = 0;
  return {
    aberto: () => Date.now() < abertoAte,
    registrar: (erro) => {
      if (erro.response?.status !== 429) return;
      const segundos = Number(erro.response.headers?.['retry-after']);
      const pausa = segundos > 0 ? segundos * 1000 : PAUSA_APOS_429_MS;
      if (Date.now() >= abertoAte) {
        console.warn(`⚠ [${new Date().toISOString()}] ${api}: limite de requisições atingido (HTTP 429) — pausando consultas por ${pausa / 1000}s`);
      }
      abertoAte = Math.max(abertoAte, Date.now() + pausa);
    },
  };
};

const TRANSITORIO = { valor: null, definitivo: false };

// ─── BrasilAPI: CNPJ → CNAE fiscal ───────────────────────────────────────────
const limitadorBrasilApi = criarLimitador(8);
const disjuntorBrasilApi = criarDisjuntor('BrasilAPI');
const cacheCnae = criarCacheMemoizado(LIMITE_CACHE);

// cnae_fiscal chega como NÚMERO: 0111301 (agricultura) vira 111301. Sem o
// padStart, "os 2 primeiros dígitos" dariam a divisão 11 em vez de 01.
const normalizarCnae = (bruto) => {
  const digitos = String(bruto ?? '').replace(/\D/g, '');
  if (!digitos || digitos.length > 7 || Number(digitos) === 0) return null;
  return digitos.padStart(7, '0');
};

/** "08183516000120" → "4744099" | null */
export const buscarCnaeFiscal = (cnpj) =>
  cacheCnae(cnpj, () => limitadorBrasilApi(async () => {
    if (disjuntorBrasilApi.aberto()) return TRANSITORIO; // Sem rede: não cacheia, tenta depois
    try {
      const { data } = await http.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      return { valor: normalizarCnae(data?.cnae_fiscal), definitivo: true };
    } catch (erro) {
      if (ehErroDefinitivo(erro)) return { valor: null, definitivo: true };
      disjuntorBrasilApi.registrar(erro);
      registrarFalha('BrasilAPI', erro);
      return TRANSITORIO;
    }
  }));

// ─── IBGE: divisão CNAE (2 dígitos) → descrição ──────────────────────────────
const limitadorIbge = criarLimitador(4);
const disjuntorIbge = criarDisjuntor('IBGE');
const cacheDivisao = criarCacheMemoizado(200); // só existem ~87 divisões

// "COMÉRCIO VAREJISTA" → "Comércio varejista" (caixa alta prejudica a leitura)
const formatarDescricao = (texto) => {
  const minusculo = texto.trim().toLocaleLowerCase('pt-BR');
  return minusculo.charAt(0).toLocaleUpperCase('pt-BR') + minusculo.slice(1);
};

/** "47" → "Comércio varejista" | null */
export const buscarDescricaoDivisaoCnae = (divisao) => {
  if (!/^\d{2}$/.test(divisao ?? '')) return Promise.resolve(null);

  return cacheDivisao(divisao, () => limitadorIbge(async () => {
    if (disjuntorIbge.aberto()) return TRANSITORIO;
    try {
      const { data } = await http.get(`https://servicodados.ibge.gov.br/api/v2/cnae/divisoes/${divisao}`);
      // Divisão inexistente: o IBGE responde HTTP 200 com [] (não 404)
      const descricao = typeof data?.descricao === 'string' ? data.descricao : null;
      return { valor: descricao ? formatarDescricao(descricao) : null, definitivo: true };
    } catch (erro) {
      if (ehErroDefinitivo(erro)) return { valor: null, definitivo: true };
      disjuntorIbge.registrar(erro);
      registrarFalha('IBGE', erro);
      return TRANSITORIO;
    }
  }));
};
