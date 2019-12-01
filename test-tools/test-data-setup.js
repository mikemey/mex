const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

const dbConfig = { url: 'mongodb://127.0.0.1:27017', name: 'mex-test' }
const seedDir = 'seed-data'

const registeredUser = {
  email: 'test_user@test.com',
  password: 'test_pwd'
}

const seedTestData = () => {
  return new Promise((resolve, reject) => {
    const url = `${dbConfig.url}/${dbConfig.name}`
    fs.readdir(path.join(__dirname, seedDir), (err, files) => {
      if (err) { return reject(err) }
      return Promise.all(files
        .filter(seedFile => seedFile.endsWith('json'))
        .map(seedFile => childProcess.execSync(
          `mongoimport --uri=${url} --quiet --drop --jsonArray ${path.join(__dirname, seedDir, seedFile)}`
        ))
      ).then(resolve)
    })
  })
}

module.exports = { seedTestData, dbConfig, registeredUser }
