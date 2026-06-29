import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// ── TYPES ────────────────────────────────────────────────────────────────────

type CommunityEntry = {
  nameLink: string;
  shortDescription: string;
};

type FormData = {
  email: string;
  tracks: string[];
  contributionIntent: string[];
  answers: (string | null)[]; // 10 knowledge test answers
  communityEntries: CommunityEntry[];
  twitterHandle: string;
  telegramHandle: string;
  githubHandle: string;
  otherLinks: string;
  hasCommunityExperience: "yes" | "no" | "";
  communityLinks: { url: string; description: string }[];
  protocolDescription: string;
  communityBenefit: string;
  firstThirtyDays: string;
  confirmed: boolean;
};

const INITIAL_FORM: FormData = {
  email: "",
  tracks: [],
  contributionIntent: [],
  answers: Array(10).fill(null),
  communityEntries: [{ nameLink: "", shortDescription: "" }],
  twitterHandle: "",
  telegramHandle: "",
  githubHandle: "",
  otherLinks: "",
  hasCommunityExperience: "",
  communityLinks: [],
  protocolDescription: "",
  communityBenefit: "",
  firstThirtyDays: "",
  confirmed: false,
};

// ── KNOWLEDGE TEST QUESTIONS ─────────────────────────────────────────────────

const QUESTIONS = [
  {
    q: "What is this protocol's primary purpose?",
    options: [
      "A decentralized exchange for on-chain FX settlement with instant finality",
      "A yield farming platform for stablecoins",
      "A lending protocol for crypto assets",
      "A price discovery mechanism for volatile assets",
    ],
    correct: 0,
  },
  {
    q: "Which of the following statements is correct?",
    options: [
      "It uses standard AMM bonding curves like other DEXes.",
      "It is built specifically for cross-border settlement with real-time rates. No price discovery needed.",
      "Bonding Curve AMMs are the cheapest and fastest way to trade Stablecoins.",
      "Its AMM is forked from Uniswap or Balancer.",
    ],
    correct: 1,
  },
  {
    q: "What are the core pillars of this protocol's value proposition?",
    options: [
      "Speed, Cost, and Compliance",
      "Decentralization, Privacy, and Scalability",
      "Yield, Liquidity, and Governance",
      "Volatility, Leverage, and Trading Fees",
    ],
    correct: 0,
  },
  {
    q: "What is this protocol's current network status?",
    options: [
      "Mainnet is live on Ethereum",
      "Testnet is live on Ethereum Sepolia; Mainnet coming Q1 2026",
      "Only available on Layer 2 solutions",
      "Not yet launched",
    ],
    correct: 0,
  },
  {
    q: "How many stablecoins does this protocol support?",
    options: [
      "Only USDC and USDT",
      "70+ stablecoins across 20+ countries",
      "10 major stablecoins",
      "It doesn't support stablecoins directly",
    ],
    correct: 1,
  },
  {
    q: "What does CLOB stand for, and why does this protocol use it?",
    options: [
      "Central Liquidity Order Book. It pools liquidity from multiple sources.",
      "Central Limit Order Book. It matches buy and sell orders at known prices without price discovery.",
      "Continuous Ledger On-chain Bridge. It bridges assets between chains.",
      "Crypto Liquidity On-chain Base. It provides a base layer for DeFi.",
    ],
    correct: 1,
  },
  {
    q: "Why is FX settlement different from crypto trading?",
    options: [
      "FX is slower and more expensive than crypto trading.",
      "FX prices are already set by global markets, so no price discovery is needed. Only fast, accurate settlement.",
      "FX requires more liquidity pools than crypto trading.",
      "FX and crypto trading are essentially the same process.",
    ],
    correct: 1,
  },
  {
    q: "What is the key compliance advantage of this protocol?",
    options: [
      "It is fully anonymous and requires no KYC.",
      "It is only available to institutional investors.",
      "It is compliance-native from the ground up — designed to work within regulatory frameworks.",
      "It avoids compliance by operating on a permissionless chain.",
    ],
    correct: 2,
  },
  {
    q: "What problem does this protocol solve for businesses handling cross-border payments?",
    options: [
      "High gas fees on Ethereum.",
      "Lack of stablecoin liquidity on DEXes.",
      "Slow, expensive, and fragmented FX settlement when converting between stablecoins like USDC and EURC.",
      "The inability to hold stablecoins in a self-custody wallet.",
    ],
    correct: 2,
  },
  {
    q: "What is the role of a Market Maker on this protocol?",
    options: [
      "They mine new stablecoins and distribute them to users.",
      "They provide liquidity by posting buy and sell orders on the CLOB, enabling instant FX settlement.",
      "They validate transactions on the blockchain and earn block rewards.",
      "They set the exchange rates for all stablecoin pairs on the platform.",
    ],
    correct: 1,
  },
];

const CONTRIBUTION_OPTIONS = [
  "Creating educational content",
  "Building tools or demos with the protocol",
  "Supporting official community discussions",
  "Organising community meetups",
  "Building communities around the protocol",
  "Explaining the protocol to operators and businesses",
];

const TRACK_OPTIONS = [
  { id: "community", label: "Community Ambassador" },
  { id: "developer", label: "Developer Ambassador" },
  { id: "content", label: "Content Ambassador" },
];

// ── AUTOSAVE KEY ──────────────────────────────────────────────────────────────

const AUTOSAVE_KEY = "ambassador_apply_draft";

// ── SCREEN DEFINITIONS ────────────────────────────────────────────────────────
// New applicant flow:
//   email(0) → intro(1) → test_q1-10(2-11) → result(12) → motivation(22) → tracks(13) → intent(14) →
//   communities(15) → socials(16) → community_exp(17) → protocol_desc(18) → benefit(19) →
//   30days(20) → confirm(21)
//
// Evangelist / resume flow:
//   email(0) → evangelist_welcome(1) → motivation(22) → tracks(13) → intent(14) → ...same from 15 onward
//
// Screen 22 = motivation question (inserted between result/recognition and tracks)

type FlowMode = "unknown" | "new" | "evangelist" | "resume";

