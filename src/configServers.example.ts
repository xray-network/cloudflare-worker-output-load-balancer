import type { ServersInitialConfig } from "./types"

const serversInitialConfig: ServersInitialConfig = [
	{
		host: "server1.your-server-hostname.com", // ip addresses are forbidden by CF, expose them through CF DNS
		active: true, // set to false to disable this server
		services: [
			// list of services running on this server
			{
				name: "koios",
				network: "mainnet",
				version: "v1",
				active: true,
			},
			{
				name: "kupo",
				network: "mainnet",
				version: "v0",
				active: true,
			},
		],
	},
	{
		host: "server2.your-server-hostname.com",
		active: true,
		services: [
			{
				name: "koios",
				network: "mainnet",
				version: "v1",
				active: true,
			},
			{
				name: "kupo",
				network: "mainnet",
				version: "v0",
				active: true,
			},
		],
	},
	{
		host: "devserver.com",
		active: true,
		services: [
			{
				name: "ogmios",
				network: "preprod",
				version: "v0",
				active: true,
			},
			{
				name: "ogmios",
				network: "preprod",
				version: "v1",
				active: true,
			},
			{
				name: "ogmios",
				network: "preview",
				version: "v1",
				active: true,
			},
		],
	},
]

export default serversInitialConfig
