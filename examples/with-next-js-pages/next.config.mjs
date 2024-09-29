/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['page.tsx', 'route.ts'],

  // _http_common is not included as a built-in module in Next.js as of 14.2.13.
  // We need to include it manually. This also means that we can't use `--turbo` right now.
  // When https://github.com/vercel/next.js/issues/70262 lands in Next.js 14, we'll be able to remove this.
  // Related: https://github.com/mswjs/msw/issues/2291.
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [...(config.externals || []), '_http_common'];
    }
    return config;
  },
};

export default nextConfig;
