import { type FC, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { d1Api } from '@/lib/api';

type Status = 'verifying' | 'success' | 'error';

const VerifyEmail: FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error');
  const [message, setMessage] = useState(
    token ? '' : 'This link is missing its verification token. Open the link from the email again, or request a new one from your dashboard.'
  );
  // The token works once. React runs effects twice in development, so guard the request.
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;

    d1Api
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : 'We could not verify this link.');
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-xl gradient-primary">
                <Zap className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              {status === 'verifying' && 'Confirming your email'}
              {status === 'success' && 'Email confirmed'}
              {status === 'error' && 'Link not valid'}
            </CardTitle>
            <CardDescription>
              {status === 'verifying' && 'This takes a second.'}
              {status === 'success' && 'Your address is verified and your account is fully unlocked.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="text-center space-y-4" aria-live="polite">
            {status === 'verifying' && <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />}
            {status === 'success' && <CheckCircle className="w-12 h-12 text-primary mx-auto" />}
            {status === 'error' && (
              <>
                <XCircle className="w-12 h-12 text-destructive mx-auto" />
                <p className="text-sm text-muted-foreground">{message}</p>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full gradient-primary text-white">
              <Link to="/dashboard">{status === 'success' ? 'Go to dashboard' : 'Open dashboard to resend'}</Link>
            </Button>
            {status === 'error' && (
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
