/**
 * Erro operacional da API: falhas PREVISTAS (entrada inválida, fonte externa
 * fora do ar), cuja mensagem é segura e útil para mostrar ao cidadão.
 *
 * Qualquer erro que NÃO seja ErroApi é tratado como bug (500) pelo
 * middleware global — ver src/middlewares/tratarErros.js.
 */
export class ErroApi extends Error {
  /**
   * @param {number} status    — status HTTP (400, 502, 504...)
   * @param {string} codigo    — identificador estável para o front (ex: 'TCE_TIMEOUT')
   * @param {string} mensagem  — texto em linguagem cidadã
   * @param {object} [opcoes]  — { detalhes, causa }
   */
  constructor(status, codigo, mensagem, { detalhes, causa } = {}) {
    super(mensagem, { cause: causa });
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}
