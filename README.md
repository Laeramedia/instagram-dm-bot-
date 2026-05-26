# Instagram DM Bot

Playwright-powered Instagram DM bot. Runs as an Express server on Railway, called by n8n.

## Setup

### 1. Environment Variables (set these in Railway)
```
IG_USERNAME=your_instagram_username
IG_PASSWORD=your_instagram_password
DM_MESSAGE=yo can i ask you something about your brand
PORT=3000
```

### 2. Deploy to Railway
- Push this repo to GitHub
- Connect repo to Railway
- Add environment variables in Railway dashboard
- Railway auto-deploys via Dockerfile

## API Endpoints

### POST /send-dm
Called by n8n to send a DM to a username.

**Request:**
```json
{ "username": "brandusername" }
```

**Response:**
```json
{ "success": true, "username": "brandusername", "dmsSentToday": 12 }
```

### GET /status
Health check — see how many DMs sent today.

**Response:**
```json
{
  "status": "running",
  "dmsSentToday": 12,
  "dailyLimit": 45,
  "remaining": 33,
  "account": "your_username"
}
```

## Limits
- Capped at 45 DMs/day automatically
- Random delays between actions to mimic human behavior
- Resets daily
