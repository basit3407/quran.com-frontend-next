/* eslint-disable react-func/max-lines-per-function */
import { expect, test } from '@playwright/test';

// Run against a local frontend configured with the credential-free Platform fixture.
// No sign-in, production content, or public endpoint is used.
test.skip(process.env.CONNECTED_APPS_FIXTURE !== '1', 'Requires the local Platform fixture');
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const { hostname } = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(hostname)) await route.abort();
    else await route.continue();
  });
});

test('Indexed apps appear only in search, with accessible destinations on desktop and mobile', async ({
  page,
}) => {
  await page.goto('/apps');
  const browse = page.locator('#browse-apps');
  const input = browse.getByRole('textbox');
  await expect(browse.getByText('Quran for Android', { exact: true })).toBeVisible();
  await expect(page.getByText('Indexed Companion', { exact: true })).toHaveCount(0);
  await input.fill('Indexed');
  await expect(browse.getByText('Indexed Companion', { exact: true })).toBeVisible();
  const card = browse.getByRole('article').filter({ hasText: 'Indexed Companion' });
  await expect(card.getByRole('link', { name: 'Visit', exact: true })).toHaveAttribute(
    'href',
    'https://example.com/companion',
  );
  await expect(card.getByRole('link')).toHaveAttribute('rel', 'noreferrer');
  await expect(page.locator('main').getByText('Indexed Companion', { exact: true })).toHaveCount(1);
  await browse.screenshot({ path: test.info().outputPath('indexed-search.png') });
  await input.fill('');
  await expect(page.getByText('Indexed Companion', { exact: true })).toHaveCount(0);
  await expect(browse.getByText('Quran for Android', { exact: true })).toBeVisible();
  await browse.screenshot({ path: test.info().outputPath('empty-query-browse.png') });
});

test('loading and errors never claim there are no matches, and retry works', async ({ page }) => {
  await page.goto('/apps');
  const browse = page.locator('#browse-apps');
  const input = browse.getByRole('textbox');
  let fail = true;
  await page.route('**/api/connected-apps/search?**', async (route) => {
    await new Promise((resolve) => {
      setTimeout(resolve, 800);
    });
    if (fail) await route.fulfill({ status: 503, json: { error: 'search_unavailable' } });
    else await route.continue();
  });
  await input.fill('Indexed');
  await expect(browse.getByRole('status')).toContainText('Searching published apps');
  await expect(browse.getByRole('status')).toContainText('Published app search is unavailable');
  await expect(browse.getByText('No results found', { exact: true })).toHaveCount(0);
  await browse.screenshot({ path: test.info().outputPath('search-error.png') });
  fail = false;
  await browse.getByRole('button', { name: 'Try again' }).click();
  await expect(browse.getByText('Indexed Companion', { exact: true })).toBeVisible();
  await input.fill('---');
  await expect(browse.getByRole('status')).toContainText('Enter between 2 and 100');
  await expect(browse.getByText('Indexed Companion', { exact: true })).toHaveCount(0);
});
