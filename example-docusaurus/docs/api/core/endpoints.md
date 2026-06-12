---
title: Endpoints
sidebar_position: 2
---

# API Endpoints

## Users

### List Users

```http
GET /v1/users
```

Query parameters:

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (max: 100) |
| `search` | string | Search query |

Response:

```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 20
  }
}
```

### Create User

```http
POST /v1/users
```

Request body:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "user"
}
```

:::tip
Use the `role` field to assign permissions at creation time.
:::

## Resources

### Get Resource

```http
GET /v1/resources/:id
```

Response includes related data:

```json
{
  "id": 123,
  "name": "Project Alpha",
  "owner": {
    "id": 1,
    "name": "John Doe"
  },
  "metadata": {
    "tags": ["important", "active"],
    "priority": "high"
  }
}
```

### Update Resource

```http
PATCH /v1/resources/:id
```

Partial updates are supported:

```json
{
  "name": "New Name",
  "metadata": {
    "priority": "low"
  }
}
```

### Delete Resource

```http
DELETE /v1/resources/:id
```

:::danger
Deletion is permanent. Use archive endpoint for soft deletes.
:::

## Search

Full-text search across resources:

```http
GET /v1/search?q=keyword&filters[type]=document
```

```bash
curl "https://api.example.com/v1/search?q=quarterly+report" \
  -H "Authorization: Bearer TOKEN"
```
