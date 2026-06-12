---
title: Webhook Events
sidebar_position: 2
---

# Webhook Events

## Available Events

### User Events

| Event | Description |
|-------|-------------|
| `user.created` | New user registered |
| `user.updated` | User profile modified |
| `user.deleted` | User account removed |
| `user.login` | User signed in |

### Resource Events

| Event | Description |
|-------|-------------|
| `resource.created` | New resource created |
| `resource.updated` | Resource modified |
| `resource.deleted` | Resource removed |
| `resource.shared` | Resource shared with user |

### System Events

| Event | Description |
|-------|-------------|
| `api.key.created` | New API key generated |
| `webhook.failed` | Webhook delivery failed |
| `export.completed` | Data export finished |

## Event Payloads

### user.created

```json
{
  "event": "user.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### resource.updated

```json
{
  "event": "resource.updated",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "id": 456,
    "name": "Updated Project",
    "changes": {
      "name": {
        "from": "Old Name",
        "to": "Updated Project"
      }
    }
  }
}
```

:::tip
The `changes` field shows only modified fields, making it easy to track what changed.
:::

## Filtering Events

Subscribe to specific events:

```http
POST /v1/webhooks
```

```json
{
  "url": "https://your-app.com/webhooks",
  "events": ["user.created", "user.updated"],
  "filter": {
    "user.role": "admin"
  }
}
```

## Event Delivery

### Guaranteed Delivery

- Events are queued for up to 24 hours
- Failed deliveries are retried up to 5 times
- Dead letter queue for failed events

### Ordering

Events are delivered in order per resource:

```
resource.updated (id: 123) at 10:30:00
resource.updated (id: 123) at 10:30:05
resource.deleted (id: 123) at 10:30:10
```

:::warning
Events for different resources may arrive out of order. Use timestamps for ordering.
:::

## Rate Limiting

Webhooks have a rate limit of 1000 events per minute per endpoint. Excess events are queued and delivered when the rate limit resets.
