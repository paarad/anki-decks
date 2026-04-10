/**
 * Scraper QCM Permis Fluvial depuis loisirs-nautic.fr → questions.json
 *
 * Usage :
 *   node scrape_loisirs_nautic.js
 *
 * Sortie :
 *   questions.json  (à combiner ou remplacer l'existant)
 *   puis : python3 make_anki.py
 */

const { chromium } = require('playwright');
const fs = require('fs');

const PAGES = [
  { name: 'Vocabulaire', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_vocabulaire.php' },
  { name: 'Signalisation 1', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_signalisation1.php' },
  { name: 'Signalisation 2', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_signalisation2.php' },
  { name: 'Balisage', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_balisage.php' },
  { name: 'Règles de barre', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_regles_barre.php' },
  { name: 'Feux et marques', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_feux_marques.php' },
  { name: 'VHF 1', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_vhf_1.php' },
  { name: 'VHF 2', url: 'https://www.loisirs-nautic.fr/test_permis_fluvial_vhf_2.php' },
];

async function extractQuestions(page, sectionName, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);

  return await page.evaluate((sName) => {
    const questions = [];
    const bonnesReponses = window.TabBonnesReponses || [];
    const bonnesReponses2 = window.TabBonnesReponses2 || [];
    let i = 1;

    while (true) {
      const form = document.getElementById('qcm' + i);
      if (!form) break;

      const questionLabel = form.querySelector('label[style]');
      const questionText = questionLabel ? questionLabel.innerText.trim() : '';

      // Get image if any — image is in sibling .questleft div, not inside the form
      const row = form.closest('.row');
      const img = row ? row.querySelector('.questleft img') : form.querySelector('img');
      const imgSrc = img ? img.src : null;

      // Get answer options
      const labels = form.querySelectorAll('label.checkbox');
      const answers = Array.from(labels).map(l => l.innerText.trim()).filter(a => a.length > 0);

      // Determine correct answers from JS arrays (1-indexed)
      const correct = [];
      const c1 = bonnesReponses[i - 1];
      const c2 = bonnesReponses2 ? bonnesReponses2[i - 1] : 0;
      if (c1 > 0 && c1 <= answers.length) correct.push(answers[c1 - 1]);
      if (c2 > 0 && c2 <= answers.length) correct.push(answers[c2 - 1]);

      if (questionText && answers.length > 0) {
        questions.push({
          section: sName,
          question: questionText,
          answers,
          correct,
          imgSrc,
        });
      }
      i++;
    }
    return questions;
  }, sectionName);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const allQuestions = [];
  const seenQuestions = new Set();

  for (const { name, url } of PAGES) {
    console.log(`\n📚 ${name}`);
    const page = await browser.newPage();

    try {
      const qs = await extractQuestions(page, name, url);
      let added = 0;
      for (const q of qs) {
        // Deduplicate by question text
        const key = q.question.toLowerCase().replace(/\s+/g, ' ');
        if (!seenQuestions.has(key)) {
          seenQuestions.add(key);
          allQuestions.push(q);
          added++;
          console.log(`  ✓ ${q.question.slice(0, 50)} → ${q.correct.join(' | ') || '???'}`);
        }
      }
      console.log(`  ${added} nouvelles (${qs.length - added} doublons)`);
    } catch (e) {
      console.error(`  Erreur: ${e.message}`);
    }

    await page.close();
  }

  // Now try the thematic random tests to get more unique questions
  // Each reload gives different questions from the pool
  const RANDOM_PAGES = [
    { name: 'Vocabulaire', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=1' },
    { name: 'Signalisation', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=2' },
    { name: 'Balisage', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=3' },
    { name: 'Règles de barre', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=4' },
    { name: 'Feux et marques', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=5' },
    { name: 'Sécurité', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=6' },
    { name: 'Signaux sonores', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=7' },
    { name: 'VHF', url: 'https://www.loisirs-nautic.fr/test_Fluvial_Thematique_Aleatoire.php?choix=8' },
  ];

  const RELOADS = 15; // reload each random page N times to discover more questions

  for (const { name, url } of RANDOM_PAGES) {
    console.log(`\n🔀 ${name} (aléatoire x${RELOADS})`);
    const page = await browser.newPage();
    let totalAdded = 0;

    for (let r = 0; r < RELOADS; r++) {
      try {
        const qs = await extractQuestions(page, name, url);
        let added = 0;
        for (const q of qs) {
          const key = q.question.toLowerCase().replace(/\s+/g, ' ');
          if (!seenQuestions.has(key)) {
            seenQuestions.add(key);
            allQuestions.push(q);
            added++;
          }
        }
        totalAdded += added;
        if (added > 0) process.stdout.write(`  +${added}`);
      } catch (e) {
        process.stdout.write(' ✗');
      }
    }
    console.log(`\n  Total nouvelles: ${totalAdded}`);
    await page.close();
  }

  await browser.close();

  // Remove imgSrc for questions without images
  for (const q of allQuestions) {
    if (!q.imgSrc) delete q.imgSrc;
  }

  fs.writeFileSync('questions.json', JSON.stringify(allQuestions, null, 2), 'utf8');

  const withCorrect = allQuestions.filter(q => q.correct.length > 0).length;
  const withImg = allQuestions.filter(q => q.imgSrc).length;
  console.log(`\n✅ ${allQuestions.length} questions uniques extraites → questions.json`);
  console.log(`   ${withCorrect} avec bonne réponse`);
  console.log(`   ${withImg} avec image`);
  console.log(`   ${allQuestions.length - withCorrect} sans réponse détectée`);
  console.log('\nEnsuite: python3 make_anki.py');
}

main().catch(console.error);
