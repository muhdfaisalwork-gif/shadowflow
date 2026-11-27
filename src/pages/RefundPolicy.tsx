import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { RotateCcw } from "lucide-react";

export default function RefundPolicy() {
  useEffect(() => {
    document.title = "Refund & Cancellation Policy | ShadowFlow";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Billing & Refunds
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Refund &amp; Cancellation Policy
            </h1>
            <p className="text-xs text-muted-foreground">
              Last Updated: November 2026 • Effective Immediately
            </p>
          </div>

          <div className="space-y-8 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">1. Merchant of Record</h2>
              <p>
                Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the
                Merchant of Record for all ShadowFlow paid subscriptions, handles payment processing and sales tax
                compliance, and provides customer billing support for all orders.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">2. 14-Day Refund Policy</h2>
              <p>
                If you are not satisfied with your paid ShadowFlow Pro or Team &amp; Agency subscription, you may
                request a full refund within <strong>14 calendar days</strong> of your initial purchase or renewal charge.
                Refunds are issued back to the original payment method used at checkout.
              </p>
              <p>
                Requests submitted within the 14-day window are handled in line with Paddle&apos;s Consumer Buyer Terms
                and applicable consumer protection laws.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">3. Subscription Cancellation</h2>
              <p>
                You may cancel your ShadowFlow subscription at any time before your next billing date from your billing
                receipt link or by contacting support. When you cancel:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-foreground/90">
                <li>No further recurring charges will be billed after the cancellation is confirmed.</li>
                <li>Your paid plan features remain active until the end of the current paid billing period.</li>
                <li>At the end of the billing period, your account automatically reverts to the Starter Free tier.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-foreground">4. How to Request a Refund or Cancel</h2>
              <p>
                To request a refund or help with an order, include your Paddle order reference or account email and reach
                out through either option:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-foreground/90">
                <li>
                  Email our support team at <code className="text-foreground">support@shadowflow.work</code> or{" "}
                  <code className="text-foreground">legal@shadowflow.work</code>.
                </li>
                <li>
                  Visit our{" "}
                  <Link to="/contact" className="text-primary underline underline-offset-4">
                    Contact page
                  </Link>{" "}
                  or use the billing management link in your Paddle purchase receipt.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
