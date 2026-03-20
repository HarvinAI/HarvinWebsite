'use client';

import LegalPageLayout, {
  LegalSection,
  LegalList,
  LegalLink,
  LegalContact,
} from '@/components/LegalPageLayout';

export default function CookieNotice() {
  return (
    <LegalPageLayout type="cookies" title="Cookie Notice" lastUpdated="March 20, 2026">
      <LegalSection title="1. What Are Cookies">
        <p>
          Cookies are small text files that are stored on your device (computer, tablet, or mobile)
          when you visit a website. They are widely used to make websites function properly, improve
          user experience, and provide information to site owners. This Cookie Notice explains how
          HarvinAI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses cookies on{' '}
          <LegalLink href="https://www.harvin.ai">harvin.ai</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Types of Cookies We Use">
        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-2">2.1 Essential Cookies</h3>
        <p>
          These cookies are strictly necessary for the Service to function. They enable core
          features such as authentication, session management, and security. Without these cookies,
          the Service cannot operate properly.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08]">
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Cookie</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Purpose</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Duration</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-white/60">
              <tr className="border-b border-slate-100 dark:border-white/[0.04]">
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">session_token</td>
                <td className="py-3 px-4">Maintains your authenticated session</td>
                <td className="py-3 px-4">Session</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-white/[0.04]">
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">csrf_token</td>
                <td className="py-3 px-4">Protects against cross-site request forgery</td>
                <td className="py-3 px-4">Session</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">auth_state</td>
                <td className="py-3 px-4">Stores authentication state</td>
                <td className="py-3 px-4">7 days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-8 mb-2">2.2 Analytics Cookies</h3>
        <p>
          These cookies help us understand how visitors interact with our website by collecting and
          reporting information anonymously. We use this data to improve our Service.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08]">
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Cookie</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Purpose</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Duration</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-white/60">
              <tr className="border-b border-slate-100 dark:border-white/[0.04]">
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">_ga</td>
                <td className="py-3 px-4">Google Analytics: distinguishes unique users</td>
                <td className="py-3 px-4">2 years</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-white/[0.04]">
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">_ga_*</td>
                <td className="py-3 px-4">Google Analytics: maintains session state</td>
                <td className="py-3 px-4">2 years</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">_gid</td>
                <td className="py-3 px-4">Google Analytics: distinguishes users</td>
                <td className="py-3 px-4">24 hours</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-8 mb-2">2.3 Preference Cookies</h3>
        <p>
          These cookies allow the Service to remember choices you make (such as theme preferences or
          display settings) and provide enhanced, personalized features.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/[0.08]">
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Cookie</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Purpose</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-white/80">Duration</th>
              </tr>
            </thead>
            <tbody className="text-slate-600 dark:text-white/60">
              <tr className="border-b border-slate-100 dark:border-white/[0.04]">
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">theme</td>
                <td className="py-3 px-4">Stores your light/dark mode preference</td>
                <td className="py-3 px-4">1 year</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-sm text-[#C94C1E]">locale</td>
                <td className="py-3 px-4">Stores your language/region preference</td>
                <td className="py-3 px-4">1 year</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. Third-Party Cookies">
        <p>
          Some cookies on our site are set by third-party services that appear on our pages. We do
          not control the setting of these cookies. The third-party services we use include:
        </p>
        <LegalList
          items={[
            'Google Analytics: Provides website usage analytics. Google\'s use of cookies is governed by the Google Privacy Policy (https://policies.google.com/privacy).',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. How to Manage Cookies">
        <p>
          You can control and manage cookies in several ways. Please note that disabling certain
          cookies may affect the functionality of the Service.
        </p>

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-6 mb-2">4.1 Browser Settings</h3>
        <p>
          Most browsers allow you to view, manage, and delete cookies through their settings. The
          process varies by browser:
        </p>
        <LegalList
          items={[
            'Chrome: Settings > Privacy and Security > Cookies and other site data',
            'Firefox: Settings > Privacy & Security > Cookies and Site Data',
            'Safari: Preferences > Privacy > Manage Website Data',
            'Edge: Settings > Cookies and site permissions > Cookies and site data',
          ]}
        />

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-6 mb-2">
          4.2 Google Analytics Opt-Out
        </h3>
        <p>
          You can opt out of Google Analytics tracking by installing the{' '}
          <LegalLink href="https://tools.google.com/dlpage/gaoptout">
            Google Analytics Opt-out Browser Add-on
          </LegalLink>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. Changes to This Notice">
        <p>
          We may update this Cookie Notice from time to time to reflect changes in our practices or
          for other operational, legal, or regulatory reasons. Changes will be posted on this page
          with an updated &quot;Last updated&quot; date.
        </p>
      </LegalSection>

      <LegalContact />
    </LegalPageLayout>
  );
}
