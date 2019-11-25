
const LogTrait = require('./logtrait')
const wsmessages = require('./wsmessages')
const errors = require('./errors')
const dbconnection = require('./dbconnection')
const Validator = require('./validator')

const randomLarge = () => Math.floor(Math.random() * 1000000000000) + 1000000000000
const randomHash = () => randomLarge().toString(36).substring(1)

module.exports = { LogTrait, wsmessages, errors, dbconnection, Validator, randomHash }
