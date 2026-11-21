# Embedding a Polaris market

Any market can run on a third-party site inside an `<iframe>` pointing at
`/embed/<contractId>`. The **Get embed code** button on a market's detail page
generates the snippet below with the correct origin and contract id filled in.

## Snippet

```html
<iframe
  src="https://<polaris-origin>/embed/<contractId>"
  width="360" height="420"
  style="border:0;border-radius:16px;overflow:hidden"
  title="Polaris market"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
  referrerpolicy="strict-origin-when-cross-origin"
  loading="lazy"
></iframe>
```

## Host page CSP

Polaris serves `/embed/*` with `Content-Security-Policy: frame-ancestors *`,
so any site may frame it. Your own page's CSP must allow the Polaris origin as
a frame source. A strict host policy that works with the snippet:

```
Content-Security-Policy: default-src 'self'; frame-src https://<polaris-origin>
```

Only the `frame-src` (or `child-src`) directive matters for the widget; the
widget's own scripts and API calls run under Polaris's origin, not yours.

## Sandbox attributes

The `sandbox` set above is the minimum that keeps the widget working:

| Token | Why it's needed |
|---|---|
| `allow-scripts` | The widget is a React app. |
| `allow-same-origin` | Lets the widget keep its session and talk to the Freighter extension. Without it the frame gets an opaque origin and wallet connect fails. |
| `allow-popups` | Freighter's approval window and outbound links (market details, Stellar explorer) open as popups. |
| `allow-popups-to-escape-sandbox` | Pages opened from the widget load normally instead of inheriting the sandbox. |
| `allow-forms` | Trade amount and email-login forms. |

Do **not** add `allow-top-navigation`; the widget never needs to navigate your page.

`referrerpolicy="strict-origin-when-cross-origin"` sends only your origin
(not full URL paths) to Polaris.

## Sizing

The widget is designed for **360×420**. It lays out responsively down to
about 300px wide; below that, content scrolls. Set `width="100%"` with a
`max-width` on a wrapper if you want it fluid. There is currently no
auto-resize message — pick a fixed height.

## Wallet and login behavior

- **Freighter installed:** visitors connect and sign trades inside the
  iframe exactly as on the main app. Freighter is a browser extension, so no
  `allow=` permissions-policy attribute is required.
- **No Freighter:** the widget shows market odds read-only and offers an
  install link (opens in a new tab) and the email fallback.
- **Email login and third-party cookies:** the iframe is a third-party
  context. Browsers that block third-party cookies/storage (Safari, Firefox
  strict mode, Chrome with 3PC disabled) may not keep an email session inside
  the embed. Visitors can complete sign-in on the full Polaris site instead.

## Events

The widget does not yet post `resize` or trade events to the parent window.
This section will document the `postMessage` contract once it ships.
