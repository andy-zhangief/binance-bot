const {
	API_KEY,
	API_SECRET
} = require("./secrets.js")

const fs = require('fs');
const asciichart = require ('asciichart')
//https://github.com/jaggedsoft/node-binance-api
const Binance = require('node-binance-api');
const readline = require('readline');
const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET,
  //test: true // comment out when running for real
});

// DO NOT CHANGE THESE
const ONE_MIN = 60000;
const APPROX_LOCAL_MIN_MAX_BUFFER_PCT = 0.069;

// TODO: Move const to new file
// TODO: Create web interface
// MAKE SURE TO HAVE BNB IN YOUR ACCOUNT
// IMPORTANT SETTINGS YOU SHOULD CHANGE
const MAX_OVERRIDE_BTC = 0.001;
const MAX_OVERRIDE_USDT = 30;
const PCT_BUY = 0.2; // DOES NOT WORK IF OVERRIDE_BTC OR OVERRIDE_USDT IS > 0
var TAKE_PROFIT_MULTIPLIER = 1.05; // Only change for single coinpair trading, will be unset if prepump is enabled
var STOP_LOSS_MULTIPLIER = 0.985; // Only change for single coinpair trading, will be unset if prepump is enabled
const RUNTIME = 10 * ONE_MIN; //mins
const USE_TIMEOUT = false; // Automatically sell when RUNTIME is reached
const POLL_INTERVAL = 720;// roughly 1 second
var LOOP = true; // false for single buy and quit

// GRAPH SETTINGS
const SHOW_GRAPH = true;
const GRAPH_PADDING = '               ';
const GRAPH_HEIGHT = 32;
const PLOT_DATA_POINTS = 120; // Play around with this value. It can be as high as POLL_INTERVAL

// BUY SELL SETTINGS
const BUY_SELL_STRATEGY = 6; // 3 = buy boulinger bounce, 6 is wait until min and buy bounce
const TIME_BEFORE_NEW_BUY = ONE_MIN;
const BUFFER_AFTER_FAIL = true;
const OPPORTUNITY_EXPIRE_WINDOW = 10 * ONE_MIN;
const BUY_LOCAL_MIN = true;
const BUY_INDICATOR_INC = 0.5 * ONE_MIN;

// ANALYSIS SETTINS
var ANALYZE = false;
const ANALYSIS_TIME = 60; //Seconds
const ANALYSIS_BUFFER = 5;
const BUY_SELL_INC = 2;
const MIN_BUY_SELL_BUF = 10;
const MAX_BUY_SELL_BUF = 60;

// QUEUE SETTINGS
const QUEUE_SIZE = 960; // 16m
const MIN_QUEUE_SIZE = 50;
const LOOKBACK_SIZE = 10000;
const LOOKBACK_TREND_LIMIT = 500;
const MIN_TREND_STDEV_MULTIPLIER = 0.2;
const OUTLIER_STDEV_MULTIPLIER = 0.5;
const OUTLIER_INC = 5;
var BB_SELL = 5;
var BB_BUY = 30;

// PRICE CHECK SETTINGS (BEFORE BUY GRAPH)
var SYMBOLS_PRICE_CHECK_TIME = 13333; // Uniform distribution of avg 1.5x this value
const PREPUMP_TAKE_PROFIT_MULTIPLIER = 2;
const PREPUMP_STOP_LOSS_MULTIPLIER = 1;
const CLEAR_BLACKLIST_TIME = 120 * ONE_MIN;
const PRICES_HISTORY_LENGTH = 60;
const RALLY_TIME = 22;
const RALLY_MAX_DELTA = 1.05; // don't go for something thats too steep
const RALLY_MIN_DELTA = 1.02;
const RALLY_GREEN_RED_RATIO = 2.5;

