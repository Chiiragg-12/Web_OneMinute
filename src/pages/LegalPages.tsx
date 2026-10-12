import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';

function LegalShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f8f6] px-4 py-8 text-slate-800 sm:px-8">
      <header className="mx-auto flex max-w-4xl items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <Link to="/" aria-label="OneMinute Healthcare home" className="flex items-center gap-3">
          <BrandLogo />
          <span className="hidden font-display text-lg font-semibold text-slate-950 sm:inline">OneMinute Healthcare</span>
        </Link>
        <Link to="/login" className="text-sm font-semibold text-teal-700 hover:text-teal-900">Sign in</Link>
      </header>
      <main className="mx-auto mt-8 max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">OneMinute Healthcare</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{intro}</p>
        <div className="mt-10 space-y-9 text-sm leading-7 text-slate-600">{children}</div>
        <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <p>Questions about this page or your account? Contact OneMinute Healthcare support through the contact details provided by your clinic.</p>
          <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-semibold text-teal-700" aria-label="Legal pages">
            <Link to="/privacy" className="hover:text-teal-900">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-teal-900">Terms of Service</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="font-display text-2xl font-semibold text-slate-950">{title}</h2><div className="mt-3 space-y-3">{children}</div></section>;
}

export function PrivacyPolicyPage() {
  return <LegalShell title="Privacy Policy" intro="This policy explains how OneMinute Healthcare handles information when you use our patient, doctor, or receptionist applications. It is written around the features currently available in the service.">
    <Section title="Information we collect"><p>We collect account details such as your name, email address, phone number, role, and authentication records. Patient profiles may include a permanent Health ID, date of birth, sex, height, weight, BMI, family-member details, and health records that you choose to provide.</p><p>When you use the service, we also process appointment details, consultation mode, clinic and doctor selections, queue and token information, check-in or location signals where an in-person flow requests them, messages or notes entered in forms, and prescription information created or shared through the service.</p></Section>
    <Section title="How we use information"><p>We use this information to create and protect accounts, show the correct clinic and doctor options, book and manage appointments, operate queues and trackers, support consultation workflows, record payment states, provide patient and clinic history, and help authorized staff deliver care operations.</p><p>We use information only for the service purposes described here and for troubleshooting, abuse prevention, security, and legally required recordkeeping.</p></Section>
    <Section title="Google sign-in"><p>If you use Google sign-in, Google provides identity information such as your verified email address and provider account identifier. We use it to find or create the account and to maintain the role and clinic relationship selected during onboarding. Google sign-in is optional; you can use the available password-based account flow instead.</p></Section>
    <Section title="Payments and payment providers"><p>The service records payment selections and payment states for appointments. Where Razorpay is enabled, payment and refund requests are handled through Razorpay's service and the application stores the identifiers and statuses needed to reconcile the appointment. We do not display payment as successful merely because a checkout screen was opened; server verification is required.</p><p>For in-person appointments, a receptionist or clinic may record an allowed cash, UPI, or other clinic collection method. The clinic's records determine the payment state shown in the application.</p></Section>
    <Section title="Security"><p>We use account authentication, role checks, clinic scoping, ownership checks, server-side validation, and transaction safeguards to protect records. No online service can promise that unauthorized access, service interruption, or data loss is impossible. Keep your credentials private and sign out on shared devices.</p></Section>
    <Section title="Retention"><p>We retain account, appointment, payment, queue, prescription, and audit-related information for as long as needed to provide the service, support clinic operations, resolve disputes, maintain financial records, or meet applicable legal obligations. Retention periods can depend on the type of record and the clinic relationship.</p></Section>
    <Section title="Your choices and rights"><p>You may review and update information made available in your profile, use the account controls provided in the application, and ask the clinic or OneMinute support about access, correction, deletion, or questions concerning your information. Some records may need to be retained for operational, financial, safety, or legal reasons.</p></Section>
    <Section title="Contact and updates"><p>For privacy questions, account requests, or support, contact OneMinute Healthcare through the support contact provided by your clinic or account materials. We may update this policy when the service or legal requirements change. The effective version will be made available on this page.</p><p>Last updated: September 21, 2026.</p></Section>
  </LegalShell>;
}

