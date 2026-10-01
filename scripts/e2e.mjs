/**
 * End-to-end smoke test in a real Chromium browser against the local dev server.
 *
 *   npm run dev            # in one terminal
 *   npm run test:e2e       # in another (BASE_URL defaults to http://localhost:5173)
 *
 * Needs Playwright: `npm i -D playwright && npx playwright install chromium`.
 * Covers: phone OTP sign-up, onboarding, interests, deck swipes (button + drag),
 * realtime chat between two people (message, typing, seen), block, category
 * request and the admin panel. Screenshots land in .e2e-artifacts/.
 */
import { mkdirSync } from "node:fs";

const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const OUT = process.env.E2E_OUT ?? ".e2e-artifacts";
const HEADLESS = process.env.HEADED !== "1";
mkdirSync(OUT, { recursive: true });

const SUB = "Nikhil Kamath's WTF podcast";
const randomPhone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
let step = 0;

function assert(condition, message) {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
	console.log(`  ✓ ${message}`);
}

async function shot(page, name) {
	step += 1;
	await page.screenshot({ path: `${OUT}/${String(step).padStart(2, "0")}-${name}.png`, fullPage: false });
}

async function signIn(page, digits) {
	await page.goto(`${BASE}/login`);
	await page.getByLabel("Mobile number").fill(digits);
	await page.getByRole("button", { name: "Text me a code" }).click();
	const dev = page.getByTestId("dev-otp");
	await dev.waitFor();
	const code = (await dev.textContent()).match(/\d{6}/)[0];
	await page.getByLabel("One-time code").fill(code);
}

async function onboard(page, name) {
	await page.waitForURL("**/onboarding");
	const handle = (await page.getByTestId("handle").textContent()).trim();
	assert(handle.split(" ").length >= 3, `${name} got a quirky handle: ${handle}`);
	await page.getByLabel("When's your birthday?").fill("1997-05-20");
	await page.getByRole("button", { name: "Wakad" }).click();
	await shot(page, `${name}-onboarding`);
	await page.getByRole("button", { name: "Next: pick your interests" }).click();
	await page.waitForURL("**/interests?welcome=1");
	return handle;
}

async function joinPodcast(page, name) {
	await page.getByRole("link", { name: SUB }).first().click();
	await page.waitForURL("**/interests/nikhil-kamath-podcast");
	await page.locator("fieldset").first().waitFor();
	for (const fieldset of await page.locator("fieldset").all()) {
		await fieldset.locator("button").first().click();
	}
	await shot(page, `${name}-prompts`);
	await page.getByRole("button", { name: /Join & write my blurb/ }).click();
	const summary = await page.getByTestId("summary").textContent();
	assert(summary.length > 20, `${name} got a profile blurb: "${summary.slice(0, 60)}…"`);
	await shot(page, `${name}-summary`);
}

const browser = await chromium.launch({
	headless: HEADLESS,
	executablePath: process.env.CHROMIUM_PATH || undefined,
});

const errors = [];
const track = (page, who) => {
	page.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
	page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(`${who} console: ${m.text()}`));
};