// DONT TOUCH THESE GLOBALS
dump_count = 0;
latestPrice = 0;
q = [];
lowstd = [];
highstd = [];
lookback = [];
means = [];
mabuy = [];
masell = [];
fetchMarketDataTime = Date.now();
lastBuy = 0;
lastSell = 0;
supports = {};
resistances = {};
lastBuyReason = "";
lastSellReason = "";
BUY_TS = 0;
SELL_TS = 0;
auto = false;
histogram = false;
last_keypress = "";
lastTrend = "";
lastDepth = {};
fail_counter = 0;
dont_buy_before = 0;
prepump = false;
pnl = 0;
clearBlacklistTime = Date.now() + CLEAR_BLACKLIST_TIME;
opportunity_expired_time = 0;
SELL_FINISHED = false;
priceFetch = 0;
prices = [];
prevDay = {};
serverPrices = [];
blacklist = [];
balances = {};
coinInfo = null;

////////////////////////// CODE STARTS ////////////////////////

if (!process.argv[2]) {
	console.log("Usage: node main.js COINPAIR/prepump []");
	process.exit(1);
}

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
  	// I should write log data to file for analytics
    process.exit(); // eslint-disable-line no-process-exit
  } else {
  	if (str == "a") {
  		auto = !auto;
  	// } else if (str == "h") {
  	// 	histogram = !histogram;
  	} else {
  		last_keypress = str
  	}
  }
});

coinpair = process.argv[2].toUpperCase();

async function init() {
	if (binance.getOption("test")) {
		console.log("testing");
	}
	await binance.useServerTime();
	if (coinpair == "PREPUMP") {
		waitUntilPrepump();
		return;
		// will not execute any more code after this
	}
	await getBalanceAsync();
	coin = getCoin(coinpair);
	baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";

	//await getExchangeInfo(coinpair);
	readCoinInfo(); // pretty unchanging. Call getExchangeInfo to update file
	while (Object.keys(balances).length == 0 || coinInfo == null) {
		await sleep(100);
	}
	console.log(`You have ${getBalance(baseCurrency)} ${baseCurrency} in your account`);
	pump();
}

