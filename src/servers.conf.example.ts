import type { ServerConfig } from "./types"

const ServerConfig: ServerConfig = {
  // Koios
  koios: {
    mainnet: [
      {
        host: "your-server.com:8050", // ip addresses are forbidden by CF, expose them through CF DNS (unproxied, to access custom ports)
        version: "api/v1",
        enabled: true,
      },
      {
        host: "your-server-2.com:8050",
        version: "api/v1",
        enabled: false,
      },
    ],
    preprod: [
      {
        host: "your-server-3.com:8050",
        version: "api/v1",
        enabled: true,
      },
    ],
    preview: [
      {
        host: "your-server-4.com:8050",
        version: "api/v1",
        enabled: true,
      },
    ],
  },

  // Kupo
  kupo: {
    mainnet: [
      {
        host: "your-server-5.com:8050",
        version: "api/v1",
        enabled: true,
      },
    ],
  },

  // Ogmios
  ogmios: {
    mainnet: [
      {
        host: "your-server-6.com:8050",
        version: "api/v1",
        enabled: true,
      },
    ],
  },
}

export default ServerConfig