try {
	// ---------------------------------------------------------------- B (desktop)
	console.log("Desktop user B signs up and joins the podcast deck");
	const bCtx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
	const b = await bCtx.newPage();
	track(b, "B");
	await b.goto(BASE);
	await shot(b, "desktop-landing");
	const bPhone = randomPhone();
	await signIn(b, bPhone);
	const bHandle = await onboard(b, "B");
	await joinPodcast(b, "B");

	// ---------------------------------------------------------------- A (phone)
	console.log("Mobile user A signs up, swipes, and says hi to B");
	const aCtx = await browser.newContext({ ...devices["iPhone 13"] });
	const a = await aCtx.newPage();
	track(a, "A");
	await a.goto(BASE);
	await shot(a, "mobile-landing");
	await a.getByRole("link", { name: /Find my people/ }).click();
	await signIn(a, randomPhone());
	const aHandle = await onboard(a, "A");
	await a.getByText("You're in!").waitFor();
	await shot(a, "A-interests-welcome");
	await joinPodcast(a, "A");
	await a.getByRole("button", { name: "Open the deck" }).click();
	await a.waitForURL("**/discover/wakad/nikhil-kamath-podcast");
	const card = a.getByTestId("swipe-card");
	await card.waitFor();
	await a.waitForTimeout(600);
	await shot(a, "A-deck");
	const sayHi = await a.getByRole("button", { name: "Say hi" }).boundingBox();
	const tabBar = await a.getByRole("navigation", { name: "Main" }).boundingBox();
	assert(sayHi.y + sayHi.height <= tabBar.y, "deck buttons sit above the mobile tab bar");

	const swipesBefore = Number(await a.getByTestId("swipes-left").textContent());
	let passes = 0;
	while ((await a.getByTestId("card-handle").textContent()).trim() !== bHandle) {
		await a.getByRole("button", { name: "Pass" }).click();
		passes += 1;
		await a.waitForTimeout(450);
		if (passes > 18) throw new Error("B never showed up in A's deck");
	}
	if (passes > 0) {
		const after = Number(await a.getByTestId("swipes-left").textContent());
		assert(after === swipesBefore - passes, `passing used swipes (${swipesBefore} → ${after})`);
	}
	assert(!(await card.textContent()).match(/\b\d{2} yrs\b/), "age is hidden on deck cards");

	// Drag the card to the right like a finger would.
	const box = await card.boundingBox();
	await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await a.mouse.down();
	for (let i = 1; i <= 12; i++) await a.mouse.move(box.x + box.width / 2 + i * 25, box.y + box.height / 2 + i * 2);
	await shot(a, "A-dragging-right");
	await a.mouse.up();
	await a.waitForURL(/\/chats\/[\w-]+$/);
	const chatUrl = a.url();
	assert((await a.getByTestId("chat-handle").textContent()).trim() === bHandle, "right swipe opened a chat with B");
	assert(/\d+ yrs/.test(await a.getByTestId("chat-meta").textContent()), "B's age is revealed inside the chat");
	const composer = a.getByLabel("Message");
	await a.waitForFunction(() => document.querySelector("textarea")?.value.length > 10);
	const opener = await composer.inputValue();
	assert(opener.length > 10, `opener was suggested: "${opener.slice(0, 70)}…"`);
	await shot(a, "A-chat-opener");
	await a.getByRole("button", { name: "Send" }).click();
	await a.getByTestId("msg-mine").first().waitFor();

	// ---------------------------------------------------------------- B replies in realtime
	console.log("B sees the hello and replies; A gets it live");
	await b.goto(`${BASE}/chats`);
	await b.getByText(aHandle).first().waitFor();
	await shot(b, "B-chat-list");
	await b.getByText(aHandle).first().click();
	await b.waitForURL(chatUrl.replace(/^https?:\/\/[^/]+/, BASE));
	await b.getByTestId("msg-theirs").first().waitFor();
	assert((await b.getByTestId("msg-theirs").first().textContent()).includes(opener.slice(0, 20)), "B received A's opener");

	// Typing indicator travels over the Durable Object WebSocket.
	await a.waitForTimeout(800);
	await b.getByLabel("Message").pressSequentially("Haha, ", { delay: 40 });
	await a.getByLabel("Typing").waitFor({ timeout: 5000 });
	assert(true, "A sees B typing in realtime");
	await b.getByLabel("Message").pressSequentially("1.5x gang! Which episode should I start with?", { delay: 5 });
	await b.keyboard.press("Enter");
	await a.getByText("Which episode should I start with?").waitFor({ timeout: 5000 });
	assert(true, "A received B's reply over the WebSocket without reloading");
	await a.getByTestId("seen").waitFor({ timeout: 5000 });
	assert(true, "A sees the 'Seen' receipt");
	await shot(a, "A-chat-live");
	await shot(b, "B-chat-desktop");

	// ---------------------------------------------------------------- A suggests an interest, then blocks B
	console.log("A suggests an interest and blocks B");
	await a.goto(`${BASE}/interests`);
	await a.getByRole("button", { name: "Suggest an interest" }).click();
	await a.getByRole("combobox").click();
	await a.getByRole("option", { name: /Books & Ideas/ }).click();
	await a.getByLabel("Name it").fill("Pune's old Irani cafés");
	await a.getByRole("button", { name: "Send suggestion" }).click();
	await a.getByText("in review").waitFor();
	assert(true, "category request submitted");

	await a.goto(chatUrl);
	await a.getByRole("button", { name: "Chat options" }).click();
	await a.getByRole("menuitem", { name: /Block/ }).click();
	await a.getByPlaceholder(/What happened/).fill("e2e test block");
	await shot(a, "A-block-dialog");
	await a.getByRole("button", { name: "Block", exact: true }).click();
	await a.waitForURL("**/chats");
	await b.waitForURL("**/chats", { timeout: 8000 });
	assert(true, "B was kicked out of the chat in realtime");
	await b.waitForTimeout(500);
	assert((await b.getByText(aHandle).count()) === 0, "the blocked chat disappeared for B");

	// ---------------------------------------------------------------- tablet + admin
	console.log("Admin reviews on a tablet");
	const cCtx = await browser.newContext({ ...devices["iPad (gen 7)"] });
	const c = await cCtx.newPage();
	track(c, "C");
	await signIn(c, "9999999999");
	await c.waitForURL(/\/(onboarding|discover)/);
	if (c.url().endsWith("/onboarding")) await onboard(c, "admin");
	await c.goto(`${BASE}/discover`);
	await c.getByText("Your decks in").waitFor();
	await shot(c, "tablet-discover");
	await c.goto(`${BASE}/admin`);
	await c.getByText("Deck density").waitFor();
	await shot(c, "tablet-admin-overview");
	await c.getByRole("tab", { name: "requests" }).click();
	await c.getByText("Pune's old Irani cafés").first().waitFor();
	await c.getByRole("button", { name: "Approve" }).first().click();
	await c.getByText("Reviewed").first().waitFor();
	assert(true, "admin approved the request");
	await c.getByRole("tab", { name: "safety" }).click();
	await c.getByText("e2e test block").first().waitFor();
	await shot(c, "tablet-admin-safety");
	assert(true, "admin sees the block with its reason");

	await a.goto(`${BASE}/me`);
	await a.getByText("You're known as").waitFor();
	await shot(a, "A-me");
	await b.goto(`${BASE}/discover`);
	await b.getByText("Your decks in").waitFor();
	await shot(b, "B-discover-desktop");

	assert(errors.length === 0, `no page errors${errors.length ? `:\n${errors.join("\n")}` : ""}`);
	console.log(`\nAll good. Screenshots in ${OUT}/`);
} finally {
	await browser.close();
}
