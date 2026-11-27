// @ts-check
/**
 * @file Sample data for demonstration and testing.
 * Contains realistic but entirely FAKE PII data.
 * @module samples
 */

/**
 * Sample text — a noisy support ticket + log + resume mash-up.
 * All data is completely fictional.
 * @type {string}
 */
export const SAMPLE_TEXT = `SUPPORT TICKET #TKT-20240315-0042
Date: 2024-03-15T14:23:07Z | Priority: HIGH | Agent: bot-7x
UUID: 550e8400-e29b-41d4-a716-446655440000

Customer: John Doe
Email: John.Doe@Example.com
Alternate email: john.doe@example.com
Phone: +91 98765 43210
Alternate phone: 09876543210

Hi, I'm having trouble with my order #ORD-98765. I paid ₹1,23,456.00 via card 4111 1111 1111 1111 on 2024-03-15.

My backup card is 5500-0000-0000-0004 (Mastercard).
Corporate Amex: 378282246310005

PAN: ABCPE1234F (also referenced as abcpe1234f in the old system)
Aadhaar: 2345 6789 0124

---
INTERNAL LOG (do not share):
Timestamp: 2024-03-15T14:25:00Z
Agent IP: 192.168.1.10
User connected from: 192.168.1.10 (second hit)
Proxy server: 10.0.0.5
IPv6 gateway: 2001:db8::1

<script>alert(1)</script>

Colleague contact: priya.sharma@corp.in
Support lead: helpdesk@privify.dev
US support line: (555) 123-4567
International: +1-202-555-0147

Aadhaar (secondary): 9876-5432-1096
Aadhaar (test/invalid checksum): 2345 6789 0125

---
RESUME EXTRACT:
Name: John Doe
PAN: ABCPE1234F
Version: v1.2.3

Decoy tests (should NOT be detected):
- Invalid IP: 999.1.1.1
- Invalid PAN (4th char D): ABCDE1234F
- Luhn-fail card: 1234 5678 9012 3456
- Luhn-fail card2: 4111111111111112
- Version string: 1.2.3.4.5
- Price: $99.99 and ₹1,23,456.00
`;

/**
 * Sample CSV content with PII in fields.
 * @type {string}
 */
export const SAMPLE_CSV = `Name,Email,Phone,PAN,Notes
"John Doe",John.Doe@Example.com,+91 98765 43210,ABCPE1234F,"Card: 4111 1111 1111 1111"
"Priya Sharma",priya.sharma@corp.in,(555) 123-4567,ABCPE1234F,"Aadhaar: 2345 6789 0124"
"=SUM(A1:A3)","@cmd","test","ABCDE1234F","Normal text"
`;
