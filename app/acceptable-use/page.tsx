'use client';

import LegalPageLayout, {
  LegalSection,
  LegalList,
  LegalLink,
  LegalContact,
} from '@/components/LegalPageLayout';

export default function AcceptableUsePolicy() {
  return (
    <LegalPageLayout
      type="acceptable-use"
      title="Acceptable Use Policy"
      lastUpdated="March 20, 2026"
    >
      <LegalSection title="1. Introduction">
        <p>
          This Acceptable Use Policy (&quot;AUP&quot;) governs your use of the HarvinAI platform,
          Chrome extension, and all related services (collectively, the &quot;Service&quot;). This
          AUP is part of and supplements our{' '}
          <LegalLink href="/terms">Terms and Conditions</LegalLink>. By using the Service, you
          agree to comply with this AUP.
        </p>
      </LegalSection>

      <LegalSection title="2. Prohibited Activities">
        <p>You must not use the Service to:</p>

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-1">
          2.1 Scraping and Automated Abuse
        </h3>
        <LegalList
          items={[
            'Deploy automated scripts, bots, or crawlers to interact with the Service beyond the intended functionality of the Chrome extension.',
            'Perform mass or bulk scanning operations that exceed reasonable usage limits.',
            'Use the Service to systematically harvest or scrape data from third-party websites in a manner that violates those websites\' terms of service.',
          ]}
        />

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-1">
          2.2 Reverse Engineering
        </h3>
        <LegalList
          items={[
            'Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code, algorithms, or data models of the Service.',
            'Attempt to bypass, circumvent, or disable any security features, access controls, or usage limitations of the Service.',
            'Probe, scan, or test the vulnerability of the Service without prior written authorization.',
          ]}
        />

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-1">
          2.3 Data Resale and Unauthorized Distribution
        </h3>
        <LegalList
          items={[
            'Resell, redistribute, sublicense, or commercially exploit any data, insights, or reports obtained through the Service without prior written consent from HarvinAI.',
            'Share account credentials or access with unauthorized third parties.',
            'Create derivative databases or datasets from Service outputs for distribution or sale.',
          ]}
        />

        <h3 className="text-[16px] font-semibold text-slate-800 dark:text-white/80 mt-4 mb-1">
          2.4 Harmful or Illegal Activities
        </h3>
        <LegalList
          items={[
            'Use the Service for any purpose that is illegal, fraudulent, or harmful.',
            'Use data obtained from the Service to harass, stalk, or harm individuals or organizations.',
            'Transmit malware, viruses, or other harmful code through the Service.',
            'Use the Service in a manner that could damage, disable, overburden, or impair our servers or infrastructure.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Rate Limits">
        <p>
          To ensure fair usage and maintain service quality for all users, the following rate limits
          apply:
        </p>
        <LegalList
          items={[
            'API and extension scan requests are subject to per-account rate limits. Specific limits are communicated in your account dashboard and may vary by plan.',
            'Exceeding rate limits may result in temporary throttling or suspension of access.',
            'Repeated or intentional rate limit violations may result in permanent account suspension.',
          ]}
        />
        <p className="mt-2">
          If you require higher limits for legitimate business use, please contact us at{' '}
          <LegalLink href="mailto:admin@harvin.ai">admin@harvin.ai</LegalLink> to discuss custom
          arrangements.
        </p>
      </LegalSection>

      <LegalSection title="4. Chrome Extension Usage Rules">
        <p>When using the HarvinAI Chrome Extension, you agree to:</p>
        <LegalList
          items={[
            'Use the extension only for its intended purpose: scanning websites for technology stack detection and brand intelligence.',
            'Not modify, tamper with, or redistribute the extension code.',
            'Not use the extension to collect personal data of individuals visiting the scanned websites.',
            'Understand that the extension captures page data only upon explicit user action (clicking the scan button) and not passively.',
            'Not use the extension on websites where such scanning is explicitly prohibited by the website\'s terms of service, to the extent you are aware of such restrictions.',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Account Responsibilities">
        <LegalList
          items={[
            'You are solely responsible for all activity that occurs under your account.',
            'You must keep your login credentials confidential and must not share them with unauthorized individuals.',
          ]}
        />
        <p className="mt-2">
          You must notify us immediately at{' '}
          <LegalLink href="mailto:admin@harvin.ai">admin@harvin.ai</LegalLink> if you suspect
          unauthorized access to your account.
        </p>
        <LegalList
          items={[
            'You are responsible for ensuring that your use of the Service complies with all applicable laws and regulations.',
            'Organizations are responsible for ensuring that all employees or agents using the Service under their account comply with this AUP.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Enforcement">
        <p>
          We reserve the right to investigate any suspected violations of this AUP. If we determine,
          at our sole discretion, that a violation has occurred, we may take any of the following
          actions:
        </p>
        <LegalList
          items={[
            'Issue a warning to the account holder.',
            'Temporarily suspend access to the Service.',
            'Permanently terminate the account.',
            'Report the activity to the relevant law enforcement authorities.',
            'Pursue legal remedies, including claims for damages.',
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Reporting Violations">
        <p>
          If you become aware of any violation of this AUP, please report it to us at{' '}
          <LegalLink href="mailto:admin@harvin.ai">admin@harvin.ai</LegalLink>. We take all
          reports seriously and will investigate promptly.
        </p>
      </LegalSection>

      <LegalSection title="8. Changes to This Policy">
        <p>
          We may update this Acceptable Use Policy from time to time. Changes will be posted on this
          page with an updated &quot;Last updated&quot; date. Your continued use of the Service
          after any changes constitutes acceptance of the revised AUP.
        </p>
      </LegalSection>

      <LegalContact />
    </LegalPageLayout>
  );
}
