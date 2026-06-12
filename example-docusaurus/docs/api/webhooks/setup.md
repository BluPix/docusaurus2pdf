---
title: Webhook Setup
sidebar_position: 1
---

# Webhook Setup

Webhooks allow real-time notifications when events occur in your account.

## Creating a Webhook

```http
POST /v1/webhooks
```

Request body:

```json
{
  "url": "https://your-app.com/webhooks",
  "events": ["user.created", "user.updated"],
  "secret": "your-webhook-secret"
}
```

Response:

```json
{
  "id": "wh_123456",
  "url": "https://your-app.com/webhooks",
  "events": ["user.created", "user.updated"],
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z"
}
```

:::tip
Always use HTTPS URLs for webhooks to ensure secure communication.
:::

## Webhook Security

### Signature Verification

Each webhook includes a signature header:

```
X-Webhook-Signature: sha256=<hex_signature>
```

Verify the signature in your handler:

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

### IP Whitelist

Webhook requests originate from these IPs:

```
203.0.113.10
203.0.113.11
203.0.113.12
```

## Retry Policy

Failed webhooks are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 5 seconds |
| 3 | 25 seconds |
| 4 | 2 minutes |
| 5 | 10 minutes |

Webhooks that fail 5 times are automatically disabled.

:::warning
Respond with 2xx status code within 30 seconds, or the webhook will be retried.
:::

## Testing Webhooks

Use the test endpoint to send a sample payload:

```http
POST /v1/webhooks/:id/test
```

This sends a test event to your endpoint without affecting live data.
