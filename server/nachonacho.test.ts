import { describe, it, expect } from "vitest";

const hasKey = !!process.env.NACHONACHO_API_KEY;

describe.skipIf(!hasKey)("NachoNacho API key", () => {
  it("should authenticate and fetch at least one product", async () => {
    const apiKey = process.env.NACHONACHO_API_KEY;
    expect(apiKey, "NACHONACHO_API_KEY must be set").toBeTruthy();

    // Step 1: Exchange API key for JWT
    const authRes = await fetch("https://public-api.nachonacho.com/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    expect(authRes.status, `Auth failed with status ${authRes.status}`).toBe(200);
    const { access_token } = await authRes.json() as { access_token: string };
    expect(access_token).toBeTruthy();

    // Step 2: Fetch products
    const prodRes = await fetch("https://public-api.nachonacho.com/products?page=1", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(prodRes.status, `Products fetch failed with status ${prodRes.status}`).toBe(200);
    const data = await prodRes.json() as { products: unknown[]; total: number };
    expect(Array.isArray(data.products)).toBe(true);
    expect(data.products.length).toBeGreaterThan(0);
  }, 15000);
});
