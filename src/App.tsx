// Shadow Flow App v3 - With Authentication, Error Boundaries & Route Code-Splitting
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";

const Pricing = lazy(() => import("./pages/Pricing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const WorkflowEditor = lazy(() => import("./pages/WorkflowEditor"));
const SharedWorkflow = lazy(() => import("./pages/SharedWorkflow"));
const Settings = lazy(() => import("./pages/Settings"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SEOAgent = lazy(() => import("./pages/SEOAgent"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Features = lazy(() => import("./pages/Features"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const Docs = lazy(() => import("./pages/Docs"));
const ApiReference = lazy(() => import("./pages/ApiReference"));
const Community = lazy(() => import("./pages/Community"));
const Tutorials = lazy(() => import("./pages/Tutorials"));
const About = lazy(() => import("./pages/About"));
const Careers = lazy(() => import("./pages/Careers"));
const Contact = lazy(() => import("./pages/Contact"));
const Partners = lazy(() => import("./pages/Partners"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const License = lazy(() => import("./pages/License"));
const CompareZapierN8n = lazy(() => import("./pages/CompareZapierN8n"));
const UseCaseSocialMediaAgents = lazy(() => import("./pages/UseCaseSocialMediaAgents"));
const UseCaseSalesLeadAutomation = lazy(() => import("./pages/UseCaseSalesLeadAutomation"));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <ErrorBoundary fallbackMessage="The application encountered an error. Please refresh the page.">
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workflow/new"
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary fallbackMessage="The workflow editor crashed. Your work has been auto-saved.">
                        <WorkflowEditor />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workflow/:id"
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary fallbackMessage="The workflow editor crashed. Your work has been auto-saved.">
                        <WorkflowEditor />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route path="/workflow/share/:token" element={<SharedWorkflow />} />
                {/* Demo routes - no auth required */}
                <Route
                  path="/demo"
                  element={
                    <DemoProvider>
                      <Dashboard />
                    </DemoProvider>
                  }
                />
                <Route
                  path="/demo/workflow/new"
                  element={
                    <DemoProvider>
                      <ErrorBoundary fallbackMessage="The workflow editor crashed.">
                        <WorkflowEditor />
                      </ErrorBoundary>
                    </DemoProvider>
                  }
                />
                <Route
                  path="/demo/workflow/:id"
                  element={
                    <DemoProvider>
                      <ErrorBoundary fallbackMessage="The workflow editor crashed.">
                        <WorkflowEditor />
                      </ErrorBoundary>
                    </DemoProvider>
                  }
                />
                <Route
                  path="/demo/settings"
                  element={
                    <DemoProvider>
                      <Settings />
                    </DemoProvider>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <DemoProvider>
                      <Settings />
                    </DemoProvider>
                  }
                />
                {/* Marketing & Public Hub Routes */}
                <Route path="/features" element={<Features />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/changelog" element={<Changelog />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/seo-agent" element={<SEOAgent />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/api-reference" element={<ApiReference />} />
                <Route path="/community" element={<Community />} />
                <Route path="/tutorials" element={<Tutorials />} />
                <Route path="/about" element={<About />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/partners" element={<Partners />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/license" element={<License />} />
                {/* Programmatic Comparison & Use-Case Hubs */}
                <Route path="/compare" element={<CompareZapierN8n />} />
                <Route path="/compare/shadowflow-vs-zapier-vs-n8n" element={<CompareZapierN8n />} />
                <Route path="/use-cases" element={<UseCaseSalesLeadAutomation />} />
                <Route path="/use-cases/autonomous-social-media-agents" element={<UseCaseSocialMediaAgents />} />
                <Route path="/use-cases/ai-sales-and-lead-automation" element={<UseCaseSalesLeadAutomation />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
