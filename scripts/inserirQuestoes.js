// inserirQuestoes.js
// Lê as colunas da planilha e envia as questões ao GradePen.

const path = require('path');
const fs = require('fs');

function textoUtilLen(html) {
  if (!html) return 0;
  let t = String(html);
  t = t.replace(/<img[^>]*>/gi, '......');
  t = t.replace(/<[^>]*>/g, '');
  return t.trim().length;
}

function sanitizeStr(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

async function uploadImagesIfAny(api, imagesCell) {
  const resultIds = [];
  if (!imagesCell) return resultIds;

  const parts = String(imagesCell)
    .split(/[,;|\n]+/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const rel of parts) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(__dirname, '..', 'data', rel);
    if (!fs.existsSync(abs)) {
      console.log(`   • imagem ignorada (arquivo não encontrado): ${rel}`);
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
      const imgId = text.match(/\d+/) ? text.match(/\d+/)[0] : null;
      if (imgId) {
        resultIds.push(imgId);
        console.log(`   • upload ok: ${path.basename(abs)} → imgId=${imgId}`);
      } else {
        console.log(`   • upload sem id reconhecido: ${text}`);
      }
    } catch (e) {
      console.log(`   • erro no upload de "${rel}": ${e.message}`);
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

function montarProblemaHTML(enunciadoTexto, imageIds) {
  let html = sanitizeStr(enunciadoTexto).trim();
  for (const id of imageIds) {
    html += (html ? '<br>' : '') + `<img gpimg-id="${id}">`;
  }
  return html;
}

async function enviarQuestao(api, row, config) {
  const enunciadoTexto = sanitizeStr(row['Enunciado']);
  const imgCell = row['Imagens do Enunciado'];
  const imgIds = await uploadImagesIfAny(api, imgCell);
  const problemaHTML = montarProblemaHTML(enunciadoTexto, imgIds);

  if (textoUtilLen(problemaHTML) < 5) {
    console.log('   • enunciado muito curto ou vazio.');
  }

  const altA = sanitizeStr(row['Alternativa A']);
  const altB = sanitizeStr(row['Alternativa B']);
  const altC = sanitizeStr(row['Alternativa C']);
  const altD = sanitizeStr(row['Alternativa D']);
  const altE = sanitizeStr(row['Alternativa E']);
  const gabarito = sanitizeStr(row['Gabarito']).trim().toUpperCase();

  const respostas = ['A', 'B', 'C', 'D', 'E'].map(letter => (gabarito === letter ? 1 : 0));

  const disciplina = sanitizeStr(row['Disciplina']);
  const tema = sanitizeStr(row['Tema']);
  const banca = sanitizeStr(row['Banca']);
  const ano = sanitizeStr(row['Ano']);

  const form = {
    id: 0,
    idPai: 0,
    tipo: 2,
    acesso: config.acesso,
    autor: banca,
    ano: ano,
    idioma: config.idioma,
    level: config.level,
    problema: problemaHTML,
    'alternativas[0]': altA,
    'alternativas[1]': altB,
    'alternativas[2]': altC,
    'alternativas[3]': altD,
    'alternativas[4]': altE,
    'respostas[]': respostas,
    sugestaoLinhasTexto: 0,
    sugestaoLinhasDesenho: 0,
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
      console.log(`   • OK (eid=${eid})`);
      return { ok: true, eid };
    }
    const code = data?.errorCode ?? '?';
    const msg = data?.message ?? 'sem mensagem';
    console.log(`   • erro code=${code} msg=${msg}`);
    return { ok: false, code, msg };
  } catch (err) {
    console.log(`   • erro fatal: ${err.message}`);
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
