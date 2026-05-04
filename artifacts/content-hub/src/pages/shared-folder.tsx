import { useRoute } from "wouter";
import { format } from "date-fns";
import { Folder, FolderKanban, ExternalLink } from "lucide-react";
import { useGetSharedFolder, getGetSharedFolderQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/channel-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function SharedFolder() {
  const [, params] = useRoute("/shared/folder/:token");
  const token = params?.token ?? "";

  const { data, isLoading, isError } = useGetSharedFolder(token, {
    query: { enabled: !!token, queryKey: getGetSharedFolderQueryKey(token) },
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top bar */}
      <header className="border-b border-border/50 py-4 px-6 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-black flex items-center justify-center font-bold text-xs tracking-tighter">CM</div>
          <span className="font-bold tracking-tight">Content Matrix</span>
        </div>
        <a href="/" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-black transition-colors flex items-center gap-1.5">
          Create your own workspace
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-10 w-64" />
            <div className="space-y-4">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          </div>
        ) : isError || !data ? (
          <div className="text-center py-24">
            <Folder className="w-16 h-16 mx-auto text-muted-foreground mb-6 opacity-30" />
            <h2 className="text-2xl font-bold mb-3">Folder not found</h2>
            <p className="text-muted-foreground">This share link may have expired or been removed.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Folder header */}
            <div className="pb-8 border-b border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 border border-border flex items-center justify-center">
                  <Folder className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shared Folder</p>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{data.folder.title}</h1>
              {data.folder.description && (
                <p className="text-muted-foreground text-lg">{data.folder.description}</p>
              )}
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-4 pt-4 border-t border-border inline-block">
                {data.campaigns.length} {data.campaigns.length === 1 ? 'Campaign' : 'Campaigns'}
              </p>
            </div>

            {/* Campaigns */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold tracking-tight">Campaigns</h2>
              {data.campaigns.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border/60 bg-secondary/5">
                  <FolderKanban className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-40" />
                  <p className="text-muted-foreground font-semibold text-sm">No campaigns in this folder.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.campaigns.map((campaign) => (
                    <div key={campaign.id} className="border border-border bg-card p-6">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <h3 className="font-bold text-xl mb-1">{campaign.title}</h3>
                          {campaign.description && (
                            <p className="text-muted-foreground text-sm leading-relaxed">{campaign.description}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold rounded-none ${
                            campaign.status === 'in_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            campaign.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            campaign.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-secondary text-secondary-foreground border-border'
                        }`}>
                          {campaign.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-t border-border/40 pt-4 mt-4">
                        <span>{campaign.contentPieceCount} Content {campaign.contentPieceCount === 1 ? 'Piece' : 'Pieces'}</span>
                        <span>•</span>
                        <span>{campaign.channels?.length ?? 0} Channels</span>
                        <span>•</span>
                        <span>Created {format(new Date(campaign.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer CTA */}
            <div className="border border-border bg-secondary/5 p-8 text-center mt-12">
              <p className="font-bold text-lg mb-2">Want to create your own content campaigns?</p>
              <p className="text-sm text-muted-foreground mb-6">Content Matrix helps you distribute one piece of content across every major channel.</p>
              <a href="/" className="inline-flex items-center gap-2 bg-black text-white text-sm font-semibold px-8 py-4 hover:bg-black/80 transition-colors">
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