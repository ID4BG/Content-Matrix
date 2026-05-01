import { useListCampaigns } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { PlusCircle, Search } from "lucide-react";
import { StatusBadge } from "@/components/channel-icon";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function CampaignList() {
  const { data: campaigns, isLoading } = useListCampaigns();
  const [search, setSearch] = useState("");

  const filteredCampaigns = campaigns?.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Campaigns</h1>
          <p className="text-muted-foreground text-lg">
            Manage all your content distribution campaigns.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3.5 text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <PlusCircle className="w-5 h-5" />
          Create Campaign
        </Link>
      </header>

      <div className="max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          placeholder="Search campaigns..." 
          className="pl-10 py-6 text-base bg-card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : filteredCampaigns?.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-border/80 bg-secondary/10">
            <p className="text-lg font-medium text-foreground">No campaigns found.</p>
            <p className="text-muted-foreground mt-2">Try a different search or create a new campaign.</p>
          </div>
        ) : (
          filteredCampaigns?.map(campaign => (
            <Link 
              key={campaign.id} 
              href={`/campaigns/${campaign.id}`}
              className="block group"
            >
              <Card className="border-border/60 hover:border-primary/30 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-xl group-hover:text-primary transition-colors">{campaign.title}</h3>
                      <StatusBadge status={campaign.status} />
                    </div>
                    {campaign.description && (
                      <p className="text-muted-foreground line-clamp-2 max-w-4xl">{campaign.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-6 sm:items-center text-sm shrink-0">
                    <div className="text-right">
                      <div className="font-semibold text-2xl tracking-tight">{campaign.contentPieceCount}</div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Pieces</div>
                    </div>
                    <div className="hidden sm:block w-px h-10 bg-border/60"></div>
                    <div className="text-left sm:text-right">
                      <div className="font-medium">{format(new Date(campaign.updatedAt), 'MMM d, yyyy')}</div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Last Updated</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
