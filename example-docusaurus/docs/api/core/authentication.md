---
title: Authentication
sidebar_position: 1
---

# Authentication

## API Keys

Generate API keys from your dashboard:

1. Log in to the dashboard
2. Navigate to Settings → API Keys
3. Click "Generate New Key"
4. Copy and store securely

## Bearer Token

Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer sk_live_12345" \
  https://api.example.com/v1/data
```

:::danger
Never expose API keys in client-side code or public repositories.
:::

## OAuth 2.0

For user authentication, we support OAuth 2.0:

```http
GET https://api.example.com/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &response_type=code
  &redirect_uri=https://your-app.com/callback
  &scope=read write
```

### Token Exchange

```bash
curl -X POST https://api.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_SECRET" \
  -d "code=AUTH_CODE"
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "def50200..."
}
```

## Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read access to resources |
| `write` | Create and modify resources |
| `admin` | Administrative operations |
| `webhook` | Manage webhooks |
