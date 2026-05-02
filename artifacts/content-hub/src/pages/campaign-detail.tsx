import { useRoute, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft, Loader2, CheckCircle2, Trash2, Clock, Plus, Edit2, CheckCircle,
  ImageIcon, Video, PlayCircle, Calendar, MoreHorizontal, Settings2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCampaign, getGetCampaignQueryKey,
  useListContentPieces, getListContentPiecesQueryKey,
  useApproveCampaign, useDeleteCampaign, getListCampaignsQueryKey,
  ContentPieceChannel, CreateContentPieceBodyChannel,
  useUpdateCampaign, useUpdateCampaignChannels, useCreateContentPiece, useDeleteContentPiece,
  ContentPiece,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge, ChannelIcon, getChannelName } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";

const ALL_CHANNELS: ContentPieceChannel[] = [
  "source_article", "instagram_reel", "linkedin_post", "youtube_long",
  "youtube_short", "facebook_carousel", "facebook_group_post", "reddit_post", "threads_post",
];

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
}

function PieceThumbnail({ piece }: { piece: ContentPiece }) {
  const [imgError, setImgError] = useState(false);

  if (piece.mediaUrl && piece.mediaType === "video" && isYouTubeUrl(piece.mediaUrl)) {
    const thumb = getYouTubeThumbnail(piece.mediaUrl);
    if (thumb && !imgError) {
      return (
        <div className="relative w-full aspect-video bg-black overflow-hidden">
          <img src={thumb} alt="video thumbnail" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-black/70 rounded-full flex items-center justify-center">
              <PlayCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      );
    }
  }

  if (piece.mediaUrl && piece.mediaType === "image" && !imgError) {
    return (
      <div className="relative w-full aspect-video bg-secondary/20 overflow-hidden">
        <img src={piece.mediaUrl} alt={piece.title} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      </div>
    );
  }

  if (piece.mediaUrl && piece.mediaType === "video") {
    return (
      <div className="w-full aspect-video bg-black flex items-center justify-center">
        <PlayCircle className="w-10 h-10 text-white/60" />
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-secondary/20 flex items-center justify-center">
      {piece.mediaType === "image" ? (
        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
      ) : piece.mediaType === "video" ? (
        <Video className="w-8 h-8 text-muted-foreground/40" />
      ) : (
        <div className="text-muted-foreground/30 text-xs font-mono text-center px-4 line-clamp-3">
          {piece.bodyText || "No content"}
        </div>
      )}
    </div>
  );
}

export default function CampaignDetail() {
  const [, params] = useRoute("/campaigns/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(id, {
    query: { enabled: !!id, queryKey: getGetCampaignQueryKey(id) },
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
  const deleteContentPiece = useDeleteContentPiece();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  // New piece dialog
  const [newPieceChannel, setNewPieceChannel] = useState<ContentPieceChannel | null>(null);
  const [newPieceTitle, setNewPieceTitle] = useState("");
  const [newPieceCaption, setNewPieceCaption] = useState("");
  const [newPieceDate, setNewPieceDate] = useState("");
  const [newPieceMediaUrl, setNewPieceMediaUrl] = useState("");

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
    if (!editTitle.trim()) return;
    setIsEditingTitle(false);
    if (editTitle === campaign?.title) return;
    updateCampaign.mutate(
      { id, data: { title: editTitle } },
      { onSuccess: (u) => queryClient.setQueryData(getGetCampaignQueryKey(id), u) }
    );
  };

  const handleSaveDescription = () => {
    setIsEditingDescription(false);
    if (editDescription === (campaign?.description || "")) return;
    updateCampaign.mutate(
      { id, data: { description: editDescription } },
      { onSuccess: (u) => queryClient.setQueryData(getGetCampaignQueryKey(id), u) }
    );
  };

  const handleSaveChannels = () => {
    if (!selectedChannels.length) {
      toast({ title: "Select at least one channel", variant: "destructive" });
      return;
    }
    updateChannels.mutate(
      { id, data: { channels: selectedChannels as any } },
      {
        onSuccess: (u) => {
          queryClient.setQueryData(getGetCampaignQueryKey(id), u);
          setIsChannelsModalOpen(false);
          toast({ title: "Channels updated" });
        },
      }
    );
  };

  const handleApprove = () => {
    approveCampaign.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        toast({ title: "Campaign approved" });
      },
    });
  };

  const handleDelete = () => {
    deleteCampaign.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        setLocation("/dashboard");
      },
    });
  };

  const openNewPieceDialog = (channel: ContentPieceChannel) => {
    setNewPieceChannel(channel);
    setNewPieceTitle(`${getChannelName(channel)} — ${format(new Date(), 'MMM yyyy')}`);
    setNewPieceCaption("");
    setNewPieceDate("");
    setNewPieceMediaUrl("");
  };

  const handleCreatePiece = () => {
    if (!newPieceChannel) return;
    createContentPiece.mutate(
      {
        data: {
          campaignId: id,
          channel: newPieceChannel as CreateContentPieceBodyChannel,
          title: newPieceTitle || `${getChannelName(newPieceChannel)} Content`,
          bodyText: newPieceCaption || undefined,
          scheduledDate: newPieceDate ? new Date(newPieceDate).toISOString() : undefined,
          mediaUrl: newPieceMediaUrl || undefined,
          mediaType: newPieceMediaUrl
            ? (isYouTubeUrl(newPieceMediaUrl) || newPieceMediaUrl.match(/\.(mp4|mov|webm|avi)$/i)) ? "video" : "image"
            : undefined,
        },
      },
      {
        onSuccess: (piece) => {
          queryClient.invalidateQueries({ queryKey: getListContentPiecesQueryKey({ campaignId: id }) });
          setNewPieceChannel(null);
          setLocation(`/campaigns/${id}/pieces/${piece.id}`);
        },
        onError: () => toast({ title: "Failed to create content piece", variant: "destructive" }),
      }
    );
  };

  const handleDeletePiece = (e: React.MouseEvent, pieceId: number) => {
    e.preventDefault();
    e.stopPropagation();
    deleteContentPiece.mutate({ id: pieceId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContentPiecesQueryKey({ campaignId: id }) });
        toast({ title: "Content piece deleted" });
      },
    });
  };

  if (isCampaignLoading) {
    return (
      <div className="space-y-10">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3].map((j) => <Skeleton key={j} className="aspect-video" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold">Campaign not found</h2>
        <Link href="/dashboard" className="text-primary mt-4 inline-block hover:underline">Return to dashboard</Link>
      </div>
    );
  }

  const activeChannels = campaign.channels || [];
  const piecesByChannel = new Map<string, ContentPiece[]>();
  for (const ch of activeChannels) piecesByChannel.set(ch, []);
  for (const p of pieces || []) {
    const arr = piecesByChannel.get(p.channel) ?? [];
    arr.push(p);
    piecesByChannel.set(p.channel, arr);
  }

  const totalPieces = pieces?.length ?? 0;

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="pb-8 border-b border-border/50">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group mb-6">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1 space-y-4">
            {isEditingTitle ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold rounded-none h-14 text-lg"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(campaign.title); } }}
                onBlur={handleSaveTitle}
              />
            ) : (
              <h1
                className="text-4xl font-bold tracking-tight cursor-text hover:bg-secondary/30 px-2 py-1 -ml-2 rounded-sm transition-colors group flex items-center gap-2"
                onClick={() => setIsEditingTitle(true)}
              >
                {campaign.title}
                <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}

            {isEditingDescription ? (
              <div className="flex gap-2 items-start">
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="rounded-none text-sm max-w-2xl"
                  autoFocus
                  rows={2}
                  onBlur={handleSaveDescription}
                />
                <Button size="sm" onClick={handleSaveDescription} className="bg-black text-white rounded-none shrink-0">Save</Button>
              </div>
            ) : (
              <p
                className="text-muted-foreground cursor-text hover:bg-secondary/20 px-2 py-1 -ml-2 rounded-sm transition-colors min-h-[2rem] max-w-2xl group flex items-start gap-1"
                onClick={() => setIsEditingDescription(true)}
              >
                {campaign.description || <span className="italic opacity-50 text-sm">Add description...</span>}
                <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <StatusBadge status={campaign.status} />
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
              </span>
              {campaign.approvedAt && (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approved {format(new Date(campaign.approvedAt), 'MMM d')}
                </span>
              )}
              <span>{totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'} · {activeChannels.length} {activeChannels.length === 1 ? 'channel' : 'channels'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChannelsModalOpen(true)}
              className="rounded-none gap-1.5 text-xs font-semibold uppercase tracking-wider"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Channels
            </Button>

            {campaign.status !== 'approved' && campaign.status !== 'published' && (
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approveCampaign.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-none text-xs font-semibold uppercase tracking-wider gap-1.5"
              >
                {approveCampaign.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-none text-muted-foreground hover:text-destructive gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the campaign and all its content pieces.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Channel Sections */}
      {activeChannels.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border/60">
          <p className="text-muted-foreground mb-4">No channels selected for this campaign.</p>
          <Button onClick={() => setIsChannelsModalOpen(true)} className="bg-black text-white rounded-none">Select Channels</Button>
        </div>
      ) : (
        <div className="space-y-12">
          {activeChannels.map((channel) => {
            const chPieces = piecesByChannel.get(channel) ?? [];

            return (
              <section key={channel}>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border border-border flex items-center justify-center">
                      <ChannelIcon channel={channel as any} className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-base tracking-tight">{getChannelName(channel as any)}</h2>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                        {chPieces.length} {chPieces.length === 1 ? 'piece' : 'pieces'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openNewPieceDialog(channel as ContentPieceChannel)}
                    className="rounded-none gap-1.5 text-xs font-semibold uppercase tracking-wider"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {isPiecesLoading ? (
                    [1, 2, 3].map((i) => <Skeleton key={i} className="aspect-video" />)
                  ) : chPieces.length === 0 ? (
                    <button
                      onClick={() => openNewPieceDialog(channel as ContentPieceChannel)}
                      className="col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5 aspect-[4/1] border border-dashed border-border/60 hover:border-black transition-colors flex items-center justify-center gap-3 text-muted-foreground hover:text-black group"
                    >
                      <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-semibold">Add first content piece</span>
                    </button>
                  ) : (
                    <>
                      {chPieces.map((piece) => (
                        <Link key={piece.id} href={`/campaigns/${id}/pieces/${piece.id}`}>
                          <div className="group border border-border/80 hover:border-black hover:shadow-md transition-all duration-200 bg-white overflow-hidden cursor-pointer">
                            {/* Thumbnail */}
                            <PieceThumbnail piece={piece} />

                            {/* Info */}
                            <div className="p-3 space-y-2">
                              {piece.scheduledDate && (
                                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(piece.scheduledDate), 'MMM d, yyyy')}
                                </div>
                              )}
                              <p className="text-xs font-semibold line-clamp-2 leading-tight group-hover:text-black transition-colors">
                                {piece.title}
                              </p>
                              {piece.bodyText && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                                  {piece.bodyText}
                                </p>
                              )}
                              <div className="flex items-center justify-between pt-1">
                                <StatusBadge status={piece.status} />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive text-muted-foreground"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete this piece?</AlertDialogTitle>
                                      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={(e) => handleDeletePiece(e, piece.id)} className="bg-destructive text-white">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {/* Add more button */}
                      <button
                        onClick={() => openNewPieceDialog(channel as ContentPieceChannel)}
                        className="border border-dashed border-border/60 hover:border-black transition-colors flex items-center justify-center aspect-video text-muted-foreground hover:text-black group"
                      >
                        <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      </button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Edit Channels Modal */}
      <Dialog open={isChannelsModalOpen} onOpenChange={setIsChannelsModalOpen}>
        <DialogContent className="rounded-none sm:rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Channels</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            {ALL_CHANNELS.map((ch) => (
              <div
                key={ch}
                className="flex items-center gap-3 border border-border p-3 cursor-pointer hover:bg-secondary/10 transition-colors"
                onClick={() => setSelectedChannels((prev) =>
                  prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
                )}
              >
                <Checkbox
                  checked={selectedChannels.includes(ch)}
                  className="rounded-none"
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={(checked) => setSelectedChannels((prev) =>
                    checked ? [...prev, ch] : prev.filter((c) => c !== ch)
                  )}
                />
                <div className="flex items-center gap-2 font-medium text-sm">
                  <ChannelIcon channel={ch} className="w-4 h-4" />
                  {getChannelName(ch)}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsChannelsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveChannels} disabled={updateChannels.isPending} className="bg-black text-white rounded-none">
              {updateChannels.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Piece Dialog */}
      <Dialog open={!!newPieceChannel} onOpenChange={(open) => !open && setNewPieceChannel(null)}>
        <DialogContent className="rounded-none sm:rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newPieceChannel && <ChannelIcon channel={newPieceChannel} className="w-4 h-4" />}
              New {newPieceChannel ? getChannelName(newPieceChannel) : ''} Piece
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title</label>
              <Input
                value={newPieceTitle}
                onChange={(e) => setNewPieceTitle(e.target.value)}
                className="rounded-none"
                placeholder="e.g. Week 1 Instagram Reel"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Caption / Body</label>
              <Textarea
                value={newPieceCaption}
                onChange={(e) => setNewPieceCaption(e.target.value)}
                className="rounded-none min-h-[80px] resize-none"
                placeholder="Write the caption or body text..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scheduled Date</label>
              <Input
                type="date"
                value={newPieceDate}
                onChange={(e) => setNewPieceDate(e.target.value)}
                className="rounded-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Media URL (YouTube, image URL, etc.)</label>
              <Input
                value={newPieceMediaUrl}
                onChange={(e) => setNewPieceMediaUrl(e.target.value)}
                className="rounded-none font-mono text-sm"
                placeholder="https://youtube.com/watch?v=... or image URL"
              />
              <p className="text-[11px] text-muted-foreground">You can also upload media after creating the piece.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewPieceChannel(null)}>Cancel</Button>
            <Button
              onClick={handleCreatePiece}
              disabled={createContentPiece.isPending || !newPieceTitle.trim()}
              className="bg-black text-white rounded-none"
            >
              {createContentPiece.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create & Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
