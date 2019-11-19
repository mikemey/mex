class ClientError extends Error {
  constructor (message, fatal = false) {
    super(message)
    this.name = this.constructor.name
    this.clientMessage = message
    this.fatal = fatal
    // Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = ClientError
