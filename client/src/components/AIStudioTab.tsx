/**
 * AI Creator Studio — v2 "paper palette" port.
 *
 * Layout (matches AIStudio.html):
 *   LEFT  · 240px studio-tools — tier banner, modality tabs, library, spend strip
 *   MAIN  · prompt box → format chips → output card
 *   RIGHT · 280px studio-history — model picker (collapsed) + prompt library tips
 *
 * Behaviour preserved exactly:
 *   - trpc.aiStudio.{submitVerification, myVerificationStatus, uploadReference,
 *     listModels, videoSpend, pollJob, generate} — same args, same polling.
 *   - Verification gate (form → pending → unlock via polling).
 *   - Tier badge surfacing — uses `tier` prop and server's spendData.tier.
 *   - Monthly video-second caps (220/330/550/880) shown in spend meter.
 *   - 80 / 95 / 100% cap alerts (colour ramp on the meter + cap-reached lock).
 *   - Chat / Image / Video modes via the modality tabs.
 *   - 3-slot reference grid (with image vs file preview, upload status dot).
 *   - enrichedPrompt display on completed jobs.
 *   - Prompt library / guidance / hints — all copy preserved.
 *
 * Visual treatment is paper, not dark. All component-specific styles live in
 * the page-local <style>{`...`}</style> block at the bottom of the file. Shared
 * paper utility classes (`.paper-pill`, `.serif`, `.mono`, `.eyebrow`) come
 * from index.css.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

type ModelTier = "initiate" | "active" | "champion" | "elite";
type Modality = "text" | "image" | "video";

const TIER_LABEL: Record<ModelTier, string> = {
  initiate: "Initiate", active: "Active", champion: "Champion", elite: "Elite",
};
// Monthly video-second budget by tier (server enforces; UI mirrors).
const VIDEO_CAP: Record<ModelTier, number> = {
  initiate: 220, active: 330, champion: 550, elite: 880,
};

// Tier "unlocks" copy mirrored from AIStudio.html's tier-strip.
const TIER_UNLOCKS: Record<ModelTier, { headline: string; sub: string }> = {
  initiate: { headline: "Text generation", sub: "Threads, posts, explainers, replies, scripts. Brand-tuned." },
  active:   { headline: "+ Image generation", sub: "Adds image generation and reference upload." },
  champion: { headline: "+ Video generation", sub: "Adds video generation. Near-frontier text and image. 720p." },
  elite:    { headline: "+ Frontier 1080p", sub: "1080p video, frontier models, the highest limits." },
};

// ── PROMPT STARTER LIBRARY (unchanged copy) ───────────────────────────────

interface PromptTemplate {
  label: string;
  platform?: string;
  template: string;
  note?: string;
}

const PROMPT_STARTERS: Record<Modality, { intro: string; whyContext: string; templates: PromptTemplate[]; tips: string[] }> = {
  text: {
    intro: "These are ready-to-use prompt starters. Copy one, fill in the brackets, and generate.",
    whyContext: "These models aren't trained on your specific protocol. To give you access to the best AI available for free, we use general-purpose models trained on the internet — not on specific protocol content.\n\nEvery prompt needs a bit of context specific to what you're posting about. If you're writing about your protocol, add one sentence summarizing what it does. That's enough for the model to write accurately.",
    templates: [
      {
        label: "X — Single post",
        platform: "X",
        template: "Write a single X post about [TOPIC].\nAudience: [crypto-native / DeFi users / general public / TradFi professionals].\nKey point: [ONE SENTENCE — what should the reader take away?]\nTone: [direct and confident / educational / provocative / understated].\nNo hashtags. Strong first line. Under 280 characters.",
        note: "The first line is the whole game. X cuts off in the timeline — if line one doesn't earn the click, nothing else matters.",
      },
      {
        label: "X — Thread (5 posts)",
        platform: "X",
        template: "Write a 5-post X thread explaining [TOPIC].\nAudience: [crypto-native / DeFi users / general public].\nStructure:\n- Post 1: Hook — the problem or the surprising fact\n- Posts 2-4: The explanation, one point per post\n- Post 5: The close — what it means\nTone: [educational / conversational / technical].\nNo hashtags. Each post under 280 characters.\nKey facts to include: [LIST ANY SPECIFIC NUMBERS, NAMES, OR DETAILS].",
        note: "Write each post as a standalone thought that also builds on the last. No filler posts.",
      },
      {
        label: "X — Reaction / commentary",
        platform: "X",
        template: "Write a single X post reacting to [NEWS / EVENT / TREND].\nConnect it to [YOUR PROTOCOL'S ANGLE — e.g. the core value prop or use case].\nAudience: [crypto-native / general public].\nTone: [informed and confident / slightly provocative / matter-of-fact].\nNo hashtags. Under 280 characters.",
      },
      {
        label: "LinkedIn — Post",
        platform: "LinkedIn",
        template: "Write a LinkedIn post about [TOPIC / ANNOUNCEMENT].\nAudience: [TradFi professionals / fintech founders / payments industry / institutional investors].\nKey point: [ONE SENTENCE].\nTone: [professional but direct / thought leadership / announcement].\nFormat: strong opener line, 2-3 short paragraphs, optional closing question or CTA.\n150-250 words.",
        note: "LinkedIn readers expect more structure than X. Paragraphs are fine. 2-3 relevant hashtags at the end are acceptable here.",
      },
      {
        label: "Short caption",
        platform: "General",
        template: "Write a short caption for [DESCRIBE THE IMAGE OR CONTEXT].\nAudience: [general public / crypto community / ambassador community].\nTone: [energetic / understated / informative].\n2-4 sentences max. No hashtags.",
      },
      {
        label: "Explainer paragraph",
        platform: "General",
        template: "Explain [CONCEPT] in plain language for someone who [DESCRIBE THEIR KNOWLEDGE LEVEL — e.g. 'uses PayPal but has never heard of stablecoins'].\nKeep it to 3-4 sentences. No jargon. No acronyms without explanation.\nEnd with one sentence on why it matters.",
      },
    ],
    tips: [
      "Specify the format first — 'Write a 5-post thread' or 'Write a single LinkedIn post.' Don't make the model guess.",
      "Name the audience — 'crypto-native' and 'someone who uses PayPal' produce completely different outputs.",
      "Give it the key point — what is the one thing the reader should take away? State it explicitly.",
      "Ask for variations — add 'Give me 3 versions' to any prompt. Pick the best one.",
      "Paste your rough notes — you don't have to write from scratch. Paste rough thoughts and say 'Rewrite this as a clean X post.'",
      "Iterate, don't restart — if the output is close but not right, copy it back and say 'Make tweet 2 more direct.'",
    ],
  },
  image: {
    intro: "Image models work best with specific visual descriptions — not concepts. Describe what it looks like, not what it means.",
    whyContext: "Image models have no knowledge of your protocol's visual identity unless you describe it. Always specify the colour palette, style, and composition. The more specific you are, the better the result.\n\nDefault palette: warm paper background (#f4efe6), deep ink (#14140f), green accents (#00c886, #00FF9D), rose highlights (#e88a6c).",
    templates: [
      {
        label: "Abstract / conceptual",
        template: "[STYLE: isometric 3D illustration / flat design / photorealistic / architectural diagram / editorial].\n[SUBJECT: describe the visual scene — what objects, shapes, or elements are in it?].\n[COMPOSITION: close-up / wide shot / overhead / isometric].\nColour palette: warm paper background, ink and green accents, editorial feel.\n[MOOD: clean and precise / minimal / dramatic / understated].\nNo text or logos in the image.",
        note: "Describe what you see, not what you mean. 'Show the power of blockchain' produces nothing. 'A network of glowing nodes on warm paper, green light trails, isometric view' produces something real.",
      },
      {
        label: "Product / UI mockup",
        template: "Photorealistic close-up of [DEVICE — smartphone / laptop / tablet] showing [DESCRIBE THE SCREEN CONTENT].\nBackground: [warm paper / blurred office / abstract editorial].\nLighting: [soft studio light / dramatic side light / screen glow].\nColour palette: warm paper background, ink and green UI accents.\nNo visible brand logos. Clean, editorial.",
      },
      {
        label: "Infographic style",
        template: "Flat design infographic showing [PROCESS / COMPARISON / DATA].\nStyle: minimal, clean, editorial.\nColour palette: warm paper background, ink and green accents.\nLayout: [left-to-right flow / top-to-bottom / circular].\nNo decorative elements — functional and clear.",
      },
      {
        label: "Network / connectivity",
        template: "Isometric 3D illustration of a glowing network of nodes connecting [CITIES / REGIONS].\nEach location represented by a geometric structure. Thin light trails connecting them.\nColour palette: warm paper background, green accent lines, ink node points.\nMood: clean, precise, architectural.\nNo text or logos in the image.",
      },
    ],
    tips: [
      "Describe the visual scene — what objects, shapes, and elements are actually in the image?",
      "Specify the style — isometric 3D, flat design, photorealistic, architectural diagram.",
      "Include lighting and mood — soft studio light, dramatic, cinematic, minimal.",
      "Reference the colour palette — warm paper background, ink and green accents.",
      "No text in images — AI image models handle text poorly. Generate text separately.",
      "One clear visual idea per generation — complex multi-element scenes rarely work well.",
    ],
  },
  video: {
    intro: "Video models work best with one clear scene and one clear motion. Keep it simple.",
    whyContext: "Video generation is the most constrained modality. Complex narratives, multiple scenes, and abstract concepts don't translate well. Think in terms of one scene, one motion, one mood.\n\nGeneration takes 30–120 seconds depending on duration and model.",
    templates: [
      {
        label: "Abstract motion",
        template: "[DURATION: 3s / 5s / 8s].\n[SCENE: describe what is in frame].\n[MOTION: what moves, and how? — slow zoom / pan left / particles flowing / light pulse].\nColour palette: warm paper background, green light accents.\n[MOOD: cinematic / clean / energetic / editorial].\nNo text. No logos.",
        note: "Keep it to one scene and one motion. The simpler the description, the more reliable the output.",
      },
      {
        label: "Network / data flow",
        template: "5 seconds.\nAbstract editorial space with glowing green network nodes. Thin light trails connecting points across the frame.\nMotion: slow zoom out, revealing the full network. Nodes pulse gently.\nColour palette: warm paper background, green light trails, ink node points.\nMood: cinematic, precise.\nNo text. No logos.",
      },
      {
        label: "Product reveal",
        template: "5 seconds.\n[DESCRIBE THE PRODUCT OR INTERFACE IN FRAME].\nMotion: [slow reveal / smooth pan / gentle zoom].\nLighting: [screen glow / soft studio / dramatic side light].\nColour palette: warm paper background, green UI accents.\nMood: clean, editorial.\nNo text overlays.",
      },
    ],
    tips: [
      "One scene, one motion — complex multi-scene narratives don't work with current video models.",
      "Specify duration — 3s, 5s, 8s, 10s. Shorter is more reliable.",
      "Describe the opening frame clearly — what is in frame at the start?",
      "Name the motion — slow zoom, pan left, particles flowing, light pulse.",
      "Keep prompts under 100 words — video models work better with concise descriptions.",
      "No talking heads or real people — these models are not designed for that.",
    ],
  },
};

interface RegistryModel {
  id: number;
  tier: ModelTier;
  modality: Modality;
  name: string;
  provider: string;
  pricePerUnit: number;
  priceBasis: string;
  why: string;
  routingId: string;
  supportsImageInput?: boolean;
  featured?: boolean;
  deprecationWarning?: string;
}

// ── REFERENCE SLOT TYPES ──────────────────────────────────────────────────

interface ReferenceSlot {
  preview: string | null;
  url: string | null;
  uploading: boolean;
  error: string | null;
  fileName?: string;
  fileType?: string;
}

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif,text/plain,text/markdown,application/pdf,.md,.txt,.pdf";

function isImageType(type: string) {
  return type.startsWith("image/");
}

// ── REFERENCE SLOT GRID ───────────────────────────────────────────────────

function ReferenceSlots({
  slots,
  onAddSlot,
  onRemoveSlot,
  supportsImageInput,
}: {
  slots: ReferenceSlot[];
  onAddSlot: (file: File, index: number) => void;
  onRemoveSlot: (index: number) => void;
  supportsImageInput: boolean;
}) {
  const fileInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  return (
    <div className="ref-slots">
      <div className="ref-slots-head">
        <span className="mono ref-slots-label">References</span>
        <span className="mono ref-slots-hint">optional · up to 3</span>
        {!supportsImageInput && (
          <span className="mono ref-slots-pill">model has no vision input</span>
        )}
      </div>
      <div className={`ref-slots-row${supportsImageInput ? "" : " disabled"}`}>
        {slots.map((slot, i) => (
          <div key={i} className="ref-slot-wrap">
            <div
              className={`ref-slot${slot.preview ? " filled" : ""}`}
              onClick={() => supportsImageInput && !slot.preview && fileInputRefs[i]?.current?.click()}
              style={{ cursor: supportsImageInput && !slot.preview ? "pointer" : supportsImageInput ? "default" : "not-allowed" }}
            >
              {slot.preview && slot.fileType && isImageType(slot.fileType) ? (
                <img src={slot.preview} alt={`Reference ${i + 1}`} className="ref-slot-img" />
              ) : slot.fileName ? (
                <div className="ref-slot-file">
                  <div className="ref-slot-file-icon">DOC</div>
                  <span className="mono ref-slot-file-name">{slot.fileName.slice(0, 12)}</span>
                </div>
              ) : (
                <>
                  <div className="ref-slot-plus">+</div>
                  <span className="mono ref-slot-label">REF {i + 1}</span>
                </>
              )}
              {slot.uploading && (
                <div className="ref-slot-uploading">
                  <div className="paper-spinner" />
                </div>
              )}
              {slot.url && !slot.uploading && <div className="ref-slot-ready" />}
            </div>
            {(slot.preview || slot.fileName) && (
              <button className="ref-slot-rm" onClick={() => onRemoveSlot(i)} aria-label="Remove reference">
                ×
              </button>
            )}
            <input
              ref={fileInputRefs[i]}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={e => { const f = e.target.files?.[0]; if (f) onAddSlot(f, i); e.target.value = ""; }}
              style={{ display: "none" }}
            />
          </div>
        ))}
        <div className="ref-slots-help">
          {supportsImageInput ? (
            <>Images, .md, .txt, .pdf<br />for vision-enabled models</>
          ) : (
            <>Select a model that<br />supports references first</>
          )}
        </div>
      </div>
      {slots.some(s => s.error) && (
        <div className="ref-slot-error">⚠ {slots.find(s => s.error)?.error}</div>
      )}
    </div>
  );
}

// ── VERIFICATION GATE ─────────────────────────────────────────────────────

const VERIFY_KEY = "ambassador_studio_verified_email";

function VerificationGate() {
  const [xHandle, setXHandle] = useState("");
  const [telegramHandle, setTelegramHandle] = useState("");
  const [step, setStep] = useState<"form" | "pending">("form");
  const [error, setError] = useState("");

  const submitMut = trpc.aiStudio.submitVerification.useMutation({
    onSuccess: () => setStep("pending"),
    onError: (e) => setError(e.message),
  });

  const handleSubmit = () => {
    setError("");
    if (!xHandle.trim()) { setError("Please enter your X (Twitter) handle."); return; }
    if (!telegramHandle.trim()) { setError("Please enter your Telegram handle."); return; }
    const cleanX = xHandle.trim().replace(/^@+/, "");
    const cleanTg = telegramHandle.trim().replace(/^@+/, "");
    submitMut.mutate({ xHandle: cleanX, telegramHandle: cleanTg });
  };

  if (step === "pending") {
    return (
      <div className="verify-shell">
        <div className="eyebrow">· Creator Studio access</div>
        <h2 className="serif verify-title">
          Verification <em>submitted.</em>
        </h2>
        <p className="lead verify-body">
          Your request has been sent to the team. This page will unlock automatically once you&apos;re approved — usually within 24 hours.
        </p>
        <div className="verify-pending-card">
          <span className="mono verify-pending-label">Status</span>
          <span className="mono verify-pending-value">Pending review</span>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-shell">
      <div className="eyebrow">· Creator Studio access</div>
      <h2 className="serif verify-title">
        Verify your <em>handles.</em>
      </h2>
      <p className="lead verify-body">
        The Creator Studio is available to verified community members. Submit your X and Telegram handles — the team will verify your identity within 24 hours.
      </p>

      <label className="field-label">X (Twitter) handle</label>
      <div className="input-with-prefix">
        <span className="input-prefix mono">@</span>
        <input
          type="text"
          className="paper-input with-prefix"
          placeholder="yourhandle"
          value={xHandle}
          onChange={e => setXHandle(e.target.value)}
        />
      </div>

      <label className="field-label">Telegram handle</label>
      <div className="input-with-prefix">
        <span className="input-prefix mono">@</span>
        <input
          type="text"
          className="paper-input with-prefix"
          placeholder="yourusername"
          value={telegramHandle}
          onChange={e => setTelegramHandle(e.target.value)}
        />
      </div>

      {error && <div className="verify-error">⚠ {error}</div>}

      <button
        className="paper-btn-primary verify-submit"
        onClick={handleSubmit}
        disabled={submitMut.isPending}
      >
        {submitMut.isPending ? "Submitting..." : "Request access →"}
      </button>
    </div>
  );
}

// ── IDLE OUTPUT PLACEHOLDER ───────────────────────────────────────────────

function OutputIdle({ modality, isGenerating }: { modality: Modality; isGenerating: boolean }) {
  if (isGenerating) {
    return (
      <div className="output-idle">
        <div className="paper-spinner big" />
        <div className="serif output-idle-headline">
          {modality === "video" ? "Generating video..." : modality === "image" ? "Generating image..." : "Writing..."}
        </div>
        <div className="output-idle-sub">
          {modality === "video"
            ? "Takes 30–120 seconds depending on duration and model."
            : modality === "image"
            ? "Rendering your image."
            : "Composing the text."}
        </div>
      </div>
    );
  }
  return (
    <div className="output-idle">
      <div className="output-idle-mark">{modality === "text" ? "✎" : modality === "image" ? "▦" : "▷"}</div>
      <div className="serif output-idle-headline">Output appears here.</div>
      <div className="output-idle-sub">Pick a model, write a prompt, then hit generate.</div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

const EMPTY_SLOTS: ReferenceSlot[] = [
  { preview: null, url: null, uploading: false, error: null },
  { preview: null, url: null, uploading: false, error: null },
  { preview: null, url: null, uploading: false, error: null },
];

export function AIStudioTab({ tier: propTier }: { tier?: string }) {
  // Set body palette to paper while this tab is mounted (mirrors Apply.tsx).
  useEffect(() => {
    const prev = document.body.getAttribute("data-palette");
    document.body.setAttribute("data-palette", "paper");
    return () => {
      if (prev) document.body.setAttribute("data-palette", prev);
      else document.body.removeAttribute("data-palette");
    };
  }, []);

  // Verification (server-authoritative).
  const { data: verifyStatus } = trpc.aiStudio.myVerificationStatus.useQuery(undefined, {
    staleTime: 60 * 1000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (verifyStatus?.status === "verified") {
      localStorage.setItem(VERIFY_KEY, "server_verified");
    } else if (verifyStatus && verifyStatus.status !== "verified") {
      localStorage.removeItem(VERIFY_KEY);
    }
  }, [verifyStatus]);

  const isVerified = verifyStatus?.status === "verified";

  const [modality, setModality] = useState<Modality>("text");
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [videoDuration, setVideoDuration] = useState(5);
  const [result, setResult] = useState<{
    text?: string; imageUrl?: string; videoUrl?: string; videoSeconds?: number; costUsd?: number;
    enrichedPrompt?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [refSlots, setRefSlots] = useState<ReferenceSlot[]>(EMPTY_SLOTS.map(s => ({ ...s })));
  const [emptyResponseError, setEmptyResponseError] = useState(false);
  const [pendingLogId, setPendingLogId] = useState<number | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [libraryTab, setLibraryTab] = useState<"tips" | "why">("tips");
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [copiedTpl, setCopiedTpl] = useState<number | null>(null);

  const uploadRefMut = trpc.aiStudio.uploadReference.useMutation();

  const handleAddSlot = useCallback((file: File, index: number) => {
    if (file.size > 8 * 1024 * 1024) {
      setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, error: "File must be under 8MB" } : s));
      return;
    }
    const isImage = file.type.startsWith("image/");
    const isText = file.type.startsWith("text/") || file.name.endsWith(".md") || file.name.endsWith(".txt");
    const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
    if (!isImage && !isText && !isPdf) {
      setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, error: "Accepted: images, .md, .txt, .pdf" } : s));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const fileResult = ev.target?.result;
      if (isImage) {
        const dataUrl = fileResult as string;
        setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, preview: dataUrl, fileName: file.name, fileType: file.type, uploading: true, error: null } : s));
        const base64 = dataUrl.split(",")[1];
        uploadRefMut.mutate(
          { contentType: file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif", dataBase64: base64 },
          {
            onSuccess: (data) => setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, url: data.url, uploading: false } : s)),
            onError: (err) => setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, uploading: false, error: err.message ?? "Upload failed" } : s)),
          }
        );
      } else {
        const dataUrl = fileResult as string;
        setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, preview: dataUrl, fileName: file.name, fileType: file.type, uploading: true, error: null } : s));
        const base64 = dataUrl.split(",")[1];
        const contentType = isPdf ? "application/pdf" : "text/plain";
        uploadRefMut.mutate(
          { contentType: contentType as "image/png", dataBase64: base64 },
          {
            onSuccess: (data) => setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, url: data.url, uploading: false } : s)),
            onError: (err) => setRefSlots(prev => prev.map((s, i) => i === index ? { ...s, uploading: false, error: err.message ?? "Upload failed" } : s)),
          }
        );
      }
    };
    reader.readAsDataURL(file);
  }, [uploadRefMut]);

  const handleRemoveSlot = useCallback((index: number) => {
    setRefSlots(prev => prev.map((s, i) => i === index ? { preview: null, url: null, uploading: false, error: null, fileName: undefined, fileType: undefined } : s));
  }, []);

  const { data: models = [], isLoading: modelsLoading } = trpc.aiStudio.listModels.useQuery(
    { modality }, { staleTime: 5 * 60 * 1000 }
  );
  const { data: spendData } = trpc.aiStudio.videoSpend.useQuery(undefined, {
    staleTime: 30 * 1000, refetchOnWindowFocus: true,
  });

  // Poll for async fal.ai job results
  const { data: pollData } = trpc.aiStudio.pollJob.useQuery(
    { logId: pendingLogId! },
    {
      enabled: pendingLogId !== null,
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d) return 3000;
        if (d.status === "pending") return 3000;
        return false;
      },
      staleTime: 0,
    }
  );

  useEffect(() => {
    if (!pollData) return;
    if (pollData.status === "success") {
      setPendingLogId(null);
      setPollError(null);
      if (pollData.text !== undefined && pollData.text.trim() === "" && !pollData.imageUrl && !pollData.videoUrl) {
        setEmptyResponseError(true);
        return;
      }
      setEmptyResponseError(false);
      setResult({
        text: pollData.text,
        imageUrl: pollData.imageUrl,
        videoUrl: pollData.videoUrl,
        videoSeconds: pollData.videoSeconds,
        costUsd: pollData.costUsd,
        enrichedPrompt: pollData.enrichedPrompt,
      });
    } else if (pollData.status === "error") {
      setPendingLogId(null);
      setPollError(pollData.errorMessage ?? "Generation failed");
    }
  }, [pollData]);

  const generateMut = trpc.aiStudio.generate.useMutation({
    onSuccess: (data) => {
      if (data.status === "pending") {
        setPendingLogId(data.logId);
        setPollError(null);
        return;
      }
      if (data.text !== undefined && data.text.trim() === "" && !data.imageUrl && !data.videoUrl) {
        generateMut.reset();
        setEmptyResponseError(true);
        return;
      }
      setEmptyResponseError(false);
      setResult({
        text: data.text,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        videoSeconds: data.videoSeconds,
        costUsd: data.costUsd,
        enrichedPrompt: data.enrichedPrompt,
      });
    },
  });

  const currentTier = (spendData?.tier ?? propTier ?? "initiate") as ModelTier;
  const selectedModel = useMemo(() => models.find(m => m.id === selectedModelId) ?? null, [models, selectedModelId]);

  const handleModalityChange = useCallback((m: Modality) => {
    setModality(m);
    setSelectedModelId(null);
    setResult(null);
    setShowModelPicker(false);
    setRefSlots(EMPTY_SLOTS.map(s => ({ ...s })));
  }, []);

  const handleGenerate = useCallback(() => {
    if (!selectedModelId || !prompt.trim()) return;
    setResult(null);
    setEmptyResponseError(false);
    setPendingLogId(null);
    setPollError(null);
    const firstImageUrl = refSlots.find(s => s.url)?.url ?? undefined;
    generateMut.mutate({
      modelId: selectedModelId,
      prompt: prompt.trim(),
      imageUrl: firstImageUrl,
      videoDuration: modality === "video" ? videoDuration : undefined,
    });
  }, [selectedModelId, prompt, modality, videoDuration, refSlots, generateMut]);

  const handleCopy = useCallback(() => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const handleUseTemplate = useCallback((template: string) => {
    setPrompt(template);
  }, []);

  const handleCopyTemplate = (text: string, i: number) => {
    navigator.clipboard.writeText(text);
    setCopiedTpl(i);
    setTimeout(() => setCopiedTpl(null), 1500);
  };

  const isCapReached = modality === "video" && spendData && spendData.pct >= 1;
  const isPolling = pendingLogId !== null;
  const isGeneratingOrPolling = generateMut.isPending || isPolling;
  const canGenerate = !!selectedModelId && prompt.trim().length > 0 && !isGeneratingOrPolling && !isCapReached;

  // Cap alert level
  const capPct = spendData ? spendData.pct : 0;
  const capLevel: "ok" | "warn" | "high" | "max" =
    capPct >= 1 ? "max" : capPct >= 0.95 ? "high" : capPct >= 0.8 ? "warn" : "ok";

  if (!isVerified) {
    return (
      <>
        <AIStudioStyles />
        <VerificationGate />
      </>
    );
  }

  const lib = PROMPT_STARTERS[modality];

  return (
    <>
      <AIStudioStyles />

      {/* ── Studio header strip ── */}
      <div className="studio-intro">
        <div className="paper-pill">
          <span className="paper-dot" />
          Creator Studio
          <strong style={{ color: "var(--green)", marginLeft: 4 }}>{TIER_LABEL[currentTier]}</strong>
        </div>
        <h2 className="serif studio-title">AI Creator <em>Studio.</em></h2>
        <p className="lead studio-lead">
          A branded AI workspace built into the portal. Text, image, and video generation — tier-gated. <strong style={{ color: "var(--ink)" }}>The tool you unlock is the tool you use to earn your next tier.</strong>
        </p>
      </div>

      {/* ── 3-column studio grid ── */}
      <div className="studio-grid">

        {/* ── LEFT — tools ── */}
        <aside className="studio-tools">
          <div className="tier-banner">
            <div className="mono tname">★ Your tier</div>
            <div className="serif tier-name">{TIER_LABEL[currentTier]}</div>
            <div className="tier-sub">
              {TIER_UNLOCKS[currentTier].headline}
            </div>
          </div>

          <div className="side-section-label">Modes</div>
          {(["text", "image", "video"] as Modality[]).map(m => {
            const isLocked = (m === "video" && currentTier === "initiate");
            const isActive = modality === m;
            const label = m === "text" ? "Text" : m === "image" ? "Image" : "Video";
            const icon = m === "text" ? "✎" : m === "image" ? "▦" : "▷";
            const pill = m === "text" ? "Initiate +" : m === "image" ? "Active +" : "Champion +";
            return (
              <button
                key={m}
                className={`tool-nav${isActive ? " active" : ""}${isLocked ? " locked" : ""}`}
                onClick={() => !isLocked && handleModalityChange(m)}
                disabled={isLocked}
                type="button"
              >
                <span className="icon">{icon}</span>
                <span>{label}</span>
                <span className="pill mono">{pill}</span>
              </button>
            );
          })}

          {/* Video spend meter */}
          {modality === "video" && spendData && (
            <>
              <div className="side-section-label">Monthly video budget</div>
              <div className={`spend-meter level-${capLevel}`}>
                <div className="spend-head">
                  <span className="mono spend-label">Used</span>
                  <span className="mono spend-value">
                    {spendData.secondsUsed.toFixed(0)}s / {spendData.capSeconds}s
                  </span>
                </div>
                <div className="spend-bar">
                  <div className="spend-bar-fill" style={{ width: `${Math.min(capPct, 1) * 100}%` }} />
                </div>
                {capLevel === "warn" && (
                  <div className="mono spend-alert">⚠ 80% of monthly budget used</div>
                )}
                {capLevel === "high" && (
                  <div className="mono spend-alert hot">⚠ 95% of monthly budget used — generations soon limited</div>
                )}
                {capLevel === "max" && (
                  <div className="mono spend-alert hot">⊘ Monthly cap reached — video locked until reset</div>
                )}
              </div>
            </>
          )}

          {/* Account strip — tiers + monthly text */}
          <div className="side-section-label">Account</div>
          <div className="account-card">
            <div className="account-line">
              <strong>Text:</strong> Unlimited
            </div>
            <div className={`account-line${currentTier === "initiate" ? " dim" : ""}`}>
              <strong>Image:</strong> {currentTier === "initiate" ? "Locked" : "Active"}
            </div>
            <div className={`account-line${(currentTier === "initiate" || currentTier === "active") ? " dim" : ""}`}>
              <strong>Video:</strong> {(currentTier === "initiate" || currentTier === "active")
                ? "Locked"
                : `${VIDEO_CAP[currentTier]}s / month`}
            </div>
          </div>

          {/* Tier ladder hint */}
          <div className="tier-hint">
            <div className="mono tier-hint-label">How tiers work</div>
            <p className="tier-hint-body">
              Higher tiers unlock more modes and bigger monthly budgets. Climb XP, unlock the next tool.
            </p>
          </div>
        </aside>

        {/* ── MAIN — workspace ── */}
        <main className="studio-main">

          {/* Prompt block */}
          <div className="mono section-label">Prompt</div>
          <div className="prompt-box">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canGenerate) handleGenerate(); }}
              placeholder={
                modality === "text"
                  ? "Write a thread explaining how the protocol works, in plain language for a non-technical audience..."
                  : modality === "image"
                  ? "Generate a hero image: stylized currency corridors converging at a single settlement node, warm tones, editorial feel..."
                  : "A 5-second cinematic zoom into a glowing network of nodes. Warm paper background, green light trails..."
              }
              className="prompt-textarea"
            />
            <div className="prompt-tools">
              <div className="prompt-meta">
                <span className="mono prompt-count">
                  {prompt.length} / 4000
                  {prompt.length > 3500 && <span className="prompt-count-warn"> · approaching limit</span>}
                </span>
                <span className="mono prompt-hint">⌘↵ to generate</span>
              </div>
              <button
                className={`gen-btn${canGenerate ? "" : " disabled"}`}
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                {isGeneratingOrPolling ? (
                  <><span className="paper-spinner inline" /> Generating...</>
                ) : isCapReached ? (
                  <>⊘ Cap reached</>
                ) : (
                  <>Generate <span style={{ fontSize: 16 }}>↗</span></>
                )}
              </button>
            </div>
          </div>

          {/* Reference slot grid */}
          <ReferenceSlots
            slots={refSlots}
            onAddSlot={handleAddSlot}
            onRemoveSlot={handleRemoveSlot}
            supportsImageInput={!!selectedModel?.supportsImageInput}
          />

          {/* Video duration chips */}
          {modality === "video" && (
            <div className="video-duration">
              <div className="mono section-label">Duration</div>
              <div className="duration-row">
                {[3, 5, 8, 10, 15, 20].map(d => (
                  <button
                    key={d}
                    className={`tool-chip${videoDuration === d ? " active" : ""}`}
                    onClick={() => setVideoDuration(d)}
                    type="button"
                  >
                    {d}s
                  </button>
                ))}
              </div>
              <div className="mono duration-note">
                ~{selectedModel ? `$${(selectedModel.pricePerUnit * videoDuration).toFixed(3)}` : "—"} · uses {videoDuration}s of your {VIDEO_CAP[currentTier]}s monthly budget
              </div>
            </div>
          )}

          {/* Output */}
          <div className="mono section-label" style={{ marginTop: 10 }}>Output</div>
          <div className="output-card">
            <div className="out-meta">
              <span>
                {result
                  ? `★ ${modality === "text" ? "Text" : modality === "image" ? "Image" : "Video"} · ready`
                  : isPolling
                  ? "Processing..."
                  : isGeneratingOrPolling
                  ? "Generating..."
                  : "Waiting"}
              </span>
              {result?.costUsd !== undefined && (
                <>
                  {result.videoSeconds && <span>{result.videoSeconds.toFixed(1)}s</span>}
                  <span>Cost: ${result.costUsd.toFixed(4)}</span>
                </>
              )}
              {result && <span style={{ color: "var(--green)" }}>★ Brand-safe</span>}
            </div>

            {/* Poll error */}
            {pollError && (
              <div className="output-error">
                <strong>Generation failed</strong>
                <span>{pollError}</span>
              </div>
            )}

            {/* Mutation error */}
            {(generateMut.isError || emptyResponseError) && (
              <div className="output-error">
                <strong>⚠ Generation failed</strong>
                <span>
                  {emptyResponseError
                    ? "The model returned an empty response. Try again or switch models."
                    : (generateMut.error?.message ?? "Generation failed. Please try again.")}
                </span>
              </div>
            )}

            {result ? (
              <div className="output-result">
                {result.text && (
                  <>
                    <div className="output-text serif">
                      <Streamdown>{result.text}</Streamdown>
                    </div>
                    <div className="output-actions">
                      <button className="tool-chip" onClick={handleCopy} type="button">
                        {copied ? "✓ Copied" : "⤓ Copy text"}
                      </button>
                      <button
                        className="tool-chip"
                        onClick={() => { setResult(null); setEmptyResponseError(false); }}
                        type="button"
                      >
                        ↺ New generation
                      </button>
                    </div>
                  </>
                )}
                {result.imageUrl && (
                  <>
                    <img src={result.imageUrl} alt="Generated" className="output-image" />
                    <div className="output-actions">
                      <a
                        className="tool-chip"
                        href={result.imageUrl}
                        download="ambassador-generated.png"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ⤓ Download
                      </a>
                      <button
                        className="tool-chip"
                        onClick={() => { setResult(null); setEmptyResponseError(false); }}
                        type="button"
                      >
                        ↺ New generation
                      </button>
                    </div>
                  </>
                )}
                {result.videoUrl && (
                  <>
                    <video src={result.videoUrl} controls className="output-video" />
                    <div className="output-actions">
                      <a
                        className="tool-chip"
                        href={result.videoUrl}
                        download="ambassador-generated.mp4"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ⤓ Download
                      </a>
                      <button
                        className="tool-chip"
                        onClick={() => { setResult(null); setEmptyResponseError(false); }}
                        type="button"
                      >
                        ↺ New generation
                      </button>
                    </div>
                  </>
                )}
                {result.enrichedPrompt && (
                  <div className="enriched-prompt">
                    <div className="mono enriched-label">Enriched prompt (sent to model)</div>
                    <div className="enriched-body">{result.enrichedPrompt}</div>
                  </div>
                )}
              </div>
            ) : (
              <OutputIdle modality={modality} isGenerating={isGeneratingOrPolling} />
            )}
          </div>
        </main>

        {/* ── RIGHT — model picker + library ── */}
        <aside className="studio-right">
          <div className="mono right-label">Pick a model</div>

          <button
            className={`model-trigger${selectedModel ? " selected" : ""}`}
            onClick={() => setShowModelPicker(v => !v)}
            type="button"
          >
            {selectedModel ? (
              <>
                <div className="model-trigger-name">{selectedModel.name}</div>
                <div className="model-trigger-meta mono">
                  {TIER_LABEL[selectedModel.tier]} · {selectedModel.provider}
                  {selectedModel.supportsImageInput && <span className="vision-pill">VISION</span>}
                </div>
              </>
            ) : (
              <span className="model-trigger-placeholder">
                {modelsLoading ? "Loading models..." : `Choose from ${models.length} models →`}
              </span>
            )}
          </button>

          {showModelPicker && (
            <div className="model-picker">
              {(["initiate", "active", "champion", "elite"] as ModelTier[]).map(t => {
                const tierModels = models.filter(m => m.tier === t);
                if (!tierModels.length) return null;
                return (
                  <div key={t} className="model-tier-group">
                    <div className="mono model-tier-head">{TIER_LABEL[t]} · {tierModels.length}</div>
                    <div className="model-list">
                      {tierModels.map(m => {
                        const isSelected = selectedModelId === m.id;
                        return (
                          <button
                            key={m.id}
                            className={`model-card${isSelected ? " selected" : ""}${m.featured ? " featured" : ""}`}
                            onClick={() => { setSelectedModelId(m.id); setShowModelPicker(false); }}
                            type="button"
                          >
                            <div className="model-card-head">
                              <span className="serif model-card-name">{m.name}</span>
                              {m.featured && <span className="mono model-card-flag">★ Featured</span>}
                            </div>
                            <div className="mono model-card-meta">
                              {m.provider}
                              {m.supportsImageInput && <span className="vision-pill"> VISION</span>}
                            </div>
                            <div className="model-card-why">{m.why}</div>
                            <div className="mono model-card-price">
                              {m.modality === "video"
                                ? `$${m.pricePerUnit.toFixed(3)}/s`
                                : m.priceBasis === "per image"
                                ? `~$${m.pricePerUnit.toFixed(3)}/image`
                                : `~$${(m.pricePerUnit * 1000).toFixed(3)}/1k gen`}
                            </div>
                            {m.deprecationWarning && (
                              <div className="mono model-card-warn">⚠ {m.deprecationWarning}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Prompt library */}
          <div className="library-card">
            <button
              className="library-head"
              onClick={() => setLibraryOpen(o => !o)}
              type="button"
            >
              <span className="mono">Prompt guidance</span>
              <span className="mono lib-chevron">{libraryOpen ? "▾" : "▸"}</span>
            </button>
            {libraryOpen && (
              <div className="library-body">
                <div className="library-tabs">
                  {(["tips", "why"] as const).map(tab => (
                    <button
                      key={tab}
                      className={`library-tab${libraryTab === tab ? " active" : ""}`}
                      onClick={() => setLibraryTab(tab)}
                      type="button"
                    >
                      {tab === "tips" ? "Tips & templates" : "Why context?"}
                    </button>
                  ))}
                </div>

                {libraryTab === "tips" && (
                  <div className="library-section">
                    <div className="library-intro">{lib.intro}</div>

                    <div className="mono library-sub">Starter templates</div>
                    {lib.templates.map((t, i) => (
                      <div key={i} className="template-card">
                        <div className="template-head">
                          <span className="serif template-name">{t.label}</span>
                          {t.platform && <span className="mono template-platform">{t.platform}</span>}
                        </div>
                        <div className="template-preview">
                          {t.template.slice(0, 120)}{t.template.length > 120 ? "..." : ""}
                        </div>
                        {t.note && <div className="template-note">{t.note}</div>}
                        <div className="template-actions">
                          <button
                            className="tool-chip small"
                            onClick={() => handleCopyTemplate(t.template, i)}
                            type="button"
                          >
                            {copiedTpl === i ? "✓ Copied" : "⤓ Copy"}
                          </button>
                          <button
                            className="tool-chip small active"
                            onClick={() => handleUseTemplate(t.template)}
                            type="button"
                          >
                            Use →
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="mono library-sub">
                      {modality === "text" ? "X writing rules" : modality === "image" ? "Image prompt tips" : "Video prompt tips"}
                    </div>
                    {modality === "text" ? (
                      <div className="tip-list">
                        {[
                          { title: "Confidence without hedging", body: "\"I think maybe this could be\" is death. State the take. Being wrong confidently is more engaging than being right weakly." },
                          { title: "Earned brevity", body: "Short posts win when the compression is the art — cut until the idea is dense. Short posts lose when they're short because nothing was said." },
                          { title: "No performative openers", body: "\"Hot take:\", \"Unpopular opinion:\", \"This might be controversial:\" — these signal you're optimising for engagement rather than saying something real. People clock it." },
                          { title: "Specificity beats generality", body: "\"Stablecoin settlement is broken\" gets nothing. \"We just settled a $200K FX transfer in 4 seconds for $0.10. The correspondent bank would've taken 3 days and charged $80.\" That gets read." },
                          { title: "The first line is the whole game", body: "X cuts off after the first few lines in the timeline. If line one doesn't earn the click, nothing else matters." },
                        ].map((item, i) => (
                          <div key={i} className="tip-item">
                            <div className="serif tip-title">{item.title}</div>
                            <div className="tip-body">{item.body}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="tip-list">
                        {lib.tips.map((tip, i) => (
                          <div key={i} className="tip-item bullet">
                            <span className="mono tip-bullet">{String(i + 1).padStart(2, "0")}</span>
                            <span className="tip-body">{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {libraryTab === "why" && (
                  <div className="library-section">
                    {lib.whyContext.split("\n\n").map((para, i) => (
                      <p key={i} className="why-para">{para}</p>
                    ))}
                    {modality === "text" && (
                      <div className="protocol-context-card">
                        <div className="mono protocol-context-label">★ Protocol context — copy into your prompt</div>
                        <div className="serif protocol-context-body">
                          &ldquo;[YOUR PROTOCOL DESCRIPTION: 1-2 sentences explaining what the protocol does and its key differentiator.]&rdquo;
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Brand-tuned tip card */}
          <div className="brand-tip">
            <div className="mono brand-tip-label">★ Brand-tuned tip</div>
            <p className="brand-tip-body">
              The Studio is brand-tuned. Generations stay within your protocol's voice and never invent claims. Edit before posting if anything feels off.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

export default AIStudioTab;

// ── PAGE-LOCAL STYLES ─────────────────────────────────────────────────────
// Mirrors the AIStudio.html <style> block, expanded to cover the v2 paper
// palette and the controls our component needs (reference slots, model
// picker, spend meter, library, etc.). Kept in this file so the AI Studio
// tab is self-contained.

function AIStudioStyles() {
  return (
    <style>{`
      /* Intro / hero strip */
      .studio-intro {
        margin-bottom: 28px;
      }
      .studio-title {
        font-family: 'Fraunces', serif;
        font-size: clamp(32px, 4.5vw, 52px);
        line-height: 1.0;
        letter-spacing: -0.02em;
        font-weight: 400;
        margin: 18px 0 12px;
      }
      .studio-title em { font-style: italic; font-weight: 500; }
      .studio-lead {
        max-width: 720px;
        margin: 0 0 0;
        font-size: 17px;
        line-height: 1.6;
        color: var(--ink-soft);
      }

      /* 3-column studio grid */
      .studio-grid {
        display: grid;
        grid-template-columns: 240px 1fr 320px;
        gap: 18px;
        align-items: stretch;
      }
      @media (max-width: 1180px) {
        .studio-grid { grid-template-columns: 220px 1fr; }
        .studio-right { display: none; }
      }
      @media (max-width: 820px) {
        .studio-grid { grid-template-columns: 1fr; }
        .studio-tools { display: none; }
      }
      .studio-tools,
      .studio-main,
      .studio-right {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 22px;
      }

      /* ── Left column ────────────────────────────────────── */
      .tier-banner {
        background: rgba(0,200,134,0.06);
        border: 1px solid rgba(0,200,134,0.35);
        border-radius: 10px;
        padding: 16px 18px;
        margin-bottom: 22px;
      }
      .tier-banner .tname {
        font-size: 11px;
        color: var(--green);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .tier-name {
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.01em;
        margin-bottom: 4px;
      }
      .tier-sub {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.5;
      }

      .side-section-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin: 22px 0 10px;
        padding-left: 4px;
      }
      .side-section-label:first-of-type { margin-top: 0; }

      .tool-nav {
        display: flex; align-items: center; gap: 10px;
        padding: 11px 14px; border-radius: 8px;
        color: var(--ink-soft); cursor: pointer;
        font-size: 14px; transition: background .12s, color .12s;
        margin-bottom: 4px;
        border: none; background: transparent; width: 100%;
        text-align: left;
        font-family: 'Inter', sans-serif;
      }
      .tool-nav:hover:not(.locked):not(:disabled) {
        background: var(--paper-2);
        color: var(--ink);
      }
      .tool-nav.active {
        background: rgba(0,200,134,0.08);
        color: var(--green);
        font-weight: 600;
      }
      .tool-nav.locked { color: var(--ink-mute); cursor: not-allowed; opacity: 0.6; }
      .tool-nav:disabled { cursor: not-allowed; }
      .tool-nav .icon { width: 22px; text-align: center; font-size: 14px; }
      .tool-nav .pill {
        margin-left: auto;
        font-size: 9px;
        background: var(--paper-2);
        color: var(--ink-mute);
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }
      .tool-nav.active .pill {
        background: var(--green-brand);
        color: var(--ink);
      }

      .spend-meter {
        padding: 14px 16px;
        background: var(--paper-2);
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .spend-meter.level-warn { border-color: rgba(212, 152, 36, 0.4); background: rgba(212, 152, 36, 0.06); }
      .spend-meter.level-high { border-color: rgba(193, 75, 58, 0.4); background: rgba(193, 75, 58, 0.06); }
      .spend-meter.level-max  { border-color: rgba(193, 75, 58, 0.6); background: rgba(193, 75, 58, 0.1); }
      .spend-head {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 8px;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .spend-label { color: var(--ink-mute); font-weight: 700; }
      .spend-value { color: var(--ink); font-weight: 700; }
      .spend-bar {
        height: 6px;
        background: var(--paper);
        border-radius: 3px;
        overflow: hidden;
        border: 1px solid var(--line);
      }
      .spend-bar-fill {
        height: 100%;
        background: var(--green);
        transition: width .3s ease;
      }
      .level-warn .spend-bar-fill { background: #d49824; }
      .level-high .spend-bar-fill { background: #c14b3a; }
      .level-max  .spend-bar-fill { background: #c14b3a; }
      .spend-alert {
        margin-top: 10px;
        font-size: 10px;
        letter-spacing: 0.06em;
        color: #b8771b;
        line-height: 1.4;
      }
      .spend-alert.hot { color: #c14b3a; }

      .account-card {
        padding: 12px 14px;
        background: var(--paper-2);
        border-radius: 8px;
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.5;
      }
      .account-line { margin-bottom: 6px; }
      .account-line:last-child { margin-bottom: 0; }
      .account-line strong { color: var(--ink); font-weight: 600; }
      .account-line.dim { opacity: 0.5; }

      .tier-hint {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }
      .tier-hint-label {
        font-size: 11px;
        color: var(--green);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 6px;
        display: block;
      }
      .tier-hint-body {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.55;
        margin: 0;
      }

      /* ── Main column ───────────────────────────────────── */
      .section-label {
        font-size: 11px;
        color: var(--green);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 700;
        margin: 0 0 10px;
      }

      .prompt-box {
        background: var(--paper-2);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 18px;
        margin-bottom: 18px;
        transition: border-color .15s;
      }
      .prompt-box:focus-within { border-color: var(--ink); }
      .prompt-textarea {
        width: 100%;
        background: transparent;
        border: none;
        color: var(--ink);
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        line-height: 1.55;
        resize: vertical;
        min-height: 160px;
        outline: none;
        box-sizing: border-box;
      }
      .prompt-textarea::placeholder { color: var(--ink-mute); }

      .prompt-tools {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--line);
        gap: 12px;
        flex-wrap: wrap;
      }
      .prompt-meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .prompt-count {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .prompt-count-warn { color: #c14b3a; }
      .prompt-hint {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.04em;
      }

      .gen-btn {
        background: var(--ink);
        color: var(--paper);
        border: none;
        border-radius: 999px;
        padding: 10px 22px;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: opacity .15s ease, transform .12s ease;
      }
      .gen-btn:hover:not(.disabled) {
        transform: translateY(-1px);
      }
      .gen-btn.disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* Reference slot grid */
      .ref-slots { margin-bottom: 22px; }
      .ref-slots-head {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .ref-slots-label {
        font-size: 11px;
        color: var(--green);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 700;
      }
      .ref-slots-hint {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .ref-slots-pill {
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--paper-2);
        border: 1px solid var(--line);
        color: var(--ink-mute);
        font-size: 9px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .ref-slots-row {
        display: flex;
        gap: 10px;
        align-items: center;
        transition: opacity .2s;
      }
      .ref-slots-row.disabled { opacity: 0.4; }
      .ref-slot-wrap { position: relative; }
      .ref-slot {
        width: 80px; height: 80px; border-radius: 10px;
        border: 1.5px dashed var(--line);
        background: var(--paper-2);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 4px;
        overflow: hidden;
        position: relative;
        transition: border-color .15s ease, background .15s ease;
      }
      .ref-slot.filled {
        border-style: solid;
        border-color: var(--ink);
        background: var(--paper);
      }
      .ref-slot:hover {
        border-color: var(--green);
      }
      .ref-slot.filled:hover { border-color: var(--ink); }
      .ref-slot-img {
        width: 100%; height: 100%;
        object-fit: cover; display: block;
      }
      .ref-slot-file {
        padding: 6px;
        text-align: center;
      }
      .ref-slot-file-icon {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        color: var(--ink-mute);
        letter-spacing: 0.08em;
        margin-bottom: 4px;
      }
      .ref-slot-file-name {
        font-size: 9px;
        color: var(--ink-soft);
        word-break: break-all;
        line-height: 1.2;
      }
      .ref-slot-plus {
        font-size: 22px;
        color: var(--ink-mute);
        line-height: 1;
      }
      .ref-slot-label {
        font-size: 9px;
        color: var(--ink-mute);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 600;
      }
      .ref-slot-uploading {
        position: absolute; inset: 0;
        background: rgba(244, 239, 230, 0.85);
        display: flex; align-items: center; justify-content: center;
      }
      .ref-slot-ready {
        position: absolute; bottom: 4px; left: 4px;
        width: 8px; height: 8px;
        border-radius: 50%;
        background: var(--green);
        box-shadow: 0 0 0 2px var(--paper);
      }
      .ref-slot-rm {
        position: absolute; top: -7px; right: -7px;
        width: 18px; height: 18px; border-radius: 50%;
        background: var(--ink); color: var(--paper);
        border: 2px solid var(--paper);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; font-weight: 700;
        line-height: 1;
        padding: 0;
      }
      .ref-slots-help {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.04em;
        line-height: 1.55;
        margin-left: 4px;
      }
      .ref-slot-error {
        margin-top: 8px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        color: #c14b3a;
      }

      /* Tool chips (filters / format / actions) */
      .tool-chip {
        background: var(--paper);
        border: 1px solid var(--line);
        color: var(--ink-soft);
        padding: 6px 12px;
        border-radius: 999px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.06em;
        cursor: pointer;
        text-transform: uppercase;
        font-weight: 600;
        transition: border-color .12s, color .12s;
        display: inline-flex; align-items: center; gap: 6px;
        text-decoration: none;
      }
      .tool-chip.small { padding: 4px 10px; font-size: 9px; }
      .tool-chip:hover {
        border-color: var(--ink);
        color: var(--ink);
      }
      .tool-chip.active {
        border-color: var(--green);
        color: var(--green);
        background: rgba(0,200,134,0.06);
      }

      .video-duration { margin-bottom: 22px; }
      .duration-row {
        display: flex; gap: 6px; flex-wrap: wrap;
        margin-bottom: 8px;
      }
      .duration-note {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.04em;
        line-height: 1.5;
      }

      /* Output card */
      .output-card {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 22px;
        min-height: 280px;
      }
      .out-meta {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--line);
      }
      .output-error {
        padding: 12px 14px;
        background: rgba(193, 75, 58, 0.08);
        border: 1px solid rgba(193, 75, 58, 0.3);
        border-radius: 8px;
        color: #8a3528;
        font-size: 13px;
        line-height: 1.55;
        margin-bottom: 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .output-error strong { color: #c14b3a; font-weight: 700; }

      .output-text {
        font-size: 16px;
        line-height: 1.65;
        color: var(--ink);
        margin-bottom: 16px;
      }
      .output-text :is(p, ul, ol, blockquote) { margin: 0 0 12px; }
      .output-text strong { font-weight: 600; }

      .output-image,
      .output-video {
        width: 100%;
        border-radius: 10px;
        border: 1px solid var(--line);
        margin-bottom: 14px;
        display: block;
      }

      .output-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding-top: 14px;
        border-top: 1px solid var(--line);
      }
      .output-result { display: flex; flex-direction: column; gap: 0; }

      .enriched-prompt {
        margin-top: 16px;
        padding: 14px 16px;
        background: var(--paper-2);
        border: 1px solid var(--line);
        border-radius: 8px;
      }
      .enriched-label {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
      }
      .enriched-body {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .output-idle {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
        gap: 10px;
        text-align: center;
      }
      .output-idle-mark {
        font-size: 28px;
        color: var(--ink-mute);
        opacity: 0.5;
        margin-bottom: 6px;
      }
      .output-idle-headline {
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--ink);
      }
      .output-idle-sub {
        font-size: 13px;
        color: var(--ink-soft);
        line-height: 1.55;
        max-width: 380px;
      }

      /* ── Right column ───────────────────────────────── */
      .right-label {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 12px;
        display: block;
      }
      .studio-right { display: flex; flex-direction: column; gap: 16px; padding: 22px; }

      .model-trigger {
        width: 100%;
        text-align: left;
        background: var(--paper-2);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px 16px;
        cursor: pointer;
        font-family: inherit;
        transition: border-color .12s ease;
      }
      .model-trigger:hover { border-color: var(--ink); }
      .model-trigger.selected { border-color: var(--green); background: rgba(0, 200, 134, 0.04); }
      .model-trigger-name {
        font-family: 'Fraunces', serif;
        font-size: 17px;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--ink);
        margin-bottom: 6px;
      }
      .model-trigger-meta {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .model-trigger-placeholder {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        color: var(--ink-mute);
        letter-spacing: 0.04em;
      }
      .vision-pill {
        margin-left: 6px;
        padding: 1px 6px;
        border-radius: 3px;
        background: rgba(0, 200, 134, 0.1);
        border: 1px solid rgba(0, 200, 134, 0.3);
        color: var(--green);
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      .model-picker {
        background: var(--paper-2);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 14px;
        max-height: 400px;
        overflow-y: auto;
      }
      .model-tier-group { margin-bottom: 14px; }
      .model-tier-group:last-child { margin-bottom: 0; }
      .model-tier-head {
        font-size: 10px;
        color: var(--green);
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--line);
      }
      .model-list { display: flex; flex-direction: column; gap: 6px; }
      .model-card {
        text-align: left;
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px 12px;
        cursor: pointer;
        font-family: inherit;
        position: relative;
        transition: border-color .12s ease, background .12s ease;
      }
      .model-card:hover { border-color: var(--ink); }
      .model-card.selected {
        border-color: var(--green);
        background: rgba(0, 200, 134, 0.06);
        box-shadow: 2px 2px 0 var(--green-brand);
      }
      .model-card.featured { border-color: rgba(0, 200, 134, 0.5); }
      .model-card-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
      }
      .model-card-name {
        font-size: 14px;
        font-weight: 500;
        letter-spacing: -0.01em;
        color: var(--ink);
      }
      .model-card-flag {
        font-size: 9px;
        color: var(--green);
        letter-spacing: 0.06em;
        font-weight: 700;
      }
      .model-card-meta {
        font-size: 9px;
        color: var(--ink-mute);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .model-card-why {
        font-size: 11px;
        color: var(--ink-soft);
        line-height: 1.5;
        margin-bottom: 4px;
      }
      .model-card-price {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.04em;
      }
      .model-card-warn {
        margin-top: 6px;
        padding: 4px 8px;
        background: rgba(212, 152, 36, 0.1);
        border: 1px solid rgba(212, 152, 36, 0.3);
        border-radius: 4px;
        font-size: 9px;
        color: #8a611b;
        line-height: 1.4;
      }

      /* Library card */
      .library-card {
        background: var(--paper-2);
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
      }
      .library-head {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%;
        padding: 12px 14px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-family: inherit;
      }
      .library-head .mono {
        font-size: 11px;
        color: var(--ink);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
      }
      .lib-chevron { font-size: 12px; color: var(--ink-mute); }

      .library-body { padding: 0 14px 14px; }
      .library-tabs {
        display: flex; gap: 4px;
        border-bottom: 1px solid var(--line);
        margin-bottom: 14px;
      }
      .library-tab {
        background: transparent;
        border: none;
        padding: 8px 10px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
      }
      .library-tab:hover { color: var(--ink); }
      .library-tab.active {
        color: var(--ink);
        font-weight: 700;
        border-bottom-color: var(--green);
      }

      .library-section { display: flex; flex-direction: column; gap: 0; }
      .library-intro {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.6;
        margin-bottom: 14px;
      }
      .library-sub {
        font-size: 10px;
        color: var(--ink-mute);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
        margin: 14px 0 8px;
      }
      .library-sub:first-of-type { margin-top: 0; }

      .template-card {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 6px;
      }
      .template-head {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 6px;
      }
      .template-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--ink);
      }
      .template-platform {
        padding: 1px 6px;
        border-radius: 3px;
        background: var(--paper-2);
        border: 1px solid var(--line);
        color: var(--ink-mute);
        font-size: 9px;
        letter-spacing: 0.06em;
      }
      .template-preview {
        font-size: 11px;
        color: var(--ink-mute);
        line-height: 1.55;
        white-space: pre-line;
        margin-bottom: 6px;
      }
      .template-note {
        font-size: 11px;
        color: var(--ink-soft);
        font-style: italic;
        line-height: 1.5;
        padding-top: 6px;
        border-top: 1px solid var(--line);
        margin-bottom: 8px;
      }
      .template-actions { display: flex; gap: 6px; }

      .tip-list { display: flex; flex-direction: column; gap: 12px; }
      .tip-item .tip-title {
        font-size: 13px;
        color: var(--ink);
        font-weight: 500;
        margin-bottom: 4px;
      }
      .tip-item .tip-body {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.6;
      }
      .tip-item.bullet {
        display: flex; gap: 10px;
        align-items: flex-start;
      }
      .tip-bullet {
        font-size: 10px;
        color: var(--green);
        font-weight: 700;
        flex-shrink: 0;
        padding-top: 2px;
      }

      .why-para {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.7;
        margin: 0 0 14px;
      }
      .protocol-context-card {
        margin-top: 4px;
        padding: 14px;
        border-radius: 8px;
        background: rgba(0, 200, 134, 0.06);
        border: 1px solid rgba(0, 200, 134, 0.3);
      }
      .protocol-context-label {
        font-size: 10px;
        color: var(--green);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
        display: block;
      }
      .protocol-context-body {
        font-size: 13px;
        color: var(--ink);
        line-height: 1.6;
        font-style: italic;
      }

      /* Brand tip card (mirrors AIStudio.html footer card) */
      .brand-tip {
        padding: 16px;
        background: rgba(0, 200, 134, 0.06);
        border: 1px solid rgba(0, 200, 134, 0.3);
        border-radius: 10px;
      }
      .brand-tip-label {
        font-size: 10px;
        color: var(--green);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
        display: block;
      }
      .brand-tip-body {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.55;
        margin: 0;
      }

      /* ── Verification gate ────────────────────────────── */
      .verify-shell {
        max-width: 560px;
        margin: 0 auto;
        padding: 56px 0 72px;
      }
      .verify-title {
        font-family: 'Fraunces', serif;
        font-size: clamp(32px, 5vw, 48px);
        line-height: 1.05;
        letter-spacing: -0.02em;
        font-weight: 400;
        margin: 14px 0 16px;
      }
      .verify-title em { font-style: italic; font-weight: 500; }
      .verify-body { font-size: 17px; line-height: 1.65; color: var(--ink-soft); margin-bottom: 32px; }
      .field-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        color: var(--ink-mute);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-weight: 700;
        margin-bottom: 8px;
        display: block;
      }
      .paper-input {
        width: 100%;
        padding: 14px 16px;
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        color: var(--ink);
        margin-bottom: 18px;
        outline: none;
        box-sizing: border-box;
        transition: border-color .12s;
      }
      .paper-input:focus { border-color: var(--ink); }
      .paper-input.with-prefix { padding-left: 34px; }
      .input-with-prefix { position: relative; }
      .input-prefix {
        position: absolute;
        left: 14px;
        top: 14px;
        font-size: 16px;
        color: var(--ink-mute);
        pointer-events: none;
      }
      .verify-error {
        padding: 10px 14px;
        background: rgba(193, 75, 58, 0.08);
        border: 1px solid rgba(193, 75, 58, 0.3);
        border-radius: 6px;
        color: #8a3528;
        font-size: 13px;
        margin-bottom: 14px;
      }
      .verify-submit {
        margin-top: 6px;
      }
      .verify-submit:disabled { opacity: 0.5; cursor: not-allowed; }

      .verify-pending-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: rgba(0, 200, 134, 0.06);
        border: 1px solid rgba(0, 200, 134, 0.3);
        border-radius: 10px;
      }
      .verify-pending-label {
        font-size: 11px;
        color: var(--ink-mute);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .verify-pending-value {
        font-size: 13px;
        color: var(--green);
        letter-spacing: 0.06em;
        font-weight: 700;
      }

      /* Spinner */
      .paper-spinner {
        width: 16px; height: 16px;
        border-radius: 50%;
        border: 2px solid var(--line);
        border-top-color: var(--ink);
        animation: paper-spin .8s linear infinite;
      }
      .paper-spinner.big { width: 38px; height: 38px; }
      .paper-spinner.inline {
        display: inline-block;
        vertical-align: -3px;
        margin-right: 4px;
      }
      @keyframes paper-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}</style>
  );
}
