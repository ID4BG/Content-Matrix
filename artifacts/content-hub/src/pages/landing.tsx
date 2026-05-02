import { Link } from "wouter";
import { ArrowRight, Layers, LayoutDashboard, Share2, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <header className="border-b border-border/50 py-3 px-6 flex items-center justify-between sticky top-0 bg-black z-50">
        <div className="overflow-hidden" style={{ height: '52px', width: '210px' }}>
          <img
            src="/logo-full.png"
            alt="Content Matrix"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
          />
        </div>
        <div className="flex items-center gap-6">
          <Link href="/sign-in" className="text-sm font-medium text-white/80 hover:text-white transition-colors">Sign In</Link>
          <Link href="/sign-up" className="bg-white text-black text-sm font-medium px-5 py-2.5 hover:bg-white/90 transition-colors">Get Started</Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-24 md:py-32 px-6 max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1] mb-8">
            One piece of content.<br />
            Distributed everywhere.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            A sleek, editorial command center for modern creators. Write once, organize intuitively, and deploy across every channel with absolute precision.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="bg-black text-white px-8 py-4 text-base font-medium flex items-center gap-2 hover:bg-black/80 transition-colors w-full sm:w-auto justify-center">
              Start Building <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#features" className="px-8 py-4 text-base font-medium border border-border hover:bg-secondary/50 transition-colors w-full sm:w-auto justify-center">
              Explore Features
            </Link>
          </div>
        </section>

        {/* How It Works / Features */}
        <section id="features" className="py-24 bg-secondary/30 px-6 border-y border-border/50">
          <div className="max-w-5xl mx-auto">
            <div className="mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Precision Engineering for Content.</h2>
              <p className="text-muted-foreground text-lg max-w-2xl">Stop manually copying and pasting. Design campaigns as matrices and map content perfectly to the right destination.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-8 border border-border/50 hover:shadow-lg transition-shadow duration-300">
                <Layers className="w-8 h-8 mb-6" />
                <h3 className="text-xl font-bold mb-3">Campaign Matrices</h3>
                <p className="text-muted-foreground leading-relaxed">Group multiple channels under a single unified campaign. See exactly what goes where, all from one clean dashboard.</p>
              </div>
              <div className="bg-white p-8 border border-border/50 hover:shadow-lg transition-shadow duration-300">
                <Share2 className="w-8 h-8 mb-6" />
                <h3 className="text-xl font-bold mb-3">Client Sharing</h3>
                <p className="text-muted-foreground leading-relaxed">Share entire folders of content with a simple, secure link. Clients can view, comment, and approve without creating an account.</p>
              </div>
              <div className="bg-white p-8 border border-border/50 hover:shadow-lg transition-shadow duration-300">
                <LayoutDashboard className="w-8 h-8 mb-6" />
                <h3 className="text-xl font-bold mb-3">Editorial Workflow</h3>
                <p className="text-muted-foreground leading-relaxed">Built-in statuses for drafting, reviewing, and publishing. Keep your entire content pipeline perfectly orchestrated.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Channels List */}
        <section className="py-24 px-6 max-w-5xl mx-auto text-center">
          <Zap className="w-12 h-12 mx-auto mb-8" />
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">Connect every channel.</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {['Instagram Reels', 'TikTok', 'X (Twitter)', 'LinkedIn Posts', 'YouTube Long', 'YouTube Shorts', 'Facebook Carousel', 'Facebook Groups', 'Reddit', 'Threads', 'Source Articles'].map((channel) => (
              <span key={channel} className="px-6 py-3 border border-border bg-white text-sm font-medium hover:border-black transition-colors cursor-default">
                {channel}
              </span>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-24 bg-black text-white px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Ready to organize your content?</h2>
            <Link href="/sign-up" className="bg-white text-black px-10 py-5 text-lg font-medium inline-flex items-center gap-2 hover:bg-white/90 transition-colors">
              Create your Matrix <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 px-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Content Matrix. All rights reserved.</p>
        <p className="mt-2 text-xs tracking-wide">
          Made by <span className="font-semibold text-foreground">Arnela</span>, for Marketers — with love.
        </p>
      </footer>
    </div>
  );
}