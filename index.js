const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const IG_USERNAME = process.env.IG_USERNAME;
const IG_PASSWORD = process.env.IG_PASSWORD;
const DM_MESSAGE = process.env.DM_MESSAGE || "yo can i ask you something about your brand";
const PORT = process.env.PORT || 3000;

let browser, context, page;
let dmCount = 0;
let lastResetDate = new Date().toDateString();

// Reset daily count
function checkDailyReset() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dmCount = 0;
    lastResetDate = today;
  }
}

// Random delay between min and max ms
function randomDelay(min, max) {
  return new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));
}

// Launch browser and log into Instagram
async function initBrowser() {
browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
});
context = await browser.newContext({
  proxy: {
    server: 'http://geo.iproyal.com:12321'
    username: 'c3qOeqSDpcjNgjjL',
    password: 'Q2XUJCLOB4ErchiM'
  },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 }
});
  
  page = await context.newPage();

  console.log('Logging into Instagram...');
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle' });
  await randomDelay(2000, 4000);
await page.waitForSelector('input[name="username"]', { timeout: 60000 });
  await page.fill('input[name="username"]', IG_USERNAME);
  await randomDelay(500, 1000);
  await page.fill('input[name="password"]', IG_PASSWORD);
  await randomDelay(500, 1000);
  await page.click('button[type="submit"]');
  await randomDelay(4000, 6000);

  // Dismiss save login info popup if shown
  const saveLoginBtn = page.locator('button:has-text("Not Now")');
  if (await saveLoginBtn.isVisible()) {
    await saveLoginBtn.click();
    await randomDelay(1500, 2500);
  }

  // Dismiss notifications popup if shown
  const notifBtn = page.locator('button:has-text("Not Now")');
  if (await notifBtn.isVisible()) {
    await notifBtn.click();
    await randomDelay(1500, 2500);
  }

  console.log('Logged in successfully');
}

// Send a DM to a specific username
async function sendDM(username) {
  try {
    console.log(`Navigating to profile: ${username}`);
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle' });
    await randomDelay(2000, 4000);

    // Click Message button
    const messageBtn = page.locator('div[role="button"]:has-text("Message")').first();
    if (!await messageBtn.isVisible()) {
      return { success: false, error: 'No Message button found — account may be private or not exist' };
    }

    await messageBtn.click();
    await randomDelay(3000, 5000);

    // Type the message
    const input = page.locator('div[aria-label="Message"]').first();
    await input.click();
    await randomDelay(500, 1000);
    await input.type(DM_MESSAGE, { delay: 50 + Math.random() * 50 });
    await randomDelay(1000, 2000);

    // Send
    await page.keyboard.press('Enter');
    await randomDelay(2000, 3000);

    console.log(`✅ DM sent to @${username}`);
    return { success: true, username };
  } catch (err) {
    console.error(`❌ Failed to DM @${username}:`, err.message);
    return { success: false, error: err.message };
  }
}

// POST /send-dm — called by n8n
app.post('/send-dm', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  checkDailyReset();

  if (dmCount >= 70) {
    return res.status(429).json({ error: 'Daily DM limit reached (70). Try again tomorrow.' });
  }

  if (!browser || !browser.isConnected()) {
    try {
      await initBrowser();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to init browser: ' + err.message });
    }
  }

  const result = await sendDM(username);

  if (result.success) {
    dmCount++;
    console.log(`DMs sent today: ${dmCount}/70`);
  }

  res.json({ ...result, dmsSentToday: dmCount });
});

// GET /status — health check for n8n / Railway
app.get('/status', (req, res) => {
  checkDailyReset();
  res.json({
    status: 'running',
    dmsSentToday: dmCount,
    dailyLimit: 70,
    remaining: 70 - dmCount,
    account: IG_USERNAME
  });
});

// Start server and init browser
app.listen(PORT, async () => {
  console.log(`Bot server running on port ${PORT}`);
  try {
    await initBrowser();
  } catch (err) {
    console.error('Browser init failed on startup:', err.message);
  }
});
