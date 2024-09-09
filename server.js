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
    logLevel: process.env.HYPERSWARM_E2E_LOG_LEVEL || 'info',
    fileLoc: 'example-file-100mb'
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

  logger.info('Starting hyperswarm-e2e-tests server')
  const swarm = new Hyperswarm()
  swarm.on('connection', async (conn) => {
    logger.info('Connection opened')
    const fileHandler = await fsProm.open(fileLoc)
    const readStream = fileHandler.createReadStream()

    conn.on('close', () => readStream.destroy())
    conn.on('error', safetyCatch)

    readStream.on('close', () => {
      conn.destroy()
    })
    readStream.pipe(conn)
  })

  swarm.join(discoveryKey, { server: true, client: false })

  logger.info(`Replicating ${fileLoc} at discovery key ${idEnc.normalize(discoveryKey)}`)
}

main()
