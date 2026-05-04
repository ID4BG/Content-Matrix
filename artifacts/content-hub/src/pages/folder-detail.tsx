import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Share2, Copy, Check, Loader2, Folder, ExternalLink, FolderKanban, Users, Mail, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFolders,
  getListFoldersQueryKey,
  useUpdateFolder,
  useShareFolderLink,
  useListCampaigns,
  getListCampaignsQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/channel-icon";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CampaignMember {
  id: number;
  campaignId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

function memberDisplayName(m: CampaignMember) {
  const name = `${m.firstName} ${m.lastName}`.trim();
  return name || m.email;
}

function useCampaignMembers(campaignIds: number[]) {
  return useQuery<CampaignMember[]>({
    queryKey: ["folder-members", ...campaignIds],
    queryFn: async () => {
      const results = await Promise.all(
        campaignIds.map(id => fetch(`/api/campaigns/${id}/members`).then(r => r.json()))
      );
      const all: CampaignMember[] = results.flat();
      const seen = new Set<string>();
      return all.filter(m => {
        if (seen.has(m.email)) return false;
        seen.add(m.email);
        return true;
      });
    },
    enabled: campaignIds.length > 0,
  });
}

export default function FolderDetail() {
  const [, params] = useRoute("/folders/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  const { data: folders, isLoading: isFoldersLoading } = useListFolders({
    query: { queryKey: getListFoldersQueryKey() },
  });

  const folder = folders?.find((f) => f.id === id);

  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns(
    { folderId: id },
    { query: { enabled: !!id, queryKey: getListCampaignsQueryKey({ folderId: id }) } }
  );

  const campaignIds = campaigns?.map(c => c.id) ?? [];
  const { data: members } = useCampaignMembers(campaignIds);

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

  const handleCopyForMember = async (memberId: string) => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedMemberId(memberId);
    setTimeout(() => setCopiedMemberId(null), 2000);
    toast({ title: "Link copied", description: "Share this view-only link with the team member." });
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
        </div>
      </header>

      {/* Sharing Section */}
      <div className="space-y-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5" />
          Sharing
        </h2>

        {/* External view-only link */}
        <div className="border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-border flex items-center justify-center shrink-0">
              <Lock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm">External View-Only Link</p>
              <p className="text-xs text-muted-foreground mt-0.5">Anyone with this link can view this folder — no editing permissions.</p>
            </div>
          </div>

          {shareUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="text-xs rounded-none font-mono border-border bg-secondary/5 flex-1" />
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
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                <Check className="w-3 h-3" />
                Link active
              </p>
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

        {/* Share with team members */}
        <div className="border border-border bg-card">
          <div className="px-5 py-4 border-b border-border/40 bg-secondary/5 flex items-center gap-3">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <div>
              <p className="font-bold text-[10px] uppercase tracking-widest">Share with Campaign Members</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Copy the view-only link to share with specific members from campaigns in this folder.
              </p>
            </div>
          </div>

          {!shareUrl ? (
            <div className="px-5 py-8 text-center">
              <Lock className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Generate a share link first</p>
              <p className="text-xs text-muted-foreground/70 mt-1">You need a view-only link before you can share it with members.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                disabled={shareFolderLink.isPending}
                className="mt-4 rounded-none gap-1.5 text-xs"
              >
                {shareFolderLink.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                Generate Link
              </Button>
            </div>
          ) : members && members.length > 0 ? (
            <div className="divide-y divide-border/30">
              {members.map(member => (
                <div key={member.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 bg-secondary/30 border border-border/40 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold uppercase">
                        {(member.firstName || member.email).charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{memberDisplayName(member)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Mail className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 border border-border/40 px-1.5 py-0.5 shrink-0">
                          {member.role.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none gap-1.5 text-xs h-7 border-border shrink-0"
                    onClick={() => handleCopyForMember(String(member.id))}
                  >
                    {copiedMemberId === String(member.id)
                      ? <><Check className="w-3 h-3 text-emerald-600" /> Copied</>
                      : <><Copy className="w-3 h-3" /> Copy Link</>}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No team members found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Add members to campaigns in this folder to share with them here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Campaigns */}
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
                <div className="flex items-center justify-between border border-border bg-card hover:border-black hover:shadow-sm transition-all p-5 group">
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
