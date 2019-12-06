const crypto = require('crypto')
const express = require('express')
const jsonwebtoken = require('jsonwebtoken')
const querystring = require('querystring')
const Joi = require('@hapi/joi')

const {
  wsmessages: { withAction, OK_STATUS, NOK_STATUS },
  Validator, LogTrait
} = require('../utils')

const registerSchema = Joi.object({
  email: Validator.email(),
  password: Validator.plainPassword(),
  confirmation: Joi.any().valid(Joi.ref('password')).required()
    .error(errors => {
      errors.forEach(err => { err.message = 'password and confirmation not matching' })
      return errors
    })
})

const loginSchema = Joi.object({
  email: Validator.email(),
  password: Validator.plainPassword()
})

const LOGIN_VIEW = 'login'
const REGISTER_VIEW = 'register'

const hash = data => crypto.createHash('sha256').update(data).digest('hex')

class AccessRouter extends LogTrait {
  constructor (sessionClient, httpConfig) {
    super()
    this.sessionClient = sessionClient
    this.httpConfig = httpConfig
  }

  createAuthenticationCheck () {
    const pathPrefix = this.httpConfig.path
    const unprotectedPaths = [`${pathPrefix}/login`, `${pathPrefix}/register`, `${pathPrefix}/version`]
    const verifyMessages = withAction('verify')

    const redirectToLogin = (res, flag = 'auth') => {
      this.log('authentication required')
      return res.redirect(303, `${pathPrefix}/${LOGIN_VIEW}?` + querystring.stringify({ flag }))
    }

    return (req, res, next) => {
      if (unprotectedPaths.includes(req.path)) { return next() }
      if (req.session && req.session.jwt) {
        return this.sessionClient.send(verifyMessages.build({ jwt: req.session.jwt }))
          .then(result => {
            switch (result.status) {
              case OK_STATUS: {
                res.locals.user = jsonwebtoken.decode(req.session.jwt)
                return next()
              }
              case NOK_STATUS: return redirectToLogin(res)
              default: {
                this.log('session service verification error:', result.message)
                return redirectToLogin(res, 'unavailable')
              }
            }
          })
      }
      return redirectToLogin(res)
    }
  }

  createRoutes () {
    const router = express.Router()

    const registerMessages = withAction('register')
    const loginMessages = withAction('login')
    const registerCheck = Validator.createCheck(registerSchema)
    const loginCheck = Validator.createCheck(loginSchema)

    const errorResponse = (res, view, message, email) => res.render(view, { error: message, email })
    const serviceUnavailable = (res, view, backendMessage, email) => {
      this.log('session service error:', backendMessage)
      errorResponse(res, view, 'service unavailable', email)
    }

    router.get('/register', (_, res) => res.render(REGISTER_VIEW))

    router.post('/register', (req, res) => {
      const email = req.body.email
      const password = req.body.password
      const confirmation = req.body.confirmation
      try {
        registerCheck({ email, password, confirmation })
      } catch (err) {
        return errorResponse(res, REGISTER_VIEW, err.message, email)
      }
      return this.sessionClient.send(registerMessages.build({ email, password: hash(password) }))
        .then(result => {
          switch (result.status) {
            case OK_STATUS: return res.redirect(303, `${LOGIN_VIEW}?${querystring.stringify({ flag: 'reg' })}`)
            case NOK_STATUS: {
              this.log('registration failed:', result.message)
              return errorResponse(res, REGISTER_VIEW, result.message, email)
            }
            default: return serviceUnavailable(res, REGISTER_VIEW, result.message, email)
          }
        })
        .catch(err => serviceUnavailable(res, REGISTER_VIEW, err.message, email))
    })

    router.get('/login', (req, res) => {
      const flag = req.query.flag
      res.render(LOGIN_VIEW, { flag })
    })

    router.post('/login', (req, res) => {
      const email = req.body.email
      const password = req.body.password
      try {
        loginCheck({ email, password })
      } catch (err) {
        return errorResponse(res, LOGIN_VIEW, err.message, email)
      }

      return this.sessionClient.send(loginMessages.build({ email, password: hash(password) }))
        .then(result => {
          switch (result.status) {
            case OK_STATUS: {
              req.session.jwt = result.jwt
              return res.redirect(303, 'index')
            }
            case NOK_STATUS: {
              this.log('login failed:', result.message)
              return errorResponse(res, LOGIN_VIEW, result.message, email)
            }
            default: return serviceUnavailable(res, LOGIN_VIEW, result.message, email)
          }
        })
        .catch(err => serviceUnavailable(res, LOGIN_VIEW, err.message, email))
    })

    return router
  }
}

module.exports = AccessRouter
