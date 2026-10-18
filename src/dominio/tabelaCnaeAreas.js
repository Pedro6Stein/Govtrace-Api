/**
 * TABELA DE REFERÊNCIA — CNAE (Receita Federal) → área de política pública
 *
 * O CNAE diz o que o FORNECEDOR faz; o cidadão quer saber em que ÁREA o
 * dinheiro público foi usado. Esta tabela é a ponte entre os dois — uma
 * decisão metodológica explícita, versionada e auditável (não uma regra
 * escondida no código).
 *
 * Fonte das categorias: API de CNAE do IBGE (v2) — 87 divisões. O teste de
 * cobertura confere esta tabela contra a lista oficial.
 *
 * Busca do mais específico para o mais geral:
 *   subclasse (7 dígitos) → classe (4 dígitos) → divisão (2 dígitos)
 *
 * MISTA (null) = atividade que não define a área sozinha (ex.: "fabricação de
 * máquinas"). A despesa cai no Regex, que decide pelo nome do fornecedor
 * ("UNIFORMES ESCOLARES" → Educação). Não existe a categoria "Outras".
 */

export const AREAS = Object.freeze({
  SAUDE: 'Saúde e Medicamentos',
  EDUCACAO: 'Educação e Ensino',
  INFRAESTRUTURA: 'Infraestrutura, Obras e Urbanismo',
  TRANSPORTE: 'Transporte, Frotas e Mobilidade',
  TECNOLOGIA: 'Tecnologia e Comunicação',
  ALIMENTACAO: 'Alimentação e Abastecimento',
  CULTURA: 'Cultura, Esporte e Lazer',
  ASSISTENCIA: 'Assistência Social',
  MAQUINA_PUBLICA: 'Máquina Pública, Repasses e Encargos',
  ADMINISTRACAO: 'Administração, Limpeza e Serviços Terceirizados',
});

const {
  SAUDE, EDUCACAO, INFRAESTRUTURA, TRANSPORTE, TECNOLOGIA, ALIMENTACAO,
  CULTURA, ASSISTENCIA, MAQUINA_PUBLICA, ADMINISTRACAO,
} = AREAS;
const MISTA = null;

