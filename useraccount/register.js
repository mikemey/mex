const express = require('express')

const registerRouter = () => {
  const router = express.Router()

  router.get('/', (req, res) => {
    res.render('register')
  })
  return router
}

module.exports = registerRouter
