import { chromium, firefox, webkit, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.env.BASE_URL || "https://serlekan-links.pages.dev";
const output = process.env.OUTPUT_DIR || "output/playwright/live";
await mkdir(output, { recursive: true });
const evidence = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/");
  await expect(page.locator(".card")).toHaveCount(4);
  await expect(page.locator(".card").first()).toHaveAttribute(
    "href",
    "https://serlekan-works.pages.dev/en/",
  );
  if (name === "chromium")
    await page.screenshot({
      path: output + "/mylinks-public-desktop.png",
      fullPage: true,
    });
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.locator(".card")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (name === "chromium")
    await page.screenshot({
      path: output + "/mylinks-public-mobile.png",
      fullPage: true,
    });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(origin + "/editor.html");
  await expect(page.locator("#profile-name")).toBeEnabled();
  await expect(page.locator("#service-status")).toContainText("not configured");
  await page.locator("#profile-name").fill("Production preview test");
  await expect(page.frameLocator("#preview").locator("#name")).toHaveText(
    "Production preview test.",
  );
  await page.locator("#save-draft").click();
  await page.reload();
  await page.locator("#restore-draft").click();
  await expect(page.locator("#profile-name")).toHaveValue(
    "Production preview test",
  );
  page.once("dialog", (d) => d.accept());
  await page.locator("#discard").click();
  await expect(page.locator("#profile-name")).toHaveValue("Serlekan");
  await expect(page.locator("#publish")).toBeDisabled();
  if (name === "chromium")
    await page.screenshot({
      path: output + "/mylinks-editor.png",
      fullPage: true,
    });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  evidence.push({
    browser: name,
    publicLinks: 4,
    publicAt320: true,
    editorAt320: true,
    realIframePreview: true,
    saveReloadRestore: true,
    discard: true,
    unauthenticatedPublishDisabled: true,
    pageErrors: errors,
  });
  await browser.close();
}
await writeFile(
  output + "/live-browser-results.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence, null, 2));
