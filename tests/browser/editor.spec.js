import { test, expect } from "@playwright/test";
const config = {
  version: 1,
  repository: "serlekan/mylinks",
  profile: {
    name: "Serlekan",
    eyebrow: "Founder",
    status: "Building",
    intro: "Biography",
    footer: "Footer",
  },
  links: [
    {
      id: "one",
      title: "Work",
      description: "Projects",
      url: "https://example.com/",
      enabled: true,
    },
    {
      id: "two",
      title: "Social",
      description: "Updates",
      url: "https://example.org/",
      enabled: true,
    },
  ],
};
async function editor(page) {
  await page.goto("/editor.html");
  await expect(page.locator("#editor-fields")).toBeEnabled();
  await expect(page.locator("#service-status")).toContainText("not configured");
}
test("public responsive, focus and fallback", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 375, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".card")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  expect(errors).toEqual([]);
  await page.route("**/data.json", (route) => route.abort());
  await page.reload();
  await expect(page.locator("#notice")).toContainText("last built page");
  await expect(page.locator(".card")).toHaveCount(4);
});
test("profile and appearance update actual preview, draft restore/discard", async ({
  page,
}) => {
  await editor(page);
  await page.locator("#profile-name").fill("Draft Name");
  await expect(page.frameLocator("#preview").locator("#name")).toHaveText(
    "Draft Name.",
  );
  await page.locator("#accent").selectOption("mint");
  await expect(page.frameLocator("#preview").locator("html")).toHaveAttribute(
    "data-accent",
    "mint",
  );
  await page.locator("#mobile-preview").click();
  await expect(page.locator("#preview-wrap")).toHaveClass(/mobile/);
  await page.locator("#desktop-preview").click();
  await expect(page.locator("#preview-wrap")).not.toHaveClass(/mobile/);
  await page.locator("#save-draft").click();
  await page.reload();
  await page.locator("#restore-draft").click();
  await expect(page.locator("#profile-name")).toHaveValue("Draft Name");
  page.once("dialog", (d) => d.accept());
  await page.locator("#discard").click();
  await expect(page.locator("#profile-name")).toHaveValue("Serlekan");
  await page.locator("#restore-draft").click();
  await expect(page.locator("#profile-name")).toHaveValue("Draft Name");
});
test("incomplete links never block add, reorder, delete or draft recovery", async ({
  page,
}) => {
  await editor(page);
  await page.locator("#add-link").click();
  let card = page.locator(".editor-card").last();
  await card.locator('[data-field="url"]').fill("https://");
  await card.locator('[data-field="title"]').fill("");
  await card.getByRole("button", { name: "Move up", exact: true }).click();
  await expect(
    page.locator(".editor-card").nth(3).locator('[data-field="url"]'),
  ).toHaveValue("https://");
  await page.locator("#save-draft").click();
  await page.reload();
  await page.locator("#restore-draft").click();
  await expect(page.locator(".editor-card")).toHaveCount(5);
  await expect(
    page.locator(".editor-card").nth(3).locator('[data-field="url"]'),
  ).toHaveValue("https://");
  page.once("dialog", (d) => d.dismiss());
  await page
    .locator(".editor-card")
    .nth(3)
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(page.locator(".editor-card")).toHaveCount(5);
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".editor-card")
    .nth(3)
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(page.locator(".editor-card")).toHaveCount(4);
});
test("import rejects unsafe data without losing edits, export is valid", async ({
  page,
}) => {
  await editor(page);
  await page.locator("#profile-name").fill("Keep me");
  await page.locator("#import-file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...config,
        links: [{ ...config.links[0], url: "javascript:alert(1)" }],
      }),
    ),
  });
  await expect(page.locator("#feedback")).toContainText("HTTP(S)");
  await expect(page.locator("#profile-name")).toHaveValue("Keep me");
  page.once("dialog", (d) => d.accept());
  await page.locator("#import-file").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config)),
  });
  await expect(page.locator(".editor-card")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.locator("#download-json").click();
  expect((await download).suggestedFilename()).toBe("data.json");
  await expect(page.locator("#publish")).toBeDisabled();
});
test("literal XSS copy never becomes executable and disabling changes preview", async ({
  page,
}) => {
  await editor(page);
  const title = page
    .locator(".editor-card")
    .first()
    .locator('[data-field="title"]');
  await title.fill("<img src=x onerror=alert(1)>");
  await expect(
    page.frameLocator("#preview").locator(".card h2").first(),
  ).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.frameLocator("#preview").locator("img")).toHaveCount(0);
  await page
    .locator(".editor-card")
    .first()
    .locator('[data-field="enabled"]')
    .uncheck();
  await expect(page.frameLocator("#preview").locator(".card")).toHaveCount(3);
});
test("authenticated publish distinguishes commit, deployment and conflicts", async ({
  page,
}) => {
  let posts = 0;
  await page.route("**/api/session", (r) =>
    r.fulfill({ json: { data: config, sha: "a".repeat(40) } }),
  );
  await page.route("**/data.json", (r) => r.fulfill({ json: config }));
  await page.route("**/api/publish", (r) => {
    posts++;
    return r.fulfill({
      status: posts === 1 ? 200 : 409,
      json:
        posts === 1
          ? { commit: "c".repeat(40), sha: "b".repeat(40) }
          : { error: "Repository changed." },
    });
  });
  await page.route("**/api/status?*", (r) =>
    r.fulfill({
      json: {
        commit: "c".repeat(40),
        state: "success",
        message:
          "Deployment successful. The production release matches this commit.",
      },
    }),
  );
  await page.goto("/editor.html");
  await expect(page.locator("#publish")).toBeEnabled();
  await page.locator("#profile-name").fill("Published Name");
  await page.locator("#publish").click();
  await expect(page.locator("#deployment-status")).toContainText(
    "Deployment successful",
  );
  expect(posts).toBe(1);
  await page.locator("#profile-name").fill("Next draft");
  await page.locator("#publish").click();
  await expect(page.locator("#feedback")).toContainText("Repository changed");
  await expect(page.locator("#profile-name")).toHaveValue("Next draft");
});
test("editor has no horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await editor(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("drag reorder, profile fields, footer and network recovery", async ({
  page,
  browserName,
}) => {
  await editor(page);
  await page.locator("#profile-intro").fill("A new biography");
  await page.locator("#profile-eyebrow").fill("Builder / Operator");
  await page.locator("#profile-status").fill("Available");
  await page.locator("#profile-footer").fill("A new footer");
  await expect(page.frameLocator("#preview").locator("#intro")).toHaveText(
    "A new biography",
  );
  await expect(
    page.frameLocator("#preview").locator("#footer-note"),
  ).toHaveText("A new footer");
  await expect(page.frameLocator("#preview").locator("#status")).toHaveText(
    "Available",
  );
  await expect(page.frameLocator("#preview").locator("#eyebrow")).toHaveText(
    "Builder / Operator",
  );
  await page.locator(".editor-card").first().scrollIntoViewIfNeeded();
  await page
    .locator(".drag-handle")
    .first()
    .dragTo(page.locator(".drag-handle").nth(1));
  await expect(
    page.locator(".editor-card").nth(1).locator('[data-field="title"]'),
  ).toHaveValue("Selected Work");
  await page.route("**/data.json", (r) => r.abort());
  page.once("dialog", (d) => d.accept());
  await page.locator("#discard").click();
  await expect(page.locator("#feedback")).toContainText(
    /Failed to fetch|Load failed|NetworkError/,
  );
  await expect(page.locator("#profile-footer")).toHaveValue("A new footer");
});
test("public works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.locator(".card")).toHaveCount(4);
  await expect(page.locator("#name")).toHaveText("Serlekan.");
  await context.close();
});
test("unsaved edits warn before navigating away", async ({ page }) => {
  await editor(page);
  await page.locator("#profile-name").fill("Do not lose this");
  const dialog = page.waitForEvent("dialog");
  const click = page.getByRole("link", { name: "View published site" }).click();
  const prompt = await dialog;
  expect(prompt.type()).toBe("beforeunload");
  await prompt.dismiss();
  await click;
  await expect(page.locator("#profile-name")).toHaveValue("Do not lose this");
});
