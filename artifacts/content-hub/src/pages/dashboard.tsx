import { Link } from "wouter";
import { format } from "date-fns";
import { useGetDashboardSummary, useListCampaigns, useGetRecentActivity, useListFolders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileText, CheckCircle, Clock, FolderKanban, FolderOpen, Activity, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: campaigns, isLoading: isLoadingCampaigns } = useListCampaigns();
  const { data: folders, isLoading: isLoadingFolders } = useListFolders();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your content matrix.</p>
      </div>

      {isLoadingSummary ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : summary ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalCampaigns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Content Pieces</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalContentPieces}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pendingReview}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.approvedPieces}</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Recent Campaigns</h2>
            <Link href="/campaigns/new">
              <Button size="sm" variant="outline" className="gap-2">
                <PlusCircle className="w-4 h-4" />
                New Campaign
              </Button>
            </Link>
          </div>
          
          <div className="grid gap-4">
            {isLoadingCampaigns ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)
            ) : campaigns && campaigns.length > 0 ? (
              campaigns.slice(0, 3).map((campaign) => (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                  <Card className="hover:border-black transition-colors cursor-pointer group">
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold group-hover:underline decoration-2 underline-offset-4">{campaign.title}</h3>
                        <Badge variant="outline" className={
                          campaign.status === 'in_review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          campaign.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          campaign.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-secondary'
                        }>
                          {campaign.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-1">{campaign.description || 'No description'}</p>
                      <div className="flex items-center text-xs text-muted-foreground gap-4">
                        <span>{campaign.channels.length} Channels</span>
                        <span>{campaign.contentPieceCount} Pieces</span>
                        <span>Updated {format(new Date(campaign.updatedAt), 'MMM d')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="text-center p-8 border border-dashed text-muted-foreground text-sm">
                No campaigns yet. Create your first one to get started.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Recent Folders</h2>
            <Link href="/folders">
              <Button size="sm" variant="outline" className="gap-2">
                <FolderOpen className="w-4 h-4" />
                View All
              </Button>
            </Link>
          </div>
          
          <div className="grid gap-4">
            {isLoadingFolders ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)
            ) : folders && folders.length > 0 ? (
              folders.slice(0, 3).map((folder) => (
                <Link key={folder.id} href={`/folders/${folder.id}`}>
                  <Card className="hover:border-black transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FolderKanban className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium group-hover:underline decoration-2 underline-offset-4">{folder.title}</span>
                      </div>
                      <Badge variant="secondary">{folder.campaignCount} Campaigns</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="text-center p-8 border border-dashed text-muted-foreground text-sm">
                No folders yet. Group your campaigns into folders.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Recent Activity</h2>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {isLoadingActivity ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="p-4 flex gap-4">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <div className="space-y-2 w-full">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))
                ) : activity && activity.length > 0 ? (
                  activity.slice(0, 10).map((item) => (
                    <div key={item.id} className="p-4 flex gap-4 items-start hover:bg-secondary/30 transition-colors">
                      <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center shrink-0 bg-card">
                        {item.type.includes('campaign') ? <FolderKanban className="w-4 h-4 text-muted-foreground" /> :
                         item.type.includes('piece') ? <FileText className="w-4 h-4 text-muted-foreground" /> :
                         item.type.includes('comment') ? <AlertCircle className="w-4 h-4 text-muted-foreground" /> :
                         item.type.includes('folder') ? <FolderOpen className="w-4 h-4 text-muted-foreground" /> :
                         <Activity className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{item.entityTitle}</span>
                          {" "}—{" "}
                          <span className="text-muted-foreground">{item.description}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No recent activity to show.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}