import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmail from './VerifyEmail';

const verifyEmail = vi.fn();

vi.mock('@/lib/api', () => ({
  d1Api: {
    verifyEmail: (token: string) => verifyEmail(token),
  },
}));

const TOKEN = 'a'.repeat(64);

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <VerifyEmail />
    </MemoryRouter>
  );
}

describe('VerifyEmail page', () => {
  beforeEach(() => {
    verifyEmail.mockReset();
  });

  it('sends the token from the link once and shows success', async () => {
    verifyEmail.mockResolvedValue({ success: true });
    renderAt(`/verify-email?token=${TOKEN}`);

    expect(await screen.findByText('Email confirmed')).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByRole('link', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it('shows the server message when the link is expired or already used', async () => {
    verifyEmail.mockRejectedValue(new Error('This verification link is invalid or has expired.'));
    renderAt(`/verify-email?token=${TOKEN}`);

    expect(await screen.findByText('Link not valid')).toBeInTheDocument();
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('does not call the API when the link has no token', async () => {
    renderAt('/verify-email');

    expect(await screen.findByText('Link not valid')).toBeInTheDocument();
    await waitFor(() => expect(verifyEmail).not.toHaveBeenCalled());
  });
});
