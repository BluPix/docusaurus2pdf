---
title: Errors
sidebar_position: 3
---

# Error Handling

## Error Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request failed validation",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## Error Codes

### Client Errors (4xx)

| Code | HTTP | Description |
|------|------|-------------|
| `BAD_REQUEST` | 400 | Malformed request |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `RATE_LIMITED` | 429 | Too many requests |

### Server Errors (5xx)

| Code | HTTP | Description |
|------|------|-------------|
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Temporary maintenance |

## Handling Errors

Example error handling in Python:

```python
import requests

def api_call():
    try:
        response = requests.get(
            'https://api.example.com/v1/users',
            headers={'Authorization': 'Bearer TOKEN'}
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        error_data = e.response.json()
        
        if error_data['error']['code'] == 'RATE_LIMITED':
            retry_after = e.response.headers.get('Retry-After', 60)
            time.sleep(retry_after)
            return api_call()  # Retry
        
        if error_data['error']['code'] == 'UNAUTHORIZED':
            refresh_token()
            return api_call()  # Retry with new token
            
        raise APIError(error_data['error']['message'])
```

## Validation Errors

When validation fails, detailed field-level errors are provided:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "password",
        "message": "Must be at least 8 characters"
      },
      {
        "field": "email",
        "message": "Already registered"
      }
    ]
  }
}
```

:::note
Validation errors return HTTP 422, not 400.
:::

## Rate Limiting

When rate limited:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again in 60 seconds."
  }
}
```

Headers indicate when you can retry:

```
Retry-After: 60
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
```
