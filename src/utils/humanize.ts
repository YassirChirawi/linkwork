import { Locator, Page } from 'playwright';
import { CONFIG } from '../config.js';

/**
 * Génère un nombre pseudo-aléatoire suivant une distribution Gaussienne (normale)
 * via la transformation de Box-Muller.
 * Permet d'éviter les signatures de distribution uniforme (Math.random) facilement repérées par les WAF antibot.
 */
export function gaussianRandom(mean: number, stdDev: number, min?: number, max?: number): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();

  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  let value = mean + z0 * stdDev;

  if (min !== undefined && value < min) value = min;
  if (max !== undefined && value > max) value = max;

  return Math.round(value);
}

/**
 * Effectue une pause aléatoire réaliste basée sur une distribution normale.
 * @param minMs Temps minimum en millisecondes
 * @param maxMs Temps maximum en millisecondes
 */
export async function humanDelay(minMs: number, maxMs: number): Promise<void> {
  const mean = (minMs + maxMs) / 2;
  const stdDev = (maxMs - minMs) / 6; // ~99.7% des valeurs tombent entre min et max
  const delay = gaussianRandom(mean, stdDev, minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Simule une frappe humaine au clavier caractère par caractère.
 * - Variabilité de la vitesse de frappe (délai gaussien).
 * - Pauses plus longues sur la ponctuation et les espaces.
 * - Possibilité d'effacer le champ au préalable.
 */
export async function humanType(
  target: Page | Locator,
  selectorOrLocator: string | Locator,
  text: string,
  options: { clearFirst?: boolean } = { clearFirst: true }
): Promise<void> {
  let locator: Locator;

  if (typeof selectorOrLocator === 'string') {
    if ('locator' in target) {
      locator = (target as Page).locator(selectorOrLocator);
    } else {
      locator = (target as Locator).locator(selectorOrLocator);
    }
  } else {
    locator = selectorOrLocator;
  }

  await locator.waitFor({ state: 'visible', timeout: 8000 });
  await locator.click();
  await humanDelay(200, 500);

  if (options.clearFirst) {
    // Sélectionner tout et effacer pour un comportement naturel
    await locator.press('ControlOrMeta+A');
    await humanDelay(100, 250);
    await locator.press('Backspace');
    await humanDelay(150, 350);
  }

  const { min, max, mean, stdDev } = CONFIG.delays.typingSpeed;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    await locator.type(char, { delay: 0 });

    // Calcul du délai avant la prochaine frappe
    let charDelay = gaussianRandom(mean, stdDev, min, max);

    // Pause physiologique naturelle sur espace ou ponctuation
    if ([' ', '.', ',', ';', '?', '!', '\n'].includes(char)) {
      charDelay += gaussianRandom(150, 60, 80, 350);
    }

    // Petite hésitation cognitive aléatoire (3% de probabilité)
    if (Math.random() < 0.03) {
      charDelay += gaussianRandom(400, 150, 250, 900);
    }

    await new Promise((r) => setTimeout(r, charDelay));
  }

  await humanDelay(300, 700);
}

/**
 * Simule un défilement humain de page avec accélérations, décélérations
 * et micro-pauses (lecture d'écran).
 */
export async function humanScroll(
  page: Page,
  options: {
    totalDistance?: number;
    direction?: 'down' | 'up';
    scrollSteps?: number;
  } = {}
): Promise<void> {
  const directionMultiplier = options.direction === 'up' ? -1 : 1;
  const totalDistance = options.totalDistance || gaussianRandom(500, 150, 300, 1200);
  const steps = options.scrollSteps || gaussianRandom(5, 2, 3, 9);
  const stepDistance = totalDistance / steps;

  for (let i = 0; i < steps; i++) {
    // Variation de la distance de chaque coup de molette
    const deltaY = directionMultiplier * gaussianRandom(stepDistance, stepDistance * 0.3, 20, stepDistance * 1.8);
    await page.mouse.wheel(0, deltaY);

    // Micro-pause entre deux scrolls (simulation du temps d'attention visuelle)
    await humanDelay(250, 900);

    // Mouvement subtil de la souris pendant la lecture
    if (Math.random() > 0.5) {
      const currentViewport = page.viewportSize() || { width: 1280, height: 800 };
      const randomX = gaussianRandom(currentViewport.width / 2, 200, 100, currentViewport.width - 100);
      const randomY = gaussianRandom(currentViewport.height / 2, 150, 100, currentViewport.height - 100);
      await page.mouse.move(randomX, randomY, { steps: gaussianRandom(4, 2, 2, 8) });
    }
  }

  await humanDelay(CONFIG.delays.pageScroll.min, CONFIG.delays.pageScroll.max);
}

/**
 * Effectue un déplacement de souris fluide vers un élément cible.
 */
export async function humanMoveAndClick(page: Page, locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  const box = await locator.boundingBox();

  if (box) {
    // Déplacement de la souris fluide et réaliste
    const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
    const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

    await page.mouse.move(targetX, targetY, {
      steps: gaussianRandom(10, 4, 5, 20),
    });
    await humanDelay(100, 250);
  }

  // Déclencher le vrai clic Playwright qui émet la séquence complète mousedown -> mouseup -> click
  // indispensable pour que les frameworks React/Artdeco ouvrent les modales
  try {
    await locator.click({ timeout: 5000 });
  } catch {
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await locator.dispatchEvent('click').catch(() => null);
    }
  }

  await humanDelay(CONFIG.delays.microPause.min, CONFIG.delays.microPause.max);
}
