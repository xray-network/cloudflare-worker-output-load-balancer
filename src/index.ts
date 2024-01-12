/**
 * @@ XRAY NETWORK | Graph | Output Serverless Load Balancer
 * Cloudflare serverless load balancer for `xray-graph-output`
 * Learn more at https://developers.cloudflare.com/workers/
 */

import serversInitialConfig from "./servers.conf"

import * as Types from "./types"

const API_PROTOCOL = "https:"
const API_GROUP = "output"
const API_PREFIX = "api"
const ALLOWED_METHODS = ["GET", "POST", "OPTIONS", "HEAD"]
const HEALTHCHECK_ENABLED = false // choose healthy servers only
const HEALTHCHECK_UPDATE_ENABLED = true // update health status every minute
const MAP_HEALTH_PATHNAME: Types.MapHealthPathname = {
	koios: "tip",
	kupo: "health",
	ogmios: "health",
}

export default {
	// Main fetch handler
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const apis = getApisObject(serversInitialConfig)
		const { segments, pathname, search } = getUrlSegments(new URL(request.url))
		const [group, network, service, prefix, version] = segments

		if (request.method === "OPTIONS") {
			return new Response(null, {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": ALLOWED_METHODS.join(", "),
					"Access-Control-Max-Age": "86400",
					"Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
				},
			})
		}

		if (!ALLOWED_METHODS.includes(request.method)) return throw405()
		if (group !== API_GROUP) return throw404()
		if (network === "stats") return await getStats(env) // Gather API Stats, with dirty route hack ofc :)
		if (prefix !== API_PREFIX) return throw404()
		if (!apis?.[network]?.[service]?.[version]) return throw404()
		if (request.headers.get("Upgrade") === "websocket") return throw404()
		if (request.headers.get("Connection") === "Upgrade") return throw404()

		const serversPool = apis[network][service][version]
		const serverRandom = await getServerRandom(serversPool, env)
		const bearerResolver = request.headers.get("BearerResolver")

		const response = await fetch(
			`${serverRandom.host}${`${pathname.replace(/^\//g, "").slice(serverRandom.hostResolver.length)}`}${search}`,
			{
				method: request.method,
				...(request.method === "POST" && { body: request.body }),
				headers: {
					HostResolver: serverRandom.hostResolver,
					...(bearerResolver && { BearerResolver: bearerResolver }),
				},
			}
		)

		const delayedProcessing = async () => {
			const requestsCount = (await env.KV_API_REQUESTS_COUNTER.get(serverRandom.id)) || 0
			await env.KV_API_REQUESTS_COUNTER.put(serverRandom.id, (Number(requestsCount) + 1).toString())
		}
		ctx.waitUntil(delayedProcessing())

		if (response.ok) {
			return addCorsHeaders(response)
		}

		if (response.status === 503) return throw503()
		if (response.status === 504) return throw504()
		return throwReject(response)
	},

	// Crons handler
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const delayedProcessing = async () => {
			if (HEALTHCHECK_UPDATE_ENABLED) {
				if (event.cron === "* * * * *") {
					const apis = getApisObject(serversInitialConfig)
					const healthCheckResults = await getHealthCheckResults(apis, env)
					const data: Types.ServerHealthStatusResponse = {
						updatedAt: new Date().toISOString(),
						status: healthCheckResults,
					}

					await env.KV_API_HEALTH.put("status", JSON.stringify(data))
				}
			}
		}
		ctx.waitUntil(delayedProcessing())
	},
}

const getServerRandom = async (serverPool: Types.Server[], env: Env): Promise<Types.Server> => {
	const returnRandom = (__serverPool: Types.Server[]) => __serverPool[Math.floor(Math.random() * __serverPool.length)]
	const getHealthyPools = async (__serverPool: Types.Server[]): Promise<Types.Server[]> => {
		try {
			const status: Types.ServerHealthStatusResponse = JSON.parse((await env.KV_API_HEALTH.get("status")) || "{}")
			return __serverPool.filter((server) => status?.status?.find((status) => status.id === server.id))
		} catch {
			return []
		}
	}

	if (HEALTHCHECK_ENABLED) {
		const healthyPools = await getHealthyPools(serverPool)
		return healthyPools.length ? returnRandom(healthyPools) : returnRandom(serverPool) // try hard
	} else {
		return returnRandom(serverPool)
	}
}

