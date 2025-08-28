// scripts/automacao-gradepen.js
// Dependências: npm i playwright xlsx
// Também: npx playwright install

const path = require('path');
const XLSX = require('xlsx');
const { chromium, request } = require('playwright');

// ========= CONFIG =========
const EXCEL_PATH = path.resolve(__dirname, '../data/teste_grade_pen.xlsx');

const { insertQuestions } = require('./inserirQuestoes');

async function createApiContext() {
  const EMAIL = process.env.GRADEPEN_EMAIL;
  const SENHA = process.env.GRADEPEN_PASSWORD;

  if (!EMAIL || !SENHA) {
    throw new Error('GRADEPEN_EMAIL e GRADEPEN_PASSWORD devem estar definidos');
  }

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

  const cookies = await page.context().cookies();
  const api = await request.newContext({
    baseURL: 'https://www.gradepen.com',
    extraHTTPHeaders: {
      'Accept': '*/*',
      'Referer': 'https://www.gradepen.com/p/avaliacoes.php',
      'Origin': 'https://www.gradepen.com'
    },
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

  return { api, page, browser };
}

async function run() {
  // 1) Ler a planilha (primeira aba)
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  // 2) Obter contexto de API/logado
  const { api, browser } = await createApiContext();

  // 3) Inserir as questões a partir da planilha
  await insertQuestions(api, rows);

  // 4) Fechar
  await api.dispose();
  await browser.close();
}

if (require.main === module) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { createApiContext, run };
