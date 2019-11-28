const express = require('express')
const Joi = require('@hapi/joi')

const { wsmessages, Validator } = require('../utils')

const requestSchema = Joi.object({
  email: Validator.email(),
  password: Validator.password(),
  confirmation: Joi.any().valid(Joi.ref('password')).required()
    .error(errors => {
      errors.forEach(err => { err.message = 'password and confirmation not matching' })
      return errors
    })
})

const registerRouter = sessionClient => {
  const router = express.Router()
  const registerMessages = wsmessages.withAction('register')
  const registerCheck = Validator.createCheck(requestSchema)

  router.get('/', (_, res) => res.render('register'))

  router.post('/', (req, res) => {
    const email = req.body.email
    const password = req.body.password
    const confirmation = req.body.confirmation

    try {
      registerCheck({ email, password, confirmation })
    } catch (err) {
      return res.render('register', { error: err.message })
    }

    return sessionClient.send(registerMessages.build({ email, password }))
      .then(result => {
        res.redirect(303, 'login')
      })
  })

  return router
}

module.exports = registerRouter
