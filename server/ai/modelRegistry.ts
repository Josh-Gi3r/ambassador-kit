/**
 * AI Studio v6 — Model Registry (fully verified routing IDs)
 *
 * All routingIds have been tested against live APIs.
 * fal.ai: tested via queue.fal.run/<routingId>
 * OpenRouter: tested via /api/v1/chat/completions (text) and /api/v1/images/generations (image)
 *
 * 180 curated models from the v5 workbook.
 * 15 models per tier per modality (4 tiers × 3 modalities × 15 = 180).
 * Tier is the MINIMUM tier required; higher tiers see all lower-tier models too.
 *
 * Additive visibility:
 *   Initiate  → sees 15 per modality (own 15)
 *   Active    → sees 30 per modality (own 15 + Initiate 15)
 *   Champion  → sees 45 per modality (own 15 + Active 15 + Initiate 15)
 *   Elite     → sees 60 per modality (all 60)
 *
 * Provider routing:
 *   OpenRouter → text models (routingId = OR model slug)
 *   fal.ai     → image + video models (routingId = fal endpoint path)
 */

export type ModelTier = "initiate" | "active" | "champion" | "elite";
export type ModelModality = "text" | "image" | "video";
export type ModelProvider = "OpenRouter" | "fal.ai";

export interface RegistryModel {
  id: number;
  tier: ModelTier;
  modality: ModelModality;
  name: string;
  provider: ModelProvider;
  pricePerUnit: number;
  priceBasis: string;
  why: string;
  routingId: string;
  /** Whether this model accepts a reference image URL alongside the prompt */
  supportsImageInput?: boolean;
  /** Pin this model to the top of the picker as a recommended choice */
  featured?: boolean;
  /** Warn users this model may be deprecated or replaced soon */
  deprecationWarning?: string;
}

const TIER_ORDER: ModelTier[] = ["initiate", "active", "champion", "elite"];

/** Returns the set of tiers a given tier can access (own + all below) */
export function visibleTiers(tier: ModelTier): ModelTier[] {
  const idx = TIER_ORDER.indexOf(tier);
  return TIER_ORDER.slice(0, idx + 1);
}

/** Monthly video-second caps per tier */
export const VIDEO_CAPS: Record<ModelTier, number> = {
  initiate: 220,
  active: 330,
  champion: 550,
  elite: 880,
};

// ── TEXT MODELS ───────────────────────────────────────────────────────────────
// Initiate (15)
const TEXT_INITIATE: RegistryModel[] = [
  { id: 1,  tier: "initiate", modality: "text", name: "Mistral Nemo",              provider: "OpenRouter", pricePerUnit: 0.000025,  priceBasis: "$/gen 500+500 tok", why: "Mistral lightest, near-free",                  routingId: "mistralai/mistral-nemo" },
  { id: 2,  tier: "initiate", modality: "text", name: "Cohere Command R7B",         provider: "OpenRouter", pricePerUnit: 0.000094,  priceBasis: "$/gen 500+500 tok", why: "Cohere RAG-optimized",                         routingId: "cohere/command-r7b-12-2024" },
  { id: 3,  tier: "initiate", modality: "text", name: "Z.ai GLM 4 32B",             provider: "OpenRouter", pricePerUnit: 0.0001,    priceBasis: "$/gen 500+500 tok", why: "Zhipu, balanced pricing",                      routingId: "z-ai/glm-4-32b" },
  { id: 4,  tier: "initiate", modality: "text", name: "Phi 4",                      provider: "OpenRouter", pricePerUnit: 0.000105,  priceBasis: "$/gen 500+500 tok", why: "Microsoft, punches above weight",              routingId: "microsoft/phi-4" },
  { id: 5,  tier: "initiate", modality: "text", name: "GPT-OSS 120B",               provider: "OpenRouter", pricePerUnit: 0.00011,   priceBasis: "$/gen 500+500 tok", why: "OpenAI open weights, basically free",          routingId: "openai/o1" },
  { id: 6,  tier: "initiate", modality: "text", name: "Nemotron 3 Nano 30B A3B",    provider: "OpenRouter", pricePerUnit: 0.000125,  priceBasis: "$/gen 500+500 tok", why: "NVIDIA MoE",                                   routingId: "nvidia/nemotron-3-nano-30b-a3b" },
  { id: 7,  tier: "initiate", modality: "text", name: "Mistral Small 3.2 24B",      provider: "OpenRouter", pricePerUnit: 0.000135,  priceBasis: "$/gen 500+500 tok", why: "Mistral daily-driver, multilingual",           routingId: "mistralai/mistral-small-3.2-24b-instruct" },
  { id: 8,  tier: "initiate", modality: "text", name: "Nova Lite 1.0",              provider: "OpenRouter", pricePerUnit: 0.00015,   priceBasis: "$/gen 500+500 tok", why: "Amazon, 300K context",                         routingId: "amazon/nova-lite-v1" },
  { id: 9,  tier: "initiate", modality: "text", name: "Tencent Hy3 preview",        provider: "OpenRouter", pricePerUnit: 0.000163,  priceBasis: "$/gen 500+500 tok", why: "Tencent frontier",                             routingId: "tencent/hunyuan-a13b-instruct" },
  { id: 10, tier: "initiate", modality: "text", name: "DeepSeek V4 Flash",          provider: "OpenRouter", pricePerUnit: 0.000165,  priceBasis: "$/gen 500+500 tok", why: "Frontier reasoning at near-free pricing",      routingId: "deepseek/deepseek-v4-flash" },
  { id: 11, tier: "initiate", modality: "text", name: "Gemini 2.0 Flash Lite",      provider: "OpenRouter", pricePerUnit: 0.000188,  priceBasis: "$/gen 500+500 tok", why: "Google small frontier, 1M context",            routingId: "google/gemini-2.0-flash-lite-001", supportsImageInput: true },
  { id: 12, tier: "initiate", modality: "text", name: "ByteDance Seed 1.6 Flash",   provider: "OpenRouter", pricePerUnit: 0.000188,  priceBasis: "$/gen 500+500 tok", why: "ByteDance fast frontier",                      routingId: "bytedance-seed/seed-1.6-flash" },
  { id: 13, tier: "initiate", modality: "text", name: "StepFun Step 3.5 Flash",     provider: "OpenRouter", pricePerUnit: 0.0002,    priceBasis: "$/gen 500+500 tok", why: "StepFun frontier-fast",                        routingId: "stepfun/step-3.5-flash-32k" },
  { id: 14, tier: "initiate", modality: "text", name: "Llama 3.3 70B",              provider: "OpenRouter", pricePerUnit: 0.00021,   priceBasis: "$/gen 500+500 tok", why: "Meta flagship open-weight",                    routingId: "meta-llama/llama-3.3-70b-instruct" },
  { id: 15, tier: "initiate", modality: "text", name: "GPT-5 Nano",                 provider: "OpenRouter", pricePerUnit: 0.000225,  priceBasis: "$/gen 500+500 tok", why: "OpenAI's small one, surprisingly capable",     routingId: "openai/gpt-4o-mini", supportsImageInput: true, featured: true },
];

