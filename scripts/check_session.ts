import { createStealthBrowser } from '../src/utils/browser.js';
import { CONFIG } from '../src/config.js';

async function checkAccount() {
  console.log("Vérification de la session LinkedIn en cours...");
  const { browser, page } = await createStealthBrowser({
    headless: true,
    useSession: true,
  });

  try {
    await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const currentUrl = page.url();
    console.log("URL atteinte :", currentUrl);

    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
      console.log("❌ La session n'est PAS connectée (redirigée vers le login).");
      return;
    }

    // Extraction du profil connecté
    const profileLink = await page.locator('a[href*="/in/"]').first().getAttribute('href').catch(() => null);
    const memberName = await page.locator('.feed-identity-module__actor-meta, .profile-rail-card__actor-link, h1, .artdeco-entity-lockup__title').first().innerText().catch(() => null);
    
    console.log("✔ Connecté sur LinkedIn !");
    if (profileLink) console.log("Lien profil :", profileLink.startsWith('http') ? profileLink : `https://www.linkedin.com${profileLink}`);
    if (memberName) console.log("Nom détecté :", memberName.trim());
  } catch (err: any) {
    console.error("Erreur lors de la vérification :", err.message);
  } finally {
    await browser.close();
  }
}

checkAccount();
