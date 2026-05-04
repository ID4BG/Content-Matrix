import { useRoute, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft, Loader2, CheckCircle2, Trash2, Clock, Plus, Edit2, CheckCircle,
  Settings2, UserPlus, X, ChevronRight, FolderOpen, Crown, Briefcase, User, CalendarDays, KanbanSquare, Share2, Copy, Check,
  ChevronDown, FolderPlus, FolderMinus,
} from "lucide-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useGetCampaign, getGetCampaignQueryKey,
  useListContentPieces, getListContentPiecesQueryKey,
  useListFolders,
  useApproveCampaign, useDisapproveCampaign, useDeleteCampaign, getListCampaignsQueryKey,
  useUpdateCampaign, useUpdateCampaignChannels, useShareCampaignLink,
  useUpdateCampaignMember, useDeleteCampaignMember,
  ContentPieceChannel,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge, ChannelIcon, getChannelName } from "@/components/channel-icon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";

const ALL_CHANNELS: ContentPieceChannel[] = [
  "source_article", "instagram_reel", "tiktok_post", "x_post", "linkedin_post", "youtube_long",
  "youtube_short", "facebook_carousel", "facebook_group_post", "reddit_post", "threads_post",
];

type MemberRole = "owner" | "marketer" | "team_member";

interface CampaignMember {
  id: number;
  campaignId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: MemberRole;
  permissions: string[];
  accepted: boolean;
  invitedAt: string;
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  marketer: "Marketer",
  team_member: "Team Member",
};

const ALL_PERMISSIONS = [
  { key: "view",    label: "View content" },
  { key: "comment", label: "Leave comments" },
  { key: "create",  label: "Create content pieces" },
  { key: "edit",    label: "Edit content pieces" },
  { key: "approve", label: "Approve / disapprove pieces" },
  { key: "invite",  label: "Invite team members" },
];

const DEFAULT_PERMISSIONS: Record<MemberRole, string[]> = {
  owner:       ["view", "comment", "create", "edit", "approve", "invite"],
  marketer:    ["view", "comment", "create", "edit"],
  team_member: ["view", "comment"],
};

function memberDisplayName(m: CampaignMember) {
  const name = `${m.firstName} ${m.lastName}`.trim();
  return name || m.email;
}

function RoleIcon({ role }: { role: MemberRole }) {
  if (role === "owner") return <Crown className="w-3 h-3 text-amber-600" />;
  if (role === "marketer") return <Briefcase className="w-3 h-3 text-blue-600" />;
  return <User className="w-3 h-3 text-muted-foreground" />;
}

