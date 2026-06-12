---
title: Instalace
sidebar_position: 2
---

# Instalace

## Předpoklady

Před instalací se ujistěte, že máte:

- **Go 1.21+**: Vyžadováno pro sestavení konvertoru
- **Docker**: Pro kompilaci LaTeXu
- **Git**: Pro klonování repozitáře

## Rychlá instalace

```bash
git clone https://github.com/example/docusaurus2pdf.git
cd docusaurus2pdf
go build -o docusaurus2pdf ./cmd/main.go
```

## Nastavení Dockeru

Sestavte LaTeX obrazy:

```bash
./docker/build.sh build-images
```

Tím se vytvoří dva Docker obrazy:

1. `docusaurus2pdf-tectonic` - Rychlý, moderní LaTeX engine
2. `docusaurus2pdf-texlive` - Plná TeX Live distribuce

:::tip
Tectonic je doporučen pro rychlejší sestavení. Použijte TeX Live pouze pokud potřebujete specifické balíčky.
:::

## Ověření

Otestujte instalaci:

```bash
./docusaurus2pdf --help
```

Očekávaný výstup zobrazí dostupné příkazy a možnosti.

## Česká lokalizace

Pro české PDF je automaticky použit balíček `vlna`, který zajišťuje správné nedělitelné mezery před jednopísmenovými předložkami a spojkami.

To znamená, že v českém PDF uvidíte správně:
- "v Praze" (ne "v~Praze")
- "k moři" (s nedělitelnou mezerou)
- "a proto" (s nedělitelnou mezerou)

LaTeX se o to postará automaticky!
