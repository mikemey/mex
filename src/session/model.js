const passportLocalMongoose = require('passport-local-mongoose')

const mg = require('../utils').dbconnection.mongoose

const AccountSchema = new mg.Schema({
  username: String,
  password: String
})
AccountSchema.plugin(passportLocalMongoose)

const Account = mg.model('Account', AccountSchema)
module.exports = { Account }
