"use client";

export default function CookiePolicy() {
  return (
    <main className="bg-[#0B0D12] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16 text-white/80">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-4">
            Cookie Policy
          </h1>
          <p className="text-white/40">
            Last updated: 5 June 2026
          </p>
        </div>

        {/* Intro */}
        <p className="mb-8 leading-relaxed">
          ERS (Errand Runners System) uses cookies and similar technologies to
          enhance your experience, improve performance, and ensure platform security.
        </p>

        {/* User Control Highlight */}
        <div className="mb-12 p-6 bg-[#111217] border border-white/5 rounded-lg">
          <p className="text-white">
            You have full control over how cookies are used.
          </p>
          <p className="text-sm text-white/50 mt-2">
            You can manage or disable cookies at any time through your browser settings.
          </p>
        </div>

        {/* 1 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            1. What are cookies?
          </h2>
          <p>
            Cookies are small text files stored on your device when you visit a website.
            They help us recognize your device and remember your preferences.
          </p>
        </section>

        {/* 2 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            2. How we use cookies
          </h2>
          <ul className="list-disc ml-6 space-y-2">
            <li>Keep you logged in securely</li>
            <li>Understand how users interact with ERS</li>
            <li>Improve performance and user experience</li>
            <li>Detect fraud and maintain platform security</li>
          </ul>
        </section>

        {/* 3 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            3. Types of cookies we use
          </h2>

          <ul className="space-y-4">
            <li>
              <span className="font-semibold text-white">
                Essential cookies:
              </span>{" "}
              Required for core functionality such as authentication and security.
            </li>
            <li>
              <span className="font-semibold text-white">
                Analytics cookies:
              </span>{" "}
              Help us understand usage patterns and improve the platform.
            </li>
            <li>
              <span className="font-semibold text-white">
                Preference cookies:
              </span>{" "}
              Store your settings and improve your experience.
            </li>
          </ul>
        </section>

        {/* 4 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            4. Managing cookies
          </h2>
          <p>
            You can control or disable cookies through your browser settings.
            Please note that disabling cookies may affect certain features and
            functionality of the platform.
          </p>
        </section>

        {/* 5 */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-4">
            5. Updates to this policy
          </h2>
          <p>
            We may update this Cookie Policy periodically. Continued use of ERS
            after changes means you accept the updated policy.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-semibold text-white mb-4">
            Contact
          </h2>
          <p>
            <a
              href="mailto:support@ers.com"
              className="text-[#1ED760] underline"
            >
              support@ers.com
            </a>
          </p>
        </section>

      </div>
    </main>
  );
}