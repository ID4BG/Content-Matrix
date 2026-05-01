import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useCreateCampaign, getListCampaignsQueryKey } from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(2, {
    message: "Title must be at least 2 characters.",
  }),
  description: z.string().optional(),
});

export default function CampaignNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCampaign = useCreateCampaign();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createCampaign.mutate(
      { data: values },
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">New Campaign</h1>
        <p className="text-muted-foreground text-lg">
          Create a new multi-channel content campaign.
        </p>
      </div>

      <div className="bg-card p-8 border border-border shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Campaign Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q3 Product Launch" className="text-lg py-6 bg-secondary/30" {...field} />
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
                  <FormLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Briefly describe the goals or context of this campaign..."
                      className="min-h-[120px] text-base resize-y bg-secondary/30"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-4 flex items-center justify-end gap-4 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => setLocation("/")} className="text-sm font-semibold">
                Cancel
              </Button>
              <Button type="submit" disabled={createCampaign.isPending} className="px-8 font-semibold shadow-sm hover:shadow-md transition-shadow">
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
