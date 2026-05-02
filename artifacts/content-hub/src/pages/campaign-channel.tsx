import { useRoute, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft, Plus, Loader2, Calendar, MessageSquare, CheckCircle2,
  PlayCircle, ImageIcon, Clock, Send, X, Crown, Briefcase,
} from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  useListContentPieces, getListContentPiecesQueryKey,
  useCreateContentPiece, useDeleteContentPiece,
  useGetCampaign, getGetCampaignQueryKey,
  useUpdateContentPiece,
  ContentPiece, CreateContentPieceBodyChannel,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ChannelIcon, getChannelName, StatusBadge } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type MemberRole = "owner" | "marketer" | "team_member";
interface CampaignMember { id: number; email: string; role: MemberRole; }

function isYouTubeUrl(url: string) { return /youtube\.com|youtu\.be/.test(url); }
function getYouTubeThumbnail(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}
function isImageUrl(url: string) { return /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(url) || url.startsWith("data:image"); }

function PieceThumbnail({ piece }: { piece: ContentPiece }) {
  const [err, setErr] = useState(false);
  if (piece.mediaUrl && isYouTubeUrl(piece.mediaUrl)) {
    const thumb = getYouTubeThumbnail(piece.mediaUrl);
    if (thumb && !err)
      return (
        <div className="relative w-20 h-14 bg-black shrink-0 overflow-hidden">
          <img src={thumb} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="w-5 h-5 text-white drop-shadow" />
          </div>
        </div>
      );
  }
  if (piece.mediaUrl && (isImageUrl(piece.mediaUrl) || piece.mediaType === "image") && !err)
    return (
      <div className="relative w-20 h-14 bg-secondary/20 shrink-0 overflow-hidden">
        <img src={piece.mediaUrl} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      </div>
    );
  return (
    <div className="w-20 h-14 bg-secondary/10 shrink-0 flex items-center justify-center border border-border/40">
      {piece.mediaType === "video"
        ? <PlayCircle className="w-5 h-5 text-muted-foreground/40" />
        : piece.mediaType === "image"
        ? <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
        : <span className="text-[9px] text-muted-foreground/40 font-mono text-center px-1 line-clamp-3">{piece.bodyText || "—"}</span>}
    </div>
  );
}

