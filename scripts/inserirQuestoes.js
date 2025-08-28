// scripts/inserirQuestoes.js
// Lê as colunas exatas da planilha e envia as questões por POST.
// Mapeamentos (planilha → GradePen):
// - Disciplina  -> courses[]       (Courses)
// - Tema        -> subjects[]      (Subject)
// - Banca       -> autor           (Author)
// - Ano         -> ano             (Year)
// - Enunciado   -> problema        (Text of the question text)
// - Imagens do Enunciado -> upload de imagem + <img gpimg-id="ID"> no problema
// - Alternativa A..E, Gabarito     -> alternativas/respostas

const path = require('path');
const fs = require('fs');

// ===== Helpers =====

function textoUtilLen(html) {
  if (!html) return 0;
  let t = String(html);
  // imagens contam como 6 caracteres (regra do site)
  t = t.replace(/<img[^>]*>/gi, '......');
  // remove tags
  t = t.replace(/<[^>]*>/g, '');
  return t.trim().length;
}

function sanitizeStr(v) {
  if (v === undefined || v === null) return '';
  return String(v).toString();
}

/**
 * Se a célula "Imagens do Enunciado" tiver caminhos válidos (separados por vírgula/;),
 * faz upload e devolve array de ids. Caso contrário, [].
 */
async function uploadImagesIfAny(api, imagesCell) {
  const resultIds = [];
  if (!imagesCell) return resultIds;

  // separa por ; , | ou quebra de linha
  const parts = String(imagesCell).split(/[,;|\n]+/).map(s => s.trim()).filter(Boolean);
  for (const rel of parts) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(__dirname, '..', 'data', rel);
    if (!fs.existsSync(abs)) {
      console.log(`   • ⚠️ imagem ignorada (arquivo não encontrado): ${rel}`);
      continue;
    }
    try {
      const formData = {
        '0': { name: path.basename(abs), mimeType: guessMime(abs), buffer: fs.readFileSync(abs) },
        imgType: 'question',
        ownerId: '0'
      };
      const resp = await api.post('/p/requests/uploadImage.php', { multipart: formData });
      const text = (await resp.text() || '').trim();
      // a resposta costuma ser o ID numérico da imagem
      const imgId = text.match(/\d+/) ? text.match(/\d+/)[0] : null;
      if (imgId) {
        resultIds.push(imgId);
        console.log(`   • 🖼️ upload ok: ${path.basename(abs)} → imgId=${imgId}`);
      } else {
        console.log(`   • ⚠️ upload sem id reconhecido: ${text}`);
      }
    } catch (e) {
      console.log(`   • ⚠️ erro no upload de "${rel}": ${e.message}`);
    }
  }
  return resultIds;
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

/** Monta o HTML do enunciado com as imagens anexadas (se houver) */
function montarProblemaHTML(enunciadoTexto, imageIds) {
  let html = sanitizeStr(enunciadoTexto).trim();
  // se vier texto puro, ok; se vier vazio e tiver imagem, ainda passa na validação porque <img> conta
  for (const id of imageIds) {
    // markup mínimo aceito no payload (gpimg-id é o que o site usa)
    html += (html ? '<br>' : '') + `<img gpimg-id="${id}">`;
  }
  return html;
}

// ===== Envia 1 questão pelo endpoint oficial =====
async function enviarQuestao(api, row, config) {
  // planilha: Enunciado
  const enunciadoTexto = sanitizeStr(row['Enunciado']);

  // imagens opcionais
  const imgCell = row['Imagens do Enunciado'];
  const imgIds = await uploadImagesIfAny(api, imgCell);

  const problemaHTML = montarProblemaHTML(enunciadoTexto, imgIds);

  // validação local para evitar code=38
  if (textoUtilLen(problemaHTML) < 5) {
    console.log('   • ⚠️ enunciado muito curto/vazio (menos de 5 chars úteis).');
  }

  // alternativas
  const altA = sanitizeStr(row['Alternativa A']);
  const altB = sanitizeStr(row['Alternativa B']);
  const altC = sanitizeStr(row['Alternativa C']);
  const altD = sanitizeStr(row['Alternativa D']);
  const altE = sanitizeStr(row['Alternativa E']);
  const gabarito = sanitizeStr(row['Gabarito']).trim().toUpperCase();

  const respostas = ['A','B','C','D','E'].map(letter => (gabarito === letter ? 1 : 0));

  // mapeamentos
  const disciplina = sanitizeStr(row['Disciplina']); // courses
  const tema       = sanitizeStr(row['Tema']);       // subjects
  const banca      = sanitizeStr(row['Banca']);      // autor
  const ano        = sanitizeStr(row['Ano']);        // ano

  const form = {
    id: 0,
    idPai: 0,
    tipo: 2, // Multiple-Choice
    acesso: config.acesso,
    autor: banca,
    ano: ano,
    idioma: config.idioma,
    level: config.level,
    problema: problemaHTML,
    // alternativas
    'alternativas[0]': altA,
    'alternativas[1]': altB,
    'alternativas[2]': altC,
    'alternativas[3]': altD,
    'alternativas[4]': altE,
    'respostas[]': respostas,
    // linhas sugeridas (para discursiva) — manter 0
    sugestaoLinhasTexto: 0,
    sugestaoLinhasDesenho: 0,
    // tags (autocomplete)
    courses: '',
    'courses[]': disciplina ? [disciplina] : [],
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

// ===== Loop principal =====
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
