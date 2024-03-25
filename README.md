<a href="https://discord.gg/WhZmm46APN"><img alt="Discord" src="https://img.shields.io/discord/852538978946383893?style=for-the-badge&logo=discord&label=Discord&labelColor=%231940ED&color=%233FCB9B"></a>

# XRAY | Graph | Output Load Balancer — Cloudflare Worker

> [!WARNING]
> **DEPRECATED:** The tool has been moved to XRAY | Graph | Output, which is an internal proprietary XRAY project that acts as a load balancer and proxy tool for API management and documentation in OpenAPI format

> [!NOTE]
> Cloudflare serverless load balancer for XRAY | Graph | Output (Ogmios, Koios, Kupo, NFTCDN) stack

## Getting Started
### Prepare Installation

``` console
git clone \
  --recurse-submodules \
  https://github.com/xray-network/cloudflare-worker-output-load-balancer.git \
  && cd cloudflare-worker-output-load-balancer
```
``` console
cp src/servers.conf.example.ts src/servers.conf.ts
```

### Edit [wrangler.toml](https://github.com/xray-network/cloudflare-worker-output-load-balancer/blob/main/wrangler.toml)

```
change KV_OUTPUT_COUNTER id
change KV_OUTPUT_HEALTH id 
```

### Edit [servers.conf.ts](https://github.com/xray-network/cloudflare-worker-output-load-balancer/blob/main/src/servers.conf.example.ts)

```
Configure settings for koios, kupo, ogmios, nftcdn
```

### Run Dev Server

```
yarn start
```

### Deploy to Cloudflare Workers

```
yarn deploy
```

## Endpoints

Proxies Ogmios, Koios, Kupo, NFTCDN or the API of any other service configured in `servers.conf.ts`.
