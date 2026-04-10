# Anki Decks

Scrapers + générateurs de decks Anki (.apkg).

## Decks disponibles

### [Permis Fluvial](permis_fluvial/)
389 QCM avec images pour le permis bateau eaux intérieures.

```bash
cd permis_fluvial
node scrape_loisirs_nautic.js   # scrape → questions.json
python3 make_anki.py            # génère → permis_fluvial.apkg
```

## Prérequis

```bash
pip install genanki
npm install playwright
npx playwright install chromium
```
