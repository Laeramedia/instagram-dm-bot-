const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const IG_USERNAME = process.env.IG_USERNAME;
const DM_MESSAGE = process.env.DM_MESSAGE || "yo can i ask you something about your brand";
const PORT = process.env.PORT || 3000;

let browser, context, page;
let dmCount = 0;
let lastResetDate = new Date().toDateString();

function checkDailyReset() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dmCount = 0;
    lastResetDate = today;
  }
}

function randomDelay(min, max) {
  return new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function initBrowser() {
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });
  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  const cookies = process.env.IG_COOKIES;
  if (cookies) {
    const cookieArray = cookies.split(';').map(c => {
      const [name, ...rest] = c.trim().split('=');
      return { name: name.trim(), value: rest.join('=').trim(), domain: '.instagram.com', path: '/' };
    }).filter(c => c.name);
    await context.addCookies(cookieArray);
  }

  page = await context.newPage();
  console.log('Browser initialized with cookies');
}

async function sendDM(username) {
  try {
    console.log(`Navigating to profile: ${username}`);
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await randomDelay(3000, 5000);

    const messageBtn = page.locator('text=Message').first();
    const visible = await messageBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!visible) {
      return { success: false, error: 'No Message button found' };
    }

    await messageBtn.click();
    await randomDelay(3000, 5000);

    const input = page.locator('div[aria-label="Message"]').first();
    await input.click();
    await randomDelay(500, 1000);
    await input.type(DM_MESSAGE, { delay: 50 + Math.random() * 50 });
    await randomDelay(1000, 2000);

    await page.keyboard.press('Enter');
    await randomDelay(2000, 3000);

    console.log(`DM sent to @${username}`);
    return { success: true, username };
  } catch (err) {
    console.error(`Failed to DM @${username}:`, err.message);
    return { success: false, error: err.message };
  }
}

app.post('/send-dm', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  checkDailyReset();
  if (dmCount >= 70) return res.status(429).json({ error: 'Daily DM limit reached (70). Try again tomorrow.' });
  if (!browser || !browser.isConnected()) {
    try { await initBrowser(); } catch (err) { return res.status(500).json({ error: 'Failed to init browser: ' + err.message }); }
  }
  const result = await sendDM(username);
  if (result.success) { dmCount++; console.log(`DMs sent today: ${dmCount}/70`); }
  res.json({ ...result, dmsSentToday: dmCount });
});

app.get('/status', (req, res) => {
  checkDailyReset();
  res.json({ status: 'running', dmsSentToday: dmCount, dailyLimit: 70, remaining: 70 - dmCount, account: IG_USERNAME });
});

app.listen(PORT, async () => {
  console.log(`Bot server running on port ${PORT}`);
  try { await initBrowser(); } catch (err) { console.error('Browser init failed on startup:', err.message); }
});
