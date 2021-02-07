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
const MAX_OVERRIDE = 0.001;
const PCT_BUY = 0.2;
const TAKE_PROFIT_MULTIPLIER = 1.05;
const STOP_LOSS_MULTIPLIER = 0.98;
const RUNTIME = 10; //mins

dump_count = 0;
latestPrice = 0;

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
	while (Object.keys(balances).length == 0) {
		await sleep(100);
	}
	latestPrice = await getLatestPriceAsync(coinpair);
	console.log(latestPrice)

	console.log(`You have ${getBalance(baseCurrency)} ${baseCurrency} in your account`);
	await pump();
}

async function pump() {
	//buy code here
	console.log("pump");
	console.log(`last price for ${coinpair} is : ${latestPrice}`);
	let quantity = (MAX_OVERRIDE > 0 ? MAX_OVERRIDE : PCT_BUY * getBalance(baseCurrency)) / latestPrice;
	quantity = quantity.toPrecision(2);
	console.log(quantity)
	binance.marketBuy(coinpair, quantity, async (error, response) => {
		if (error) {
			console.log(`PUMP ERROR: ${error.body}`);
			process.exit(1);
		}
		console.log("pump is successful")
		console.info("Market Buy response", response);
		console.info("order id: " + response.orderId);

		price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		actualquantity = response.executedQty // replace with bought quantity
		await ndump((price * TAKE_PROFIT_MULTIPLIER).toPrecision(8), price, (price * STOP_LOSS_MULTIPLIER).toPrecision(8), actualquantity);
	});
}

async function ndump(take_profit, buy_price, stop_loss_price, quantity) {
	waiting = true;
	await sleep(2000);
	start = Date.now();
	end = Date.now() + RUNTIME * 60000
	while (latestPrice > stop_loss_price && latestPrice < take_profit) {
		latestPrice = await getLatestPriceAsync(coinpair)
		console.log(`buy: ${buy_price}, profit: ${take_profit}, price: ${latestPrice}, loss: ${stop_loss_price}`);
		await sleep(100);
		if (Date.now() > end) {
			console.log(`${RUNTIME}m expired without hitting take profit or stop loss`);
			break;
		}
	}
	console.log(latestPrice > take_profit ? "taking profit" : "stopping loss");
	binance.marketSell(coinpair, quantity, (error, response) => {
		if (error) {
			console.log(`MARKET DUMP ERROR: ${error.body}`);
			console.log("we're screwed");
			return;
		}
		console.log("market dump is successful")
		console.info("Market sell response", response);
		console.info("order id: " + response.orderId);
		process.exit(0); // kill kill kill
	});
	return;
}

async function getLatestPriceAsync(coinpair) {
	let ticker = await binance.prices(coinpair);
	return ticker[coinpair];
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