import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, PlusCircle, FolderKanban, Settings, FolderOpen, User,
  Bell, X, CheckCircle2, MessageSquare, Upload, CheckCircle, FolderPlus,
  Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGetRecentActivity, ActivityItem } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, parseISO } from "date-fns";

const LAST_SEEN_KEY = "content-matrix-notif-seen";

function activityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "campaign_created":            return <FolderPlus className="w-3.5 h-3.5 text-blue-600" />;
    case "campaign_approved":           return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case "piece_uploaded":              return <Upload className="w-3.5 h-3.5 text-indigo-500" />;
    case "piece_approved":              return <CheckCircle className="w-3.5 h-3.5 text-blue-500" />;
    case "piece_submitted_for_review":  return <Bell className="w-3.5 h-3.5 text-orange-500" />;
    case "comment_added":               return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
    case "folder_created":              return <FolderOpen className="w-3.5 h-3.5 text-purple-500" />;
    default:                            return <Bell className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function activityLabel(type: ActivityItem["type"]) {
  switch (type) {
    case "campaign_created":            return "Campaign created";
    case "campaign_approved":           return "Campaign approved";
    case "piece_uploaded":              return "Content uploaded";
    case "piece_approved":              return "Content approved";
    case "piece_submitted_for_review":  return "Submitted for review";
    case "comment_added":               return "New comment";
    case "folder_created":              return "Folder created";
    default:                            return "Activity";
  }
}

function activityDotColor(type: ActivityItem["type"]) {
  switch (type) {
    case "campaign_created":            return "bg-blue-500";
    case "campaign_approved":           return "bg-emerald-500";
    case "piece_uploaded":              return "bg-indigo-500";
    case "piece_approved":              return "bg-blue-400";
    case "piece_submitted_for_review":  return "bg-orange-500";
    case "comment_added":               return "bg-amber-500";
    case "folder_created":              return "bg-purple-500";
    default:                            return "bg-muted-foreground";
  }
}

