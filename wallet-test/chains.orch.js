const btcnodeOrch = require('./chains/btc-node.orch')

const nodeOrchs = {
  btc: btcnodeOrch
}

const getChainOrch = symbol => nodeOrchs[symbol]

const startNodes = () => Promise.all(
  Object.values(nodeOrchs).map(orch => orch.startNode())
)
const stopNodes = () => Promise.all(
  Object.values(nodeOrchs).map(orch => orch.stopNode())
)

module.exports = {
  startNodes, stopNodes, getChainOrch
}
