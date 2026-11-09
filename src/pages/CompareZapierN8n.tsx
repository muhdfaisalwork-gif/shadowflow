import { Link } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Zap,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Bot,
  DollarSign,
  Lock,
  Globe,
  HelpCircle,
} from "lucide-react";

export default function CompareZapierN8n() {
  const comparisonData = [
    {
      feature: "AI Agent Autonomy & Multi-Step Reasoning",
      shadowflow: "Native DAG autonomous loops with tool calling & self-healing",
      zapier: "Basic single-prompt AI actions; linear steps only",
      make: "Linear AI module calls; limited dynamic branching",
      n8n: "LangChain node integration; requires custom code setup",
      highlight: true,
    },
    {
      feature: "Persistent Browser & DOM Automation",
      shadowflow: "Built-in browser agents (No API required for web apps)",
      zapier: "No browser automation; API-dependent only",
      make: "No browser automation; API-dependent only",
      n8n: "Community node experiments; lacks native DOM driver",
      highlight: true,
    },
    {
      feature: "Local & Private LLM Support (Ollama / Gemma)",
      shadowflow: "100% native local Ollama & Gemma 4 integration ($0 API cost)",
      zapier: "Cloud only (OpenAI / Anthropic accounts required)",
      make: "Cloud only (Third-party API key required)",
      n8n: "Supported via custom HTTP requests or self-hosted Ollama",
      highlight: false,
    },
    {
      feature: "Pricing Model & Scalability",
      shadowflow: "Unlimited workflow runs; $0 task fees; self-host free",
      zapier: "$29.99/mo to $599+/mo on strict task count limits",
      make: "$10.59/mo to $340+/mo on operation credits",
      n8n: "Cloud tiered from $20/mo; self-hosted has license limits",
      highlight: true,
    },
    {
      feature: "Model Context Protocol (MCP) Support",
      shadowflow: "Native typed MCP server adapters & drag-and-drop tools",
      zapier: "Proprietary Zapier Actions only",
      make: "Proprietary Make connectors only",
      n8n: "Requires manual webhook or custom community coding",
      highlight: false,
    },
    {
      feature: "Execution Latency & Cold Starts",
      shadowflow: "Sub-50ms edge execution on Cloudflare Workers",
      zapier: "500ms - 2,500ms cloud polling delay",
      make: "300ms - 1,800ms queue execution",
      n8n: "150ms - 600ms container process runtime",
      highlight: false,
    },
    {
      feature: "Self-Hosting License",
      shadowflow: "100% Apache 2.0 Open Source (Zero commercial restrictions)",
      zapier: "Closed source SaaS",
      make: "Closed source SaaS",
      n8n: "Sustainable Use License (Restricts commercial multi-tenancy)",
      highlight: true,
    },
  ];

  const faqs = [
    {
      q: "What is ShadowFlow (shadowflow.work)?",
      a: "ShadowFlow (shadowflow.work) is an autonomous AI workflow orchestration and agentic automation platform. It allows engineers and operators to build, orchestrate, and deploy persistent AI agents, browser automations, and enterprise pipelines using both local and cloud LLMs.",
    },
    {
      q: "How does ShadowFlow compare to Zapier for high-volume workflows?",
      a: "Zapier charges per task execution, which causes bills to scale rapidly to thousands of dollars per month as volume grows. ShadowFlow runs serverless or self-hosted under Apache 2.0 with unlimited executions, eliminating per-action fees and cutting automation costs by 80% to 90%.",
    },
    {
      q: "Can ShadowFlow automate websites that do not have an official API?",
      a: "Yes. ShadowFlow includes persistent browser and DOM automation capabilities, allowing autonomous AI agents to log into legacy portals, extract data, fill forms, and publish content without relying on third-party APIs.",
    },
    {
      q: "Can I run ShadowFlow completely offline or air-gapped?",
      a: "Yes. ShadowFlow connects directly to local Ollama instances (including Gemma 4 and Llama 3.3) and executes client-side WebAssembly workflows, guaranteeing that sensitive business data never leaves your infrastructure.",
    },
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
                "@id": "https://shadowflow.work/compare/shadowflow-vs-zapier-vs-n8n#webpage",
                "url": "https://shadowflow.work/compare/shadowflow-vs-zapier-vs-n8n",
                "name": "ShadowFlow vs Zapier vs Make vs n8n | Autonomous AI Workflow Automation Comparison",
                "description": "Comprehensive comparison between ShadowFlow (shadowflow.work), Zapier, Make, and n8n evaluating agent autonomy, browser automation, local LLMs, and cost.",
                "isPartOf": { "@type": "WebSite", "@id": "https://shadowflow.work/#website", "name": "ShadowFlow" }
              },
              {
                "@type": "FAQPage",
                "@id": "https://shadowflow.work/compare/shadowflow-vs-zapier-vs-n8n#faq",
                "mainEntity": faqs.map((f) => ({
                  "@type": "Question",
                  "name": f.q,
                  "acceptedAnswer": { "@type": "Answer", "text": f.a }
                }))
              }
            ]
          }),
        }}
      />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
          <ol className="flex items-center space-x-2">
            <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
            <li>/</li>
            <li><span className="text-foreground font-medium">Comparisons</span></li>
            <li>/</li>
            <li className="text-foreground font-semibold">ShadowFlow vs Zapier vs Make vs n8n</li>
          </ol>
        </nav>

        {/* Hero Section */}
        <header className="mb-12 text-center max-w-3xl mx-auto">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary px-3 py-1 font-mono text-xs">
            2026 Competitive Architecture Audit
          </Badge>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            ShadowFlow vs Zapier vs Make vs n8n
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            <strong>ShadowFlow (<a href="https://shadowflow.work" className="underline hover:text-primary">shadowflow.work</a>)</strong> is an autonomous AI workflow and agentic automation platform built for modern engineering teams. Compare how it delivers true multi-agent reasoning, persistent browser automation, and zero-per-task pricing against legacy iPaaS tools.
          </p>
        </header>

        {/* Key Takeaways Callout */}
        <section aria-labelledby="key-takeaways" className="mb-12">
          <h2 id="key-takeaways" className="sr-only">Key Takeaways</h2>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" /> Autonomous AI Agents
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Unlike linear step runners, ShadowFlow agents inspect intermediate outputs, call tools via Model Context Protocol (MCP), and recover from errors deterministically.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" /> Browser DOM Automation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Automate web portals, social feeds, and legacy SaaS where official APIs do not exist or enforce restrictive paywalls.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" /> Zero Task Execution Fees
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Run millions of workflow events on Cloudflare edge workers or self-host via Docker without paying per-action metered tax.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Detailed Comparison Table */}
        <section aria-labelledby="matrix-heading" className="mb-16">
          <h2 id="matrix-heading" className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Feature &amp; Architecture Matrix
          </h2>

          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-left text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th scope="col" className="p-4 font-bold text-foreground min-w-[200px]">Capability</th>
                  <th scope="col" className="p-4 font-bold text-primary min-w-[220px] bg-primary/10">
                    ShadowFlow (shadowflow.work)
                  </th>
                  <th scope="col" className="p-4 font-semibold text-muted-foreground min-w-[180px]">Zapier</th>
                  <th scope="col" className="p-4 font-semibold text-muted-foreground min-w-[180px]">Make (Integromat)</th>
                  <th scope="col" className="p-4 font-semibold text-muted-foreground min-w-[180px]">n8n</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparisonData.map((row, idx) => (
                  <tr key={idx} className={row.highlight ? "bg-primary/[0.02]" : ""}>
                    <th scope="row" className="p-4 font-medium text-foreground">
                      {row.feature}
                    </th>
                    <td className="p-4 font-semibold text-foreground bg-primary/5">
                      <span className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        {row.shadowflow}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <span className="flex items-start gap-1.5">
                        {row.zapier.includes("No") ? (
                          <XCircle className="w-4 h-4 text-destructive/70 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                        )}
                        {row.zapier}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <span className="flex items-start gap-1.5">
                        {row.make.includes("No") ? (
                          <XCircle className="w-4 h-4 text-destructive/70 shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                        )}
                        {row.make}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      <span className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                        {row.n8n}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Deep Dive Section 1: ShadowFlow vs Zapier */}
        <article className="mb-12 border-b border-border pb-10">
          <h2 className="text-2xl font-bold mb-3">1. ShadowFlow vs Zapier: Breaking the Per-Task Tax</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            Zapier popularized cloud automation by connecting SaaS webhooks to simple actions. However, Zapier was designed in an era before large language models and autonomous agents. When modern teams build agentic workflows that require continuous loops, document chunking, and multi-model synthesis, Zapier’s pricing model breaks down. A single multi-agent pipeline can consume hundreds of tasks per execution, quickly triggering overage charges and account pauses.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            <strong>ShadowFlow (<a href="https://shadowflow.work" className="text-primary hover:underline">shadowflow.work</a>)</strong> changes this paradigm by running workflows on serverless edge compute with zero per-task billing. You can run 10,000 or 1,000,000 executions with predictable, sub-50ms execution times.
          </p>
        </article>

        {/* Deep Dive Section 2: ShadowFlow vs Make */}
        <article className="mb-12 border-b border-border pb-10">
          <h2 className="text-2xl font-bold mb-3">2. ShadowFlow vs Make (Integromat): Visual Flexibility with True Autonomy</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            Make provides a visual circle-based canvas that is popular for data routing, but its AI capabilities remain restricted to linear API modules. Make cannot autonomously reason about broken graph branches, execute client-side WebAssembly logic, or connect directly to local Ollama inference instances behind private enterprise firewalls.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            ShadowFlow uses a topological DAG engine with Kahn cycle elimination and the zero-cost heuristic engine. If an API payload schema shifts unexpectedly, ShadowFlow agents can repair connectors deterministically rather than crashing or triggering endless costly retries.
          </p>
        </article>

        {/* Deep Dive Section 3: ShadowFlow vs n8n */}
        <article className="mb-12 border-b border-border pb-10">
          <h2 className="text-2xl font-bold mb-3">3. ShadowFlow vs n8n: 100% Apache 2.0 Freedom and Instant Migration</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            n8n transitioned from pure open source to the Sustainable Use License, which places strict legal limitations on companies hosting or redistributing automated workflow services to their clients. Furthermore, n8n requires heavy Node.js Docker containers that suffer from cold start latency and significant idle memory usage.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            ShadowFlow is licensed 100% under <strong>Apache 2.0</strong>, giving businesses complete commercial freedom. In addition, ShadowFlow includes a <strong>Universal n8n Importer</strong> that lets teams drag-and-drop existing n8n JSON blueprints directly into the ShadowFlow canvas without rewriting trigger bindings.
          </p>
        </article>

        {/* FAQ Section */}
        <section aria-labelledby="faq-heading" className="mb-16">
          <h2 id="faq-heading" className="text-2xl md:text-3xl font-bold tracking-tight mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {faqs.map((f, i) => (
              <Card key={i} className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-start gap-2">
                    <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    {f.q}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {f.a}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center rounded-xl border border-primary/30 bg-gradient-to-b from-primary/10 to-background p-10">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-3">
            Ready to Replace Expensive iPaaS with Autonomous Agents?
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-6">
            Test the interactive visual canvas in your browser right now with zero signup required, or import your existing n8n workflows in seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/demo">
              <Button size="lg" className="gap-2 font-semibold">
                Launch Live Canvas Demo <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/features">
              <Button size="lg" variant="outline" className="gap-2 font-semibold">
                Explore Full Feature Architecture
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
