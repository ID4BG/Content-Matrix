import { useRoute, Link } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft, Loader2, CheckCircle2, MessageSquare, XCircle, Clock,
  Upload, ImageIcon, Video, ExternalLink, ZoomIn, X, PlayCircle, Calendar,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUser } from "@clerk/react";

import {
  useGetContentPiece, getGetContentPieceQueryKey,
  useGetCampaign, getGetCampaignQueryKey,
  useUpdateContentPiece, useApproveContentPiece,
  useListComments, getListCommentsQueryKey,
  useCreateComment,
  UpdateContentPieceBodyStatus,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ChannelIcon, getChannelName, StatusBadge } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const commentSchema = z.object({
  text: z.string().min(1, "Comment cannot be empty"),
  authorName: z.string(),
});

function isYouTubeUrl(url: string) {
  return /youtube\.com|youtu\.be/.test(url);
}

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0` : null;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(url) || url.startsWith("data:image");
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm|ogg|avi|mkv)(\?|$)/i.test(url) || url.startsWith("data:video");
}

function MediaViewer({ mediaUrl, mediaType, onClose }: { mediaUrl: string; mediaType?: string | null; onClose?: () => void }) {
  const [zoomed, setZoomed] = useState(false);

  if (isYouTubeUrl(mediaUrl)) {
    const embedUrl = getYouTubeEmbedUrl(mediaUrl);
    return (
      <div className="relative w-full bg-black">
        {onClose && (
          <button onClick={onClose} className="absolute top-2 right-2 z-10 bg-black/60 text-white rounded-full p-1 hover:bg-black">
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="aspect-video">
          <iframe
            src={embedUrl || mediaUrl}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        <div className="p-3 border-t border-border/30 bg-black/80 flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-white/60" />
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-white/60 hover:text-white flex items-center gap-1 transition-colors">
            Open on YouTube <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  if (mediaType === "image" || isImageUrl(mediaUrl)) {
    return (
      <div className={`relative bg-secondary/10 overflow-hidden ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`} onClick={() => setZoomed(!zoomed)}>
        {onClose && (
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-2 right-2 z-10 bg-black/60 text-white rounded-full p-1 hover:bg-black">
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="absolute top-2 left-2 z-10 bg-black/50 text-white rounded-full p-1">
          <ZoomIn className="w-3.5 h-3.5" />
        </div>
        <img
          src={mediaUrl}
          alt="Content media"
          className={`w-full object-contain transition-all duration-300 ${zoomed ? 'max-h-[80vh]' : 'max-h-80'}`}
        />
      </div>
    );
  }

  if (mediaType === "video" || isVideoUrl(mediaUrl)) {
    return (
      <div className="relative bg-black">
        {onClose && (
          <button onClick={onClose} className="absolute top-2 right-2 z-10 bg-black/60 text-white rounded-full p-1 hover:bg-black">
            <X className="w-4 h-4" />
          </button>
        )}
        <video src={mediaUrl} controls className="w-full max-h-80 object-contain" />
      </div>
    );
  }

  // Unknown format — show as link
  return (
    <div className="border border-border bg-secondary/10 p-4 flex items-center gap-3">
      {onClose && (
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      )}
      <ExternalLink className="w-5 h-5 text-muted-foreground" />
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
        {mediaUrl}
      </a>
    </div>
  );
}

export default function PieceDetail() {
  const [, params] = useRoute("/campaigns/:campaignId/pieces/:pieceId");
  const campaignId = params?.campaignId ? parseInt(params.campaignId, 10) : 0;
  const pieceId = params?.pieceId ? parseInt(params.pieceId, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const { data: campaign } = useGetCampaign(campaignId, {
    query: { enabled: !!campaignId, queryKey: getGetCampaignQueryKey(campaignId) },
  });
  const isOwner = (campaign as any)?.isOwner === true;
  const currentRole = (campaign as any)?.currentUserRole as "owner" | "marketer" | "team_member" | undefined;
  const canEdit = isOwner || currentRole === "marketer";
  const canApprove = isOwner;

  const { data: piece, isLoading: isPieceLoading } = useGetContentPiece(pieceId, {
    query: { enabled: !!pieceId, queryKey: getGetContentPieceQueryKey(pieceId) },
  });

  const { data: comments, isLoading: isCommentsLoading } = useListComments(
    { contentPieceId: pieceId },
    { query: { enabled: !!pieceId, queryKey: getListCommentsQueryKey({ contentPieceId: pieceId }) } }
  );

  const updatePiece = useUpdateContentPiece();
  const approvePiece = useApproveContentPiece();
  const createComment = useCreateComment();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const [editDate, setEditDate] = useState("");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [isEditingMediaUrl, setIsEditingMediaUrl] = useState(false);
  const [blobMediaUrl, setBlobMediaUrl] = useState<string | null>(null);
  const [blobMediaType, setBlobMediaType] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (piece && initializedForId.current !== pieceId) {
      initializedForId.current = pieceId;
      setEditTitle(piece.title);
      setEditCaption(piece.bodyText || "");
      setEditDate(piece.scheduledDate ? format(new Date(piece.scheduledDate), 'yyyy-MM-dd') : "");
      setMediaUrlInput(piece.mediaUrl || "");
    }
  }, [piece, pieceId]);

  const authorName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress || "Team Member";

  const commentForm = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: "", authorName },
  });

  useEffect(() => {
    if (authorName) commentForm.setValue("authorName", authorName);
  }, [authorName, commentForm]);

  const saveField = useCallback((field: Record<string, unknown>) => {
    updatePiece.mutate(
      { id: pieceId, data: field as any },
      { onSuccess: (u) => queryClient.setQueryData(getGetContentPieceQueryKey(pieceId), u) }
    );
  }, [pieceId, updatePiece, queryClient]);

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    if (!editTitle.trim() || editTitle === piece?.title) return;
    saveField({ title: editTitle });
  };

  const handleSaveCaption = () => {
    setIsEditingCaption(false);
    if (editCaption === (piece?.bodyText || "")) return;
    saveField({ bodyText: editCaption });
  };

  const handleSaveDate = (val: string) => {
    setEditDate(val);
    saveField({ scheduledDate: val ? new Date(val).toISOString() : null });
  };

  const handleSaveMediaUrl = () => {
    setIsEditingMediaUrl(false);
    if (mediaUrlInput === (piece?.mediaUrl || "")) return;
    const url = mediaUrlInput.trim();
    if (!url) { saveField({ mediaUrl: null, mediaType: null }); return; }
    let mediaType: string = "image";
    if (isYouTubeUrl(url) || isVideoUrl(url)) mediaType = "video";
    else if (isImageUrl(url)) mediaType = "image";
    saveField({ mediaUrl: url, mediaType });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith("video") ? "video" : "image";
    setBlobMediaUrl(url);
    setBlobMediaType(type);
    setMediaUrlInput(url);
    // Store the data URL in the backend so it persists
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      saveField({ mediaUrl: dataUrl, mediaType: type });
      setMediaUrlInput(dataUrl);
    };
    reader.readAsDataURL(file);
    toast({ title: "Media uploaded", description: file.name });
  };

  const handleStatusUpdate = (status: UpdateContentPieceBodyStatus) => {
    saveField({ status });
    toast({ title: `Marked as ${status.replace(/_/g, ' ')}` });
  };

  const handleApprove = () => {
    approvePiece.mutate({ id: pieceId }, {
      onSuccess: (u) => {
        queryClient.setQueryData(getGetContentPieceQueryKey(pieceId), u);
        toast({ title: "Piece approved" });
      },
    });
  };

  const onCommentSubmit = (values: z.infer<typeof commentSchema>) => {
    createComment.mutate(
      { data: { contentPieceId: pieceId, ...values } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey({ contentPieceId: pieceId }) });
          queryClient.invalidateQueries({ queryKey: getGetContentPieceQueryKey(pieceId) });
          commentForm.reset({ text: "", authorName });
        },
      }
    );
  };

  const effectiveMediaUrl = blobMediaUrl || piece?.mediaUrl;
  const effectiveMediaType = blobMediaType || piece?.mediaType;

  if (isPieceLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!piece) {
    return <div className="text-center py-24"><p className="text-muted-foreground">Content piece not found.</p></div>;
  }

  return (
    <div className="max-w-5xl">
      <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group mb-8">
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Campaign
      </Link>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Main */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Channel + status */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border border-border flex items-center justify-center">
              <ChannelIcon channel={piece.channel as any} className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-sm uppercase tracking-widest">{getChannelName(piece.channel as any)}</span>
            <span className="text-border">|</span>
            <StatusBadge status={piece.status} />
          </div>

          {/* Media Viewer */}
          <div className="border border-border overflow-hidden">
            {effectiveMediaUrl ? (
              <MediaViewer
                mediaUrl={effectiveMediaUrl}
                mediaType={effectiveMediaType}
                onClose={() => {
                  setBlobMediaUrl(null);
                  setBlobMediaType(null);
                }}
              />
            ) : (
              <div
                className={`aspect-video bg-secondary/10 flex flex-col items-center justify-center gap-4 transition-colors group ${canEdit ? "cursor-pointer hover:bg-secondary/20" : "cursor-default"}`}
                onClick={() => { if (canEdit) fileInputRef.current?.click(); }}
              >
                <div className="w-14 h-14 border border-border flex items-center justify-center group-hover:border-black transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground group-hover:text-black transition-colors" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">Upload media or paste a URL below</p>
                  <p className="text-xs text-muted-foreground mt-1">Photo, video, or YouTube link</p>
                </div>
              </div>
            )}

            {/* Media URL bar */}
            <div className="border-t border-border bg-secondary/10 p-3 flex items-center gap-2">
              <div className="flex-1">
                {isEditingMediaUrl && canEdit ? (
                  <Input
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    className="rounded-none h-8 text-xs font-mono"
                    placeholder="Paste YouTube, image, or video URL..."
                    autoFocus
                    onBlur={handleSaveMediaUrl}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveMediaUrl(); if (e.key === 'Escape') setIsEditingMediaUrl(false); }}
                  />
                ) : (
                  <button
                    onClick={() => { if (canEdit) setIsEditingMediaUrl(true); }}
                    className={`text-xs text-muted-foreground transition-colors text-left w-full truncate ${canEdit ? "hover:text-foreground" : "cursor-default"}`}
                  >
                    {piece.mediaUrl ? (
                      <span className="font-mono">{piece.mediaUrl.startsWith('data:') ? 'Uploaded file (data URL)' : piece.mediaUrl}</span>
                    ) : (
                      <span className="italic">{canEdit ? "Click to paste media URL…" : "No media attached"}</span>
                    )}
                  </button>
                )}
              </div>
              {canEdit && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors border border-border/60 hover:border-black px-2 py-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload
                </button>
              )}
              {piece.mediaUrl && !piece.mediaUrl.startsWith('data:') && (
                <a href={piece.mediaUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />

          {/* Title */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</label>
            {isEditingTitle && canEdit ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="rounded-none text-xl font-bold"
                autoFocus
                onBlur={handleSaveTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(piece.title); } }}
              />
            ) : (
              <h1
                className={`text-2xl font-bold tracking-tight px-2 py-1 -ml-2 rounded-sm transition-colors group flex items-center gap-2 ${canEdit ? "cursor-text hover:bg-secondary/20" : ""}`}
                onClick={() => { if (canEdit) setIsEditingTitle(true); }}
              >
                {piece.title}
              </h1>
            )}
          </div>

          {/* Scheduled Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Scheduled Date
            </label>
            <Input
              type="date"
              value={editDate}
              onChange={(e) => { if (canEdit) handleSaveDate(e.target.value); }}
              className="rounded-none w-56"
              disabled={!canEdit}
            />
          </div>

          {/* Caption */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Caption / Body</label>
            {isEditingCaption && canEdit ? (
              <div className="space-y-2">
                <Textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="rounded-none min-h-[180px] resize-y text-sm leading-relaxed"
                  autoFocus
                  placeholder="Write your caption or body text..."
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="rounded-none" onClick={() => { setIsEditingCaption(false); setEditCaption(piece.bodyText || ""); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveCaption} className="bg-black text-white rounded-none">Save</Button>
                </div>
              </div>
            ) : (
              <div
                className={`min-h-[120px] px-3 py-3 -ml-3 rounded-sm transition-colors border border-transparent whitespace-pre-wrap text-sm leading-relaxed ${canEdit ? "cursor-text hover:bg-secondary/20 hover:border-border" : ""}`}
                onClick={() => { if (canEdit) setIsEditingCaption(true); }}
              >
                {piece.bodyText || <span className="text-muted-foreground italic opacity-60">{canEdit ? "Click to add caption or body text…" : "No caption added"}</span>}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-widest border-t border-border/40 pt-4 flex flex-wrap gap-4">
            <span>Created {format(new Date(piece.createdAt), 'MMM d, yyyy')}</span>
            <span>Updated {format(new Date(piece.updatedAt), 'MMM d, yyyy')}</span>
            {piece.approvedAt && <span className="text-emerald-600">Approved {format(new Date(piece.approvedAt), 'MMM d, yyyy')}</span>}
            <span>{piece.commentCount} {piece.commentCount === 1 ? 'comment' : 'comments'}</span>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 shrink-0 space-y-6">
          {/* Actions */}
          <div className="border border-border bg-card p-5 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actions</h3>

            {piece.status !== 'approved' && canApprove && (
              <Button
                onClick={handleApprove}
                disabled={approvePiece.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-none h-10 font-semibold"
              >
                {approvePiece.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve
              </Button>
            )}
            {piece.status !== 'in_review' && piece.status !== 'approved' && canEdit && (
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate('in_review')}
                className="w-full rounded-none h-10 font-semibold border-border"
              >
                <Clock className="w-4 h-4 mr-2" />
                Submit for Review
              </Button>
            )}
            {piece.status !== 'needs_revision' && piece.status !== 'approved' && canApprove && (
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate('needs_revision')}
                className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 rounded-none h-10 font-semibold"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Needs Revision
              </Button>
            )}
          </div>

          {/* Comments */}
          <div className="border border-border bg-card flex flex-col">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2 bg-secondary/10">
              <MessageSquare className="w-4 h-4" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Comments ({piece.commentCount})</h3>
            </div>

            <div className="p-4 space-y-5 max-h-80 overflow-y-auto">
              {isCommentsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-2">
                      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-10 w-full" /></div>
                    </div>
                  ))}
                </div>
              ) : !comments?.length ? (
                <p className="text-xs text-muted-foreground text-center py-2">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="w-7 h-7 shrink-0 rounded-none border border-border">
                      <AvatarFallback className="text-[10px] font-bold rounded-none bg-secondary">{c.authorName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-bold">{c.authorName}</span>
                        <span className="text-[9px] text-muted-foreground">{format(new Date(c.createdAt), 'MMM d')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-border bg-secondary/10">
              <Form {...commentForm}>
                <form onSubmit={commentForm.handleSubmit(onCommentSubmit)} className="space-y-2">
                  <FormField
                    control={commentForm.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Add a comment..."
                            className="min-h-[60px] resize-none text-xs rounded-none bg-card"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={createComment.isPending} className="bg-black text-white rounded-none text-xs font-semibold">
                      {createComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Post'}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
