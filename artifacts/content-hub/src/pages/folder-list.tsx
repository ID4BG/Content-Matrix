import { useState } from "react";
import { Link } from "wouter";
import { Folder, Plus, Share2, Trash2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFolders,
  getListFoldersQueryKey,
  useCreateFolder,
  useDeleteFolder,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function FolderList() {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: folders, isLoading } = useListFolders({
    query: { queryKey: getListFoldersQueryKey() },
  });

  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createFolder.mutate(
      { data: { title: newTitle.trim(), description: newDescription.trim() || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
          setIsCreating(false);
          setNewTitle("");
          setNewDescription("");
          toast({ title: "Folder created" });
        },
        onError: () => toast({ title: "Error", description: "Failed to create folder", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteFolder.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
          toast({ title: "Folder deleted" });
        },
        onError: () => toast({ title: "Delete failed", description: "You can only delete folders you own.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between pb-8 border-b border-border/50">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">Organization</p>
          <h1 className="text-4xl font-bold tracking-tight">Folders</h1>
          <p className="text-muted-foreground mt-2">Group campaigns into folders and share them with collaborators.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="bg-black text-white hover:bg-black/80 rounded-none gap-2">
          <Plus className="w-4 h-4" />
          New Folder
        </Button>
      </header>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : !folders?.length ? (
        <div className="text-center py-24 border border-dashed border-border/60">
          <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-40" />
          <h3 className="font-semibold text-lg mb-2">No folders yet</h3>
          <p className="text-muted-foreground text-sm mb-6">Create a folder to organize your campaigns and share them with others.</p>
          <Button onClick={() => setIsCreating(true)} variant="outline" className="gap-2 rounded-none">
            <Plus className="w-4 h-4" /> Create your first folder
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <div key={folder.id} className="group border border-border/80 bg-card hover:border-black/30 hover:shadow-sm transition-all duration-200 flex flex-col">
              <Link href={`/folders/${folder.id}`} className="flex-1 p-6 block">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 border border-border/80 flex items-center justify-center shrink-0">
                    <Folder className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate group-hover:text-black transition-colors">{folder.title}</h3>
                    {folder.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{folder.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest border-t border-border/40 pt-4">
                  <span>{folder.campaignCount} {folder.campaignCount === 1 ? 'Campaign' : 'Campaigns'}</span>
                  {folder.shareToken && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-600 flex items-center gap-1"><Share2 className="w-3 h-3" /> Shared</span>
                    </>
                  )}
                </div>
              </Link>
              <div className="border-t border-border/40 px-6 py-3 flex items-center justify-between bg-secondary/20">
                <Link href={`/folders/${folder.id}`} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider">
                  View Folder
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete folder?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The folder will be deleted. Campaigns inside will remain but will no longer be grouped.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(folder.id)} className="bg-destructive text-white">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="rounded-none sm:rounded-none">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Folder Name</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Q2 Content, Client Projects..."
                className="rounded-none"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Description (optional)</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What is this folder for?"
                className="rounded-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createFolder.isPending}
              className="bg-black text-white hover:bg-black/80 rounded-none"
            >
              {createFolder.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Folder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
