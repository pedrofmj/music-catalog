import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function openSong(page: Page, title: string) {
  const back = page.getByRole('button', { name: 'Repertoire', exact: true });
  if (await back.isVisible()) await back.click();
  await page
    .getByRole('button', { name: new RegExp(title) })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

function scorePdf() {
  const stream =
    'BT /F1 22 Tf 55 745 Td (PDF score fixture) Tj ET\n0.8 w\n55 680 m 550 680 l S\n55 670 m 550 670 l S\n55 660 m 550 660 l S\n55 650 m 550 650 l S\n55 640 m 550 640 l S\n100 650 9 5 re f\n108 650 m 108 685 l S\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Evening rehearsal/ }).first()).toBeVisible();
});

test('library, responsive reader, notation switch, and score engraving', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('library.png'), fullPage: true });
  await openSong(page, 'Evening rehearsal');
  await expect(page.locator('.cp-chord').first()).toHaveText('C');
  await page.screenshot({ path: info.outputPath('chart.png'), fullPage: true });
  await page.getByRole('button', { name: 'Tablature · Guitar', exact: true }).click();
  await expect(page.locator('.tab-content')).toContainText('Standard tuning');
  await noPageOverflow(page);
  await openSong(page, 'C major study');
  await expect(page.locator('.musicxml svg').first()).toBeVisible();
  expect(await page.locator('.musicxml svg path').count()).toBeGreaterThan(10);
  await noPageOverflow(page);
  await page.screenshot({ path: info.outputPath('score.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('create, persist, edit, search, favorite and delete a song', async ({ page }) => {
  await page.getByRole('button', { name: 'New song', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Rehearsal test');
  await page.getByLabel('Artist / composer').fill('Our band');
  await page.getByLabel('Tags', { exact: true }).fill('Live, New');
  await page
    .getByRole('textbox', { name: 'Source', exact: true })
    .fill('{start_of_verse: Verse}\n[C]First [G]line\n{end_of_verse}');
  await page.getByRole('button', { name: 'Save song', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rehearsal test', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to favorites', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await page.reload();
  await openSong(page, 'Rehearsal test');
  await expect(page.locator('.chart-content')).toContainText('First');
  await page.getByRole('button', { name: 'Edit document', exact: true }).click();
  await page.getByRole('textbox', { name: 'Source', exact: true }).fill('[Dm7]Updated [G7]line');
  await page.getByRole('button', { name: 'Save document', exact: true }).click();
  await expect(page.locator('.cp-chord').first()).toHaveText('Dm7');
  await page.getByRole('button', { name: 'Delete song', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete song', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Search repertoire').fill('Rehearsal test');
  await expect(page.getByText('No matching songs')).toBeVisible();
});

test('imports and exports a lossless catalog without duplicate records', async ({ page }) => {
  const source = '{title: Imported song}\n{artist: Our band}\n{key: D}\n[D]Hello [A]again\n';
  await page
    .getByLabel('Import music files')
    .setInputFiles({ name: 'test.cho', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await expect(page.getByRole('status', { name: 'Library notification' })).toContainText(
    '1 song(s) imported',
  );
  await openSong(page, 'Imported song');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export song', exact: true }).click();
  const download = await downloadPromise;
  const data = await readFile((await download.path())!);
  const catalog = JSON.parse(data.toString());
  expect(catalog.schemaVersion).toBe(1);
  expect(catalog.songs[0].documents[0].content).toBe(source);
  await page.getByLabel('Import music files').setInputFiles({
    name: 'backup.musiccatalog.json',
    mimeType: 'application/json',
    buffer: data,
  });
  await expect(page.getByRole('status', { name: 'Library notification' })).toContainText(
    '0 song(s) imported, 1 identical song(s) skipped',
  );
  await page.reload();
  await expect(page.locator('.song-row')).toHaveCount(4);
});

test('rejects a mixed invalid batch without a partial import', async ({ page }) => {
  await page.getByLabel('Import music files').setInputFiles([
    {
      name: 'valid.cho',
      mimeType: 'text/plain',
      buffer: Buffer.from('{title: Must not persist}\n[C]Test'),
    },
    { name: 'invalid.musicxml', mimeType: 'application/xml', buffer: Buffer.from('<broken>') },
  ]);
  await expect(page.getByRole('alert')).toContainText('valid XML');
  await expect(page.locator('.song-row')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.song-row')).toHaveCount(3);
});

test('preview transposition, zoom, focus and auto-scroll leave source intact', async ({ page }) => {
  await openSong(page, 'Evening rehearsal');
  await page.getByRole('button', { name: 'Transpose up', exact: true }).click();
  await expect(page.locator('.cp-chord').first()).not.toHaveText('C');
  await expect(page.getByLabel('Transposition')).toHaveText('+1');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.locator('.zoom-value')).toHaveText('110%');
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit focus mode', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start scrolling', exact: true }).click();
  await expect
    .poll(() => page.getByLabel('Score content').evaluate((element) => element.scrollTop))
    .toBeGreaterThan(8);
  await page.getByRole('button', { name: 'Pause scrolling', exact: true }).click();
  await page.getByRole('button', { name: 'Back to top', exact: true }).click();
  await expect
    .poll(() => page.getByLabel('Score content').evaluate((element) => element.scrollTop))
    .toBe(0);
  await page.getByRole('button', { name: 'Exit focus mode', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original', exact: true }).click();
  const original = await readFile((await (await downloadPromise).path())!, 'utf8');
  expect(original).toContain('[C]One, two,');
});

test('renders PDF pixels and preserves the original binary', async ({ page }, info) => {
  const source = scorePdf();
  await page
    .getByLabel('Import music files')
    .setInputFiles({ name: 'PDF study.pdf', mimeType: 'application/pdf', buffer: source });
  await expect(page.getByRole('status', { name: 'Library notification' })).toContainText(
    '1 song(s) imported',
  );
  await openSong(page, 'PDF study');
  const canvas = page.getByLabel('Score page 1', { exact: true });
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const pixels = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 0 && pixels[i] < 200) ink++;
        return ink;
      }),
    )
    .toBeGreaterThan(100);
  await page.screenshot({ path: info.outputPath('pdf.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download original', exact: true }).click();
  expect(await readFile((await (await downloadPromise).path())!)).toEqual(source);
});
