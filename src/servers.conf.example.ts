import type { ServerConfig } from "./types"

const ServerConfig: ServerConfig = {
  // Koios
  koios: {
    mainnet: [
      {
        // IP addresses are forbidden by Cloudflare, expose them through CF DNS.
        // By default, the XRAY ecosystem is configured so that everything goes through the 80/443 port of HAProxy.
        // You can specify any other port (eg, http://some-server:1337), but then you must disable domain proxying in the CF DNS panel.
        host: "https://your-server-1.com",
        version: "api/v1",
        enabled: true,
      },
      {
        host: "https://your-server-2.com",
        version: "api/v1",
        enabled: false,
      },
    ],
    preprod: [
      {
        host: "https://your-preprod-server.com",
        version: "api/v1",
        enabled: true,
      },
    ],
    preview: [
      {
        host: "https://your-server-4.com",
        version: "api/v1",
        enabled: true,
      },
    ],
  },

  // Kupo
  kupo: {
    mainnet: [
      {
        host: "https://your-server-5.com",
        version: "api/v1",
        enabled: true,
      },
    ],
  },

  // Ogmios
  ogmios: {
    mainnet: [
      {
        host: "https://your-server-6.com",
        version: "api/v1",
        enabled: true,
      },
    ],
  },

  // NFTCDN
  nftcdn: {
    mainnet: [
      {
        host: "https://your-server-7.com",
        version: "api/v1",
        enabled: true,
      },
    ],
  },
}

export default ServerConfig