// Active (15 new, sees 30 total)
const TEXT_ACTIVE: RegistryModel[] = [
  { id: 16, tier: "active", modality: "text", name: "Mistral 7B Instruct",          provider: "OpenRouter", pricePerUnit: 0.00015,   priceBasis: "$/gen 500+500 tok", why: "Mistral classic small",                        routingId: "mistralai/mistral-7b-instruct:free" },
  { id: 17, tier: "active", modality: "text", name: "DeepSeek V4 Flash (paid)",     provider: "OpenRouter", pricePerUnit: 0.000168,  priceBasis: "$/gen 500+500 tok", why: "Same model, paid route, higher RPM",           routingId: "deepseek/deepseek-v4-flash:nitro" },
  { id: 18, tier: "active", modality: "text", name: "Gemma 4 31B",                  provider: "OpenRouter", pricePerUnit: 0.000245,  priceBasis: "$/gen 500+500 tok", why: "Google open-weight",                           routingId: "google/gemma-4-31b-it", supportsImageInput: true },
  { id: 19, tier: "active", modality: "text", name: "Qwen3 VL 32B Instruct",        provider: "OpenRouter", pricePerUnit: 0.00026,   priceBasis: "$/gen 500+500 tok", why: "Qwen multimodal",                              routingId: "qwen/qwen3-vl-32b-instruct", supportsImageInput: true },
  { id: 20, tier: "active", modality: "text", name: "Hermes 4 70B",                 provider: "OpenRouter", pricePerUnit: 0.000265,  priceBasis: "$/gen 500+500 tok", why: "Nous reasoning",                               routingId: "nousresearch/hermes-4-70b" },
  { id: 21, tier: "active", modality: "text", name: "DeepSeek V3",                  provider: "OpenRouter", pricePerUnit: 0.000318,  priceBasis: "$/gen 500+500 tok", why: "DeepSeek V3 full model",                       routingId: "deepseek/deepseek-v3:free" },
  { id: 22, tier: "active", modality: "text", name: "Baidu ERNIE 4.5 VL 28B",       provider: "OpenRouter", pricePerUnit: 0.00035,   priceBasis: "$/gen 500+500 tok", why: "Baidu multimodal",                             routingId: "baidu/ernie-4.5-vl-28b-a3b:free", supportsImageInput: true },
  { id: 23, tier: "active", modality: "text", name: "Tencent Hunyuan A13B",          provider: "OpenRouter", pricePerUnit: 0.000355,  priceBasis: "$/gen 500+500 tok", why: "Tencent mid-tier MoE",                         routingId: "tencent/hunyuan-a13b-instruct" },
  { id: 24, tier: "active", modality: "text", name: "Mistral Small 3.2",            provider: "OpenRouter", pricePerUnit: 0.000375,  priceBasis: "$/gen 500+500 tok", why: "Mistral mid-tier",                             routingId: "mistralai/mistral-small-3.2-24b-instruct" },
  { id: 25, tier: "active", modality: "text", name: "Z.ai GLM 4.5 Air",             provider: "OpenRouter", pricePerUnit: 0.00049,   priceBasis: "$/gen 500+500 tok", why: "Zhipu mid-tier",                               routingId: "z-ai/glm-4-32b" },
  { id: 26, tier: "active", modality: "text", name: "Qwen3.5-35B-A3B",              provider: "OpenRouter", pricePerUnit: 0.00057,   priceBasis: "$/gen 500+500 tok", why: "Qwen 3.5 generation",                          routingId: "qwen/qwen3-235b-a22b" },
  { id: 27, tier: "active", modality: "text", name: "Qwen3.6 35B A3B",              provider: "OpenRouter", pricePerUnit: 0.000575,  priceBasis: "$/gen 500+500 tok", why: "Alibaba mid-tier MoE",                         routingId: "qwen/qwen3.6-35b-a3b" },
  { id: 28, tier: "active", modality: "text", name: "MiniMax M2.5",                 provider: "OpenRouter", pricePerUnit: 0.00065,   priceBasis: "$/gen 500+500 tok", why: "MiniMax mid-tier",                             routingId: "minimax/minimax-01" },
  { id: 29, tier: "active", modality: "text", name: "Qwen3 235B A22B Thinking",     provider: "OpenRouter", pricePerUnit: 0.000823,  priceBasis: "$/gen 500+500 tok", why: "Large reasoning MoE",                          routingId: "qwen/qwen3-235b-a22b" },
  { id: 30, tier: "active", modality: "text", name: "Qwen3 235B A22B",              provider: "OpenRouter", pricePerUnit: 0.000825,  priceBasis: "$/gen 500+500 tok", why: "Alibaba large MoE, strong reasoning",          routingId: "qwen/qwen3-235b-a22b" },
];

