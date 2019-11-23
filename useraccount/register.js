const express = require('express')

const registerRouter = sessionClient => {
  const router = express.Router()

  router.get('/', (_, res) => res.render('register'))

  router.post('/', (req, res) => {
    res.redirect(303, 'login')
  })

  return router
}

module.exports = registerRouter
