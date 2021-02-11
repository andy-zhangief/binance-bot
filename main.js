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
const PCT_BUY = 0.2;
const TAKE_PROFIT_MULTIPLIER = 1.05;
const STOP_LOSS_MULTIPLIER = 0.985;
const RUNTIME = 10; //mins
const USE_TIMEOUT = false;
const SELL_LOCAL_MAX = true;
const BUY_LOCAL_MIN = true;
const QUEUE_SIZE = 151; // USE ODD NUMBER

const POLL_INTERVAL = 700; // roughly 1 second?
const CONSOLE_UPDATE_INTERVAL = 10000;
const LOOP = true;
const EPSILON = 0.00069420;
const ONE_MIN = 60000;
const APPROX_LOCAL_MIN_MAX_BUFFER_PCT = 0.1;
const GRAPH_PADDING = '                  ';
const SHOW_GRAPH = true;
const UPDATE_BUY_SELL_WINDOW = true;
const MIN_QUEUE_SIZE = 50;
const BUY_SELL_STRATEGY = 4; // 1 = Min/max in middle, 2 = Min/max at start, 3 = buy boulinger bounce
const TIME_BEFORE_NEW_BUY = 1;// mins
const BUFFER_AFTER_FAIL = true;
const LOOKBACK_SIZE = 10000;
const LOOKBACK_TREND_LIMIT = 500;
const ANALYSIS_TIME = 50;
const BUY_SELL_INC = 2;
const MIN_BUY_SELL_BUF = 10;
const MAX_BUY_SELL_BUF = 30;
const ANALYSIS_BUFFER = 5;
const MA_7_VAL = 420; // Ayy
const MA_15_VAL = 900;


var BB_SELL = 20;
var BB_BUY = 20;

var SELL_ALT_QUEUE_SIZE = 50;
var BUY_ALT_QUEUE_SIZE = 50;
var QUEUE_ADJ = 5;

dump_count = 0;
latestPrice = 0;
q = [];
lowstd = [];
highstd = [];
lookback = [];
means = [];
ma7 = [];
ma15 = [];