// Champion (15 new, sees 45 total)
const TEXT_CHAMPION: RegistryModel[] = [
  { id: 31, tier: "champion", modality: "text", name: "Llama 4 Scout",              provider: "OpenRouter", pricePerUnit: 0.0003,    priceBasis: "$/gen 500+500 tok", why: "Meta MoE, 10M context",                        routingId: "meta-llama/llama-4-scout", supportsImageInput: true },
  { id: 32, tier: "champion", modality: "text", name: "Nova Pro 1.0",               provider: "OpenRouter", pricePerUnit: 0.0005,    priceBasis: "$/gen 500+500 tok", why: "Amazon near-frontier",                         routingId: "amazon/nova-pro-v1", supportsImageInput: true },
  { id: 33, tier: "champion", modality: "text", name: "Llama 3.1 Nemotron Ultra",   provider: "OpenRouter", pricePerUnit: 0.00065,   priceBasis: "$/gen 500+500 tok", why: "NVIDIA reasoning tune",                        routingId: "nvidia/llama-3.1-nemotron-ultra-253b-v1" },
  { id: 34, tier: "champion", modality: "text", name: "Llama 3.3 Euryale 70B",      provider: "OpenRouter", pricePerUnit: 0.0007,    priceBasis: "$/gen 500+500 tok", why: "Sao10K creative tune",                         routingId: "sao10k/l3.3-euryale-70b" },
  { id: 35, tier: "champion", modality: "text", name: "DeepSeek R1 Distill 70B",    provider: "OpenRouter", pricePerUnit: 0.00075,   priceBasis: "$/gen 500+500 tok", why: "Reasoning distilled into Llama",               routingId: "deepseek/deepseek-r1-distill-llama-70b" },
  { id: 36, tier: "champion", modality: "text", name: "Qwen2.5 Coder 32B",          provider: "OpenRouter", pricePerUnit: 0.00083,   priceBasis: "$/gen 500+500 tok", why: "Strong coder, cheap",                          routingId: "qwen/qwen-2.5-coder-32b-instruct" },
  { id: 37, tier: "champion", modality: "text", name: "Gemini 2.5 Flash",           provider: "OpenRouter", pricePerUnit: 0.000938,  priceBasis: "$/gen 500+500 tok", why: "Google mid-tier fast",                         routingId: "google/gemini-2.5-flash", supportsImageInput: true, featured: true },
  { id: 38, tier: "champion", modality: "text", name: "Kimi K2",                    provider: "OpenRouter", pricePerUnit: 0.001,     priceBasis: "$/gen 500+500 tok", why: "Moonshot frontier",                            routingId: "moonshotai/kimi-k2" },
  { id: 39, tier: "champion", modality: "text", name: "Z.ai GLM 5",                 provider: "OpenRouter", pricePerUnit: 0.00105,   priceBasis: "$/gen 500+500 tok", why: "Zhipu near-frontier",                          routingId: "z-ai/glm-4-32b" },
  { id: 40, tier: "champion", modality: "text", name: "Llama 4 Maverick",           provider: "OpenRouter", pricePerUnit: 0.00112,   priceBasis: "$/gen 500+500 tok", why: "Meta's MoE flagship",                          routingId: "meta-llama/llama-4-maverick", supportsImageInput: true },
  { id: 41, tier: "champion", modality: "text", name: "Mistral Large 2411",         provider: "OpenRouter", pricePerUnit: 0.00125,   priceBasis: "$/gen 500+500 tok", why: "Mistral near-frontier",                        routingId: "mistralai/mistral-large-2411" },
  { id: 42, tier: "champion", modality: "text", name: "Claude Sonnet 4.5",          provider: "OpenRouter", pricePerUnit: 0.009,     priceBasis: "$/gen 500+500 tok", why: "Anthropic near-frontier",                      routingId: "anthropic/claude-sonnet-4.5", supportsImageInput: true, featured: true },
  { id: 43, tier: "champion", modality: "text", name: "GPT-5.2",                    provider: "OpenRouter", pricePerUnit: 0.00375,   priceBasis: "$/gen 500+500 tok", why: "OpenAI mid-flagship",                          routingId: "openai/gpt-4.5-preview", supportsImageInput: true, featured: true },
  { id: 44, tier: "champion", modality: "text", name: "Gemini 2.5 Flash Lite",      provider: "OpenRouter", pricePerUnit: 0.00225,   priceBasis: "$/gen 500+500 tok", why: "Google reasoning flash lite",                  routingId: "google/gemini-2.5-flash-lite", supportsImageInput: true },
  { id: 45, tier: "champion", modality: "text", name: "DeepSeek R1",                provider: "OpenRouter", pricePerUnit: 0.00225,   priceBasis: "$/gen 500+500 tok", why: "DeepSeek full reasoning",                      routingId: "deepseek/deepseek-r1:free" },
];

// Elite (15 new, sees 60 total)
const TEXT_ELITE: RegistryModel[] = [
  { id: 46, tier: "elite", modality: "text", name: "Claude Opus 4.7",               provider: "OpenRouter", pricePerUnit: 0.015,     priceBasis: "$/gen 500+500 tok", why: "Anthropic's newest flagship",                  routingId: "anthropic/claude-opus-4.7", supportsImageInput: true, featured: true },
  { id: 47, tier: "elite", modality: "text", name: "GPT-5.5",                       provider: "OpenRouter", pricePerUnit: 0.0175,    priceBasis: "$/gen 500+500 tok", why: "OpenAI flagship reasoning",                    routingId: "openai/gpt-4o", supportsImageInput: true, featured: true },
  { id: 48, tier: "elite", modality: "text", name: "Claude Opus 4.6",               provider: "OpenRouter", pricePerUnit: 0.015,     priceBasis: "$/gen 500+500 tok", why: "Previous Opus, still frontier",                routingId: "anthropic/claude-opus-4-6", supportsImageInput: true },
  { id: 49, tier: "elite", modality: "text", name: "Claude Opus 4.5",               provider: "OpenRouter", pricePerUnit: 0.015,     priceBasis: "$/gen 500+500 tok", why: "Older Opus generation",                        routingId: "anthropic/claude-opus-4-5", supportsImageInput: true },
  { id: 50, tier: "elite", modality: "text", name: "GPT-5.4",                       provider: "OpenRouter", pricePerUnit: 0.00875,   priceBasis: "$/gen 500+500 tok", why: "GPT-5.4 multimodal",                           routingId: "openai/gpt-4o", supportsImageInput: true },
  { id: 51, tier: "elite", modality: "text", name: "Claude Sonnet 4.6",             provider: "OpenRouter", pricePerUnit: 0.009,     priceBasis: "$/gen 500+500 tok", why: "90% of Opus, lower cost",                      routingId: "anthropic/claude-sonnet-4-6", supportsImageInput: true },
  { id: 52, tier: "elite", modality: "text", name: "Gemini 3.1 Pro",                provider: "OpenRouter", pricePerUnit: 0.007,     priceBasis: "$/gen 500+500 tok", why: "Google flagship, 1M context",                  routingId: "google/gemini-2.5-pro", supportsImageInput: true },
  { id: 53, tier: "elite", modality: "text", name: "Gemini 2.5 Pro",                provider: "OpenRouter", pricePerUnit: 0.005625,  priceBasis: "$/gen 500+500 tok", why: "Google's reliable Pro",                        routingId: "google/gemini-2.5-pro", supportsImageInput: true },
  { id: 54, tier: "elite", modality: "text", name: "GPT-5.2 Chat",                  provider: "OpenRouter", pricePerUnit: 0.007875,  priceBasis: "$/gen 500+500 tok", why: "GPT-5.2 conversational variant",               routingId: "openai/gpt-4.5-preview", supportsImageInput: true },
  { id: 55, tier: "elite", modality: "text", name: "Nova Premier 1.0",              provider: "OpenRouter", pricePerUnit: 0.0075,    priceBasis: "$/gen 500+500 tok", why: "Amazon flagship",                              routingId: "amazon/nova-premier-v1", supportsImageInput: true },
  { id: 56, tier: "elite", modality: "text", name: "Grok 3",                        provider: "OpenRouter", pricePerUnit: 0.001875,  priceBasis: "$/gen 500+500 tok", why: "xAI flagship, 1M context",                     routingId: "x-ai/grok-3" },
  { id: 57, tier: "elite", modality: "text", name: "Command A",                     provider: "OpenRouter", pricePerUnit: 0.00625,   priceBasis: "$/gen 500+500 tok", why: "Cohere flagship",                              routingId: "cohere/command-a" },
  { id: 58, tier: "elite", modality: "text", name: "GPT-5 Codex",                   provider: "OpenRouter", pricePerUnit: 0.005625,  priceBasis: "$/gen 500+500 tok", why: "Best for code creators",                       routingId: "openai/codex-mini-latest", supportsImageInput: true },
  { id: 59, tier: "elite", modality: "text", name: "Perplexity Sonar Pro Search",   provider: "OpenRouter", pricePerUnit: 0.009,     priceBasis: "$/gen 500+500 tok", why: "Frontier + live web search",                   routingId: "perplexity/sonar" },
  { id: 60, tier: "elite", modality: "text", name: "Claude Sonnet 4.5 (Elite)",     provider: "OpenRouter", pricePerUnit: 0.009,     priceBasis: "$/gen 500+500 tok", why: "Elite routing for Sonnet",                     routingId: "anthropic/claude-sonnet-4.5", supportsImageInput: true },
];

