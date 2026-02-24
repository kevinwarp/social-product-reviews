import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ─── Browser Pool Management ──────────────────────────────────────────────────

let browserInstance: Browser | null = null;
const contexts: Map<string, BrowserContext> = new Map();

/**
 * Get or create a shared browser instance.
 * Singleton pattern to avoid multiple browser launches.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log("[Browser] Launching Chromium...");
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--no-sandbox",
      ],
    });
  }
  return browserInstance;
}

/**
 * Create a new browser context with stealth settings.
 * Contexts are isolated browsing sessions (cookies, storage, etc.)
 */
export async function createContext(options?: {
  userAgent?: string;
  viewport?: { width: number; height: number };
}): Promise<BrowserContext> {
  const browser = await getBrowser();

  const userAgent =
    options?.userAgent ||
    randomUserAgent();

  const viewport = options?.viewport || {
    width: 1920,
    height: 1080,
  };

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: "en-US",
    timezoneId: "America/New_York",
    permissions: [],
    // Anti-detection: pretend we're a real browser
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
    },
  });

  // Remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });

  return context;
}

/**
 * Get or create a named context (useful for domain-specific contexts).
 */
export async function getContext(name: string): Promise<BrowserContext> {
  if (contexts.has(name)) {
    return contexts.get(name)!;
  }

  const context = await createContext();
  contexts.set(name, context);
  return context;
}

/**
 * Create a new page with error handling and timeout configuration.
 */
export async function createPage(
  context?: BrowserContext
): Promise<Page> {
  const ctx = context || (await getContext("default"));
  const page = await ctx.newPage();

  // Set default navigation timeout
  page.setDefaultNavigationTimeout(30000); // 30s
  page.setDefaultTimeout(15000); // 15s for other operations

  // Capture console logs from page
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`[Page Console]`, msg.text());
    }
  });

  // Capture page errors
  page.on("pageerror", (error) => {
    console.error(`[Page Error]`, error.message);
  });

  return page;
}

/**
 * Navigate to URL with retry logic and error handling.
 */
export async function navigateWithRetry(
  page: Page,
  url: string,
  options?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    maxRetries?: number;
  }
): Promise<boolean> {
  const { waitUntil = "domcontentloaded", maxRetries = 2 } = options || {};

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      await page.goto(url, { waitUntil });
      return true;
    } catch (error) {
      console.warn(
        `[Browser] Navigation attempt ${attempt} failed for ${url}:`,
        error instanceof Error ? error.message : error
      );

      if (attempt === maxRetries + 1) {
        console.error(`[Browser] Failed to navigate to ${url} after ${maxRetries + 1} attempts`);
        return false;
      }

      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  return false;
}

/**
 * Close a specific context.
 */
export async function closeContext(name: string): Promise<void> {
  const context = contexts.get(name);
  if (context) {
    await context.close();
    contexts.delete(name);
  }
}

/**
 * Close all contexts and browser instance.
 * Call this on application shutdown.
 */
export async function closeBrowser(): Promise<void> {
  console.log("[Browser] Closing all contexts and browser...");

  for (const [name, context] of contexts) {
    await context.close();
    contexts.delete(name);
  }

  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Take a screenshot for debugging (saved to screenshots/)
 */
export async function debugScreenshot(
  page: Page,
  name: string
): Promise<void> {
  const path = `screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`[Browser] Screenshot saved: ${path}`);
}

/**
 * Wait for a random time to simulate human behavior
 */
export async function humanDelay(
  minMs: number = 500,
  maxMs: number = 2000
): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
