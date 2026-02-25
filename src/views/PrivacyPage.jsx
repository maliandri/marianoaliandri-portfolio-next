'use client';
import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-6 inline-block">
          &larr; Volver al inicio
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Privacy Policy / Politica de Privacidad
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: February 2026
        </p>

        <div className="space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Information We Collect</h2>
            <p>
              When you use our website or connect through third-party services (such as LinkedIn or Google), we may collect:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Basic profile information (name, email, profile picture) provided through OAuth authentication</li>
              <li>Usage analytics and page visit data</li>
              <li>Information you voluntarily provide through contact forms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>To provide and improve our services</li>
              <li>To display analytics and insights in our admin dashboard</li>
              <li>To communicate with you regarding inquiries or services</li>
              <li>To personalize your experience on our website</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Third-Party Services</h2>
            <p>
              We integrate with the following third-party services:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>LinkedIn API</strong> - For profile data, posts, and analytics (with your explicit consent via OAuth)</li>
              <li><strong>Google Search Console</strong> - For website performance analytics</li>
              <li><strong>Firebase / Firestore</strong> - For data storage and authentication</li>
              <li><strong>Netlify</strong> - For hosting and serverless functions</li>
            </ul>
            <p className="mt-2">
              Each third-party service has its own privacy policy. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Data Storage and Security</h2>
            <p>
              Your data is stored securely using Firebase/Firestore with encryption at rest. OAuth tokens are stored server-side and are never exposed to the client browser. We implement industry-standard security measures to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request deletion of your data</li>
              <li>Disconnect third-party integrations at any time</li>
              <li>Opt out of analytics tracking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We may also use analytics cookies to understand how visitors interact with our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Contact</h2>
            <p>
              If you have questions about this privacy policy or your data, contact us at:
            </p>
            <p className="mt-2 font-semibold">
              yo@marianoaliandri.com.ar
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
