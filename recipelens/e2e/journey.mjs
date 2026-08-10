/**
 * Browser end-to-end test of the whole product.
 *
 * It boots the real API server (serving the real production build of the web
 * client) plus a local OpenAI-compatible stand-in for the model, then drives
 * Chromium through the journey from the brief: sign up → import → view → edit
 * → rescale → favourite → shopping list → cook → refresh → sign out → sign in.
 *
 * Run:  npm run e2e        (from recipelens/)
 * Requires: `npm run build` to have produced web/dist.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const screenshotDir = path.join(here, 'screenshots');
const dbFile = path.join(here, '.tmp', `e2e-${Date.now()}.db`);
const CHROME = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';

const results = [];
let failures = 0;

function check(name, condition, detail = '') {
  const line = condition ? `  ✓ ${name}` : `  ✗ ${name}${detail ? ` — ${detail}` : ''}`;
  if (!condition) failures += 1;
  results.push(line);
  console.log(line);
}

/** Visibility with auto-wait — the UI is asynchronous, so never sample it raw. */
async function visible(locator, timeout = 10000) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

async function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function startProcess(command, args, options) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  child.stdout.on('data', (data) => process.env.E2E_VERBOSE && process.stdout.write(`[${options.label}] ${data}`));
  child.stderr.on('data', (data) => process.env.E2E_VERBOSE && process.stderr.write(`[${options.label}] ${data}`));
  return child;
}

const RECIPE_TEXT = `Creamy garlic pasta for two.
Ingredients: 200 g spaghetti, 3 cloves of garlic, a splash of cream, parmesan, olive oil, salt to taste, chili flakes.
Method: boil the spaghetti until al dente, fry the sliced garlic in olive oil, pour in the cream with the parmesan and simmer, then toss the pasta through the sauce and serve.`;