function NotificationPanel({ onClose, onOpen }: { onClose: () => void; onOpen: () => void }) {
  const { data: activity = [], isLoading } = useGetRecentActivity();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="fixed top-0 left-0 md:left-64 bottom-0 z-50 w-full md:w-80 bg-background border-r border-border shadow-xl flex flex-col"
      style={{ maxHeight: "100dvh" }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background">
        <div>
          <h2 className="font-bold text-sm tracking-tight">Activity Feed</h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
            {activity.length} recent events
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-0">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-5 py-4 border-b border-border/50 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-none bg-secondary shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-secondary w-3/4" />
                    <div className="h-2.5 bg-secondary w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Bell className="w-10 h-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-semibold text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Events will appear here as your team works.</p>
          </div>
        ) : (
          <div>
            {activity.map((item, idx) => (
              <div
                key={item.id}
                className={`px-5 py-4 border-b border-border/40 hover:bg-secondary/30 transition-colors ${
                  idx === 0 ? "bg-secondary/10" : ""
                }`}
              >
                <div className="flex gap-3">
                  <div className="w-7 h-7 bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    {activityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-snug">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activityDotColor(item.type)}`} />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                        {item.entityTitle}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-border bg-secondary/10">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          View full dashboard →
        </Link>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { isDark, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [notifOpen, setNotifOpen] = useState(false);

  // ── Unread tracking ──────────────────────────────────────────────────────
  const [lastSeenAt, setLastSeenAt] = useState<Date>(() => {
    try {
      const stored = localStorage.getItem(LAST_SEEN_KEY);
      return stored ? new Date(stored) : new Date(0);
    } catch {
      return new Date(0);
    }
  });

  const markAllSeen = () => {
    const now = new Date();
    setLastSeenAt(now);
    try { localStorage.setItem(LAST_SEEN_KEY, now.toISOString()); } catch {}
  };

  // ── Activity polling (every 30 s) ────────────────────────────────────────
  const { data: activity = [], refetch } = useGetRecentActivity();

  useEffect(() => {
    const id = setInterval(() => { refetch(); }, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  const prevIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!activity.length) return;

    if (!initializedRef.current) {
      activity.forEach(a => prevIdsRef.current.add(a.id));
      initializedRef.current = true;
      return;
    }

    const newItems = activity.filter(a => !prevIdsRef.current.has(a.id));
    newItems.forEach(a => {
      prevIdsRef.current.add(a.id);
      toast({
        title: activityLabel(a.type),
        description: a.description,
        duration: 6000,
      });
    });
  }, [activity, toast]);

  const unreadCount = Math.min(
    activity.filter(a => new Date(a.createdAt) > lastSeenAt).length,
    9
  );

  // ── Nav ──────────────────────────────────────────────────────────────────
  const navItems = [
    { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
    { href: "/campaigns",  label: "Campaigns",  icon: FolderKanban },
    { href: "/folders",    label: "Folders",    icon: FolderOpen },
    { href: "/settings",   label: "Settings",   icon: Settings },
  ];

  const isActive = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background">

      {/* ── Mobile top bar ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-sidebar border-b border-border flex items-center px-3 gap-2">
        <Link href="/dashboard" className="flex-1 flex items-center h-full py-2 outline-none">
          <img
            src={isDark ? "/logo-full.png" : "/logo-light.png"}
            alt="Content Matrix"
            className="h-full w-auto object-contain object-left"
          />
        </Link>

        <button
          onClick={toggleTheme}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setNotifOpen(true)}
          className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Activity feed"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-foreground text-background text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
      </header>

      {/* ── Notification panel ── */}
      {notifOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setNotifOpen(false)}
          />
          <NotificationPanel
            onClose={() => setNotifOpen(false)}
            onOpen={markAllSeen}
          />
        </>
      )}

      <div className="flex min-h-[100dvh]">

        {/* ── Sidebar (desktop only) ── */}
        <aside className="hidden md:flex md:sticky top-0 left-0 z-50 w-64 bg-sidebar border-r border-border flex-col h-[100dvh]">
          {/* Logo row */}
          <div className="overflow-hidden border-b border-border/40 flex items-center" style={{ height: '72px' }}>
            <Link href="/dashboard" className="flex-1 block h-full outline-none">
              <img
                src={isDark ? "/logo-full.png" : "/logo-light.png"}
                alt="Content Matrix"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
              />
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-4 py-4 overflow-y-auto flex flex-col gap-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-3">
              Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-secondary text-secondary-foreground border-l-2 border-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border-l-2 border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-5 flex flex-col gap-3 border-t border-border/50">
            <div className="flex gap-2">
              <Link
                href="/campaigns/new"
                className="flex-1 flex items-center justify-center gap-2 bg-foreground text-background hover:opacity-80 px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                New Campaign
              </Link>
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 h-10 border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setNotifOpen(true)}
                className={`relative flex items-center justify-center w-10 h-10 border transition-colors ${
                  notifOpen
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Activity feed"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && !notifOpen && (
                  <span className="absolute -top-1 -right-1 bg-foreground text-background text-[9px] font-bold w-4 h-4 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            <p className="text-[9px] text-muted-foreground/50 font-medium tracking-widest uppercase text-center pb-1">
              Made by <span className="text-muted-foreground/70">Arnela</span>, for Marketers — with love
            </p>

            <Link href="/settings" className="flex items-center gap-3 group py-1">
              <Avatar className="w-8 h-8 border border-border rounded-none">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-secondary text-xs rounded-none"><User className="w-4 h-4" /></AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold truncate">{user?.firstName || 'User'}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.emailAddresses[0]?.emailAddress}</span>
              </div>
            </Link>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 w-full min-w-0 max-w-full pt-12 md:pt-0 pb-16 md:pb-0">
          <div className="p-4 sm:p-6 md:p-10 lg:p-14 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>

      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-sidebar border-t border-border flex items-stretch" style={{ height: '56px' }}>
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            isActive("/dashboard") ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </Link>

        {/* Campaigns */}
        <Link
          href="/campaigns"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            isActive("/campaigns") ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <FolderKanban className="w-5 h-5" />
          <span>Campaigns</span>
        </Link>

        {/* New Campaign — center action */}
        <Link
          href="/campaigns/new"
          className="flex-1 flex flex-col items-center justify-center gap-0.5"
        >
          <div className="w-10 h-10 bg-foreground text-background flex items-center justify-center">
            <PlusCircle className="w-5 h-5" />
          </div>
        </Link>

        {/* Folders */}
        <Link
          href="/folders"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            isActive("/folders") ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <FolderOpen className="w-5 h-5" />
          <span>Folders</span>
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
            isActive("/settings") ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </Link>
      </nav>

    </div>
  );
}
