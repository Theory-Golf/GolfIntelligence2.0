/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint failures shouldn't block production deploys. Run `npm run lint`
    // locally for feedback; TypeScript still type-checks on every build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
