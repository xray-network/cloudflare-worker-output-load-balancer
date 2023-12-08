export type ServersInitialConfig = {
	host: string
	active: boolean
	services: {
		name: string
		network: string
		version: string
		active: boolean
	}[]
}[]

export type Server = {
	active: boolean
	healthUrl: string
	host: string
	hostResolver: string
	id: string
}

export type ServerConfig = {
	[network: string]: {
		[service: string]: {
			[version: string]: Server[]
		}
	}
}

export type ServerHealthStatus = {
	id: string
	healthy: boolean
}

export type ServerHealthStatusResponse = {
	updatedAt: string
	status: ServerHealthStatus[]
}

export type MapHealthPathname = {
	[serviceName: string]: string
}
