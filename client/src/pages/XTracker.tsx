import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  ExternalLink,
  Twitter,
  Repeat2,
  MessageCircle,
  Bookmark,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
} from "lucide-react";

type Summary = {
  applicationId: number;
  twitterHandle: string;
  postCount: number;
  replyCount: number;
  quoteCount: number;
  retweetCount: number;
  totalRetweets: number;
  totalReplies: number;
  totalBookmarks: number;
  lastScraped: Date | null;
  lastTweetAt: Date | null;
};

type Tweet = {
  id: number;
  applicationId: number;
  tweetId: string;
  tweetType: "post" | "reply" | "quote" | "retweet";
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  quotedFrom: string | null;
  tweetUrl: string | null;
  postedAt: Date;
  scrapedAt: Date;
};

type ScrapeJob = {
  id: number;
  status: "pending" | "running" | "completed" | "failed" | "partial";
  totalAmbassadors: number;
  completedRuns: number;
  failedRuns: number;
  tweetsImported: number | null;
  triggeredBy: string;
  startedAt: Date;
  completedAt: Date | null;
};

const TYPE_LABELS: Record<string, string> = {
  post: "Post",
  reply: "Comment",
  quote: "Quote",
  retweet: "Repost",
};

function tweetTypeBadge(type: string) {
  const map: Record<string, string> = {
    post: "bg-green-900/40 text-green-400 border-green-700",
    reply: "bg-blue-900/40 text-blue-400 border-blue-700",
    quote: "bg-purple-900/40 text-purple-400 border-purple-700",
    retweet: "bg-yellow-900/40 text-yellow-400 border-yellow-700",
  };
  return map[type] || "bg-gray-800 text-gray-400";
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    prev.current = end;
    if (start === end) return;
    const duration = 600;
    const startTime = performance.now();
    const raf = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
      <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
      <TableCell className="text-center"><Skeleton className="h-4 w-10 mx-auto" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-7 w-16" /></TableCell>
    </TableRow>
  );
}

