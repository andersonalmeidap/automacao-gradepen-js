// inserirQuestoes.js
const { URLSearchParams } = require('url');

async function insertQuestions(apiRequest, rows) {
  const QST_ENDPOINT = 'https://www.gradepen.com/p/requests/createUpdateQuestion.php';
  console.log(`🔄 Inserindo ${rows.length} questões (acesso Private)...`);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    process.stdout.write(` [${i+1}/${rows.length}] Inserindo questão... `);

    const form = new URLSearchParams();
    form.append('id',     '0');
    form.append('idPai',  '0');
    form.append('tipo',   '2');
    form.append('acesso', '2');            // Private
    form.append('autor',  row.Autor);
    form.append('ano',    String(row.Ano));
    form.append('idioma','0');
    form.append('level', '4');
    form.append('problema', row.Enunciado);

    const correctIndex = (row.Gabarito||'').trim().toLowerCase().charCodeAt(0)-97;
    for (let j = 0; j < 5; j++) {
      form.append('respostas[]', j===correctIndex?'1':'0');
      form.append(`alternativas[${j}]`, row[`Alternativa_${String.fromCharCode(65+j)}`]||'');
    }

    form.append('sugestaoLinhasTexto', '0');
    form.append('sugestaoLinhasDesenho','0');
    form.append('courses[]',           row.Area||'');
    form.append('subjects[]',          row.Tema||'');

    const res  = await apiRequest.post(QST_ENDPOINT, { data: form.toString() });
    const json = await res.json();
    if (json.success) {
      console.log(`✅ eid=${json.question.eid}`);
    } else {
      console.log(`❌ erro code=${json.errorCode}`);
    }
  }
  console.log('\n🎉 Todas as questões foram inseridas!');
}

module.exports = { insertQuestions };
