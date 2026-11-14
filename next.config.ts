import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/companion/home', destination: '/', permanent: false },
      { source: '/companion/quests', destination: '/quests', permanent: false },
      { source: '/companion/character', destination: '/character', permanent: false },
      { source: '/companion/rewards', destination: '/more/rewards', permanent: false },
      { source: '/companion/history', destination: '/more/history', permanent: false },
      { source: '/companion/log', destination: '/log', permanent: false },
      {
        source: '/companion',
        has: [{ type: 'query', key: 'invite', value: '(?<invite>.*)' }],
        destination: '/more/relationship?invite=:invite',
        permanent: false,
      },
      { source: '/companion', destination: '/more/relationship', permanent: false },
      { source: '/together', destination: '/quests?chip=together', permanent: false },
      { source: '/together/:path*', destination: '/quests?chip=together', permanent: false },
      { source: '/settings/notifications', destination: '/more/notifications', permanent: false },
    ];
  },
};

export default nextConfig;
