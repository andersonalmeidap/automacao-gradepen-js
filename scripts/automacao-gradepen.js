// scripts/automacao-gradepen.js
// Dependências: npm i playwright xlsx
// Também: npx playwright install

const path = require('path');
const XLSX = require('xlsx');
const { chromium, request } = require('playwright');

// ========= CONFIG =========
const EXCEL_PATH = path.resolve(__dirname, '../data/teste_grade_pen.xlsx');

// Credenciais (pode mover para .env se quiser)
const EMAIL = 'anderson.almeidap@outlook.com';
const SENHA = 'Cad09025.';

// Acesso/idioma/nível padrão para as questões
const QUESTION_CONFIG = {
  acesso: 2,          // 1=Public, 2=Private
  idioma: 1,          // 0=Português, 1=English, 2=Español, 3=Arabic
  level: 1            // 1=Elementary, 2=High school, 3=Technical, 4=College/University
};

const { insertQuestions } = require('./inserirQuestoesTeste');

(async () => {
  // 1) Ler a planilha (primeira aba)
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // 2) Abrir navegador e logar para obter cookies de sessão
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log(`🔐 Fazendo login como ${EMAIL}...`);
  await page.goto('https://www.gradepen.com/p/index.php');

  await page.click('#btn-login');
  await page.fill('#inputEmail', EMAIL);
  await page.fill('#inputPwd', SENHA);
  await page.click('#btnLoginSend');

  // dá um tempo para autenticação e cookies
  await page.waitForTimeout(3000);
  console.log('✅ Login bem-sucedido!');

  // 3) Criar um API client com mesmos cookies (para os POSTs diretos)
  const cookies = await page.context().cookies();
  const apiRequest = await request.newContext({
    baseURL: 'https://www.gradepen.com',
    extraHTTPHeaders: {
      'Accept': '*/*',
      'Referer': 'https://www.gradepen.com/p/avaliacoes.php',
      'Origin': 'https://www.gradepen.com'
    },
    // injeta cookies de sessão
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain.slice(1) : c.domain,
      path: c.path || '/',
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite
    }))
  });

  // 4) Inserir as questões a partir da planilha
  await insertQuestions({ api: apiRequest, page }, rows, QUESTION_CONFIG);

  // 5) Fechar
  await apiRequest.dispose();
  await browser.close();
})();
