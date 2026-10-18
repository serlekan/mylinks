import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public and editor have no automated WCAG AA violations", async ({
  page,
}) => {
  for (const path of ["/", "/editor.html"]) {
    await page.goto(path);
    if (path.includes("editor"))
      await expect(page.locator("#profile-name")).toBeEnabled();
    else await expect(page.locator(".card")).toHaveCount(4);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
