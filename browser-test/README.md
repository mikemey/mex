## browser-test

Using [Cypress](https://github.com/cypress-io/cypress) to run UI tests against `useraccount` service. 

- run browser tests: `npm run e2e` or directly with `e2ehelper.sh`

`e2ehelper.sh` starts/stops all services (using `orchestrator.e2e.js`) and runs/opens cypress
tests.

##### `e2ehelper.sh`
```
  Usage: e2ehelper.sh [ start | stop | run | open ]

Commands:
  start           starts service
  stop            stops service
  run   (default) runs cypress tests (also executes start/stop commands)
  open            opens cypress UI (also executes start/stop commands)

Configured binaries:
  service binary: (node ./browser-test/orchestrator.e2e.js start)
  cypress binary: (npx cypress [ run | open ])
All outputs are redirected to './browser-test/tmp.out.e2e'
```

Service stdout/stderr streams are redirected to `tmp.out.e2e`; prefixed with the service name.

##### `orchestrator.e2e.js`

Orchestrator to start/stop services:
- start a single service directly: `node orchestrator.e2e.js [service-name]`
- start all services: `node orchestrator.e2e.js start`

Service names:
- `session`
- `wallet`
- `useraccount`
