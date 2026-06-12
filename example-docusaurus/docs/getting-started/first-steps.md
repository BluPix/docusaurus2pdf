---
title: First Steps
sidebar_position: 3
---

# First Steps

## Converting Your First Document

### Single PDF Mode

Generate one PDF containing all documentation:

```bash
./docusaurus2pdf \
  --input ./my-docs \
  --output ./output \
  --mode single
```

Output: `./output/documentation.pdf`

### Per-Section Mode

Generate separate PDFs for each category:

```bash
./docusaurus2pdf \
  --input ./my-docs \
  --output ./output \
  --mode per-section
```

Output: Multiple PDFs like `tutorial.pdf`, `api.pdf`

## Advanced Usage

### Engine Selection

Choose your LaTeX engine:

```bash
# Fast, modern (default)
./docusaurus2pdf -e tectonic ...

# Full compatibility
./docusaurus2pdf -e pdflatex ...
```

### Using Docker Scripts

For convenience, use the build script:

```bash
./docker/build.sh convert \
  -i ./example-docusaurus \
  -o ./output \
  -m per-section \
  -e tectonic
```

:::note
The build script automatically handles Docker container management.
:::

## Troubleshooting

### Common Issues

1. **"Cannot find sidebars"**: Ensure `sidebars.ts` or `sidebars.js` exists
2. **"Docker not found"**: Install Docker and ensure the daemon is running
3. **PDF build fails**: Check LaTeX errors in the `.log` files

### Debug Mode

Enable verbose output:

```bash
./docusaurus2pdf --verbose ...
```
