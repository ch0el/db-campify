import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button', { name: 'Explore with demo data' }).click();
await page.getByRole('button', { name: 'Open my dashboard' }).click();
await page.getByRole('heading', { name: 'Good morning, Mickey!' }).waitFor();
await page.evaluate(() => document.fonts.ready);
mkdirSync('.taste-skill/screenshots', { recursive: true });
for (const width of [1440, 1280, 768, 390]) {
  await page.setViewportSize({ width, height: width < 800 ? 1000 : 1000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `.taste-skill/screenshots/overview-${width}.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) errors.push(`Overview overflows at ${width}px`);
}
await page.setViewportSize({ width: 1440, height: 1000 });
const snapshot = await page.content();
writeFileSync('.taste-skill/overview.html', snapshot.replace('<head>', '<head><base href="http://127.0.0.1:5173/">').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
await page.getByRole('link', { name: 'Goals', exact: true }).click();
await page.getByLabel('Confirmed enrollments').fill('175');
await page.getByRole('button', { name: 'Save goal' }).click();
await page.getByText('Goal saved.', { exact: true }).waitFor();
await page.getByLabel('Time span').selectOption('3');
await page.screenshot({ path: '.taste-skill/screenshots/goals-1440.png', fullPage: true });
await page.getByRole('link', { name: 'New players', exact: true }).click();
await page.getByRole('heading', { name: 'New and returning players' }).waitFor();
await page.getByRole('link', { name: 'Demographics', exact: true }).click();
await page.getByRole('button', { name: 'Schools', exact: true }).click();
await page.getByLabel('Search schools').fill('Riverside');
await page.getByRole('cell', { name: 'Riverside High School', exact: true }).waitFor();
await page.getByRole('link', { name: 'Calendar', exact: true }).click();
for (const view of ['Week', 'Day', 'Month']) await page.getByRole('button', { name: view, exact: true }).click();
await page.getByLabel('Selected date').fill('2026-11-21');
await page.getByText('Fall Prospect Camp', { exact: true }).waitFor();
await page.screenshot({ path: '.taste-skill/screenshots/calendar-1440.png', fullPage: true });
await page.getByRole('link', { name: 'Upload CSV', exact: true }).click();
const csv = 'Registration ID,Participant ID,Participant Name,Camp ID,Camp Name,Start Date,End Date,Registration Date,School,District,Referral Source,Status,Amount Paid\nQA-1,QA-P1,QA Test Player,QA-C1,QA Camp,2026-12-01,2026-12-02,2026-11-19,QA School,QA District,Website,confirmed,150.00';
await page.getByLabel('Choose CSV file').setInputFiles({ name: 'qa-test.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
await page.getByRole('heading', { name: 'Match columns' }).waitFor();
await page.screenshot({ path: '.taste-skill/screenshots/upload-1440.png', fullPage: true });
await page.getByRole('button', { name: 'Import 1 enrollments' }).click();
await page.getByText('1 enrollments processed in this demo session. Repeated IDs were updated.', { exact: true }).waitFor();
await page.getByLabel('Choose CSV file').setInputFiles({ name: 'qa-test.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
await page.getByRole('button', { name: 'Import 1 enrollments' }).click();
await page.getByText('This exact file was already imported. No rows changed.', { exact: true }).waitFor();
await page.getByLabel('Open your profile').click();
await page.getByLabel('Display name').fill('Mickey Coach');
await page.getByRole('button', { name: 'Save profile' }).click();
await page.getByText('Profile saved.', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Report an issue', exact: true }).click();
await page.getByLabel('Description').fill('QA issue report to verify the form.');
await page.getByRole('button', { name: 'Save issue report' }).click();
await page.getByRole('status').filter({ hasText: 'Demo' }).waitFor();
await page.getByRole('button', { name: 'Close dialog' }).click();
await page.setViewportSize({ width: 390, height: 844 });
for (const route of ['goals', 'players', 'demographics', 'calendar', 'enrollment', 'upload', 'profile', 'features']) {
  await page.goto(`http://127.0.0.1:5173/#${route}`);
  // A full navigation intentionally resets in-memory demo state; sign in explicitly again.
  if (await page.getByRole('button', { name: 'Explore with demo data' }).count()) {
    await page.getByRole('button', { name: 'Explore with demo data' }).click();
    await page.getByRole('button', { name: 'Open my dashboard' }).click();
    await page.evaluate(route => { location.hash = route; }, route);
  }
  await page.getByRole('heading', { level: 1, exact: true, name: ({goals:'Goals',players:'New players',demographics:'Demographics',calendar:'Calendar',enrollment:'Enrollment',upload:'Upload CSV',profile:'Your profile',features:'Choose features'})[route] }).waitFor();
  await page.screenshot({ path: `.taste-skill/screenshots/${route}-390.png`, fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) errors.push(`${route} overflows at 390px`);
}
const assetChecks = await page.evaluate(() => [...document.images].map(img => ({ src: new URL(img.src).pathname, loaded: img.complete && img.naturalWidth > 0, width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height })));
writeFileSync('.taste-skill/browser-results.json', JSON.stringify({ errors, assetChecks }, null, 2));
console.log(JSON.stringify({ errors, checked: 'sign-in/demo, features, overview at 4 widths, goals, cohorts, demographics, all calendar views, CSV import+dedupe, profile, issue form, eight mobile pages' }));
await browser.close();
if (errors.length) process.exit(1);
