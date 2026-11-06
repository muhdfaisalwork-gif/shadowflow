import { type FC, useEffect, useState } from 'react';
import { MailWarning, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { d1Api, type User } from '@/lib/api';

/**
 * Shown on the dashboard to accounts that have not confirmed their email yet.
 * Asks the server for the current state instead of trusting the cached user,
 * so it disappears as soon as the link has been clicked.
 */
const EmailVerificationBanner: FC = () => {
  const [unverified, setUnverified] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Plain request on purpose: getMe() clears the saved login on any error,
    // and a failed banner check should never sign someone out.
    if (!d1Api.getToken()) return;
    let active = true;
    d1Api
      .request<{ user?: User }>('/api/auth/me')
      .then((data) => {
        if (active && data.user?.email_verified === false) setUnverified(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!unverified) return null;

  const handleResend = async () => {
    setIsSending(true);
    try {
      const res = await d1Api.resendVerificationEmail();
      if (res.alreadyVerified) {
        setUnverified(false);
        return;
      }
      toast({ title: 'Email sent', description: 'Check your inbox (and spam folder) for the confirmation link.' });
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Could not send email',
        description: err instanceof Error ? err.message : 'Please try again shortly.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="status"
      className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <MailWarning className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-foreground/90">
          Confirm your email to unlock AI generation, credential storage and email nodes. We sent a link when you signed up.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={handleResend} disabled={isSending} className="shrink-0">
        {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Resend email
      </Button>
    </div>
  );
};

export default EmailVerificationBanner;
