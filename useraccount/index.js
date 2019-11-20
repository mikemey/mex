const fs = require('fs')

const { HTTPAuth } = require('../security')
const defconfig = JSON.parse(fs.readFileSync(`${__dirname}/defaults.json`))

class UserAccountService extends HTTPAuth {
  constructor (config) {
    const fullConfig = Object.assign(defconfig, config)
    super(fullConfig)
    this.server = null
  }

  getRouter () {
    return () => { }
  }
}

module.exports = UserAccountService
