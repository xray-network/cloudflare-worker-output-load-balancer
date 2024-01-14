/**
 * @@ XRAY NETWORK | Graph | Output Serverless Load Balancer
 * Cloudflare serverless load balancer for XRAY | Graph | Output stack
 * Learn more at https://developers.cloudflare.com/workers/
 */

import serversConfig from "./servers.conf"

import * as Types from "./types"

const API_PROTOCOL = "http://"
const API_GROUP = "output"
const ALLOWED_METHODS = ["GET", "POST", "OPTIONS", "HEAD"]
const HEALTHCHECK_ENABLED = false // choose healthy servers only
const HEALTHCHECK_UPDATE_ENABLED = true // update health status every minute
const TIMEOUT_DEFAULT = 30_000 // 30 seconds
const TIMEOUT_BEARER = 300_000 // 5 minutes
const MAP_HEALTH_PATHNAME: Types.MapHealthPathname = {
  koios: "/tip",
  kupo: "/health",
  ogmios: "/health",
}

export default {
  // Main fetch handler
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { segments, pathname, requestPath, search } = getUrlSegments(new URL(request.url))
    const [group, service, network, prefix, version] = segments
    const prefixedVersion = `${prefix}/${version}`
    const serversPool = filterEnabledServers(serversConfig)
    const serversPoolRelated = serversPool?.[service]?.[network]
    const authorizationHeader = request.headers.get("Authorization")
    const authorized = authorizationHeader === `Bearer ${env.JWT_BEARER_TOKEN}`

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

    // Throw 404 / 405 for the specified cases
    if (!ALLOWED_METHODS.includes(request.method)) return throw405()
    if (group !== API_GROUP) return throw404()

    // Access Kupo only with Authorization header
    if (service === "kupo" && !authorized) return throw404()

    // Return 404 if related server not found
    if (!serversPoolRelated) return throw404()
    if (!serversPoolRelated.find((server) => server.version === prefixedVersion)) return throw404()

    // Disable WS for Ogmios
    if (request.headers.get("Upgrade") === "websocket") return throw404()
    if (request.headers.get("Connection") === "Upgrade") return throw404()

    const serverRandom = await getServerRandom(serversPool?.[service]?.[network], env)

    try {
      const abortController = new AbortController()
      const timeout = authorized ? TIMEOUT_BEARER : TIMEOUT_DEFAULT
      setTimeout(() => {
        abortController.abort()
      }, timeout)

      const requestUrl = `${API_PROTOCOL}${serverRandom.host}${service === "koios" ? "/rpc" : ""}`
      const response = await fetch(requestUrl + requestPath + search, {
        method: request.method,
        ...(request.method === "POST" && { body: request.body }),
        headers: { HostResolver: `${service}/${network}` },
        signal: abortController.signal,
      })

      // Adding request count to Stats, using waitUntil()
      const delayedProcessing = async () => {
        const key = `${service}::${network}::${serverRandom.host}`
        const requestsCount = (await env.KV_OUTPUT_COUNTER.get(key)) || 0
        await env.KV_OUTPUT_COUNTER.put(key, (Number(requestsCount) + 1).toString())
      }
      ctx.waitUntil(delayedProcessing())

      if (response.ok) {
        return addCorsHeaders(response)
      }

      if (response.status === 503) return throw503()
      if (response.status === 504) return throw504()
      return throwReject(response)
    } catch (error) {
      console.log(error)
      return throw503()
    }
  },

  // Crons handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const delayedProcessing = async () => {
      if (event.cron === "* * * * *") {
        if (HEALTHCHECK_UPDATE_ENABLED) {
          const healthCheckResults = await getHealthCheckResults(serversConfig)
          console.log(healthCheckResults)
          await env.KV_OUTPUT_HEALTH.put(
            "status",
            JSON.stringify({
              updatedAt: new Date().toISOString(),
              status: healthCheckResults,
            })
          )
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
      const status: Types.ServerHealthStatusResponse = JSON.parse((await env.KV_OUTPUT_HEALTH.get("status")) || "{}")
      return __serverPool.filter((server) => status?.status?.find((status) => status.host === server.host))
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

const filterEnabledServers = (config: Types.ServerConfig): Types.ServerConfig => {
  return Object.keys(config).reduce((acc, service) => {
    acc[service] = Object.keys(config[service]).reduce(
      (networkAcc, network) => {
        networkAcc[network] = config[service][network].filter((server) => server.enabled)
        return networkAcc
      },
      {} as { [network: string]: Types.Server[] }
    )
    return acc
  }, {} as Types.ServerConfig)
}

const getHealthCheckResults = async (serverConfig: Types.ServerConfig) => {
  const healthCheckPromises: Promise<Types.ServerHealthStatus>[] = []

  Object.entries(serverConfig).forEach((services) => {
    const service = services[0]
    Object.entries(services[1]).map((networks) => {
      const network = networks[0]
      networks[1].forEach((server) => {
        if (server.enabled) {
          const healthCheckPromise = fetch(
            `${API_PROTOCOL}${server.host}${service === "koios" ? "/rpc" : ""}${MAP_HEALTH_PATHNAME[service] || ""}`,
            { headers: { HostResolver: `${service}/${network}` } }
          )
            .then((response) => ({
              host: server.host,
              service,
              network,
              healthy: response.ok,
            }))
            .catch((error) => ({
              host: server.host,
              service,
              network,
              healthy: false,
            }))
          healthCheckPromises.push(healthCheckPromise)
        }
      })
    })
  })

  return await Promise.all(healthCheckPromises)
}

const getUrlSegments = (url: URL) => {
  const pathname = url.pathname
  const search = url.search
  const segments = pathname.replace(/^\//g, "").split("/")
  const requestPath = `/${segments.slice(5).join("/")}`

  return {
    segments,
    pathname,
    requestPath,
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
  return addCorsHeaders(
    new Response("503. Service unavailable. No server is available to handle this request", { status: 503 })
  )
}

const throw504 = () => {
  return addCorsHeaders(new Response("504. Gateway time-out. The server didn't respond in time", { status: 504 }))
}

const throwReject = (response: Response) => {
  return addCorsHeaders(new Response(response.body, response))
}
