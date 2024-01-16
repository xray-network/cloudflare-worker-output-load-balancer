import type { ServerConfig } from "./types"

const ServerConfig: ServerConfig = {
  // Koios
  koios: {
    mainnet: [
      {
        // IP addresses are forbidden by CF, expose them through CF DNS. HAProxy routes to the desired service on port 80 using the HostResolver header
        host: "your-server.com",
        version: "api/v1",
        enabled: true,
      },
      {
        host: "your-server-2.com",
        version: "api/v1",
        enabled: false,
      },
    ],
    preprod: [
      {
        host: "your-server-3.com",
        version: "api/v1",
        enabled: true,
      },
    ],
    preview: [
      {
        host: "your-server-4.com",
        version: "api/v1",
        enabled: true,
      },
    ],
  },

  // Kupo
  kupo: {
    mainnet: [
      {
        host: "your-server-5.com",
        version: "api/v1",
        enabled: true,
      },
    ],
  },

  // Ogmios
  ogmios: {
    mainnet: [
      {
        host: "your-server-6.com",
        version: "api/v1",
        enabled: true,
      },
    ],
  },
}

export default ServerConfig
