import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Every route is the sign-in/trade-signing surface — without this,
        // any site could iframe /market/[id] (hidden or transparent) and
        // run a clickjacking/UI-redress attack against the Connect Wallet /
        // confirm-trade buttons underneath. X-Frame-Options has no "allow
        // from anywhere" value to override back to below, so it's omitted
        // here in favor of CSP's frame-ancestors (the mechanism Next's own
        // docs call out as superseding it), which IS cleanly overridable
        // per-path — see the next rule and Next's "Header Overriding
        // Behavior" docs.
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }],
      },
      {
        // /embed/* is designed to run inside a third-party <iframe> —
        // deliberately re-opened, since "embed this on any site" is the
        // whole point of this route. Last-matching-rule-wins on the same
        // header key, so this cleanly overrides the rule above instead of
        // stacking with it.
        source: '/embed/:path*',
        headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }],
      },
    ];
  },
};

export default nextConfig;
