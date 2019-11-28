const express = require('express')
const Joi = require('@hapi/joi')

const {
  wsmessages: { withAction, OK_STATUS, NOK_STATUS },
  Validator, LogTrait
} = require('../utils')

const requestSchema = Joi.object({
  email: Validator.email(),
  password: Validator.password(),
  confirmation: Joi.any().valid(Joi.ref('password')).required()
    .error(errors => {
      errors.forEach(err => { err.message = 'password and confirmation not matching' })
      return errors
    })
})

class RegisterRouter extends LogTrait {
  constructor (sessionClient) {
    super()
    this.sessionClient = sessionClient
  }

  create () {
    const router = express.Router()
    const registerMessages = withAction('register')
    const registerCheck = Validator.createCheck(requestSchema)

    const registrationError = (res, message) => res.render('register', { error: message })
    const serviceUnavailable = (res, detailMsg) => {
      this.log('registration error:', detailMsg)
      registrationError(res, 'service unavailable')
    }

    router.get('/', (_, res) => res.render('register'))

    router.post('/', (req, res) => {
      const email = req.body.email
      const password = req.body.password
      const confirmation = req.body.confirmation

      try {
        registerCheck({ email, password, confirmation })
      } catch (err) {
        return registrationError(res, err.message)
      }

      return this.sessionClient.send(registerMessages.build({ email, password }))
        .then(result => {
          switch (result.status) {
            case OK_STATUS: return res.redirect(303, 'login')
            case NOK_STATUS: {
              this.log('registration failed:', result.message)
              return registrationError(res, result.message)
            }
            default: return serviceUnavailable(res, result.message)
          }
        })
        .catch(err => serviceUnavailable(res, err.message))
    })
    return router
  }
}

module.exports = RegisterRouter
