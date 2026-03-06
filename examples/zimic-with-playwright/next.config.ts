import { NextConfig } from 'next';

import environment from '@/config/environment';

const nextConfig: NextConfig = {
  distDir: `.next/${environment.PORT}`,
};

export default nextConfig;
