/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@arrival-atlas/core',
    '@arrival-atlas/life-event-demo',
    '@arrival-atlas/modules',
    '@arrival-atlas/product-contract',
  ],
};

export default nextConfig;
