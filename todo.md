# TODO — docusaurus2pdf

Stav k 2026-06-12: dokončena velká oprava konverzní pipeline (10 commitů,
`c4c1221`…`ea74c27`). Testy: 140 passed. E2E ověřeno Docker kompilací
example-docusaurus (lualatex, 0 chybějících znaků, 0 LaTeX chyb).
Fixture se zátěžovými konstrukcemi: `example-docusaurus/docs/stress/edge-cases.md`.

## Zbývající mezery

### 1. i18n překlady se nenačítají (největší mezera)
- `SiteLoader.loadPagesFromDir` čte jen `docs/`, nikdy
  `i18n/<locale>/docusaurus-plugin-content-docs/current/...`
- `renderPerLanguage` (výchozí režim) tak reálně exportuje jen výchozí jazyk;
  detekce jazyka v `detectLanguage()` běží naprázdno
- Plán: načíst i18n stromy per locale, spárovat s výchozími dokumenty
  (stejná relativní cesta), použít sidebar struktura výchozího jazyka

### 2. Lettered listy ztrácejí písmena
- `a. b. c.` se převádí na `1. 2. 3.` (preprocessing → markdown numbered list)
- Plán: `\usepackage{enumitem}` + označit takový list a vyrenderovat
  `\begin{enumerate}[label=\alph*)]`

### 3. Zvýraznění řádků kódu se zahazuje
- Docusaurus meta `{1,3-5}` a `// highlight-next-line` nemají v listings
  ekvivalent — řádky se vykreslí bez zvýraznění
- Možnost: fvextra `highlightlines` (umí to!) — zvážit přepnutí všech code
  blocků z listings na fvextra + vlastní jednoduché zvýraznění klíčových slov,
  nebo ponechat degradaci

### 4. Engine parity
- Primárně laděný je lualatex (výchozí): font fallbacky (DejaVu, Twemoji),
  emoji balíček
- xelatex: chybí fallback fonty (box-drawing znaky zmizí); pdflatex: unicode
  v kódu mimo Latin-2 spadne — zvážit alespoň dokumentovat omezení v README

### 5. Drobnosti / nice-to-have
- Tabs se vykreslují sekvenčně pod sebou (`**Label:** obsah`) — možná pěknější
  vizuální oddělení (tcolorbox per tab?)
- Frontmatter → PDF metadata (`\hypersetup{pdftitle,...}`) — kód v
  `preamble.ts` existuje, ale renderer `frontmatter` nikdy nepředá; stejně tak
  `Author`/`Date` na titulní straně
- `<dl>/<dt>/<dd>` HTML fallback cesta (mimo MDX) není pokrytá testem
- Mermaid/PlantUML: při selhání generování vyrenderovat zdrojový kód diagramu
  jako listing (teď se ukáže placeholder „missing image")
- README aktualizovat: nové chování (pořadí dle sidebaru, cross-doc odkazy,
  `--skip-diagrams`, math gating dle konfigurace webu)
- Zvážit `latexmk` místo dvou ručních průchodů (stabilnější reference/ToC)
- `-shell-escape` při kompilaci je zbytečně silný — stačí restricted
  (epstopdf funguje i tak)

## Jak ověřovat
```bash
npx vitest run                                  # unit testy
npx tsx src/cli.ts -i example-docusaurus -o /tmp/d2pdf-test   # e2e (Docker)
# v logu: grep -c 'Missing character' …/documentation_en.log  → má být 0
```