const getApisObject = (servers: Types.ServersInitialConfig): Types.ServerConfig => {
	return servers.reduce<Types.ServerConfig>((acc, server) => {
		if (!server.active) return acc

		acc = server.services.reduce<Types.ServerConfig>((innerAcc, service) => {
			if (!service.active) return innerAcc

			const networkConfig = innerAcc[service.network] ?? {}
			const serviceConfig = networkConfig[service.name] ?? {}
			const versionConfig = serviceConfig[service.version] ?? []

			versionConfig.push({
				active: service.active,
				healthUrl: `${API_PROTOCOL}//${server.host}/${MAP_HEALTH_PATHNAME[service.name] || ""}`,
				host: `${API_PROTOCOL}//${server.host}`,
				hostResolver: `${API_GROUP}/${service.network}/${service.name}/${API_PREFIX}/${service.version}`,
				id: `${server.host}/${API_GROUP}/${service.network}/${service.name}/${API_PREFIX}/${service.version}`,
			})

			serviceConfig[service.version] = versionConfig
			networkConfig[service.name] = serviceConfig
			innerAcc[service.network] = networkConfig

			return innerAcc
		}, acc)

		return acc
	}, {})
}

const getHealthCheckResults = async (apis: Types.ServerConfig, env: Env) => {
	const healthCheckPromises: Promise<Types.ServerHealthStatus>[] = []

	for (const network in apis) {
		for (const service in apis[network]) {
			for (const version in apis[network][service]) {
				const serviceConfigs = apis[network][service][version]
				serviceConfigs.forEach((serviceConfig) => {
					if (serviceConfig.active) {
						const healthCheckPromise = fetch(serviceConfig.healthUrl, {
							headers: {
								HostResolver: serviceConfig.hostResolver,
								...(env.JWT_BEARER_TOKEN && { BearerResolver: env.JWT_BEARER_TOKEN }),
							},
						})
							.then((response) => ({
								id: serviceConfig.id,
								healthy: response.ok,
							}))
							.catch(() => ({
								id: serviceConfig.id,
								healthy: false,
							}))

						healthCheckPromises.push(healthCheckPromise)
					}
				})
			}
		}
	}

	return await Promise.all(healthCheckPromises)
}

const getStats = async (env: Env) => {
	const healthRaw: Types.ServerHealthStatusResponse = JSON.parse((await env.KV_API_HEALTH.get("status")) || "{}")
	const countsRaw = []
	const requestsList = await env.KV_API_REQUESTS_COUNTER.list()

	for (const key in requestsList.keys) {
		const id = requestsList.keys[key].name
		countsRaw.push({
			id: id.split("/").slice(1).join("/"),
			count: Number((await env.KV_API_REQUESTS_COUNTER.get(id)) || 0),
		})
	}

	return new Response(
		JSON.stringify({
			health: { ...healthRaw, status: healthRaw.status.map((i) => ({ ...i, id: i.id.split("/").slice(1).join("/") })) },
			counts: {
				total: countsRaw.reduce((acc, i) => acc + Number(i.count), 0),
				byServer: countsRaw,
				byNetwork: countsRaw.reduce(
					(acc, i) => {
						const network = i.id.split("/")[1]
						acc[network] = acc[network] ? acc[network] + Number(i.count) : Number(i.count)
						return acc
					},
					{} as { [key: string]: number }
				),
				byService: countsRaw.reduce(
					(acc, i) => {
						const service = i.id.split("/")[2]
						acc[service] = acc[service] ? acc[service] + Number(i.count) : Number(i.count)
						return acc
					},
					{} as { [key: string]: number }
				),
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		}
	)
}

const getUrlSegments = (url: URL) => {
	const pathname = url.pathname
	const search = url.search
	const segments = pathname.replace(/^\//g, "").split("/")

	return {
		segments,
		pathname,
		search,
	}
}

const addCorsHeaders = (response: Response) => {
	const headers = new Headers(response.headers)
	headers.set("Access-Control-Allow-Origin", "*")
	return new Response(response.body, { ...response, status: response.status, headers })
}

const throw404 = () => {
	return addCorsHeaders(new Response("404. API not found. Check if the request is correct", { status: 404 }))
}

const throw405 = () => {
	return addCorsHeaders(new Response("405. Method not allowed. Check if the request is correct", { status: 405 }))
}

const throw503 = () => {
	return addCorsHeaders(new Response("503. Service unavailable. No server is available to handle this request", { status: 503 }))
}

const throw504 = () => {
	return addCorsHeaders(new Response("504. Gateway time-out. The server didn't respond in time", { status: 504 }))
}

const throwReject = (response: Response) => {
	return addCorsHeaders(new Response(response.body, response))
}
