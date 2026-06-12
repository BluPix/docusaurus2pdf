---
title: Installation
sidebar_position: 1
---

# Installation

## Prerequisites

Before installing, ensure you have:

- **Go 1.21+**: Required for building the converter
- **Docker**: For LaTeX compilation
- **Git**: For cloning the repository

## Quick Install

```bash
git clone https://github.com/example/docusaurus2pdf.git
cd docusaurus2pdf
go build -o docusaurus2pdf ./cmd/main.go
```

## Docker Setup

Build the LaTeX images:

```bash
./docker/build.sh build-images
```

This creates two Docker images:

1. `docusaurus2pdf-tectonic` - Fast, modern LaTeX engine
2. `docusaurus2pdf-texlive` - Full TeX Live distribution

:::tip
Tectonic is recommended for faster builds. Use TeX Live only if you need specific packages not included in Tectonic.
:::

## Verification

Test the installation:

```bash
./docusaurus2pdf --help
```

Expected output shows available commands and options.
