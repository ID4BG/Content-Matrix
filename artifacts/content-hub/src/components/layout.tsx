import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlusCircle, FolderKanban, Settings, FolderOpen, User } from "lucide-react";
import { useUser } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/campaigns", label: "Campaigns", icon: FolderKanban },
    { href: "/folders", label: "Folders", icon: FolderOpen },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-white shrink-0 flex flex-col h-auto md:h-[100dvh] md:sticky md:top-0">
        <div className="flex items-center justify-between md:block bg-black px-5 py-4">
          <Link href="/dashboard" className="flex items-center group outline-none">
            <img src="/logo-full.png" alt="Content Matrix" className="h-10 w-auto object-contain" />
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
        
        <div className="p-6 hidden md:flex flex-col gap-4 border-t border-border/50">
          <Link href="/campaigns/new" className="w-full flex items-center justify-center gap-2 bg-black text-white hover:bg-black/80 px-4 py-3 text-sm font-medium transition-colors">
            <PlusCircle className="w-4 h-4" />
            New Campaign
          </Link>

          <Link href="/settings" className="flex items-center gap-3 group">
            <Avatar className="w-8 h-8 border border-border">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-secondary text-xs"><User className="w-4 h-4" /></AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">{user?.firstName || 'User'}</span>
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