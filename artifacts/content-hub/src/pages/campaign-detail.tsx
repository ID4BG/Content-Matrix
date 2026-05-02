import { useRoute, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Loader2, CheckCircle2, Trash2, Clock, FileText, Plus, Edit2, CheckCircle } from "lucide-react";
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
  CreateContentPieceBodyChannel,
  useUpdateCampaign,
  useUpdateCampaignChannels
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCreateContentPiece } from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";

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
  const updateCampaign = useUpdateCampaign();
  const updateChannels = useUpdateCampaignChannels();
  const createContentPiece = useCreateContentPiece();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  
  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (campaign && initializedForId.current !== id) {
      initializedForId.current = id;
      setEditTitle(campaign.title);
      setEditDescription(campaign.description || "");
      setSelectedChannels(campaign.channels || []);
    }
  }, [campaign, id]);

  const handleSaveTitle = () => {
    if (editTitle.trim() === "") return;
    setIsEditingTitle(false);
    if (editTitle === campaign?.title) return;

    updateCampaign.mutate(
      { id, data: { title: editTitle } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetCampaignQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        }
      }
    );
  };

  const handleSaveDescription = () => {
    setIsEditingDescription(false);
    if (editDescription === (campaign?.description || "")) return;

    updateCampaign.mutate(
      { id, data: { description: editDescription } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetCampaignQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        }
      }
    );
  };

  const handleSaveChannels = () => {
    if (selectedChannels.length === 0) {
      toast({ title: "Error", description: "Select at least one channel", variant: "destructive" });
      return;
    }
    
    updateChannels.mutate(
      { id, data: { channels: selectedChannels as any } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetCampaignQueryKey(id), updated);
          setIsChannelsModalOpen(false);
          toast({ title: "Channels Updated", description: "Campaign channels have been updated." });
        }
      }
    );
  };

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
          title: `${getChannelName(channel)} Content`
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

  const activeChannels = campaign.channels || [];

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8 border-b border-border/50">
        <div className="space-y-6 flex-1">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 max-w-2xl">
                  <Input 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-2xl font-bold py-6 px-4 bg-secondary/20 rounded-none border-border w-full"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(campaign.title); } }}
                    onBlur={handleSaveTitle}
                  />
                </div>
              ) : (
                <h1 
                  className="text-4xl md:text-5xl font-bold tracking-tight hover:bg-secondary/30 p-2 -ml-2 rounded-sm cursor-text border border-transparent hover:border-border transition-colors group flex items-center gap-2"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {campaign.title}
                  <Edit2 className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </h1>
              )}
              
              <Badge variant="outline" className={`px-4 py-1.5 text-sm uppercase tracking-widest font-bold ${
                campaign.status === 'in_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                campaign.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                campaign.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                'bg-secondary text-secondary-foreground border-border'
              }`}>
                {campaign.status.replace('_', ' ')}
              </Badge>
            </div>
            
            {isEditingDescription ? (
              <div className="flex items-start gap-2 max-w-3xl">
                <Input 
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="text-lg bg-secondary/20 rounded-none border-border w-full"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDescription(); if (e.key === 'Escape') { setIsEditingDescription(false); setEditDescription(campaign.description || ""); } }}
                  onBlur={handleSaveDescription}
                />
              </div>
            ) : (
              <p 
                className="text-muted-foreground text-lg max-w-3xl leading-relaxed hover:bg-secondary/30 p-2 -ml-2 rounded-sm cursor-text border border-transparent hover:border-border transition-colors group flex items-start gap-2 min-h-[40px]"
                onClick={() => setIsEditingDescription(true)}
              >
                {campaign.description || <span className="italic opacity-50">Add a description...</span>}
                <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground uppercase tracking-widest pt-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Created {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
            </div>
            {campaign.approvedAt && (
              <div className="flex items-center gap-2 text-blue-600">
                <CheckCircle className="w-4 h-4" />
                Approved {format(new Date(campaign.approvedAt), 'MMM d')}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-none border-border">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-none border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-bold">Delete Campaign?</AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                  This action cannot be undone. This will permanently delete this campaign
                  and all of its content pieces.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none font-semibold border-border">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-none font-semibold">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {campaign.status !== 'approved' && campaign.status !== 'published' && (
            <Button 
              onClick={handleApprove}
              disabled={approveCampaign.isPending}
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm rounded-none font-semibold"
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
          <div className="flex items-center gap-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {pieces?.length || 0} / {activeChannels.length} Pieces
            </div>
            
            <Dialog open={isChannelsModalOpen} onOpenChange={setIsChannelsModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-none border-border text-xs font-semibold uppercase tracking-widest">
                  Edit Channels
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-none border-border max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-bold text-xl">Manage Channels</DialogTitle>
                  <DialogDescription className="text-base">
                    Select which channels this campaign will be distributed to.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                  {ALL_CHANNELS.map((channel) => (
                    <div 
                      key={channel} 
                      className="flex items-center space-x-3 border border-border p-4 hover:bg-secondary/10 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedChannels(prev => 
                          prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
                        );
                      }}
                    >
                      <Checkbox 
                        checked={selectedChannels.includes(channel)}
                        onCheckedChange={(checked) => {
                          setSelectedChannels(prev => 
                            checked ? [...prev, channel] : prev.filter(c => c !== channel)
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-none border-black"
                      />
                      <div className="flex items-center gap-2 font-medium w-full">
                        <ChannelIcon channel={channel} className="w-4 h-4" />
                        {getChannelName(channel)}
                      </div>
                    </div>
                  ))}
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsChannelsModalOpen(false)} className="rounded-none font-semibold">Cancel</Button>
                  <Button onClick={handleSaveChannels} disabled={updateChannels.isPending} className="rounded-none font-semibold bg-black text-white hover:bg-black/80">
                    {updateChannels.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Channels
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isPiecesLoading ? (
             Array(activeChannels.length || 3).fill(0).map((_, i) => <Skeleton key={i} className="h-64" />)
          ) : activeChannels.length === 0 ? (
            <div className="col-span-full py-16 text-center border border-dashed border-border bg-secondary/5">
              <p className="text-lg font-semibold mb-2">No channels selected</p>
              <p className="text-muted-foreground mb-4">You need to select channels to start creating content pieces.</p>
              <Button onClick={() => setIsChannelsModalOpen(true)} className="rounded-none font-semibold bg-black text-white hover:bg-black/80">
                Select Channels
              </Button>
            </div>
          ) : (
            activeChannels.map(channel => {
              const piece = pieces?.find(p => p.channel === channel);
              
              if (piece) {
                return (
                  <Link key={channel} href={`/campaigns/${id}/pieces/${piece.id}`} className="group h-full">
                    <div className="h-full border border-border bg-white hover:border-black transition-all duration-300 flex flex-col relative">
                      <div className="p-4 border-b border-border bg-secondary/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChannelIcon channel={channel as any} className="w-4 h-4 text-foreground" />
                          <span className="font-bold uppercase tracking-widest text-[10px]">{getChannelName(channel as any)}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-widest rounded-none border-border bg-white ${
                          piece.status === 'in_review' ? 'text-amber-600' :
                          piece.status === 'approved' ? 'text-blue-600' :
                          piece.status === 'needs_revision' ? 'text-rose-600' :
                          'text-muted-foreground'
                        }`}>
                          {piece.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <h3 className="font-bold text-lg mb-3 group-hover:underline decoration-2 underline-offset-4 line-clamp-2">
                          {piece.title}
                        </h3>
                        {piece.bodyText ? (
                          <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">
                            {piece.bodyText}
                          </p>
                        ) : (
                          <div className="flex-1 flex items-center text-sm text-muted-foreground italic mb-4 opacity-50">
                            No content written
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-4 border-t border-border mt-auto">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3 h-3" />
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
                <div key={channel} className="h-full border border-dashed border-border bg-secondary/5 flex flex-col relative group cursor-pointer hover:border-black transition-colors" onClick={() => handleCreatePiece(channel as any)}>
                  <div className="p-4 border-b border-dashed border-border flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      <ChannelIcon channel={channel as any} className="w-4 h-4 text-muted-foreground group-hover:text-black transition-colors" />
                      <span className="font-bold uppercase tracking-widest text-[10px] text-muted-foreground group-hover:text-black transition-colors">{getChannelName(channel as any)}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-widest rounded-none border-border bg-white text-muted-foreground">Missing</Badge>
                  </div>
                  <div className="p-6 flex-1 flex flex-col items-center justify-center text-center gap-4 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-muted-foreground bg-white group-hover:border-black group-hover:text-black transition-colors">
                      {createContentPiece.isPending && createContentPiece.variables?.data.channel === channel ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm">Add {getChannelName(channel as any)}</h4>
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