async function main() {
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(path.dirname(dbFile), { recursive: true });

  // 1. Stand-in model provider.
  const mockAi = startProcess('node', ['scripts/mock-ai-provider.mjs', '0'], { cwd: root, label: 'ai' });
  const aiBaseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mock AI did not start')), 10000);
    mockAi.stdout.on('data', (data) => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:(\d+)\/v1/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
  });

  // 2. The real server, serving the real production build.
  const port = 4310 + Math.floor(Math.random() * 200);
  const server = startProcess('npm', ['--workspace', 'server', 'run', 'start'], {
    cwd: root,
    label: 'server',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(port),
      DATABASE_URL: `file:${dbFile}`,
      SESSION_SECRET: 'e2e-session-secret-that-is-long-enough-0123456789',
      AI_API_KEY: 'local-e2e-key',
      AI_API_BASE_URL: aiBaseUrl,
      AI_MODEL: 'mock-recipe-model',
      WEB_ORIGIN: `http://localhost:${port}`,
    },
  });

  const base = `http://localhost:${port}`;
  await waitForHttp(`${base}/api/health`);

  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  const email = `e2e-${Date.now()}@example.test`;
  const password = 'a-long-enough-password';

  try {
    /* ---- 1. Unauthenticated visitors are sent to sign-in -------------- */
    await page.goto(base);
    await page.waitForURL('**/sign-in');
    check('unauthenticated visit redirects to sign-in', page.url().includes('/sign-in'));
    await page.screenshot({ path: path.join(screenshotDir, '01-sign-in.png') });

    /* ---- 2. Create an account ---------------------------------------- */
    await page.getByRole('link', { name: /create an account/i }).click();
    await page.getByLabel('Name').fill('E2E Cook');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(`${base}/`);
    check('account creation signs the user in', await visible(page.getByText(/hi, e2e cook/i)));

    /* ---- 3. Empty state ---------------------------------------------- */
    check('empty library shows a call to action', await visible(page.getByText(/no recipes yet/i)));
    await page.screenshot({ path: path.join(screenshotDir, '02-empty-home.png') });

    /* ---- 4. Import a recipe through the AI pipeline -------------------- */
    await page.getByRole('link', { name: 'Import', exact: true }).click();
    await page.getByRole('tab', { name: 'Text' }).click();
    await page.getByLabel(/paste the recipe/i).fill(RECIPE_TEXT);
    await page.screenshot({ path: path.join(screenshotDir, '03-import.png') });
    await page.getByRole('button', { name: /analyze recipe/i }).click();

    await page.getByRole('button', { name: /open recipe/i }).waitFor({ timeout: 30000 });
    check('import returns a recipe from the analysis pipeline', await visible(page.getByRole('heading', { name: 'Creamy Garlic Pasta' })));
    await page.screenshot({ path: path.join(screenshotDir, '04-import-result.png') });

    /* ---- 5. View the recipe ------------------------------------------ */
    await page.getByRole('button', { name: /open recipe/i }).click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]+$/);
    const recipeUrl = page.url();
    check('stored amounts are shown', await visible(page.getByText('200 g')));
    check('AI estimates are marked in the UI', await visible(page.locator('[title*="Estimated by AI"]')));
    check('an ingredient with no stated amount is not invented', await visible(page.getByText('no amount given').first()));
    await page.screenshot({ path: path.join(screenshotDir, '05-recipe.png'), fullPage: true });

    /* ---- 6. Scale the servings --------------------------------------- */
    await page.getByRole('button', { name: /more servings/i }).click();
    await page.getByRole('button', { name: /more servings/i }).click();
    check('2 → 4 servings doubles the pasta', await visible(page.getByText('400 g')));
    check('2 → 4 servings doubles the cream', await visible(page.getByText('300 ml')));
    await page.getByRole('button', { name: /fewer servings/i }).click();
    await page.getByRole('button', { name: /fewer servings/i }).click();
    await page.getByRole('button', { name: /fewer servings/i }).click();
    check('4 → 1 serving quarters the pasta', await visible(page.getByText('100 g')));
    await page.getByRole('button', { name: /more servings/i }).click();
    await page.getByRole('button', { name: /more servings/i }).click();
    await page.getByRole('button', { name: /more servings/i }).click();

    /* ---- 7. Favourite it --------------------------------------------- */
    await page.getByRole('button', { name: /add to favorites/i }).click();
    await page.getByRole('button', { name: /remove from favorites/i }).waitFor();
    check('favourite toggles', true);

    /* ---- 8. Add the scaled ingredients to the shopping list ------------ */
    await page.getByRole('button', { name: /add to shopping list/i }).click();
    await page.getByText(/added \d+ item/i).waitFor();
    check('ingredients reach the shopping list', true);

    /* ---- 9. Edit an ingredient --------------------------------------- */
    await page.getByRole('link', { name: /^edit$/i }).click();
    await page.waitForURL(/\/edit$/);
    const creamAmount = page.getByLabel('Ingredient 3 amount');
    await creamAmount.fill('250');
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]+$/);
    check('edited amount is stored', await visible(page.getByText('250 ml')));
    await page.screenshot({ path: path.join(screenshotDir, '06-edited.png'), fullPage: true });

    /* ---- 9b. Assistant: nutrition, substitutions, chat ------------------ */
    await page.getByRole('button', { name: /estimate with ai/i }).click();
    check('nutrition estimate arrives and is labelled', await visible(page.getByText(/not a verified nutritional analysis/i), 20000));
    check('nutrition numbers are rendered', await visible(page.getByText('612kcal')));

    await page.getByRole('button', { name: /replace heavy cream/i }).click();
    await page.getByRole('button', { name: /suggest replacements/i }).click();
    check('a substitution is suggested for the right ingredient', await visible(page.getByText('Greek yoghurt'), 20000));
    check('the substitution explains the trade-off', await visible(page.getByText(/splits if boiled/i)));
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('textbox', { name: /your question/i }).fill('Can I use evaporated milk?');
    await page.getByRole('button', { name: /send question/i }).click();
    check('the assistant answers about this recipe', await visible(page.getByText(/evaporated milk/i), 20000));

    /* ---- 10. Cooking mode + refresh ----------------------------------- */
    await page.getByRole('link', { name: /start cooking/i }).click();
    await page.waitForURL(/\/cook$/);
    check('cooking mode opens on step 1', await visible(page.getByText(/step 1 of 4/i)));
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();
    check('navigating steps works', await visible(page.getByText(/step 3 of 4/i)));
    await page.screenshot({ path: path.join(screenshotDir, '07-cooking.png'), fullPage: true });

    await page.waitForTimeout(700); // let the debounced save reach the server
    await page.reload();
    await page.getByText(/step 3 of 4/i).waitFor();
    check('progress survives a refresh', true);

    /* ---- 11. Shopping list ------------------------------------------- */
    await page.getByRole('link', { name: /leave cooking mode/i }).click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]+$/);
    await page.getByRole('link', { name: 'Shopping', exact: true }).click();
    await page.waitForURL(/\/shopping$/);
    check('shopping list contains the scaled amount', await visible(page.getByText('400 g')));

    await page.getByLabel('Item name').fill('parchment paper');
    await page.getByRole('button', { name: /add item/i }).click();
    await page.getByText('parchment paper').waitFor();
    check('manual items can be added', true);

    await page.getByRole('checkbox', { name: /check spaghetti/i }).click();
    await page.waitForTimeout(300);
    await page.reload();
    const checkedAfterReload = await visible(page.getByRole('checkbox', { name: /uncheck spaghetti/i }));
    check('ticking an item persists', checkedAfterReload);
    await page.screenshot({ path: path.join(screenshotDir, '08-shopping.png'), fullPage: true });

    /* ---- 12. Sign out and back in ------------------------------------- */
    await page.goto(`${base}/settings`);
    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL('**/sign-in');
    check('sign out returns to the sign-in screen', true);

    await page.goto(recipeUrl);
    await page.waitForURL('**/sign-in');
    check('a signed-out visitor cannot open a recipe', true);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(`${base}/`);

    await page.goto(recipeUrl);
    await page.getByRole('heading', { name: 'Creamy Garlic Pasta' }).waitFor();
    check('data is still there after signing back in', await visible(page.getByText('250 ml')));

    await page.getByRole('link', { name: 'Shopping', exact: true }).click();
    await page.getByText('parchment paper').waitFor();
    check('the shopping list is still there after signing back in', true);
    await page.screenshot({ path: path.join(screenshotDir, '09-after-relogin.png'), fullPage: true });

    /* ---- 13. Error handling in the browser ---------------------------- */
    await page.getByRole('link', { name: 'Import', exact: true }).click();
    await page.getByRole('tab', { name: 'Link' }).click();
    await page.getByLabel(/recipe or video link/i).fill('not-a-link');
    await page.getByRole('button', { name: /analyze recipe/i }).click();
    check('client-side validation catches a malformed link', await visible(page.getByText(/does not look like a link/i)));

    await page.getByLabel(/recipe or video link/i).fill('https://recipelens-does-not-exist.invalid/x');
    await page.getByRole('button', { name: /analyze recipe/i }).click();
    await page.getByRole('alert').waitFor({ timeout: 30000 });
    const alertText = (await page.getByRole('alert').innerText()).toLowerCase();
    check('an unreachable source shows a useful error with fallbacks', alertText.includes('paste the recipe text'), alertText.slice(0, 120));
    await page.screenshot({ path: path.join(screenshotDir, '10-import-error.png'), fullPage: true });

    /* ---- 14. Console hygiene ------------------------------------------ */
    const realErrors = consoleErrors.filter(
      (text) => !/Failed to load resource: the server responded with a status of (4\d\d|5\d\d)/i.test(text),
    );
    check('no unexpected console errors', realErrors.length === 0, realErrors.join(' | ').slice(0, 300));
  } finally {
    await browser.close();
    server.kill('SIGTERM');
    mockAi.kill('SIGTERM');
    try {
      rmSync(path.dirname(dbFile), { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }

  console.log('\nBrowser end-to-end results:');
  console.log(results.join('\n'));
  console.log(`\n${results.length - failures}/${results.length} checks passed. Screenshots: ${screenshotDir}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('E2E run failed:', error);
  process.exit(1);
});