BUY_TS = 0;
SELL_TS = 0;
ANALYZE = false;

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
	let quantity = ((override > 0 ? override : PCT_BUY * getBalance(baseCurrency)) / latestPrice).toFixed(4);
	quantity = quantity - quantity % coinInfo.stepSize
	quantity = parseFloat(quantity.toPrecision(4));
	console.log(`Buying ${quantity} ${coin}`);
	binance.marketBuy(coinpair, quantity, async (error, response) => {
		if (error) {
			console.log(`PUMP ERROR: ${error.body}`);
			process.exit(1);
		}
		console.log("pump is successful")
		console.info("Market Buy response", response);
		console.info("order id: " + response.orderId);
		BUY_TS = 0;
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
		SELL_TS = 0;
		ANALYZE = true;
		if (LOOP) {
			if (BUFFER_AFTER_FAIL) {
				dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY * ONE_MIN;
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
		q = new Array(QUEUE_SIZE).fill(await getLatestPriceAsync(coinpair)); // for graph visualization
		means = new Array(QUEUE_SIZE).fill(q[0]);
		lowstd = new Array(QUEUE_SIZE).fill(q[0]);
		highstd = new Array(QUEUE_SIZE).fill(q[0]);
		ma7 = new Array(QUEUE_SIZE).fill(q[0]);
		ma15 = new Array(QUEUE_SIZE).fill(q[0]);
	}
	count = 0;
	meanRev = false;
	meanRevStart = 0;
	outlierReversion = 0;
	ready = false;
	while (true) {
		var [mean, stdev] = await tick();
		console.clear();
		meanTrend = isDowntrend(means.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)? "\x1b[31mDown\x1b[0m" 
			: isUptrend(means.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? "\x1b[32mUp\x1b[0m" 
			: "None";
		maTrend = ma7.slice(-1).pop() > ma15.slice(-1).pop() ? "\x1b[32mBULL\x1b[0m" : "\x1b[31mBEAR\x1b[0m";
		console.log(`Current price: \x1b[32m${latestPrice}\x1b[0m, Mean trend : ${meanTrend}, MA Trend: ${maTrend}, Buy Buffer: ${BB_BUY}, Last value is ${lastValueIsOutlier() ? "" : "NOT"} outlier, Data points: ${lookback.length}, ${Date.now() < dont_buy_before ? ("NOT BUYING for " + msToTime(dont_buy_before-Date.now())) : !ready ? "NOT READY" : meanRev ? "waiting 4 bounce" : "waiting 4 Boulinger"}`);
		if (BUY_LOCAL_MIN && Date.now() > dont_buy_before) {
			switch (BUY_SELL_STRATEGY) {
				case 3:
					if (lookback.length < MA_15_VAL) {
						break; // dont buy before we populate some values first
					} 
					ready = true;
					if (latestPrice < lowstd[lowstd.length-1]) {
						if (!meanRev) {
							meanRev = true;
							meanRevStart = Date.now();
						} else if (meanRevStart < Date.now() - ONE_MIN){
							// not sure about this
							// dont_buy_before = Date.now() + 0.5 * ONE_MIN; // wait until things calm down a bit
							//meanRevStart = dont_buy_before;
						}
					}
					if (outlierReversion > 0 && --outlierReversion > 0) {
						break;
					}
					if (lastValueIsOutlier()) {
						outlierReversion += 2; // Don't care as much when buying
						break;
					}
					if (latestPrice < highstd[highstd.length-1]
						&& latestPrice > lowstd[lowstd.length-1]
						&& ma7.slice(-1).pop() > ma15.slice(-1).pop()
						&& isUptrend(q.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						console.log(`Buying the Boulinger Bounce`);
						return latestPrice
					}
					break;
				case 4:
					if (lookback.length < MA_15_VAL) {
						break; // dont buy before we populate some values first
					} 
					ready = true;
					ma7last = ma7.slice(-1).pop();
					ma15last = ma15.slice(-1).pop();
					if (ma7last > ma15last
						&& ma7last > mean
						&& mean > ma15last
						&& isUptrend(means.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)
						&& ma7last - mean < stdev) {
						return latestPrice;
					}
					break;
				default:
					break;
			}
		}
		if (ANALYZE && SELL_TS > ANALYSIS_TIME + ANALYSIS_BUFFER) {
			analyzeDecision();
		}
		if (SHOW_GRAPH) {
			plot();
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
	meanRev = false;
	meanRevStart = 0;
	outlierReversion = 0;
	timeBeforeSale = Date.now() + 0.5 * ONE_MIN; // Believe in yourself!
	while (latestPrice > stop_loss && latestPrice < take_profit) {
		var [mean, stdev] = await tick();
		console.clear();
		meanTrend = isDowntrend(means.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? "Down" 
			: isUptrend(means.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? "Up" 
			: "None";
		console.log(`Mean trend is ${meanTrend}, Current price: \x1b[32m${latestPrice}\x1b[0m Buy Price: \x1b[33m${buy_price}\x1b[0m Stop Loss Price: \x1b[31m${stop_loss}\x1b[0m Sell Buffer: ${BB_SELL}`);
		if (SELL_LOCAL_MAX) {
			switch (BUY_SELL_STRATEGY) {
				case 3:
					if (latestPrice > highstd[highstd.length-1]) {
						if (!meanRev) {
							meanRev = true;
							meanRevStart = Date.now();
						} else if (meanRevStart < Date.now() - ONE_MIN){
							// This is a good thing
							return latestPrice;
						}
					} else if (Date.now() < timeBeforeSale) {
						break;
					} 
					if (latestPrice > mean
						&& isDowntrend(q.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)
						&& !isUptrend(means.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						return latestPrice;
					} else if (latestPrice < mean
						&& !isUptrend(means.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						return latestPrice;
					}
					break;
				case 4:
					ma7last = ma7.slice(-1).pop();
					meansLast = means.slice(-1).pop();
					if (isDowntrend(means.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)
						&& ma7last < meansLast 
						&& meansLast - ma7last < stdev) {
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
			plot();
		}
	}
	return latestPrice
}

function analyzeDecision() {
	// 4 cases: bought too early, bought too late, sold too early, sold too late
	ANALYZE = false;
	LB_BUY_TS = -BUY_TS - 1;
	LB_SELL_TS = -SELL_TS - 1;
	buy_val = lookback.slice(LB_BUY_TS)[0];
	sell_val = lookback.slice(LB_SELL_TS)[0];
	BUY_LOOKBACK = lookback.slice(-LB_BUY_TS - ANALYSIS_TIME, -LB_BUY_TS + ANALYSIS_TIME + 1);
	SELL_LOOKBACK = lookback.slice(-LB_SELL_TS - ANALYSIS_TIME, -LB_SELL_TS + ANALYSIS_TIME + 1);
	buy_min = Infinity;
	sell_max = 0;
	buy_min_idx = 0;
	sell_max_idx = 0;
	for (i = 0; i < BUY_LOOKBACK.length; i++) {
		if (BUY_LOOKBACK[i] < buy_min) {
			buy_min = BUY_LOOKBACK[i];
			buy_min_idx = i;
		}
		if (SELL_LOOKBACK[i] > sell_max) {
			sell_max = SELL_LOOKBACK[i];
			sell_max_idx = i;
		}
	}
	bot_idx = BUY_LOOKBACK.length/2-0.5;
	sold_idx = SELL_LOOKBACK.length/2-0.5;
	if (buy_min_idx < bot_idx - BB_BUY - ANALYSIS_BUFFER) {
		// it means we bought too late
		BB_BUY = Math.max(BB_BUY - BUY_SELL_INC, MIN_BUY_SELL_BUF);
	} else if (buy_min_idx > bot_idx) {
		// it means we made a bad buy
		BB_BUY = Math.min(BB_BUY + BUY_SELL_INC, MAX_BUY_SELL_BUF);
	}
	if (sell_max_idx < sold_idx - BB_SELL - ANALYSIS_BUFFER) {
		// it means we sold too late
		BB_SELL = Math.max(BB_SELL - BUY_SELL_INC, MIN_BUY_SELL_BUF);
	} else if (sell_max_idx > sold_idx) {
		// it means we made a bad sell
		BB_SELL = Math.min(BB_SELL + BUY_SELL_INC, MAX_BUY_SELL_BUF);
	}
	if (SELL_TS - BUY_TS < ANALYSIS_TIME && buy_val > sell_val) {
		// We made a bad buy
		BB_BUY = Math.min(BB_BUY + 2 * BUY_SELL_INC, MAX_BUY_SELL_BUF);
	}
}

async function tick() {
	await sleep(POLL_INTERVAL);
	latestPrice = await getLatestPriceAsync(coinpair);
	q.push(latestPrice);
	stdev = getStandardDeviation(q);
	mean = average(q);
	means.push(mean);
	lowstd.push(mean - 2*stdev);
	highstd.push(mean + 2*stdev);
	ma7.push(average(lookback.slice(-MA_7_VAL)));
	ma15.push(average(lookback.slice(-MA_15_VAL)));
	q.shift() != 0 && lowstd.shift() != 0 && highstd.shift() != 0 && means.shift() != 0 && ma7.shift() != 0 && ma15.shift() != 0;
	return [mean, stdev]
}

async function getLatestPriceAsync(coinpair) {
	try {
		let ticker = await binance.prices(coinpair);
		fail_counter = 0;
		pushToLookback(ticker[coinpair]);
		BUY_TS++;
		SELL_TS++;
		return ticker[coinpair];
	} catch (e) {
		if (++fail_counter == 100) {
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
	return q2.slice(0, q2.length-1).filter(v => v > q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v < q2[0]).length < buffer
}

function isDowntrend(q2, buffer) {
	return q2.slice(0, q2.length-1).filter(v => v < q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v > q2[0]).length < buffer
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

function lastValueIsOutlier() {
	stdev = (highstd[highstd.length-1] - means[means.length-1])/2;
	value = q[q.length-1];
	previous = q[q.length-2];
	return (Math.abs(value - previous) >= stdev); // I have no idea why, but I'm using 1stdev to determine if val is outlier
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

function plot() {
	console.log (
		asciichart.plot([highstd, lowstd, means, ma7, ma15, q], 
		{
			format: formatGraph, 
			colors: [
		        asciichart.red,
		        asciichart.green,
		        asciichart.yellow,
		        asciichart.lightmagenta,
		        asciichart.magenta,
		        asciichart.default,
		    ],
    		padding: GRAPH_PADDING, 
    		height: 40
    	}));
}

function msToTime(duration) {
  var seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),

  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return minutes + ":" + seconds;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

init();