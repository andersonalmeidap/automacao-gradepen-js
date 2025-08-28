// scripts/main.js
// Entry point that reads the Excel file, obtains an API context and inserts questions.

const path = require('path');
const XLSX = require('xlsx');

const { getApiContext } = require('./automacao-gradepen');
const { insertQuestions } = require('./inserirQuestoes');

// Caminho da planilha e configuração padrão
const EXCEL_PATH = path.resolve(__dirname, '../data/teste_grade_pen.xlsx');
const QUESTION_CONFIG = {
  acesso: 2,  // 1=Public, 2=Private
  idioma: 1,  // 0=Português, 1=English, 2=Español, 3=Arabic
  level: 1    // 1=Elementary, 2=High school, 3=Technical, 4=College/University
};

async function main() {
  // 1) Ler planilha
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // 2) Obter contexto de API (login + cookies)
  const { api, browser } = await getApiContext();

  try {
    // 3) Inserir questões
    await insertQuestions(api, rows, QUESTION_CONFIG);
  } finally {
    // 4) Limpeza de recursos
    await api.dispose();
    await browser.close();
  }
}

main().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
