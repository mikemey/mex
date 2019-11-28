const express = require('express')

const { wsmessages } = require('../utils')

const registerRouter = sessionClient => {
  const router = express.Router()
  const registerMessages = wsmessages.withAction('register')

  router.get('/', (_, res) => res.render('register'))

  router.post('/', (req, res) => {
    const email = req.body.email
    const password = req.body.password
    // const confirmation = req.body.confirmation

    return sessionClient.send(registerMessages.build({ email, password }))
      .then(result => {
        res.redirect(303, 'login')
      })
  })

  return router
}

module.exports = registerRouter
