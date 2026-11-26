// ============================================================================
// Shadow Flow Cloudflare D1 Client
// Direct Edge API Client communicating with Cloudflare Workers + D1 SQLite
// ============================================================================

export interface User {
  id: string;
  email: string;
  display_name?: string;
  /** False until the user clicks the emailed link. Undefined for sessions that never reported it. */
  email_verified?: boolean;
  user_metadata?: { display_name?: string; full_name?: string };
}

export interface WorkflowItem {
  id: string;
  user_id?: string;
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CredentialItem {
  id: string;
  user_id?: string;
  provider: string;
  name: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const TOKEN_KEY = 'shadowflow_auth_token';
const USER_KEY = 'shadowflow_auth_user';

export function getAuthToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setAuthToken(token: string, user?: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const str = localStorage.getItem(USER_KEY);
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type AdminRange = '7d' | '30d' | '90d';
export type AdminMetric =
  | 'visits'
  | 'unique_visitors'
  | 'downloads'
  | 'signups'
  | 'runs'
  | 'ai_usage'
  | 'clones'
  | 'repo_views';

export interface AdminStatsSummary {
  range: AdminRange;
  days: number;
  sinceDay: string;
  visits: {
    totalViews: number;
    uniqueVisitors: number;
    blogViews: number;
    llmsViews: number;
    topPaths: Array<{ path: string; views: number }>;
    topReferrers: Array<{ domain: string; views: number }>;
    topCountries: Array<{ country: string; views: number }>;
  };
  downloads: {
    directDownloads: number;
    releaseDownloads: number;
    totalDownloads: number;
    byAsset: Array<{ asset: string; count: number }>;
    note?: string;
  };
  product: {
    usersTotal: number;
    newSignupsInRange: number;
    workflowsTotal: number;
    workflowsCreatedInRange: number;
    runsTotal: number;
    runsByStatus: Array<{ status: string; count: number }>;
    aiRequestsInRange: number;
    blogsPublished: number;
  };
  payments: {
    status: 'connected' | 'not_connected';
    provider: string;
    totalRevenueCents: number;
    succeededCount: number;
    planBreakdown: Array<{ plan: string; users: number }>;
    note: string;
  };
  repo: {
    repo: string;
    status: 'synced' | 'not_synced';
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    clonesInRange: number;
    uniqueClonersInRange: number;
    viewsInRange: number;
    uniqueViewersInRange: number;
    releaseDownloads: number;
    syncedAt: string | null;
  };
}

export interface AdminTimeseriesResponse {
  metric: string;
  range: AdminRange;
  days: number;
  sinceDay: string;
  points: Array<{ day: string; value: number }>;
}

export interface AdminRepoSnapshot {
  day: string;
  repo: string;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  clonesCount: number;
  clonesUniques: number;
  viewsCount: number;
  viewsUniques: number;
  releaseDownloads: number;
  topReferrers: Array<{ referrer?: string; count?: number; uniques?: number }>;
  syncedAt: string | null;
}

export interface AdminRepoResponse {
  repo: string;
  range: AdminRange;
  days: number;
  status: 'synced' | 'not_synced';
  latest: AdminRepoSnapshot | null;
  history: AdminRepoSnapshot[];
}

export interface AdminPaymentsResponse {
  range: AdminRange;
  days: number;
  status: 'connected' | 'not_connected';
  provider: string;
  note: string;
  summary: {
    totalRevenueCents: number;
    succeededCount: number;
  };
  planBreakdown: Array<{ plan: string; users: number }>;
  recentPayments: Array<{
    id: string;
    provider: string;
    externalEventId: string;
    plan: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || data.details || `Request failed with status ${res.status}`, res.status);
  }
  return data as T;
}

export const d1Api = {
  getToken: getAuthToken,
  setToken: setAuthToken,
  clearToken: clearAuthToken,
  getStoredUser,
  request: apiFetch,

  // Auth methods
  async signUp(email: string, password: string, displayName?: string, id?: string): Promise<{ user: User; token: string }> {
    const data = await apiFetch<{ success: boolean; user: User; token: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, id }),
    });
    setAuthToken(data.token, data.user);
    return data;
  },

  async login(
    email: string,
    password: string,
    tfaCode?: string
  ): Promise<{
    success: boolean;
    user?: User;
    token?: string;
    require2FA?: boolean;
    tempToken?: string;
    method?: string;
    emailMasked?: string;
    email?: string;
  }> {
    const data = await apiFetch<{
      success: boolean;
      user?: User;
      token?: string;
      require2FA?: boolean;
      tempToken?: string;
      method?: string;
      emailMasked?: string;
      email?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, tfaCode }),
    });
    if (data.token && data.user) {
      setAuthToken(data.token, data.user);
    }
    return data;
  },

  async login2FA(tempToken: string, code: string): Promise<{ success: boolean; user: User; token: string }> {
    const data = await apiFetch<{ success: boolean; user: User; token: string }>('/api/auth/login/2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
    });
    if (data.token && data.user) {
      setAuthToken(data.token, data.user);
    }
    return data;
  },

  async getTFAStatus(): Promise<{
    enabled: boolean;
    preferred_method: string;
    totp_verified: boolean;
    backup_codes_remaining: number;
  }> {
    return apiFetch('/api/auth/tfa/status');
  },

  async setupTFA(): Promise<{ secret: string; totp_uri: string }> {
    return apiFetch('/api/auth/tfa/setup', { method: 'POST' });
  },

  async setupEmailTFA(): Promise<{ success: boolean; message: string; email: string; emailMasked: string }> {
    return apiFetch('/api/auth/tfa/setup-email', { method: 'POST' });
  },

  async verifyAndEnableTFA(code: string, secret?: string, method?: 'totp' | 'email'): Promise<{
    success: boolean;
    valid: boolean;
    backupCodes: string[];
    message: string;
  }> {
    return apiFetch('/api/auth/tfa/verify-and-enable', {
      method: 'POST',
      body: JSON.stringify({ code, secret, method }),
    });
  },

  async resend2FACode(tempToken: string): Promise<{ success: boolean; message: string }> {
    return apiFetch('/api/auth/login/2fa/resend', {
      method: 'POST',
      body: JSON.stringify({ tempToken }),
    });
  },

  async disableTFA(): Promise<{ success: boolean; message: string }> {
    return apiFetch('/api/auth/tfa/disable', { method: 'POST' });
  },

  async generateTFABackupCodes(): Promise<{ success: boolean; codes: string[] }> {
    return apiFetch('/api/auth/tfa/generate-backup-codes', { method: 'POST' });
  },

  async getMe(): Promise<User | null> {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      if (data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      return data.user;
    } catch {
      clearAuthToken();
      return null;
    }
  },

  async verifyEmail(token: string): Promise<{ success: boolean; message?: string }> {
    return apiFetch('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async resendVerificationEmail(): Promise<{ success: boolean; alreadyVerified?: boolean; message?: string }> {
    return apiFetch('/api/auth/resend-verification', { method: 'POST' });
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearAuthToken();
    }
  },

  // Workflows
  async getWorkflows(): Promise<WorkflowItem[]> {
    const data = await apiFetch<{ workflows: WorkflowItem[] }>('/api/workflows');
    return data.workflows || [];
  },

  async getWorkflow(id: string): Promise<WorkflowItem> {
    const data = await apiFetch<{ workflow: WorkflowItem }>(`/api/workflows/${id}`);
    return data.workflow;
  },

  async createWorkflow(wf: {
    name: string;
    description?: string;
    nodes: unknown[];
    edges: unknown[];
    settings?: Record<string, unknown>;
    is_active?: boolean;
  }): Promise<WorkflowItem> {
    const data = await apiFetch<{ workflow: WorkflowItem }>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(wf),
    });
    return data.workflow;
  },

  async updateWorkflow(
    id: string,
    wf: {
      name?: string;
      description?: string;
      nodes?: unknown[];
      edges?: unknown[];
      settings?: Record<string, unknown>;
      is_active?: boolean;
      change_summary?: string;
    }
  ): Promise<void> {
    await apiFetch(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(wf),
    });
  },

  async deleteWorkflow(id: string): Promise<void> {
    await apiFetch(`/api/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  // Credentials
  async getCredentials(): Promise<CredentialItem[]> {
    const data = await apiFetch<{ credentials: CredentialItem[] }>('/api/credentials');
    return data.credentials || [];
  },

  async saveCredential(provider: string, name: string, data: Record<string, unknown>): Promise<string> {
    const res = await apiFetch<{ id: string }>('/api/credentials', {
      method: 'POST',
      body: JSON.stringify({ provider, name, data }),
    });
    return res.id;
  },

  async deleteCredential(id: string): Promise<void> {
    await apiFetch(`/api/credentials/${id}`, {
      method: 'DELETE',
    });
  },

  // Email Dispatch via Resend
  async sendEmail(payload: {
    to: string | string[];
    from?: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }): Promise<{ success: boolean; id?: string }> {
    return apiFetch<{ success: boolean; id?: string }>('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Edge D1 & Dynamic Blog Endpoints
  async getBlogs(): Promise<{ posts: Record<string, unknown>[] }> {
    return apiFetch<{ posts: Record<string, unknown>[] }>('/api/blogs');
  },

  async getBlogBySlug(slug: string): Promise<{ post: Record<string, unknown> | null }> {
    return apiFetch<{ post: Record<string, unknown> | null }>(`/api/blogs/${slug}`);
  },

  async publishBlog(post: Record<string, unknown>): Promise<{ success: boolean; slug?: string }> {
    return apiFetch<{ success: boolean; slug?: string }>('/api/blogs', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  },

  async generateAiBlog(payload: { topic: string; keyword?: string; audience?: string }): Promise<{
    success: boolean;
    article: { title: string; excerpt: string; content: string; slug: string };
  }> {
    return apiFetch<{
      success: boolean;
      article: { title: string; excerpt: string; content: string; slug: string };
    }>('/api/seo/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async pingIndexNow(urls?: string[]): Promise<{
    success: boolean;
    status?: number;
    error?: string;
    submittedUrls?: number;
  }> {
    return apiFetch<{
      success: boolean;
      status?: number;
      error?: string;
      submittedUrls?: number;
    }>('/api/seo/indexnow', {
      method: 'POST',
      body: JSON.stringify({ urls }),
    });
  },

  // Owner Progress Dashboard & Privacy-Safe Tracking
  async trackPageView(path: string, referrer?: string): Promise<void> {
    if (!path.startsWith('/') || path.startsWith('/admin')) return;
    try {
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, referrer: referrer || '' }),
        keepalive: true,
      });
    } catch {
      // Ignore tracking errors so navigation is never blocked
    }
  },

  async getAdminStatsSummary(range: AdminRange = '30d'): Promise<AdminStatsSummary> {
    return apiFetch<AdminStatsSummary>(`/api/admin/stats/summary?range=${encodeURIComponent(range)}`);
  },

  async getAdminStatsTimeseries(metric: AdminMetric, range: AdminRange = '30d'): Promise<AdminTimeseriesResponse> {
    return apiFetch<AdminTimeseriesResponse>(
      `/api/admin/stats/timeseries?metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}`
    );
  },

  async getAdminStatsRepo(range: AdminRange = '30d'): Promise<AdminRepoResponse> {
    return apiFetch<AdminRepoResponse>(`/api/admin/stats/repo?range=${encodeURIComponent(range)}`);
  },

  async syncAdminStatsRepo(): Promise<{ synced: boolean; daysSynced?: number }> {
    return apiFetch<{ synced: boolean; daysSynced?: number }>('/api/admin/stats/repo/sync', {
      method: 'POST',
    });
  },

  async getAdminStatsPayments(range: AdminRange = '30d'): Promise<AdminPaymentsResponse> {
    return apiFetch<AdminPaymentsResponse>(`/api/admin/stats/payments?range=${encodeURIComponent(range)}`);
  },
};