async function waitUntilPrepump() {
	LOOP = true;
	auto = true;
	prepump = true;
	SYMBOLS_PRICE_CHECK_TIME = !!parseFloat(process.argv[3]) ? parseFloat(process.argv[3]) * 1000 * 2/3 : SYMBOLS_PRICE_CHECK_TIME
	prices = new Array(PRICES_HISTORY_LENGTH).fill({});
	while (true) {
		console.clear();
		console.log("Waiting for rallies");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}`);
		console.log(`Blacklist: ${blacklist}`);
		//console.log(prices.slice(-1).pop()["BTCUSDT"]);
		coinpair = "";
		if (Date.now() > clearBlacklistTime) {
			blacklist = [];
			clearBlacklistTime = Date.now() + CLEAR_BLACKLIST_TIME;
		}
		await getBalanceAsync();
		rallies = await waitUntilFetchPricesAsync();
		var now = new Date(Date.now());
		rally = null;
		while (rallies.length) {
			rally = rallies.shift();
			if (getBalance(getCoin(rally.sym)) > 0 || blacklist.includes(getCoin(rally.sym))) {
				rally = null;
			}
		}
		if (rally != null) {
			coinpair = rally.sym;
			coin = getCoin(coinpair);
			baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";
			readCoinInfo();
			SELL_FINISHED = false;
			lookback = [];
			q = [];
			while (coinInfo == null) {
				await sleep(100);
			}
			beep();
			opportunity_expired_time = Date.now() + OPPORTUNITY_EXPIRE_WINDOW;
			rally_inc_pct = rally.gain - 1;
			TAKE_PROFIT_MULTIPLIER = (rally_inc_pct * PREPUMP_TAKE_PROFIT_MULTIPLIER) + 1;
			STOP_LOSS_MULTIPLIER = 1/((rally_inc_pct * PREPUMP_STOP_LOSS_MULTIPLIER) + 1);
			pump();
			while (!SELL_FINISHED) {
				await sleep(ONE_MIN * 0.5);
			}
		}
	}
}

function parseServerPrices() {
	prevPrices = prices.shift();
	newPrices = {};
	serverPrices.forEach(v => {
		// don't touch futures
		if (!v.symbol.endsWith("USDT") || v.symbol.includes("DOWNUSDT") || v.symbol.includes("UPUSDT")) {
			return;
		}
		newPrices[v.symbol] = v.askPrice;
	});
	prices.push(newPrices);
	return detectCoinRallies();
}

function detectCoinRallies() {
	lastX = prices.slice(-RALLY_TIME);
	rallies = [];
	for (const sym of Object.keys(lastX[0])) {
		green = 0;
		red = 0;
		last = lastX[0][sym];
		min = last;
		max = last;
		for (i = 1; i < RALLY_TIME; i++) {
			current = lastX[i][sym];
			if (current >= last) {
				green++;
			} else {
				red++;
			}
			min = Math.min(min, current);
			max = Math.max(max, current);
			last = current;
		}
		gain = max/min;
		first = lastX[0][sym];
		last = lastX[lastX.length-1][sym];
		if ((red == 0 || green/red > RALLY_GREEN_RED_RATIO) && gain < RALLY_MAX_DELTA && gain > RALLY_MIN_DELTA && last > first) {
			rallies.push({
				min: min,
				max: max,
				gain: gain,
				sym: sym,
				first: first,
				last: last
			});
		}
	}
	return rallies.sort((a, b) => a.gain - b.gain);
}

async function waitUntilFetchPricesAsync() {
	while(Date.now() < fetchMarketDataTime) {
		await sleep(100);
	}
	return await fetchAllPricesAsync();
}

async function fetchAllPricesAsyncIfReady() {
	if (Date.now() < fetchMarketDataTime) {
		return false;
	}
	getBalanceAsync();
	fetchAllPricesAsync();
	return true;
}

async function fetchAllPricesAsync() {
	priceFetch = 0;
	await getAllPrices();
	while (priceFetch < 1) {
		await sleep(100);
	}
	fetchMarketDataTime = Date.now() + SYMBOLS_PRICE_CHECK_TIME + Math.floor(SYMBOLS_PRICE_CHECK_TIME * Math.random());
	return parseServerPrices();
}

async function getAllPrices() {
	binance.bookTickers((error, ticker) => {
		if (error) {
			while (++fail_counter >= 100) {
				console.log("TOO MANY FAILS GETTING PRICES");
				process.exit(1);
			}
			return;
		}
		fail_counter = 0;
		priceFetch++;
		serverPrices = ticker;
	});
}

async function getPrevDay() {
	binance.prevDay(false, (error, pd) => {
  	// console.info(prevDay); // view all data
		for ( let obj of pd ) {
		    let symbol = obj.symbol;
		    prevDay[symbol] = obj.priceChangePercent;
		}
	});
}


async function pump() {
	//buy code here
	console.log("pump");
	if (BUY_LOCAL_MIN) {
		latestPrice = await waitUntilTimeToBuy();
	} else {
		latestPrice = await getLatestPriceAsync(coinpair);
	}
	if (latestPrice == 0 || blacklist.includes(coin)) {
		console.log("BUY WINDOW EXPIRED");
		SELL_FINISHED = true; // never bought
		return;
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
		blacklist.push(coin);
		beep();
		console.log("pump is successful")
		console.info("Market Buy response", response);
		console.info("order id: " + response.orderId);
		BUY_TS = 0;
		price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		lastBuy = price * response.executedQty;
		actualquantity = response.executedQty // replace with bought quantity
		ndump((price * TAKE_PROFIT_MULTIPLIER).toPrecision(4), price, (price * STOP_LOSS_MULTIPLIER).toPrecision(4), actualquantity);
	});
}

async function ndump(take_profit, buy_price, stop_loss, quantity) {
	waiting = true;
	latestPrice = await waitUntilTimeToSell(parseFloat(take_profit), parseFloat(stop_loss), parseFloat(buy_price));
	console.log((latestPrice > take_profit || Math.abs(1-take_profit/latestPrice) < 0.005) ? "taking profit" : "stopping loss");
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
		SELL_FINISHED = true;
		lastSell = price * response.executedQty;
		pnl += Math.round((lastSell - lastBuy)*10000)/10000;
		if (LOOP) {
			beep();
			if (BUFFER_AFTER_FAIL) {
				dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY;
			}
			if (prepump) {
				return;
			}
			ANALYZE = true;
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
		mabuy = new Array(QUEUE_SIZE).fill(q[0]);
		masell = new Array(QUEUE_SIZE).fill(q[0]);
	}
	//TODO: clean this up
	count = 0;
	meanRev = false;
	meanBounce = false;
	meanRevStart = 0;
	outlierReversion = 0;
	localMin = Infinity;
	localMinTicks = 0;
	ready = false;
	previousTrend = "None"
	starting_price = 0;
	buy_indicator_reached = false;
	buy_indicator_check_time = 0;
	while (true) {
		var [mean, stdev] = await tick(true);
		if(starting_price == 0) {
			starting_price = latestPrice;
		}
		console.clear();
		meanTrend = isDowntrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO"): colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText("green", latestPrice)}, Opportunity Expires in ${colorText("red", msToTime(opportunity_expired_time - Date.now()))} ${!ready ? colorText("red", "GATHERING DATA") : ""}`);
		if (last_keypress == "b") {
			last_keypress = "";
			lastBuyReason = "input";
			return latestPrice;
		}
		if (last_keypress == "q") {
			// q to quit early when looking for prepumps
			last_keypress = "";
			return 0;
		}
		if (Date.now() > dont_buy_before && auto) {
			switch (BUY_SELL_STRATEGY) {
				case 3:
					if (lookback.length < QUEUE_SIZE) {
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
					if (lastBuy <= lastSell 
						&& Math.abs(mean - latestPrice) < 0.2 * stdev 
						&& isDowntrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						meanBounce = true;
						meanBounceExpired = Date.now() + ONE_MIN;
					}
					if (outlierReversion > 0 && --outlierReversion > 0) {
						break;
					}
					if (lastValueIsOutlier()) {
						outlierReversion += OUTLIER_INC; // We want to buy before the outlier happens, not after
						break;
					}
					if (meanBounce && Date.now() > meanBounceExpired) {
						meanBounce = false;
					}
					if (latestPrice < highstd[highstd.length-1]
						&& latestPrice > lowstd[lowstd.length-1]
						&& meanRev
						&& isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastBuyReason = "boulingerbounce"
						return latestPrice
					}
					if (latestPrice > mean + 0.2*stdev 
						&& meanBounce 
						&& isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastBuyReason = "meanbounce"
						return latestPrice
					}
					if (latestPrice < mean - 0.5*stdev) {
						meanBounce = false;
					}
					break;
				case 6:
					if (latestPrice < starting_price * STOP_LOSS_MULTIPLIER) {
						return 0;
					}
					if (Date.now() > opportunity_expired_time) {
						return 0;
					}
 					if (lookback.length < BB_BUY * 1.5) {
						break;
					}
					ready = true;
					if (previousTrend.includes("Down") && meanTrend.includes("Up")) {
						buy_indicator_reached = true;
						buy_indicator_check_time = Date.now() + BUY_INDICATOR_INC;
					}
					if (buy_indicator_reached && Date.now() > buy_indicator_check_time) {
						if (meanTrend.includes("Up")) {
							lastBuyReason = "DUMP BOUNCE";
							return latestPrice;
						} else if (meanTrend.includes("Down")) {
							buy_indicator_reached = false;
						} else {
							buy_indicator_check_time = Date.now() + BUY_INDICATOR_INC;
						}
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
			plot(true);
		}
		if (prepump) {
			fetchAllPricesAsyncIfReady();
		}
		previousTrend = (meanTrend.includes("Up") || meanTrend.includes("Down")) ? meanTrend : previousTrend;
	}
}

async function waitUntilTimeToSell(take_profit, stop_loss, buy_price) {
	start = Date.now();
	end = Date.now() + RUNTIME;
	if (q.length == 0) {
		// This should never be the case
		q = new Array(QUEUE_SIZE).fill(latestPrice * 0.95); // for graph visualization
	}
	count = 0;
	meanRev = false;
	meanRevStart = 0;
	outlierReversion = 0;
	previousTrend = "None";
	meanTrend = "None";
	timeBeforeSale = Date.now() + ONE_MIN; // Believe in yourself!
	while (latestPrice > stop_loss && (latestPrice < take_profit || meanTrend.includes("Up"))) {
		var [mean, stdev] = await tick(false);
		console.clear();
		meanTrend = isDowntrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO") : colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText(latestPrice > buy_price ? "green" : "red", latestPrice)} Profit: ${colorText("green", take_profit)}, Buy: ${colorText("yellow", buy_price.toPrecision(4))} Stop Loss: ${colorText("red", stop_loss)}`);
		if (last_keypress == "s") {
			// Manual override
			last_keypress = "";
			lastSellReason = "Sold bcuz manual override";
			return latestPrice;
		}
		if (auto) {
			switch (BUY_SELL_STRATEGY) {
				case 3:
					if (latestPrice > highstd[highstd.length-1]) {
						if (!meanRev) {
							meanRev = true;
							meanRevStart = Date.now();
						} else if (meanRevStart < Date.now() - ONE_MIN){
							// This is a good thing
							// return latestPrice;
						}
					} else if (Date.now() < timeBeforeSale) {
						break;
					}
					if (outlierReversion > 0 && --outlierReversion > 0) {
						break;
					}
					if (lastValueIsOutlier()) {
						outlierReversion += OUTLIER_INC; // We want to buy before the outlier happens, not after
						break;
					}
					if (Math.abs(latestPrice - buy_price) < 0.3 * stdev) {
						// don't buy or sell too small amounts
						break;
					}
					if (latestPrice > mean
						&& meanRev
						&& !isUptrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastSellReason = "Sold bcuz after bb not uptrend";
						return latestPrice;
					} else if ((latestPrice < mean || Math.abs(buy_price - mean) < 0.2 * stdev)
						&& isDowntrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastSellReason = "Sold bcuz mean is down";
						return latestPrice;
					}
					break;
				case 6:
					// do nothing for now
					break;
				default:
					// do nothing
					break;

			}
		}
		if (Date.now() > end && USE_TIMEOUT) {
			console.log(`${RUNTIME}m expired without hitting take profit or stop loss`);
			lastSellReason = "Sold bcuz timeout";
			return latestPrice;
		}
		if (SHOW_GRAPH) {
			plot(false);
		}
		if (prepump) {
			fetchAllPricesAsyncIfReady();
		}
		previousTrend = (meanTrend.includes("Up") || meanTrend.includes("Down")) ? meanTrend : previousTrend;
	}
	lastSellReason = "Sold bcuz take profit or stop loss hit";
	return latestPrice
}

// Unused
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
}

