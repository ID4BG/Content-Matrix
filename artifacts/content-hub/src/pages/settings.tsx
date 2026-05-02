import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { LogOut, User, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function Settings() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const handleSignOut = () => {
    signOut(() => setLocation("/"));
  };

  return (
    <div className="max-w-2xl space-y-10">
      <header className="pb-8 border-b border-border/50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Account</p>
        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
      </header>

      <section className="space-y-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Profile</h2>

        {!isLoaded ? (
          <div className="border border-border p-6 flex items-center gap-5 bg-white">
            <Skeleton className="w-16 h-16 rounded-none" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ) : (
          <div className="border border-border bg-white p-6 flex items-center gap-5">
            <Avatar className="w-16 h-16 border border-border rounded-none">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-secondary text-lg font-bold rounded-none">
                {user?.firstName?.charAt(0) ?? user?.emailAddresses[0]?.emailAddress?.charAt(0) ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xl">
                {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User'}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                <Mail className="w-3.5 h-3.5" />
                {user?.emailAddresses[0]?.emailAddress}
              </div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-3 flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                Verified account
              </div>
            </div>
          </div>
        )}

        <div className="border border-border bg-white divide-y divide-border">
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Display Name</p>
              <p className="text-base font-semibold mt-1">
                {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'}
              </p>
            </div>
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="px-6 py-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Email Address</p>
              <p className="text-base font-semibold mt-1">
                {user?.emailAddresses[0]?.emailAddress ?? '—'}
              </p>
            </div>
            <Mail className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </section>

      <section className="space-y-4 pb-8 border-b border-border/50">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Danger Zone</h2>
        <div className="border border-border bg-white p-6 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-foreground">Sign Out</p>
            <p className="text-sm text-muted-foreground mt-0.5">You'll be redirected to the home page.</p>
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="gap-2 border-border text-foreground hover:bg-secondary rounded-none font-semibold px-6"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">About</h2>
        <div className="border border-border bg-white p-6 space-y-3">
          <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-4">
            <div className="w-6 h-6 border-2 border-black flex items-center justify-center font-bold" style={{ fontSize: '10px' }}>CM</div>
            <span className="font-bold tracking-tight text-lg">Content Matrix</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed font-medium">
            A multi-user content distribution platform. Create campaigns, manage content across channels, and share folders with collaborators.
          </p>
        </div>
      </section>
    </div>
  );
}