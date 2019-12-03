const RegtestSetup = require('./regtest.orch')

describe('A unit test', () => {
  const regtest = RegtestSetup()

  // before(function () {
  //   this.timeout(60000)
  //   return regtest.start()
  // })
  // after(regtest.stop)

  it('does the right thing', () => regtest.getBalance()
    .then(balance => {
      console.log('the balance is:', balance)
    }))
})