export function TermsOfServicePage() {
  return <LegalShell title="Terms of Service" intro="These terms describe the rules for using OneMinute Healthcare's patient, doctor, receptionist, and clinic workflows. By using the service, you agree to follow them.">
    <Section title="Account use"><p>Provide accurate information, keep your credentials secure, and use only the account and role assigned to you. You are responsible for activity performed through your account and must tell us or your clinic if you believe it has been misused.</p><p>Role-based access is intentional. Do not attempt to use another person's account, bypass an ownership check, or access a clinic, patient, doctor, or appointment that is not available to you.</p></Section>
    <Section title="Our healthcare platform role"><p>OneMinute Healthcare provides software for account management, clinic discovery, appointment coordination, queue tracking, payment recording, consultation operations, and prescription records. The service is not a substitute for emergency care or independent professional judgment. Doctors and clinics remain responsible for the care, advice, diagnosis, treatment, and records they provide.</p></Section>
    <Section title="Appointments and consultations"><p>Appointment availability, price, duration, clinic timezone, consultation mode, token eligibility, and status are determined by the service and the participating clinic or doctor. A booking is subject to the confirmation and payment state shown by the application.</p><p>Cancellation, no-show, queue, check-in, and consultation-start rules can differ by appointment state and whether a token has been issued. Do not assume that a cancellation request is available after queue participation has begun.</p></Section>
    <Section title="Payments and refunds"><p>Payment selection is not the same as successful settlement. Online payments require server-side verification through the configured payment provider. Clinic-collected payments are recorded by authorized clinic staff. Refunds, when eligible, follow the appointment state, payment method, provider response, and the records maintained by the service and clinic.</p><p>Prices shown by the service are supplied by the relevant doctor or clinic and may change before a new booking. Provider checkout availability may depend on external configuration.</p></Section>
    <Section title="User responsibilities"><p>Use the service lawfully and provide information needed for safe appointment coordination. Do not submit misleading records, share private health information without appropriate authority, interfere with queues or tokens, impersonate another person, upload malicious content, or use automated access to disrupt the service.</p></Section>
    <Section title="Doctor and clinic responsibilities"><p>Doctors and clinics are responsible for maintaining accurate professional, clinic, consultation, pricing, availability, patient-care, payment-collection, and prescription information. Authorized staff must use clinic-scoped tools only for legitimate operations and must protect patient confidentiality.</p></Section>
    <Section title="Prohibited use"><p>You may not probe or bypass authentication, role or clinic isolation, manipulate appointment or payment state, create duplicate or fraudulent accounts, misuse location or check-in features, copy private records, interfere with provider requests, or use the service to harm another person or the service itself.</p></Section>
    <Section title="Service availability and liability"><p>We aim to keep the service available and accurate, but features may be unavailable because of maintenance, provider outages, network conditions, device issues, incorrect information, or events outside our control. To the extent permitted by law, OneMinute Healthcare is not responsible for indirect loss arising from an interruption, missed appointment, provider action, or reliance on information that a user or clinic entered incorrectly.</p></Section>
    <Section title="Termination"><p>We may suspend or terminate access for security reasons, prohibited use, unpaid or disputed obligations, legal requirements, or breach of these terms. You may stop using the service and request account assistance through the available support channel. Records that must be retained may remain after access ends.</p></Section>
    <Section title="Changes, governing law, and contact"><p>We may update these terms as the service changes. Continued use after an updated version is posted means you accept the revised terms. These terms are governed by the laws applicable to the service operator and the applicable courts of India, subject to mandatory rights under applicable law.</p><p>For questions or support, contact OneMinute Healthcare through the support contact provided by your clinic or account materials.</p><p>Last updated: September 21, 2026.</p></Section>
  </LegalShell>;
}
