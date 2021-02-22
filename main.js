const {
	API_KEY,
	API_SECRET
} = require("./secrets.js")

const fs = require('fs');
const tty = require('tty');
const asciichart = require ('asciichart');
const SocketModel = require('socket-model');
//https://github.com/jaggedsoft/node-binance-api
const Binance = require('node-binance-api');
const readline = require('readline');

// DO NOT CHANGE THESE
const ONE_MIN = 60000;
const APPROX_LOCAL_MIN_MAX_BUFFER_PCT = 0.069420;
const MIN_COIN_VAL_IN_BTC = 0.00000200;
const TERMINAL_HEIGHT_BUFFER = 4;
const TERMINAL_WIDTH_BUFFER = 17;
const SOCKETFILE = '/tmp/binance-bot.sock'
const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET,
  recvWindow: ONE_MIN
  //test: true // comment out when running for real
});


// TODO: Move const to new file
// TODO: Create web interface
// MAKE SURE TO HAVE BNB IN YOUR ACCOUNT
// IMPORTANT SETTINGS YOU SHOULD CHANGE
const MAX_OVERRIDE_BTC = 0.001;
const MAX_OVERRIDE_USDT = 20;
// BE CAREFUL USING THIS. IT WILL USE A PERCENTAGE OF THE ACCOUNT'S ENTIRE BASE CURRENCY
// DOES NOT WORK IF OVERRIDE_BTC OR OVERRIDE_USDT IS > 0
const PCT_BUY = 0.01;
var TAKE_PROFIT_MULTIPLIER = 1.05; // Only change for single coinpair trading, will be unset if prepump is enabled
var STOP_LOSS_MULTIPLIER = 0.985; // Only change for single coinpair trading, will be unset if prepump is enabled
const RUNTIME = 10 * ONE_MIN; //mins
const USE_TIMEOUT = false; // Automatically sell when RUNTIME is reached
const POLL_INTERVAL = 720;// roughly 1 second
var LOOP = false; // false for single buy and quit
var DEFAULT_BASE_CURRENCY = "USDT";
const FETCH_BALANCE_INTERVAL = 60 * ONE_MIN;

// GRAPH SETTINGS
const SHOW_GRAPH = true;
const AUTO_ADJUST_GRAPH = true;
const GRAPH_PADDING = '               ';
var GRAPH_HEIGHT = 32;
var PLOT_DATA_POINTS = 120; // Play around with this value. It can be as high as QUEUE_SIZE


// BUY SELL SETTINGS
const BUY_SELL_STRATEGY = 6; // 3 = buy boulinger bounce, 6 is wait until min and buy bounce
const TIME_BEFORE_NEW_BUY = ONE_MIN;
var BUFFER_AFTER_FAIL = true;
const OPPORTUNITY_EXPIRE_WINDOW = 5 * ONE_MIN;
const BUY_LOCAL_MIN = true;
const BUY_INDICATOR_INC = 0.75 * ONE_MIN;
const TIME_TO_INC_LOSS_AND_DEC_PROFIT = 90 * ONE_MIN;
const TAKE_PROFIT_REDUCTION_PCT = 1;
const STOP_LOSS_INCREASE_PCT = 1.01;
const PROFIT_LOSS_CHECK_TIME = 0.5 * ONE_MIN;

// ANALYSIS SETTINS
var ANALYZE = false;
const ANALYSIS_TIME = 60; //Seconds
const ANALYSIS_BUFFER = 5;
const BUY_SELL_INC = 2;
const MIN_BUY_SELL_BUF = 10;
const MAX_BUY_SELL_BUF = 60;

// QUEUE SETTINGS
const QUEUE_SIZE = 1200; // 20m
const MIN_QUEUE_SIZE = 50;
const LOOKBACK_SIZE = 10000;
const LOOKBACK_TREND_LIMIT = 500;
const MIN_TREND_STDEV_MULTIPLIER = 0.2;
const OUTLIER_STDEV_MULTIPLIER = 0.5;
const OUTLIER_INC = 5;
var BB_SELL = 10;
var BB_BUY = 20;

