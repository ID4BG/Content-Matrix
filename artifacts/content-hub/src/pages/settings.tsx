import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { LogOut, User, Mail, Shield, Edit2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const handleSignOut = () => {
    signOut(() => setLocation("/"));
  };

  const startEditName = () => {
    setEditFirstName(user?.firstName ?? "");
    setEditLastName(user?.lastName ?? "");
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!user) return;
    setIsSavingName(true);
    try {
      await user.update({ firstName: editFirstName.trim(), lastName: editLastName.trim() });
      toast({ title: "Display name updated" });
      setIsEditingName(false);
    } catch {
      toast({ title: "Failed to update name", variant: "destructive" });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelName = () => {
    setIsEditingName(false);
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
          {/* Display Name — editable */}
          <div className="px-6 py-5">
            {isEditingName ? (
              <div className="space-y-3">
                <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Display Name</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">First Name</label>
                    <Input
                      value={editFirstName}
                      onChange={e => setEditFirstName(e.target.value)}
                      className="rounded-none"
                      placeholder="First"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Last Name</label>
                    <Input
                      value={editLastName}
                      onChange={e => setEditLastName(e.target.value)}
                      className="rounded-none"
                      placeholder="Last"
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelName(); }}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="bg-black text-white rounded-none gap-1.5"
                  >
                    {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelName} className="rounded-none">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Display Name</p>
                  <p className="text-base font-semibold mt-1">
                    {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditName}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-none"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </div>
            )}
          </div>

          {/* Email — read only */}
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
          <div className="flex items-center gap-3 mb-4 border-b border-border/50 pb-4 bg-black p-3 -mx-2">
            <img src="/logo-full.png" alt="Content Matrix" className="h-9 w-auto object-contain" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed font-medium">
            A multi-user content distribution platform. Create campaigns, manage content across channels, and share folders with collaborators.
          </p>
        </div>
      </section>
    </div>
  );
}
