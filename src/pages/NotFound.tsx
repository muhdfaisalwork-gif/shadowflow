import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowRight, Home, Monitor, BookOpen } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = "404 - Page Not Found | ShadowFlow";
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center py-24 px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-sm">
            <FileQuestion className="w-8 h-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-mono text-primary font-semibold tracking-wider uppercase">
              Error 404
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Page Not Found
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              The route <code className="text-foreground font-mono bg-muted px-1.5 py-0.5 rounded text-sm">{location.pathname}</code> does not exist or has been moved to a new destination.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg" className="font-semibold gap-2">
              <Link to="/">
                <Home className="w-4 h-4" aria-hidden="true" /> Return Home
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="font-semibold gap-2">
              <Link to="/demo">
                <Monitor className="w-4 h-4" aria-hidden="true" /> Launch Live Demo
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="font-semibold gap-2">
              <Link to="/docs">
                <BookOpen className="w-4 h-4" aria-hidden="true" /> Read Docs <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