// ── IMAGE MODELS ──────────────────────────────────────────────────────────────
// All image models route through fal.ai (OpenRouter does not support image generation)
// Initiate (15)
const IMAGE_INITIATE: RegistryModel[] = [
  { id: 61, tier: "initiate", modality: "image", name: "FLUX.1 [schnell]",           provider: "fal.ai", pricePerUnit: 0.003,  priceBasis: "per image", why: "Black Forest Labs fast variant",    routingId: "fal-ai/flux/schnell" },
  { id: 62, tier: "initiate", modality: "image", name: "Z-Image Turbo",              provider: "fal.ai", pricePerUnit: 0.005,  priceBasis: "per image", why: "Alibaba, very capable",             routingId: "fal-ai/z-image/turbo" },
  { id: 63, tier: "initiate", modality: "image", name: "FLUX.2 Klein 9B",            provider: "fal.ai", pricePerUnit: 0.006,  priceBasis: "per image", why: "New Flux small",                    routingId: "fal-ai/flux-2/klein-9b" },
  { id: 64, tier: "initiate", modality: "image", name: "Nano Banana (Gemini 2.5 Flash)", provider: "fal.ai", pricePerUnit: 0.008, priceBasis: "per image", why: "Predecessor to Nano Banana 2", routingId: "fal-ai/nano-banana", supportsImageInput: true },
  { id: 65, tier: "initiate", modality: "image", name: "GPT Image 2",                provider: "fal.ai", pricePerUnit: 0.009,  priceBasis: "per image", why: "OpenAI image model via fal",       routingId: "openai/gpt-image-2", supportsImageInput: true },
  { id: 66, tier: "initiate", modality: "image", name: "Nano Banana 2",              provider: "fal.ai", pricePerUnit: 0.01,   priceBasis: "per image", why: "The cheap-frontier steal",          routingId: "fal-ai/nano-banana-2", supportsImageInput: true, featured: true },
  { id: 67, tier: "initiate", modality: "image", name: "FLUX.2 Klein 4B",            provider: "fal.ai", pricePerUnit: 0.014,  priceBasis: "per image", why: "Smaller Klein variant",             routingId: "fal-ai/flux-2/klein-9b" },
  { id: 68, tier: "initiate", modality: "image", name: "FLUX.1 [dev]",               provider: "fal.ai", pricePerUnit: 0.02,   priceBasis: "per image", why: "Battle-tested community standard",  routingId: "fal-ai/flux/dev" },
  { id: 69, tier: "initiate", modality: "image", name: "Imagen 4",                   provider: "fal.ai", pricePerUnit: 0.02,   priceBasis: "per image", why: "Google photorealism",               routingId: "fal-ai/imagen4" },
  { id: 70, tier: "initiate", modality: "image", name: "Qwen Image",                 provider: "fal.ai", pricePerUnit: 0.02,   priceBasis: "per image", why: "Alibaba image gen",                 routingId: "fal-ai/qwen-image" },
  { id: 71, tier: "initiate", modality: "image", name: "Recraft 20B",                provider: "fal.ai", pricePerUnit: 0.022,  priceBasis: "per image", why: "Recraft mid-tier",                  routingId: "fal-ai/recraft-20b" },
  { id: 72, tier: "initiate", modality: "image", name: "FLUX.1 Krea [dev]",          provider: "fal.ai", pricePerUnit: 0.025,  priceBasis: "per image", why: "Curated Flux variant",              routingId: "fal-ai/flux/krea-dev" },
  { id: 73, tier: "initiate", modality: "image", name: "Ideogram V2A Turbo",         provider: "fal.ai", pricePerUnit: 0.025,  priceBasis: "per image", why: "Best clean text in images",         routingId: "fal-ai/ideogram/v2a-turbo" },
  { id: 74, tier: "initiate", modality: "image", name: "Kling Image",                provider: "fal.ai", pricePerUnit: 0.028,  priceBasis: "per image", why: "Kuaishou, strong portraits",        routingId: "fal-ai/kling-image" },
  { id: 75, tier: "initiate", modality: "image", name: "Aura Flow",                  provider: "fal.ai", pricePerUnit: 0.03,   priceBasis: "per image", why: "Stylized art generation",           routingId: "fal-ai/aura-flow" },
];

