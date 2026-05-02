import { useRoute } from "wouter";
import { format, parseISO } from "date-fns";
import { ExternalLink, CheckCircle, Calendar, Layers } from "lucide-react";
import {
  useGetSharedCampaign,
  getGetSharedCampaignQueryKey,
  ContentPiece,
} from "@workspace/api-client-react";
import { ChannelIcon, getChannelName } from "@/components/channel-icon";
import { Skeleton } from "@/components/ui/skeleton";

function PieceCard({ piece }: { piece: ContentPiece }) {
  return (
    <div className="border border-border bg-white p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 border border-border flex items-center justify-center shrink-0 bg-secondary/30">
          <ChannelIcon channel={piece.channel} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-snug">{piece.title}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
            {getChannelName(piece.channel)}
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 text-[9px] font-bold uppercase tracking-widest">
          <CheckCircle className="w-2.5 h-2.5" />
          Approved
        </span>
      </div>

      {piece.bodyText && (
        <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-3 line-clamp-4">
          {piece.bodyText}
        </p>
      )}

      {piece.mediaUrl && (
        <div className="border border-border overflow-hidden bg-secondary/20 aspect-video flex items-center justify-center">
          {piece.mediaType === "video" ? (
            <video src={piece.mediaUrl} controls className="w-full h-full object-contain" />
          ) : (
            <img src={piece.mediaUrl} alt={piece.title} className="w-full h-full object-cover" />
          )}
        </div>
      )}

      {piece.scheduledDate && (
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-t border-border/40 pt-3">
          <Calendar className="w-3 h-3" />
          Scheduled for {format(parseISO(piece.scheduledDate), "MMMM d, yyyy")}
        </div>
      )}
    </div>
  );
}

export default function SharedCampaign() {
  const [, params] = useRoute("/shared/campaign/:token");
  const token = params?.token ?? "";

  const { data, isLoading, isError } = useGetSharedCampaign(token, {
    query: { enabled: !!token, queryKey: getGetSharedCampaignQueryKey(token) },
  });

  const campaign = data?.campaign;
  const pieces = data?.pieces ?? [];

  const channelGroups = pieces.reduce<Record<string, ContentPiece[]>>((acc, p) => {
    const key = p.channel;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-white font-sans text-black">
      {/* Top bar */}
      <header className="border-b border-border/50 py-4 px-6 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-black flex items-center justify-center font-bold text-xs tracking-tighter select-none">
            CM
          </div>
          <span className="font-bold tracking-tight">Content Matrix</span>
        </div>
        <a
          href="/"
          className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-black transition-colors flex items-center gap-1.5"
        >
          Create your own workspace
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-5 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
          </div>
        ) : isError || !campaign ? (
          <div className="text-center py-32">
            <Layers className="w-16 h-16 mx-auto text-muted-foreground mb-6 opacity-20" />
            <h2 className="text-2xl font-bold mb-3">Campaign not found</h2>
            <p className="text-muted-foreground">This share link may have expired or been removed.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Campaign header */}
            <div className="pb-10 border-b border-border/50">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Shared Campaign · Approved Content
                </p>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{campaign.title}</h1>
              {campaign.description && (
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">{campaign.description}</p>
              )}

              {/* Stats strip */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-4 border-t border-border/40">
                <div className="text-center">
                  <p className="text-2xl font-bold">{pieces.length}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    Approved {pieces.length === 1 ? "Piece" : "Pieces"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{Object.keys(channelGroups).length}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    {Object.keys(channelGroups).length === 1 ? "Channel" : "Channels"}
                  </p>
                </div>
                {campaign.approvedAt && (
                  <div className="text-center">
                    <p className="text-sm font-bold">{format(parseISO(campaign.approvedAt as unknown as string), "MMM d, yyyy")}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Approved</p>
                  </div>
                )}
              </div>
            </div>

            {/* Content pieces grouped by channel */}
            {pieces.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-border/40">
                <CheckCircle className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-30" />
                <p className="font-semibold text-muted-foreground">No approved pieces yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Check back when the campaign owner approves content.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {Object.entries(channelGroups).map(([channel, channelPieces]) => (
                  <section key={channel}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <ChannelIcon channel={channel as ContentPiece["channel"]} className="w-4 h-4" />
                        <h2 className="text-sm font-bold uppercase tracking-widest">
                          {getChannelName(channel as ContentPiece["channel"])}
                        </h2>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 border border-border">
                        {channelPieces.length}
                      </span>
                      <div className="flex-1 h-px bg-border/40" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {channelPieces.map((piece) => (
                        <PieceCard key={piece.id} piece={piece} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Footer CTA */}
            <div className="border border-border bg-secondary/5 p-8 text-center mt-8">
              <p className="font-bold text-lg mb-2">Want to plan your own content campaigns?</p>
              <p className="text-sm text-muted-foreground mb-6">
                Content Matrix helps you distribute one piece of content across every major channel.
              </p>
              <a
                href="/"
                className="inline-flex items-center gap-2 bg-black text-white text-sm font-semibold px-8 py-4 hover:bg-black/80 transition-colors"
              >
                Get started for free
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
