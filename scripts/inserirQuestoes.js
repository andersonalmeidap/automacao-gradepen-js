// scripts/inserirQuestoes.js
// Insere as questões no GradePen via POST direto.

function sanitizeStr(v) {
  if (v === undefined || v === null) return '';
  return String(v).toString();
}

async function enviarQuestao(api, row, config) {
  const enunciado = sanitizeStr(row['Enunciado']);
  const altA = sanitizeStr(row['Alternativa A']);
  const altB = sanitizeStr(row['Alternativa B']);
  const altC = sanitizeStr(row['Alternativa C']);
  const altD = sanitizeStr(row['Alternativa D']);
  const altE = sanitizeStr(row['Alternativa E']);
  const gabarito = sanitizeStr(row['Gabarito']).trim().toUpperCase();

  const respostas = ['A','B','C','D','E'].map(letter => (gabarito === letter ? 1 : 0));

  const tema  = sanitizeStr(row['Tema']);
  const banca = sanitizeStr(row['Banca']);
  const ano   = sanitizeStr(row['Ano']);

  const form = {
    id: 0,
    idPai: 0,
    tipo: 2, // Multiple-choice
    acesso: config.acesso,
    autor: banca,
    ano: ano,
    idioma: config.idioma,
    level: config.level,
    problema: enunciado,
    'alternativas[0]': altA,
    'alternativas[1]': altB,
    'alternativas[2]': altC,
    'alternativas[3]': altD,
    'alternativas[4]': altE,
    'respostas[]': respostas,
    sugestaoLinhasTexto: 0,
    sugestaoLinhasDesenho: 0,
    courses: '',
    'courses[]': row['Disciplina'] ? [row['Disciplina']] : [],
    subjects: '',
    'subjects[]': tema ? [tema] : []
  };

  try {
    const resp = await api.post('/p/requests/createUpdateQuestion.php', { form });
    const data = await resp.json();

    if (data?.success) {
      const eid = data?.question?.eid || '?';
      console.log(`   • ✅ OK (eid=${eid})`);
      return { ok: true, eid };
    } else {
      const code = data?.errorCode ?? '?';
      const msg  = data?.message ?? 'sem mensagem';
      console.log(`   • ❌ erro code=${code} msg=${msg}`);
      return { ok: false, code, msg };
    }
  } catch (err) {
    console.log(`   • ❌ erro fatal: ${err.message}`);
    return { ok: false, code: 'EX', msg: err.message };
  }
}

async function insertQuestions(ctx, rows, config) {
  const { api } = ctx;
  const total = rows.length;

  console.log(`🔄 Inserindo ${total} questão(ões) (acesso ${config.acesso === 2 ? 'Private' : 'Public'})...`);

  let idx = 0;
  for (const row of rows) {
    idx++;
    console.log(` [${idx}/${total}] Inserindo questão...`);
    await enviarQuestao(api, row, config);
  }
}

module.exports = { insertQuestions };

