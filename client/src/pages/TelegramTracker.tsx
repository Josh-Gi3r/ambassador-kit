import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Users, MessageSquare, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Animated counter that counts up from 0 to target */
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

export default function TelegramTracker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    batchId: string;
    totalMessages: number;
    uniqueSenders: string[];
    unmatchedSenders: string[];
    matchedCount: number;
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: batches, isLoading: batchesLoading } = trpc.telegram.getBatches.useQuery();
  const { data: unmatchedSenders, isLoading: unmatchedLoading } = trpc.telegram.getUnmatchedSenders.useQuery();
  const { data: activitySummary, isLoading: activityIsLoading } = trpc.telegram.getActivitySummary.useQuery();
  const { data: allAmbassadors } = trpc.ambassador.list.useQuery();

  const parseExport = trpc.telegram.parseExport.useMutation({
    onSuccess: (result) => {
      setLastResult(result);
      utils.telegram.getBatches.invalidate();
      utils.telegram.getUnmatchedSenders.invalidate();
      utils.telegram.getActivitySummary.invalidate();
      toast.success(`Parsed ${result.totalMessages} messages. ${result.matchedCount} matched to ambassadors.`);
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  const mapSender = trpc.telegram.mapSender.useMutation({
    onSuccess: () => {
      utils.telegram.getUnmatchedSenders.invalidate();
      utils.telegram.getActivitySummary.invalidate();
      toast.success("Sender mapped successfully.");
    },
    onError: (err) => {
      toast.error(`Mapping failed: ${err.message}`);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".html")) {
      toast.error("Please upload a Telegram HTML export file (.html)");
      return;
    }
    setUploading(true);
    try {
      const text = await file.text();
      await parseExport.mutateAsync({ htmlContent: text, filename: file.name });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            UPLOAD TELEGRAM EXPORT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Export your Telegram group chat from Telegram Desktop (Settings → Export Chat History → HTML format), then upload it here.
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".html"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || parseExport.isPending}
              className="font-mono"
            >
              {uploading || parseExport.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  PARSING...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  UPLOAD HTML FILE
                </>
              )}
            </Button>
          </div>

          {/* Last upload result */}
          {lastResult && (
            <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-1 text-sm font-mono">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Upload complete
              </div>
              <div className="text-muted-foreground">
                {lastResult.totalMessages} messages parsed · {lastResult.matchedCount} matched · {lastResult.unmatchedSenders.length} senders need mapping
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border border-border bg-card">
          <CardContent className="pt-4">
            {batchesLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-mono font-bold text-foreground">
                <AnimatedNumber value={batches?.length ?? 0} />
              </div>
            )}
            <div className="text-xs text-muted-foreground font-mono mt-1">UPLOAD BATCHES</div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardContent className="pt-4">
            {activityIsLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-mono font-bold text-foreground">
                <AnimatedNumber value={activitySummary?.length ?? 0} />
              </div>
            )}
            <div className="text-xs text-muted-foreground font-mono mt-1">MATCHED AMBASSADORS</div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardContent className="pt-4">
            {unmatchedLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-mono font-bold text-yellow-400">
                <AnimatedNumber value={unmatchedSenders?.length ?? 0} />
              </div>
            )}
            <div className="text-xs text-muted-foreground font-mono mt-1">UNMATCHED SENDERS</div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Summary per Ambassador — PRIMARY SECTION */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            TELEGRAM ACTIVITY BY AMBASSADOR
            {!activityIsLoading && activitySummary && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground ml-1">
                {activitySummary.length} handles
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityIsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded border border-border bg-background">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activitySummary || activitySummary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-mono text-sm">
              No matched activity yet. Upload a Telegram export and map senders to see data here.
            </div>
          ) : (
            <div className="space-y-2">
              {activitySummary
                .sort((a, b) => b.messageCount - a.messageCount)
                .map((item) => (
                  <div
                    key={item.applicationId}
                    className="flex items-center justify-between p-3 rounded border border-border bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-foreground">{item.displayName}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        #{item.applicationId}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-mono">
                      <span className="text-muted-foreground">
                        <AnimatedNumber value={item.messageCount} className="text-foreground font-semibold" /> msgs
                      </span>
                      <span className="text-muted-foreground">
                        <AnimatedNumber value={item.replyCount} className="text-primary font-semibold" /> replies
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unmatched Senders — secondary, admin action needed */}
      {unmatchedSenders && unmatchedSenders.length > 0 && (
        <Card className="border border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-mono flex items-center gap-2 text-yellow-400">
              <AlertCircle className="w-4 h-4" />
              UNMATCHED SENDERS — MAP TO AMBASSADORS
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 ml-1">
                {unmatchedSenders.length} pending
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These Telegram display names don't match any ambassador's @handle. Map them once and all their messages will be attributed correctly.
            </p>
            <div className="space-y-2">
              {unmatchedSenders.map((sender) => (
                <div key={sender} className="flex items-center gap-3 p-2 rounded border border-border bg-card">
                  <span className="font-mono text-sm flex-1 text-foreground">{sender}</span>
                  <Select
                    onValueChange={(value) => {
                      mapSender.mutate({
                        displayName: sender,
                        applicationId: parseInt(value),
                      });
                    }}
                  >
                    <SelectTrigger className="w-48 font-mono text-xs">
                      <SelectValue placeholder="Select ambassador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allAmbassadors?.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)} className="font-mono text-xs">
                          {a.twitterHandle || a.displayHandle || `#${a.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Batches History */}
      {batches && batches.length > 0 && (
        <Card className="border border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-mono flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              UPLOAD HISTORY
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between p-3 rounded border border-border bg-background text-sm font-mono"
                >
                  <span className="text-foreground">{batch.filename}</span>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{batch.messageCount} msgs</span>
                    <span className="text-primary">{batch.matchedCount} matched</span>
                    <span>{new Date(batch.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
