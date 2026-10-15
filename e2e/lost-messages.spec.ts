/*
 * A message this device could not decrypt is shown, not dropped (#1312).
 *
 * Runs against the browser build with the Tauri IPC mock. The core writes a
 * placeholder row (`undecryptable: true`, no content, sealed-sender `sender_id`)
 * when its cursor moves past a message it was entitled to read and never did;
 * this checks what that row looks like in both skins:
 *
 *   - it renders in place, between the messages around it;
 *   - it names no author (nothing readable says who sent it) and leaks no
 *     sentinel id;
 *   - it offers no actions — there is nothing to reply to, edit or react to.
 *
 * Screenshots of both skins land in `e2e/artifacts/playwright/` for review.
 *
 *   pnpm --filter @pollis/e2e exec playwright test -c playwright.config.js lost-messages
 */

import { test, expect, type Page } from "@playwright/test";

const USER = { id: "u-alice", email: "alice@example.com", username: "alice" };
const BOB = { id: "u-bob", username: "bob" };

const GROUP_ID = "01HQ7Z3K9M2P5R8T1V4W6Y0GRP";
const CHANNEL_ID = "01HQ7Z3K9M2P5R8T1V4W6Y0XCB";
const MSG_BEFORE = "01HQ7Z3K9M2P5R8T1V4W6Y0BEF";
const MSG_LOST = "01HQ7Z3K9M2P5R8T1V4W6Y0LST";
const MSG_AFTER = "01HQ7Z3K9M2P5R8T1V4W6Y0AFT";

const SKINS = ["terminal", "refined"] as const;
type Skin = (typeof SKINS)[number];

function preloadState(skin: Skin) {
  return {
    session: USER,
    profile: { id: USER.id, username: USER.username },
    preferences: JSON.stringify({ skin }),
    groups: [
      { id: GROUP_ID, name: "Acme", owner_id: USER.id, created_at: new Date().toISOString() },
    ],
    channels: {
      [GROUP_ID]: [{ id: CHANNEL_ID, group_id: GROUP_ID, name: "general" }],
    },
    messages: {
      [CHANNEL_ID]: [
        {
          id: MSG_BEFORE,
          conversation_id: CHANNEL_ID,
          sender_id: BOB.id,
          sender_username: BOB.username,
          content: "did everyone get the agenda?",
          sent_at: "2026-10-14T15:02:00.000Z",
        },
        {
          id: MSG_LOST,
          conversation_id: CHANNEL_ID,
          sender_id: "sealed",
          content: null,
          sent_at: "2026-10-14T15:04:00.000Z",
          undecryptable: true,
        },
        {
          id: MSG_AFTER,
          conversation_id: CHANNEL_ID,
          sender_id: USER.id,
          sender_username: USER.username,
          content: "got it, thanks",
          sent_at: "2026-10-14T15:06:00.000Z",
        },
      ],
    },
  };
}

async function boot(page: Page, skin: Skin) {
  await page.addInitScript((preload) => {
    (window as unknown as Record<string, unknown>).__POLLIS_PRELOAD__ = preload;
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { windowLabel: "main", label: "main" },
      },
      plugins: {},
      transformCallback: () => 0,
      convertFileSrc: (path: string) => path,
      registerListener: () => {},
      unregisterListener: () => {},
      runCallback: () => {},
      invoke: () => Promise.resolve(null),
    };
  }, preloadState(skin));
  await page.goto("/");
  await expect(page.getByTestId("sidebar")).toBeVisible();
}

/** The router uses memory history; reach the channel through a permalink. */
async function openChannel(page: Page) {
  await page.keyboard.press(process.platform === "darwin" ? "Meta+KeyK" : "Control+KeyK");
  await expect(page.getByTestId("search-panel")).toBeVisible();
  await page
    .getByTestId("search-panel-input")
    .fill(`pollis://m/${CHANNEL_ID}/${MSG_BEFORE}`);
  await expect(page.getByTestId(`message-${MSG_BEFORE}`)).toBeVisible();
}

for (const skin of SKINS) {
  test(`a lost message renders as a placeholder in place (${skin})`, async ({ page }) => {
    await boot(page, skin);
    await openChannel(page);

    const lost = page.getByTestId(`message-${MSG_LOST}`);
    await expect(lost).toBeVisible();
    await expect(lost).toHaveAttribute("data-undecryptable", "true");
    await expect(lost.getByTestId("message-content")).toContainText(
      "This message couldn't be decrypted on this device.",
    );

    // No author: not the sentinel, not "unknown", not anyone's name.
    await expect(lost.getByTestId("message-author")).toHaveCount(0);
    await expect(lost).not.toContainText("sealed");
    await expect(lost).not.toContainText("unknown");

    // In place: between the message before it and the one after.
    const order = await page.evaluate(
      (ids) =>
        ids.map((id) => {
          const el = document.querySelector(`[data-testid="message-${id}"]`);
          return el ? el.getBoundingClientRect().top : -1;
        }),
      [MSG_BEFORE, MSG_LOST, MSG_AFTER],
    );
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);

    // Nothing to act on: hovering it shows no action bar.
    await lost.hover();
    await expect(lost.locator("[data-testid^='message-action']")).toHaveCount(0);
    await expect(lost.getByRole("button")).toHaveCount(0);

    await page.screenshot({
      path: test.info().outputPath(`lost-message-${skin}.png`),
      fullPage: false,
    });
  });
}
