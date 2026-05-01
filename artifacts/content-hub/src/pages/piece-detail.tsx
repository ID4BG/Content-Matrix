import { useRoute, Link } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Loader2, CheckCircle2, MessageSquare, Save, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { 
  useGetContentPiece, 
  getGetContentPieceQueryKey,
  useUpdateContentPiece,
  useApproveContentPiece,
  useListComments,
  getListCommentsQueryKey,
  useCreateComment,
  ContentPieceChannel,
  UpdateContentPieceBodyStatus,
  ContentPiece
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge, ChannelIcon, getChannelName } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const commentSchema = z.object({
  text: z.string().min(1, "Comment cannot be empty"),
  authorName: z.string().default("Team Member"),
});

export default function PieceDetail() {
  const [, params] = useRoute("/campaigns/:campaignId/pieces/:pieceId");
  const campaignId = params?.campaignId ? parseInt(params.campaignId, 10) : 0;
  const pieceId = params?.pieceId ? parseInt(params.pieceId, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: piece, isLoading: isPieceLoading } = useGetContentPiece(pieceId, {
    query: { enabled: !!pieceId, queryKey: getGetContentPieceQueryKey(pieceId) }
  });

  const { data: comments, isLoading: isCommentsLoading } = useListComments(
    { contentPieceId: pieceId },
    { query: { enabled: !!pieceId, queryKey: getListCommentsQueryKey({ contentPieceId: pieceId }) } }
  );

  const updatePiece = useUpdateContentPiece();
  const approvePiece = useApproveContentPiece();
  const createComment = useCreateComment();

  // Inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [editBody, setEditBody] = useState("");
  
  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (piece && initializedForId.current !== pieceId) {
      initializedForId.current = pieceId;
      setEditTitle(piece.title);
      setEditBody(piece.bodyText || "");
    }
  }, [piece, pieceId]);

  const commentForm = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      text: "",
      authorName: "Team Member", // Mocked user for now
    },
  });

  const handleSaveTitle = () => {
    if (editTitle.trim() === "") return;
    setIsEditingTitle(false);
    if (editTitle === piece?.title) return;

    updatePiece.mutate(
      { id: pieceId, data: { title: editTitle } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetContentPieceQueryKey(pieceId), updated);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update title", variant: "destructive" });
          setEditTitle(piece?.title || "");
        }
      }
    );
  };

  const handleSaveBody = () => {
    setIsEditingBody(false);
    if (editBody === (piece?.bodyText || "")) return;

    updatePiece.mutate(
      { id: pieceId, data: { bodyText: editBody } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetContentPieceQueryKey(pieceId), updated);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update body", variant: "destructive" });
          setEditBody(piece?.bodyText || "");
        }
      }
    );
  };

  const handleStatusUpdate = (status: UpdateContentPieceBodyStatus) => {
    updatePiece.mutate(
      { id: pieceId, data: { status } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetContentPieceQueryKey(pieceId), updated);
          toast({ title: "Status Updated", description: `Piece marked as ${status.replace('_', ' ')}` });
        }
      }
    );
  };

  const handleApprove = () => {
    approvePiece.mutate(
      { id: pieceId },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetContentPieceQueryKey(pieceId), updated);
          toast({ title: "Piece Approved", description: "This piece is ready for publishing." });
        }
      }
    );
  };

  const onCommentSubmit = (values: z.infer<typeof commentSchema>) => {
    createComment.mutate(
      { data: { contentPieceId: pieceId, ...values } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey({ contentPieceId: pieceId }) });
          queryClient.invalidateQueries({ queryKey: getGetContentPieceQueryKey(pieceId) });
          commentForm.reset({ text: "", authorName: "Team Member" });
        }
      }
    );
  };

  if (isPieceLoading) {
    return (
      <div className="space-y-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-8">
          <div className="flex-1 space-y-8">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="w-80 shrink-0 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!piece) {
    return <div className="text-center py-24">Content piece not found</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/campaigns/${campaignId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group mb-8">
        <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Campaign
      </Link>

      <div className="flex flex-col lg:flex-row gap-12 items-start">
        {/* Main Content Area */}
        <div className="flex-1 w-full space-y-8">
          <div className="flex items-center gap-4 text-muted-foreground border-b border-border pb-4">
            <ChannelIcon channel={piece.channel} className="w-6 h-6 text-foreground" />
            <span className="font-bold uppercase tracking-wider text-sm">{getChannelName(piece.channel)}</span>
            <span className="mx-2 text-border">|</span>
            <StatusBadge status={piece.status} />
          </div>

          <div className="space-y-6">
            <div className="group relative">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">Title</label>
              {isEditingTitle ? (
                <div className="flex items-start gap-2">
                  <Input 
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-2xl font-bold py-6 px-4 bg-secondary/20"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(piece.title); } }}
                  />
                  <Button size="icon" onClick={handleSaveTitle} className="shrink-0 h-12 w-12"><Save className="w-5 h-5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { setIsEditingTitle(false); setEditTitle(piece.title); }} className="shrink-0 h-12 w-12"><XCircle className="w-5 h-5 text-muted-foreground" /></Button>
                </div>
              ) : (
                <div 
                  className="text-2xl md:text-3xl font-bold hover:bg-secondary/30 p-4 -ml-4 rounded-sm cursor-text transition-colors border border-transparent hover:border-border/50"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {piece.title}
                </div>
              )}
            </div>

            <div className="group relative">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">Content Body</label>
              {isEditingBody ? (
                <div className="space-y-3">
                  <Textarea 
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="min-h-[300px] text-lg leading-relaxed resize-y bg-secondary/20 p-6"
                    autoFocus
                    placeholder="Write your content here..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={() => { setIsEditingBody(false); setEditBody(piece.bodyText || ""); }}>Cancel</Button>
                    <Button onClick={handleSaveBody}>Save Content</Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="min-h-[200px] text-lg leading-relaxed hover:bg-secondary/30 p-6 -ml-6 rounded-sm cursor-text transition-colors border border-transparent hover:border-border/50 whitespace-pre-wrap bg-secondary/5"
                  onClick={() => setIsEditingBody(true)}
                >
                  {piece.bodyText || <span className="text-muted-foreground italic text-base">Click to add content...</span>}
                </div>
              )}
            </div>
            
            {/* Media Area Placeholder */}
            <div className="pt-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">Attached Media</label>
              <div className="border border-dashed border-border/80 bg-secondary/5 h-48 rounded-sm flex items-center justify-center flex-col gap-2 cursor-pointer hover:bg-secondary/10 transition-colors">
                <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground">
                  <PlusCircleIcon className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Upload image or video</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-8">
          {/* Actions */}
          <div className="bg-card border border-border p-6 space-y-4 shadow-sm">
            <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">Actions</h3>
            
            {piece.status !== 'approved' && (
              <Button 
                onClick={handleApprove}
                disabled={approvePiece.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-12"
              >
                {approvePiece.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve Piece
              </Button>
            )}
            
            {piece.status !== 'needs_revision' && piece.status !== 'approved' && (
              <Button 
                variant="outline"
                onClick={() => handleStatusUpdate('needs_revision')}
                className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-12"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Request Revision
              </Button>
            )}

            {piece.status === 'needs_revision' && (
              <Button 
                variant="outline"
                onClick={() => handleStatusUpdate('in_review')}
                className="w-full h-12"
              >
                Submit for Review
              </Button>
            )}
          </div>

          {/* Comments */}
          <div className="bg-card border border-border flex flex-col shadow-sm">
            <div className="p-6 border-b border-border flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground">Discussion ({piece.commentCount})</h3>
            </div>
            
            <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto">
              {isCommentsLoading ? (
                <div className="space-y-4">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-12 w-full" /></div>
                    </div>
                  ))}
                </div>
              ) : comments?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Start the conversation!</p>
              ) : (
                <div className="space-y-6">
                  {comments?.map(comment => (
                    <div key={comment.id} className="flex gap-4">
                      <Avatar className="w-8 h-8 border border-border/50">
                        <AvatarFallback className="bg-secondary/50 text-xs font-semibold">{comment.authorName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-semibold">{comment.authorName}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{format(new Date(comment.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-secondary/5">
              <Form {...commentForm}>
                <form onSubmit={commentForm.handleSubmit(onCommentSubmit)} className="space-y-3">
                  <FormField
                    control={commentForm.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder="Add a comment..." 
                            className="min-h-[80px] resize-none text-sm bg-background"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={createComment.isPending} size="sm" className="font-semibold">
                      {createComment.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post Comment'}
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

function PlusCircleIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>;
}
