const {
	API_KEY,
	API_SECRET
} = require("./secrets.js")

const fs = require('fs');
const asciichart = require ('asciichart')
//https://github.com/jaggedsoft/node-binance-api
const Binance = require('node-binance-api');
const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET,
  //test: true // comment out when running for real
});


// MAKE SURE TO HAVE BNB IN YOUR ACCOUNT
// Using override to test
const MAX_OVERRIDE_BTC = 0.001;
const MAX_OVERRIDE_USDT = 0;
const PCT_BUY = 0.5;
const TAKE_PROFIT_MULTIPLIER = 1.06;
const STOP_LOSS_MULTIPLIER = 0.97;
const RUNTIME = 10; //mins
const USE_TIMEOUT = false;
const SELL_LOCAL_MAX = true;
const BUY_LOCAL_MIN = true;
const QUEUE_SIZE = 151; // USE ODD NUMBER

const POLL_INTERVAL = 100;
const CONSOLE_UPDATE_INTERVAL = 10000;
const LOOP = true;
const EPSILON = 0.00069420;
const APPROX_LOCAL_MIN_MAX_BUFFER = 2;
const GRAPH_PADDING = '            ';
const SHOW_GRAPH = true;
const UPDATE_BUY_SELL_WINDOW = true;
const MIN_QUEUE_SIZE = 50;
const BUY_SELL_STRATEGY = 2; // 1 = Min/max in middle, 2 = Min/max at start
const TIME_BEFORE_NEW_BUY = 5;// mins
const BUFFER_AFTER_FAIL = true;
const LOOKBACK_SIZE = 10000;
const LOOKBACK_TREND_LIMIT = 3000;
const LOOKBACK_BUFFER = 300;

var SELL_ALT_QUEUE_SIZE = 100;
var BUY_ALT_QUEUE_SIZE = 100;
var QUEUE_ADJ = 5;

dump_count = 0;
latestPrice = 0;
q = [];
lookback = [];

fail_counter = 0;
dont_buy_before = 0;

balances = {};
coinInfo = null;

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
	//await getExchangeInfo(coinpair);
	readCoinInfo(); // pretty unchanging. Call getExchangeInfo to update file
	while (Object.keys(balances).length == 0 || coinInfo == null) {
		if (coinInfo == null) {
			readCoinInfo();
		}
		await sleep(100);
	}
	console.log(`You have ${getBalance(baseCurrency)} ${baseCurrency} in your account`);
	pump();
}

async function pump() {
	//buy code here
	console.log("pump");
	if (BUY_LOCAL_MIN) {
		latestPrice = await waitUntilTimeToBuy();
	} else {
		latestPrice = await getLatestPriceAsync(coinpair);
	}
	console.log(`last price for ${coinpair} is : ${latestPrice}`);
	override = baseCurrency == "USDT" ? MAX_OVERRIDE_USDT : MAX_OVERRIDE_BTC
	let quantity = (override > 0 ? override : PCT_BUY * getBalance(baseCurrency)) / latestPrice;
	quantity = quantity - quantity % coinInfo.stepSize
	console.log(`Buying ${quantity} ${coin}`);
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
		ndump((price * TAKE_PROFIT_MULTIPLIER).toPrecision(4), price, (price * STOP_LOSS_MULTIPLIER).toPrecision(4), actualquantity);
	});
}

async function ndump(take_profit, buy_price, stop_loss, quantity) {
	waiting = true;
	latestPrice = await waitUntilTimeToSell(take_profit, stop_loss, buy_price);
	console.log(latestPrice > take_profit ? "taking profit" : "stopping loss");
	binance.marketSell(coinpair, quantity, (error, response) => {
		if (error) {
			console.log(`MARKET DUMP ERROR: ${error.body}`);
			console.log("we're screwed");
			return;
		}
		price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		console.log("market dump is successful")
		console.info("Market sell response", response);
		console.info("order id: " + response.orderId);
		if (LOOP) {
			if (UPDATE_BUY_SELL_WINDOW) {
				if (price < buy_price) {
					BUY_ALT_QUEUE_SIZE = Math.max(BUY_ALT_QUEUE_SIZE - QUEUE_ADJ, QUEUE_SIZE);
					SELL_ALT_QUEUE_SIZE = Math.max(SELL_ALT_QUEUE_SIZE - QUEUE_ADJ, MIN_QUEUE_SIZE);
					if (BUFFER_AFTER_FAIL) {
						dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY * 60000;
					}
				} else {
					SELL_ALT_QUEUE_SIZE = Math.min(SELL_ALT_QUEUE_SIZE + QUEUE_ADJ, QUEUE_SIZE);
					BUY_ALT_QUEUE_SIZE = Math.min(BUY_ALT_QUEUE_SIZE + QUEUE_ADJ, MIN_QUEUE_SIZE);
				}
			}
			pump()
			return;
		}
		process.exit(0); // kill kill kill
	});
	return;
}

