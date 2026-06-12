---
title: Deployment
sidebar_position: 2
---

# Deployment

## CI/CD Integration

### GitHub Actions

```yaml
name: Build PDF Documentation

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'sidebars.ts'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Build Converter
        run: go build -o docusaurus2pdf ./cmd/main.go
      
      - name: Build Docker Images
        run: ./docker/build.sh build-images
      
      - name: Generate PDFs
        run: |
          ./docker/build.sh convert \
            -i ./docs \
            -o ./pdfs \
            -m per-section
      
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: documentation-pdfs
          path: ./pdfs/*.pdf
```

### GitLab CI

```yaml
build-pdfs:
  image: golang:1.21
  stages:
    - build
  script:
    - go build -o docusaurus2pdf ./cmd/main.go
    - ./docker/build.sh build-images
    - ./docker/build.sh convert -i ./docs -o ./pdfs
  artifacts:
    paths:
      - pdfs/*.pdf
```

## Distribution

### S3 Upload

```bash
aws s3 sync ./output s3://my-bucket/docs/
```

### GitHub Releases

```bash
gh release upload v1.0.0 ./output/*.pdf
```

:::warning
Ensure PDFs don't contain sensitive information before public distribution.
:::

## Automation Tips

1. **Schedule builds**: Run nightly to catch documentation drift
2. **Size limits**: Large PDFs may need compression
3. **Versioning**: Include version numbers in PDF filenames

```bash
VERSION=$(git describe --tags)
./docusaurus2pdf -o "./output/docs-${VERSION}.pdf"
```
