import { useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft, Share2, Copy, Check, Loader2, Folder, ExternalLink,
  FolderKanban, Users, Mail, Lock, UserPlus, Send,
} from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface CampaignMember {
  id: number;
  campaignId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  accepted: boolean;
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

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState("team_member");

  const { data: folders, isLoading: isFoldersLoading } = useListFolders({
    query: { queryKey: getListFoldersQueryKey() },
  });

  const folder = folders?.find((f) => f.id === id);

  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns(
    { folderId: id },
    { query: { enabled: !!id, queryKey: getListCampaignsQueryKey({ folderId: id }) } }
  );

  const campaignIds = campaigns?.map(c => c.id) ?? [];
  const { data: members, refetch: refetchMembers } = useCampaignMembers(campaignIds);

  const updateFolder = useUpdateFolder();
  const shareFolderLink = useShareFolderLink();

  const inviteToFolder = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string; role: string }) => {
      const res = await fetch(`/api/folders/${id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send invite");
      }
      return res.json() as Promise<{ invited: number; total: number; alreadyMember: number }>;
    },
    onSuccess: (result) => {
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteRole("team_member");
      refetchMembers();
      if (result.invited === 0) {
        toast({ title: "Already a member", description: "This person is already invited to all campaigns in this folder." });
      } else {
        toast({
          title: `Invited to ${result.invited} campaign${result.invited !== 1 ? "s" : ""}`,
          description: "They'll receive an email with a link to sign in and join.",
        });
      }
    },
    onError: (err: Error) => toast({ title: "Invite failed", description: err.message, variant: "destructive" }),
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteToFolder.mutate({
      email: inviteEmail.trim(),
      firstName: inviteFirstName.trim(),
      lastName: inviteLastName.trim(),
      role: inviteRole,
    });
  };

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

      {/* Invite to Folder */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5" />
          Invite to Folder
        </h2>

        <div className="border border-border bg-card p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Invite someone to all campaigns in this folder. They'll receive an email and see the campaigns after signing in.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
              <Input
                value={inviteFirstName}
                onChange={e => setInviteFirstName(e.target.value)}
                className="rounded-none"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
              <Input
                value={inviteLastName}
                onChange={e => setInviteLastName(e.target.value)}
                className="rounded-none"
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email *</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="rounded-none"
                placeholder="jane@company.com"
                onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="rounded-none w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="marketer">Marketer</SelectItem>
                  <SelectItem value="team_member">Team Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleInvite}
            disabled={!inviteEmail.trim() || inviteToFolder.isPending || campaigns?.length === 0}
            className="bg-black text-white rounded-none gap-2 text-xs font-bold uppercase tracking-wider"
          >
            {inviteToFolder.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
            {inviteToFolder.isPending ? "Sending…" : `Invite to All ${campaigns?.length ?? 0} Campaign${campaigns?.length !== 1 ? "s" : ""}`}
          </Button>

          {campaigns?.length === 0 && (
            <p className="text-xs text-amber-600 font-medium">Add campaigns to this folder first before inviting members.</p>
          )}
        </div>

        {/* Current members list */}
        {members && members.length > 0 && (
          <div className="border border-border bg-card">
            <div className="px-5 py-3 border-b border-border/40 bg-secondary/5">
              <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Current Members</p>
            </div>
            <div className="divide-y divide-border/30">
              {members.map(member => (
                <div key={member.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 bg-secondary/30 border border-border/40 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold uppercase">
                      {(member.firstName || member.email).charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{memberDisplayName(member)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Mail className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                      <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 border border-border/40 px-1.5 py-0.5 shrink-0">
                        {member.role.replace("_", " ")}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 shrink-0 ${
                        member.accepted
                          ? "text-emerald-700 border border-emerald-200 bg-emerald-50"
                          : "text-amber-700 border border-amber-200 bg-amber-50"
                      }`}>
                        {member.accepted ? "Accepted" : "Pending"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sharing Section */}
      <div className="space-y-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Share2 className="w-3.5 h-3.5" />
          View-Only Link
        </h2>

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