// PRICE CHECK SETTINGS (BEFORE BUY GRAPH)
var SYMBOLS_PRICE_CHECK_TIME = 10 /*<- Change this --- Not this ->*/ * 1000;
const PREPUMP_TAKE_PROFIT_MULTIPLIER = 2;
const PREPUMP_STOP_LOSS_MULTIPLIER = 1;
const PRICES_HISTORY_LENGTH = 180; // * SYMBOLS_PRICE_CHECK_TIME
const RALLY_TIME = 18; // * SYMBOLS_PRICE_CHECK_TIME
var RALLY_MAX_DELTA = 1.02; // don't go for something thats too steep
var RALLY_MIN_DELTA = 1.01;
const RALLY_GREEN_RED_RATIO = 1.5;

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
detection_mode = false;
last_keypress = "";
lastTrend = "";
lastDepth = {};
fail_counter = 0;
dont_buy_before = 0;
prepump = false;
pnl = 0;
opportunity_expired_time = 0;
fetch_balance_time = 0;
prices_data_points_count = 0;
SELL_FINISHED = false;
priceFetch = 0;
prices = [];
prevDay = {};
serverPrices = [];
blacklist = [];
override_blacklist = false;
balances = {};
coinInfo = null;
manual_buy = false;
manual_sell = false;
quit_buy = false;
yolo = false;
server = null;
client = null;
price_data_received = false;
custom_check_time = false;

////////////////////////// CODE STARTS ////////////////////////

if (!process.argv[2] || !(process.argv[2].trim() == "prepump" || process.argv[2].endsWith("USDT") || process.argv[2].endsWith("BTC"))) {
	console.log("Usage: node main prepump POLL_INTERVAL_IN_SECONDS or node main YOUR_COIN_PAIR (Not recommended)");
	console.log("Optional parameters:");
	console.log("--base=BTC|USDT to select base trading currency");
	console.log("--detect to only detect rallying coins");
	process.exit(1);
}

// Read Keystrokes
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => {
	if (key.ctrl && key.name === 'c') {
		// I should write log data to file for analytics
		process.exit(0); // eslint-disable-line no-process-exit
	}
	switch (str) {
		case "a":
			// a is to toggle auto
			auto = !auto;
			break;
		case "b":
			// b is for buy
			manual_buy = true;
			break;
		case "e":
			// e to extend the opportunity window
			opportunity_expired_time += 5 * ONE_MIN;
			break;
		case "q":
			// q to quit early when looking for prepumps
			quit_buy = true;
			break;
		case "s":
			// s is for sell
			manual_sell = true;
			break;
		// case "p":
		// 	console.log(getPricesForCoin("BTCUSDT", 10));
		// 	break;
		default:
			break;
	}
});

coinpair = process.argv[2].toUpperCase();

async function init() {
	if (binance.getOption("test")) {
		console.log("testing");
	}
	initClientServer();
	await binance.useServerTime();
	loopGetBalanceAsync();
	if (coinpair == "PREPUMP") {
		waitUntilPrepump();
		return;
		// will not execute any more code after this
	}
	
	coin = getCoin(coinpair);
	baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";

	//await getExchangeInfo(coinpair);
	readCoinInfo(); // pretty unchanging. Call getExchangeInfo to update file
	while (coinInfo == null) {
		await sleep(100);
	}
	override_blacklist = true;
	//console.log(`You have ${getBalance(baseCurrency)} ${baseCurrency} in your account`);
	pump();
}

function initClientServer() {
	if (process.argv.includes("--server")) {
		server = SocketModel.createServer( { socketFile: SOCKETFILE} );
		server.onMessage(function(obj) {
			if (obj.message) {
				message = JSON.parse(obj.message)
				if (message.blacklist) {
					blacklist = message.blacklist;
					synchronizeBlacklist();
				}
				
			}
		});
		server.onClientConnection((socket) => {
			server.getWriter().send(JSON.stringify({historicalPrices: prices}), socket);
		});
		server.start();
	} else if (process.argv.includes("--client")) {
		client = SocketModel.createClient( { socketFile: SOCKETFILE } );
		client.onMessage(function(obj) {
			if (obj.message) {
				message = JSON.parse(obj.message)
				if (message.prices && message.timestamp && message.interval) {
					if (message.timestamp > fetchMarketDataTime - 1000) {
						serverPrices = message.prices;
						price_data_received = true;
					}
				}
				if (message.blacklist) {
					blacklist = message.blacklist;
				}
				if (message.historicalPrices) {
					prices = message.historicalPrices;
					prices_data_points_count = prices.length;
				}
			}
		});
		client.start();
	}
}