export default function CampaignChannel() {
  const [, params] = useRoute("/campaigns/:id/channels/:channel");
  const campaignId = params?.id ? parseInt(params.id, 10) : 0;
  const channel = params?.channel ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: campaign } = useGetCampaign(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetCampaignQueryKey(campaignId) },
  });

  const { data: allPieces, isLoading } = useListContentPieces(
    { campaignId },
    { query: { enabled: !!campaignId, queryKey: getListContentPiecesQueryKey({ campaignId }) } }
  );
  const pieces = allPieces?.filter(p => p.channel === channel) ?? [];

  const { data: members } = useQuery<CampaignMember[]>({
    queryKey: ["campaign-members", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/members`);
      return res.json();
    },
    enabled: !!campaignId,
  });

  const createPiece = useCreateContentPiece();
  const deletePiece = useDeleteContentPiece();
  const updatePiece = useUpdateContentPiece();

  // New piece dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newMediaUrl, setNewMediaUrl] = useState("");

  // Submit for review dialog
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewPieceId, setReviewPieceId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewMentionEmail, setReviewMentionEmail] = useState("");

  const ownerEmails = members?.filter(m => m.role === "owner").map(m => m.email) ?? [];
  const marketerEmails = members?.filter(m => m.role === "marketer").map(m => m.email) ?? [];

  const approvedCount = pieces.filter(p => p.status === "approved").length;
  const allApproved = pieces.length > 0 && approvedCount === pieces.length;

  const handleAddPiece = () => {
    createPiece.mutate(
      {
        data: {
          campaignId,
          channel: channel as CreateContentPieceBodyChannel,
          title: newTitle || `${getChannelName(channel as any)} — ${format(new Date(), 'MMM d')}`,
          bodyText: newCaption || undefined,
          scheduledDate: newDate ? new Date(newDate).toISOString() : undefined,
          mediaUrl: newMediaUrl || undefined,
          mediaType: newMediaUrl
            ? (isYouTubeUrl(newMediaUrl) ? "video" : isImageUrl(newMediaUrl) ? "image" : "video")
            : undefined,
        },
      },
      {
        onSuccess: (p) => {
          queryClient.invalidateQueries({ queryKey: getListContentPiecesQueryKey({ campaignId }) });
          setIsAddOpen(false);
          setNewTitle(""); setNewCaption(""); setNewDate(""); setNewMediaUrl("");
          setLocation(`/campaigns/${campaignId}/pieces/${p.id}`);
        },
        onError: () => toast({ title: "Failed to create piece", variant: "destructive" }),
      }
    );
  };

  const openReview = (pieceId: number) => {
    setReviewPieceId(pieceId);
    setReviewNote("");
    setReviewMentionEmail(ownerEmails[0] ?? marketerEmails[0] ?? "");
    setIsReviewOpen(true);
  };

  const handleSubmitForReview = () => {
    if (!reviewPieceId) return;
    updatePiece.mutate(
      { id: reviewPieceId, data: { status: "in_review" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListContentPiecesQueryKey({ campaignId }) });
          setIsReviewOpen(false);
          toast({
            title: "Submitted for review",
            description: reviewMentionEmail
              ? `${reviewMentionEmail} has been notified.`
              : "Status updated to In Review.",
          });
        },
      }
    );
  };

  const handleDeletePiece = (pieceId: number) => {
    deletePiece.mutate({ id: pieceId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListContentPiecesQueryKey({ campaignId }) });
        toast({ title: "Piece deleted" });
      },
    });
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Back */}
      <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to {campaign?.title ?? "Campaign"}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border border-border flex items-center justify-center">
            <ChannelIcon channel={channel as any} className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{getChannelName(channel as any)}</h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">
              {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
              {pieces.length > 0 && ` · ${approvedCount}/${pieces.length} approved`}
            </p>
          </div>
          {pieces.length > 0 && (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border ${
              allApproved
                ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                : "text-amber-700 border-amber-200 bg-amber-50"
            }`}>
              {allApproved ? "All Approved" : "Awaiting Approval"}
            </span>
          )}
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-black text-white rounded-none gap-1.5 text-xs font-semibold uppercase tracking-wider">
          <Plus className="w-3.5 h-3.5" />
          Add Piece
        </Button>
      </div>

      {/* Pieces List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : pieces.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border/60">
          <p className="text-muted-foreground mb-4">No content pieces yet for this channel.</p>
          <Button onClick={() => setIsAddOpen(true)} className="bg-black text-white rounded-none gap-2">
            <Plus className="w-4 h-4" />
            Add First Piece
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {pieces.map(piece => (
            <div key={piece.id} className="group border border-border hover:border-black transition-colors bg-white flex items-start gap-4 p-4">
              {/* Thumbnail */}
              <Link href={`/campaigns/${campaignId}/pieces/${piece.id}`}>
                <PieceThumbnail piece={piece} />
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/campaigns/${campaignId}/pieces/${piece.id}`} className="hover:underline underline-offset-2">
                    <h3 className="font-bold text-sm leading-tight line-clamp-1">{piece.title}</h3>
                  </Link>
                  <StatusBadge status={piece.status} />
                </div>

                {piece.scheduledDate && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(piece.scheduledDate), 'EEE, MMM d, yyyy')}
                  </p>
                )}

                {piece.bodyText && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{piece.bodyText}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {piece.commentCount}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {piece.status !== "approved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none gap-1.5 text-xs h-8 border-border"
                    onClick={() => openReview(piece.id)}
                  >
                    <Send className="w-3 h-3" />
                    Review
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="rounded-none h-8 text-muted-foreground hover:text-destructive px-2">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete piece?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeletePiece(piece.id)} className="bg-destructive text-white">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Piece Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-none sm:rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChannelIcon channel={channel as any} className="w-4 h-4" />
              New {getChannelName(channel as any)} Piece
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="rounded-none" placeholder={`${getChannelName(channel as any)} — Week 1`} autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Caption / Body</label>
              <Textarea value={newCaption} onChange={e => setNewCaption(e.target.value)} className="rounded-none min-h-[80px] resize-none" placeholder="Write your caption..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scheduled Date</label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Media URL</label>
                <Input value={newMediaUrl} onChange={e => setNewMediaUrl(e.target.value)} className="rounded-none font-mono text-xs" placeholder="YouTube or image URL" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPiece} disabled={createPiece.isPending} className="bg-black text-white rounded-none">
              {createPiece.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create & Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit for Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="rounded-none sm:rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle>Submit for Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notify Reviewer</label>
              {members && members.length > 0 ? (
                <Select value={reviewMentionEmail} onValueChange={setReviewMentionEmail}>
                  <SelectTrigger className="rounded-none w-full">
                    <SelectValue placeholder="Select reviewer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No notification</SelectItem>
                    {members
                      .filter(m => m.role === "owner" || m.role === "marketer")
                      .map(m => (
                        <SelectItem key={m.id} value={m.email}>
                          <span className="flex items-center gap-2">
                            {m.role === "owner" ? <Crown className="w-3 h-3 text-amber-600" /> : <Briefcase className="w-3 h-3 text-blue-600" />}
                            {m.email}
                          </span>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={reviewMentionEmail}
                  onChange={e => setReviewMentionEmail(e.target.value)}
                  className="rounded-none"
                  placeholder="owner@company.com"
                  type="email"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Note (optional)</label>
              <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} className="rounded-none min-h-[60px] resize-none text-sm" placeholder="Add context for the reviewer..." />
            </div>
            <div className="text-[11px] text-muted-foreground bg-secondary/20 p-3 border border-border/40">
              This will mark the piece as <strong>In Review</strong>. The reviewer will see it on their dashboard.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsReviewOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitForReview} disabled={updatePiece.isPending} className="bg-black text-white rounded-none gap-1.5">
              {updatePiece.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
