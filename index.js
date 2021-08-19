require('dotenv').config()
const Web3 = require('web3')
const moment = require('moment-timezone')
const { UNISWAP_FACTORY_ABI, UNISWAP_FACTORY_ADDRESS, UNISWAP_EXCHANGE_ABI, KYBER_RATE_ABI, KYBER_RATE_ADDRESS }  =  require('./src/exchanges') 
const { tokens } = require('./src/tokens')
const web3 = new Web3(process.env.RPC_URL)

const uniswapFactoryContract = new web3.eth.Contract(UNISWAP_FACTORY_ABI, UNISWAP_FACTORY_ADDRESS)
const kyberRateContract = new web3.eth.Contract(KYBER_RATE_ABI, KYBER_RATE_ADDRESS)

async function checkPair(args) {
  const { inputTokenSymbol, inputTokenAddress, outputTokenSymbol, outputTokenAddress, inputAmount } = args

  const exchangeAddress = await uniswapFactoryContract.methods.getExchange(outputTokenAddress).call()
  const exchangeContract = new web3.eth.Contract(UNISWAP_EXCHANGE_ABI, exchangeAddress)

  const uniswapResult = await exchangeContract.methods.getEthToTokenOutputPrice(inputAmount).call()
  let kyberResult = await kyberRateContract.methods.getExpectedRate(inputTokenAddress, outputTokenAddress, inputAmount).call()

  console.table([{
    'Input Token': inputTokenSymbol,
    'Output Token': outputTokenSymbol,
    'Input Amount': web3.utils.fromWei(inputAmount, 'Ether'),
    'Uniswap Return': web3.utils.fromWei(uniswapResult, 'Ether'),
    'Kyber Expected Rate': web3.utils.fromWei(kyberResult.expectedRate, 'Ether'),
    'Kyber Min Return': web3.utils.fromWei(kyberResult.worstRate, 'Ether'),
    'Timestamp': moment().tz('America/Chicago').format(),
  }])
}

let priceMonitor
let monitoringPrice = false

 function monitorPrice() {
  if(monitoringPrice) {
    return
  }

  console.log("Checking prices...")
  monitoringPrice = true

  try {

    {tokens.map(( async token => {

      await checkPair({
        inputTokenSymbol: 'ETH',
        inputTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        outputTokenSymbol: token.symbol,
        outputTokenAddress: token.address,
        inputAmount: web3.utils.toWei('1', 'ETHER')
      })
    }))}
  
  } catch (error) {
    console.error(error)
    monitoringPrice = false
    clearInterval(priceMonitor)
    return
  }

  monitoringPrice = false
}

// Check markets every n seconds
const POLLING_INTERVAL = process.env.POLLING_INTERVAL || 3000 // 3 Seconds
priceMonitor = setInterval(async () => { await monitorPrice() }, POLLING_INTERVAL)