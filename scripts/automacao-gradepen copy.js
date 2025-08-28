// automacao-gradepen.js
// Script principal que faz login, lê planilha e dispara inserção de questões
// Depende de insertQuestions.js para o loop de inserção

const { chromium } = require('playwright');
const XLSX = require('xlsx');
const path = require('path');
const { insertQuestions } = require('./automation/insertQuestions');

(async () => {
  // === CONFIGURAÇÕES ===
  const EXCEL_PATH = path.resolve(__dirname, '../data/teste_grade_pen.xlsx');
  const EMAIL      = 'anderson.almeidap@outlook.com';
  const SENHA      = 'Cad09025.';

  // 1) Ler planilha de questões
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json(sheet);

  // 2) Iniciar browser e login via UI para obter cookies de sessão
  const browser   = await chromium.launch({ headless: true });
  const uiContext = await browser.newContext();
  const uiPage    = await uiContext.newPage();

  console.log(`🔐 Fazendo login como ${EMAIL}...`);
  await uiPage.goto('https://www.gradepen.com/p/index.php');
  await uiPage.click('#btn-login');
  await uiPage.fill('#inputEmail', EMAIL);
  await uiPage.fill('#inputPwd',   SENHA);
  await Promise.all([
    uiPage.click('#btnLoginSend'),
    uiPage.waitForNavigation({ waitUntil: 'networkidle' })
  ]);
  console.log('✅ Login bem-sucedido!');

  // 3) Capturar cookies e fechar contexto UI
  const cookies = await uiContext.cookies();
  await uiContext.close();

  // 4) Criar contexto de API com cookies para chamadas diretas
  const apiContext = await browser.newContext({
    extraHTTPHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
    storageState:       { cookies }
  });
  const apiRequest = apiContext.request;

  // 5) Inserir questões usando o módulo
  await insertQuestions(apiRequest, rows);

  // 6) Fechar browser
  await browser.close();
  console.log('🏁 Script principal concluído!');
})();
