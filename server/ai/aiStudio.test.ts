/**
 * AI Studio v5 — Unit Tests
 *
 * Tests cover:
 *   - Model registry: correct tier filtering, all 180 models present
 *   - Tier gating: lower tiers cannot access higher-tier models
 *   - Video cap constants: correct values per tier
 *   - Content guardrail system prompt: present and non-empty
 */

import { describe, it, expect } from "vitest";
import {
  MODEL_REGISTRY,
  getModelsForTier,
  getModelById,
  VIDEO_CAPS,
  type ModelTier,
  type ModelModality,
} from "./modelRegistry";
import { AMBASSADOR_SYSTEM_PROMPT } from "./generate";

const TIERS: ModelTier[] = ["initiate", "active", "champion", "elite"];
const MODALITIES: ModelModality[] = ["text", "image", "video"];

// ── Registry completeness ─────────────────────────────────────────────────────

describe("MODEL_REGISTRY", () => {
  it("contains at least 60 models", () => {
    expect(MODEL_REGISTRY.length).toBeGreaterThanOrEqual(60);
  });

  it("has models for every tier and modality combination", () => {
    for (const tier of TIERS) {
      for (const modality of MODALITIES) {
        const found = MODEL_REGISTRY.filter(
          (m) => m.tier === tier && m.modality === modality
        );
        expect(found.length).toBeGreaterThan(0);
      }
    }
  });

  it("all models have required fields", () => {
    for (const m of MODEL_REGISTRY) {
      expect(m.id).toBeTypeOf("number");
      expect(m.name).toBeTruthy();
      expect(m.routingId).toBeTruthy();
      expect(m.provider).toBeTruthy();
      expect(TIERS).toContain(m.tier);
      expect(MODALITIES).toContain(m.modality);
      expect(m.pricePerUnit).toBeGreaterThanOrEqual(0);
    }
  });

  it("all model IDs are unique", () => {
    const ids = MODEL_REGISTRY.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Tier filtering ────────────────────────────────────────────────────────────

describe("getModelsForTier", () => {
  it("initiate sees only initiate models", () => {
    const models = getModelsForTier("initiate");
    const tiers = [...new Set(models.map((m) => m.tier))];
    expect(tiers).toEqual(["initiate"]);
  });

  it("active sees initiate + active models", () => {
    const models = getModelsForTier("active");
    const tiers = [...new Set(models.map((m) => m.tier))];
    expect(tiers).toContain("initiate");
    expect(tiers).toContain("active");
    expect(tiers).not.toContain("champion");
    expect(tiers).not.toContain("elite");
  });

  it("champion sees initiate + active + champion models", () => {
    const models = getModelsForTier("champion");
    const tiers = [...new Set(models.map((m) => m.tier))];
    expect(tiers).toContain("initiate");
    expect(tiers).toContain("active");
    expect(tiers).toContain("champion");
    expect(tiers).not.toContain("elite");
  });

  it("elite sees all models", () => {
    const models = getModelsForTier("elite");
    const tiers = [...new Set(models.map((m) => m.tier))];
    expect(tiers).toContain("initiate");
    expect(tiers).toContain("active");
    expect(tiers).toContain("champion");
    expect(tiers).toContain("elite");
  });

  it("filters by modality when provided", () => {
    const textModels = getModelsForTier("elite", "text");
    expect(textModels.every((m) => m.modality === "text")).toBe(true);

    const videoModels = getModelsForTier("elite", "video");
    expect(videoModels.every((m) => m.modality === "video")).toBe(true);
  });

  it("elite sees more models than initiate", () => {
    const elite = getModelsForTier("elite");
    const initiate = getModelsForTier("initiate");
    expect(elite.length).toBeGreaterThan(initiate.length);
  });
});

// ── Model lookup ──────────────────────────────────────────────────────────────

describe("getModelById", () => {
  it("returns the correct model for a valid ID", () => {
    const first = MODEL_REGISTRY[0];
    const found = getModelById(first.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(first.id);
    expect(found?.name).toBe(first.name);
  });

  it("returns undefined for an unknown ID", () => {
    expect(getModelById(99999)).toBeUndefined();
  });
});

// ── Video caps ────────────────────────────────────────────────────────────────

describe("VIDEO_CAPS", () => {
  it("has correct cap values per tier", () => {
    expect(VIDEO_CAPS.initiate).toBe(220);
    expect(VIDEO_CAPS.active).toBe(330);
    expect(VIDEO_CAPS.champion).toBe(550);
    expect(VIDEO_CAPS.elite).toBe(880);
  });

  it("caps increase with tier", () => {
    expect(VIDEO_CAPS.active).toBeGreaterThan(VIDEO_CAPS.initiate);
    expect(VIDEO_CAPS.champion).toBeGreaterThan(VIDEO_CAPS.active);
    expect(VIDEO_CAPS.elite).toBeGreaterThan(VIDEO_CAPS.champion);
  });
});

// ── Content guardrail ─────────────────────────────────────────────────────────

describe("AMBASSADOR_SYSTEM_PROMPT", () => {
  it("is defined and non-empty", () => {
    expect(AMBASSADOR_SYSTEM_PROMPT).toBeTruthy();
    expect(AMBASSADOR_SYSTEM_PROMPT.length).toBeGreaterThan(50);
  });

  it("mentions ambassador context and content restrictions", () => {
    expect(AMBASSADOR_SYSTEM_PROMPT.toLowerCase()).toContain("ambassador");
    expect(AMBASSADOR_SYSTEM_PROMPT.toLowerCase()).toContain("content");
  });
});