async function tick(buying) {
	await sleep(POLL_INTERVAL);
	//lastDepth = await getMarketDepth(coinpair);
	bidask = await getBidAsk(coinpair);
	latestPrice = buying ? parseFloat(bidask.askPrice) : parseFloat(bidask.bidPrice); //await getLatestPriceAsync(coinpair);
	pushToLookback(latestPrice);
	BUY_TS++;
	SELL_TS++;
	q.push(latestPrice);
	stdev = getStandardDeviation(q);
	mean = average(q);
	means.push(mean);
	lowstd.push(mean - 2*stdev);
	highstd.push(mean + 2*stdev);
	mabuy.push(average(lookback.slice(-BB_BUY)));
	masell.push(average(lookback.slice(-BB_SELL)));
	q.shift() != 0 && lowstd.shift() != 0 && highstd.shift() != 0 && means.shift() != 0 && mabuy.shift() != 0 && masell.shift() != 0;
	return [mean, stdev]
}

// The old function
async function getLatestPriceAsync(coinpair) {
	try {
		let ticker = await binance.prices(coinpair);
		fail_counter = 0;
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
		Object.keys(b).forEach(key => {
			if (key != "USDT" && parseFloat(b[key].available) > 0 && !blacklist.includes(key)) {
				blacklist.push(key)
			}
		})
	});
}

