import Link from "next/link";
import { BookOpen, Zap, Layers, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-bg-primary text-text-primary transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="max-w-[80rem] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-lg shadow-sm">
              F
            </span>
            <span className="font-sans font-bold text-xl tracking-tight">Frontpage</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard?mode=guest"
              className="text-sm font-sans font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Try as Guest
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-sans font-semibold rounded-md border border-border hover:bg-bg-secondary transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-20 md:py-32 text-center max-w-[50rem] mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-subtle text-accent border border-accent/10 mb-8 animate-fade-in">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-sans font-semibold">Your personalized feed reader</span>
        </div>

        <h1 className="font-sans font-bold text-3xl md:text-4xl lg:text-5xl leading-tight tracking-tight max-w-[42rem] mb-6">
          A calm, customizable front page for your tech content
        </h1>

        <p className="font-sans text-base md:text-lg text-text-secondary max-w-[34rem] mb-10 leading-relaxed">
          Pulls RSS and Atom feeds into a single, beautiful reading dashboard. Organise dev blogs, design newsletters, and changelogs exactly how you like.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            href="/dashboard?mode=guest"
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-sans font-semibold rounded-md shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Try as Guest (Instant Access)
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 border border-border hover:bg-bg-secondary font-sans font-semibold rounded-md transition-all flex items-center justify-center"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="bg-bg-secondary border-t border-b border-border py-20 px-6">
        <div className="max-w-[80rem] mx-auto">
          <h2 className="text-center font-sans font-bold text-2xl mb-12">Designed for developers, designers, and curators</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface p-6 rounded-lg border border-border shadow-sm">
              <div className="h-10 w-10 bg-accent-subtle text-accent rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="font-sans font-semibold text-lg mb-2">Resilient Parsing</h3>
              <p className="font-sans text-sm text-text-secondary leading-relaxed">
                Handles inconsistent RSS 2.0, Atom, and RDF feeds, decoding entities, sanitising HTML content, and extracting clean article metadata automatically.
              </p>
            </div>

            <div className="bg-surface p-6 rounded-lg border border-border shadow-sm">
              <div className="h-10 w-10 bg-accent-subtle text-accent rounded-lg flex items-center justify-center mb-4">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-sans font-semibold text-lg mb-2">Custom Layout Options</h3>
              <p className="font-sans text-sm text-text-secondary leading-relaxed">
                Choose between highly scannable compact lists, card grids, standard view, or an interactive split-pane reader for focused reading.
              </p>
            </div>

            <div className="bg-surface p-6 rounded-lg border border-border shadow-sm">
              <div className="h-10 w-10 bg-accent-subtle text-accent rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="font-sans font-semibold text-lg mb-2">Power User Focus</h3>
              <p className="font-sans text-sm text-text-secondary leading-relaxed">
                Quickly browse via custom keyboard shortcuts (`j`/`k`/`o`), search keywords instantly, and import/export entire structures using standard OPML.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 bg-bg-primary text-center">
        <p className="font-sans text-xs text-text-tertiary">
          © {new Date().getFullYear()} Frontpage. Build for Frontend Mentor Product Challenge.
        </p>
      </footer>
    </div>
  );
}
