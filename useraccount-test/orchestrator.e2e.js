const UserAccountService = require('../useraccount')

const serviceConfig = {
  path: '/test',
  port: 13033
}
const uas = new UserAccountService(serviceConfig)

const uasurl = `http://localhost:${serviceConfig.port}${serviceConfig.path}`

uas.start()
  .then(() => {
    console.log(`baseurl=${uasurl}`)
    console.log(`pid=${process.pid}`)
  })
