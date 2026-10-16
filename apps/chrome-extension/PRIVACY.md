# Meanbox Chrome Extension — Privacy Policy

**Last updated:** 12 October 2026  
**Extension:** Meanbox (Chrome)  

**Provider:** Royal Solution (“we”, “us”, or “Provider”)  
**Related service:** https://meanbox.vercel.app (the “Service”)

This Privacy Policy explains how the **Meanbox Chrome extension** (the “Add-on”) handles information. It supplements the [End-User License Agreement](./EULA.md). Use of the Meanbox website and account features may also be covered by privacy terms on the Service; where they conflict for **add-on-only** behavior, this policy controls for the Add-on.

By installing or using the Add-on, you acknowledge this policy. If you do not agree, uninstall the Add-on.

This policy is **not** issued by Google. Chrome and the Chrome Web Store have their own privacy notices.

---

## 1. Summary

| Topic | Practice |
|--------|----------|
| Who processes data | Royal Solution via the Meanbox Service you configure (default `https://meanbox.vercel.app`) |
| Stored only in the browser | Settings (`chrome.storage.sync`) and generated history on this device (`chrome.storage.local`) when you are not signed in — or as a local copy when you are |
| Sent to Meanbox | Feature requests you trigger (search, repo/video context, learning packs, news clip / deep dive, structure helpers, etc.) |
| Session | For signed-in saves, Meanbox session cookies (`yt_oauth_*`) for your configured API origin may be read and forwarded to the Service in a custom header |
| API keys in the Add-on | None — AI and backend keys stay on the Service |
| Sold to advertisers | We do not sell your personal information |
| Children | Not directed at children under 13 (or the higher age required in your region) |

---

## 2. Information the Add-on handles

### 2.1 Stored on your device (Chrome storage)

The Add-on may store:

- **API base** — the Meanbox origin the Add-on calls (default `https://meanbox.vercel.app`, or a value you set, such as a local development URL);
- **Locale** — preferred deep-link locale (for example `en` or `vi`).

Settings use Chrome **`storage.sync`** so they can follow your Chrome/Google account if sync is enabled. We do not control Google’s sync infrastructure.

**Device history** uses **`storage.local`** on this Chrome profile when you generate content in the add-on (for example learning packs, repository summaries, news/article deep dives, and Quick Gadget / RTCFC results). If you are not signed in on the configured Meanbox origin, that history stays on the device until you clear it in Options, uninstall the add-on, or remove the Chrome profile. When you sign in, the add-on may upload pending learning packs and news deep dives to your Meanbox account; repository summaries and gadgets may remain device-only until a cloud shelf exists. We do not receive device-only blobs until you trigger a sync or a signed-in save.

### 2.2 Information sent to the Meanbox Service

When you use a feature that needs the backend, the Add-on sends HTTPS requests to your configured API base. Depending on the feature, that may include:

- search queries and omnibox / popup input;
- GitHub repository identifiers or page context you choose to open or analyze;
- YouTube video identifiers or study-related requests (for example learning packs / transcripts via Service APIs);
- page title, URL, selection text, or extracted main-body text (up to about 4,000 characters) for news / lesson deep dive when you run that flow;
- freeform or labeled text for Quick Gadgets that call the Service (for example RTCFC structure);
- technical request metadata typical of HTTPS (IP address, user agent, timestamps) as seen by the Service host.

The Add-on does **not** embed third-party AI provider API keys. Generation and enrichment run on the Service.

### 2.3 Session cookies (signed-in features)

To save learning packs or other history tied to your Meanbox account, the Add-on may:

1. use the `cookies` permission to read cookies on your **configured Meanbox API origin**;
2. keep only cookie names that start with `yt_oauth_`;
3. send those values to the Service in the `X-Meanbox-Cookie` request header so the backend can recognize your session.

The Add-on does not use this bridge to read arbitrary cookies from unrelated sites. If you are not signed in on that origin, or you deny host access, signed-in save features may fail while anonymous or local-only flows may still work.

### 2.4 Page access (content scripts, scripting, hosts)

With granted permissions, the Add-on may:

