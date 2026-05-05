import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useCreateCampaign, getListCampaignsQueryKey, useListFolders, CreateCampaignBodyChannelsItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getChannelName, ChannelIcon } from "@/components/channel-icon";

const ALL_CHANNELS = [
  "source_article",
  "instagram_reel",
  "tiktok_post",
  "x_post",
  "linkedin_post",
  "youtube_long",
  "youtube_short",
  "facebook_carousel",
  "facebook_group_post",
  "reddit_post",
  "threads_post",
] as const;

const formSchema = z.object({
  title: z.string().min(2, {
    message: "Title must be at least 2 characters.",
  }),
  description: z.string().optional(),
  folderId: z.string().optional(),
  channels: z.array(z.enum([
    "source_article",
    "instagram_reel",
    "tiktok_post",
    "x_post",
    "linkedin_post",
    "youtube_long",
    "youtube_short",
    "facebook_carousel",
    "facebook_group_post",
    "reddit_post",
    "threads_post",
  ])).min(1, "Select at least one channel"),
});

export default function CampaignNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCampaign = useCreateCampaign();
  const { data: folders } = useListFolders();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      folderId: "none",
      channels: ALL_CHANNELS as unknown as any,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const payload = {
      title: values.title,
      description: values.description,
      folderId: values.folderId !== "none" ? parseInt(values.folderId || "0") : undefined,
      channels: values.channels as CreateCampaignBodyChannelsItem[],
    };

    createCampaign.mutate(
      { data: payload },
      {
        onSuccess: (campaign) => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({
            title: "Campaign created",
            description: "Your new campaign has been created successfully.",
          });
          setLocation(`/campaigns/${campaign.id}`);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: "Failed to create campaign. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">New Campaign</h1>
        <p className="text-muted-foreground text-lg">
          Create a new multi-channel content matrix.
        </p>
      </div>

      <div className="bg-card p-4 sm:p-8 border border-border shadow-none">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Campaign Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q3 Product Launch" className="text-lg py-6 bg-secondary/30 rounded-none border-border" {...field} />
                  </FormControl>
                  <FormDescription>
                    A clear, identifiable name for your campaign.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Briefly describe the goals or context of this campaign..."
                      className="min-h-[120px] text-base resize-y bg-secondary/30 rounded-none border-border"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Folder (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-secondary/30 rounded-none border-border">
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No folder</SelectItem>
                      {folders?.map(folder => (
                        <SelectItem key={folder.id} value={folder.id.toString()}>{folder.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="channels"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Channels</FormLabel>
                    <FormDescription>
                      Select the channels you want to distribute to.
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ALL_CHANNELS.map((item) => (
                      <FormField
                        key={item}
                        control={form.control}
                        name="channels"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={item}
                              className="flex flex-row items-start space-x-3 space-y-0 border border-border p-4 bg-secondary/10 cursor-pointer"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, item])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== item
                                          )
                                        )
                                  }}
                                  className="rounded-none border-border mt-1"
                                />
                              </FormControl>
                              <FormLabel className="font-medium flex items-center gap-2 cursor-pointer w-full">
                                <ChannelIcon channel={item as any} className="w-4 h-4" />
                                {getChannelName(item as any)}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4 flex items-center justify-end gap-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setLocation("/")} className="text-sm font-semibold rounded-none">
                Cancel
              </Button>
              <Button type="submit" disabled={createCampaign.isPending} className="px-8 font-semibold shadow-sm hover:shadow-md transition-shadow rounded-none bg-black text-white hover:bg-black/80">
                {createCampaign.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Campaign"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}