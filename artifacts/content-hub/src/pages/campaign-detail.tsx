import { useRoute, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Loader2, CheckCircle2, Trash2, Clock, FileText, Upload, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetCampaign, 
  getGetCampaignQueryKey,
  useListContentPieces,
  getListContentPiecesQueryKey,
  useApproveCampaign,
  useDeleteCampaign,
  getListCampaignsQueryKey,
  ContentPieceChannel,
  CreateContentPieceBodyChannel
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge, ChannelIcon, getChannelName } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCreateContentPiece } from "@workspace/api-client-react";

const ALL_CHANNELS: ContentPieceChannel[] = [
  "source_article",
  "instagram_reel",
  "linkedin_post",
  "youtube_long",
  "youtube_short",
  "facebook_carousel",
  "facebook_group_post",
  "reddit_post",
  "threads_post"
];

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(id, {
    query: { enabled: !!id, queryKey: getGetCampaignQueryKey(id) }
  });

  const { data: pieces, isLoading: isPiecesLoading } = useListContentPieces(
    { campaignId: id },
    { query: { enabled: !!id, queryKey: getListContentPiecesQueryKey({ campaignId: id }) } }
  );

  const approveCampaign = useApproveCampaign();
  const deleteCampaign = useDeleteCampaign();
  const createContentPiece = useCreateContentPiece();

  const handleApprove = () => {
    approveCampaign.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({
            title: "Campaign Approved",
            description: "The campaign has been marked as approved.",
          });
        }
      }
    );
  };

  const handleDelete = () => {
    deleteCampaign.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({
            title: "Campaign Deleted",
            description: "The campaign has been removed.",
          });
          setLocation("/");
        }
      }
    );
  };

  const handleCreatePiece = (channel: ContentPieceChannel) => {
    createContentPiece.mutate(
      { 
        data: {
          campaignId: id,
          channel: channel as CreateContentPieceBodyChannel,
          title: `New ${getChannelName(channel)}`
        }
      },
      {
        onSuccess: (newPiece) => {
          queryClient.invalidateQueries({ queryKey: getListContentPiecesQueryKey({ campaignId: id }) });
          setLocation(`/campaigns/${id}/pieces/${newPiece.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create content piece.",
            variant: "destructive"
          });
        }
      }
    );
  };

  if (isCampaignLoading) {
    return (
      <div className="space-y-12">
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-3/4 max-w-2xl" />
          <Skeleton className="h-6 w-1/2 max-w-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold">Campaign not found</h2>
        <Link href="/" className="text-primary mt-4 inline-block hover:underline">Return to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-border/50">
        <div className="space-y-4 flex-1">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="space-y-2">
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{campaign.title}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            {campaign.description && (
              <p className="text-muted-foreground text-lg max-w-3xl leading-relaxed">
                {campaign.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground uppercase tracking-widest pt-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Created {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
            </div>
            {campaign.approvedAt && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-500">
                <CheckCircle2 className="w-4 h-4" />
                Approved {format(new Date(campaign.approvedAt), 'MMM d')}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this campaign
                  and all of its content pieces.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {campaign.status !== 'approved' && campaign.status !== 'published' && (
            <Button 
              onClick={handleApprove}
              disabled={approveCampaign.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
            >
              {approveCampaign.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Approve Campaign
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Content Pieces</h2>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            {pieces?.length || 0} / {ALL_CHANNELS.length} Active
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isPiecesLoading ? (
             Array(ALL_CHANNELS.length).fill(0).map((_, i) => <Skeleton key={i} className="h-64" />)
          ) : (
            ALL_CHANNELS.map(channel => {
              const piece = pieces?.find(p => p.channel === channel);
              
              if (piece) {
                return (
                  <Link key={channel} href={`/campaigns/${id}/pieces/${piece.id}`} className="group h-full">
                    <div className="h-full border border-border/80 bg-card hover:border-primary/40 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative overflow-hidden">
                      <div className="p-5 border-b border-border/40 bg-secondary/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ChannelIcon channel={channel} className="w-5 h-5 text-foreground" />
                          <span className="font-semibold uppercase tracking-wider text-xs">{getChannelName(channel)}</span>
                        </div>
                        <StatusBadge status={piece.status} />
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <h3 className="font-bold text-lg mb-3 group-hover:text-primary transition-colors line-clamp-2">
                          {piece.title}
                        </h3>
                        {piece.bodyText ? (
                          <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">
                            {piece.bodyText}
                          </p>
                        ) : (
                          <div className="flex-1 flex items-center text-sm text-muted-foreground italic mb-4">
                            No content written yet
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest pt-4 border-t border-border/40 mt-auto">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            {piece.mediaType ? 'Media attached' : 'Text only'}
                          </span>
                          <span>•</span>
                          <span>{piece.commentCount} Comments</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }

              return (
                <div key={channel} className="h-full border border-dashed border-border/80 bg-secondary/5 flex flex-col relative group">
                  <div className="p-5 border-b border-dashed border-border/40 flex items-center justify-between opacity-60">
                    <div className="flex items-center gap-3">
                      <ChannelIcon channel={channel} className="w-5 h-5 text-muted-foreground" />
                      <span className="font-semibold uppercase tracking-wider text-xs text-muted-foreground">{getChannelName(channel)}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground">Missing</span>
                  </div>
                  <div className="p-6 flex-1 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors cursor-pointer" onClick={() => handleCreatePiece(channel)}>
                      {createContentPiece.isPending && createContentPiece.variables?.data.channel === channel ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">Add {getChannelName(channel)}</h4>
                      <p className="text-xs text-muted-foreground max-w-[200px]">Create a tailored piece of content for this channel.</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