// ─── Divisões (2 dígitos) — todas as 87 da CNAE 2.0 ──────────────────────────
export const AREA_POR_DIVISAO = Object.freeze({
  // A — Agropecuária
  '01': ALIMENTACAO,      // inclui agricultura familiar da merenda escolar
  '02': INFRAESTRUTURA,   // produção florestal: mudas e arborização urbana
  '03': ALIMENTACAO,
  // B — Indústrias extrativas
  '05': INFRAESTRUTURA,
  '06': TRANSPORTE,       // petróleo e gás: combustível
  '07': INFRAESTRUTURA,
  '08': INFRAESTRUTURA,   // areia, brita e pedra para obras
  '09': INFRAESTRUTURA,
  // C — Indústrias de transformação
  '10': ALIMENTACAO,
  '11': ALIMENTACAO,
  '12': MISTA,
  '13': MISTA,            // têxteis: enxoval hospitalar × uniformes
  '14': MISTA,            // vestuário: uniforme escolar × fardamento
  '15': MISTA,
  '16': INFRAESTRUTURA,   // madeira
  '17': ADMINISTRACAO,    // papel e material de expediente
  '18': ADMINISTRACAO,    // gráficas
  '19': MISTA,            // asfalto (obras) × combustível (frota)
  '20': MISTA,            // cloro para água × produtos de limpeza
  '21': SAUDE,            // farmacêuticos
  '22': MISTA,            // pneus × sacos de lixo
  '23': INFRAESTRUTURA,   // cimento, concreto, artefatos
  '24': INFRAESTRUTURA,
  '25': INFRAESTRUTURA,   // estruturas metálicas, esquadrias
  '26': TECNOLOGIA,
  '27': INFRAESTRUTURA,   // material elétrico e iluminação pública
  '28': MISTA,
  '29': TRANSPORTE,
  '30': TRANSPORTE,
  '31': MISTA,            // móveis: mobiliário escolar × de escritório
  '32': MISTA,            // instrumentos médicos, brinquedos, artigos esportivos
  '33': ADMINISTRACAO,    // manutenção de máquinas e equipamentos
  // D/E — Utilidades, água, esgoto e resíduos
  '35': INFRAESTRUTURA,   // energia elétrica: iluminação pública e prédios
  '36': INFRAESTRUTURA,   // água e saneamento
  '37': INFRAESTRUTURA,
  '38': ADMINISTRACAO,    // coleta de lixo = limpeza urbana
  '39': ADMINISTRACAO,
  // F — Construção
  '41': INFRAESTRUTURA,
  '42': INFRAESTRUTURA,
  '43': INFRAESTRUTURA,
  // G — Comércio (resolvido por classe, abaixo)
  '45': TRANSPORTE,       // veículos, peças e oficinas
  '46': MISTA,
  '47': MISTA,
  // H — Transporte
  '49': TRANSPORTE,
  '50': TRANSPORTE,
  '51': TRANSPORTE,
  '52': TRANSPORTE,
  '53': ADMINISTRACAO,    // correios
  // I — Alojamento e alimentação
  '55': ADMINISTRACAO,    // hospedagem
  '56': ALIMENTACAO,      // refeições e merenda terceirizada
  // J — Informação e comunicação
  '58': MISTA,            // editoras: livros × jornais (resolvido por classe)
  '59': CULTURA,
  '60': TECNOLOGIA,       // rádio e TV: comunicação institucional
  '61': TECNOLOGIA,
  '62': TECNOLOGIA,
  '63': TECNOLOGIA,
  // K — Financeiro (Caixa, Banco do Brasil, previdência)
  '64': MAQUINA_PUBLICA,
  '65': MAQUINA_PUBLICA,
  '66': MAQUINA_PUBLICA,
  // L/M — Imobiliárias e serviços profissionais
  '68': ADMINISTRACAO,    // aluguel de imóveis
  '69': ADMINISTRACAO,    // jurídico, contabilidade, auditoria
  '70': ADMINISTRACAO,    // consultoria em gestão
  '71': INFRAESTRUTURA,   // arquitetura e engenharia
  '72': EDUCACAO,         // pesquisa científica
  '73': TECNOLOGIA,       // publicidade: comunicação
  '74': ADMINISTRACAO,
  '75': SAUDE,            // veterinária: zoonoses e castração
  // N — Serviços administrativos
  '77': MISTA,            // aluguéis: carros × eventos × impressoras (por classe)
  '78': ADMINISTRACAO,    // locação de mão de obra
  '79': ADMINISTRACAO,
  '80': ADMINISTRACAO,    // vigilância
  '81': ADMINISTRACAO,    // limpeza predial e paisagismo
  '82': ADMINISTRACAO,
  // O — Administração pública (Prefeitura, Câmara, INSS)
  '84': MAQUINA_PUBLICA,
  // P/Q — Educação, saúde e assistência social
  '85': EDUCACAO,
  '86': SAUDE,
  '87': ASSISTENCIA,      // asilos, ILPIs, albergues
  '88': ASSISTENCIA,      // APAE e assistência sem alojamento
  // R — Cultura, esporte e lazer
  '90': CULTURA,
  '91': CULTURA,
  '92': MISTA,
  '93': CULTURA,
  // S — Outros serviços
  '94': ASSISTENCIA,      // associações de defesa de direitos sociais (por classe)
  '95': MISTA,            // conserto: informática × objetos pessoais (por classe)
  '96': MISTA,            // lavanderia, funerária, estética (por classe)
  '97': MISTA,
  // U — Organismos internacionais
  '99': MAQUINA_PUBLICA,
});

