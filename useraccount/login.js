const express = require('express')

const registerRouter = () => {
  const router = express.Router()

  router.get('/', (_, res) => res.render('login'))

  return router
}

module.exports = registerRouter