async function waitUntilPrepump() {
	//await getExchangeInfo(coinpair);
	LOOP = true;
	auto = true;
	prepump = true;
	override_blacklist = false;
	BUFFER_AFTER_FAIL = true;
	// Testing only, change this!!!!
	yolo = process.argv.includes("--yolo");
	coinpair = "";
	custom_check_time = !!parseFloat(process.argv[3]);
	SYMBOLS_PRICE_CHECK_TIME = !!parseFloat(process.argv[3]) ? parseFloat(process.argv[3]) * 1000 : SYMBOLS_PRICE_CHECK_TIME;
	DEFAULT_BASE_CURRENCY = process.argv.includes("--base=BTC") ? "BTC" : process.argv.includes("--base=USDT") ? "USDT" : DEFAULT_BASE_CURRENCY;
	detection_mode = process.argv.includes("--detect") ? true : false;
	while (true) {
		if (!detection_mode) {
			console.clear();
			console.log(`Waiting for rallies, Data points: ${prices_data_points_count}`);
			console.log("Your Base currency is " + DEFAULT_BASE_CURRENCY);
			console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}`);
			console.log(`Blacklist: ${blacklist}`);
		}
		await waitUntilFetchPricesAsync();
		rallies = detectCoinRallies();
		if (detection_mode) {
			rallies && rallies.length && console.log(`Rallies: ${JSON.stringify(rallies, null, 4)}`);
			continue;
		}

		if (prices_data_points_count < PRICES_HISTORY_LENGTH) {
			continue;
		}
		
		rally = null;
		while (rallies.length) {
			rally = rallies.shift();
			if (getBalance(getCoin(rally.sym)) > 0 || blacklist.includes(getCoin(rally.sym)) || coinpair == rally.sym || rally.fail) {
				rally = null;
			}
		}
		if (rally != null && Date.now() > dont_buy_before) {
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
	prices.length >= PRICES_HISTORY_LENGTH && prices.shift();
	newPrices = {};
	serverPrices.forEach(v => {
		// don't touch futures
		if (!v || !v.symbol || !v.symbol.endsWith(DEFAULT_BASE_CURRENCY) || v.symbol.includes("DOWNUSDT") || v.symbol.includes("UPUSDT")) {
			return;
		}
		if (v.symbol.endsWith("BTC") && v.askPrice < MIN_COIN_VAL_IN_BTC) {
			return;
		}
		newPrices[v.symbol] = v.askPrice;
	});
	prices.push(newPrices);
	if (server) {
		server.broadcast(JSON.stringify({prices: serverPrices, timestamp: Date.now(), interval: SYMBOLS_PRICE_CHECK_TIME}));
	}
}

function getPricesForCoin(sym, timeframe) {
	recent_prices = prices.slice(-timeframe);
	res = [];
	for (i = 0; i < recent_prices.length; i++) {
		res.push(parseFloat(recent_prices[i][sym]));
	}
	return res.filter(a => a);
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
		last_x_values = [last];
		for (i = 1; i < lastX.length; i++) {
			current = lastX[i][sym];
			if (!current) {
				break;
			}
			if (current > last) {
				green++;
			} else {
				red++;
			}
			min = Math.min(min, current);
			max = Math.max(max, current);
			last = current;
			last_x_values.push(current)
		}
		if (green + red != RALLY_TIME - 1) {
			break;
		}
		gain = max/min;
		first = lastX[0][sym];
		last = lastX[lastX.length-1][sym];
		historical_vals = getPricesForCoin(sym, PRICES_HISTORY_LENGTH).slice(0, -RALLY_TIME);
		recent_historical_vals = historical_vals.slice(-3 * RALLY_TIME, -RALLY_TIME);
		sorted_historical_vals = recent_historical_vals.sort();
		recent_sorted_historical_vals = recent_historical_vals.sort();
		max_historical = recent_sorted_historical_vals.pop();
		high_median = sorted_historical_vals.slice(-0.05 * sorted_historical_vals.length).shift();
		low_median = sorted_historical_vals.slice(0, -0.2 * sorted_historical_vals.length).pop();
		min_historical = recent_sorted_historical_vals.shift();
		is_uptrend = isUptrend(last_x_values, 1, true);
		// Testing
		test_count = 0;
		fail_reasons = ""
		if(red == 0 || green/red >= RALLY_GREEN_RED_RATIO) {
			test_count++;
		} else {
			fail_reasons += "ratio " + green/red + " ";
		}
		if (gain < RALLY_MAX_DELTA) {
			test_count++;
		} else {
			fail_reasons += "maxDelta " + gain + " ";
		}
		if (gain > RALLY_MIN_DELTA) {
			test_count++;
		} else {
			fail_reasons += "minDelta " + gain + " ";
		}
		if (last > first) {
			test_count++;
		} else {
			fail_reasons += "last<first " + last + '>' + first + " ";
		}
		if (high_median > first) {
			test_count++;
		} else {
			fail_reasons += "highMed<first " + high_median + '<' + first + " ";
		}
		if (low_median < first) {
			test_count++;
		} else {
			fail_reasons += "lowMed>first " + low_median + '>' + first + " ";
		}
		if (max_historical < last) {
			test_count++;
		} else {
			fail_reasons += "highest>last " + max_historical + '>' + last + " ";
		}
		if (max_historical/min_historical < gain) {
			test_count++;
		} else {
			fail_reasons += "historicalgain>gain " + max_historical/min_historical + '>' + gain + " ";
		}
		// if (is_uptrend) {
		// 	test_count++;
		// } else {
		// 	fail_reasons += "no uptrend? ";
		// }
		if ((red == 0
			|| green/red >= RALLY_GREEN_RED_RATIO)
			&& gain < RALLY_MAX_DELTA
			&& gain > RALLY_MIN_DELTA
			&& last > first
			&& high_median > first
			&& max_historical < last
			&& max_historical/min_historical < gain
			&& low_median < first
			//&& is_uptrend
			) {
			rallies.push({
				sym: sym,
				min: min,
				max: max,
				gain: gain,
				first: first,
				last: last
			});
		} else if (test_count > 6) {
			rallies.push({sym: sym, first: first, last: last, gain: gain , fail: fail_reasons});
		}
	}
	return rallies.sort((a, b) => a.gain - b.gain);
}

async function waitUntilFetchPricesAsync() {
	if (!client || custom_check_time) {
		while(Date.now() < fetchMarketDataTime) {
			await sleep(100);
		}
	}
	if (!client) {
		await fetchAllPricesAsync();
	} else {
		while (!price_data_received) {
			await sleep(100);
		}
		price_data_received = false;
	}
	parseServerPrices();
	++prices_data_points_count;
	fetchMarketDataTime = Date.now() + SYMBOLS_PRICE_CHECK_TIME;
}

async function fetchAllPricesAsyncIfReady() {
	return new Promise(async (resolve) => {
		await waitUntilFetchPricesAsync();
		resolve();
	});
}

async function fetchAllPricesAsync() {
	priceFetch = 0;
	await getAllPrices();
	while (priceFetch < 1) {
		await sleep(100);
	}
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
	if (BUY_LOCAL_MIN && !yolo) {
		manual_buy = false;
		quit_buy = false;
		blacklist.push(coin);
		synchronizeBlacklist();
		latestPrice = await waitUntilTimeToBuy();
		manual_buy = false;
		quit_buy = false;
	} else {
		latestPrice = await getLatestPriceAsync(coinpair);
	}
	if ((prepump && blacklist.includes(coin)) || latestPrice == 0) {
		if (!LOOP) {
			console.log("Quitting");
			process.exit(0);
		}
		blacklist = blacklist.filter(i => i !== coin);
		synchronizeBlacklist();
		console.log("BUY WINDOW EXPIRED");
		SELL_FINISHED = true; // never bought
		dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY;
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
	manual_sell = false;
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
		pnl += lastSell - lastBuy;
		pnl = Math.round(pnl*10000000)/10000000;
		if (LOOP) {
			beep();
			if (BUFFER_AFTER_FAIL) {
				dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY;
			}
			if (prepump) {
				removeFromBlacklistLater(coin);
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
	fetching_prices = false;
	while (true) {
		var [mean, stdev] = await tick(true);
		console.clear();
		if (manual_buy) {
			return latestPrice;
		}
		if (quit_buy || (!override_blacklist && blacklist.includes(coin))) {
			return 0;
		}
		if(starting_price == 0) {
			starting_price = latestPrice;
		}
		meanTrend = isDowntrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO"): colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText("green", latestPrice)}, Buy Window: ${buy_indicator_reached ? colorText("green", msToTime(buy_indicator_check_time - Date.now())) : colorText("red", "N/A")}, Opportunity Expires: ${colorText(buy_indicator_reached ? "green" : "red", msToTime(opportunity_expired_time - Date.now()))} ${!ready ? colorText("red", "GATHERING DATA") : ""}`);
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
					if (prepump && Date.now() > opportunity_expired_time) {
						return 0;
					}
 					if (lookback.length < BB_BUY * 1.2) {
						break;
					}
					if (!ready && meanTrend.includes("Up")) {
						//Leave this commented. It loses too much money
						//return latestPrice;
					}
					ready = true;
					if (previousTrend.includes("Down") && meanTrend.includes("Up") && latestPrice < mean) {
						buy_indicator_reached = true;
						buy_indicator_check_time = Date.now() + BUY_INDICATOR_INC;
					}
					if (buy_indicator_reached && Date.now() > buy_indicator_check_time) {
						if (meanTrend.includes("Up") && latestPrice < mean + stdev) {
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
		if (SHOW_GRAPH) {
			plot(true);
		}
		if (prepump && !fetching_prices) {
			fetching_prices = true;
			fetchAllPricesAsyncIfReady().catch().finally(() => { 
				fetching_prices = false;
			});
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
	take_profit_reached = false;
	timeBeforeSale = Date.now() + ONE_MIN; // Believe in yourself!
	stop_loss_check = 0;
	timeout_count = 0;
	take_profit_check_time = 0;
	while (!auto || (latestPrice > stop_loss && latestPrice < take_profit)) {
		var [mean, stdev] = await tick(false);
		console.clear();
		if (manual_sell) {
			return latestPrice;
		}
		meanTrend = isDowntrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO") : colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText(latestPrice > buy_price ? "green" : "red", latestPrice)} Profit: ${colorText("green", take_profit + " (" + (take_profit/buy_price - 1).toFixed(3) * 100 + "%)")}, Buy: ${colorText("yellow", buy_price.toPrecision(4))} Stop Loss: ${colorText("red", stop_loss + " (" + (1-stop_loss/buy_price).toFixed(3) * 100 + "%)")}`);
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
					if (Math.floor((Date.now() - start) / TIME_TO_INC_LOSS_AND_DEC_PROFIT) > timeout_count) {
						timeout_count++;
						take_profit = Math.round(take_profit * TAKE_PROFIT_REDUCTION_PCT * 10000)/10000;
						stop_loss = Math.round(stop_loss * STOP_LOSS_INCREASE_PCT * 10000)/10000;
					}
					// do nothing for now
					break;
				default:
					// do nothing
					break;

			}
			// This code block catches the edge case where a massive price drop happens after a steep incline once we reach take profit. 
			// This way we take the maximum profit while avoiding holding the bag if the price ever drops below take_profit
			// if (latestPrice > take_profit && !take_profit_reached) {
			// 	take_profit_reached = true;
			// 	take_profit_check_time = Date.now() + PROFIT_LOSS_CHECK_TIME;
			// } else if (take_profit_reached && Date.now() > take_profit_check_time && latestPrice < take_profit) {
			// 	return latestPrice;
			// }
			// This code is to prevent people from barely breaking your stop loss with a big sell/buy. May result in bigger losses
			// if (latestPrice < stop_loss && stop_loss_check == 0) {
			// 	stop_loss_check = Date.now() + PROFIT_LOSS_CHECK_TIME;
			// } else if (latestPrice > stop_loss) {
			// 	stop_loss_check = 0;
			// }
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
	stdev = getStandardDeviation(q.slice(-lookback.length));
	mean = average(q.slice(-lookback.length));
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
		if (++fail_counter >= 100) {
			console.log(`Too many fails fetching price of ${coinpair}, exiting`);
			process.exit(1);
		}
		await sleep(100);
		return await getLatestPriceAsync(coinpair);
	}
}

// this never resolves
async function loopGetBalanceAsync() {
	return new Promise(async (resolve) => {
		while (true) {
			// This is sketchy but I have no idea how to do proper concurrency
			while (Date.now() < fetch_balance_time) {
				await sleep(ONE_MIN);
			}
			fetching_balance = true;
			binance.balance((error, b) => {
				if ( error ) {
					fetching_balance = false;
					fetch_balance_time = Date.now() + ONE_MIN;
					console.log(error);
					return;
				}
				balances = b;
				Object.keys(b).forEach(key => {
					if (key != "USDT" && parseFloat(b[key].available) > 0 && !blacklist.includes(key)) {
						blacklist.push(key)
					}
				})
				fetching_balance = false;
				fetch_balance_time = Date.now() + FETCH_BALANCE_INTERVAL;
			});
			while (fetching_balance) {
				await sleep(ONE_MIN);
			}
		}
		
	});
}

async function getBidAsk(coinpair) {
	try {
		bidask = await binance.bookTickers(coinpair);
		fail_counter = 0;
		return bidask
	} catch (e) {
		console.log(e);
		if (++fail_counter >= 100) {
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
		if (++fail_counter >= 100) {
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

function isUptrend(q2, buffer, kinda = false, stdev = 0) {
	// if (stdev == 0) {
	// 	stdev = getLastStdev();
	// }
	return q2.slice(0, q2.length-1).filter(v => v > q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v < q2[0]).length < (buffer * kinda ? 3 : 1)
		&& q2[q2.length-1] - q2[0] > MIN_TREND_STDEV_MULTIPLIER * stdev;
}

function isDowntrend(q2, buffer, kinda = false, stdev = 0) {
	// if (stdev == 0) {
	// 	stdev = getLastStdev();
	// }
	return q2.slice(0, q2.length-1).filter(v => v < q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v > q2[0]).length < (buffer * kinda ? 3 : 1)
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

function removeFromBlacklistLater(coin) {
	setTimeout(() => {
		blacklist = blacklist.filter(i => i !== coin);
		synchronizeBlacklist();
	}, 30 * ONE_MIN);
}

function synchronizeBlacklist() {
	if (server) {
		server.broadcast(JSON.stringify({blacklist: blacklist}));
	}
	if (client) {
		client.send(JSON.stringify({blacklist: blacklist}));
	}
	console.log(blacklist)
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
	if (AUTO_ADJUST_GRAPH) {
		GRAPH_HEIGHT = process.stdout.rows - TERMINAL_HEIGHT_BUFFER;
		PLOT_DATA_POINTS = process.stdout.columns - TERMINAL_WIDTH_BUFFER;
	}
	points = [highstd.slice(-PLOT_DATA_POINTS), lowstd.slice(-PLOT_DATA_POINTS), means.slice(-PLOT_DATA_POINTS), (buying ? mabuy : masell).slice(-PLOT_DATA_POINTS), q.slice(-PLOT_DATA_POINTS)];
	console.log (
	asciichart.plot(points, 
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
	if (duration < 0) {
		return 0;
	}
	var seconds = Math.floor((duration / 1000) % 60), minutes = Math.floor((duration / (1000 * 60))),
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
