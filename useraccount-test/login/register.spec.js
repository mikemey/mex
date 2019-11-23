const orchestrator = require('../orchestrator')
// const { wsmessages } = require('../../utils')

describe('UserAccount register', () => {
  const agent = orchestrator.agent()
  //  const sessionMock = orchestrator.sessionMock
  // const registerAction = wsmessages.withAction('register')

  before(() => orchestrator.start())
  after(() => orchestrator.stop())

  describe('registration page', () => {
    const checkField = (el, expType, expPlaceholder) => {
      el.attr('type').should.equal(expType)
      el.attr('name').should.equal(expPlaceholder.toLowerCase())
      el.attr('placeholder').should.equal(expPlaceholder)
    }

    it('has all required fields', () => agent.get('/register')
      .then(res => orchestrator.asHtml(res))
      .then(html => {
        checkField(html('#email'), 'email', 'Email')
        checkField(html('#password'), 'password', 'Password')
        checkField(html('#confirmation'), 'password', 'Confirmation')
      })
    )

    // it('test wss', async () => {
    //   sessionMock.reset()
    //   sessionMock.respondToRegister(registerAction.ok())

    //   const received = []
    //   const client = new WebSocket(sessionMock.url)
    //   client.onmessage = event => {
    //     console.log('CLIENT message')
    //     received.push(event.data)
    //     client.close()
    //   }
    //   client.onopen = () => {
    //     console.log('CLIENT open')
    //     client.send('{ "action": "register" }')
    //   }
    //   client.onerror = err => {
    //     console.log('CLIENT ERROR')
    //     console.log(err)
    //   }
    //   client.onclose = () => {
    //     console.log('CLIENT close')
    //   }

    //   return setTimeout(() => {
    //     console.log('received:')
    //     console.log(received)
    //   }, 600)
    // })

    // it('post forwards to login page', () => agent.get('/register')
    //   .then(() => agent.post('/register').redirects(false)
    //     .send('email=first@email.com')
    //     .send('password=supersecret')
    //     .send('confirmation=supersecret')
    //   ).then(res => {
    //     res.should.have.status(303)
    //     res.should.have.header('location', /.*login$/)
    //   })
    // )
  })
})
