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
  // Algumas planilhas podem conter um erro de digitação no cabeçalho das
  // alternativas ("Alernativa" em vez de "Alternativa"). Para não falhar na
  // inserção das questões, aceitamos ambos os nomes de coluna.
  const altA = sanitizeStr(row['Alternativa A'] ?? row['Alernativa A']);
  const altB = sanitizeStr(row['Alternativa B'] ?? row['Alernativa B']);
  const altC = sanitizeStr(row['Alternativa C'] ?? row['Alernativa C']);
  const altD = sanitizeStr(row['Alternativa D'] ?? row['Alernativa D']);
  const altE = sanitizeStr(row['Alternativa E'] ?? row['Alernativa E']);
  const gabarito = sanitizeStr(row['Gabarito']).trim().toUpperCase();
  
  const correctIndex = ['A', 'B', 'C', 'D', 'E'].indexOf(gabarito);
  const respostas = Array(5).fill('0');
  if (correctIndex >= 0) {
    respostas[correctIndex] = '1';
  } else {
    console.log(`   • ⚠️ gabarito inválido: "${gabarito}"`);
  }

  // mapeamentos
  const disciplina = sanitizeStr(row['Disciplina']); // courses
  const tema       = sanitizeStr(row['Tema']);       // subjects
  const banca      = sanitizeStr(row['Banca']);      // autor
  const ano        = sanitizeStr(row['Ano']);        // ano

  const form = new URLSearchParams();
  form.append('id', '0');
  form.append('idPai', '0');
  form.append('tipo', '2'); // Multiple-Choice
  form.append('acesso', String(config.acesso));
  form.append('autor', banca);
  form.append('ano', ano);
  form.append('idioma', String(config.idioma));
  form.append('level', String(config.level));
  form.append('problema', problemaHTML);
  // alternativas
  form.append('alternativas[0]', altA);
  form.append('alternativas[1]', altB);
  form.append('alternativas[2]', altC);
  form.append('alternativas[3]', altD);
  form.append('alternativas[4]', altE);
  respostas.forEach(r => form.append('respostas[]', r));
  // linhas sugeridas (para discursiva) — manter 0
  form.append('sugestaoLinhasTexto', '0');
  form.append('sugestaoLinhasDesenho', '0');
  // tags (autocomplete)
  form.append('courses', '');
  if (disciplina) form.append('courses[]', disciplina);
  form.append('subjects', '');
  if (tema) form.append('subjects[]', tema);

  try {
    const resp = await api.post('/p/requests/createUpdateQuestion.php', { form });
    const statusCode = resp.status ? resp.status() : undefined;
    const body = await resp.text();
    if (statusCode !== undefined && statusCode !== 200) {
      console.log(`   • ⚠️ HTTP status ${statusCode}`);
      console.log(`   • ⚠️ corpo completo:\n${body}`);
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      console.log(`   • ❌ resposta não JSON: ${body}`);
      return { ok: false, code: 'PARSE', msg: 'Resposta inválida do servidor' };
    }

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
