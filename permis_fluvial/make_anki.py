"""
make_anki.py — Convertit questions.json en deck Anki .apkg

Prérequis :
    pip install genanki

Usage :
    python3 make_anki.py

Sortie :
    permis_fluvial.apkg  (importable directement dans Anki)

Format des cartes :
  - Recto : question + image (si dispo) + liste des choix (A, B, C, D)
  - Verso : bonne(s) réponse(s) + toutes les réponses colorées (vert/rouge)
"""

import json
import hashlib
import os
import random
import urllib.request
import urllib.error
import genanki

# ─── Config ──────────────────────────────────────────────────────────────────

INPUT_FILE = 'questions.json'
OUTPUT_FILE = 'permis_fluvial.apkg'
MEDIA_DIR = 'media'

DECK_ID   = random.randrange(1 << 30, 1 << 31)
MODEL_ID  = random.randrange(1 << 30, 1 << 31)

# ─── Modèle de carte ─────────────────────────────────────────────────────────

CSS = """
.card {
  font-family: Arial, sans-serif;
  font-size: 16px;
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
}

.section-tag {
  font-size: 11px;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.question {
  font-weight: bold;
  font-size: 17px;
  margin-bottom: 16px;
  line-height: 1.4;
}

.question img {
  max-width: 100%;
  max-height: 300px;
  display: block;
  margin: 10px auto;
  border-radius: 6px;
}

.answers {
  list-style: none;
  padding: 0;
  margin: 0;
}

.answers li {
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  border: 1px solid rgba(128,128,128,0.3);
  background: rgba(128,128,128,0.1);
}

.answers li.correct {
  background: rgba(52,168,83,0.2);
  border-color: #34a853;
  color: #34a853;
  font-weight: bold;
}

.answers li.wrong {
  background: rgba(234,67,53,0.15);
  border-color: #ea4335;
  color: #ea4335;
}

.hr {
  border: none;
  border-top: 1px solid rgba(128,128,128,0.3);
  margin: 12px 0;
}
"""

FRONT_TMPL = """
<div class="section-tag">{{Section}}</div>
<div class="question">{{Question}}</div>
<ul class="answers">{{AnswersList}}</ul>
"""

BACK_TMPL = """
<div class="section-tag">{{Section}}</div>
<div class="question">{{Question}}</div>
<div class="hr"></div>
<ul class="answers">{{AnswersWithCorrect}}</ul>
"""

model = genanki.Model(
    MODEL_ID,
    'Permis Fluvial QCM',
    fields=[
        {'name': 'Section'},
        {'name': 'Question'},
        {'name': 'AnswersList'},
        {'name': 'AnswersWithCorrect'},
    ],
    templates=[
        {
            'name': 'Card 1',
            'qfmt': FRONT_TMPL,
            'afmt': BACK_TMPL,
        }
    ],
    css=CSS,
)

# ─── Helpers ─────────────────────────────────────────────────────────────────

def download_image(url: str) -> str | None:
    """Download image, return local filename or None."""
    os.makedirs(MEDIA_DIR, exist_ok=True)
    ext = os.path.splitext(url.split('?')[0])[1].lower() or '.png'
    name = hashlib.md5(url.encode()).hexdigest() + ext
    path = os.path.join(MEDIA_DIR, name)

    if os.path.exists(path):
        return name

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        with open(path, 'wb') as f:
            f.write(data)
        return name
    except (urllib.error.URLError, OSError) as e:
        print(f'  ⚠️  Image download failed: {url} ({e})')
        return None


def make_question_html(question: str, img_filename: str | None) -> str:
    """Build question HTML with optional image."""
    import html as html_mod
    parts = [html_mod.escape(question)]
    if img_filename:
        parts.insert(0, f'<img src="{img_filename}">')
    return '\n'.join(parts)


def make_answers_list(answers: list[str]) -> str:
    """Recto : liste neutre des réponses."""
    import html as html_mod
    items = ''.join(f'<li>{html_mod.escape(a)}</li>' for a in answers)
    return f'<ul class="answers">{items}</ul>'


def make_answers_with_correct(answers: list[str], correct: list[str]) -> str:
    """Verso : réponses colorées vert/rouge."""
    import html as html_mod
    items = []
    correct_set = set(correct)
    for a in answers:
        css_class = 'correct' if a in correct_set else 'wrong'
        items.append(f'<li class="{css_class}">{html_mod.escape(a)}</li>')
    return '<ul class="answers">' + ''.join(items) + '</ul>'

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    with open(INPUT_FILE, encoding='utf-8') as f:
        questions = json.load(f)

    deck = genanki.Deck(DECK_ID, 'Permis Fluvial :: Eaux Intérieures')

    media_files = []
    skipped = 0
    added   = 0
    img_ok  = 0
    img_fail = 0

    for q in questions:
        section  = q.get('section', 'Général')
        question = q.get('question', '').strip()
        answers  = q.get('answers', [])
        correct  = q.get('correct', [])
        img_url  = q.get('imgSrc')

        if not question or not answers:
            skipped += 1
            continue

        # Download image if present
        img_filename = None
        if img_url:
            img_filename = download_image(img_url)
            if img_filename:
                media_files.append(os.path.join(MEDIA_DIR, img_filename))
                img_ok += 1
            else:
                img_fail += 1

        if not correct:
            correct_display = ['⚠️ Bonne réponse à vérifier manuellement']
        else:
            correct_display = correct

        note = genanki.Note(
            model=model,
            fields=[
                section,
                make_question_html(question, img_filename),
                make_answers_list(answers),
                make_answers_with_correct(answers, set(correct_display)),
            ],
            tags=[section.lower().replace(' ', '_').replace('é', 'e').replace('è', 'e')],
        )
        deck.add_note(note)
        added += 1

    package = genanki.Package(deck)
    package.media_files = media_files
    package.write_to_file(OUTPUT_FILE)

    print(f'✅ {added} cartes générées → {OUTPUT_FILE}')
    print(f'   {skipped} ignorées (données manquantes)')
    print(f'   {img_ok} images embarquées, {img_fail} échouées')
    if any(not q.get('correct') for q in questions):
        n_missing = sum(1 for q in questions if not q.get('correct'))
        print(f'   ⚠️  {n_missing} cartes sans bonne réponse détectée — à compléter manuellement')
    print(f'\nImporter dans Anki : Fichier → Importer → {OUTPUT_FILE}')


if __name__ == '__main__':
    main()
