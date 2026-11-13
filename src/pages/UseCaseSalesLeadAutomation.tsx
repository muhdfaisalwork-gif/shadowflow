import { Link } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Database,
  Mail,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Cpu,
  BarChart3,
  Layers,
} from "lucide-react";

export default function UseCaseSalesLeadAutomation() {
  const pipelineStages = [
    {
      stage: "Stage 1",
      title: "Real-Time Ingestion (Webhook / Form / CSV)",
      description: "Inbound leads from landing pages, demo requests, or webhook callbacks enter the ShadowFlow DAG in sub-50ms with instant payload schema validation.",
    },
    {
      stage: "Stage 2",
      title: "Multi-Source Firmographic Enrichment",
      description: "Agents scrape company domains, query clearbit/clay endpoints or public SEC filings, and extract technographics, employee counts, and decision-maker roles.",
    },
    {
      stage: "Stage 3",
      title: "Local LLM Personalization ($0 Cloud API Bill)",
      description: "Using private local Ollama inference, ShadowFlow generates a personalized 2-sentence opening hook referencing the lead's exact tech stack and recent funding news.",
    },
    {
      stage: "Stage 4",
      title: "Transactional Routing & CRM Sync",
      description: "Dispatches the enriched profile directly into HubSpot, Salesforce, or Cloudflare D1 while queuing the personalized outreach email via Resend with deliverability checks.",
    },
  ];

  const benchmarks = [
    { metric: "End-to-End Processing Latency", legacy: "12 - 45 minutes (batch cron)", shadowflow: "820 milliseconds (event DAG)" },
    { metric: "Enrichment Cost per 10k Leads", legacy: "$350 - $800 (SaaS API fees)", shadowflow: "$0.00 (Self-hosted + Ollama)" },
    { metric: "Lead-to-Meeting Conversion Rate", legacy: "2.4% (generic email blast)", shadowflow: "7.8% (hyper-personalized)" },
    { metric: "Failure / Rate-Limit Drop Rate", legacy: "8.5% (unhandled 429 stalls)", shadowflow: "0.0% (deterministic self-healing)" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* SEO Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://shadowflow.work/use-cases/ai-sales-and-lead-automation#webpage",
                "url": "https://shadowflow.work/use-cases/ai-sales-and-lead-automation",
                "name": "AI Sales & Lead Automation Pipelines | ShadowFlow (shadowflow.work)",
                "description": "How ShadowFlow (shadowflow.work) powers multi-channel B2B lead scraping, real-time CRM enrichment, and automated outreach pipelines with sub-second execution.",
                "isPartOf": { "@type": "WebSite", "@id": "https://shadowflow.work/#website", "name": "ShadowFlow" }
              },
              {
                "@type": "TechArticle",
                "@id": "https://shadowflow.work/use-cases/ai-sales-and-lead-automation#article",
                "headline": "Building Autonomous B2B Sales & Lead Enrichment Pipelines with ShadowFlow",
                "description": "Production architecture for automating inbound webhook capture, domain scraping, contact enrichment, and transactional email routing.",
                "url": "https://shadowflow.work/use-cases/ai-sales-and-lead-automation",
                "author": { "@type": "Organization", "name": "ShadowFlow" }
              }
            ]
          }),
        }}
      />

      <main className="container mx-auto px-4 pt-24 pb-12 max-w-5xl">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
          <ol className="flex items-center space-x-2">
            <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
            <li>/</li>
            <li><span className="text-foreground font-medium">Use Cases</span></li>
            <li>/</li>
            <li className="text-foreground font-semibold">AI Sales &amp; Lead Automation</li>
          </ol>
        </nav>

        {/* Hero Section */}
        <header className="mb-12 max-w-3xl">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary px-3 py-1 font-mono text-xs">
            Revenue Engineering Blueprint
          </Badge>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Autonomous B2B Sales &amp; Lead Enrichment Pipelines
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Discover how <strong>ShadowFlow (<a href="https://shadowflow.work" className="text-primary hover:underline">shadowflow.work</a>)</strong> automates inbound lead capture, multi-source firmographic scraping, CRM enrichment, and personalized email outreach in under 90 seconds.
          </p>
        </header>

        {/* Problem Breakdown */}
        <section aria-labelledby="problem-breakdown" className="mb-12 border-b border-border pb-10">
          <h2 id="problem-breakdown" className="text-2xl font-bold mb-4">
            Why Traditional B2B Lead Stacks Fail
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            Most sales teams lose up to 40% of qualified inbound interest to latency. When a prospect submits a contact form, the raw record sits in a batch queue waiting for an hourly synchronization job. By the time an SDR inspects the lead, researches their LinkedIn profile, and drafts a template email, hours or days have passed.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Connecting separate SaaS tools (Typeform + Zapier + Clearbit + Apollo + Instantly) introduces fragile API failure points, recursive subscription bills, and GDPR compliance risks when customer data is shared across multiple third-party servers.
          </p>
        </section>

        {/* The 4-Stage Architecture */}
        <section aria-labelledby="pipeline-stages" className="mb-16">
          <h2 id="pipeline-stages" className="text-2xl font-bold mb-6">
            The 4-Stage Autonomous Pipeline Architecture
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {pipelineStages.map((st, i) => (
              <Card key={i} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <Badge variant="secondary" className="w-fit mb-2 text-xs font-mono">
                    {st.stage}
                  </Badge>
                  <CardTitle className="text-base font-semibold">{st.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {st.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Performance & Benchmark Metrics Table */}
        <section aria-labelledby="benchmark-table" className="mb-16">
          <h2 id="benchmark-table" className="text-2xl font-bold mb-4">
            Performance &amp; Cost Benchmarks
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Comparing a standard multi-tool SaaS stack against a single serverless ShadowFlow DAG execution across 10,000 processed leads:
          </p>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-left text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th scope="col" className="p-4 font-bold text-foreground">Operational Dimension</th>
                  <th scope="col" className="p-4 font-semibold text-muted-foreground">Legacy Multi-Tool Stack</th>
                  <th scope="col" className="p-4 font-bold text-primary bg-primary/10">ShadowFlow Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {benchmarks.map((b, idx) => (
                  <tr key={idx}>
                    <th scope="row" className="p-4 font-medium text-foreground">
                      {b.metric}
                    </th>
                    <td className="p-4 text-muted-foreground">
                      {b.legacy}
                    </td>
                    <td className="p-4 font-semibold text-foreground bg-primary/5">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        {b.shadowflow}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Integration Code Sample */}
        <section aria-labelledby="code-sample" className="mb-16">
          <h2 id="code-sample" className="text-2xl font-bold mb-4">
            TypeScript MCP Webhook Connector
          </h2>
          <div className="rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs overflow-x-auto text-foreground">
            <pre>{`// Lead ingestion handler with automated schema validation
export async function handleInboundLead(request: Request, env: Env): Promise<Response> {
  const leadPayload = await request.json();
  
  // Dispatch asynchronous DAG execution on Cloudflare edge
  const execution = await env.SHADOWFLOW_CORE.execute({
    workflowId: "b2b-lead-enrichment-pipeline",
    initialContext: {
      email: leadPayload.email,
      domain: leadPayload.companyDomain,
      source: "enterprise-contact-form"
    },
    options: {
      useLocalOllama: true,
      maxExecutionTimeMs: 1500
    }
  });

  return new Response(JSON.stringify({ status: "queued", executionId: execution.id }), {
    status: 202,
    headers: { "Content-Type": "application/json" }
  });
}`}</pre>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center rounded-xl border border-primary/30 bg-primary/5 p-8">
          <h2 className="text-xl md:text-2xl font-bold mb-2">Automate Your Lead Pipeline Today</h2>
          <p className="text-muted-foreground text-xs md:text-sm max-w-lg mx-auto mb-5">
            Explore ready-to-run templates in the ShadowFlow template library or build a custom DAG in the visual canvas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/demo">
              <Button className="gap-2">
                Launch Live Canvas <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/compare/shadowflow-vs-zapier-vs-n8n">
              <Button variant="outline">
                See Pricing &amp; Competitor Comparison
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
