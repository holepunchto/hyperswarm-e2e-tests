const { once } = require('events')
const fs = require('fs')
const fsProm = fs.promises
const idEnc = require('hypercore-id-encoding')
const Hyperswarm = require('hyperswarm')
const pino = require('pino')
const goodbye = require('graceful-goodbye')
const promClient = require('prom-client')
const safetyCatch = require('safety-catch')
const instrument = require('./lib/instrument')

function loadConfig () {
  const config = {
    logLevel: process.env.HYPERSWARM_E2E_LOG_LEVEL || 'info'
  }

  const fileLoc = process.env.HYPERSWARM_E2E_FILE_LOC
  if (fileLoc === undefined || !fs.existsSync(fileLoc)) {
    console.error(`No file found at expected location ${fileLoc}`)
    process.exit(1)
  }
  config.fileLoc = fileLoc

  try {
    config.discoveryKey = idEnc.decode(process.env.HYPERSWARM_E2E_DISCOVERY_KEY)
  } catch (e) {
    console.error(e)
    console.error('HYPERSWARM_E2E_DISCOVERY_KEY must be set to a valid discovery key')
    process.exit(1)
  }

  config.prometheusServiceName = 'hyperswarm-e2e-tests'
  config.prometheusAlias = process.env.HYPERSWARM_E2E_PROMETHEUS_ALIAS
  try {
    config.prometheusSecret = idEnc.decode(process.env.HYPERSWARM_E2E_PROMETHEUS_SECRET)
    config.prometheusScraperPublicKey = idEnc.decode(process.env.HYPERSWARM_E2E_PROMETHEUS_SCRAPER_PUBLIC_KEY)
  } catch (error) {
    console.error(error)
    console.error('HYPERSWARM_E2E_PROMETHEUS_SECRET and HYPERSWARM_E2E_PROMETHEUS_SCRAPER_PUBLIC_KEY must be set to valid keys')
    process.exit(1)
  }

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
    conn.on('error', safetyCatch)

    logger.info('Connection opened')
    const fileHandler = await fsProm.open(fileLoc)

    const readStream = fileHandler.createReadStream()
    conn.on('close', () => readStream.destroy())

    readStream.on('close', () => {
      conn.destroy()
    })
    readStream.pipe(conn)
  })

  const promRpcClient = instrument(logger, swarm, {
    promClient,
    prometheusScraperPublicKey,
    prometheusAlias,
    prometheusSecret,
    prometheusServiceName
  })

  goodbye(async () => {
    try {
      logger.info('Shutting down')
      await promRpcClient.close()
      logger.info('Prom-rpc client shut down')
      await swarm.destroy()
      logger.info('swarm shut down')
    } catch (e) {
      logger.error(`Error while shutting down ${e.stack}`)
    }

    logger.info('Successfully shut down')
  })

  // Don't start the experiment until our metrics are being scraped
  await Promise.all([
    promRpcClient.ready(),
    once(promRpcClient, 'metrics-success')
  ])
  logger.info('Instrumentation setup')

  swarm.join(discoveryKey, { server: true, client: false })

  logger.info(`Replicating ${fileLoc} at discovery key ${idEnc.normalize(discoveryKey)}`)
}

main()
