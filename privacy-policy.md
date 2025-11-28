# Privacy Policy

**Last updated: November 26, 2025**

## Our Privacy Philosophy

We built this site with privacy as an engineering principle, not a legal checkbox. You get full functionality without consenting to tracking. Your data stays yours.

---

## What We Collect and Why

### Without Your Consent (Default)

When you visit our site **without accepting tracking**, we collect:

- **Anonymous page views**: Which pages are popular (no profile linkage)
- **Anonymous engagement metrics**: Total likes, copies, searches (aggregated only)
- **Functional data**: Your snippet likes/copies are saved so the site works, but not linked to a user profile

**Legal basis**: Legitimate business interest (GDPR Article 6(1)(f)). This data is fully anonymized and cannot be used to identify or profile you.

### With Your Consent (If You Click "Accept")

When you **accept tracking**, we additionally collect:

- **User journey data**: Which pages you visit in sequence
- **Profile-linked engagement**: Your likes/copies are associated with your anonymous profile
- **Personalization data**: Used to recommend content you might like
- **Analytics notifications**: We get alerts about engagement

**Legal basis**: Explicit consent (GDPR Article 6(1)(a)). You can withdraw consent anytime by clicking "Manage Preferences" in the footer.

### Account Creation (Optional)

When you **create an account**, we collect:

- **Email address**: For authentication and account recovery
- **Name**: To personalize your experience
- **Profile preferences**: Your saved snippets, likes, and settings

**Legal basis**: Contractual necessity (GDPR Article 6(1)(b)). Delete your account anytime from settings.

### Newsletter Subscription

When you **subscribe to our newsletter**, we collect:

- **Email address**: To send you content
- **Name**: To personalize emails
- **Subscription preferences**: Which topics interest you

**Legal basis**: Consent (GDPR Article 6(1)(a)). Unsubscribe anytime via the link in every email.

---

## How Consent Works

### Cookie Consent Banner

When you first visit, you see a consent banner with two options:

- **"Accept"**: Enables profile tracking, personalization, and analytics
- **"Decline"**: Site works fully, but we only collect anonymous aggregated data

Your choice is stored in a cookie (`cookie-consent`) for 1 year. Change your mind anytime via footer link.

### What Happens to Your Data

**Without consent:**
```
Event → Stored anonymously (identity = NULL) → Aggregated metrics only
Like → Saved to database → Count displayed → No profile linkage
```

**With consent:**
```
Event → Stored with profile link → Journey tracking → Personalization enabled
Like → Saved to database → Linked to your profile → Recommendations possible
```

### Technical Implementation

We don't just say we respect privacy—our **database enforces it**:

- Events without consent have `NULL` identity fields (can't build user profiles)
- Events with consent store full identity (enables personalization)
- You can query your data anytime by requesting your profile export

---

## Third-Party Services

We use the following third-party services:

### Email (Resend)
- **Purpose**: Send newsletter emails
- **Data shared**: Email, name, subscription preferences
- **Privacy policy**: [resend.com/legal/privacy-policy](https://resend.com/legal/privacy-policy)

### Hosting (Cloudflare Workers)
- **Purpose**: Host our backend API
- **Data shared**: IP address (for rate limiting), request data
- **Privacy policy**: [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/)

### Database (Supabase)
- **Purpose**: Store profiles, events, content
- **Data shared**: All collected data listed above
- **Privacy policy**: [supabase.com/privacy](https://supabase.com/privacy)

### Analytics Notifications
- **Purpose**: Alert us when users engage with content (only with consent)
- **Data shared**: Event type, snippet title (no email/personal info)
- **Privacy policy**: [telegram.org/privacy](https://telegram.org/privacy)

**We do NOT use:**
- ❌ Google Analytics
- ❌ Facebook Pixel
- ❌ Third-party ad networks
- ❌ Data brokers

---

## Your Rights (GDPR)

You have the following rights regarding your personal data:

### Right to Access
Request a copy of all data we have about you. Email us at hello@lucascosta.tech.

### Right to Rectification
Correct inaccurate data. Update your profile or email preferences anytime.

### Right to Erasure ("Right to be Forgotten")
Delete your data completely. Email us and we'll remove everything within 30 days.

### Right to Restrict Processing
Pause processing of your data while we investigate a concern.

### Right to Data Portability
Export your data in machine-readable format (JSON).

### Right to Object
Object to processing based on legitimate interest (we'll stop unless we have compelling reasons).

### Right to Withdraw Consent
Change tracking consent anytime via "Manage Preferences" in footer.

**To exercise these rights**: Email hello@lucascosta.tech with your request. We respond within 30 days.

---

## Data Retention

- **Anonymous events**: Kept indefinitely (aggregated business metrics)
- **Profile-linked events**: Kept until you request deletion or withdraw consent
- **Newsletter subscriptions**: Kept until you unsubscribe
- **Inactive profiles**: Deleted after 2 years of no activity

---

## Data Security

We implement security best practices:

- **Encryption in transit**: All data sent via HTTPS/TLS
- **Encryption at rest**: Database encrypted at rest
- **Access control**: Role-based access to data
- **Passwordless authentication**: We use magic links (no passwords to leak)
- **Regular backups**: Encrypted daily backups

However, no system is 100% secure. If a breach occurs, we'll notify you within 72 hours per GDPR requirements.

---

## Children's Privacy

Our site is not directed at children under 16. We don't knowingly collect data from children. If you believe we have, contact us immediately and we'll delete it.

---

## International Data Transfers

Your data may be processed in:

- **EU**: Supabase (database) is hosted in EU region
- **US**: Cloudflare (CDN/workers) and Resend (email) are US-based

Transfers to US are covered by **Standard Contractual Clauses (SCCs)** approved by the European Commission.

---

## Changes to This Policy

We may update this policy to reflect:

- New features or functionality
- Legal or regulatory changes
- User feedback

**When we make changes**:
1. Update "Last updated" date at top
2. Notify newsletter subscribers via email
3. Show notice on site for 30 days

**Material changes** (like new data collection) require fresh consent from existing users.

---

## Transparency Commitment

We believe in radical transparency:

- **Open source**: Our consent implementation is documented in our codebase
- **No dark patterns**: "Accept" and "Decline" are equal-sized buttons
- **Functional without consent**: You don't need to accept tracking to use the site
- **Clear explanations**: No legalese—we explain in plain English

Questions about our implementation? We're happy to explain how it works.

---

## Contact Us

**Email**: hello@lucascosta.tech  
**Response time**: Within 48 hours for privacy requests  

For privacy concerns or data requests, email us with:
1. Subject line: "Privacy Request"
2. Your email address (so we can find your data)
3. Your specific request

We take privacy seriously. Every request is handled personally, not by automated systems.

---

## Cookie Policy

### Essential Cookies

- **`anon_id`**: Anonymous identifier (1 year)
  - **Purpose**: Core functionality (likes, copies persist across visits)
  - **Cannot be disabled**: Site won't work without it

### Preference Cookies

- **`cookie-consent`**: Your tracking preference (1 year)
  - **Purpose**: Remember your consent choice
  - **Values**: `granted` or `denied`

**We do not use third-party advertising or tracking cookies.**

---

*This policy is written in plain English intentionally. If anything is unclear, please ask—we're happy to explain.*
