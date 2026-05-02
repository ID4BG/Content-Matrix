import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Share2, Copy, Check, Loader2, Folder, ExternalLink, FolderKanban } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFolders,
  getListFoldersQueryKey,
  useUpdateFolder,
  useShareFolderLink,
  useListCampaigns,
  getListCampaignsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/channel-icon";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function FolderDetail() {
  const [, params] = useRoute("/folders/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: folders, isLoading: isFoldersLoading } = useListFolders({
    query: { queryKey: getListFoldersQueryKey() },
  });

  const folder = folders?.find((f) => f.id === id);

  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns(
    { folderId: id },
    { query: { enabled: !!id, queryKey: getListCampaignsQueryKey({ folderId: id }) } }
  );

  const updateFolder = useUpdateFolder();
  const shareFolderLink = useShareFolderLink();

  const shareUrl = folder?.shareToken
    ? `${window.location.origin}/shared/folder/${folder.shareToken}`
    : null;

  const handleSaveTitle = () => {
    if (!editTitle.trim()) return;
    setIsEditingTitle(false);
    if (editTitle === folder?.title) return;
    updateFolder.mutate(
      { id, data: { title: editTitle } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() }),
        onError: () => toast({ title: "Error", description: "Failed to update folder", variant: "destructive" }),
      }
    );
  };

  const handleShare = () => {
    shareFolderLink.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
          toast({ title: "Share link generated", description: "Anyone with the link can view this folder." });
        },
        onError: () => toast({ title: "Error", description: "Failed to generate share link", variant: "destructive" }),
      }
    );
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  if (isFoldersLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-64" />
        <div className="grid md:grid-cols-2 gap-6">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold">Folder not found</h2>
        <Link href="/folders" className="text-primary mt-4 inline-block hover:underline">Back to Folders</Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="pb-8 border-b border-border/50">
        <Link href="/folders" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group mb-6">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Folders
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 border border-border flex items-center justify-center">
                <Folder className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Folder</p>
            </div>
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold rounded-none h-12 text-base border-border"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }}
                />
                <Button size="sm" onClick={handleSaveTitle} className="bg-black text-white hover:bg-black/80 rounded-none">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(false)} className="rounded-none">Cancel</Button>
              </div>
            ) : (
              <h1
                className="text-4xl md:text-5xl font-bold tracking-tight cursor-text hover:bg-secondary/30 px-2 py-1 -ml-2 rounded-sm transition-colors"
                onClick={() => { setEditTitle(folder.title); setIsEditingTitle(true); }}
              >
                {folder.title}
              </h1>
            )}
            {folder.description && <p className="text-muted-foreground text-lg">{folder.description}</p>}
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2">
              {folder.campaignCount} {folder.campaignCount === 1 ? 'Campaign' : 'Campaigns'}
            </p>
          </div>

          <div className="space-y-3 shrink-0">
            {shareUrl ? (
              <div className="space-y-2 border border-border p-4 bg-secondary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Share Link</p>
                <div className="flex items-center gap-2">
                  <Input value={shareUrl} readOnly className="text-xs rounded-none w-72 font-mono border-border bg-white" />
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-none shrink-0 border-border"
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="outline" className="rounded-none shrink-0 border-border">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground font-medium mt-2">Anyone with this link can view this folder.</p>
              </div>
            ) : (
              <Button
                onClick={handleShare}
                disabled={shareFolderLink.isPending}
                variant="outline"
                className="gap-2 rounded-none border-border"
              >
                {shareFolderLink.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                Generate Share Link
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Campaigns in this folder</h2>
          <Link href={`/campaigns/new`}>
            <Button variant="outline" size="sm" className="rounded-none gap-2 text-[10px] font-bold uppercase tracking-widest border-border">
              <FolderKanban className="w-3.5 h-3.5" />
              Add Campaign
            </Button>
          </Link>
        </div>

        {isCampaignsLoading ? (
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !campaigns?.length ? (
          <div className="text-center py-16 border border-dashed border-border/80 bg-secondary/5">
            <FolderKanban className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-foreground font-semibold text-sm">No campaigns in this folder yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Create a new campaign and assign it to this folder.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <div className="flex items-center justify-between border border-border bg-white hover:border-black hover:shadow-sm transition-all p-5 group">
                  <div className="space-y-1">
                    <h3 className="font-bold group-hover:underline decoration-2 underline-offset-4">{campaign.title}</h3>
                    {campaign.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{campaign.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest pt-1">
                      {campaign.contentPieceCount} pieces · Created {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <StatusBadge status={campaign.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}