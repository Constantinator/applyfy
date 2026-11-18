# Polices du CV Builder

Fichiers TTF (graisses 400 et 700, romain et italique) intégrés aux PDF générés et utilisés par
l'aperçu de l'éditeur. Gelasio, Arimo, Tinos, Carlito, Caladea et EB Garamond servent aussi aux
polices de l'éditeur du CV d'une candidature (src/lib/cv-fonts.ts).

## Polices des réglages du CV (6 familles)

Toutes sous SIL Open Font License 1.1. Le texte exact de la licence et la mention de copyright de
chaque famille sont dans ce dossier, à côté des fichiers servis (`OFL-<famille>.txt`), tels que
publiés par l'amont. Vérifié le 18/11/2026.

| Fichiers | Police | Version | Licence | Texte | Source des fichiers |
| --- | --- | --- | --- | --- | --- |
| arimo-* | Arimo (proportions d'Arial) | 1.33 | OFL 1.1 | OFL-arimo.txt | github.com/googlefonts/arimo, `fonts/ttf` (commit 4a6255f) |
| carlito-* | Carlito (proportions de Calibri) | 1.104 | OFL 1.1, nom réservé « Carlito » | OFL-carlito.txt | github.com/google/fonts, `ofl/carlito` (commit 605c9f2) |
| tinos-* | Tinos (proportions de Times New Roman) | 1.340 | OFL 1.1 | OFL-tinos.txt | fonts.gstatic.com (Google Fonts, tinos v26) |
| caladea-* | Caladea (proportions de Cambria) | 1.001 | OFL 1.1 | OFL-caladea.txt | fonts.gstatic.com (Google Fonts, caladea v10) |
| gelasio-* | Gelasio (proportions de Georgia) | 1.008 | OFL 1.1 | OFL-gelasio.txt | fonts.gstatic.com (Google Fonts, gelasio v14) |
| eb-garamond-* | EB Garamond | 1.003 | OFL 1.1 | OFL-eb-garamond.txt | fonts.gstatic.com (Google Fonts, ebgaramond v33) |

Origine des textes de licence : `OFL.txt` de github.com/google/fonts (`ofl/carlito`, `ofl/caladea`,
`ofl/gelasio`, `ofl/ebgaramond`), de github.com/googlefonts/arimo et de github.com/googlefonts/tinos
(google/fonts ne publie pas de `OFL.txt` pour Tinos, mais déclare la famille sous OFL).

Arimo, Tinos et Caladea ne sont plus sous Apache License 2.0 : l'amont les publie sous OFL 1.1.
Le fichier OFL d'Arimo porte « Copyright 2026 » ; les fichiers de police, eux, contiennent
« Copyright 2020 The Arimo Project Authors » (version 1.33).

### Arimo et Carlito : fichiers amont officiels, non modifiés

Les 8 fichiers sont ceux de l'amont, octet pour octet. Carlito a un nom réservé (« Reserved Font
Name "Carlito" ») : une version modifiée ne pourrait pas garder ce nom, ces fichiers ne doivent donc
pas être modifiés (ni réenregistrés, ni réduits à un sous-ensemble).

Ne pas les remplacer par les fichiers de l'API Google Fonts (fonts.gstatic.com) : dans ceux-là, la
table « glyf » est la dernière du fichier et l'espace insécable son dernier glyphe, vide ; fontkit
2.0.4 (moteur de @react-pdf) lit alors au-delà du fichier et le PDF échoue à la première espace
insécable. Vérifié par src/lib/cv-pdf-fonts.test.mjs.

| Fichier | Fichier amont | SHA-256 |
| --- | --- | --- |
| arimo-400.ttf | Arimo-Regular.ttf | 41b22bc8f0b51f932825d37bc55b5eb6ba67dfe599a626e4aff2b43b624f9f8c |
| arimo-700.ttf | Arimo-Bold.ttf | d7a8b187cf8444d4cfee102e8eae9e3043682fd5106d5d33ed677fe268a0e2ba |
| arimo-400-italic.ttf | Arimo-Italic.ttf | ffdf690e4357a392e4edcc3df0b3adb0302920f75e54f2e6eec355afbe7edcba |
| arimo-700-italic.ttf | Arimo-BoldItalic.ttf | 77c967d49d4ef4a63c39fbcd1e27892102e503e35a20983cb058430c4f268b34 |
| carlito-400.ttf | Carlito-Regular.ttf | f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595 |
| carlito-700.ttf | Carlito-Bold.ttf | bb5d20f79b82599ec72983597437373a80f2d2085fa91fc144fd74e876a594db |
| carlito-400-italic.ttf | Carlito-Italic.ttf | 0b019225e58d702bfedcbd35c21696769f8ee115cb6343f84c2f240312450d1c |
| carlito-700-italic.ttf | Carlito-BoldItalic.ttf | b32928186c119599e03ca6a1ffc680fdcb7fac95772f4b95d989cf6cd3861517 |

## Autres polices (6 premiers modèles)

Licences d'après le tableau d'origine, non revérifiées lors de la mise à jour ci-dessus.

| Fichiers | Police | Licence |
| --- | --- | --- |
| inter-* | Inter | SIL Open Font License 1.1 |
| roboto-* | Roboto | Apache License 2.0 |
| open-sans-* | Open Sans | SIL Open Font License 1.1 |
| lato-* | Lato | SIL Open Font License 1.1 |
| montserrat-* | Montserrat | SIL Open Font License 1.1 |
| playfair-display-* | Playfair Display | SIL Open Font License 1.1 |
| merriweather-* | Merriweather | SIL Open Font License 1.1 |
| source-sans-3-* | Source Sans 3 (ex-Source Sans Pro) | SIL Open Font License 1.1 |
| raleway-* | Raleway | SIL Open Font License 1.1 |

Textes des licences : https://openfontlicense.org et https://www.apache.org/licenses/LICENSE-2.0