function useCampaignMembers(campaignId: number) {
  return useQuery<CampaignMember[]>({
    queryKey: ["campaign-members", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
    enabled: !!campaignId,
  });
}

function useInviteMember(campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; firstName: string; lastName: string; role: MemberRole; permissions: string[] }) => {
      const res = await fetch(`/api/campaigns/${campaignId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to invite member");
      return res.json() as Promise<CampaignMember>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-members", campaignId] }),
  });
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
  const { data: folders } = useListFolders();
  const { data: members, isLoading: isMembersLoading } = useCampaignMembers(id);
  const inviteMember = useInviteMember(id);
  const updateMember = useUpdateCampaignMember({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign-members", id] }),
    },
  });
  const deleteMember = useDeleteCampaignMember({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign-members", id] }),
    },
  });

  const approveCampaign = useApproveCampaign();
  const disapproveCampaign = useDisapproveCampaign();
  const deleteCampaign = useDeleteCampaign();
  const updateCampaign = useUpdateCampaign();
  const updateChannels = useUpdateCampaignChannels();
  const shareCampaign = useShareCampaignLink();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("team_member");
  const [invitePermissions, setInvitePermissions] = useState<string[]>(DEFAULT_PERMISSIONS.team_member);

  const [copied, setCopied] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const folderPickerRef = useRef<HTMLDivElement>(null);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CampaignMember | null>(null);
  const [editMemberFirstName, setEditMemberFirstName] = useState("");
  const [editMemberLastName, setEditMemberLastName] = useState("");
  const [editMemberRole, setEditMemberRole] = useState<MemberRole>("team_member");
  const [editMemberPermissions, setEditMemberPermissions] = useState<string[]>([]);

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (campaign && initializedForId.current !== id) {
      initializedForId.current = id;
      setEditTitle(campaign.title);
      setEditDescription(campaign.description || "");
      setSelectedChannels(campaign.channels || []);
    }
  }, [campaign, id]);

  const handleMoveToFolder = (folderId: number | null) => {
    setFolderPickerOpen(false);
    updateCampaign.mutate(
      { id, data: { folderId } },
      { onSuccess: (u) => queryClient.setQueryData(getGetCampaignQueryKey(id), u) }
    );
  };

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setFolderPickerOpen(false);
      }
    }
    if (folderPickerOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [folderPickerOpen]);

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    if (!editTitle.trim() || editTitle === campaign?.title) return;
    updateCampaign.mutate({ id, data: { title: editTitle } }, {
      onSuccess: (u) => queryClient.setQueryData(getGetCampaignQueryKey(id), u),
    });
  };

  const handleSaveDescription = () => {
    setIsEditingDescription(false);
    if (editDescription === (campaign?.description || "")) return;
    updateCampaign.mutate({ id, data: { description: editDescription } }, {
      onSuccess: (u) => queryClient.setQueryData(getGetCampaignQueryKey(id), u),
    });
  };

  const handleSaveChannels = () => {
    if (!selectedChannels.length) { toast({ title: "Select at least one channel", variant: "destructive" }); return; }
    updateChannels.mutate({ id, data: { channels: selectedChannels as any } }, {
      onSuccess: (u) => { queryClient.setQueryData(getGetCampaignQueryKey(id), u); setIsChannelsModalOpen(false); },
    });
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

  const handleDisapprove = () => {
    disapproveCampaign.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        toast({ title: "Approval revoked", description: "Campaign moved back to Draft." });
      },
    });
  };

  const startEditMember = (member: CampaignMember) => {
    setEditingMember(member);
    setEditMemberFirstName(member.firstName);
    setEditMemberLastName(member.lastName);
    setEditMemberRole(member.role);
    setEditMemberPermissions([...(member.permissions ?? [])]);
    setEditMemberOpen(true);
  };

  const handleSaveMember = () => {
    if (!editingMember) return;
    updateMember.mutate({
      id,
      memberId: editingMember.id,
      data: {
        firstName: editMemberFirstName.trim(),
        lastName: editMemberLastName.trim(),
        role: editMemberRole,
        permissions: editMemberPermissions,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Member updated" });
        setEditMemberOpen(false);
        setEditingMember(null);
      },
      onError: () => toast({ title: "Failed to update member", variant: "destructive" }),
    });
  };

  const toggleEditPermission = (key: string) => {
    setEditMemberPermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleDelete = () => {
    deleteCampaign.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        setLocation("/dashboard");
      },
    });
  };

  const handleRoleChange = (role: MemberRole) => {
    setInviteRole(role);
    setInvitePermissions(DEFAULT_PERMISSIONS[role]);
  };

  const togglePermission = (key: string) => {
    setInvitePermissions(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteFirstName.trim() || !inviteLastName.trim()) return;
    inviteMember.mutate({
      email: inviteEmail.trim(),
      firstName: inviteFirstName.trim(),
      lastName: inviteLastName.trim(),
      role: inviteRole,
      permissions: invitePermissions,
    }, {
      onSuccess: () => {
        toast({ title: "Member added", description: `${inviteFirstName} ${inviteLastName} added as ${ROLE_LABELS[inviteRole]}` });
        setIsInviteOpen(false);
        setInviteEmail(""); setInviteFirstName(""); setInviteLastName("");
        setInviteRole("team_member");
        setInvitePermissions(DEFAULT_PERMISSIONS.team_member);
      },
      onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
    });
  };

  if (isCampaignLoading) {
    return (
      <div className="space-y-10">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-40" />)}
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
  const folder = folders?.find(f => f.id === campaign.folderId);

  const piecesByChannel = new Map<string, { count: number; allApproved: boolean; hasContent: boolean }>();
  for (const ch of activeChannels) piecesByChannel.set(ch, { count: 0, allApproved: true, hasContent: false });
  for (const p of pieces || []) {
    const existing = piecesByChannel.get(p.channel) ?? { count: 0, allApproved: true, hasContent: false };
    existing.count += 1;
    existing.hasContent = true;
    if (p.status !== "approved") existing.allApproved = false;
    piecesByChannel.set(p.channel, existing);
  }

  const owners = members?.filter(m => m.role === "owner") ?? [];
  const marketers = members?.filter(m => m.role === "marketer") ?? [];
  const teamMembers = members?.filter(m => m.role === "team_member") ?? [];

  const folderLabel = folder
    ? (folder.parentFolderName || folder.title)
    : null;

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="pb-8 border-b border-border/40 space-y-6">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1 space-y-3">
            {isEditingTitle ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold rounded-none h-14"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitle(campaign.title); } }}
                onBlur={handleSaveTitle}
              />
            ) : (
              <h1
                className="text-4xl font-bold tracking-tight cursor-text hover:bg-secondary/30 px-2 py-1 -ml-2 rounded-sm transition-colors group inline-flex items-center gap-2"
                onClick={() => setIsEditingTitle(true)}
              >
                {campaign.title}
                <Edit2 className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}

            {isEditingDescription ? (
              <div className="flex gap-2 items-start max-w-2xl">
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="rounded-none text-sm"
                  autoFocus rows={2}
                  onBlur={handleSaveDescription}
                />
                <Button size="sm" onClick={handleSaveDescription} className="bg-black text-white rounded-none shrink-0">Save</Button>
              </div>
            ) : (
              <p
                className="text-muted-foreground cursor-text hover:bg-secondary/20 px-2 py-1 -ml-2 rounded-sm transition-colors min-h-[1.5rem] max-w-2xl group inline-flex items-start gap-1"
                onClick={() => setIsEditingDescription(true)}
              >
                {campaign.description || <span className="italic opacity-50 text-sm">Add a description…</span>}
                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-1">
              <StatusBadge status={campaign.status} />
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {format(new Date(campaign.createdAt), 'MMM d, yyyy')}
              </span>
              {campaign.approvedAt && (
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  Approved {format(new Date(campaign.approvedAt), 'MMM d')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Share button */}
            <Button
              variant="outline"
              size="sm"
              disabled={shareCampaign.isPending}
              onClick={() => {
                const existingToken = campaign?.shareToken;
                if (existingToken) {
                  const url = `${window.location.origin}/shared/campaign/${existingToken}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast({ title: "Link copied!", description: "Share link copied to clipboard." });
                  });
                } else {
                  shareCampaign.mutate({ id }, {
                    onSuccess: (data) => {
                      queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(id) });
                      const url = `${window.location.origin}/shared/campaign/${data.shareToken}`;
                      navigator.clipboard.writeText(url).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                      toast({ title: "Share link created!", description: "Link copied to clipboard. Anyone with it can view approved pieces." });
                    },
                    onError: () => toast({ title: "Failed to generate share link", variant: "destructive" }),
                  });
                }
              }}
              className="rounded-none gap-1.5 text-xs font-semibold uppercase tracking-wider"
            >
              {shareCampaign.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : campaign?.shareToken ? (
                <Copy className="w-3.5 h-3.5" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied!" : campaign?.shareToken ? "Copy Link" : "Share"}
            </Button>
            <Link
              href={`/campaigns/${id}/pipeline`}
              className="inline-flex items-center gap-1.5 border border-border bg-card hover:bg-secondary/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              <KanbanSquare className="w-3.5 h-3.5" />
              Pipeline
            </Link>
            <Link
              href={`/campaigns/${id}/calendar`}
              className="inline-flex items-center gap-1.5 border border-border bg-card hover:bg-secondary/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </Link>
            <Button variant="outline" size="sm" onClick={() => setIsInviteOpen(true)} className="rounded-none gap-1.5 text-xs font-semibold uppercase tracking-wider">
              <UserPlus className="w-3.5 h-3.5" />
              Add Member
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsChannelsModalOpen(true)} className="rounded-none gap-1.5 text-xs font-semibold uppercase tracking-wider">
              <Settings2 className="w-3.5 h-3.5" />
              Channels
            </Button>
            {campaign.status === 'approved' ? (
              <Button size="sm" onClick={handleDisapprove} disabled={disapproveCampaign.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-none text-xs font-semibold uppercase tracking-wider gap-1.5">
                {disapproveCampaign.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Disapprove
              </Button>
            ) : campaign.status !== 'published' && (
              <Button size="sm" onClick={handleApprove} disabled={approveCampaign.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-none text-xs font-semibold uppercase tracking-wider gap-1.5">
                {approveCampaign.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-none text-muted-foreground hover:text-destructive">
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

      {/* Info Bar — Folder + Team */}
      <div className="border border-border/60 bg-secondary/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
        <div className="p-4 space-y-1 relative" ref={folderPickerRef}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" /> Folder
          </p>
          <button
            onClick={() => setFolderPickerOpen(o => !o)}
            className="flex items-center gap-1.5 group text-left w-full"
          >
            {updateCampaign.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            ) : folderLabel ? (
              <span className="font-semibold text-sm group-hover:underline underline-offset-2 truncate">{folderLabel}</span>
            ) : (
              <span className="text-sm text-muted-foreground italic group-hover:text-foreground transition-colors">
                Add to folder…
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
          </button>

          {folderPickerOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-popover border border-border shadow-md">
              <div className="p-1.5 border-b border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1">
                  Move to folder
                </p>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {!folders?.length ? (
                  <p className="text-xs text-muted-foreground px-3 py-3 italic">No folders yet</p>
                ) : folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleMoveToFolder(f.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left ${campaign.folderId === f.id ? "font-semibold" : ""}`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.parentFolderName || f.title}</span>
                    {campaign.folderId === f.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-foreground" />}
                  </button>
                ))}
              </div>
              {campaign.folderId != null && (
                <div className="border-t border-border p-1">
                  <button
                    onClick={() => handleMoveToFolder(null)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <FolderMinus className="w-3.5 h-3.5 shrink-0" />
                    Remove from folder
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 flex items-center gap-1.5">
            <Crown className="w-3 h-3" /> Owners
          </p>
          {isMembersLoading ? <Skeleton className="h-4 w-24" /> : owners.length ? (
            <div className="space-y-0.5">
              {owners.map(m => <p key={m.id} className="text-sm font-medium truncate">{memberDisplayName(m)}</p>)}
            </div>
          ) : <p className="text-sm text-muted-foreground italic">None assigned</p>}
        </div>

        <div className="p-4 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 flex items-center gap-1.5">
            <Briefcase className="w-3 h-3" /> Marketers
          </p>
          {isMembersLoading ? <Skeleton className="h-4 w-24" /> : marketers.length ? (
            <div className="space-y-0.5">
              {marketers.map(m => <p key={m.id} className="text-sm font-medium truncate">{memberDisplayName(m)}</p>)}
            </div>
          ) : <p className="text-sm text-muted-foreground italic">None assigned</p>}
        </div>

        <div className="p-4 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <User className="w-3 h-3" /> Team Members
          </p>
          {isMembersLoading ? <Skeleton className="h-4 w-24" /> : teamMembers.length ? (
            <div className="space-y-0.5">
              {teamMembers.map(m => <p key={m.id} className="text-sm font-medium truncate">{memberDisplayName(m)}</p>)}
            </div>
          ) : <p className="text-sm text-muted-foreground italic">None assigned</p>}
        </div>
      </div>

      {/* Channel Overview Cards */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Channels — {activeChannels.length} active · {pieces?.length ?? 0} pieces total
        </h2>

        {activeChannels.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/60">
            <p className="text-muted-foreground mb-4">No channels selected for this campaign.</p>
            <Button onClick={() => setIsChannelsModalOpen(true)} className="bg-black text-white rounded-none">Select Channels</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeChannels.map(channel => {
              const stats = piecesByChannel.get(channel) ?? { count: 0, allApproved: true, hasContent: false };
              const statusLabel = !stats.hasContent ? "No content yet" : stats.allApproved ? "All approved" : "Awaiting approval";
              const statusColor = !stats.hasContent
                ? "text-muted-foreground border-border"
                : stats.allApproved
                ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                : "text-amber-700 border-amber-200 bg-amber-50";

              return (
                <Link key={channel} href={`/campaigns/${id}/channels/${channel}`}>
                  <div className="group border border-border hover:border-foreground/60 transition-all duration-200 bg-card p-5 flex flex-col gap-4 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border border-border flex items-center justify-center group-hover:border-black transition-colors">
                          <ChannelIcon channel={channel as any} className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm">{getChannelName(channel as any)}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-black group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{stats.count}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {stats.count === 1 ? "piece" : "pieces"}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 border ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="h-1 bg-secondary/30 w-full">
                      {stats.hasContent && (
                        <div
                          className={`h-1 transition-all ${stats.allApproved ? "bg-emerald-500" : "bg-amber-400"}`}
                          style={{
                            width: `${stats.count > 0
                              ? ((pieces?.filter(p => p.channel === channel && p.status === "approved").length ?? 0) / stats.count) * 100
                              : 0}%`
                          }}
                        />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}

            <button
              onClick={() => setIsChannelsModalOpen(true)}
              className="border border-dashed border-border/60 hover:border-foreground/60 transition-colors bg-card p-5 flex items-center justify-center gap-3 text-muted-foreground hover:text-black group"
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-semibold">Add Channel</span>
            </button>
          </div>
        )}
      </div>

      {/* Members Management — always visible */}
      <div className="border border-border/60 bg-card">
        <div className="px-5 py-3 border-b border-border/40 bg-secondary/5 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest">
            Campaign Team {members && members.length > 0 ? `(${members.length})` : ""}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setIsInviteOpen(true)} className="gap-1.5 text-xs rounded-none">
            <UserPlus className="w-3.5 h-3.5" />
            Add Member
          </Button>
        </div>

        {isMembersLoading ? (
          <div className="divide-y divide-border/30">
            {[1,2].map(i => <div key={i} className="px-5 py-4"><Skeleton className="h-10 w-full" /></div>)}
          </div>
        ) : !members || members.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <User className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No team members yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Add owners, marketers, and team members to collaborate.</p>
            <Button size="sm" variant="outline" onClick={() => setIsInviteOpen(true)} className="mt-4 rounded-none gap-1.5 text-xs">
              <UserPlus className="w-3.5 h-3.5" />
              Add First Member
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {members.map(member => (
              <div key={member.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-secondary flex items-center justify-center shrink-0">
                    <RoleIcon role={member.role} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{memberDisplayName(member)}</p>
                      {!member.accepted && (
                        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {ROLE_LABELS[member.role]}
                      </span>
                      {(member.permissions ?? []).length > 0 && (
                        <>
                          <span className="text-muted-foreground/30 text-[10px]">·</span>
                          <span className="text-[10px] text-muted-foreground/60 truncate max-w-[200px]">
                            {(member.permissions ?? []).join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-none h-8 text-xs gap-1.5 font-semibold"
                    onClick={() => startEditMember(member)}
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="rounded-none h-8 px-2 text-muted-foreground hover:text-destructive hover:border-destructive/50">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {memberDisplayName(member)}?</AlertDialogTitle>
                        <AlertDialogDescription>This will remove them from the campaign team.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMember.mutate({ id, memberId: member.id })} className="bg-destructive text-white">Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                onClick={() => setSelectedChannels(prev =>
                  prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
                )}
              >
                <Checkbox
                  checked={selectedChannels.includes(ch)}
                  className="rounded-none"
                  onClick={e => e.stopPropagation()}
                  onCheckedChange={checked => setSelectedChannels(prev =>
                    checked ? [...prev, ch] : prev.filter(c => c !== ch)
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

      {/* Add Member Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="rounded-none sm:rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Enter their name and email, choose a role, then customize their permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
                <Input
                  value={inviteFirstName}
                  onChange={e => setInviteFirstName(e.target.value)}
                  className="rounded-none"
                  placeholder="Jane"
                  autoFocus
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

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Address</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="rounded-none"
                placeholder="jane@company.com"
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</label>
              <Select value={inviteRole} onValueChange={v => handleRoleChange(v as MemberRole)}>
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

            {/* Custom permissions */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Permissions</label>
              <div className="border border-border/60 divide-y divide-border/40">
                {ALL_PERMISSIONS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/10 transition-colors"
                    onClick={() => togglePermission(key)}
                  >
                    <Checkbox
                      checked={invitePermissions.includes(key)}
                      className="rounded-none"
                      onClick={e => e.stopPropagation()}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={handleInvite}
              disabled={inviteMember.isPending || !inviteEmail.trim() || !inviteFirstName.trim() || !inviteLastName.trim()}
              className="bg-black text-white rounded-none"
            >
              {inviteMember.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Edit Member Dialog */}
      <Dialog open={editMemberOpen} onOpenChange={(o) => { setEditMemberOpen(o); if (!o) setEditingMember(null); }}>
        <DialogContent className="rounded-none sm:rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              {editingMember ? `Editing ${memberDisplayName(editingMember)} — ${editingMember.email}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
                <Input
                  value={editMemberFirstName}
                  onChange={e => setEditMemberFirstName(e.target.value)}
                  className="rounded-none"
                  placeholder="Jane"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
                <Input
                  value={editMemberLastName}
                  onChange={e => setEditMemberLastName(e.target.value)}
                  className="rounded-none"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</label>
              <Select
                value={editMemberRole}
                onValueChange={(r) => {
                  setEditMemberRole(r as MemberRole);
                  setEditMemberPermissions(DEFAULT_PERMISSIONS[r as MemberRole]);
                }}
              >
                <SelectTrigger className="rounded-none w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="marketer">Marketer</SelectItem>
                  <SelectItem value="team_member">Team Member</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/60">Changing the role resets permissions to the role default.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Permissions</label>
              <div className="border border-border/60 divide-y divide-border/40">
                {ALL_PERMISSIONS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/10 transition-colors"
                    onClick={() => toggleEditPermission(key)}
                  >
                    <Checkbox
                      checked={editMemberPermissions.includes(key)}
                      className="rounded-none"
                      onClick={e => e.stopPropagation()}
                      onCheckedChange={() => toggleEditPermission(key)}
                    />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditMemberOpen(false); setEditingMember(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveMember}
              disabled={updateMember.isPending}
              className="bg-black text-white rounded-none gap-1.5"
            >
              {updateMember.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
