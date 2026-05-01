import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlusCircle, FolderKanban, Settings } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/campaigns", label: "Campaigns", icon: FolderKanban },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-sidebar/50 backdrop-blur shrink-0 flex flex-col h-auto md:h-[100dvh] md:sticky md:top-0">
        <div className="p-6 md:p-8 flex items-center justify-between md:block">
          <Link href="/" className="flex items-center gap-2 group outline-none">
            <div className="w-6 h-6 bg-primary rotate-45 group-hover:rotate-90 transition-transform duration-500 ease-[cubic-bezier(0.87,0,0.13,1)]"></div>
            <span className="font-bold text-lg tracking-tight uppercase">Multiplier</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 pb-4 overflow-x-auto md:overflow-visible flex md:flex-col gap-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-4 mb-2 hidden md:block">
            Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-none text-sm font-medium transition-colors ${
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 hidden md:block">
          <Link href="/campaigns/new" className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-3 text-sm font-medium transition-colors shadow-sm hover:shadow-md hover:-translate-y-0.5 duration-200">
            <PlusCircle className="w-4 h-4" />
            New Campaign
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
