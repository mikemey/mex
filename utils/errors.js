class ClientError extends Error {
  constructor (message, response) {
    super(message)
    this.name = this.constructor.name
    this.clientResponse = response
  }
}

module.exports = { ClientError }