async function waitUntilTimeToBuy() {
	if (q.length == 0) {
		q = new Array(QUEUE_SIZE).fill(await getLatestPriceAsync(coinpair) * 1.05); // for graph visualization
	}
	count = 0;
	while (true) {
		await sleep(POLL_INTERVAL);
		latestPrice = await getLatestPriceAsync(coinpair)
		console.clear();
		console.log(`Waiting to buy at local minimum. Current price: \x1b[32m${latestPrice}\x1b[0m Queue size: ${BUY_ALT_QUEUE_SIZE}`);
		q.push(latestPrice);
		if (BUY_LOCAL_MIN && q.shift() != 0 && Date.now > dont_buy_before) {
			switch (BUY_SELL_STRATEGY) {
				case 1:
					middle = q[QUEUE_SIZE/2 - 0.5]
					if (q.slice(0, q.length/2 - 0.5).filter(v => v < middle).length < APPROX_LOCAL_MIN_MAX_BUFFER 
						&& q.slice(q.length/2 + 0.5).filter(v => v < middle).length < APPROX_LOCAL_MIN_MAX_BUFFER 
						&& q.slice(-1).pop()/Math.max(...q) > 1 - EPSILON) {
						console.log(`Local min reached at ${middle}`);
						return latestPrice;
					}
					break;
				case 2:
					q2 = q.slice(-BUY_ALT_QUEUE_SIZE);
					last = q2[q2.length-1];
					secondLast = q2[q2.length-2];
					uptrend = isUptrend(q2, APPROX_LOCAL_MIN_MAX_BUFFER);
					lookbackDowntrend = isDowntrend(lookback.slice(-LOOKBACK_TREND_LIMIT, -BUY_ALT_QUEUE_SIZE), LOOKBACK_BUFFER);
					console.log(`currently \x1b[31m${!uptrend ? "NOT " : ""}\x1b[0m) uptrend, previously \x1b[32m${lookbackDowntrend ? "DOWN " : "no "}\x1b[0m) trend`)
					if (uptrend &&
						!lookbackDowntrend
						//&& Math.abs(last - secondLast) < getStandardDeviation(q2)*1.3 // ignore outliers
						) {
						console.log(`Incline reached at ${first} -> ${last}`);
						return latestPrice;
					}
					break;
				default:
					break;
			}
		}
		if (SHOW_GRAPH) {
			console.log (asciichart.plot([q], {format: formatGraph, padding: GRAPH_PADDING, height: 30}));
		}
	}
}

async function waitUntilTimeToSell(take_profit, stop_loss, buy_price) {
	start = Date.now();
	end = Date.now() + RUNTIME * 60000;
	if (q.length == 0) {
		// This should never be the case
		q = new Array(QUEUE_SIZE).fill(latestPrice * 0.95); // for graph visualization
	}
	count = 0;
	while (latestPrice > stop_loss && latestPrice < take_profit) {
		await sleep(POLL_INTERVAL);
		latestPrice = await getLatestPriceAsync(coinpair);
		console.clear();
		console.log(`Waiting to sell at local maximum. Current price: \x1b[32m${latestPrice}\x1b[0m Buy Price: \x1b[33m${buy_price}\x1b[0m Stop Loss Price: \x1b[31m${stop_loss}\x1b[0m Queue Size: ${SELL_ALT_QUEUE_SIZE}`);
		q.push(latestPrice);
		if (SELL_LOCAL_MAX && q.shift() != 0) {
			switch (BUY_SELL_STRATEGY) {
				case 1:
					middle = q[QUEUE_SIZE/2 - 0.5]
					if (q.slice(0, q.length/2 - 0.5).filter(v => v > middle).length < APPROX_LOCAL_MIN_MAX_BUFFER
						&& q.slice(q.length/2 + 0.5).filter(v => v > middle).length < APPROX_LOCAL_MIN_MAX_BUFFER
						&& q.slice(-1).pop()/Math.min(...q) < 1 + EPSILON) {
						if (latestPrice > buy_price) {
							stop_loss = latestPrice;
							console.log ("hit local maximum, setting new stop loss at " + latestPrice);
							sleep(POLL_INTERVAL);
							latestPrice = await getLatestPriceAsync(coinpair);
						} else {
							return latestPrice;
						}
					}
					break;
				case 2:
					q2 = q.slice(-SELL_ALT_QUEUE_SIZE);
					last = q2[q2.length-1];
					secondLast = q2[q2.length-2];
					downtrend = isDowntrend(q2, APPROX_LOCAL_MIN_MAX_BUFFER);
					lookbackUptrend = isUptrend(lookback.slice(-LOOKBACK_TREND_LIMIT, -SELL_ALT_QUEUE_SIZE), LOOKBACK_BUFFER)
					console.log(`currently \x1b[31m${!downtrend ? "NOT " : ""}\x1b[0m) downtrend, previously \x1b[32m${lookbackUptrend ? "UP " : "no "}\x1b[0m) trend`)
					if (//Math.abs(latestPrice-buy_price)/buy_price > 0.005 && // don't sell if its too close to buy price
						downtrend
						&& !lookbackUptrend
						//&& Math.abs(secondLast - last) < getStandardDeviation(q2)*1.3 // ignore outliers
						) {
						console.log(`Decline reached at ${first} -> ${last}`);
						return latestPrice;
					}
					break;
				default:
					// do nothing
					break;

			}
		}
		if (Date.now() > end && USE_TIMEOUT) {
			console.log(`${RUNTIME}m expired without hitting take profit or stop loss`);
			return latestPrice;
		}
		if (SHOW_GRAPH) {
			console.log (asciichart.plot([q], {format: formatGraph, padding: GRAPH_PADDING, height: 30}));
		}
	}
	return latestPrice
}

