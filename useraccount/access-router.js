const crypto = require('crypto')
const express = require('express')
const querystring = require('querystring')
const Joi = require('@hapi/joi')

const {
  wsmessages: { withAction, OK_STATUS, NOK_STATUS }, Validator, Logger
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

const LOGIN = 'login'
const REGISTER = 'register'
const SERVICE_UNAVAILABLE = 'unavailable'

const registerMessages = withAction(REGISTER)
const loginMessages = withAction(LOGIN)
const registerCheck = Validator.createCheck(registerSchema)
const loginCheck = Validator.createCheck(loginSchema)

const errorResponse = (res, view, message, email) => res.render(view, { error: message, email })

const hash = data => crypto.createHash('sha256').update(data).digest('hex')

const ipLogFrom = req => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
  return `[${ip}]`
}

class AccessRouter {
  constructor (sessionClient, httpConfig) {
    this.sessionClient = sessionClient
    this.logger = Logger(this.constructor.name)

    this.homePath = `${httpConfig.path}/index`
    this.loginPath = `${httpConfig.path}/${LOGIN}`

    const unprotected = [
      `^${this.loginPath}$`,
      `^${httpConfig.path}/${REGISTER}$`,
      `^${httpConfig.path}/${SERVICE_UNAVAILABLE}$`,
      `^${httpConfig.path}/version$`,
      `^${httpConfig.path}/public/.*`
    ].map(str => new RegExp(str))
    this.isUnprotected = path => unprotected.find(re => path.match(re)) !== undefined
  }

  createAuthenticationCheck () {
    const verifyMessages = withAction('verify')

    const redirectToLogin = (req, res, flag = 'auth') => {
      this.logger.info(ipLogFrom(req), 'authentication required')
      return res.redirect(303, this.loginPath + '?' + querystring.stringify({ flag }))
    }

    return (req, res, next) => {
      if (this.isUnprotected(req.path)) { return next() }
      if (req.session && req.session.jwt) {
        return this.sessionClient.send(verifyMessages.build({ jwt: req.session.jwt }))
          .then(result => {
            switch (result.status) {
              case OK_STATUS: {
                req.user = result.user
                res.locals.user = result.user
                next()
                break
              }
              case NOK_STATUS: {
                redirectToLogin(req, res)
                break
              }
              default: {
                this.logger.error('session service verification error:', result.message)
                redirectToLogin(req, res, 'unavailable')
              }
            }
          })
          .catch(err => {
            this.logger.error('session service error:', err.message)
            errorResponse(res, SERVICE_UNAVAILABLE, 'Session service unavailable, sorry!')
          })
      } else {
        redirectToLogin(req, res)
      }
    }
  }

  createRoutes () {
    const serviceUnavailable = (res, view, backendMessage, email) => {
      this.logger.error('session service error:', backendMessage)
      errorResponse(res, view, 'Service unavailable', email)
    }

    const router = express.Router()
    router.get(`/${SERVICE_UNAVAILABLE}`, (_, res) => res.render(SERVICE_UNAVAILABLE))
    router.get(`/${REGISTER}`, (_, res) => res.render(REGISTER))
    router.get(`/${LOGIN}`, (req, res) => {
      const flag = req.query.flag
      res.render(LOGIN, { flag })
    })

    router.post(`/${REGISTER}`, (req, res) => {
      const email = req.body.email
      const password = req.body.password
      const confirmation = req.body.confirmation
      try {
        registerCheck({ email, password, confirmation })
      } catch (err) {
        return errorResponse(res, REGISTER, err.message, email)
      }
      return this.sessionClient.send(registerMessages.build({ email, password: hash(password) }))
        .then(result => {
          switch (result.status) {
            case OK_STATUS: {
              this.logger.info(ipLogFrom(req), 'user registration:', email)
              return res.redirect(303, this.loginPath + '?' + querystring.stringify({ flag: 'reg' }))
            }
            case NOK_STATUS: {
              this.logger.info('registration failed:', result.message)
              return errorResponse(res, REGISTER, result.message, email)
            }
            default: return serviceUnavailable(res, REGISTER, result.message, email)
          }
        })
        .catch(err => serviceUnavailable(res, REGISTER, err.message, email))
    })

    router.post(`/${LOGIN}`, (req, res) => {
      const email = req.body.email
      const password = req.body.password
      try {
        loginCheck({ email, password })
      } catch (err) {
        return errorResponse(res, LOGIN, err.message, email)
      }

      return this.sessionClient.send(loginMessages.build({ email, password: hash(password) }))
        .then(result => {
          switch (result.status) {
            case OK_STATUS: {
              this.logger.info(ipLogFrom(req), 'user login:', email)
              req.session.jwt = result.jwt
              return res.redirect(303, this.homePath)
            }
            case NOK_STATUS: {
              this.logger.info('login failed:', result.message)
              return errorResponse(res, LOGIN, result.message, email)
            }
            default: return serviceUnavailable(res, LOGIN, result.message, email)
          }
        })
        .catch(err => serviceUnavailable(res, LOGIN, err.message, email))
    })

    return router
  }
}

module.exports = AccessRouter
