'use client';

import LegalPageLayout, {
  LegalSection,
  LegalList,
  LegalLink,
  LegalContact,
} from '@/components/LegalPageLayout';

export default function TermsAndConditions() {
  return (
    <LegalPageLayout type="terms" title="Terms and Conditions" lastUpdated="March 20, 2026">
      <LegalSection title="1. Agreement to Terms">
        <p>
          By accessing or using the HarvinAI platform at{' '}
          <LegalLink href="https://www.harvin.ai">harvin.ai</LegalLink>, the HarvinAI Chrome
          Extension, or any related services (collectively, the &quot;Service&quot;), you agree to
          be bound by these Terms and Conditions (&quot;Terms&quot;). If you do not agree to these
          Terms, you must not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of Service">
        <p>
          HarvinAI is a D2C Brand Intelligence Platform that provides technology stack detection,
          brand classification, market signal extraction, and related analytics tools. The Service
          includes a web-based dashboard and a Chrome browser extension that enables users to scan
          websites for technology and brand intelligence data.
        </p>
      </LegalSection>

      <LegalSection title="3. Account Registration">
        <p>
          To access certain features of the Service, you must create an account. You agree to:
        </p>
        <LegalList
          items={[
            'Provide accurate, current, and complete information during registration.',
            'Maintain and promptly update your account information to keep it accurate and complete.',
            'Maintain the security and confidentiality of your login credentials.',
            'Accept responsibility for all activities that occur under your account.',
            'Notify us immediately of any unauthorized use of your account.',
          ]}
        />
        <p className="mt-2">
          We reserve the right to suspend or terminate accounts that violate these Terms or that
          have been inactive for an extended period.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <LegalList
          items={[
            'Violate any applicable local, national, or international law or regulation.',
            'Infringe upon the intellectual property rights of any third party.',
            'Attempt to gain unauthorized access to any part of the Service, other accounts, or related systems.',
            'Use automated means (bots, scrapers, crawlers) to access the Service beyond the intended functionality of the Chrome extension.',
            'Reverse engineer, decompile, or disassemble any aspect of the Service.',
            'Resell, redistribute, or sublicense any data obtained through the Service without prior written consent.',
            'Interfere with or disrupt the integrity or performance of the Service.',
          ]}
        />
        <p className="mt-2">
          For full details, please see our{' '}
          <LegalLink href="/acceptable-use">Acceptable Use Policy</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="5. Intellectual Property">
        <p>
          All content, features, functionality, software, and design elements of the Service are
          owned by HarvinAI and are protected by copyright, trademark, and other intellectual
          property laws. You may not copy, modify, distribute, or create derivative works based on
          our Service without our express written permission.
        </p>
        <p className="mt-2">
          You retain ownership of any data you provide to us. By using the Service, you grant
          HarvinAI a limited, non-exclusive license to process your data solely for the purpose of
          providing and improving the Service.
        </p>
      </LegalSection>

      <LegalSection title="6. Data and Privacy">
        <p>
          Your use of the Service is also governed by our{' '}
          <LegalLink href="/privacy">Privacy Policy</LegalLink>, which describes how we collect,
          use, and protect your information. By using the Service, you consent to our data practices
          as described in the Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="7. Service Availability">
        <p>
          We strive to ensure that the Service is available at all times; however, we do not
          guarantee uninterrupted or error-free operation. We reserve the right to modify, suspend,
          or discontinue any part of the Service at any time, with or without notice. We shall not
          be liable for any modification, suspension, or discontinuation of the Service.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, HarvinAI and its officers, directors,
          employees, and agents shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages, including but not limited to loss of profits, data, or
          goodwill, arising out of or in connection with your use of the Service.
        </p>
        <p className="mt-2">
          In no event shall our total liability exceed the amount you have paid to us in the twelve
          (12) months preceding the event giving rise to the claim, or one hundred US dollars (USD
          $100), whichever is greater.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer of Warranties">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties
          of any kind, whether express or implied, including but not limited to implied warranties of
          merchantability, fitness for a particular purpose, and non-infringement. We do not warrant
          that the data or insights provided through the Service will be accurate, complete, or
          current.
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless HarvinAI and its officers, directors,
          employees, and agents from and against any claims, liabilities, damages, losses, and
          expenses (including reasonable legal fees) arising out of or in connection with your use of
          the Service or your violation of these Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Termination">
        <p>
          We may terminate or suspend your access to the Service immediately, without prior notice
          or liability, for any reason, including if you breach these Terms. Upon termination, your
          right to use the Service will cease immediately. Provisions that by their nature should
          survive termination shall remain in effect, including intellectual property provisions,
          disclaimers, limitations of liability, and indemnification.
        </p>
      </LegalSection>

      <LegalSection title="12. Governing Law and Jurisdiction">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of India. Any
          disputes arising out of or relating to these Terms or the Service shall be subject to the
          exclusive jurisdiction of the courts located in India.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to These Terms">
        <p>
          We reserve the right to modify these Terms at any time. We will notify you of material
          changes by posting the updated Terms on this page and updating the &quot;Last
          updated&quot; date. Your continued use of the Service after any changes constitutes
          acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalContact />
    </LegalPageLayout>
  );
}
