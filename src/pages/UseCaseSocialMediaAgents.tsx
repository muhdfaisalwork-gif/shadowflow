import { Link } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Bot,
  Globe,
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Terminal,
  Clock,
  Zap,
} from "lucide-react";

export default function UseCaseSocialMediaAgents() {
  const steps = [
    {
      num: "01",
      title: "Content & Signal Extraction",
      desc: "Persistent browser agents monitor Hacker News, arXiv preprints, GitHub trending repos, and industry blogs. When relevant technical news breaks, the agent extracts clean DOM text and Markdown without hitting rate-limited APIs.",
    },
    {
      num: "02",
      title: "Multi-Model AI Synthesis",
      desc: "The extracted text routes to reasoning models (DeepSeek R1, Claude 3.5, or local Ollama). The agent generates structured multi-slide carousels, concise LinkedIn thought leadership, or threaded X (Twitter) posts tailored to specific developer personas.",
    },
    {
      num: "03",
      title: "82 Humanizer Rule Quality Gate",
      desc: "Before any post is approved, ShadowFlow passes the copy through the built-in 82 Humanizer rule engine. It ruthlessly strips out generic chatbot residue ('In today's digital landscape', 'Let's dive in') and banned marketing buzzwords.",
    },
    {
      num: "04",
      title: "Browser DOM & API Publishing",
      desc: "For channels with expensive or restricted API tiers (such as LinkedIn or X), ShadowFlow uses persistent browser agents with human-like typing cadences to publish directly or send a one-click Telegram/Slack approval link to your team.",
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
                "@id": "https://shadowflow.work/use-cases/autonomous-social-media-agents#webpage",
                "url": "https://shadowflow.work/use-cases/autonomous-social-media-agents",
                "name": "Autonomous Social Media Agents | ShadowFlow (shadowflow.work)",
                "description": "How ShadowFlow (shadowflow.work) orchestrates persistent browser agents to automate content extraction, multi-modal generation, and scheduled publishing without API limits.",
                "isPartOf": { "@type": "WebSite", "@id": "https://shadowflow.work/#website", "name": "ShadowFlow" }
              },
              {
                "@type": "TechArticle",
                "@id": "https://shadowflow.work/use-cases/autonomous-social-media-agents#article",
                "headline": "Autonomous Social Media Agents: End-to-End Content Extraction and Publishing with ShadowFlow",
                "description": "Technical playbook for running autonomous social media agents using persistent browser automation, local LLMs, and humanizer quality gates.",
                "url": "https://shadowflow.work/use-cases/autonomous-social-media-agents",
                "author": { "@type": "Organization", "name": "ShadowFlow" }
              }
            ]
          }),
        }}
      />

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
          <ol className="flex items-center space-x-2">
            <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
            <li>/</li>
            <li><span className="text-foreground font-medium">Use Cases</span></li>
            <li>/</li>
            <li className="text-foreground font-semibold">Autonomous Social Media Agents</li>
          </ol>
        </nav>

        {/* Hero Section */}
        <header className="mb-12 max-w-3xl">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary px-3 py-1 font-mono text-xs">
            Enterprise Agent Pattern
          </Badge>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            Autonomous Social Media Agents with Persistent Browser Automation
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            How <strong>ShadowFlow (<a href="https://shadowflow.work" className="text-primary hover:underline">shadowflow.work</a>)</strong> eliminates manual content drafting and restrictive social API costs using persistent browser agents, multi-model AI synthesis, and automated humanizer checks.
          </p>
        </header>

        {/* Why Browser Agents Beat Traditional APIs */}
        <section aria-labelledby="why-browser-agents" className="mb-12">
          <h2 id="why-browser-agents" className="text-2xl font-bold mb-4">
            The Problem: Social Media API Paywalls and Rigid Formats
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">
            Building social media automation on traditional tools like Zapier or Make requires buying expensive enterprise API tiers (e.g. X API Basic at $100+/mo, LinkedIn Marketing Developer restrictions). Even when APIs exist, they often restrict rich media uploads, carousel scheduling, or audience engagement monitoring.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            ShadowFlow combines standard webhook connectors with <strong>persistent browser automation</strong>. Agents execute inside sandboxed, headless browser environments with stored session cookies, allowing them to navigate social platforms, verify previews, and interact with web dashboards exactly like a human operator.
          </p>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Key Operational Safeguards
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4 text-xs md:text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Human-like bezier curve mouse movement and random typing delays</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Persistent encrypted session storage (no repeated OTP / 2FA prompts)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Human-in-the-loop Slack/Telegram approval nodes before live publishing</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Zero telemetry execution with client-side credential isolation</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Step-by-Step Architecture */}
        <section aria-labelledby="architecture-steps" className="mb-16">
          <h2 id="architecture-steps" className="text-2xl font-bold mb-6">
            End-to-End Execution Architecture
          </h2>
          <ol className="space-y-6">
            {steps.map((step, idx) => (
              <li key={idx} className="flex gap-4 p-5 rounded-lg border border-border bg-card/60">
                <span className="font-mono text-xl font-bold text-primary/60 shrink-0 mt-0.5">
                  {step.num}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Sample DAG Configuration Snippet */}
        <section aria-labelledby="dag-config" className="mb-16">
          <h2 id="dag-config" className="text-2xl font-bold mb-4">
            Production DAG Blueprint (JSON Definition)
          </h2>
          <p className="text-muted-foreground text-sm mb-4">
            Import this blueprint directly into the ShadowFlow visual canvas to inspect the node topology:
          </p>

          <div className="rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs overflow-x-auto text-foreground">
            <pre>{`{
  "workflow": "autonomous-social-agent-v1",
  "engine": "shadowflow-edge",
  "nodes": [
    { "id": "cron_trigger", "type": "cron", "schedule": "0 8 * * 1-5" },
    { "id": "scrape_source", "type": "browser-extract", "url": "https://news.ycombinator.com", "selector": ".titleline > a" },
    { "id": "rank_signals", "type": "ai-reasoning", "model": "deepseek-r1", "prompt": "Filter for top 3 AI automation trends" },
    { "id": "write_draft", "type": "ai-copilot", "model": "claude-3-5-sonnet", "format": "linkedin-carousel" },
    { "id": "quality_gate", "type": "humanizer-audit", "min_score": 90 },
    { "id": "approval_gate", "type": "slack-approval", "channel": "#growth-approvals" },
    { "id": "browser_publish", "type": "browser-agent", "action": "publish_linkedin" }
  ],
  "edges": [
    { "source": "cron_trigger", "target": "scrape_source" },
    { "source": "scrape_source", "target": "rank_signals" },
    { "source": "rank_signals", "target": "write_draft" },
    { "source": "write_draft", "target": "quality_gate" },
    { "source": "quality_gate", "target": "approval_gate" },
    { "source": "approval_gate", "target": "browser_publish" }
  ]
}`}</pre>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center rounded-xl border border-primary/30 bg-primary/5 p-8">
          <h2 className="text-xl md:text-2xl font-bold mb-2">Build Your First Autonomous Agent in 5 Minutes</h2>
          <p className="text-muted-foreground text-xs md:text-sm max-w-lg mx-auto mb-5">
            Test the live DAG editor in your browser. Connect webhooks, test AI reasoning nodes, and export production workflows.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/demo">
              <Button className="gap-2">
                Open Visual Canvas <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/compare/shadowflow-vs-zapier-vs-n8n">
              <Button variant="outline">
                Compare Against Zapier &amp; n8n
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
