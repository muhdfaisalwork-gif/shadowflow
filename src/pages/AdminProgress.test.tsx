import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminProgress from './AdminProgress';
import { ApiError } from '@/lib/api';

const getSummary = vi.fn();
const getTimeseries = vi.fn();
const getRepo = vi.fn();
const syncRepo = vi.fn();
const getPayments = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    d1Api: {
      ...actual.d1Api,
      getAdminStatsSummary: (range: string) => getSummary(range),
      getAdminStatsTimeseries: (metric: string, range: string) => getTimeseries(metric, range),
      getAdminStatsRepo: (range: string) => getRepo(range),
      syncAdminStatsRepo: () => syncRepo(),
      getAdminStatsPayments: (range: string) => getPayments(range),
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'muhd.faisal.work@gmail.com', display_name: 'Faisal' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/progress']}>
      <AdminProgress />
    </MemoryRouter>
  );
}

describe('AdminProgress page', () => {
  beforeEach(() => {
    getSummary.mockReset();
    getTimeseries.mockReset();
    getRepo.mockReset();
    syncRepo.mockReset();
    getPayments.mockReset();
  });

  it('renders metrics, repo clones, and hold-state payments, and switches chart metric', async () => {
    getSummary.mockResolvedValue({
      range: '30d',
      days: 30,
      sinceDay: '2026-10-28',
      visits: {
        totalViews: 42,
        uniqueVisitors: 18,
        blogViews: 12,
        llmsViews: 4,
        topPaths: [{ path: '/pricing', views: 15 }],
        topReferrers: [{ domain: 'github.com', views: 9 }],
        topCountries: [{ country: 'PK', views: 20 }],
      },
      downloads: {
        directDownloads: 3,
        releaseDownloads: 0,
        totalDownloads: 3,
        byAsset: [{ asset: 'shadowflow.zip', count: 3 }],
      },
      product: {
        usersTotal: 9,
        newSignupsInRange: 2,
        workflowsTotal: 14,
        workflowsCreatedInRange: 4,
        runsTotal: 27,
        runsByStatus: [{ status: 'completed', count: 27 }],
        aiRequestsInRange: 55,
        blogsPublished: 35,
      },
      payments: {
        status: 'not_connected',
        provider: 'none',
        totalRevenueCents: 0,
        succeededCount: 0,
        planBreakdown: [{ plan: 'free', users: 9 }],
        note: 'Payments are on hold until a merchant provider is connected. Plan breakdown reflects user_subscriptions plan changes, not revenue.',
      },
      repo: {
        repo: 'muhdfaisalwork-gif/shadowflow',
        status: 'synced',
        stars: 0,
        forks: 0,
        watchers: 1,
        openIssues: 0,
        clonesInRange: 768,
        uniqueClonersInRange: 186,
        viewsInRange: 18,
        uniqueViewersInRange: 1,
        releaseDownloads: 0,
        syncedAt: '2026-11-26T05:04:00Z',
      },
    });

    getTimeseries.mockResolvedValue({
      metric: 'clones',
      range: '30d',
      days: 30,
      sinceDay: '2026-10-28',
      points: [{ day: '2026-11-26', value: 768 }],
    });

    getRepo.mockResolvedValue({
      repo: 'muhdfaisalwork-gif/shadowflow',
      range: '30d',
      days: 30,
      status: 'synced',
      latest: {
        day: '2026-11-26',
        repo: 'muhdfaisalwork-gif/shadowflow',
        stars: 0,
        forks: 0,
        watchers: 1,
        openIssues: 0,
        clonesCount: 768,
        clonesUniques: 186,
        viewsCount: 18,
        viewsUniques: 1,
        releaseDownloads: 0,
        topReferrers: [],
        syncedAt: '2026-11-26T05:04:00Z',
      },
      history: [
        {
          day: '2026-11-26',
          repo: 'muhdfaisalwork-gif/shadowflow',
          stars: 0,
          forks: 0,
          watchers: 1,
          openIssues: 0,
          clonesCount: 768,
          clonesUniques: 186,
          viewsCount: 18,
          viewsUniques: 1,
          releaseDownloads: 0,
          topReferrers: [],
          syncedAt: '2026-11-26T05:04:00Z',
        },
      ],
    });

    getPayments.mockResolvedValue({
      range: '30d',
      days: 30,
      status: 'not_connected',
      provider: 'none',
      note: 'Payments are on hold until a merchant provider is connected. Plan breakdown reflects user_subscriptions plan changes, not revenue.',
      summary: { totalRevenueCents: 0, succeededCount: 0 },
      planBreakdown: [{ plan: 'free', users: 9 }],
      recentPayments: [],
    });

    renderPage();

    expect(await screen.findByText('ShadowFlow Progress')).toBeInTheDocument();
    expect(screen.getAllByText('768').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not connected').length).toBeGreaterThan(0);
    expect(screen.getByText('/pricing')).toBeInTheDocument();
    expect(screen.getByText('shadowflow.zip')).toBeInTheDocument();

    const visitsBtn = screen.getByRole('button', { name: 'Visits' });
    fireEvent.click(visitsBtn);
    await waitFor(() => expect(getTimeseries).toHaveBeenCalledWith('visits', '30d'));
  });

  it('shows authorization notice on 403 non-admin error', async () => {
    getSummary.mockRejectedValue(new ApiError('Admin access required', 403));
    getTimeseries.mockRejectedValue(new ApiError('Admin access required', 403));
    getRepo.mockRejectedValue(new ApiError('Admin access required', 403));
    getPayments.mockRejectedValue(new ApiError('Admin access required', 403));

    renderPage();

    expect(await screen.findByText('Account is not authorized')).toBeInTheDocument();
    expect(screen.getByText(/ADMIN_EMAILS list/i)).toBeInTheDocument();
  });
});
