import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { canonical, SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/terms-of-services")({
  head: () => ({
    meta: [
      { title: `Terms of Service | ${SITE_NAME}` },
      { name: "description", content: `Read the ${SITE_NAME} Terms of Service for salon owners and platform users.` },
      { property: "og:title", content: `Terms of Service | ${SITE_NAME}` },
      { property: "og:description", content: `The terms that govern use of the ${SITE_NAME} salon booking and business platform.` },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: canonical("/terms-of-services") }],
  }),
  component: TermsOfService,
});

function TermsOfService() {
  return <LegalPage title="Terms of Service" updated="26 August 2026">
    <p>These Terms of Service govern your use of Glowantey, including our salon appointment tools, business dashboard, and related services. By creating an account or using the platform, you agree to these terms.</p>
    <LegalSection title="Using Glowantey"><p>You may use Glowantey only in compliance with applicable law and for legitimate salon and beauty-service operations. Keep your account details accurate, safeguard access to your account, and notify us promptly if you believe it has been used without permission.</p></LegalSection>
    <LegalSection title="Salon accounts and content"><p>Salon owners are responsible for the information they publish through Glowantey, including service descriptions, prices, availability, staff details, images, and client communications. You confirm that you have the rights needed to upload content and that it does not violate another person’s rights.</p></LegalSection>
    <LegalSection title="Bookings and customer relationships"><p>Glowantey provides technology for managing appointments. The salon remains responsible for delivering booked services, setting policies, handling cancellations, and resolving service-related questions with its clients.</p></LegalSection>
    <LegalSection title="Acceptable use"><p>Do not misuse the platform, interfere with its operation, attempt unauthorised access, upload harmful material, or use Glowantey to send unsolicited or deceptive communications. We may suspend access where needed to protect users, the platform, or legal obligations.</p></LegalSection>
    <LegalSection title="Availability and changes"><p>We work to keep Glowantey available and secure, but cannot guarantee uninterrupted service. We may update, improve, or discontinue features when reasonably necessary. Where a material change affects your use, we will provide notice through the platform when practicable.</p></LegalSection>
    <LegalSection title="Limitation of liability"><p>To the extent allowed by law, Glowantey is provided on an “as available” basis. We are not responsible for indirect losses, lost profits, or disputes arising from salon services delivered by independent businesses using the platform.</p></LegalSection>
    <LegalSection title="Contact and changes to these terms"><p>We may revise these terms to reflect changes to the service or applicable law. The updated date will appear on this page. Continued use after an update means you accept the revised terms.</p></LegalSection>
  </LegalPage>;
}
