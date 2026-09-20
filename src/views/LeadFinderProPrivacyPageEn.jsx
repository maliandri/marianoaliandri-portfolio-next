'use client';
import React from 'react';
import Link from 'next/link';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';

export default function LeadFinderProPrivacyPageEn() {
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
          Privacy Policy — Lead Finder Pro
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: September 2026
        </p>

        <div className="space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">1. What is Lead Finder Pro</h2>
            <p>
              Lead Finder Pro (available at marianoaliandri.com.ar/lead-finder-pro and as an
              Android app) is a tool for developers and agencies to audit local businesses
              (website presence, SEO score, contact info) sourced from Google Maps / Google
              Places, for lead-generation purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">2. Data we collect about you (the account holder)</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Basic profile info (name, email, photo) via Firebase Authentication (Google sign-in)</li>
              <li>Your plan and credit/quota usage, to enforce your subscription limits</li>
              <li>Your search and audit history within the tool</li>
              <li>Payment status from our payment processor (MercadoPago on the web, Google Play Billing
                inside the Android app) — we never see or store your card details ourselves</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Data about third-party businesses (not you)</h2>
            <p>
              When you run an audit, Lead Finder Pro retrieves publicly available business
              information from the Google Places API (business name, address, phone, rating,
              opening hours) and, where publicly listed, the business&apos;s own website/email. This
              is <strong>not personal data about you</strong> — it is business contact data you
              are looking up for prospecting purposes, and it is your responsibility to use it in
              compliance with applicable marketing/anti-spam laws in the businesses&apos; country.
            </p>
            <p className="mt-2">
              We keep a per-account cache of businesses you&apos;ve already audited (so you are not
              charged a credit twice for the same business). This cache is scoped to your account
              only, in Firestore collection <code>leadfinder_client_audits</code>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">4. How we use your data</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>To authenticate you and enforce your plan&apos;s quota</li>
              <li>To show you your own audit history</li>
              <li>To process and verify your subscription/credit purchases</li>
              <li>To respond to support requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Third-party services we use</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Firebase (Auth + Firestore)</strong> — authentication and data storage</li>
              <li><strong>Google Places API</strong> — sourcing business data for audits</li>
              <li><strong>MercadoPago</strong> — payment processing on the website</li>
              <li><strong>Google Play Billing</strong> — payment processing inside the Android app</li>
              <li><strong>Google Gemini</strong> — generates outreach email drafts on request (no personal
                data used to train third-party models)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Your rights</h2>
            <p>You can request, at any time, by emailing us:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Access to the data we hold about your account</li>
              <li>Deletion of your account and all associated data (entitlements, audit history)</li>
              <li>Deletion of a specific business record you looked up, from your personal history</li>
            </ul>
            <p className="mt-2">We respond within 7 business days and confirm once deletion is complete.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">7. International use</h2>
            <p>
              Lead Finder Pro can be used to audit businesses in any country. Data is stored in
              Google Cloud Platform (Firestore) infrastructure. If you are located in the European
              Union, you may exercise GDPR rights (access, rectification, erasure) using the
              contact below — this applies to your own account data; requests regarding a
              third-party business&apos;s listed data should generally be directed to Google (as the
              source of that public data) or to the business itself.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Contact</h2>
            <p>Questions about this policy or a data request:</p>
            <p className="mt-2 font-semibold">yo@marianoaliandri.com.ar</p>
          </section>
        </div>
      </div>
    </div>
  );
}
