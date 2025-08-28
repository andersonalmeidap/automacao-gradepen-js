// scripts/automacao-gradepen.js
// Provides a helper to login and return a request context for the GradePen API.

const { chromium, request } = require('playwright');

// Credenciais (pode mover para .env se quiser)
const EMAIL = 'anderson.almeidap@outlook.com';
const SENHA = 'Cad09025.';

async function getApiContext() {
  // 1) Abrir navegador e logar para obter cookies de sessão
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

  // 2) Criar um API client com os cookies de sessão
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

  return { api, browser, page };
}

module.exports = { getApiContext };
