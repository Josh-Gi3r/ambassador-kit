import { eq } from "drizzle-orm";
import { ambassadorApplications } from "../../drizzle/schema";
import { getDb } from "../db";
import { resolveTier, type XpTier } from "./tierConfig";
import { issueLitellmKey, updateLitellmKeyBudget } from "./litellmAdmin";

export type AiAccessInput = {
  id: number;
  level: number;
  currentTier?: XpTier | string | null;
  claimPending?: number | boolean | null;
  fraudFlag?: number | boolean | null;
  twitterHandle?: string | null;
  litellmKey?: string | null;
};

/**
 * Build Bible Step 11 — issue the per-ambassador LiteLLM key on L1 and
 * keep its budget reconciled to the requalifying current_tier. The daily
 * ledger cron owns ongoing tier-sync (Bible 9.6); this is the issuance
 * hook fired on L1 grant. NEVER throws (provisioning must not break
 * application flow) and is dev-safe (no-ops when LiteLLM is unconfigured).
 */
export async function syncAiAccess(app: AiAccessInput): Promise<void> {
  try {
    const accessTier = resolveTier({
      level: Number(app.level ?? 0),
      currentTier: app.currentTier,
      claimPending: app.claimPending,
      fraudFlag: app.fraudFlag,
    });
    if (accessTier === "none") return;

    const db = await getDb();
    if (!db) return;

    if (!app.litellmKey) {
      const key = await issueLitellmKey(
        app.id,
        app.twitterHandle ?? String(app.id),
        accessTier,
      );
      if (key) {
        await db
          .update(ambassadorApplications)
          .set({ litellmKey: key, litellmKeyIssuedAt: new Date() })
          .where(eq(ambassadorApplications.id, app.id));
      }
      return;
    }

    // Key exists — make sure its budget matches the current tier.
    await updateLitellmKeyBudget(app.litellmKey, accessTier);
  } catch (err) {
    console.warn(`[ai] syncAiAccess failed for app ${app?.id}:`, err);
  }
}
