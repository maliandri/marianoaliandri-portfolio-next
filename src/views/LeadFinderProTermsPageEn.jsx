'use client';
import React from 'react';
import Link from 'next/link';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';

export default function LeadFinderProTermsPageEn() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/en/lead-finder-pro" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm inline-block">
            &larr; Back to Lead Finder Pro
          </Link>
          <LanguageSwitch />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Terms of Service — Lead Finder Pro
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: September 2026
        </p>

        <div className="space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Acceptance</h2>
            <p>
              By creating an account or using Lead Finder Pro (web at marianoaliandri.com.ar/lead-finder-pro
              or the Android app), you agree to these Terms. Provider: Mariano Aliandri, Neuquén,
              Argentina. Contact: yo@marianoaliandri.com.ar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">2. The service</h2>
            <p>
              Lead Finder Pro lets you search local businesses by location and audit them
              (website presence, SEO score, contact info) using data sourced from Google Places.
              Browsing/searching is free; each full audit consumes one credit from your plan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Use the audited business data to send unsolicited bulk messages in violation
                of applicable anti-spam laws in the recipient&apos;s country</li>
              <li>Resell or redistribute raw audit data as a standalone dataset/database</li>
              <li>Attempt to bypass credit limits, scrape the service itself, or automate
                requests outside the intended UI/API usage</li>
              <li>Use the service for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Plans, credits and billing</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Free, subscription (monthly credit renewal) and one-time credit-pack plans are
                available; current pricing is shown in the app</li>
              <li>On the website, payment is processed by MercadoPago; inside the Android app,
                payment is processed by Google Play Billing. We never store your card details</li>
              <li>Subscriptions renew automatically each month unless cancelled before the renewal
                date, via the payment processor used (MercadoPago account or Google Play subscriptions)</li>
              <li>Unused credits from one-time purchases do not expire; monthly subscription
                credits reset each billing period and do not roll over</li>
              <li>Refunds are handled case-by-case by contacting us, and are otherwise subject to
                the refund policy of the payment processor used (MercadoPago or Google Play)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Data accuracy</h2>
            <p>
              Business data comes from Google Places and automated SEO checks. We do not
              guarantee its accuracy, completeness, or that a business&apos;s contact details are
              current. Verify before using it commercially.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Availability and changes</h2>
            <p>
              The service is provided &quot;as is&quot;. We may modify, suspend or discontinue
              features, or adjust plan pricing/credit limits, at any time; material changes to
              paid plans will not retroactively reduce credits you already purchased.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Limitation of liability</h2>
            <p>
              We are not liable for indirect or consequential damages arising from use of the
              service, or from decisions made based on the audit data provided.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Termination</h2>
            <p>
              We may suspend or terminate accounts that violate Section 3 (Acceptable use). You
              may close your account at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">9. Privacy</h2>
            <p>
              Data handling is described in our{' '}
              <Link href="/en/lead-finder-pro/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Privacy Policy
              </Link>, which forms part of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">10. Governing law</h2>
            <p>These Terms are governed by the laws of Argentina, venue Neuquén, Argentina.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">11. Contact</h2>
            <p className="font-semibold">yo@marianoaliandri.com.ar</p>
          </section>
        </div>
      </div>
    </div>
  );
}