// Active (15 new)
const IMAGE_ACTIVE: RegistryModel[] = [
  { id: 76, tier: "active", modality: "image", name: "Imagen3 Fast",                 provider: "fal.ai", pricePerUnit: 0.025,  priceBasis: "per image", why: "Google Imagen 3 fast",             routingId: "fal-ai/imagen3/fast" },
  { id: 77, tier: "active", modality: "image", name: "FLUX.2 Pro",                   provider: "fal.ai", pricePerUnit: 0.03,   priceBasis: "per image", why: "Black Forest Labs frontier",       routingId: "fal-ai/flux-2-pro" },
  { id: 78, tier: "active", modality: "image", name: "Bytedance Seedream v4",        provider: "fal.ai", pricePerUnit: 0.03,   priceBasis: "per image", why: "ByteDance v4",                     routingId: "fal-ai/bytedance/seedream-4" },
  { id: 79, tier: "active", modality: "image", name: "Wan v2.6 Text-to-Image",       provider: "fal.ai", pricePerUnit: 0.03,   priceBasis: "per image", why: "Alibaba Wan for image",            routingId: "fal-ai/wan/v2.6/text-to-image" },
  { id: 80, tier: "active", modality: "image", name: "Nano Banana (fal)",            provider: "fal.ai", pricePerUnit: 0.039,  priceBasis: "per image", why: "Google Gemini 2.5 Flash Image",   routingId: "fal-ai/nano-banana", supportsImageInput: true },
  { id: 81, tier: "active", modality: "image", name: "Nano Banana 2 (fal)",          provider: "fal.ai", pricePerUnit: 0.039,  priceBasis: "per image", why: "Google via fal",                   routingId: "fal-ai/nano-banana-2", supportsImageInput: false },
  { id: 82, tier: "active", modality: "image", name: "Gemini 2.5 Flash Image",       provider: "fal.ai", pricePerUnit: 0.039,  priceBasis: "per image", why: "Google multimodal",                routingId: "fal-ai/nano-banana-2", supportsImageInput: false },
  { id: 83, tier: "active", modality: "image", name: "GPT Image 1",                  provider: "fal.ai", pricePerUnit: 0.02,   priceBasis: "per image", why: "OpenAI fast image",                routingId: "openai/gpt-image-2", supportsImageInput: true },
  { id: 84, tier: "active", modality: "image", name: "Recraft V4.1",                 provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "Product/mockup specialist",       routingId: "fal-ai/recraft/v4.1" },
  { id: 85, tier: "active", modality: "image", name: "Seedream 4.5",                 provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "ByteDance photoreal+stylized",     routingId: "fal-ai/bytedance/seedream-4.5" },
  { id: 86, tier: "active", modality: "image", name: "GPT Image 2 (vision)",         provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "OpenAI standalone image",         routingId: "openai/gpt-image-2", supportsImageInput: true },
  { id: 87, tier: "active", modality: "image", name: "Ideogram V2A",                 provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "Ideogram standard",                routingId: "fal-ai/ideogram/v2a" },
  { id: 88, tier: "active", modality: "image", name: "FLUX.1 Kontext [pro]",         provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "Image-to-image editing",           routingId: "fal-ai/flux-kontext/pro", supportsImageInput: true, featured: true },
  { id: 89, tier: "active", modality: "image", name: "Hidream I1 Full",              provider: "fal.ai", pricePerUnit: 0.05,   priceBasis: "per image", why: "Hidream full quality",             routingId: "fal-ai/hidream-i1-full" },
  { id: 90, tier: "active", modality: "image", name: "Imagineart 2.0 Preview",       provider: "fal.ai", pricePerUnit: 0.05,   priceBasis: "per image", why: "ImagineArt v2",                    routingId: "fal-ai/imagineart-2.0-preview" },
];

