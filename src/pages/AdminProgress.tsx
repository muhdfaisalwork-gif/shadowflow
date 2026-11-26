import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  CreditCard,
  Download,
  Eye,
  GitBranch,
  Lock,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  ApiError,
  d1Api,
  type AdminMetric,
  type AdminPaymentsResponse,
  type AdminRange,
  type AdminRepoResponse,
  type AdminStatsSummary,
  type AdminTimeseriesResponse,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const RANGE_OPTIONS: Array<{ value: AdminRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const METRIC_OPTIONS: Array<{ value: AdminMetric; label: string }> = [
  { value: 'visits', label: 'Visits' },
  { value: 'unique_visitors', label: 'Unique visitors' },
  { value: 'clones', label: 'Repo clones' },
  { value: 'repo_views', label: 'Repo views' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'signups', label: 'Signups' },
  { value: 'runs', label: 'Workflow runs' },
  { value: 'ai_usage', label: 'AI requests' },
];

function formatNumber(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString();
}

function formatMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

const AdminProgress: FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [range, setRange] = useState<AdminRange>('30d');
  const [metric, setMetric] = useState<AdminMetric>('clones');
  const [summary, setSummary] = useState<AdminStatsSummary | null>(null);
  const [series, setSeries] = useState<AdminTimeseriesResponse | null>(null);
  const [repoData, setRepoData] = useState<AdminRepoResponse | null>(null);
  const [paymentsData, setPaymentsData] = useState<AdminPaymentsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [syncingRepo, setSyncingRepo] = useState(false);
  const [authStatus, setAuthStatus] = useState<401 | 403 | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const metricRef = useRef<AdminMetric>(metric);
  metricRef.current = metric;

  const loadDashboard = useCallback(
    async (selectedRange: AdminRange, selectedMetric: AdminMetric) => {
      setLoading(true);
      setAuthStatus(null);
      setErrorMessage(null);
      try {
        const [sumRes, tsRes, repoRes, payRes] = await Promise.all([
          d1Api.getAdminStatsSummary(selectedRange),
          d1Api.getAdminStatsTimeseries(selectedMetric, selectedRange),
          d1Api.getAdminStatsRepo(selectedRange),
          d1Api.getAdminStatsPayments(selectedRange),
        ]);
        setSummary(sumRes);
        setSeries(tsRes);
        setRepoData(repoRes);
        setPaymentsData(payRes);
      } catch (err: unknown) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAuthStatus(err.status);
          setErrorMessage(err.message);
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load dashboard stats');
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    document.title = 'Progress Dashboard | ShadowFlow';
    loadDashboard(range, metricRef.current);
  }, [range, loadDashboard]);

  const handleMetricChange = async (nextMetric: AdminMetric) => {
    setMetric(nextMetric);
    if (authStatus) return;
    setSeriesLoading(true);
    try {
      const tsRes = await d1Api.getAdminStatsTimeseries(nextMetric, range);
      setSeries(tsRes);
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Could not load chart metric',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSeriesLoading(false);
    }
  };

  const handleSyncRepo = async () => {
    setSyncingRepo(true);
    try {
      await d1Api.syncAdminStatsRepo();
      toast({ title: 'GitHub stats synced' });
      await loadDashboard(range, metric);
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'GitHub sync skipped',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSyncingRepo(false);
    }
  };

  if (authStatus === 401 || authStatus === 403) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-border">
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Lock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Owner access only</span>
            </div>
            <CardTitle>
              {authStatus === 401 ? 'Sign in required' : 'Account is not authorized'}
            </CardTitle>
            <CardDescription>
              {authStatus === 401
                ? 'Sign in with your ShadowFlow admin email to read site, product, and repository metrics.'
                : `Signed in as ${user?.email || 'unknown account'}, which is not in the worker ADMIN_EMAILS list.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {authStatus === 401 ? (
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">ShadowFlow Progress</h1>
              <p className="text-xs text-muted-foreground">
                {summary
                  ? `Showing ${summary.days} days since ${summary.sinceDay}`
                  : 'Loading owner metrics from Cloudflare D1'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-background p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={range === opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                    range === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDashboard(range, metric)}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {errorMessage ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="py-4 text-sm text-destructive">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {/* Primary KPI Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription>Visits</CardDescription>
                <Eye className="w-4 h-4" />
              </div>
              <CardTitle className="text-2xl tabular-nums">
                {loading && !summary ? '...' : formatNumber(summary?.visits.totalViews)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>Unique visitors: {formatNumber(summary?.visits.uniqueVisitors)}</div>
              <div>
                Blog: {formatNumber(summary?.visits.blogViews)} · llms.txt: {formatNumber(summary?.visits.llmsViews)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription>Downloads</CardDescription>
                <Download className="w-4 h-4" />
              </div>
              <CardTitle className="text-2xl tabular-nums">
                {loading && !summary ? '...' : formatNumber(summary?.downloads.totalDownloads)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>
                Direct: {formatNumber(summary?.downloads.directDownloads)} · Releases: {formatNumber(summary?.downloads.releaseDownloads)}
              </div>
              {summary?.downloads.note ? <div>{summary.downloads.note}</div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription>Repo clones</CardDescription>
                <GitBranch className="w-4 h-4" />
              </div>
              <CardTitle className="text-2xl tabular-nums">
                {loading && !summary ? '...' : formatNumber(summary?.repo.clonesInRange)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>
                Repo views: {formatNumber(summary?.repo.viewsInRange)} · Watchers: {formatNumber(summary?.repo.watchers)}
              </div>
              <div>
                Stars: {formatNumber(summary?.repo.stars)} · Forks: {formatNumber(summary?.repo.forks)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription>Users & usage</CardDescription>
                <Users className="w-4 h-4" />
              </div>
              <CardTitle className="text-2xl tabular-nums">
                {loading && !summary ? '...' : formatNumber(summary?.product.usersTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <div>
                +{formatNumber(summary?.product.newSignupsInRange)} signups · {formatNumber(summary?.product.workflowsTotal)} workflows
              </div>
              <div>
                {formatNumber(summary?.product.runsTotal)} runs · {formatNumber(summary?.product.aiRequestsInRange)} AI calls
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <CardDescription>Purchases</CardDescription>
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="pt-1">
                {summary?.payments.status === 'connected' ? (
                  <CardTitle className="text-2xl tabular-nums">
                    {formatMoney(summary.payments.totalRevenueCents)}
                  </CardTitle>
                ) : (
                  <Badge variant="secondary" className="text-xs font-medium">
                    Not connected
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              {summary?.payments.status === 'connected' ? (
                <div>
                  {formatNumber(summary.payments.succeededCount)} payments via {summary.payments.provider}
                </div>
              ) : (
                <div>Payments are on hold until a merchant is connected.</div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Time Series Chart */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Daily trend</CardTitle>
              <CardDescription>Select a metric to inspect daily totals in this range.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={metric === m.value}
                  onClick={() => handleMetricChange(m.value)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    metric === m.value
                      ? 'border-primary bg-primary/10 text-foreground font-medium'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {seriesLoading ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                Loading chart data...
              </div>
            ) : !series || series.points.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                No daily points recorded for this metric in the selected range yet.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height={256} minWidth={0}>
                  <AreaChart data={series.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.18)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown Row: Traffic, Repo History, Product & Plans */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Site traffic</CardTitle>
              <CardDescription>Top pages, referrers, and countries (no raw IPs stored).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Top pages
                </h3>
                {summary?.visits.topPaths.length ? (
                  <ul className="space-y-1.5">
                    {summary.visits.topPaths.map((item) => (
                      <li key={item.path} className="flex justify-between gap-2 text-xs">
                        <span className="truncate font-mono">{item.path}</span>
                        <span className="tabular-nums text-muted-foreground">{formatNumber(item.views)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No tracked visits in this range yet.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Referrers
                  </h3>
                  {summary?.visits.topReferrers.length ? (
                    <ul className="space-y-1">
                      {summary.visits.topReferrers.map((r) => (
                        <li key={r.domain} className="flex justify-between gap-2 text-xs">
                          <span className="truncate">{r.domain}</span>
                          <span className="tabular-nums text-muted-foreground">{formatNumber(r.views)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">None</p>
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Countries
                  </h3>
                  {summary?.visits.topCountries.length ? (
                    <ul className="space-y-1">
                      {summary.visits.topCountries.map((c) => (
                        <li key={c.country} className="flex justify-between gap-2 text-xs">
                          <span>{c.country}</span>
                          <span className="tabular-nums text-muted-foreground">{formatNumber(c.views)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">None</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">GitHub repository</CardTitle>
                <CardDescription>{repoData?.repo || 'muhdfaisalwork-gif/shadowflow'}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleSyncRepo} disabled={syncingRepo}>
                {syncingRepo ? 'Syncing...' : 'Sync GitHub'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {repoData?.history.length ? (
                <div className="max-h-64 overflow-y-auto border border-border rounded-md">
                  <table className="w-full text-left">
                    <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2 font-medium">Day</th>
                        <th className="py-1.5 px-2 font-medium text-right">Clones</th>
                        <th className="py-1.5 px-2 font-medium text-right">Unique</th>
                        <th className="py-1.5 px-2 font-medium text-right">Views</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...repoData.history].reverse().map((row) => (
                        <tr key={row.day}>
                          <td className="py-1.5 px-2 font-mono">{row.day}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{formatNumber(row.clonesCount)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{formatNumber(row.clonesUniques)}</td>
                          <td className="py-1.5 px-2 text-right tabular-nums">{formatNumber(row.viewsCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground">No repository history synced yet.</p>
              )}
              {repoData?.latest?.syncedAt ? (
                <p className="text-muted-foreground">
                  Last synced: {new Date(repoData.latest.syncedAt).toLocaleString()}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product, downloads & plans</CardTitle>
              <CardDescription>
                {summary ? `${formatNumber(summary.product.blogsPublished)} published blog posts` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div>
                <h3 className="font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Workflow runs by status
                </h3>
                {summary?.product.runsByStatus.length ? (
                  <div className="flex flex-wrap gap-2">
                    {summary.product.runsByStatus.map((r) => (
                      <Badge key={r.status} variant="outline" className="tabular-nums">
                        {r.status}: {formatNumber(r.count)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No workflow runs recorded.</p>
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <h3 className="font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Downloads by asset
                </h3>
                {summary?.downloads.byAsset.length ? (
                  <ul className="space-y-1">
                    {summary.downloads.byAsset.map((d) => (
                      <li key={d.asset} className="flex justify-between gap-2">
                        <span className="font-mono truncate">{d.asset}</span>
                        <span className="tabular-nums text-muted-foreground">{formatNumber(d.count)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No direct asset downloads recorded yet.</p>
                )}
              </div>

              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-muted-foreground uppercase tracking-wider">
                    Plans (plan changes, not revenue)
                  </h3>
                  <Badge variant={paymentsData?.status === 'connected' ? 'default' : 'secondary'}>
                    {paymentsData?.status === 'connected' ? paymentsData.provider : 'Not connected'}
                  </Badge>
                </div>
                {paymentsData?.planBreakdown.length ? (
                  <ul className="space-y-1">
                    {paymentsData.planBreakdown.map((p) => (
                      <li key={p.plan} className="flex justify-between gap-2">
                        <span className="capitalize">{p.plan}</span>
                        <span className="tabular-nums text-muted-foreground">{formatNumber(p.users)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No plan change rows recorded.</p>
                )}
                {paymentsData?.note ? <p className="text-muted-foreground">{paymentsData.note}</p> : null}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AdminProgress;
