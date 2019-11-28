const express = require('express')

const { LogTrait } = require('../utils')

class LoginRouter extends LogTrait {
  constructor (sessionClient) {
    super()
    this.sessionClient = sessionClient
  }

  create () {
    const router = express.Router()

    router.get('/', (_, res) => res.render('login'))

    return router
  }
}

module.exports = LoginRouter