// Total user-facing screen count for progress bar normalization.
// New applicant traverses 22 unique screens (0..21), with the motivation
// detour at 22 logically sitting between 12 and 13. Evangelist/resume traverses
// roughly 0,1,22,13..21 — 11 screens.
const NEW_FLOW_TOTAL = 22;
const EVANG_FLOW_TOTAL = 11;

export default function Apply() {
  const [, navigate] = useLocation();

  // Gate state
  const [emailInput, setEmailInput] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [flowMode, setFlowMode] = useState<FlowMode>("unknown");
  const [existingId, setExistingId] = useState<number | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Screen: 0 = email gate, 1 = intro/evangelist-welcome, then per-flow
  const [screen, setScreen] = useState(0);

  const [form, setForm] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) return { ...INITIAL_FORM, ...JSON.parse(saved) };
    } catch {}
    return INITIAL_FORM;
  });

  const [submitted, setSubmitted] = useState(false);
  const [testScore, setTestScore] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  // For existing users: the screen they should resume at after seeing the recognition screen
  const [resumeTarget, setResumeTarget] = useState<number | null>(null);

  // Local toast (mirrors Apply.html's popin animation; we keep sonner around
  // for the network-error case but lean on the inline toast for validation
  // hints since the design includes the bottom-pill treatment).
  const [localToast, setLocalToast] = useState<string>("");
  const showToast = (t: string) => {
    setLocalToast(t);
    window.setTimeout(() => setLocalToast(""), 2600);
  };

  // Autosave
  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(form));
    } catch {}
  }, [form]);

  // Set body palette to paper while this page is mounted
  useEffect(() => {
    const prev = document.body.getAttribute("data-palette");
    document.body.setAttribute("data-palette", "paper");
    return () => {
      if (prev) document.body.setAttribute("data-palette", prev);
      else document.body.removeAttribute("data-palette");
    };
  }, []);

  // Pre-select track from ?track= URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("track");
    if (t && TRACK_OPTIONS.find((x) => x.id === t) && form.tracks.length === 0) {
      setForm((f) => ({ ...f, tracks: [t] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top on screen change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);

  const checkEmailMutation = trpc.ambassador.checkEmail.useMutation({
    onSuccess: (data) => {
      setCheckingEmail(false);
      setEmailChecked(true);
      if (data.exists) {
        setExistingId(data.id);
        if (data.isEvangelist) {
          setFlowMode("evangelist");
        } else {
          setFlowMode("resume");
        }
        // Pre-fill social handles and motivation from existing record
        const prefill: Partial<FormData> = { email: emailInput.toLowerCase().trim() };
        if (data.twitterHandle) prefill.twitterHandle = data.twitterHandle;
        if (data.telegramHandle) prefill.telegramHandle = data.telegramHandle;
        if (data.communityBenefit) prefill.communityBenefit = data.communityBenefit;
        update(prefill);
        // Always show screen 1 (recognition/resume screen) first so the user
        // sees they have been recognised before being taken to their resume point.
        // The resolvedScreen is stored so goNext() can jump there directly.
        const resolvedScreen = resolveResumeScreen(data.lastStep ?? "email", data.isEvangelist);
        setResumeTarget(resolvedScreen > 1 ? resolvedScreen : null);
        setScreen(1);
      } else {
        setFlowMode("new");
        setScreen(1); // intro
        update({ email: emailInput.toLowerCase().trim() });
      }
    },
    onError: (err) => {
      setCheckingEmail(false);
      const msg = err.message || "Could not check email. Please try again.";
      setEmailError(msg);
      toast.error(msg);
    },
  });

  const submitMutation = trpc.ambassador.submit.useMutation({
    onSuccess: () => {
      localStorage.removeItem(AUTOSAVE_KEY);
      setSubmitted(true);
    },
    onError: (err) => {
      // Parse Zod validation errors into human-readable messages
      let message = "Submission failed. Please check your answers and try again.";
      try {
        const parsed = JSON.parse(err.message);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          const path = Array.isArray(first.path) ? first.path.join(".") : "";
          if (path.includes("communityLinks") && path.includes("url")) {
            message = "One of your community links has an invalid URL. Make sure it starts with https:// (e.g. https://t.me/yourgroup).";
          } else if (path.includes("communityLinks") && path.includes("description")) {
            message = "Please add a description for each community link before submitting.";
          } else if (path.includes("communityBenefit")) {
            message = "Your answer about how this program benefits you is too short. Please write at least a few sentences.";
          } else if (path.includes("protocolDescription")) {
            message = "Your description of the protocol is too short. Please write at least one sentence.";
          } else if (path.includes("communities")) {
            message = "Please tell us more about your communities before submitting.";
          } else if (path.includes("firstThirtyDays")) {
            message = "Please describe what you plan to do in your first 30 days.";
          } else if (first.message && !first.message.startsWith('[')) {
            message = first.message;
          }
        }
      } catch {
        if (err.message && !err.message.startsWith('[{')) message = err.message;
      }
      toast.error(message, { duration: 7000 });
    },
  });

  const update = (patch: Partial<FormData>) => setForm((f) => ({ ...f, ...patch }));

  // ── RESUME SCREEN RESOLVER ──
  // Maps lastStep string → screen number
  function resolveResumeScreen(lastStep: string, isEvangelist: boolean): number {
    // Evangelist: skip test, start at tracks (screen 13 in new flow = screen 2 in evangelist flow)
    // We use a unified screen numbering:
    // 0=email, 1=intro(new)/evangelist-welcome(evang), 2-11=test q1-10(new only),
    // 12=test result(new only), 13=tracks, 14=intent, 15=communities, 16=socials,
    // 17=community_exp, 18=protocol_desc, 19=benefit, 20=30days, 21=confirm
    const stepMap: Record<string, number> = {
      email: isEvangelist ? 1 : 1,
      intro: isEvangelist ? 1 : 1,
      test: 12,
      tracks: 13,
      intent: 14,
      communities: 15,
      socials: 16,
      community_exp: 17,
      protocol_desc: 18,
      benefit: 19,
      thirtydays: 20,
      confirm: 21,
      submitted: 21,
    };
    return stepMap[lastStep] ?? (isEvangelist ? 1 : 1);
  }

  const goNext = () =>
    setScreen((s) => {
      // From screen 1 (recognition screen): jump to resume target if set, otherwise
      // Evangelists go to motivation (22), new applicants go to screen 2 (test q1)
      if (s === 1) {
        if (resumeTarget !== null) {
          setResumeTarget(null); // consume it
          return resumeTarget;
        }
        if (flowMode === "evangelist") return 22; // skip test, go to motivation
        return s + 1; // new applicant → intro → test q1 (screen 2)
      }
      // After test result (12): go to motivation screen (22)
      if (s === 12) return 22;
      // After motivation screen (22): go to tracks (13)
      if (s === 22) return 13;
      // Evangelists who somehow land on screens 2-12 should skip to motivation
      if (flowMode === "evangelist" && s >= 2 && s <= 12) return 22;
      return s + 1;
    });

  const goBack = () =>
    setScreen((s) => {
      // From tracks (13): go back to motivation (22)
      if (s === 13) return 22;
      // From motivation (22): go back to test result (12) for new, or recognition (1) for evangelist
      if (s === 22) return flowMode === "evangelist" ? 1 : 12;
      return Math.max(0, s - 1);
    });

  // Calculate test score when reaching result screen (screen 12)
  useEffect(() => {
    if (screen === 12) {
      setCalculating(true);
      setTestScore(null);
      const timer = setTimeout(() => {
        const score = form.answers.reduce<number>((acc, ans, i) => {
          return acc + (ans === QUESTIONS[i].options[QUESTIONS[i].correct] ? 1 : 0);
        }, 0);
        setTestScore(score);
        setCalculating(false);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [screen, form.answers]);

  // Progress bar percentage. We collapse the disjoint screen numbering
  // (0,1,2..12,22,13..21) into a monotonic position so the bar fills
  // smoothly forward.
  const screenPosition = (() => {
    if (flowMode === "evangelist" || flowMode === "resume") {
      // Evangelist sequence: 0, 1, 22, 13, 14, 15, 16, 17, 18, 19, 20, 21
      const seq = [0, 1, 22, 13, 14, 15, 16, 17, 18, 19, 20, 21];
      const idx = seq.indexOf(screen);
      return idx >= 0 ? idx : 0;
    }
    // New sequence: 0..12, 22, 13..21
    if (screen === 22) return 13;
    if (screen >= 13 && screen <= 21) return screen + 1;
    return screen;
  })();
  const totalForBar = flowMode === "evangelist" || flowMode === "resume" ? EVANG_FLOW_TOTAL : NEW_FLOW_TOTAL;
  const progressPct = Math.min(100, Math.round((screenPosition / totalForBar) * 100));

  // ── SUBMIT ──
  const handleSubmit = () => {
    // Validate community links — only required when user said yes to community experience
    if (form.hasCommunityExperience === "yes" && form.communityLinks.length > 0) {
      const missingDesc = form.communityLinks.some((l) => !l.description.trim());
      const missingUrl = form.communityLinks.some((l) => !l.url.trim());
      if (missingUrl) {
        toast.error("One of your community links is missing a URL. Please go back and fill it in.", { duration: 6000 });
        return;
      }
      if (missingDesc) {
        toast.error("One of your community links is missing a description. Please go back and add one.", { duration: 6000 });
        return;
      }
    }
    submitMutation.mutate({
      email: form.email,
      isEvangelist: flowMode === "evangelist",
      tracks: form.tracks as ("community" | "developer" | "content")[],
      contributionIntent: form.contributionIntent,
      testScore: flowMode === "evangelist" ? 10 : (testScore ?? 0),
      communities: form.communityEntries.map((e, i) => `${i + 1}. ${e.nameLink} — ${e.shortDescription}`).join("\n"),
      twitterHandle: form.twitterHandle || undefined,
      telegramHandle: form.telegramHandle || undefined,
      githubHandle: form.githubHandle || undefined,
      otherLinks: form.otherLinks || undefined,
      hasCommunityExperience: form.hasCommunityExperience as "yes" | "no",
      communityLinks: form.communityLinks.length > 0 ? form.communityLinks : undefined,
      protocolDescription: form.protocolDescription,
      communityBenefit: form.communityBenefit,
      firstThirtyDays: form.firstThirtyDays,
    });
  };

  // ── EMAIL CONTINUE HANDLER ──
  function handleEmailContinue() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      showToast("Enter a valid email");
      return;
    }
    setEmailError(null);
    setCheckingEmail(true);
    checkEmailMutation.mutate({ email: emailInput.toLowerCase().trim() });
  }

  // ── SUCCESS SCREEN ──
  if (submitted) {
    const tweetText = encodeURIComponent(
      "Just applied to become an Ambassador for " + (import.meta.env.VITE_PROTOCOL_NAME ?? "the protocol") + ".\n\nLeaderboard: " + (import.meta.env.VITE_APP_BASE_URL ?? "") + "/leaderboard"
    );
    const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
    return (
      <>
        <SiteHeader />
        <ApplyStyles />
        <section style={{ padding: "72px 0 100px" }}>
          <div className="apply-container">
            <div className="step-eyebrow">· Application submitted</div>
            <h1 className="step-title">
              You&apos;re <em>in the pipeline.</em>
            </h1>
            <p className="step-body">
              Your application is received. While we review it, here is what to do right now.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
              <a className="success-step" href={import.meta.env.VITE_TELEGRAM_URL ?? "#"} target="_blank" rel="noreferrer">
                <span className="ss-num">01</span>
                <span className="ss-label">Join the Telegram</span>
                <span className="ss-arrow">↗</span>
              </a>
              <a className="success-step" href={import.meta.env.VITE_X_URL ?? "#"} target="_blank" rel="noreferrer">
                <span className="ss-num">02</span>
                <span className="ss-label">Follow on X</span>
                <span className="ss-arrow">↗</span>
              </a>
              <a className="success-step" href={tweetUrl} target="_blank" rel="noreferrer">
                <span className="ss-num">03</span>
                <span className="ss-label">Share that you applied</span>
                <span className="ss-arrow">↗</span>
              </a>
              <a className="success-step" href={(import.meta.env.VITE_APP_BASE_URL ?? "") + "/leaderboard"} target="_blank" rel="noreferrer">
                <span className="ss-num">04</span>
                <span className="ss-label">Check the leaderboard</span>
                <span className="ss-arrow">↗</span>
              </a>
              <a className="success-step" href={(import.meta.env.VITE_APP_BASE_URL ?? "") + "/xp"} target="_blank" rel="noreferrer">
                <span className="ss-num">05</span>
                <span className="ss-label">Learn how XP is earned</span>
                <span className="ss-arrow">↗</span>
              </a>
            </div>

            <div className="rules-box">
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--ink-soft)" }}>
                Pass the knowledge test and you&apos;re automatically an L1 Contributor — your profile appears on the leaderboard straight away. XP updates continuously as you post and engage. The team reviews applications and approves Ambassadors (L2).
              </p>
            </div>

            <div style={{ textAlign: "center", marginTop: 32 }}>
              <button className="back" onClick={() => navigate("/")}>← Back to home</button>
            </div>
          </div>
        </section>
        <SiteFooter />
      </>
    );
  }

  // ── SCREEN RENDERER ──
  const renderScreen = () => {
    // ── 0: EMAIL GATE ──
    if (screen === 0) {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput);
      return (
        <>
          <div className="step-eyebrow">· Ambassador Program</div>
          <h1 className="step-title">
            Start your <em>application.</em>
          </h1>
          <p className="step-body">
            Enter your email to begin. If you previously applied to the FX OnChain Evangelists program, we&apos;ll resume your application where you left off.
          </p>
          <label className="field-label">Email</label>
          <input
            className="input"
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              setEmailError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValidEmail && !checkingEmail) handleEmailContinue();
            }}
            placeholder="you@example.com"
            autoFocus
          />
          {emailError && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "#c14b3a", margin: "-8px 0 12px", lineHeight: 1.4 }}>
              {emailError}
            </p>
          )}
          <div className="btn-pair">
            <button
              className={`next ${!isValidEmail || checkingEmail ? "disabled" : ""}`}
              onClick={handleEmailContinue}
              disabled={!isValidEmail || checkingEmail}
            >
              {checkingEmail ? "Checking…" : "Continue →"}
            </button>
          </div>
        </>
      );
    }

    // ── 1: INTRO (new applicant) ──
    if (screen === 1 && flowMode === "new") {
      return (
        <>
          <div className="step-eyebrow">· Knowledge Test</div>
          <h1 className="step-title">
            Before you <em>begin.</em>
          </h1>
          <p className="step-body">
            Before applying, you must demonstrate that you understand what this protocol is building.
          </p>
          <div className="rules-box">
            <div className="rh">Test rules</div>
            {[
              "The test contains 10 questions about the protocol and its use cases.",
              "Passing score: 10 / 10",
              "1 question per page. Required answer. Cannot skip.",
              "Most applicants fail the first time.",
            ].map((r, i) => (
              <div className="rule" key={i}>
                <span className="dot" />
                {r}
              </div>
            ))}
          </div>
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button className="next" onClick={goNext}>Start the test →</button>
          </div>
        </>
      );
    }

    // ── 1: EVANGELIST / RESUME WELCOME ──
    if (screen === 1 && (flowMode === "evangelist" || flowMode === "resume")) {
      const isEvangelist = flowMode === "evangelist";
      return (
        <>
          <div className="step-eyebrow">· {isEvangelist ? "FX OnChain Evangelists" : "Application resume"}</div>
          <h1 className="step-title">
            {isEvangelist ? (
              <>
                We found your previous <em>Evangelist</em> application.
              </>
            ) : (
              <>
                Welcome <em>back.</em>
              </>
            )}
          </h1>
          <p className="step-body">
            {isEvangelist
              ? "You don't need to redo the earlier steps. Continue your Ambassador application below."
              : "Your previous progress has been saved. Continue from where you left off."}
          </p>
          <div className="btn-pair">
            <button className="next" onClick={goNext}>Continue application →</button>
          </div>
        </>
      );
    }

    // ── 2–11: KNOWLEDGE TEST QUESTIONS ──
    if (screen >= 2 && screen <= 11) {
      const qIdx = screen - 2;
      const q = QUESTIONS[qIdx];
      const selected = form.answers[qIdx];
      return (
        <>
          <div className="step-eyebrow">· Knowledge test · Question {qIdx + 1} of 10</div>
          <h1 className="step-title">{q.q}</h1>
          {q.options.map((opt, i) => (
            <button
              key={i}
              className={`opt ${selected === opt ? "selected" : ""}`}
              onClick={() => {
                const newAnswers = [...form.answers];
                newAnswers[qIdx] = opt;
                update({ answers: newAnswers });
              }}
            >
              <span className="letter">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          ))}
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!selected ? "disabled" : ""}`}
              onClick={() => {
                if (!selected) return showToast("Pick an answer");
                goNext();
              }}
            >
              {qIdx === 9 ? "Submit test →" : "Next question →"}
            </button>
          </div>
        </>
      );
    }

    // ── 12: TEST RESULT ──
    if (screen === 12) {
      if (calculating || testScore === null) {
        return (
          <>
            <div className="step-eyebrow">· Knowledge test</div>
            <h1 className="step-title">
              Calculating your <em>score.</em>
            </h1>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "40px 0" }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    background: "var(--green)",
                    borderRadius: "50%",
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
            <style>{`@keyframes pulse { 0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }`}</style>
          </>
        );
      }
      const score = testScore ?? 0;
      const passed = score === 10;
      return (
        <>
          <div className="step-eyebrow">· Knowledge test result</div>
          <h1 className="step-title">
            {passed ? (
              <>You <em>passed.</em></>
            ) : (
              <>You did <em>not pass.</em></>
            )}
          </h1>
          <div className="score-display">
            <div className={`score-num ${passed ? "pass" : "fail"}`}>
              {score}
              <span>/10</span>
            </div>
          </div>
          {passed ? (
            <>
              <p className="step-body" style={{ textAlign: "center" }}>
                Continue to the Ambassador Application.
              </p>
              <div
                className="rules-box"
                style={{ background: "rgba(0,200,134,0.06)", borderColor: "rgba(0,200,134,0.3)" }}
              >
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--ink-soft)" }}>
                  Passing the test does not grant ambassador status. It means you are eligible to contribute to the program.
                </p>
              </div>
              <div className="btn-pair">
                <button className="next" onClick={goNext}>Continue →</button>
              </div>
            </>
          ) : (
            <>
              <p className="step-body" style={{ textAlign: "center" }}>
                Review the material at{" "}
                <a href={import.meta.env.VITE_PROTOCOL_URL ?? "#"} target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>
                  the protocol
                </a>{" "}
                and try again.
              </p>
              <div className="btn-pair">
                <button
                  className="next"
                  onClick={() => {
                    update({ answers: Array(10).fill(null) });
                    setTestScore(null);
                    setScreen(2);
                  }}
                >
                  Retry test ↺
                </button>
              </div>
            </>
          )}
        </>
      );
    }

    // ── 22: MOTIVATION ──
    if (screen === 22) {
      const isEvangelist = flowMode === "evangelist";
      const minLen = 40;
      const charCount = form.communityBenefit.length;
      const meetsMin = charCount >= minLen;
      return (
        <>
          <div className="step-eyebrow">· {isEvangelist ? "Ambassador application" : "Application · Why"}</div>
          <h1 className="step-title">
            Why do you want to be an <em>Ambassador?</em>
          </h1>
          <p className="step-body">
            {isEvangelist
              ? "Your previous response has been pre-filled. Review and update it if needed."
              : "Tell us what draws you to this program and what you want to contribute. Be genuine. What specifically about the protocol's approach resonates with you? What do you bring to the table?"}
          </p>
          <textarea
            className="textarea"
            value={form.communityBenefit}
            onChange={(e) => update({ communityBenefit: e.target.value })}
            placeholder="I want to be an Ambassador because…"
            rows={8}
            autoFocus
          />
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: meetsMin ? "var(--green)" : "var(--ink-mute)",
              letterSpacing: "0.1em",
              marginTop: 8,
            }}
          >
            {charCount} / {minLen} min characters
          </div>
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!meetsMin ? "disabled" : ""}`}
              onClick={() => {
                if (!meetsMin) return showToast("Tell us a bit more — minimum 40 characters");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 13: TRACK SELECTION ──
    if (screen === 13) {
      return (
        <>
          <div className="step-eyebrow">· Step 1 of 7</div>
          <h1 className="step-title">
            Which track are you <em>applying for?</em>
          </h1>
          <p className="step-body" style={{ marginBottom: 18 }}>
            Multiple selection allowed.
          </p>
          {TRACK_OPTIONS.map((t) => (
            <button
              key={t.id}
              className={`opt ${form.tracks.includes(t.id) ? "selected" : ""}`}
              onClick={() => {
                const next = form.tracks.includes(t.id)
                  ? form.tracks.filter((x) => x !== t.id)
                  : [...form.tracks, t.id];
                update({ tracks: next });
              }}
            >
              <span className="letter">{form.tracks.includes(t.id) ? "✓" : "○"}</span>
              {t.label}
            </button>
          ))}
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${form.tracks.length === 0 ? "disabled" : ""}`}
              onClick={() => {
                if (form.tracks.length === 0) return showToast("Pick at least one track");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 14: CONTRIBUTION INTENT ──
    if (screen === 14) {
      return (
        <>
          <div className="step-eyebrow">· Step 2 of 7</div>
          <h1 className="step-title">
            How would you <em>contribute?</em>
          </h1>
          <p className="step-body" style={{ marginBottom: 18 }}>
            Multiple selection allowed.
          </p>
          {CONTRIBUTION_OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`opt ${form.contributionIntent.includes(opt) ? "selected" : ""}`}
              onClick={() => {
                const next = form.contributionIntent.includes(opt)
                  ? form.contributionIntent.filter((x) => x !== opt)
                  : [...form.contributionIntent, opt];
                update({ contributionIntent: next });
              }}
            >
              <span className="letter">{form.contributionIntent.includes(opt) ? "✓" : "○"}</span>
              {opt}
            </button>
          ))}
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${form.contributionIntent.length === 0 ? "disabled" : ""}`}
              onClick={() => {
                if (form.contributionIntent.length === 0) return showToast("Pick at least one");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 15: COMMUNITIES / NETWORKS ──
    if (screen === 15) {
      const entries = form.communityEntries;
      const allFilled =
        entries.length > 0 &&
        entries.every((e) => e.nameLink.trim().length > 0 && e.shortDescription.trim().length > 0);
      return (
        <>
          <div className="step-eyebrow">· Step 3 of 7</div>
          <h1 className="step-title">
            What communities are <em>you part of?</em>
          </h1>
          <p className="step-body">
            List the communities, groups, or networks you are embedded in. Add as many as relevant. For each, give us the name or link, and a short description (what it is, roughly how many people).
          </p>
          {entries.map((entry, i) => (
            <div className="community-card" key={i}>
              <div className="num">Community {i + 1}</div>
              {entries.length > 1 && (
                <button
                  className="rm"
                  onClick={() => update({ communityEntries: entries.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              )}
              <label className="field-label">Name or link</label>
              <input
                className="input"
                value={entry.nameLink}
                onChange={(e) => {
                  const next = [...entries];
                  next[i] = { ...next[i], nameLink: e.target.value };
                  update({ communityEntries: next });
                }}
                placeholder="e.g. Crypto Philippines Telegram or t.me/cryptoph"
              />
              <label className="field-label">Short description</label>
              <input
                className="input"
                style={{ marginBottom: 0 }}
                value={entry.shortDescription}
                onChange={(e) => {
                  const next = [...entries];
                  next[i] = { ...next[i], shortDescription: e.target.value };
                  update({ communityEntries: next });
                }}
                placeholder="e.g. 4,000-member Filipino crypto community focused on DeFi"
              />
            </div>
          ))}
          <button
            className="add-btn"
            onClick={() => update({ communityEntries: [...entries, { nameLink: "", shortDescription: "" }] })}
          >
            + Add another community
          </button>
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!allFilled ? "disabled" : ""}`}
              onClick={() => {
                if (!allFilled) return showToast("Fill in your community entries");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 16: SOCIAL PROFILES ──
    if (screen === 16) {
      const hasSocial = !!form.twitterHandle || !!form.telegramHandle;
      return (
        <>
          <div className="step-eyebrow">· Step 4 of 7</div>
          <h1 className="step-title">
            Where can we find you <em>online?</em>
          </h1>
          <label className="field-label">X / Twitter</label>
          <input
            className="input"
            value={form.twitterHandle}
            onChange={(e) => update({ twitterHandle: e.target.value })}
            placeholder="@username"
          />
          <label className="field-label">Telegram</label>
          <input
            className="input"
            value={form.telegramHandle}
            onChange={(e) => update({ telegramHandle: e.target.value })}
            placeholder="@username"
          />
          <label className="field-label">GitHub (optional)</label>
          <input
            className="input"
            value={form.githubHandle}
            onChange={(e) => update({ githubHandle: e.target.value })}
            placeholder="@username"
          />
          <label className="field-label">Other links (optional)</label>
          <input
            className="input"
            value={form.otherLinks}
            onChange={(e) => update({ otherLinks: e.target.value })}
            placeholder="LinkedIn, personal site, etc."
          />
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!hasSocial ? "disabled" : ""}`}
              onClick={() => {
                if (!hasSocial) return showToast("Give us X or Telegram (at least one)");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 17: COMMUNITY EXPERIENCE ──
    if (screen === 17) {
      const yes = form.hasCommunityExperience === "yes";
      return (
        <>
          <div className="step-eyebrow">· Step 5 of 7</div>
          <h1 className="step-title">
            Have you built or <em>managed a community before?</em>
          </h1>
          <p className="step-body">
            If yes, share links to the communities you&apos;ve run or helped manage. Telegram, Discord, Twitter community, forum — anything.
          </p>
          <button
            className={`opt ${yes ? "selected" : ""}`}
            onClick={() => update({ hasCommunityExperience: "yes" })}
          >
            <span className="letter">{yes ? "✓" : "○"}</span>Yes
          </button>
          <button
            className={`opt ${form.hasCommunityExperience === "no" ? "selected" : ""}`}
            onClick={() => update({ hasCommunityExperience: "no", communityLinks: [] })}
          >
            <span className="letter">{form.hasCommunityExperience === "no" ? "✓" : "○"}</span>No
          </button>
          {yes && (
            <div
              style={{
                marginTop: 20,
                padding: 22,
                background: "var(--paper-2)",
                border: "1px solid var(--line)",
                borderRadius: 10,
              }}
            >
              <div className="field-label" style={{ marginBottom: 4 }}>
                Your community links
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 14px", lineHeight: 1.55 }}>
                Paste any link — t.me/group, discord.gg/xyz, twitter.com/community.
              </p>
              {form.communityLinks.map((link, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 12,
                    padding: 14,
                    background: "var(--paper)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                  }}
                >
                  <label className="field-label">Link URL</label>
                  <input
                    className="input"
                    value={link.url}
                    onChange={(e) => {
                      const next = [...form.communityLinks];
                      next[i] = { ...next[i], url: e.target.value };
                      update({ communityLinks: next });
                    }}
                    onBlur={(e) => {
                      // Auto-prepend https:// if user forgot the protocol
                      const val = e.target.value.trim();
                      if (val && !/^https?:\/\//i.test(val)) {
                        const next = [...form.communityLinks];
                        next[i] = { ...next[i], url: `https://${val}` };
                        update({ communityLinks: next });
                      }
                    }}
                    placeholder="t.me/yourgroup, discord.gg/abc, …"
                  />
                  <label className="field-label">Description</label>
                  <input
                    className="input"
                    style={{ marginBottom: 0 }}
                    value={link.description}
                    onChange={(e) => {
                      const next = [...form.communityLinks];
                      next[i] = { ...next[i], description: e.target.value };
                      update({ communityLinks: next });
                    }}
                    placeholder="e.g. Telegram group, 2K members, crypto trading focus"
                  />
                  <button
                    onClick={() => update({ communityLinks: form.communityLinks.filter((_, j) => j !== i) })}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#c14b3a",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      marginTop: 8,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="add-btn"
                style={{ marginBottom: 0 }}
                onClick={() => update({ communityLinks: [...form.communityLinks, { url: "", description: "" }] })}
              >
                + Add link
              </button>
            </div>
          )}
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!form.hasCommunityExperience ? "disabled" : ""}`}
              onClick={() => {
                if (!form.hasCommunityExperience) return showToast("Yes or no?");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 18: DESCRIBE PROTOCOL ──
    if (screen === 18) {
      const minLen = 15;
      const meetsMin = form.protocolDescription.length >= minLen;
      return (
        <>
          <div className="step-eyebrow">· Step 6 of 7</div>
          <h1 className="step-title">
            Describe the protocol <em>in your own words.</em>
          </h1>
          <p className="step-body">
            Imagine you&apos;re explaining the protocol to a friend who hasn&apos;t heard of it. What is it? What problem does it solve? Write it in your own words — not a copy-paste.
          </p>
          <textarea
            className="textarea"
            value={form.protocolDescription}
            onChange={(e) => update({ protocolDescription: e.target.value })}
            placeholder="The protocol is…"
            rows={5}
            autoFocus
          />
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: meetsMin ? "var(--green)" : "var(--ink-mute)",
              letterSpacing: "0.1em",
              marginTop: 8,
            }}
          >
            {form.protocolDescription.length} / {minLen} min characters
          </div>
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!meetsMin ? "disabled" : ""}`}
              onClick={() => {
                if (!meetsMin) return showToast("Tell us in your own words — minimum 15 characters");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 19: BENEFIT (skip — collected at screen 22) ──
    if (screen === 19) {
      // Auto-advance — communityBenefit was collected at screen 22 motivation
      setScreen(20);
      return null;
    }

    // ── 20: FIRST 30 DAYS ──
    if (screen === 20) {
      const minLen = 50;
      const meetsMin = form.firstThirtyDays.trim().length >= minLen;
      return (
        <>
          <div className="step-eyebrow">· Step 7 of 7</div>
          <h1 className="step-title">
            Your <em>first 30 days.</em>
          </h1>
          <p className="step-body">
            If you&apos;re approved tomorrow, what do you actually do in the first 30 days? Concrete actions — posts, events, integrations, conversations. Be specific. Vague answers like &quot;spread awareness&quot; won&apos;t stand out.
          </p>
          <textarea
            className="textarea"
            value={form.firstThirtyDays}
            onChange={(e) => update({ firstThirtyDays: e.target.value })}
            placeholder="In my first 30 days I would…"
            rows={8}
            autoFocus
          />
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: meetsMin ? "var(--green)" : "var(--ink-mute)",
              letterSpacing: "0.1em",
              marginTop: 8,
            }}
          >
            {form.firstThirtyDays.trim().length} / {minLen} min characters
          </div>
          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!meetsMin ? "disabled" : ""}`}
              onClick={() => {
                if (!meetsMin) return showToast("Minimum 50 characters");
                goNext();
              }}
            >
              Continue →
            </button>
          </div>
        </>
      );
    }

    // ── 21: CONFIRMATION ──
    if (screen === 21) {
      const score = testScore ?? 0;
      return (
        <>
          <div className="step-eyebrow">· Final step</div>
          <h1 className="step-title">
            Review and <em>submit.</em>
          </h1>
          <p className="step-body">
            You&apos;re done. Quick review below, then submit.
          </p>
          <div className="rules-box">
            <div className="rh">Your application</div>
            <ReviewRow label="Email" value={form.email} />
            <ReviewRow
              label="Knowledge test"
              value={flowMode === "evangelist" ? "Exempt (Evangelist)" : `${score} / 10`}
            />
            <ReviewRow label="Tracks" value={form.tracks.length ? form.tracks.join(", ") : "—"} />
            <ReviewRow
              label="Contribution intent"
              value={`${form.contributionIntent.length} items`}
            />
            <ReviewRow label="Communities" value={`${form.communityEntries.length} listed`} />
            <ReviewRow
              label="X / Telegram"
              value={form.twitterHandle || form.telegramHandle || "—"}
            />
            <ReviewRow
              label="Community experience"
              value={form.hasCommunityExperience || "—"}
            />
            <ReviewRow label="Describe the Protocol" value={`${form.protocolDescription.length} chars`} />
            <ReviewRow label="Why Ambassador" value={`${form.communityBenefit.length} chars`} />
            <ReviewRow label="First 30 days" value={`${form.firstThirtyDays.length} chars`} />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
              marginTop: 18,
            }}
          >
            <span
              onClick={() => update({ confirmed: !form.confirmed })}
              style={{
                width: 18,
                height: 18,
                border: `1.5px solid ${form.confirmed ? "var(--green)" : "var(--ink-mute)"}`,
                background: form.confirmed ? "var(--green)" : "transparent",
                flexShrink: 0,
                marginTop: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                borderRadius: 4,
              }}
            >
              {form.confirmed && (
                <span style={{ fontSize: 12, color: "var(--paper)", fontWeight: 700, lineHeight: 1 }}>✓</span>
              )}
            </span>
            <span style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
              By submitting, you confirm everything above is true, you understand what this protocol is building, and you commit to honest contribution.
            </span>
          </label>

          <div className="btn-pair">
            <button className="back" onClick={goBack}>← Back</button>
            <button
              className={`next ${!form.confirmed || submitMutation.isPending ? "disabled" : ""}`}
              onClick={handleSubmit}
              disabled={!form.confirmed || submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit application →"}
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <>
      <SiteHeader />
      <ApplyStyles />

      {/* Sticky progress bar under header */}
      <div className="progress-bar">
        <div style={{ width: `${progressPct}%` }} />
      </div>

      <section style={{ padding: "0" }}>
        <div className="apply-container">{renderScreen()}</div>
      </section>

      {localToast && <div className="toast">⚠ {localToast}</div>}

      <SiteFooter />
    </>
  );
}

// ── REVIEW ROW (for confirmation screen) ─────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-row">
      <div className="review-row-label mono">{label}</div>
      <div className="review-row-value">{value || "—"}</div>
    </div>
  );
}

// ── PAGE-LOCAL STYLES ────────────────────────────────────────────────────────
// Mirrors the <style> block in Apply.html exactly. Kept in this file so the
// Apply page is self-contained — index.css doesn't need to learn about
// .opt/.input/.community-card/etc.

function ApplyStyles() {
  return (
    <style>{`
      .progress-bar {
        position: sticky; top: calc(env(safe-area-inset-top, 0px) + 64px);
        z-index: 40;
        height: 3px; background: var(--line);
      }
      @media (max-width: 767px) {
        .progress-bar { top: calc(env(safe-area-inset-top, 0px) + 56px); }
      }
      .progress-bar > div {
        height: 100%; background: var(--green);
        transition: width .35s ease;
      }
      .apply-container {
        max-width: 680px; margin: 0 auto; padding: 56px 24px 100px;
      }
      @media (max-width: 767px) {
        .apply-container { padding: 32px 18px 64px; }
      }
      @media (max-width: 480px) {
        .apply-container { padding: 24px 14px 56px; }
      }
      /* Review screen rows — stacked on phone, two-column on wider screens */
      .review-row {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 14px;
        padding: 12px 0;
        border-bottom: 1px solid var(--line);
        font-size: 14px;
      }
      .review-row-label {
        color: var(--ink-mute);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-size: 11px;
      }
      .review-row-value { color: var(--ink); word-break: break-word; }
      @media (max-width: 640px) {
        .review-row { grid-template-columns: 1fr; gap: 4px; }
      }
      .opt {
        display: block; width: 100%; text-align: left;
        padding: 16px 20px;
        border: 1.5px solid var(--line);
        background: var(--paper);
        color: var(--ink);
        font-family: 'Inter', sans-serif; font-size: 15px;
        cursor: pointer; margin-bottom: 10px;
        border-radius: 8px;
        transition: border-color .12s, background .12s, transform .12s;
        line-height: 1.5;
      }
      .opt:hover { border-color: var(--ink-soft); }
      .opt.selected {
        border-color: var(--ink); background: var(--paper);
        box-shadow: 3px 3px 0 var(--green-brand);
      }
      .opt.correct { border-color: var(--green); background: rgba(0,200,134,0.08); }
      .opt.wrong   { border-color: #c14b3a; background: rgba(193,75,58,0.06); }
      .opt .letter {
        font-family: 'JetBrains Mono', monospace; font-weight: 700;
        color: var(--ink-mute); margin-right: 12px;
      }
      .opt.selected .letter { color: var(--ink); }
      .input {
        width: 100%; padding: 14px 16px;
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 8px;
        font-family: 'Inter', sans-serif; font-size: 16px;
        color: var(--ink); margin-bottom: 14px;
        transition: border-color .12s;
        box-sizing: border-box;
      }
      .input:focus { outline: none; border-color: var(--ink); }
      .textarea {
        width: 100%; padding: 16px;
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 8px;
        font-family: 'Inter', sans-serif; font-size: 16px;
        color: var(--ink); resize: vertical; min-height: 140px;
        line-height: 1.55;
        box-sizing: border-box;
      }
      .textarea:focus { outline: none; border-color: var(--ink); }
      .field-label {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        color: var(--ink-mute); letter-spacing: 0.1em; text-transform: uppercase;
        font-weight: 700; margin-bottom: 8px; display: block;
      }
      .btn-pair { display: flex; gap: 12px; margin-top: 28px; }
      .btn-pair .back {
        background: transparent; color: var(--ink-soft);
        border: 1px solid var(--line); border-radius: 999px;
        padding: 14px 22px; font-size: 15px; cursor: pointer;
        min-height: 48px;
      }
      .btn-pair .next {
        flex: 1; background: var(--ink); color: var(--paper);
        border: none; border-radius: 999px;
        padding: 14px 22px; font-size: 15px; font-weight: 600;
        cursor: pointer; transition: background .12s, opacity .12s;
        min-height: 48px;
      }
      .btn-pair .next.disabled { opacity: 0.4; cursor: not-allowed; }
      /* On phones the back button becomes an icon-style square so Next
       * gets full thumb-friendly width. */
      @media (max-width: 480px) {
        .btn-pair { gap: 10px; }
        .btn-pair .back { padding: 14px 18px; flex-shrink: 0; }
      }
      .step-eyebrow {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        color: var(--green); letter-spacing: 0.15em; text-transform: uppercase;
        font-weight: 700; margin-bottom: 18px;
      }
      .step-title {
        font-family: 'Fraunces', serif; font-size: clamp(28px, 4.5vw, 44px);
        line-height: 1.1; letter-spacing: -0.02em; font-weight: 400;
        margin: 0 0 16px;
      }
      .step-title em { font-weight: 500; font-style: italic; }
      .step-body {
        font-size: 17px; line-height: 1.65; color: var(--ink-soft);
        margin: 0 0 28px;
      }
      .rules-box {
        background: var(--paper-2); border: 1px solid var(--line);
        border-radius: 10px; padding: 24px 28px; margin-bottom: 24px;
      }
      .rules-box .rh {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        color: var(--green); letter-spacing: 0.12em; text-transform: uppercase;
        font-weight: 700; margin-bottom: 12px;
      }
      .rules-box .rule {
        display: flex; align-items: flex-start; gap: 10px;
        margin-bottom: 8px; font-size: 15px; line-height: 1.55; color: var(--ink-soft);
      }
      .rules-box .rule .dot {
        width: 5px; height: 5px; background: var(--green);
        border-radius: 50%; margin-top: 8px; flex-shrink: 0;
      }
      .score-display {
        text-align: center; padding: 40px 0;
      }
      .score-num {
        font-family: 'Fraunces', serif;
        font-size: clamp(80px, 18vw, 160px);
        line-height: 0.95; font-weight: 500;
        letter-spacing: -0.04em;
      }
      .score-num.pass { color: var(--green); }
      .score-num.fail { color: #c14b3a; }
      .score-num span { font-size: 0.4em; color: var(--ink-mute); }
      .toast {
        position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
        background: var(--ink); color: var(--paper);
        padding: 12px 22px; border-radius: 999px;
        font-size: 14px; box-shadow: 0 16px 30px -10px rgba(0,0,0,0.3);
        z-index: 200; animation: popin .35s ease;
      }
      @keyframes popin {
        from { transform: translate(-50%, 16px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
      .community-card {
        background: var(--paper-2); border: 1px solid var(--line);
        border-radius: 10px; padding: 18px; margin-bottom: 12px; position: relative;
      }
      .community-card .num {
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
        color: var(--ink-mute); letter-spacing: 0.1em; text-transform: uppercase;
        font-weight: 700; margin-bottom: 10px;
      }
      .community-card .rm {
        position: absolute; top: 14px; right: 14px;
        background: transparent; border: none;
        color: #c14b3a; cursor: pointer; font-size: 12px;
        font-family: 'JetBrains Mono', monospace; letter-spacing: 0.06em; text-transform: uppercase;
      }
      .add-btn {
        width: 100%; padding: 12px;
        background: transparent;
        border: 1px dashed var(--ink-mute);
        border-radius: 8px;
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        color: var(--ink-soft); cursor: pointer;
        letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600;
        margin-bottom: 18px;
      }
      .add-btn:hover { border-color: var(--ink); color: var(--ink); }

      /* Success / submitted screen */
      .success-step {
        display: flex; align-items: center; gap: 16px;
        padding: 18px 22px;
        background: var(--paper-2); border: 1px solid var(--line);
        border-radius: 10px; text-decoration: none;
        transition: border-color .12s, transform .12s;
      }
      .success-step:hover { border-color: var(--ink); transform: translateX(2px); }
      .success-step .ss-num {
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
        color: var(--green); letter-spacing: 0.12em; font-weight: 700;
      }
      .success-step .ss-label {
        flex: 1; font-family: 'Inter', sans-serif; font-size: 15px;
        color: var(--ink); font-weight: 500;
      }
      .success-step .ss-arrow {
        font-family: 'JetBrains Mono', monospace; color: var(--ink-mute); font-size: 16px;
      }
    `}</style>
  );
}
