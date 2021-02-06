const {
	API_KEY,
	API_SECRET
} = require("./secrets.js")

//https://github.com/jaggedsoft/node-binance-api
const Binance = require('node-binance-api');
const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET,
  //test: true // comment out when running for real
});

// Using override to test
const MAX_OVERRIDE = 12;
const PCT_BUY = 0.2;
const TAKE_PROFIT_MULTIPLIER = 2;
const STOP_LOSS_MULTIPLIER = 0.9;

let dump_count = 0;
let latestPrice = 0;

balances = {};

if (!process.argv[2]) {
	console.log("Usage: node main.js COINPAIR");
	process.exit(1);
}

coinpair = process.argv[2].toUpperCase();

coin = getCoin(coinpair);
baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";

async function init() {
	if (binance.getOption("test")) {
		console.log("testing");
	}
	await binance.useServerTime();
	await getBalanceAsync();
	getLatestPriceAsync(coinpair)
	while (Object.keys(balances).length == 0 || latestPrice == 0) {
		await sleep(100);
	}

	console.log(`You have ${getBalance(baseCurrency)} ${baseCurrency} in your account`);
	await pump();
}

async function pump() {
	//buy code here
	console.log("pump");
	console.log(`last price for ${coinpair} is : ${latestPrice}`);
	let quantity = (MAX_OVERRIDE > 0 ? MAX_OVERRIDE : PCT_BUY * getBalance(baseCurrency)) * latestPrice;
	quantity = quantity.toFixed(2);
	binance.marketBuy(coinpair, quantity, async (error, response) => {
		if (error) {
			console.log(`PUMP ERROR: ${error.body}`);
			process.exit(1);
		}
		console.log("pump is successful")
		console.info("Market Buy response", response);
		console.info("order id: " + response.orderId);
		price = response.price; // replace with price from response
		actualquantity = response.executedQty // replace with bought quantity
		await ndump(price * TAKE_PROFIT_MULTIPLIER, price, price * STOP_LOSS_MULTIPLIER, actualquantity);
	});
}

async function ndump(take_profit, buy_price, stop_loss_price, quantity, market = false) {
	console.log("dump x" + dump_count);
	if (market) {
		binance.marketSell(coinpair, quantity, (error, response) => {
			if (error) {
				console.log(`MARKET DUMP ERROR: ${error.body}`);
				return;
			}
			console.log("market dump is successful")
			console.info("Market Buy response", response);
			console.info("order id: " + response.orderId);
			process.exit(0); // kill kill kill
		});
		return;
	}

	binance.order('SELL', coinpair, quantity, take_profit, { type:'OCO', stopLimitPrice: stop_loss_price, stopPrice: buy_price }, async (error, response) => {
		// THIS WILL ERROR 404 IF TEST IS ENABLED
		if (error) {
			console.log(`DUMP ERROR: ${error.body}`);
			if (++dump_count < 5) {
				console.log(`TRYING AGAIN`);
				await ndump(take_profit, buy_price, stop_loss_price, quantity);
			} else {
				console.log(`DUMP OCO FAILED, BEGIN MARKET SELL`); // sadness awaits
				await ndump(take_profit, buy_price, stop_loss_price, quantity, true);
			}
			return
		} else {
			// loop every 100ms
			console.log("market dump OCO is successful")
			console.info("Market Buy response", response);
			console.info("order id: " + response.orderId);
			checkPrice();
			checkOCO(orderId);
		}
	});
}

// Checks price every 100ms, checks order status filled, handles exceptions
async function checkOCO() {
	binance.orderStatus("ETHBTC", orderid, (error, orderStatus, symbol) => {
	  console.info(symbol+" order status:", orderStatus);
	});
	process.exit(0)
}

function getLatestPriceAsync(coinpair) {
	return new Promise(async (resolve) => {
		while (true) {
			let ticker = await binance.prices(coinpair);
			latestPrice = ticker[coinpair]
			//console.log(`latest price is ${latestPrice}`);
			sleep(1500);
		}
	});
}

async function getBalanceAsync(coin) {
	binance.balance((error, b) => {
	  if ( error ) return console.error(error);
	  balances = b;
	});
}

// HELPER FUNCTIONS
function getBalance(coin) {
	return balances[coin].available
}

function getCoin(coinpair) {
	if (coinpair == "BTCUSDT") {
		return "BTC"; // the one exception
	}
	return coinpair.split("BTC").join("").split("USDT").join("")
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

init();