import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import CampaignList from "@/pages/campaign-list";
import CampaignNew from "@/pages/campaign-new";
import CampaignDetail from "@/pages/campaign-detail";
import CampaignCalendar from "@/pages/campaign-calendar";
import CampaignPipeline from "@/pages/campaign-pipeline";
import CampaignChannel from "@/pages/campaign-channel";
import PieceDetail from "@/pages/piece-detail";
import FolderList from "@/pages/folder-list";
import FolderDetail from "@/pages/folder-detail";
import SharedFolder from "@/pages/shared-folder";
import SharedCampaign from "@/pages/shared-campaign";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevRef.current !== undefined && prevRef.current !== id) qc.clear();
      prevRef.current = id;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><LandingPage /></Show>
    </>
  );
}

function PrivateRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return (
    <>
      <Show when="signed-in"><Layout><Component /></Layout></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />

      <Route path="/sign-in/*?">
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        </div>
      </Route>

      <Route path="/sign-up/*?">
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        </div>
      </Route>

      <Route path="/dashboard"><PrivateRoute component={Dashboard} /></Route>
      <Route path="/campaigns"><PrivateRoute component={CampaignList} /></Route>
      <Route path="/campaigns/new"><PrivateRoute component={CampaignNew} /></Route>
      <Route path="/campaigns/:id/calendar"><PrivateRoute component={CampaignCalendar} /></Route>
      <Route path="/campaigns/:id/pipeline"><PrivateRoute component={CampaignPipeline} /></Route>
      <Route path="/campaigns/:id"><PrivateRoute component={CampaignDetail} /></Route>
      <Route path="/campaigns/:id/channels/:channel"><PrivateRoute component={CampaignChannel} /></Route>
      <Route path="/campaigns/:campaignId/pieces/:pieceId"><PrivateRoute component={PieceDetail} /></Route>
      <Route path="/folders"><PrivateRoute component={FolderList} /></Route>
      <Route path="/folders/:id"><PrivateRoute component={FolderDetail} /></Route>
      <Route path="/settings"><PrivateRoute component={Settings} /></Route>

      <Route path="/shared/folder/:token" component={SharedFolder} />
      <Route path="/shared/campaign/:token" component={SharedCampaign} />

      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={{
        baseTheme: shadcn,
        cssLayerName: "clerk",
        variables: {
          colorPrimary: '#000000',
          colorBackground: '#ffffff',
          colorForeground: '#000000',
          colorMutedForeground: '#6b7280',
          colorDanger: '#dc2626',
          colorInput: '#f9fafb',
          colorInputForeground: '#000000',
          colorNeutral: '#e5e7eb',
          fontFamily: 'Montserrat, sans-serif',
          borderRadius: '0px',
        },
        elements: {
          rootBox: 'w-full flex justify-center',
          cardBox: 'bg-white w-[440px] max-w-full border border-black/10 shadow-sm',
          card: '!shadow-none !border-0 !bg-transparent !rounded-none',
          footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
          headerTitle: 'font-bold tracking-tight',
          headerSubtitle: 'text-gray-500',
          socialButtonsBlockButtonText: 'text-gray-700 font-medium',
          formFieldLabel: 'text-gray-700 font-medium text-xs uppercase tracking-wider',
          footerActionLink: 'text-black font-semibold',
          footerActionText: 'text-gray-500',
          dividerText: 'text-gray-400',
          formButtonPrimary: 'bg-black hover:bg-black/80 rounded-none',
          formFieldInput: 'rounded-none border-gray-200',
          logoBox: 'mb-2',
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to Content Matrix",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join Content Matrix to get started",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
        </TooltipProvider>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