async function getLatestPriceAsync(coinpair) {
	try {
		let ticker = await binance.prices(coinpair);
		fail_counter = 0;
		pushToLookback(ticker[coinpair]);
		return ticker[coinpair];
	} catch (e) {
		if (++fail_counter == 5) {
			console.log(`Too many fails fetching price of ${coinpair}, exiting`);
			process.exit(1);
		}
		return await getLatestPriceAsync(coinpair);
	}
}

async function getBalanceAsync(coin) {
	binance.balance((error, b) => {
	  if ( error ) return console.error(error);
	  balances = b;
	});
}

// HELPER FUNCTIONS
function isUptrend(q2, buffer) {
	return q2.slice(0, q2.length-1).filter(v => v < q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v > q2[0]).length < buffer
}

function isDowntrend(q2, buffer) {
	return q2.slice(0, q2.length-1).filter(v => v > q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v < q2[0]).length < buffer
}

function getBalance(coin) {
	return balances[coin].available
}

function getCoin(coinpair) {
	if (coinpair == "BTCUSDT") {
		return "BTC"; // the one exception
	}
	return coinpair.split("BTC").join("").split("USDT").join("")
}

function pushToLookback(latestPrice) {
	lookback.push(latestPrice);
	if (lookback.length > LOOKBACK_SIZE) {
		lookback.shift();
	}
}

function readCoinInfo() {
	fs.readFile("minimums.json", function(err, data){
		if (err) {
			console.log("minimums.json read error");
			process.exit(1);
		}
		coinInfo = JSON.parse(data)[coinpair]
		if (coinInfo != null) {
			console.log(coinInfo);
		}
	});
}

async function getExchangeInfo() {
	await binance.exchangeInfo(function(error, data) {
		let minimums = {};
		for ( let obj of data.symbols ) {
			let filters = {status: obj.status};
			for ( let filter of obj.filters ) {
				if ( filter.filterType == "MIN_NOTIONAL" ) {
					filters.minNotional = filter.minNotional;
				} else if ( filter.filterType == "PRICE_FILTER" ) {
					filters.minPrice = filter.minPrice;
					filters.maxPrice = filter.maxPrice;
					filters.tickSize = filter.tickSize;
				} else if ( filter.filterType == "LOT_SIZE" ) {
					filters.stepSize = filter.stepSize;
					filters.minQty = filter.minQty;
					filters.maxQty = filter.maxQty;
				}
			}
			//filters.baseAssetPrecision = obj.baseAssetPrecision;
			//filters.quoteAssetPrecision = obj.quoteAssetPrecision;
			filters.orderTypes = obj.orderTypes;
			filters.icebergAllowed = obj.icebergAllowed;
			minimums[obj.symbol] = filters;
		}
		fs.writeFile("minimums.json", JSON.stringify(minimums, null, 4), function(err){});
	});
}

function getStandardDeviation(values){
  var avg = average(values);
  
  var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });
  
  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + parseFloat(value);
  }, 0);

  var avg = sum / data.length;
  return avg;
}

function formatGraph(x, i) {
	return (GRAPH_PADDING + x.toFixed (10)).slice (-GRAPH_PADDING.length);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

init();