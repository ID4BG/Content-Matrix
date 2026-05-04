import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, PlusCircle, FolderKanban, Settings, FolderOpen, User,
  Bell, X, CheckCircle2, MessageSquare, Upload, CheckCircle, FolderPlus, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGetRecentActivity, ActivityItem } from "@workspace/api-client-react";
import { formatDistanceToNow, parseISO } from "date-fns";

function activityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "campaign_created":   return <FolderPlus className="w-3.5 h-3.5 text-blue-600" />;
    case "campaign_approved":  return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case "piece_uploaded":     return <Upload className="w-3.5 h-3.5 text-indigo-500" />;
    case "piece_approved":     return <CheckCircle className="w-3.5 h-3.5 text-blue-500" />;
    case "comment_added":      return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
    case "folder_created":     return <FolderOpen className="w-3.5 h-3.5 text-purple-500" />;
    default:                   return <Bell className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function activityDotColor(type: ActivityItem["type"]) {
  switch (type) {
    case "campaign_created":  return "bg-blue-500";
    case "campaign_approved": return "bg-emerald-500";
    case "piece_uploaded":    return "bg-indigo-500";
    case "piece_approved":    return "bg-blue-400";
    case "comment_added":     return "bg-amber-500";
    case "folder_created":    return "bg-purple-500";
    default:                  return "bg-muted-foreground";
  }
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data: activity = [], isLoading } = useGetRecentActivity();
  const panelRef = useRef<HTMLDivElement>(null);

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
      className="fixed top-0 left-0 md:left-64 bottom-0 z-50 w-80 bg-background border-r border-border shadow-xl flex flex-col"
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
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${activityDotColor(item.type)}`}
                      />
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
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: activity = [] } = useGetRecentActivity();
  const unreadCount = Math.min(activity.length, 9);

  const navItems = [
    { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
    { href: "/campaigns",  label: "Campaigns",  icon: FolderKanban },
    { href: "/folders",    label: "Folders",    icon: FolderOpen },
    { href: "/settings",   label: "Settings",   icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      {/* Notification panel overlay */}
      {notifOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/10 md:hidden"
            onClick={() => setNotifOpen(false)}
          />
          <NotificationPanel onClose={() => setNotifOpen(false)} />
        </>
      )}

      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-sidebar shrink-0 flex flex-col h-auto md:h-[100dvh] md:sticky md:top-0">
        {/* Logo — swap based on theme */}
        <div className="overflow-hidden border-b border-border/40" style={{ height: '72px' }}>
          <Link href="/dashboard" className="block w-full h-full outline-none">
            <img
              src={isDark ? "/logo-full.png" : "/logo-light.png"}
              alt="Content Matrix"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
            />
          </Link>
        </div>

        <nav className="flex-1 px-4 pb-4 overflow-x-auto md:overflow-visible flex md:flex-col gap-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-4 hidden md:block mt-4">
            Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-secondary text-secondary-foreground border-l-2 border-black"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border-l-2 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-5 hidden md:flex flex-col gap-3 border-t border-border/50">
          {/* New Campaign + Notifications + Theme row */}
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
              onClick={() => setNotifOpen(o => !o)}
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

          {/* Attribution */}
          <p className="text-[9px] text-muted-foreground/50 font-medium tracking-widest uppercase text-center pb-1">
            Made by <span className="text-muted-foreground/70">Arnela</span>, for Marketers — with love
          </p>

          {/* User row */}
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

      <main className="flex-1 w-full min-w-0 max-w-full">
        <div className="p-6 md:p-12 lg:p-16 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
