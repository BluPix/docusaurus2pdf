---
title: Zátěžový test konverze
---

# Zátěžový test konverze

Tato stránka schválně obsahuje konstrukce, na kterých konverze dříve padala
nebo tiše ztrácela obsah.

## Úvod do systému

Odkaz na [tento nadpis](#úvod-do-systému) s diakritikou a na
[vlastní kotvu](#vlastni-kotva). Cena je $5 a sleva $10 za kus.

## Vlastní kotvy {#vlastni-kotva}

Text před obrázkem ![ikona](../img/logo.png) a důležitý text za ním.

Český text s 5 jablky a v lese u potoka.

## Tabulky

| Vlevo | Na střed | Vpravo |
|:------|:--------:|-------:|
| a     | b        | c      |
| delší text, který se musí zalomit uvnitř buňky tabulky | _kurzíva_ | **tučné** |

## Kód

```bash
# install dependencies
npm install
a) tohle není seznam
x = 5
```

```js title="utils/foo_bar.js [v2], hlavní" showLineNumbers
const velmiDlouhyNazevPromenneKteryPresahujeSirkuStranky = computeSomething(parametrJedna, parametrDva, parametrTri);
```

```text
projekt/
├── docs/
│   ├── intro.md
│   └── guide.md
└── static/
```

## Admonice

:::warning[Pozor, důležité!]
Titulek s čárkou nesmí rozbít kompilaci.
:::

:::caution
Zastaralý alias musí fungovat.
:::

## Různé

Postup:

a. první krok
b. druhý krok
c. třetí krok

- [x] hotový úkol
- [ ] nehotový úkol

Toto je ~~škrtnuté~~, H<sub>2</sub>O, E=mc<sup>2</sup>, stiskni <kbd>Ctrl</kbd>+<kbd>C</kbd>.

<img src="../img/logo.png" alt="Logo" width="120" />

<details>
<summary>Detaily, s čárkou v titulku</summary>

Skrytý obsah s **tučným** textem.

</details>

> Citace s odstavcem.
>
> - položka 1
> - položka 2

Referenční odkaz na [dokumentaci][docs] a obrázek ![logo][logo-img].

[docs]: https://example.com/docs
[logo-img]: ../img/logo.png

---

Viz také [úvodní stránka](../intro.md) a [instalace](/docs/getting-started/installation#quick-install).