async function getBidAsk(coinpair) {
	try {
		bidask = await binance.bookTickers(coinpair);
		fail_counter = 0;
		return bidask
	} catch (e) {
		if (++fail_counter == 100) {
			console.log(`Too many fails fetching bid/ask prices of ${coinpair}, exiting`);
			process.exit(1);
		}
		return await getBidAsk(coinpair);
	}
	

}

//TODO: reimplement this + the related functions, fail_counter was set to 1.
async function getMarketDepth(coinpair) {
	try {
		depth = await binance.depth(coinpair);
		parseDepth(depth);
		fail_counter = 0;
		return depth;
	} catch (e) {
		if (++fail_counter == 100) {
			console.log(e);
			console.log(`Too many fails fetching market depth of ${coinpair},`);
			process.exit(1);
		}
		return await getMarketDepth(coinpair);
	}
	
}

function parseDepth(depth) {
	resistances = {};
	supports = {};
	Object.entries(depth.bids).forEach(([k,v], count) => {
		price = parseFloat(parseFloat(k).toPrecision(4));
		supports[price] = (supports[price] == null ? 0 : supports[price]) + v
	});
	Object.entries(depth.asks).forEach(([k,v], count) => {
		price = parseFloat(parseFloat(k).toPrecision(4));
		resistances[price] = (resistances[price] == null ? 0 : resistances[price]) + v
	});
}

