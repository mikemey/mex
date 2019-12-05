const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

const dbConfig = { url: 'mongodb://127.0.0.1:27017', name: 'mex-test' }
const seedDir = 'seed-data'

const registeredUser = {
  id: '5de363fbd0f61042035dc603',
  email: 'test_user@test.com',
  password: 'test_pwd'
}

const dropTestDatabase = () => Promise.resolve(childProcess.execSync(
  `mongo ${dbConfig.name} --eval "db.dropDatabase()"`
))

const seedTestData = () => {
  return new Promise((resolve, reject) => {
    const commonArgs = `--db=${dbConfig.name} --quiet --drop --jsonArray`
    fs.readdir(path.join(__dirname, seedDir), (err, files) => {
      if (err) { return reject(err) }
      return Promise.all(files
        .filter(seedFile => seedFile.endsWith('json'))
        .map(seedFile => {
          childProcess.execSync(`mongoimport ${commonArgs} ${path.join(__dirname, seedDir, seedFile)}`)
        })
      ).then(resolve)
    })
  })
}

module.exports = { dropTestDatabase, seedTestData, dbConfig, registeredUser }
