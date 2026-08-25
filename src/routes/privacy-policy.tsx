import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { canonical, SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: `Privacy Policy | ${SITE_NAME}` },
      { name: "description", content: `Learn how ${SITE_NAME} collects, uses and protects personal information.` },
      { property: "og:title", content: `Privacy Policy | ${SITE_NAME}` },
      { property: "og:description", content: `How ${SITE_NAME} handles information used to run salon bookings and business accounts.` },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: canonical("/privacy-policy") }],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return <LegalPage title="Privacy Policy" updated="26 August 2026">
    <p>This Privacy Policy explains how Glowantey handles information when you use our salon appointment and business-management platform.</p>
    <LegalSection title="Information we collect"><p>We collect information you provide while creating and using an account, such as your name, mobile number, email address, salon and branch details, working hours, catalogue information, and photos you choose to upload. We may also collect technical information needed to secure and operate the service.</p></LegalSection>
    <LegalSection title="How we use information"><p>We use information to create and secure accounts, provide booking and business-management features, respond to support requests, prevent misuse, and improve the reliability of the platform. We do not sell personal information.</p></LegalSection>
    <LegalSection title="Information shared by salons"><p>Salon owners decide what business information is made available to their clients. Salon owners are responsible for ensuring they have a lawful basis to enter and manage customer information in Glowantey.</p></LegalSection>
    <LegalSection title="Storage and security"><p>We use reasonable technical and organisational safeguards designed to protect account information. No online service can guarantee absolute security, so please use a strong device lock and keep account access private.</p></LegalSection>
    <LegalSection title="Retention"><p>We retain information for as long as it is needed to operate the service, meet legal obligations, resolve disputes, and enforce agreements. You can request account deletion through your account controls; some records may be retained where required by law.</p></LegalSection>
    <LegalSection title="Your choices"><p>You can review and update your profile and salon information from the business dashboard. You may also request access, correction, or deletion of personal information, subject to applicable law and legitimate record-keeping requirements.</p></LegalSection>
    <LegalSection title="Changes to this policy"><p>We may update this policy as Glowantey evolves or legal requirements change. We will update the date on this page when we do. Your continued use of the platform after an update is subject to the revised policy.</p></LegalSection>
  </LegalPage>;
}
