const fs = require('fs')
const express = require('express')

const { HTTPAuth } = require('../security')
const defconfig = JSON.parse(fs.readFileSync(`${__dirname}/defaults.json`))

const registerRouter = require('./register')

class UserAccountService extends HTTPAuth {
  constructor (config) {
    const fullConfig = Object.assign(defconfig, config)
    super(fullConfig)
    this.server = null

    process.on('SIGTERM', this.stop.bind(this))
    process.on('SIGINT', () => this.stop.bind(this))
  }

  getRouter () {
    const router = express.Router()
    router.use('/register', registerRouter())
    return router
  }
}

module.exports = UserAccountService
