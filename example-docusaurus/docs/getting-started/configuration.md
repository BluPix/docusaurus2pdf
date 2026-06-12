---
title: Configuration
sidebar_position: 2
---

# Configuration

## Docusaurus Structure

The converter expects a standard Docusaurus project structure:

```
my-docs/
├── docs/
│   ├── intro.md
│   ├── tutorial/
│   │   ├── part1.md
│   │   └── part2.md
│   └── api/
│       └── reference.md
├── sidebars.ts
└── docusaurus.config.ts
```

## Frontmatter

The converter reads frontmatter for metadata:

```yaml
---
title: Page Title
sidebar_position: 1
---
```

### Supported Fields

| Field | Description | Used In PDF |
|-------|-------------|-------------|
| `title` | Page title | ✓ Section heading |
| `sidebar_position` | Order in sidebar | ✗ Ignored |
| `description` | Meta description | ✗ Ignored |

:::warning
Custom frontmatter fields beyond these may be silently ignored.
:::

## Sidebars

The converter supports both `sidebars.ts` and `sidebars.js` formats. For JSON-based sidebars, use `sidebars.json`.

### Example Sidebar

```typescript
const sidebars = {
  tutorial: [
    'intro',
    {
      type: 'category',
      label: 'Advanced',
      items: ['advanced/config', 'advanced/deploy'],
    },
  ],
};
```
