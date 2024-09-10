# Hyperswarm End-to-End Tests

## Run

### Docker

#### Server

Create a file called file-to-seed (as large as the transfer size you wish to test) and place it in a directory. That directory should be mounted read-only into the docker container.

TODO: simplify so we don't need to mount a file, but instead specify how much Mb we wish to replicate.

```
docker run --network=host \
 --mount type=bind,source=/path/of/dir/with/file-to-seed,destination=/home/hyperswarm-e2e-tests/serve/ \
 --env HYPERSWARM_E2E_PROMETHEUS_ALIAS=unique-prom-dht-alias
 --env HYPERSWARM_E2E_PROMETHEUS_SECRET=... \
 --env HYPERSWARM_E2E_PROMETHEUS_SCRAPER_PUBLIC_KEY=... \
 --env HYPERSWARM_E2E_DISCOVERY_KEY=unique-disc-key-to-serve-under \
  ghcr.io/holepunchto/hyperswarm-e2e-tests-server
```

#### Client

```
docker run --network=host \
 --env HYPERSWARM_E2E_PROMETHEUS_ALIAS=unique-prom-dht-alias \
 --env HYPERSWARM_E2E_PROMETHEUS_SECRET=... \
 --env HYPERSWARM_E2E_PROMETHEUS_SCRAPER_PUBLIC_KEY=... \
 --env HYPERSWARM_E2E_DISCOVERY_KEY=disc-key-of-the-server-you-wish-to-download-from \
  ghcr.io/holepunchto/hyperswarm-e2e-tests-client
```
