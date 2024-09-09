const { once } = require('events')
const os = require('os')
const fsProm = require('fs/promises')
const idEnc = require('hypercore-id-encoding')
const Hyperswarm = require('hyperswarm')
const pino = require('pino')
const b4a = require('b4a')
const formatBytes = require('tiny-byte-size')
const goodbye = require('graceful-goodbye')
// const instrument = require('./lib/instrument')
const promClient = require('prom-client')
const safetyCatch = require('safety-catch')

function loadConfig () {
  const config = {
    logLevel: process.env.HYPERSWARM_E2E_LOG_LEVEL || 'info'
  }

  try {
    config.discoveryKey = idEnc.decode(process.env.HYPERSWARM_E2E_DISCOVERY_KEY)
  } catch (e) {
    console.error(e)
    console.error('HYPERSWARM_E2E_DISCOVERY_KEY must be set to a valid discovery key')
    process.exit(1)
  }

  /* config.prometheusServiceName = 'hyperswarm-e2e-tests'
  config.prometheusAlias = process.env.HYPERSWARM_E2E_PROMETHEUS_ALIAS
  try {
    config.prometheusSecret = idEnc.decode(process.env.HYPERSWARM_E2E_PROMETHEUS_SECRET)
    config.prometheusScraperPublicKey = idEnc.decode(process.env.HYPERSWARM_E2E_PROMETHEUS_SCRAPER_PUBLIC_KEY)
  } catch (error) {
    console.error(error)
    console.error('HYPERSWARM_E2E_PROMETHEUS_SECRET and HYPERSWARM_E2E_PROMETHEUS_SCRAPER_PUBLIC_KEY must be set to valid keys')
    process.exit(1)
  } */

  return config
}

async function main () {
  const config = loadConfig()
  const {
    logLevel,
    fileLoc,
    discoveryKey,
    prometheusScraperPublicKey,
    prometheusAlias,
    prometheusSecret,
    prometheusServiceName
  } = config

  const logger = pino({ level: logLevel })

  logger.info('Starting hyperswarm-e2e-tests client')
  const swarm = new Hyperswarm()
  swarm.on('connection', async (conn) => {
    logger.info('connection opened')
    conn.on('error', safetyCatch)

    let totalData = 0
    let nrData = 0
    const startTime = Date.now()
    conn.on('data', (d) => {
      totalData += d.length
      if (nrData++ % 100 === 0) {
        logger.info(`Received data of size ${formatBytes(d.length)} (total: ${formatBytes(totalData)})`)
      }
    })

    conn.on('close', () => {
      logger.info(`Finished downloading, total downloaded: ${formatBytes(totalData)}) in ${(Date.now() - startTime)/1000}s`)
      swarm.leave(discoveryKey).catch(safetyCatch)
    })
  })

  swarm.join(discoveryKey, { server: false, client: true })

  logger.info(`Setup client for discovery key ${idEnc.normalize(discoveryKey)}`)
}

main()