// ─── Classes (4 dígitos): divisões mistas ────────────────────────────────────
export const AREA_POR_CLASSE = Object.freeze({
  // 46 — Comércio atacadista
  '4611': ALIMENTACAO,    // representantes: matérias-primas agrícolas
  '4612': MISTA,
  '4613': INFRAESTRUTURA, // representantes: material de construção
  '4614': MISTA,
  '4615': ADMINISTRACAO,  // representantes: móveis e eletrodomésticos
  '4616': MISTA,
  '4617': ALIMENTACAO,
  '4618': MISTA,
  '4619': MISTA,
  '4621': ALIMENTACAO,
  '4622': ALIMENTACAO,
  '4623': ALIMENTACAO,
  '4631': ALIMENTACAO,
  '4632': ALIMENTACAO,
  '4633': ALIMENTACAO,
  '4634': ALIMENTACAO,
  '4635': ALIMENTACAO,
  '4636': MISTA,          // fumo
  '4637': ALIMENTACAO,
  '4639': ALIMENTACAO,
  '4641': MISTA,
  '4642': MISTA,          // vestuário: uniformes
  '4643': MISTA,
  '4644': SAUDE,          // medicamentos
  '4645': SAUDE,          // material médico-hospitalar
  '4646': ADMINISTRACAO,  // higiene pessoal
  '4647': MISTA,          // escritório × livros (por subclasse)
  '4649': MISTA,
  '4651': TECNOLOGIA,
  '4652': TECNOLOGIA,
  '4661': MISTA,
  '4662': INFRAESTRUTURA, // máquinas para construção
  '4663': MISTA,
  '4664': SAUDE,          // equipamentos médico-hospitalares
  '4665': ADMINISTRACAO,
  '4669': MISTA,
  '4671': INFRAESTRUTURA,
  '4672': INFRAESTRUTURA,
  '4673': INFRAESTRUTURA,
  '4674': INFRAESTRUTURA,
  '4679': INFRAESTRUTURA,
  '4681': TRANSPORTE,     // combustíveis
  '4682': MISTA,          // GLP
  '4683': MISTA,
  '4684': MISTA,
  '4685': INFRAESTRUTURA,
  '4686': ADMINISTRACAO,  // papel e embalagens
  '4687': ADMINISTRACAO,  // resíduos e sucatas
  '4689': MISTA,
  '4691': ALIMENTACAO,    // atacado com predominância de alimentos
  '4692': MISTA,
  '4693': MISTA,          // "mercadorias em geral": não define área
  // 47 — Comércio varejista
  '4711': ALIMENTACAO,    // supermercados
  '4712': ALIMENTACAO,
  '4713': MISTA,          // lojas de departamento
  '4721': ALIMENTACAO,
  '4722': ALIMENTACAO,
  '4723': ALIMENTACAO,
  '4724': ALIMENTACAO,
  '4729': ALIMENTACAO,
  '4731': TRANSPORTE,     // postos de combustível
  '4732': TRANSPORTE,
  '4741': INFRAESTRUTURA,
  '4742': INFRAESTRUTURA,
  '4743': INFRAESTRUTURA,
  '4744': INFRAESTRUTURA, // material de construção
  '4751': TECNOLOGIA,
  '4752': TECNOLOGIA,
  '4753': ADMINISTRACAO,  // eletrodomésticos
  '4754': ADMINISTRACAO,  // móveis e iluminação
  '4755': MISTA,
  '4756': CULTURA,        // instrumentos musicais
  '4757': ADMINISTRACAO,
  '4759': MISTA,
  '4761': MISTA,          // livros × jornais × papelaria (por subclasse)
  '4762': CULTURA,
  '4763': CULTURA,        // artigos esportivos e recreativos
  '4771': SAUDE,          // farmácias
  '4772': ADMINISTRACAO,  // higiene pessoal
  '4773': SAUDE,          // artigos médicos e ortopédicos
  '4774': SAUDE,          // óptica
  '4781': MISTA,
  '4782': MISTA,
  '4783': MISTA,
  '4784': MISTA,          // GLP
  '4785': MISTA,
  '4789': MISTA,
  '4790': MISTA,
  // 58 — Edição
  '5811': EDUCACAO,       // livros (didáticos)
  '5812': TECNOLOGIA,     // jornais: publicação de atos oficiais
  '5813': TECNOLOGIA,
  '5819': ADMINISTRACAO,
  '5821': EDUCACAO,
  '5822': TECNOLOGIA,
  '5823': TECNOLOGIA,
  '5829': ADMINISTRACAO,
  // 77 — Aluguéis não imobiliários
  '7711': TRANSPORTE,     // locadoras de veículos
  '7719': TRANSPORTE,
  '7721': CULTURA,        // equipamentos recreativos (eventos)
  '7722': CULTURA,
  '7731': MISTA,
  '7732': INFRAESTRUTURA, // máquinas para construção
  '7733': TECNOLOGIA,     // máquinas de escritório e informática
  '7740': ADMINISTRACAO,
  // 94 — Organizações associativas
  '9411': ADMINISTRACAO,  // entidades patronais
  '9412': ADMINISTRACAO,  // entidades profissionais
  '9420': ADMINISTRACAO,  // sindicatos
  '9492': MISTA,          // organizações políticas
  '9493': CULTURA,        // associações culturais e artísticas
  // 95 — Reparação
  '9511': TECNOLOGIA,
  '9512': TECNOLOGIA,
  '9521': ADMINISTRACAO,
  '9529': ADMINISTRACAO,
  // 96 — Serviços pessoais
  '9603': ASSISTENCIA,    // funerárias: sepultamento social
});

// ─── Subclasses (7 dígitos): classes que misturam áreas ──────────────────────
export const AREA_POR_SUBCLASSE = Object.freeze({
  '4647801': ADMINISTRACAO, // atacado de artigos de escritório e papelaria
  '4647802': EDUCACAO,      // atacado de livros, jornais e publicações
  '4761001': EDUCACAO,      // varejo de livros
  '4761002': TECNOLOGIA,    // varejo de jornais e revistas
  '4761003': ADMINISTRACAO, // varejo de papelaria
});

const NIVEIS = [
  [AREA_POR_SUBCLASSE, 7],
  [AREA_POR_CLASSE, 4],
  [AREA_POR_DIVISAO, 2],
];

/**
 * "4744099" → "Infraestrutura, Obras e Urbanismo" | null (MISTA ou inválido)
 *
 * Uma entrada MISTA explícita interrompe a busca: a classe 4693 não "herda"
 * nada da divisão 46. O(1): no máximo três consultas a objetos.
 */
export const areaDoCnae = (cnae) => {
  if (!/^\d{7}$/.test(cnae ?? '')) return null;
  for (const [tabela, digitos] of NIVEIS) {
    const chave = cnae.slice(0, digitos);
    if (Object.hasOwn(tabela, chave)) return tabela[chave];
  }
  return null;
};
