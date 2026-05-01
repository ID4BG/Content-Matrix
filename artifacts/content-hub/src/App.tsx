import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import CampaignList from "@/pages/campaign-list";
import CampaignNew from "@/pages/campaign-new";
import CampaignDetail from "@/pages/campaign-detail";
import PieceDetail from "@/pages/piece-detail";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/campaigns" component={CampaignList} />
        <Route path="/campaigns/new" component={CampaignNew} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/campaigns/:campaignId/pieces/:pieceId" component={PieceDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
