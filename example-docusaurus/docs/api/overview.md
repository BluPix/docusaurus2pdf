---
title: API Overview
sidebar_position: 1
---

# API Overview

Our REST API provides programmatic access to all features. Base URL:

```
https://api.example.com/v1
```

## Authentication

All API requests require authentication via Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.example.com/v1/users
```

## Response Format

All responses are JSON:

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Example"
  },
  "meta": {
    "page": 1,
    "per_page": 20
  }
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

## Rate Limiting

:::warning
API is rate limited to 1000 requests per hour per API key.
:::

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```
