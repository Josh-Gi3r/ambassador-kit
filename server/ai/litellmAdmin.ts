import { ENV } from "../_core/env";
import type { AITier } from "./tierConfig";

// Low-level LiteLLM admin calls. All are dev-safe: if the proxy is not
// configured (no LITELLM_URL / master key) they no-op and return null/false
// so the rest of the app keeps working in dev and on this feature branch.

function configured(): boolean {
  return !!ENV.litellmUrl && !!ENV.litellmMasterKey;
}

/** Create a per-ambassador virtual key bound to the tier's budget. */
export async function issueLitellmKey(
  applicationId: number,
  handle: string,
  tier: AITier,
): Promise<string | null> {
  if (!configured() || tier === "none") return null;
  try {
    const res = await fetch(`${ENV.litellmUrl}/key/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.litellmMasterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: String(applicationId),
        key_alias: `ambassador-${tier}-${applicationId}`,
        budget_id: tier,
        metadata: { applicationId, handle, tier },
      }),
    });
    if (!res.ok) {
      console.warn(`[litellm] key/generate failed (${res.status}) for app ${applicationId}`);
      return null;
    }
    const data = (await res.json()) as { key?: string };
    return data.key ?? null;
  } catch (err) {
    console.warn(`[litellm] key/generate error for app ${applicationId}:`, err);
    return null;
  }
}

/** Move an existing key to a different tier budget (promotion/demotion). */
export async function updateLitellmKeyBudget(
  key: string,
  tier: AITier,
): Promise<boolean> {
  if (!configured() || tier === "none") return false;
  try {
    const res = await fetch(`${ENV.litellmUrl}/key/update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.litellmMasterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, budget_id: tier, metadata: { tier } }),
    });
    if (!res.ok) {
      console.warn(`[litellm] key/update failed (${res.status})`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[litellm] key/update error:", err);
    return false;
  }
}