- run content scripts on GitHub and YouTube URLs listed in the manifest (for example UI chips / context helpers);
- use `scripting` / active tab access to read title and main-body text for deep dive when you (or a menu / omnibox / popup action) start that flow;
- request optional broader host access (`https://*/*`, `http://*/*`) so news sites and custom API hosts can work — **Chrome may require optional host grant for non-listed sites**.

We do not use page access to silently harvest your full browsing history. Access is for the Meanbox features you invoke and the hosts you have allowed.

### 2.5 What we do not collect via the Add-on

- No payment card data through the Add-on;
- No contacts or address-book access;
- No microphone / camera;
- No sale of personal data to data brokers for advertising.

Chrome Web Store data-use disclosures for this listing may state that certain categories are not required; that disclosure does not remove the need to describe Service traffic as above.

---

## 3. How we use information

We use Add-on-related information to:

- provide the features you request (repo lens, study companion, gadgets, news deep dive, Places links, etc.);
- authenticate signed-in actions when you have a Meanbox session;
- operate, secure, debug, and improve the Service;
- comply with law and enforce our terms.

We do **not** use Add-on traffic to build third-party advertising profiles.

---

## 4. Legal bases (where applicable)

If you are in the EEA, UK, or a similar jurisdiction, we rely on:

- **Contract / requested service** — processing needed to run features you use;
- **Legitimate interests** — security, abuse prevention, basic service analytics, product improvement, balanced against your rights;
- **Consent** — where required (for example certain optional permissions or cookies under local law);
- **Legal obligation** — when we must retain or disclose information.

---

## 5. Sharing

We may share information with:

- **Infrastructure providers** that host the Service (for example cloud hosting such as Vercel and related data stores used by Meanbox);
- **AI / enrichment providers** engaged by the Service to fulfill a request you make (content you submit may be processed under their terms with us as customer);
- **Professional advisors** or authorities when required by law or to protect rights and safety;
- a successor if we transfer the product as part of a merger or asset sale, subject to appropriate safeguards.

We do not sell your personal information. Third-party sites you visit (GitHub, YouTube, news publishers) process data under **their** policies when you use those sites; the Add-on does not control that.

---

## 6. Retention

- **Browser storage:** settings remain until you clear them, reset the Add-on, or uninstall (and subject to Chrome sync).
- **Service-side:** account history, learning packs, clipped stories, and logs follow Meanbox Service retention practices. Contact us to request deletion of account-linked data where applicable.

---

## 7. Security

We use HTTPS between the Add-on and the Service and limit session bridging to Meanbox `yt_oauth_*` cookies for the configured origin. No method of transmission or storage is perfectly secure. Protect your Chrome profile and Meanbox sign-in; revoke host permissions or uninstall if you no longer want the Add-on to access sites or cookies.

---

## 8. International transfers

The Service may be hosted or processed in countries other than your own (including where our hosting providers operate). Where required, we use appropriate transfer mechanisms for Service processing.

---

## 9. Your choices and rights

You can:

- change or clear **API base** and **locale** in Add-on Options;
- grant or revoke **host permissions** in Chrome / Options → Grant host access;
- sign out of Meanbox on the web origin to stop session-based saves;
- uninstall the Add-on to stop local Add-on processing;
- use Meanbox account / support channels to access, correct, or delete account data where the law provides those rights.

Depending on your location, you may also have rights to object, restrict processing, portability, or complain to a supervisory authority. Contact us using the details below.

---

## 10. Children

The Add-on is not directed to children under 13 (or the minimum age in your jurisdiction). We do not knowingly collect personal information from children through the Add-on. If you believe a child has provided data, contact us and we will take appropriate steps.

---

## 11. Changes

We may update this Privacy Policy. The “Last updated” date will change when we do. Material changes may also be noted on the Chrome Web Store listing or Meanbox site. Continued use of the Add-on after an update means you accept the revised policy, except where law requires additional consent.

---

## 12. Contact

- **Product:** Meanbox — https://meanbox.vercel.app  
- **Add-on ID:** `meanbox@royalsolution`  
- **Support:** use the support email / website published on the Chrome Web Store listing

For privacy requests, include “Meanbox Chrome privacy” in the subject and enough detail to identify your request (do not send passwords).

---

*This document is for your Chrome Web Store listing and distribution. Have counsel review it before relying on it as legal advice.*
