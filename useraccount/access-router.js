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

const LOGIN = 'login'
const REGISTER = 'register'

const registerMessages = withAction(REGISTER)
const loginMessages = withAction(LOGIN)
const registerCheck = Validator.createCheck(registerSchema)
const loginCheck = Validator.createCheck(loginSchema)

const errorResponse = (res, view, message, email) => res.render(view, { error: message, email })

const hash = data => crypto.createHash('sha256').update(data).digest('hex')

class AccessRouter extends LogTrait {
  constructor (sessionClient, httpConfig) {
    super()
    this.sessionClient = sessionClient
    this.pathPrefix = httpConfig.path

    this.loginPath = `${this.pathPrefix}/${LOGIN}`
    this.registerPath = `${this.pathPrefix}/${REGISTER}`
    this.homePath = `${this.pathPrefix}/index`
  }

  createAuthenticationCheck () {
    const unprotectedPaths = [this.loginPath, this.registerPath, `${this.pathPrefix}/version`]
    const verifyMessages = withAction('verify')

    const redirectToLogin = (res, flag = 'auth') => {
      this.log('authentication required')
      return res.redirect(303, this.loginPath + '?' + querystring.stringify({ flag }))
    }

    return (req, res, next) => {
      if (unprotectedPaths.includes(req.path)) { return next() }
      if (req.session && req.session.jwt) {
        return this.sessionClient.send(verifyMessages.build({ jwt: req.session.jwt }))
          .then(result => {
            switch (result.status) {
              case OK_STATUS: {
                req.user = jsonwebtoken.decode(req.session.jwt)
                res.locals.user = req.user
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
    const serviceUnavailable = (res, view, backendMessage, email) => {
      this.log('session service error:', backendMessage)
      errorResponse(res, view, 'service unavailable', email)
    }

    const router = express.Router()
    router.get(`/${REGISTER}`, (_, res) => res.render(REGISTER))

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
            case OK_STATUS: return res.redirect(303, this.loginPath + '?' + querystring.stringify({ flag: 'reg' }))
            case NOK_STATUS: {
              this.log('registration failed:', result.message)
              return errorResponse(res, REGISTER, result.message, email)
            }
            default: return serviceUnavailable(res, REGISTER, result.message, email)
          }
        })
        .catch(err => serviceUnavailable(res, REGISTER, err.message, email))
    })

    router.get(`/${LOGIN}`, (req, res) => {
      const flag = req.query.flag
      res.render(LOGIN, { flag })
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
              req.session.jwt = result.jwt
              return res.redirect(303, this.homePath)
            }
            case NOK_STATUS: {
              this.log('login failed:', result.message)
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
