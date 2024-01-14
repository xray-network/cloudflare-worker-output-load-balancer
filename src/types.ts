export type Server = {
	host: string
	version: string
	enabled: boolean
}

export type ServerConfig = {
	[service: string]: {
		[network: string]: Server[]
	}
}

export type ServerHealthStatus = {
	host: string
	service: string
	network: string
	healthy: boolean
}

export type ServerHealthStatusResponse = {
	updatedAt: string
	status: ServerHealthStatus[]
}

export type MapHealthPathname = {
	[serviceName: string]: string
}
