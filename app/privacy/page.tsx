'use client';

import LegalPageLayout, {
  LegalSection,
  LegalList,
  LegalLink,
  LegalContact,
} from '@/components/LegalPageLayout';

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout type="privacy" title="Privacy Policy" lastUpdated="March 20, 2026">
      <LegalSection title="1. Introduction">
        <p>
          HarvinAI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the D2C Brand
          Intelligence Platform available at{' '}
          <LegalLink href="https://www.harvin.ai">harvin.ai</LegalLink> and the HarvinAI Chrome
          Extension (collectively, the &quot;Service&quot;). This Privacy Policy explains how we
          collect, use, store, and protect your information when you use our Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-2 mb-1">2.1 Account Information</h3>
        <p>
          When you create an account, we collect your name, email address, company name, and any
          other information you provide during registration or onboarding.
        </p>

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-1">2.2 Technology Scan Data</h3>
        <p>
          When you use our platform or Chrome extension to scan a website, we collect the technology
          stack detection results, brand classification data, and market signals associated with the
          scanned domains.
        </p>

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-1">2.3 Chrome Extension Data</h3>
        <p>
          Our Chrome extension captures HTML content, scripts, and cookies from the active tab{' '}
          <strong>only when you explicitly click</strong> the scan button. We do not passively
          monitor your browsing activity. Data is captured on-demand and transmitted securely to our
          servers for analysis.
        </p>

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-1">2.4 Usage Data</h3>
        <p>
          We automatically collect certain information about how you interact with our Service,
          including pages visited, features used, browser type, device information, and IP address.
        </p>
      </LegalSection>

      <LegalSection title="3. How We Use Your Information">
        <LegalList
          items={[
            'Technology Detection: To identify and classify the technology stacks used by D2C brands.',
            'Brand Classification: To categorize and analyze brands based on their digital footprint.',
            'Market Signal Extraction: To generate insights and intelligence from publicly available web data using AI.',
            'Analytics & Improvement: To understand usage patterns and improve the Service.',
            'Communication: To send you service-related notifications, updates, and support responses.',
            'Security: To detect, prevent, and address technical issues and abuse.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Data Storage">
        <p>
          Your data is stored in MongoDB databases hosted on secure cloud infrastructure. We
          implement industry-standard security measures including encryption in transit and at rest
          to protect your data.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Retention">
        <LegalList
          items={[
            'Scan logs and raw scan data: Retained for 90 days from the date of capture, after which they are automatically purged.',
            'Account data: Retained for as long as your account is active. Upon account deletion, your personal data will be removed within 30 days.',
            'Aggregated analytics data: May be retained indefinitely in anonymized form.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. No Sale of Personal Data">
        <p>
          We do not sell, rent, or trade your personal information to third parties. We may share
          aggregated, anonymized data that cannot reasonably be used to identify you.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookies">
        <p>We use the following types of cookies:</p>
        <LegalList
          items={[
            'Essential Cookies: Required for authentication, session management, and core platform functionality.',
            'Analytics Cookies: Used via Google Analytics to understand how users interact with our Service.',
            'Preference Cookies: Used to remember your settings and preferences (e.g., dark mode).',
          ]}
        />
        <p className="mt-2">
          For more details, please see our <LegalLink href="/cookies">Cookie Notice</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-Party Services">
        <p>We use the following third-party services:</p>
        <LegalList
          items={[
            'Google Analytics: For website and platform usage analytics. Google may collect data in accordance with its own privacy policy.',
            'Groq AI: For AI-powered signal extraction and analysis. Data sent to Groq is limited to publicly available web content necessary for processing.',
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Your Rights">
        <p>You have the right to:</p>
        <LegalList
          items={[
            'Access: Request a copy of the personal data we hold about you.',
            'Deletion: Request that we delete your personal data, subject to any legal retention obligations.',
            'Export: Request a machine-readable export of your data.',
            'Correction: Request correction of inaccurate personal data.',
            'Objection: Object to certain processing of your data.',
          ]}
        />
        <p className="mt-2">
          To exercise any of these rights, please contact us at{' '}
          <LegalLink href="mailto:admin@harvin.ai">admin@harvin.ai</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="10. GDPR Compliance">
        <p>
          If you are located in the European Economic Area (EEA), you have additional rights under
          the General Data Protection Regulation (GDPR). We process your data based on legitimate
          interest (to provide and improve our Service), consent (where explicitly given), and
          contractual necessity (to fulfil our obligations to you). You may withdraw consent at any
          time by contacting us.
        </p>
      </LegalSection>

      <LegalSection title="11. CCPA Compliance">
        <p>
          If you are a California resident, you have the right to know what personal information we
          collect, request its deletion, and opt out of any sale of personal information. As stated
          above, we do not sell personal information. To exercise your CCPA rights, contact us at{' '}
          <LegalLink href="mailto:admin@harvin.ai">admin@harvin.ai</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="12. Children's Privacy">
        <p>
          Our Service is not directed to individuals under the age of 18. We do not knowingly
          collect personal information from children. If we become aware that we have collected data
          from a child, we will delete it promptly.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by posting the updated policy on this page and updating the &quot;Last
          updated&quot; date. Your continued use of the Service after any changes constitutes
          acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalContact />
    </LegalPageLayout>
  );
}