function JobStatusBanner({ job }: { job: ScrapeJob }) {
  const pct = job.totalAmbassadors > 0
    ? Math.round(((job.completedRuns + job.failedRuns) / job.totalAmbassadors) * 100)
    : 0;

  const isRunning = job.status === "running" || job.status === "pending";
  const jobAge = Date.now() - new Date(job.startedAt).getTime();
  const isStale = jobAge > 48 * 60 * 60 * 1000; // older than 48 hours

  // Never show failed/partial banners — they are noise from broken runs
  if (!isRunning && (job.status === "failed" || job.status === "partial")) {
    return null;
  }

  return (
    <div className={`border rounded-sm p-4 ${
      isRunning
        ? "border-emerald-700 bg-emerald-950/30"
        : job.status === "completed"
        ? "border-border bg-muted/20"
        : "border-red-700 bg-red-950/20"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />
          ) : job.status === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <span className="text-sm font-mono font-semibold">
            {isRunning ? "Scrape in progress" : job.status === "completed" ? "Last scrape complete" : "Scrape failed"}
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {job.triggeredBy === "scheduled" ? "· auto" : "· manual"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(job.startedAt)}
          </span>
          {job.status === "completed" && job.tweetsImported != null && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Zap className="h-3 w-3" />
              {job.tweetsImported} tweets imported
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              job.status === "completed" ? "bg-emerald-500" : isRunning ? "bg-emerald-400" : "bg-red-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {job.completedRuns}/{job.totalAmbassadors}
          {job.failedRuns > 0 && (
            <span className="text-red-400 ml-1">({job.failedRuns} failed)</span>
          )}
        </span>
      </div>
    </div>
  );
}

function NoScrapeTodayBanner({ lastJobDate }: { lastJobDate: Date | null }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const lastStr = lastJobDate
    ? new Date(lastJobDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : null;
  return (
    <div className="border border-yellow-700/50 bg-yellow-950/20 rounded-sm p-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-yellow-400" />
        <span className="text-sm font-mono font-semibold text-yellow-300">
          {todayStr} scrape not done yet
        </span>
        {lastStr && (
          <span className="text-xs font-mono text-muted-foreground">
            · last run {lastStr}
          </span>
        )}
      </div>
      <p className="text-xs font-mono text-muted-foreground mt-1">
        Daily scrape runs at 06:00 SGT. Click <span className="text-foreground">Scrape All</span> to run manually.
      </p>
    </div>
  );
}

export default function XTracker() {
  const [selectedAmbassador, setSelectedAmbassador] = useState<Summary | null>(null);
  const [scrapingId, setScrapingId] = useState<number | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const summaryQuery = trpc.xTracker.getSummary.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const activityQuery = trpc.xTracker.getActivity.useQuery(
    { applicationId: selectedAmbassador?.applicationId ?? 0 },
    { enabled: !!selectedAmbassador }
  );

  // DB-backed: check if there's already a running job (survives page refresh)
  const currentJobQuery = trpc.xTracker.getCurrentApifyScrapeJob.useQuery(undefined, {
    refetchInterval: 8_000,
  });

  // Last completed job for the status banner
  const lastJobQuery = trpc.xTracker.getLastApifyScrapeJob.useQuery();

  // Poll specific job we just started
  const activeJobStatusQuery = trpc.xTracker.getApifyScrapeJobStatus.useQuery(
    { jobId: activeJobId ?? 0 },
    {
      enabled: !!activeJobId,
      refetchInterval: activeJobId ? 5_000 : false,
    }
  );

  // Show the most relevant job: active > currently running in DB > last completed
  const rawJob = activeJobStatusQuery.data ?? currentJobQuery.data ?? lastJobQuery.data;
  const displayJob = rawJob
    ? (rawJob as unknown as ScrapeJob)
    : null;

  const scrapingAll =
    displayJob?.status === "running" || displayJob?.status === "pending";

  useEffect(() => {
    if (!displayJob) return;
    if (displayJob.status === "completed" && activeJobId) {
      toast.success(
        `Scrape complete — ${displayJob.completedRuns}/${displayJob.totalAmbassadors} ambassadors, ${displayJob.tweetsImported ?? 0} new tweets imported`
      );
      setActiveJobId(null);
      summaryQuery.refetch();
      lastJobQuery.refetch();
      currentJobQuery.refetch();
    } else if (displayJob.status === "failed" && activeJobId) {
      toast.error("Scrape job failed");
      setActiveJobId(null);
    }
  }, [displayJob?.status, activeJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrapeOneMutation = trpc.xTracker.scrapeOne.useMutation({
    onSuccess: (data) => {
      toast.success(`Scraped ${data.tweetCount} tweets`);
      summaryQuery.refetch();
      setScrapingId(null);
    },
    onError: (err) => {
      toast.error(`Scrape failed: ${err.message}`);
      setScrapingId(null);
    },
  });

  const [backfilling, setBackfilling] = useState(false);
  const backfillMutation = trpc.xTracker.backfillAvatarUrls.useMutation({
    onSuccess: (data) => {
      toast.success(`Avatar backfill complete — updated: ${data.updated}, skipped: ${data.skipped}, failed: ${data.failed}`);
      setBackfilling(false);
    },
    onError: (err) => {
      toast.error(`Backfill failed: ${err.message}`);
      setBackfilling(false);
    },
  });

  // Scrape official account engagement (official handle replies/quotes/reposts by ambassadors)
  const scrapeOfficialEngagementMutation = trpc.xTracker.scrapeOfficialEngagement.useMutation({
    onSuccess: () => {
      toast.info('P2 scrape started in background — official account posts will be imported shortly.');
    },
    onError: (err) => {
      toast.error(`Failed to start official engagement scrape: ${err.message}`);
    },
  });

  // Pipeline 3: scrape conversation threads for ambassador protocol posts
  const scrapeConversationMutation = trpc.xTracker.scrapeConversationThreads.useMutation({
    onSuccess: () => {
      toast.info('P3 scrape started in background — conversation threads will be imported over the next few minutes.');
    },
    onError: (err) => {
      toast.error(`Failed to start conversation scrape: ${err.message}`);
    },
  });

  // Webhook-based scrape all — fires Apify runs with ad-hoc webhooks, returns immediately
  const startApifyScrapeJobMutation = trpc.xTracker.startApifyScrapeJob.useMutation({
    onSuccess: (data) => {
      toast.info(`Scrape started — ${data.total} ambassadors queued. Results will appear as scraping completes.`);
      // Refresh the job status display
      currentJobQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Failed to start scrape: ${err.message}`);
    },
  });

  const handleScrapeOne = (applicationId: number) => {
    setScrapingId(applicationId);
    scrapeOneMutation.mutate({ applicationId });
  };

  // Always use the stable production domain for webhooks.
  // window.location.origin changes every sandbox restart (dev preview URL),
  // which causes Apify callbacks to hit a dead address and all runs to fail.
  const getWebhookBase = () => {
    const origin = window.location.origin;
    // If running on the stable custom domain, use it directly
    if (import.meta.env.VITE_APP_DOMAIN && origin.includes(import.meta.env.VITE_APP_DOMAIN)) {
      return origin;
    }
    // Otherwise (dev preview), use the stable production domain
    return import.meta.env.VITE_APP_BASE_URL ?? window.location.origin;
  };

  const handleScrapeAll = useCallback((fromDate?: string) => {
    startApifyScrapeJobMutation.mutate({ webhookBaseUrl: getWebhookBase(), fromDate });
  }, [startApifyScrapeJobMutation]);

  const summaries: Summary[] = summaryQuery.data ?? [];
  const tweets: Tweet[] = (activityQuery.data as Tweet[] | undefined) ?? [];
  const isLoading = summaryQuery.isLoading;

  const sorted = [...summaries].sort(
    (a, b) =>
      b.totalRetweets + b.totalReplies + b.totalBookmarks -
      (a.totalRetweets + a.totalReplies + a.totalBookmarks)
  );

  const totalPosts = summaries.reduce((s, a) => s + a.postCount, 0);
  const totalComments = summaries.reduce((s, a) => s + a.replyCount, 0);
  const trackedCount = summaries.filter((a) => a.lastScraped).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono tracking-tight">X Activity Tracker</h2>
              {isLoading ? (
                <Skeleton className="h-5 w-20 rounded-full" />
              ) : (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                  {summaries.length} handles
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Posts, comments, reposts, and quotes mentioning the protocol. Scraped via Apify — results auto-import via webhook.
            </p>
          </div>
          {/* Primary action */}
          <Button
            onClick={() => {
              handleScrapeAll();
              scrapeOfficialEngagementMutation.mutate({ webhookBaseUrl: getWebhookBase() });
              scrapeConversationMutation.mutate({ webhookBaseUrl: getWebhookBase() });
            }}
            disabled={scrapingAll || startApifyScrapeJobMutation.isPending || scrapeOfficialEngagementMutation.isPending || scrapeConversationMutation.isPending}
            className="font-mono text-xs gap-2 shrink-0"
            title="Run all 3 pipelines: ambassador timeline + official engagement + conversation threads"
          >
            <RefreshCw className={`h-4 w-4 ${scrapingAll || scrapeOfficialEngagementMutation.isPending || scrapeConversationMutation.isPending ? "animate-spin" : ""}`} />
            {scrapingAll
              ? `Scraping... ${displayJob?.completedRuns ?? 0}/${displayJob?.totalAmbassadors ?? "?"}`
              : (scrapeOfficialEngagementMutation.isPending || scrapeConversationMutation.isPending)
              ? "Starting..."
              : "Run All Pipelines"}
          </Button>
        </div>
        {/* Secondary actions row */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setBackfilling(true); backfillMutation.mutate(); }}
            disabled={backfilling}
            className="font-mono text-xs gap-1.5"
            title="Fetch profile photos from X for all ambassadors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? "animate-spin" : ""}`} />
            {backfilling ? "Backfilling..." : "Backfill Avatars"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrapeConversationMutation.mutate({ webhookBaseUrl: getWebhookBase() })}
            disabled={scrapeConversationMutation.isPending}
            className="font-mono text-xs gap-1.5"
            title="Pipeline 3: fetch all replies in ambassador protocol threads"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scrapeConversationMutation.isPending ? "animate-spin" : ""}`} />
            {scrapeConversationMutation.isPending ? "Starting..." : "Scrape Threads"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => scrapeOfficialEngagementMutation.mutate({ webhookBaseUrl: getWebhookBase() })}
            disabled={scrapeOfficialEngagementMutation.isPending}
            className="font-mono text-xs gap-1.5"
            title="Pipeline 2: scrape replies/quotes/reposts on official handles"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scrapeOfficialEngagementMutation.isPending ? "animate-spin" : ""}`} />
            {scrapeOfficialEngagementMutation.isPending ? "Starting..." : "Scrape Official Engagement"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleScrapeAll()}
            disabled={scrapingAll || startApifyScrapeJobMutation.isPending}
            className="font-mono text-xs gap-1.5"
            title="Pipeline 1: incremental scrape since last run"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scrapingAll ? "animate-spin" : ""}`} />
            {scrapingAll ? `Scraping... ${displayJob?.completedRuns ?? 0}/${displayJob?.totalAmbassadors ?? "?"}` : "Scrape All"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleScrapeAll("2025-03-05")}
            disabled={scrapingAll || startApifyScrapeJobMutation.isPending}
            className="font-mono text-xs gap-1.5 text-muted-foreground"
            title="Full clean scrape from Mar 5, 2025"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${startApifyScrapeJobMutation.isPending ? "animate-spin" : ""}`} />
            Full Scrape (Mar 5)
          </Button>
        </div>
      </div>

      {/* Job status banner */}
      {displayJob ? (
        <JobStatusBanner job={displayJob as ScrapeJob} />
      ) : (
        <NoScrapeTodayBanner lastJobDate={null} />
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Posts", value: totalPosts },
          { label: "Total Comments", value: totalComments },
          { label: "Handles Tracked", value: trackedCount },
        ].map((stat) => (
          <div key={stat.label} className="border border-border bg-card p-3 rounded-sm">
            <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {stat.label}
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <div className="text-2xl font-bold font-mono mt-1">
                <AnimatedNumber value={stat.value} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="font-mono text-xs uppercase tracking-wider">Handle</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-center">Post</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-center">Comment</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-center">Quote</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider text-center">Repost</TableHead>

              <TableHead className="font-mono text-xs uppercase tracking-wider">Last Scraped</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider">Last Tweet</TableHead>
              <TableHead className="font-mono text-xs uppercase tracking-wider"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <Twitter className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-mono text-sm text-muted-foreground">No activity data yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Scrape All" to pull X activity for all ambassadors.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row) => (
                <TableRow
                  key={row.applicationId}
                  className="hover:bg-muted/20 cursor-pointer"
                  onClick={() => setSelectedAmbassador(row)}
                >
                  <TableCell className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    @{row.twitterHandle.replace(/^@/, "")}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    <AnimatedNumber value={row.postCount} />
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    <AnimatedNumber value={row.replyCount} />
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    <AnimatedNumber value={row.quoteCount} />
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    <AnimatedNumber value={row.retweetCount} />
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {row.lastScraped ? formatDate(row.lastScraped) : (
                      <span className="text-yellow-500">Not scraped</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {formatDate(row.lastTweetAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs h-7 px-2"
                      disabled={scrapingId === row.applicationId}
                      onClick={() => handleScrapeOne(row.applicationId)}
                    >
                      <RefreshCw
                        className={`h-3 w-3 mr-1 ${scrapingId === row.applicationId ? "animate-spin" : ""}`}
                      />
                      {scrapingId === row.applicationId ? "..." : "Scrape"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Tweet detail dialog */}
      <Dialog open={!!selectedAmbassador} onOpenChange={(o) => !o && setSelectedAmbassador(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">
              @{selectedAmbassador?.twitterHandle?.replace(/^@/, "")} | X Activity
            </DialogTitle>
          </DialogHeader>

          {activityQuery.isLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border rounded-sm p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-16 rounded-sm" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : tweets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tweets scraped yet for this ambassador.
            </div>
          ) : (
            <div className="space-y-3">
              {tweets.map((tweet) => (
                <div
                  key={tweet.id}
                  className="border border-border rounded-sm p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded-sm border ${tweetTypeBadge(tweet.tweetType)}`}
                    >
                      {TYPE_LABELS[tweet.tweetType] ?? tweet.tweetType}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDate(tweet.postedAt)}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed">{tweet.text}</p>

                  {tweet.quotedFrom && (
                    <p className="text-xs text-muted-foreground font-mono">
                      → @{tweet.quotedFrom}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">

                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-3 w-3 text-green-400" /> {tweet.retweets}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3 text-blue-400" /> {tweet.replies}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bookmark className="h-3 w-3 text-yellow-400" /> {tweet.bookmarks}
                    </span>
                    {tweet.tweetUrl && (
                      <a
                        href={tweet.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" /> View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