function isUptrend(q2, buffer, stdev = 0) {
	if (stdev == 0) {
		stdev = getLastStdev();
	}
	return q2.slice(0, q2.length-1).filter(v => v > q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v < q2[0]).length < buffer
		&& q2[q2.length-1] - q2[0] > MIN_TREND_STDEV_MULTIPLIER * stdev;
}

function isDowntrend(q2, buffer, stdev = 0) {
	if (stdev == 0) {
		stdev = getLastStdev();
	}
	return q2.slice(0, q2.length-1).filter(v => v < q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v > q2[0]).length < buffer
		&& q2[0] - q2[q2.length-1] > MIN_TREND_STDEV_MULTIPLIER * stdev;
}

function getBalance(coin) {
	if (!balances[coin]) {
		return 0;
	}
	return balances[coin].available
}

function getCoin(coinpair) {
	if (coinpair.endsWith("USDT")) {
		return coinpair.slice(0,-4);
	}
	// assume BTC
	return coinpair.slice(0, -3);
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
	stdev = getLastStdev();
	value = q[q.length-1];
	previous = average(q.slice(-5, -2));
	return (Math.abs(value - previous) >= OUTLIER_STDEV_MULTIPLIER*stdev); // I have no idea why, but I'm using 0.5 stdev to determine if val is outlier
}

function getLastStdev() {
	return (highstd[highstd.length-1] - means[means.length-1])/2;
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

function plot(buying) {
	//ma7.slice(-PLOT_DATA_POINTS), ma15.slice(-PLOT_DATA_POINTS),
	// var [histogramGreen, histogramRed, firstGreen, firstRed] = getHistogramData();
	// if (histogram) {	
	// 	console.log(
	// 	asciichart.plot([histogramRed, histogramGreen], 
	// 	{
	// 		format: formatGraph, 
	// 		colors: [
	// 	        asciichart.red,
	// 	        asciichart.green,
	// 	    ],
 //    		padding: GRAPH_PADDING, 
 //    		height: GRAPH_HEIGHT
 //    	}));
	// } else {
	console.log (
	asciichart.plot([highstd.slice(-PLOT_DATA_POINTS), lowstd.slice(-PLOT_DATA_POINTS), means.slice(-PLOT_DATA_POINTS), (buying ? mabuy : masell).slice(-PLOT_DATA_POINTS), q.slice(-PLOT_DATA_POINTS)], 
	{
		format: formatGraph, 
		colors: [
	        asciichart.red,
	        asciichart.green,
	        asciichart.yellow,
	        asciichart.lightmagenta,
	        asciichart.default,
	    ],
		padding: GRAPH_PADDING, 
		height: GRAPH_HEIGHT
	}));
	// }
}

function getHistogramData() {
	histogramRed = Object.values(resistances);
	histogramGreen = Object.values(supports).reverse();
	firstRed = histogramRed[0];
	firstGreen = histogramGreen[histogramGreen.length-1];
	histogramRed = (histogramRed.map(x => [x,x])).flat();
	histogramGreen = (histogramGreen.map(x => [x,x])).flat();
	blankGreen = new Array(parseInt(PLOT_DATA_POINTS/5)).fill(0);
	blankRed = new Array(parseInt(PLOT_DATA_POINTS/5 + histogramGreen.length)).fill(0);
	return [blankGreen.concat(histogramGreen), blankRed.concat(histogramRed), firstGreen, firstRed];
}

function colorText(color, str) {
	return asciichart[color] + str + asciichart.reset;
}

function msToTime(duration) {
  var seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),

  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return minutes + ":" + seconds;
}

function beep() {
	console.log("\007");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

init();