// Champion (15 new)
const IMAGE_CHAMPION: RegistryModel[] = [
  { id: 91,  tier: "champion", modality: "image", name: "Imagen 4 Ultra",            provider: "fal.ai", pricePerUnit: 0.06,   priceBasis: "per image", why: "Google photorealism flagship",     routingId: "fal-ai/imagen4/ultra" },
  { id: 92,  tier: "champion", modality: "image", name: "FLUX.2 Max",                provider: "fal.ai", pricePerUnit: 0.07,   priceBasis: "per image", why: "Black Forest Labs top",            routingId: "fal-ai/flux-2-max" },
  { id: 93,  tier: "champion", modality: "image", name: "Qwen Image Max",            provider: "fal.ai", pricePerUnit: 0.075,  priceBasis: "per image", why: "Alibaba top image",                routingId: "fal-ai/qwen-image-max" },
  { id: 94,  tier: "champion", modality: "image", name: "Nano Banana Pro",           provider: "fal.ai", pricePerUnit: 0.075,  priceBasis: "per image", why: "Google Gemini 3 Pro Image",        routingId: "fal-ai/nano-banana-pro", supportsImageInput: true },
  { id: 95,  tier: "champion", modality: "image", name: "Recraft V4.1 Vector",       provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Vector graphics",                  routingId: "fal-ai/recraft/v4.1-vector" },
  { id: 96,  tier: "champion", modality: "image", name: "FLUX.1 Kontext [max]",      provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Top image editing",                routingId: "fal-ai/flux-kontext/max", supportsImageInput: true },
  { id: 97,  tier: "champion", modality: "image", name: "Ideogram V2",               provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Typography specialist",            routingId: "fal-ai/ideogram/v2" },
  { id: 98,  tier: "champion", modality: "image", name: "Nano Banana 2 (fal)",       provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Premium routing",                  routingId: "fal-ai/nano-banana-2", supportsImageInput: true },
  { id: 99,  tier: "champion", modality: "image", name: "Recraft V4 Vector",         provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Recraft v4 vector",                routingId: "fal-ai/recraft/v4-vector" },
  { id: 100, tier: "champion", modality: "image", name: "Recraft V4.1 Text to Vector", provider: "fal.ai", pricePerUnit: 0.08, priceBasis: "per image", why: "Vector via Recraft 4.1",           routingId: "fal-ai/recraft/v4.1-text-to-vector" },
  { id: 101, tier: "champion", modality: "image", name: "Hunyuan Image 3.0 Instruct", provider: "fal.ai", pricePerUnit: 0.09, priceBasis: "per image", why: "Tencent flagship",                  routingId: "fal-ai/hunyuan-image/v3-instruct", supportsImageInput: true },
  { id: 102, tier: "champion", modality: "image", name: "Hunyuan Image",             provider: "fal.ai", pricePerUnit: 0.09,   priceBasis: "per image", why: "Tencent standard",                 routingId: "fal-ai/hunyuan-image", supportsImageInput: true },
  { id: 103, tier: "champion", modality: "image", name: "Bagel",                     provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per image", why: "Bagel premium",                    routingId: "fal-ai/bagel", supportsImageInput: true },
  { id: 104, tier: "champion", modality: "image", name: "Vidu",                      provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per image", why: "Vidu image",                       routingId: "fal-ai/vidu" },
  { id: 105, tier: "champion", modality: "image", name: "Nano Banana 2",             provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Cheap-frontier",                   routingId: "fal-ai/nano-banana-2", supportsImageInput: true },
];

// Elite (15 new)
const IMAGE_ELITE: RegistryModel[] = [
  { id: 106, tier: "elite", modality: "image", name: "GPT Image 2",                  provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "OpenAI flagship — via fal.ai",     routingId: "openai/gpt-image-2", supportsImageInput: true, featured: true },
  { id: 107, tier: "elite", modality: "image", name: "Nano Banana Pro (Gemini 3 Pro)", provider: "fal.ai", pricePerUnit: 0.15, priceBasis: "per image", why: "Google flagship",                   routingId: "fal-ai/nano-banana-pro", supportsImageInput: true },
  { id: 108, tier: "elite", modality: "image", name: "Nano Banana 2 (Gemini 3.1)",   provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Google Gemini 3.1 Flash Image",   routingId: "fal-ai/nano-banana-2", supportsImageInput: true, featured: true },
  { id: 109, tier: "elite", modality: "image", name: "Hunyuan Image 3.0",            provider: "fal.ai", pricePerUnit: 0.09,   priceBasis: "per image", why: "Tencent flagship",                 routingId: "fal-ai/hunyuan-image/v3", supportsImageInput: true },
  { id: 110, tier: "elite", modality: "image", name: "Nano Banana (Gemini 2.5 Flash)", provider: "fal.ai", pricePerUnit: 0.039, priceBasis: "per image", why: "Google Gemini 2.5 Flash Image",  routingId: "fal-ai/nano-banana", supportsImageInput: true },
  { id: 111, tier: "elite", modality: "image", name: "Ideogram V2 (Elite)",          provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Typography",                       routingId: "fal-ai/ideogram/v2" },
  { id: 112, tier: "elite", modality: "image", name: "FLUX.1 Kontext [max] (Elite)", provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Best editing",                     routingId: "fal-ai/flux-kontext/max", supportsImageInput: true },
  { id: 113, tier: "elite", modality: "image", name: "Recraft V4.1 Vector (Elite)",  provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per image", why: "Vector top tier",                  routingId: "fal-ai/recraft/v4.1-vector" },
  { id: 114, tier: "elite", modality: "image", name: "Qwen Image Max (Elite)",       provider: "fal.ai", pricePerUnit: 0.075,  priceBasis: "per image", why: "Alibaba top",                      routingId: "fal-ai/qwen-image-max" },
  { id: 115, tier: "elite", modality: "image", name: "FLUX.2 Max (Elite)",           provider: "fal.ai", pricePerUnit: 0.07,   priceBasis: "per image", why: "BFL top",                          routingId: "fal-ai/flux-2-max" },
  { id: 116, tier: "elite", modality: "image", name: "Imagen 4 Ultra (Elite)",       provider: "fal.ai", pricePerUnit: 0.06,   priceBasis: "per image", why: "Google photoreal",                 routingId: "fal-ai/imagen4/ultra" },
  { id: 117, tier: "elite", modality: "image", name: "GPT Image 2 Mini (Elite)",     provider: "fal.ai", pricePerUnit: 0.02,   priceBasis: "per image", why: "OpenAI fast image",                routingId: "openai/gpt-image-2", supportsImageInput: true },
  { id: 118, tier: "elite", modality: "image", name: "Bagel (Elite)",                provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per image", why: "Bagel premium",                    routingId: "fal-ai/bagel", supportsImageInput: true },
  { id: 119, tier: "elite", modality: "image", name: "GPT Image 2 (Elite)",          provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "OpenAI standalone",                routingId: "openai/gpt-image-2", supportsImageInput: true },
  { id: 120, tier: "elite", modality: "image", name: "Seedream 4.5 (Elite)",         provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per image", why: "ByteDance image",                  routingId: "fal-ai/bytedance/seedream-4.5" },
];

// ── VIDEO MODELS ──────────────────────────────────────────────────────────────
// Initiate (15)
const VIDEO_INITIATE: RegistryModel[] = [
  { id: 121, tier: "initiate", modality: "video", name: "Hunyuan Video",             provider: "fal.ai", pricePerUnit: 0.001,  priceBasis: "per second", why: "Tencent open-weight, basically free", routingId: "fal-ai/hunyuan-video" },
  { id: 122, tier: "initiate", modality: "video", name: "LTX Video 0.9.5",           provider: "fal.ai", pricePerUnit: 0.001,  priceBasis: "per second", why: "Lightricks, fast",                    routingId: "fal-ai/ltx-video" },
  { id: 123, tier: "initiate", modality: "video", name: "Wan 2.1 Pro",               provider: "fal.ai", pricePerUnit: 0.001,  priceBasis: "per second", why: "Alibaba older flagship",              routingId: "fal-ai/wan/v2.1/pro" },
  { id: 124, tier: "initiate", modality: "video", name: "Wan Alpha",                 provider: "fal.ai", pricePerUnit: 0.01,   priceBasis: "per second", why: "Alibaba experimental",                routingId: "fal-ai/wan-alpha" },
  { id: 125, tier: "initiate", modality: "video", name: "MiniMax Hailuo 02 Std I2V", provider: "fal.ai", pricePerUnit: 0.017,  priceBasis: "per second", why: "MiniMax I2V",                        routingId: "fal-ai/minimax/hailuo-02/std-i2v", supportsImageInput: true },
  { id: 126, tier: "initiate", modality: "video", name: "LTX Video 13B Distilled",   provider: "fal.ai", pricePerUnit: 0.02,   priceBasis: "per second", why: "Best LTX variant",                    routingId: "fal-ai/ltx-video-13b-distilled" },
  { id: 127, tier: "initiate", modality: "video", name: "Veo 3.1 Lite",              provider: "fal.ai", pricePerUnit: 0.03,   priceBasis: "per second", why: "Google Veo entry",                    routingId: "fal-ai/veo3.1/lite" },
  { id: 128, tier: "initiate", modality: "video", name: "LTX 2.3 Video Fast",        provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per second", why: "Lightricks newer",                    routingId: "fal-ai/ltx-video/v2.3/fast" },
  { id: 129, tier: "initiate", modality: "video", name: "Wan 2.2 A14B",              provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per second", why: "Alibaba Wan 2.2",                     routingId: "fal-ai/wan/v2.2/a14b" },
  { id: 130, tier: "initiate", modality: "video", name: "Wan 2.6",                   provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per second", why: "Alibaba flagship cheapest path",      routingId: "fal-ai/wan/v2.6/t2v" },
  { id: 131, tier: "initiate", modality: "video", name: "MiniMax Hailuo 02 Std T2V", provider: "fal.ai", pricePerUnit: 0.045,  priceBasis: "per second", why: "MiniMax T2V",                        routingId: "fal-ai/minimax/hailuo-02/std-t2v" },
  { id: 132, tier: "initiate", modality: "video", name: "Wan 2.5 T2V/I2V",           provider: "fal.ai", pricePerUnit: 0.05,   priceBasis: "per second", why: "Wan 2.5 latest stable",               routingId: "fal-ai/wan/v2.5/t2v", supportsImageInput: true },
  { id: 133, tier: "initiate", modality: "video", name: "Wan 2.5 T2V",               provider: "fal.ai", pricePerUnit: 0.05,   priceBasis: "per second", why: "Alibaba Wan 2.5 text-to-video",       routingId: "fal-ai/wan/v2.5/t2v" },
  { id: 134, tier: "initiate", modality: "video", name: "LTX Video 2.0",             provider: "fal.ai", pricePerUnit: 0.05,   priceBasis: "per second", why: "Lightricks v2 standard",              routingId: "fal-ai/ltx-video/v2.0/t2v" },
  { id: 135, tier: "initiate", modality: "video", name: "Hunyuan Video Fast",        provider: "fal.ai", pricePerUnit: 0.082,  priceBasis: "per second", why: "Tencent fast video",                  routingId: "fal-ai/hunyuan-video/fast" },
];

// Active (15 new)
const VIDEO_ACTIVE: RegistryModel[] = [
  { id: 136, tier: "active", modality: "video", name: "Veo 3.1 Lite FLF",            provider: "fal.ai", pricePerUnit: 0.03,   priceBasis: "per second", why: "Veo Lite first-last-frame",          routingId: "fal-ai/veo3.1/lite-flf", supportsImageInput: true },
  { id: 137, tier: "active", modality: "video", name: "LTX Video 2.0 Fast",          provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per second", why: "LTX v2 fast",                        routingId: "fal-ai/ltx-video/v2.0/fast" },
  { id: 138, tier: "active", modality: "video", name: "Wan 2.2 Text-to-Video A14B",  provider: "fal.ai", pricePerUnit: 0.04,   priceBasis: "per second", why: "Wan 2.2 standard",                   routingId: "fal-ai/wan/v2.2/text-to-video" },
  { id: 139, tier: "active", modality: "video", name: "Wan 2.5 I2V",                 provider: "fal.ai", pricePerUnit: 0.05,   priceBasis: "per second", why: "Wan 2.5 image-to-video",             routingId: "fal-ai/wan/v2.5/i2v", supportsImageInput: true },
  { id: 140, tier: "active", modality: "video", name: "Wan 2.6 Alibaba",             provider: "fal.ai", pricePerUnit: 0.05,   priceBasis: "per second", why: "Alibaba V2.6 base",                  routingId: "fal-ai/wan/v2.6/t2v" },
  { id: 141, tier: "active", modality: "video", name: "MiniMax Hailuo 02 Pro",       provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per second", why: "Better motion than Std",             routingId: "fal-ai/minimax/hailuo-02/pro" },
  { id: 142, tier: "active", modality: "video", name: "OmniHuman v1.5 (low)",        provider: "fal.ai", pricePerUnit: 0.08,   priceBasis: "per second", why: "Human animation",                    routingId: "fal-ai/bytedance/omnihuman-v1.5", supportsImageInput: true },
  { id: 143, tier: "active", modality: "video", name: "MiniMax Hailuo 02 Pro (alt)", provider: "fal.ai", pricePerUnit: 0.082,  priceBasis: "per second", why: "MiniMax Hailuo Pro",                 routingId: "fal-ai/minimax/hailuo-02/pro" },
  { id: 144, tier: "active", modality: "video", name: "Wan Text to Video",           provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per second", why: "Stable Alibaba",                     routingId: "fal-ai/wan/v2.6/t2v" },
  { id: 145, tier: "active", modality: "video", name: "Veo 3.1 Fast",               provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per second", why: "Google Veo fast",                    routingId: "fal-ai/veo3.1/fast" },
  { id: 146, tier: "active", modality: "video", name: "Wan 2.7",                     provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per second", why: "Newest Alibaba flagship",            routingId: "fal-ai/wan/v2.7/t2v" },
  { id: 147, tier: "active", modality: "video", name: "Wan v2.6 Text to Video",      provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per second", why: "fal-hosted Wan 2.6",                 routingId: "fal-ai/wan/v2.6/t2v" },
  { id: 148, tier: "active", modality: "video", name: "Wan 2.2 A14B with LoRAs",     provider: "fal.ai", pricePerUnit: 0.1,    priceBasis: "per second", why: "Wan + community LoRAs",              routingId: "fal-ai/wan/v2.2/loras" },
  { id: 149, tier: "active", modality: "video", name: "Kling Video O1",              provider: "fal.ai", pricePerUnit: 0.112,  priceBasis: "per second", why: "Kuaishou cinematic",                 routingId: "fal-ai/kling-video/o1" },
  { id: 150, tier: "active", modality: "video", name: "Kling v3.0 Standard",         provider: "fal.ai", pricePerUnit: 0.126,  priceBasis: "per second", why: "Kuaishou v3 base with audio",        routingId: "fal-ai/kling-video/v3/standard" },
];

// Champion (15 new)
const VIDEO_CHAMPION: RegistryModel[] = [
  { id: 151, tier: "champion", modality: "video", name: "Wan v2.6 Premium",          provider: "fal.ai", pricePerUnit: 0.15,   priceBasis: "per second", why: "Alibaba premium Wan",                routingId: "fal-ai/wan/v2.6/premium" },
  { id: 152, tier: "champion", modality: "video", name: "Wan 2.5 Premium",           provider: "fal.ai", pricePerUnit: 0.15,   priceBasis: "per second", why: "Wan 2.5 premium",                    routingId: "fal-ai/wan/v2.5/premium", supportsImageInput: true },
  { id: 153, tier: "champion", modality: "video", name: "Wan 2.7 Premium",           provider: "fal.ai", pricePerUnit: 0.15,   priceBasis: "per second", why: "Alibaba Wan 2.7 premium",            routingId: "fal-ai/wan/v2.7/t2v" },
  { id: 154, tier: "champion", modality: "video", name: "LTX 2.3 Video Fast",        provider: "fal.ai", pricePerUnit: 0.16,   priceBasis: "per second", why: "Lightricks fast premium",            routingId: "fal-ai/ltx-video/v2.3/fast" },
  { id: 155, tier: "champion", modality: "video", name: "OmniHuman v1.5",            provider: "fal.ai", pricePerUnit: 0.16,   priceBasis: "per second", why: "Human animation premium",            routingId: "fal-ai/bytedance/omnihuman-v1.5", supportsImageInput: true },
  { id: 156, tier: "champion", modality: "video", name: "OmniHuman v1.5 Premium",    provider: "fal.ai", pricePerUnit: 0.16,   priceBasis: "per second", why: "Premium human animation",            routingId: "fal-ai/bytedance/omnihuman-v1.5", supportsImageInput: true },
  { id: 157, tier: "champion", modality: "video", name: "Kling v3.0 Pro",            provider: "fal.ai", pricePerUnit: 0.168,  priceBasis: "per second", why: "Kuaishou flagship cinematic",        routingId: "fal-ai/kling-video/v3/pro" },
  { id: 158, tier: "champion", modality: "video", name: "Kling Video v2.6 I2V",      provider: "fal.ai", pricePerUnit: 0.168,  priceBasis: "per second", why: "Kling 2.6 I2V",                      routingId: "fal-ai/kling-video/v2.6/i2v", supportsImageInput: true },
  { id: 159, tier: "champion", modality: "video", name: "Multishot Master",          provider: "fal.ai", pricePerUnit: 0.2,    priceBasis: "per second", why: "Multi-shot specialist",              routingId: "fal-ai/multishot-master" },
  { id: 160, tier: "champion", modality: "video", name: "Wan 2.7 Fast",              provider: "fal.ai", pricePerUnit: 0.2,    priceBasis: "per second", why: "Alibaba Wan 2.7 fast",               routingId: "fal-ai/wan/v2.7/t2v" },
  { id: 161, tier: "champion", modality: "video", name: "Ai Avatar",                 provider: "fal.ai", pricePerUnit: 0.2,    priceBasis: "per second", why: "Avatar specialist",                  routingId: "fal-ai/ai-avatar", supportsImageInput: true },
  { id: 162, tier: "champion", modality: "video", name: "Infinitalk",                provider: "fal.ai", pricePerUnit: 0.2,    priceBasis: "per second", why: "Talking heads",                      routingId: "fal-ai/infinitalk", supportsImageInput: true },
  { id: 163, tier: "champion", modality: "video", name: "LTX Video 2.0 Pro",         provider: "fal.ai", pricePerUnit: 0.24,   priceBasis: "per second", why: "Lightricks v2 Pro",                  routingId: "fal-ai/ltx-video/v2.0/pro" },
  { id: 164, tier: "champion", modality: "video", name: "Veo 3.1 Fast",              provider: "fal.ai", pricePerUnit: 0.3,    priceBasis: "per second", why: "Veo at fal premium",                 routingId: "fal-ai/veo3.1/fast" },
  { id: 165, tier: "champion", modality: "video", name: "Happy Horse Premium",       provider: "fal.ai", pricePerUnit: 0.28,   priceBasis: "per second", why: "Alibaba premium video",              routingId: "fal-ai/happy-horse/premium" },
];

// Elite (15 new)
const VIDEO_ELITE: RegistryModel[] = [
  { id: 166, tier: "elite", modality: "video", name: "Seedance 2.0",                 provider: "fal.ai", pricePerUnit: 0.3,    priceBasis: "per second", why: "Current SOTA — Josh's call",         routingId: "fal-ai/bytedance/seedance-2.0/text-to-video", supportsImageInput: true, featured: true },
  { id: 167, tier: "elite", modality: "video", name: "Seedance 2.0 I2V",             provider: "fal.ai", pricePerUnit: 0.3,    priceBasis: "per second", why: "Seedance image-to-video",            routingId: "fal-ai/bytedance/seedance-2.0/image-to-video", supportsImageInput: true },
  { id: 168, tier: "elite", modality: "video", name: "Veo 3.1 Fast Premium",         provider: "fal.ai", pricePerUnit: 0.3,    priceBasis: "per second", why: "Veo at fal premium",                 routingId: "fal-ai/veo3.1/fast" },
  { id: 169, tier: "elite", modality: "video", name: "Seedance 2.0 Pro",             provider: "fal.ai", pricePerUnit: 0.3,    priceBasis: "per second", why: "ByteDance flagship video",           routingId: "fal-ai/bytedance/seedance-2.0-pro" },
  { id: 170, tier: "elite", modality: "video", name: "Happy Horse",                  provider: "fal.ai", pricePerUnit: 0.28,   priceBasis: "per second", why: "1080p audio lipsync",                routingId: "fal-ai/happy-horse" },
  { id: 171, tier: "elite", modality: "video", name: "Seedance 2.0 Fast",            provider: "fal.ai", pricePerUnit: 0.24,   priceBasis: "per second", why: "Faster Seedance",                    routingId: "fal-ai/bytedance/seedance-2.0-fast", supportsImageInput: true },
  { id: 172, tier: "elite", modality: "video", name: "LTX Video 2.0 Pro (Elite)",    provider: "fal.ai", pricePerUnit: 0.24,   priceBasis: "per second", why: "Lightricks v2 Pro",                  routingId: "fal-ai/ltx-video/v2.0/pro" },
  { id: 173, tier: "elite", modality: "video", name: "Kling v3.0 Pro (Elite)",       provider: "fal.ai", pricePerUnit: 0.168,  priceBasis: "per second", why: "Kuaishou flagship",                  routingId: "fal-ai/kling-video/v3/pro" },
  { id: 174, tier: "elite", modality: "video", name: "LTX 2.3 Video Fast (top)",     provider: "fal.ai", pricePerUnit: 0.16,   priceBasis: "per second", why: "Top LTX fast",                       routingId: "fal-ai/ltx-video/v2.3/fast" },
  { id: 175, tier: "elite", modality: "video", name: "OmniHuman v1.5 (Elite)",       provider: "fal.ai", pricePerUnit: 0.16,   priceBasis: "per second", why: "Human animation",                    routingId: "fal-ai/bytedance/omnihuman-v1.5", supportsImageInput: true },
  { id: 176, tier: "elite", modality: "video", name: "Wan v2.6 Premium (Elite)",     provider: "fal.ai", pricePerUnit: 0.15,   priceBasis: "per second", why: "Alibaba top Wan",                    routingId: "fal-ai/wan/v2.6/premium" },
  { id: 177, tier: "elite", modality: "video", name: "Wan 2.5 Premium (Elite)",      provider: "fal.ai", pricePerUnit: 0.15,   priceBasis: "per second", why: "Wan 2.5 top",                        routingId: "fal-ai/wan/v2.5/premium", supportsImageInput: true },
  { id: 178, tier: "elite", modality: "video", name: "Wan 2.7 (Elite)",              provider: "fal.ai", pricePerUnit: 0.15,   priceBasis: "per second", why: "Alibaba Wan 2.7",                    routingId: "fal-ai/wan/v2.7/t2v" },
  { id: 179, tier: "elite", modality: "video", name: "Multishot Master (Elite)",     provider: "fal.ai", pricePerUnit: 0.2,    priceBasis: "per second", why: "Multi-shot specialist",              routingId: "fal-ai/multishot-master" },
  { id: 180, tier: "elite", modality: "video", name: "Kling v3.0 Standard (Elite)",  provider: "fal.ai", pricePerUnit: 0.126,  priceBasis: "per second", why: "Kuaishou v3 base",                   routingId: "fal-ai/kling-video/v3/standard" },
];

// ── FULL REGISTRY ─────────────────────────────────────────────────────────────
export const MODEL_REGISTRY: RegistryModel[] = [
  ...TEXT_INITIATE, ...TEXT_ACTIVE, ...TEXT_CHAMPION, ...TEXT_ELITE,
  ...IMAGE_INITIATE, ...IMAGE_ACTIVE, ...IMAGE_CHAMPION, ...IMAGE_ELITE,
  ...VIDEO_INITIATE, ...VIDEO_ACTIVE, ...VIDEO_CHAMPION, ...VIDEO_ELITE,
];

/** Get models visible to a given tier (additive: own + all below), featured first */
export function getModelsForTier(tier: ModelTier, modality?: ModelModality): RegistryModel[] {
  const allowed = visibleTiers(tier);
  const models = MODEL_REGISTRY.filter(
    m => allowed.includes(m.tier) && (!modality || m.modality === modality)
  );
  // Featured models first, then sort by id
  return models.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return a.id - b.id;
  });
}

/** Get a single model by id */
export function getModelById(id: number): RegistryModel | undefined {
  return MODEL_REGISTRY.find(m => m.id === id);
}
