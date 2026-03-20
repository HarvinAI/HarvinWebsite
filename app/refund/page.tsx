'use client';

import LegalPageLayout, {
  LegalSection,
  LegalList,
  LegalLink,
  LegalContact,
} from '@/components/LegalPageLayout';

export default function RefundPolicy() {
  return (
    <LegalPageLayout type="refund" title="Refund Policy" lastUpdated="March 20, 2026">
      <LegalSection title="1. Early Access Program">
        <p>
          HarvinAI is currently in <strong>Early Access</strong> and is offered free of charge.
          During this period, no payments are collected, and therefore no refunds are applicable.
        </p>
        <p className="mt-2">
          We may introduce paid subscription plans in the future. When paid plans become available,
          this Refund Policy will govern all refund-related matters.
        </p>
      </LegalSection>

      <LegalSection title="2. Future Paid Plans">
        <p>
          When paid plans are introduced, the following refund terms will apply:
        </p>
        <LegalList
          items={[
            'All paid subscriptions will include a 14-day refund window from the date of purchase.',
            'Refunds requested within this 14-day window will be processed in full, no questions asked.',
            'Refund requests made after the 14-day window will be evaluated on a case-by-case basis at our discretion.',
            'Refunds for annual plans will be prorated based on the unused portion of the subscription period, provided the request is made within the first 30 days.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Non-Refundable Items">
        <p>The following are not eligible for refunds:</p>
        <LegalList
          items={[
            'One-time setup fees or onboarding charges, if applicable.',
            'Add-on services or premium features that have been fully consumed or delivered.',
          ]}
        />
        <p className="mt-2">
          Accounts terminated for violation of our{' '}
          <LegalLink href="/terms">Terms and Conditions</LegalLink> or{' '}
          <LegalLink href="/acceptable-use">Acceptable Use Policy</LegalLink> are also not eligible
          for refunds.
        </p>
      </LegalSection>

      <LegalSection title="4. How to Request a Refund">
        <p>To request a refund, please follow these steps:</p>
        <LegalList
          items={[
            'Send an email to admin@harvin.ai with the subject line "Refund Request."',
            'Include your account email address and the date of purchase.',
            'Provide a brief reason for the refund request (optional but helpful).',
          ]}
        />
        <p className="mt-2">
          We will acknowledge your request within 2 business days and process approved refunds
          within 7-10 business days. Refunds will be issued to the original payment method.
        </p>
      </LegalSection>

      <LegalSection title="5. Cancellation">
        <p>
          You may cancel your subscription at any time through your account settings or by
          contacting us. Upon cancellation:
        </p>
        <LegalList
          items={[
            'Your access will continue until the end of the current billing period.',
            'No further charges will be made.',
            'Cancellation alone does not entitle you to a refund; please submit a refund request separately if applicable.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Changes to This Policy">
        <p>
          We may update this Refund Policy from time to time. Any changes will be posted on this
          page with an updated &quot;Last updated&quot; date. Changes will not apply retroactively
          to purchases made before the update.
        </p>
      </LegalSection>

      <LegalContact />
    </LegalPageLayout>
  );
}
