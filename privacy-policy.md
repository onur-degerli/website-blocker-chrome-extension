# Privacy Policy for Zengate

Last updated: April 30, 2026

Zengate is a browser extension that helps you block distracting websites and, optionally, redirect blocked websites to a page you choose. This Privacy Policy explains what information the extension uses, how it is stored, and what is shared.

## Information Zengate Uses

Zengate uses the minimum information needed to provide its blocking features:

- Blocked websites you add to the extension.
- Whether blocking is turned on or off for each website.
- Optional redirect URLs you set for blocked websites.
- The URL and hostname of the active or navigated page, used locally to decide whether the page should be blocked.

Zengate does not require an account and does not ask for your name, email address, payment information, or other personal profile information.

## How Information Is Stored

Your blocked website list, enabled or disabled status, and optional redirect URLs are stored using the browser's extension storage API (`chrome.storage.sync`).

If browser sync is enabled, your browser provider may sync this extension data across devices signed in to the same browser account. Zengate does not operate its own server to store this information.

## How Information Is Used

Zengate uses the stored website list to:

- Show and manage your blocked websites in the extension popup and options page.
- Detect when you navigate to a blocked website.
- Redirect blocked websites either to Zengate's local blocked page or to the redirect URL you configured.

URL and tab information is processed locally by the extension for these purposes. Zengate does not use this information for analytics, advertising, profiling, or tracking.

## Information Sharing

Zengate does not sell, rent, trade, or share your information with third parties.

Zengate does not transmit your blocked website list, redirect URLs, browsing activity, or tab information to an external server controlled by Zengate.

## Browser Permissions

Zengate requests browser permissions so it can provide its core functionality:

- `storage`: to save your blocked website list and redirect settings.
- `tabs`: to identify the active tab when you use the popup.
- `webNavigation`: to detect navigation to blocked websites.
- Host access for websites: to compare navigated pages against your blocked website list.

These permissions are used only to provide website blocking and redirection features.

## Data Retention and Deletion

Your Zengate settings remain stored until you remove them, reset the extension's data, or uninstall the extension.

You can delete stored websites from the extension's options page. You can also remove all extension data by uninstalling Zengate or clearing the extension's browser storage.

## Children's Privacy

Zengate is not directed to children under 13. Zengate does not knowingly collect personal information from children.

## Changes to This Policy

This Privacy Policy may be updated from time to time. Updates will be reflected by changing the "Last updated" date at the top of this file.

## Contact

If you have questions about this Privacy Policy, use the support contact provided in Zengate's browser extension listing or project repository.
