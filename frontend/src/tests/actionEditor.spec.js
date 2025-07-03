import { test, expect } from '@playwright/test';

test.describe('ActionEditorComponent Focus Behavior', () => {
  const editorSelector = (n) => `[data-editor-id="editor${n}"]`;
  // More specific selector for the clickable editor area
  const tiptapEditorSelector = (n) => `${editorSelector(n)} .ProseMirror`; 
  const suggestionMenuSelector = (n) => `${editorSelector(n)} .suggestion-menu`;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://176.99.133.223:5173/test-editor');
    await page.waitForSelector(tiptapEditorSelector(1));
    await page.waitForSelector(tiptapEditorSelector(2));
    await page.waitForSelector(tiptapEditorSelector(3));
  });

  test('should not show any suggestion menus on initial page load', async ({ page }) => {
    // There is only one suggestion menu element that gets moved around
    await expect(page.locator('.suggestion-menu')).toBeHidden();
  });

  const runFocusTest = async (page, editorIndex) => {
    await expect(page.locator('.suggestion-menu')).toBeHidden();

    // Focus the editor to trigger the suggestion menu
    await page.focus(tiptapEditorSelector(editorIndex));

    await expect(page.locator(suggestionMenuSelector(editorIndex))).toBeVisible();

    // Ensure other menus are hidden
    for (let i = 1; i <= 3; i++) {
      if (i !== editorIndex) {
        await expect(page.locator(suggestionMenuSelector(i))).toBeHidden();
      }
    }
  };

  test('should show suggestion menu for editor 1 on focus', async ({ page }) => {
    await runFocusTest(page, 1);
  });

  test('should show suggestion menu for editor 2 on focus', async ({ page }) => {
    await runFocusTest(page, 2);
  });

  test('should show suggestion menu for editor 3 on focus', async ({ page }) => {
    await runFocusTest(page, 3);
  });
}); 