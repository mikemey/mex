class ClientError extends Error {
  constructor (message, response, fatal = true) {
    super(message)
    this.name = this.constructor.name
    this.clientResponse = response
    this.fatal = fatal
  }
}

module.exports = { ClientError }
