import { Link } from "wouter";
import { format } from "date-fns";
import { PlusCircle, FileText, ArrowRight, Layers, CheckCircle2, Clock } from "lucide-react";
import { useGetDashboardSummary, useGetRecentActivity, useListCampaigns } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/channel-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: campaigns, isLoading: isLoadingCampaigns } = useListCampaigns();

  const activeCampaigns = campaigns?.filter(c => c.status !== 'published') || [];

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Command Center</h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Overview of your multi-channel content operations.
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

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoadingSummary ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Campaigns</CardTitle>
                <Layers className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tracking-tighter">{summary?.totalCampaigns || 0}</div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Pieces</CardTitle>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tracking-tighter">{summary?.totalContentPieces || 0}</div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</CardTitle>
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tracking-tighter text-amber-600 dark:text-amber-500">{summary?.pendingReview || 0}</div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Approved</CardTitle>
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold tracking-tighter text-blue-600 dark:text-blue-500">{summary?.approvedPieces || 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <section className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Active Campaigns</h2>
            <Link href="/campaigns" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 group">
              View all <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="space-y-4">
            {isLoadingCampaigns ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)
            ) : activeCampaigns.length === 0 ? (
              <div className="py-12 px-6 border border-dashed border-border/80 text-center bg-secondary/30">
                <h3 className="text-lg font-semibold text-foreground">No active campaigns</h3>
                <p className="text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">Start by creating a campaign to manage your content distribution across all channels.</p>
                <Link href="/campaigns/new" className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Create Campaign
                </Link>
              </div>
            ) : (
              activeCampaigns.slice(0, 5).map(campaign => (
                <Link 
                  key={campaign.id} 
                  href={`/campaigns/${campaign.id}`}
                  className="block group"
                >
                  <Card className="border-border/40 hover:border-primary/30 shadow-sm hover:shadow-md transition-all duration-300">
                    <CardContent className="p-6 flex flex-col sm:flex-row gap-6 sm:items-center justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-xl group-hover:text-primary transition-colors">{campaign.title}</h3>
                          <StatusBadge status={campaign.status} />
                        </div>
                        {campaign.description && (
                          <p className="text-muted-foreground line-clamp-1">{campaign.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-widest pt-2">
                          <span>{campaign.contentPieceCount} pieces</span>
                          <span>•</span>
                          <span>Updated {format(new Date(campaign.updatedAt), 'MMM d')}</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center justify-end">
                        <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <ArrowRight className="w-5 h-5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Recent Activity</h2>
          <Card className="border-border/40 shadow-sm bg-secondary/10">
            <CardContent className="p-6">
              {isLoadingActivity ? (
                <div className="space-y-6">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !activity?.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No recent activity
                </div>
              ) : (
                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
                  {activity.slice(0, 10).map((item, index) => (
                    <div key={item.id} className="relative flex items-start gap-4">
                      <div className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-border/50 last:hidden" />
                      <div className="relative z-10 w-8 h-8 shrink-0 flex items-center justify-center bg-background border border-border/80 text-primary mt-1 shadow-sm">
                        <ActivityIcon type={item.type} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-snug">
                          {formatActivityText(item)}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                          {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'campaign_created': return <PlusCircle className="w-4 h-4" />;
    case 'piece_uploaded': return <FileText className="w-4 h-4" />;
    case 'piece_approved': return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
    case 'campaign_approved': return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'comment_added': return <div className="w-4 h-4 rounded-full border-[1.5px] border-current flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>;
    default: return <div className="w-2 h-2 bg-current" />;
  }
}

function formatActivityText(item: any) {
  const entitySpan = <span className="font-bold text-foreground">{item.entityTitle}</span>;
  switch (item.type) {
    case 'campaign_created': return <>Created campaign {entitySpan}</>;
    case 'piece_uploaded': return <>Uploaded content for {entitySpan}</>;
    case 'piece_approved': return <>Approved {entitySpan}</>;
    case 'campaign_approved': return <>Campaign {entitySpan} was fully approved</>;
    case 'comment_added': return <>Commented on {entitySpan}</>;
    default: return item.description;
  }
}