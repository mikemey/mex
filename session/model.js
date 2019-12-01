const passportLocalMongoose = require('passport-local-mongoose')

const mg = require('../utils').dbconnection.mongoose

const CredentialsSchema = new mg.Schema({
  email: { type: String, index: true },
  password: String
})
CredentialsSchema.plugin(passportLocalMongoose, {
  usernameField: 'email',
  usernameUnique: true
})

const Credentials = mg.model('Credentials', CredentialsSchema)
module.exports = { Credentials }
