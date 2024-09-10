const fsProm = require('fs/promises')

async function main () {
  const sizeMb = 100
  const fileLoc = `./example-file-${sizeMb}mb`

  const fileHandle = await fsProm.open(fileLoc, 'w')

  for (let i = 0; i < sizeMb; i++) {
    fileHandle.appendFile('a'.repeat(2 ** 20))
  }

  await fileHandle.close()
}

main()
