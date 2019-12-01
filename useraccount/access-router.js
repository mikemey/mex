const express = require('express')
const querystring = require('querystring')
const Joi = require('@hapi/joi')

const {
  wsmessages: { withAction, OK_STATUS, NOK_STATUS },
  Validator, LogTrait
} = require('../utils')

const registerSchema = Joi.object({
  email: Validator.email(),
  password: Validator.password(),
  confirmation: Joi.any().valid(Joi.ref('password')).required()
    .error(errors => {
      errors.forEach(err => { err.message = 'password and confirmation not matching' })
      return errors
    })
})

class AccessRouter extends LogTrait {
  constructor (sessionClient) {
    super()
    this.sessionClient = sessionClient
  }

  create () {
    const router = express.Router()
    const registerMessages = withAction('register')
    const registerCheck = Validator.createCheck(registerSchema)
    const loginMessages = withAction('login')

    const registrationError = (res, message, email) => res.render('register', { error: message, email })

    const serviceUnavailable = (res, detailMsg, email) => {
      this.log('registration error:', detailMsg)
      registrationError(res, 'service unavailable', email)
    }

    router.get('/register', (_, res) => res.render('register'))
    router.post('/register', (req, res) => {
      const email = req.body.email
      const password = req.body.password
      const confirmation = req.body.confirmation
      try {
        registerCheck({ email, password, confirmation })
      } catch (err) {
        return registrationError(res, err.message, email)
      }
      return this.sessionClient.send(registerMessages.build({ email, password }))
        .then(result => {
          switch (result.status) {
            case OK_STATUS: return res.redirect(303, 'login?' + querystring.stringify({ success: true }))
            case NOK_STATUS: {
              this.log('registration failed:', result.message)
              return registrationError(res, result.message, email)
            }
            default: return serviceUnavailable(res, result.message, email)
          }
        })
        .catch(err => serviceUnavailable(res, err.message, email))
    })

    router.get('/login', (req, res) => {
      const success = req.query.success !== undefined
      res.render('login', { success })
    })
    router.post('/login', (req, res) => {
      const email = req.body.email
      const password = req.body.password

      return this.sessionClient.send(loginMessages.build({ email, password }))
        .then(result => {
          switch (result.status) {
            case OK_STATUS: {
              req.session.user = { id: result.id, email: result.email }
              return res.redirect(303, 'index')
            }
          }
        })
    })

    return router
  }
}

module.exports = AccessRouter
