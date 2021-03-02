const {
	API_KEY,
	API_SECRET,
	MAX_OVERRIDE_BTC,
	MAX_OVERRIDE_USDT
} = require("./secrets.js")

const fs = require('fs');
const _ = require('lodash');
const tty = require('tty');
const asciichart = require ('asciichart');
const SocketModel = require('socket-model');
//https://github.com/jaggedsoft/node-binance-api
const Binance = require('node-binance-api');
const readline = require('readline');
var binance;

////////////////////////////// GLOBALS ///////////////////////////////

var {
	// DO NOT CHANGE THESE
	ONE_SEC,
	ONE_MIN,
	APPROX_LOCAL_MIN_MAX_BUFFER_PCT,
	MIN_COIN_VAL_IN_BTC,
	TERMINAL_HEIGHT_BUFFER,
	TERMINAL_WIDTH_BUFFER,
	SOCKETFILE,

	// NOT SURE WHAT I SHOULD LABEL THIS AS. TODO: CHANGE THIS LABEL
	PCT_BUY,
	TAKE_PROFIT_MULTIPLIER,
	STOP_LOSS_MULTIPLIER,
	RUNTIME,
	USE_TIMEOUT,
	POLL_INTERVAL,
	LOOP,
	DEFAULT_BASE_CURRENCY,
	FETCH_BALANCE_INTERVAL,

	// GRAPH SETTINGS
	SHOW_GRAPH,
	AUTO_ADJUST_GRAPH,
	GRAPH_PADDING,
	GRAPH_HEIGHT,
	PLOT_DATA_POINTS, 

	// BUY SELL SETTINGS
	BUY_SELL_STRATEGY,
	TIME_BEFORE_NEW_BUY,
	AFTER_SELL_WAIT_BEFORE_BUYING,
	OPPORTUNITY_EXPIRE_WINDOW,
	MIN_OPPORTUNITY_EXPIRE_WINDOW,
	MAX_OPPORTUNITY_EXPIRE_WINDOW,
	BUY_LOCAL_MIN,
	BUY_SELL_INDICATOR_INC,
	TIME_TO_CHANGE_PROFIT_LOSS,
	TAKE_PROFIT_CHANGE_PCT,
	STOP_LOSS_CHANGE_PCT,
	PROFIT_LOSS_CHECK_TIME,
	SELL_RIDE_PROFITS,
	SELL_RIDE_PROFITS_PCT,
	FOLLOW_BTC_MIN_BUY_MEDIAN,

	// ANALYSIS SETTINS
	ANALYSIS_TIME,
	ANALYSIS_BUFFER,
	BUY_SELL_INC,
	MIN_BUY_SELL_BUF,
	MAX_BUY_SELL_BUF,

	// QUEUE SETTINGS
	QUEUE_SIZE,
	MIN_QUEUE_SIZE,
	LOOKBACK_SIZE,
	LOOKBACK_TREND_LIMIT,
	MIN_TREND_STDEV_MULTIPLIER,
	OUTLIER_STDEV_MULTIPLIER,
	OUTLIER_INC,
	BB_SELL,
	BB_BUY,
	UPPER_BB_PCT,
	LOWER_BB_PCT,
	MAX_BB_PCT,
	MIN_BB_PCT,

	// PRICE CHECK SETTINGS (BEFORE BUY GRAPH)
	DEFAULT_SYMBOL_PRICE_CHECK_TIME,
	SYMBOLS_PRICE_CHECK_TIME,
	PREPUMP_TAKE_PROFIT_MULTIPLIER,
	PREPUMP_STOP_LOSS_MULTIPLIER,
	PREPUMP_BULL_PROFIT_MULTIPLIER,
	PREPUMP_BEAR_PROFIT_MULTIPLIER,
	PREPUMP_BULL_LOSS_MULTIPLIER,
	PREPUMP_BEAR_LOSS_MULTIPLIER,
	PREPUMP_BULL_RALLY_TIME,
	PREPUMP_BEAR_RALLY_TIME,
	PREPUMP_MAX_UPPER_BB_PCT,
	PREPUMP_MIN_UPPER_BB_PCT,
	PREPUMP_MAX_LOWER_BB_PCT,
	PREPUMP_MIN_LOWER_BB_PCT,
	PRICES_HISTORY_LENGTH,
	RALLY_TIME,
	MIN_RALLY_TIME,
	MAX_RALLY_TIME,
	RALLY_MAX_DELTA,
	FUTURES_RALLY_MAX_DELTA,
	RALLY_MIN_DELTA,
	RALLY_GREEN_RED_RATIO,
	GOOD_BUY_MIN_GAIN,
	GOOD_BUY_MAX_GAIN,

	// DONT TOUCH THESE GLOBALS
	dump_count,
	latestPrice,
	q,
	lowstd,
	highstd,
	lookback,
	means,
	mabuy,
	masell,
	fetchMarketDataTime,
	lastBuy,
	lastSell,
	supports,
	resistances,
	lastBuyReason,
	lastSellReason,
	lastSellLocalMax,
	lastSellLocalMaxStdev,
	lastSellLocalMinStdev,
	BUY_TS,
	SELL_TS,
	auto,
	histogram,
	detection_mode,
	buy_good_buys,
	buy_rallys,
	last_keypress,
	lastTrend,
	lastDepth,
	fail_counter,
	dont_buy_before,
	prepump,
	pnl,
	purchases,
	opportunity_expired_time,
	fetch_balance_time,
	prices_data_points_count,
	SELL_FINISHED,
	time_elapsed_since_rally,
	prices,
	prevDay,
	serverPrices,
	blacklist,
	balances,
	coinInfo,
	coinsInfo,
	manual_buy,
	manual_sell,
	quit_buy,
	yolo,
	futures,
	silent,
	server,
	client,
	price_data_received,
	fetching_prices_from_graph_mode,
	coinpair,
	coin
} = require("./const.js");

///////////////////////// INITIALIZATION ///////////////////////////////////
async function init() {
	console.clear();
	checkValidArgs();
	initArgumentVariables();
	readCoinInfo();
	while (!coinsInfo) {
		await sleep(ONE_SEC);
	}
	await binance.useServerTime();
	initKeybindings();
	if (server) {
		await prepopulate30mData();
	}
	loopGetBalanceAndPrevDayAsync();
	if (prepump) {
		waitUntilPrepump();
		return;
	}
	coin = getCoin(coinpair);
	baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";
	while (coinInfo == null) {
		await sleep(ONE_SEC);
	}
	while (client && !prices_data_points_count) {
		await sleep(ONE_SEC);
	}
	pump();
}

function checkValidArgs() {
	if (!process.argv[2]
		|| !(process.argv[2].trim().toUpperCase() == "PREPUMP" 
		|| process.argv[2].toUpperCase().endsWith("USDT") 
		|| process.argv[2].toUpperCase().endsWith("BTC"))) {
		console.log("Usage: node main prepump POLL_INTERVAL_IN_SECONDS or node main YOUR_COIN_PAIR (Not recommended)");
		console.log("Optional parameters:");
		console.log("--auto to start in auto mode");
		console.log("--base=BTC|USDT to select base trading currency");
		console.log("--detect to only detect rallying coins");
		console.log("--server to initialize a server. Only initialize one server at a time");
		console.log("--client to initialize a client. Clients will sync price data and blacklist with the server");
		console.log("--yolo to buy immediately after detecting a rally");
		console.log("--no-plot to skip displaying the graph on the buy/sell screen");
		console.log("--silent for no noise indicator when buying or selling");
		process.exit(1);
	}
}

function initArgumentVariables() {
	coinpair = process.argv[2].toUpperCase();
	prepump = process.argv[2].toUpperCase() == "PREPUMP";
	binance = new Binance().options({
	  APIKEY: API_KEY,
	  APISECRET: API_SECRET,
	  recvWindow: ONE_MIN,
	  test: process.argv.includes("--test")
	});
	if (binance.getOption("test")) {
		console.log("testing");
	}
	yolo = process.argv.includes("--yolo");
	LOOP = !process.argv.includes("--only-buy-once");
	auto = process.argv.includes("--auto") || prepump;
	futures = process.argv.includes("--futures");
	SYMBOLS_PRICE_CHECK_TIME = !!parseFloat(process.argv[3]) ? parseFloat(process.argv[3]) * ONE_SEC : SYMBOLS_PRICE_CHECK_TIME;
	DEFAULT_BASE_CURRENCY = process.argv.includes("--base=BTC") ? "BTC" : process.argv.includes("--base=USDT") ? "USDT" : DEFAULT_BASE_CURRENCY;
	detection_mode = process.argv.includes("--detect") ? true : false;
	SHOW_GRAPH = !process.argv.includes("--no-plot");
	silent = process.argv.includes("--silent");
	buy_good_buys = process.argv.includes("--goodbuys");
	buy_rallys = !buy_good_buys;
	// TODO: Check if server is already started
	process.argv.includes("--server") && !process.argv.includes("--client") && initServer();
	if (server && SYMBOLS_PRICE_CHECK_TIME != DEFAULT_SYMBOL_PRICE_CHECK_TIME) {
		console.warn("Servers must have default symbol price check time. Configure this in const.js");
		SYMBOLS_PRICE_CHECK_TIME = DEFAULT_SYMBOL_PRICE_CHECK_TIME;
	}
	!process.argv.includes("--server") && process.argv.includes("--client") && initClient();
}

function initKeybindings() {
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
			case "c":
				// c is to clear blacklist
				if (server) {
					blacklist = [];
					updateBlacklistFromBalance();
				}
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
			case "p":
				SHOW_GRAPH = !SHOW_GRAPH;
				break;
			default:
				break;
		}
	});
}

function initServer() {
	// TODO: listen for client DC message and sell coin if client is holding
	server = SocketModel.createServer( { socketFile: SOCKETFILE} );
	server.onMessage(function(obj) {
		if (obj.message) {
			message = JSON.parse(obj.message)
			if (message.blacklist) {
				if (Math.abs(message.blacklist.length - blacklist.length) == 1) {
					blacklist = message.blacklist;
				} else {
					blacklist.push(...message.blacklist);
					blacklist = _.uniq(blacklist);
				}
				synchronizeBlacklist();
			}
			
		}
	});
	server.onClientConnection((socket) => {
		server.getWriter().send(JSON.stringify({historicalPrices: prices}), socket);
	});
	server.start();
	getExchangeInfo();
}

function initClient() {
	client = SocketModel.createClient( { socketFile: SOCKETFILE } );
	client.onMessage(function(obj) {
		if (obj.message) {
			message = JSON.parse(obj.message)
			if (message.prices && message.timestamp && message.interval) {
				if (!fetchMarketDataTime || parseInt(message.timestamp) >= fetchMarketDataTime) {
					serverPrices = message.prices;
					price_data_received = true;
				}
			}
			if (message.blacklist) {
				if (!_.isEqual(message.blacklist.sort(), blacklist.sort())) {
					if (!blacklist.includes(coin) && message.blacklist.includes(coin) && auto && !SELL_FINISHED) {
						quit_buy = true;
					}
					blacklist = message.blacklist;
					console.log(`Updated Blacklist: ${blacklist}`);
				}
			}
			if (message.historicalPrices) {
				prices = everyNthElement(message.historicalPrices, SYMBOLS_PRICE_CHECK_TIME/DEFAULT_SYMBOL_PRICE_CHECK_TIME);
				prices_data_points_count = prices.length;
				prices = prices.map(o => {
					n = {};
					Object.keys(o).forEach(k => n[k] = parseFloat(o[k]));
					return n;
				});
			}
		}
	});
	client.start();
}

///////////////////////////// BEFORE BUY ////////////////////////////////////////

async function waitUntilPrepump() {
	coinpair = "";
	if (futures) {
		RALLY_MAX_DELTA = FUTURES_RALLY_MAX_DELTA;
	}
	UPPER_BB_PCT = PREPUMP_MIN_UPPER_BB_PCT;
	LOWER_BB_PCT = PREPUMP_MIN_LOWER_BB_PCT;
	while (true) {
		await waitUntilFetchPricesAsync();
		if (!detection_mode) {
			console.clear();
			console.log(`Waiting for pullbacks, Data points: ${prices_data_points_count}`);
			console.log("Your Base currency is " + DEFAULT_BASE_CURRENCY);
			console.log("BTCUSDT is : " + colorText(prevDay["BTCUSDT"] > 0 ? "green" : "red", prevDay["BTCUSDT"] + "%"));
			console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}`);
			console.log(`Rally Time: ${msToTime(RALLY_TIME * SYMBOLS_PRICE_CHECK_TIME)}, Profit Multiplier: ${colorText("green", PREPUMP_TAKE_PROFIT_MULTIPLIER)}, Rally Stop Loss Multiplier: ${colorText("red", PREPUMP_STOP_LOSS_MULTIPLIER)}`);
			console.log(`Blacklist: ${blacklist}`);
			//console.log(lastSellReason);
			console.log(`You have made ${purchases.length} purchases`);
			last_purchase_obj = purchases.slice(-1).pop();
			recent_purchases = purchases.slice(-(process.stdout.rows - 9)/(last_purchase_obj ? (Object.keys(last_purchase_obj).length + 2) : 1));
			console.log(`Last ${recent_purchases.length} Purchases: ${JSON.stringify(recent_purchases, null, 4)}`);
		}
		rally = null;
		if (buy_rallys) {
			rally = await getRally();
		} else if (buy_good_buys) {
			rally = await getGoodBuy();
		}

		if (rally != null && Date.now() > dont_buy_before) {
			if (!yolo) {
				// This avoids the race condition if we're waiting to buy anyways
				await sleep(10 * ONE_SEC * Math.random() + 2 * ONE_SEC);
			}
			if (getPricesForCoin(rally.sym).length < PRICES_HISTORY_LENGTH) {
				console.log("not enough data");
				continue;
			}
			if (blacklist.includes(getCoin(rally.sym))) {
				continue;
			}
			coinpair = rally.sym;
			coin = getCoin(coinpair);
			baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";
			SELL_FINISHED = false;
			lookback = [];
			q = [];
			blacklist.push(coin);
			synchronizeBlacklist();
			readCoinInfo();
			while (coinInfo == null) {
				await sleep(ONE_SEC);
			}
			opportunity_expired_time = Date.now() + (buy_good_buys ? 60 * ONE_MIN : SYMBOLS_PRICE_CHECK_TIME/DEFAULT_SYMBOL_PRICE_CHECK_TIME * OPPORTUNITY_EXPIRE_WINDOW);
			rally_inc_pct = rally.gain - 1;
			TAKE_PROFIT_MULTIPLIER = Math.max(1.02, Math.min(1.1, (rally_inc_pct * PREPUMP_TAKE_PROFIT_MULTIPLIER) + 1));
			STOP_LOSS_MULTIPLIER = Math.min(0.99, Math.max(0.95, 1/((rally_inc_pct * PREPUMP_STOP_LOSS_MULTIPLIER) + 1)));
			time_elapsed_since_rally = 0;
			latestPrice = rally.last;
			pump();
			while (!SELL_FINISHED) {
				await sleep(0.5 * ONE_MIN);
			}
			analyzeDecisionForPrepump(rally.sym, rally_inc_pct, time_elapsed_since_rally, purchases.slice(-1).pop(), TAKE_PROFIT_MULTIPLIER);
		}
	}
}

async function getRally() {
	rallies = await detectCoinRallies();
	if (detection_mode) {
		console.clear();
		console.log("Detection Mode Active");
		console.log(`Current time is ${new Date(Date.now()).toLocaleTimeString("en-US")}`);
		rallies && rallies.length && console.log(`Rallies: ${JSON.stringify(rallies, null, 4)}`);
		return;
	}

	if (prices_data_points_count < PRICES_HISTORY_LENGTH) {
		return;
	}

	rally = null;
	
	while (rallies.length) {
		rally = rallies.shift();
		if (getBalance(getCoin(rally.sym)) > 0 || blacklist.includes(getCoin(rally.sym)) || coinpair == rally.sym || rally.fail || !rally.goodBuy) {
			rally = null;
		}
	}
	return rally;
}

async function detectCoinRallies() {
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
			if (current >= last) {
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
		// TODO: Rethink where start/end values should be in comparison to sorted historical
		gain = max/min;
		first = lastX[0][sym];
		last = lastX[lastX.length-1][sym];
		historical_vals = getPricesForCoin(sym, PRICES_HISTORY_LENGTH).slice(0, -RALLY_TIME);
		recent_historical_vals = historical_vals.slice(-3 * RALLY_TIME, -RALLY_TIME);
		sorted_historical_vals = recent_historical_vals.sort();
		recent_sorted_historical_vals = recent_historical_vals.sort();
		high_median = sorted_historical_vals.slice(-0.5 * sorted_historical_vals.length).shift();
		low_median = sorted_historical_vals.slice(0, -0.95 * sorted_historical_vals.length).pop();
		min_historical = recent_sorted_historical_vals.shift();
		max_historical = recent_sorted_historical_vals.pop();

		test_count = 0;
		fail_reasons = ""
		if(green == 0 || red/green >= RALLY_GREEN_RED_RATIO) {
			test_count++;
		} else {
			fail_reasons += "ratio " + red/green + " ";
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
		if (last < first) {
			test_count++;
		} else {
			fail_reasons += "last>first " + last + '>' + first + " ";
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
		// Rethink this in particular
		if (min_historical > last) {
			test_count++;
		} else {
			fail_reasons += "lowest<last " + min_historical + '<' + last + " ";
		}
		if (max_historical/min_historical > gain) {
			test_count++;
		} else {
			fail_reasons += "historicalgain<gain " + max_historical/min_historical + '<' + gain + " ";
		}
		if ((green == 0 || red/green >= RALLY_GREEN_RED_RATIO)
			&& gain < RALLY_MAX_DELTA
			&& gain > RALLY_MIN_DELTA
			&& last < first
			&& high_median > first
			&& low_median < first
			&& min_historical > last
			&& max_historical/min_historical > gain
			) {
			rallies.push({
				sym: sym,
				min: min,
				max: max,
				gain: gain,
				first: first,
				last: last,
				goodBuy: !!await isAGoodBuyFrom1hGraph(sym),
			});
		} else if (test_count > 6 && detection_mode) {
			rallies.push({sym: sym, first: first, last: last, gain: gain, goodBuy: !!await isAGoodBuyFrom1hGraph(sym), fail: fail_reasons});
		}
	}
	return rallies.sort((a, b) => a.gain - b.gain);
}

async function getGoodBuy() {
	if (prices_data_points_count % 30 == 3) {
		goodBuys = await scanForGoodBuys();
		if (detection_mode) {
			//console.clear();
			console.log("Detection Mode Active");
			console.log(`Current time is ${new Date(Date.now()).toLocaleTimeString("en-US")}`);
			console.log(`Good buys: ${JSON.stringify(goodBuys, null, 2)}`);
			return;
		}
		goodBuy = null;
		while (goodBuys.length) {
			goodBuy = goodBuys.shift();
			if (getBalance(getCoin(goodBuy.sym)) > 0 || blacklist.includes(getCoin(goodBuy.sym)) || coinpair == goodBuy.sym) {
				goodBuy == null
			}
		}
		return goodBuy;
	}
}

async function scanForGoodBuys() {
	goodCoins = [];
	promises = Object.keys(coinsInfo).map(async k => {
		if (coinsInfo[k].status != "TRADING") {
			return;
		}
		if (futures && !k.includes("UPUSDT") && !k.includes("DOWNUSDT")) {
			return;
		}
		if (!futures && (k.includes("UPUSDT") || k.includes("DOWNUSDT"))) {
			return;
		}
		if (k.endsWith(DEFAULT_BASE_CURRENCY) && !k.includes("AUD") && !k.includes("EUR") && !k.includes("GBP")) {
			goodCoin = await isAGoodBuyFrom1hGraph(k);
			if (goodCoin) {
				goodCoins.push(goodCoin);
			}
		}
	});
	await Promise.all(promises)
	return goodCoins.sort((a, b) => a.volume - b.volume);
}

async function isAGoodBuyFrom1hGraph(sym) {
	let finished = false;
	let ticker = [];
	let closes = [];
	let opens = [];
	let gains = [];
	let highs = [];
	let lows = [];
	let last = 0;
	let totalVolume = 0;
	await sleep(Math.random() * ONE_MIN);
	binance.candlesticks(sym, "1h", (error, ticks, symbol) => {
		if (error) {
			console.log(error);
			finished = true;
			return;
		}
		ticks.forEach(([time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored]) => {
			ticker.push(open/2 + close/2);
			opens.push(parseFloat(open));
			closes.push(parseFloat(close));
			highs.push(parseFloat(high));
			lows.push(parseFloat(low));
			gains.push(close/open);
			totalVolume += parseFloat(volume) * (open/2 + close/2);
		})
		last = closes.slice(-1).pop();
		finished = true;
	}, {limit: 21, endTime: Date.now()});
	while (!finished) {
		await sleep(ONE_SEC)
	}
	if (!ticker.length) {
		return false;
	}
	let mean = average(ticker);
	let std = getStandardDeviation(ticker);
	let last3gains = gains.slice(-3);
	let gain = last3gains.reduce((sum, val) => sum + Math.abs(1-val), 1.01);
	let increasingGains = isUptrend(last3gains, 0, false);
	let lastWickShorterThanBody = (2 * (highs.slice(-1).pop() - closes.slice(-1).pop())) < (closes.slice(-1).pop() - opens.slice(-1).pop());
	let middleIsSmallest = Math.abs(1 - last3gains[0]) > Math.abs(1 - last3gains[1]) && Math.abs(1 - last3gains[2]) > Math.abs(1 - last3gains[1]);
	let opensBelowOneStdPlusMean = (opens.slice(-3).filter(v => v > (mean + std)).length == 0);
	let startOfRally = !isUptrend(closes.slice(-4), 0, false) && isUptrend(closes.slice(-3), 0, false);
	let goodBuyGainIsValid = gain >= GOOD_BUY_MIN_GAIN && gain <= GOOD_BUY_MAX_GAIN;
	if (opensBelowOneStdPlusMean && startOfRally && middleIsSmallest && increasingGains && lastWickShorterThanBody && goodBuyGainIsValid)  {
		return {
			sym: sym,
			gain: gain,
			last: last,
			volume: totalVolume,
		};
	}
	return false;
}	

////////////////////////////////////// BUY ///////////////////////////////////////////////

async function pump() {
	//buy code here
	console.log("pump");
	if (BUY_LOCAL_MIN && !yolo) {
		manual_buy = false;
		quit_buy = false;
		latestPrice = await waitUntilTimeToBuy();
		manual_buy = false;
		quit_buy = false;
	} else {
		latestPrice = await getLatestPriceAsync(coinpair);
	}
	if (latestPrice == 0) {
		SELL_FINISHED = true; // never bought
		blacklist = blacklist.filter(i => i !== coin);
		synchronizeBlacklist();
		if (!LOOP) {
			console.log("Quitting");
			process.exit(0);
		}
		console.log("BUY WINDOW EXPIRED");
		lastBuy = 0;
		lastSell = 0;
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
		buy_price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		lastBuy = buy_price * response.executedQty;
		actualquantity = response.executedQty // replace with bought quantity
		ndump((buy_price * TAKE_PROFIT_MULTIPLIER).toPrecision(4), buy_price, (buy_price * STOP_LOSS_MULTIPLIER).toPrecision(4), actualquantity);
	});
}

async function waitUntilTimeToBuy() {
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
	buy_indicator_buffer_add = buy_good_buys ? 5 * ONE_MIN : ONE_MIN;
	buy_indicator_buffer = buy_indicator_buffer_add;
	fetching_prices_from_graph_mode = false;
	btcHistorical = getPricesForCoin("BTCUSDT", PRICES_HISTORY_LENGTH);
	follows_btc = false;
	follows_btc_history = new Array(10).fill(0.5);
	lastBTC = [];
	while (true) {
		if ((client || server) && !fetching_prices_from_graph_mode) {
			fetching_prices_from_graph_mode = true;
			fetchAllPricesAsyncIfReady().catch().finally(() => { 
				fetching_prices_from_graph_mode = false;
				btcHistorical = getPricesForCoin("BTCUSDT", PRICES_HISTORY_LENGTH);
				lastBTC = btcHistorical.slice(-3);
				last_btc_q_index = q.length - 1 - Math.floor(2 * SYMBOLS_PRICE_CHECK_TIME/ONE_SEC);
				if ((q[last_btc_q_index] < q[q.length-1] && lastBTC[0] < lastBTC[lastBTC.length-1]) || (q[last_btc_q_index] > q[q.length-1] && lastBTC[0] > lastBTC[lastBTC.length-1])) {
					follows_btc_history.push(1);
				} else {
					follows_btc_history.push(0);
				}
				follows_btc_history.shift();
				follows_btc = average(follows_btc_history) >= 0.7;
			});
		}
		var [mean, stdev] = await tick(true);
		console.clear();
		if (manual_buy) {
			return latestPrice;
		}
		if (quit_buy) {
			return 0;
		}
		if(starting_price == 0) {
			starting_price = latestPrice;
		}
		
		meanTrend = isDowntrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO"): colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText("green", latestPrice)}, Following BTC: ${follows_btc}, ${prepump ? `Opportunity Expires: ${colorText(buy_indicator_reached ? "green" : "red", msToTime(opportunity_expired_time - Date.now()))}, ` : ""}BBHigh: ${colorText("red", highstd.slice(-1).pop().toPrecision(4))}, BBLow: ${colorText("green", lowstd.slice(-1).pop().toPrecision(4))}, Buy Window: ${buy_indicator_reached ? colorText("green", msToTime(buy_indicator_check_time - Date.now())) : colorText("red", "N/A")}${(!ready && auto) ? colorText("red", " GATHERING DATA") : ""}`);
		if (Date.now() > dont_buy_before && auto) {
			switch (BUY_SELL_STRATEGY) {
				case 7:
					if ((!prices_data_points_count && lookback.length < QUEUE_SIZE) || prices_data_points_count * SYMBOLS_PRICE_CHECK_TIME / ONE_SEC < QUEUE_SIZE) {
						break;
					}
					if (prepump && Date.now() > opportunity_expired_time) {
						return 0;
					}
					lastLowstd =  lowstd.slice(-1).pop();
					ready = true;
					if (!buy_indicator_reached && latestPrice < lastLowstd) {
						buy_indicator_reached = true;
						buy_indicator_check_time = Date.now() + BUY_SELL_INDICATOR_INC + buy_indicator_buffer;
						if (buy_indicator_buffer) {
							buy_indicator_buffer_add = Math.max(0, buy_indicator_buffer_add - ONE_MIN) ;
						}
						buy_indicator_buffer = 0;
					}
					if (!buy_indicator_reached && latestPrice > mean) {
						buy_indicator_buffer = buy_indicator_buffer_add;
					}
					if (buy_indicator_reached && Date.now() > buy_indicator_check_time) {
						if (latestPrice > lastLowstd && latestPrice < mean ) {
							return latestPrice;
						}
						buy_indicator_reached = false;
					}
					break;
				default:
					break;
			}
		}
		if (SHOW_GRAPH) {
			plot(true);
		}
		previousTrend = (meanTrend.includes("Up") || meanTrend.includes("Down")) ? meanTrend : previousTrend;
	}
}

///////////////////////// SELL ///////////////////////////////////////////////

async function ndump(take_profit, buy_price, stop_loss, quantity) {
	waiting = true;
	lastSellLocalMax = 0;
	lastSellLocalMaxStdev = 0;
	lastSellLocalMinStdev = 0;
	latestPrice = await waitUntilTimeToSell(parseFloat(take_profit), parseFloat(stop_loss), parseFloat(buy_price));
	manual_sell = false;
	buy_time = Date.now();
	console.log((latestPrice > take_profit || Math.abs(1-take_profit/latestPrice) < 0.005) ? "taking profit" : "stopping loss");
	binance.marketSell(coinpair, quantity, (error, response) => {
		if (error) {
			console.log(`MARKET DUMP ERROR: ${error.body}`);
			console.log("Market sell error, please sell on Binance.com manually");
			return;
		}
		sell_price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		console.log("market dump is successful");
		console.log("Last sell is because " + lastSellReason);
		console.info("Market sell response", response);
		console.info("order id: " + response.orderId);
		SELL_TS = 0;
		SELL_FINISHED = true;
		lastSell = sell_price * response.executedQty;
		pnl += lastSell - lastBuy;
		pnl = Math.round(pnl*10000000)/10000000;
		if (LOOP) {
			beep();
			purchase = {
				sym: coinpair,
				buy: lastBuy,
				buyPrice: buy_price,
				buy_time: new Date(buy_time).toLocaleTimeString("en-US"),
				sell: lastSell,
				sellPrice: sell_price,
				sell_time: new Date(Date.now()).toLocaleTimeString("en-US"),
				maxPrice: lastSellLocalMax,
				maxStdev: lastSellLocalMaxStdev,
				minStdev: lastSellLocalMinStdev,
				sellReason: lastSellReason,
				gain: lastSell/lastBuy
			};
			purchases.push(purchase);
			lastSellLocalMax = 0;
			if (AFTER_SELL_WAIT_BEFORE_BUYING) {
				dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY;
			}
			if (prepump) {
				removeFromBlacklistLater(coin);
				return;
			}
			analyzeDecisionForSingleCoin(purchase);
			pump()
			return;
		}
		console.log("Sell complete, exiting");
		process.exit(0);
	});
	return;
}

async function waitUntilTimeToSell(take_profit, stop_loss, buy_price) {
	start = Date.now();
	end = Date.now() + RUNTIME;
	count = 0;
	meanRev = false;
	meanRevStart = 0;
	outlierReversion = 0;
	previousTrend = "None";
	meanTrend = "None";
	timeBeforeSale = Date.now() + ONE_MIN; // Believe in yourself!
	stop_loss_check = 0;
	timeout_count = 0;
	sell_indicator_reached = false;
	sell_indicator_check_time = 0;
	mean = 0;
	stdev = 0;
	ride_profits = false;
	take_profit_hit_check_time = 0;
	while (!auto || (latestPrice > stop_loss && latestPrice < take_profit) || ride_profits) {
		if ((client || server) && !fetching_prices_from_graph_mode) {
			fetching_prices_from_graph_mode = true;
			fetchAllPricesAsyncIfReady().catch().finally(() => { 
				fetching_prices_from_graph_mode = false;
			});
		}
		[mean, stdev] = await tick(false);
		console.clear();
		if (manual_sell) {
			lastSellReason = "manually sold";
			return latestPrice;
		}
		lastSellLocalMax = Math.max(latestPrice, lastSellLocalMax);
		lastSellLocalMaxStdev = Math.max((latestPrice - mean)/stdev, lastSellLocalMaxStdev);
		lastSellLocalMinStdev = Math.min((latestPrice - mean)/stdev, lastSellLocalMinStdev);
		meanTrend = isDowntrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO") : colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText(latestPrice > buy_price ? "green" : "red", latestPrice)} Profit: ${colorText("green", take_profit + " (" + ((take_profit/buy_price - 1) * 100).toFixed(3) + "%)")}, Buy: ${colorText("yellow", buy_price.toPrecision(4))} Stop Loss: ${colorText("red", stop_loss + " (" + ((1-stop_loss/buy_price) * -100).toFixed(3) + "%)")} Sell Window: ${sell_indicator_reached ? colorText("green", msToTime(sell_indicator_check_time - Date.now())) : colorText("red", "N/A")}`);
		if (auto && Date.now() > timeBeforeSale) {
			switch (BUY_SELL_STRATEGY) {
				case 7:
					if (latestPrice > take_profit && !ride_profits && SELL_RIDE_PROFITS) {
						ride_profits = true;
						take_profit_hit_check_time = Date.now() + 0.5 * ONE_MIN;
					}
					if (ride_profits && Date.now() > take_profit_hit_check_time) {
						if (latestPrice < (take_profit * 0.995)) {
							lastSellReason = "sold because take profit is reached";
							return latestPrice;
						}
					}
					if (ride_profits && latestPrice > take_profit) {
						if (!sell_indicator_reached && latestPrice > highstd.slice(-1).pop()) {
							sell_indicator_reached = true;
							sell_indicator_check_time = Date.now() + BUY_SELL_INDICATOR_INC;
						}
						if (sell_indicator_reached && Date.now() > sell_indicator_check_time) {
							if (latestPrice < highstd.slice(-1).pop()) {
								lastSellReason = "sold because indicator has reached";
								return latestPrice;
							}
							sell_indicator_reached = false;
						}
					}
					break;
				default:
					// do nothing
					break;

			}
		}
		if (SHOW_GRAPH) {
			plot(false);
		}
		previousTrend = (meanTrend.includes("Up") || meanTrend.includes("Down")) ? meanTrend : previousTrend;
	}
	lastSellReason = "Sold bcuz take profit or stop loss hit";
	return latestPrice
}

///////////////////////// AFTER SELL //////////////////////////////////////

function analyzeDecisionForSingleCoin(purchase) {
	if (!purchase || !purchase.sym) {
		return;
	}
	return new Promise((_) => {
		if (purchase.gain > 1) {
			// Increase UPPER_BB_PCT && LOSER_BB_PCT
			UPPER_BB_PCT = Math.max(MIN_BB_PCT, Math.min(MAX_BB_PCT, UPPER_BB_PCT + 0.1));
			LOWER_BB_PCT = Math.min(-MAX_BB_PCT, Math.min(-MIN_BB_PCT, LOWER_BB_PCT + 0.1));
		} else {
			// Decrease UPPER_BB_PCT && LOWER_BB_PCT
			UPPER_BB_PCT = Math.max(MIN_BB_PCT, Math.min(MAX_BB_PCT, UPPER_BB_PCT - 0.1));
			LOWER_BB_PCT = Math.max(-MAX_BB_PCT, Math.min(-MIN_BB_PCT, LOWER_BB_PCT - 0.1));
		}
	}, TIME_BEFORE_NEW_BUY);
}

function analyzeDecisionForPrepump(sym, rally_inc_pct, time_elapsed, purchase, old_profit_multiplier) {
	if (!purchase || !purchase.sym ||  !purchase.sym == sym) {
		return;
	}
	return new Promise((_) => {
		setTimeout(() => {
			// historical_prices = getPricesForCoin(coinpair, time_elapsed);
			// max_historical = Math.max(purchase.maxPrice, ...historical_prices);
			// historical_profit = max_historical/purchase.buyPrice;
			// new_take_profit = Math.max(average([old_profit_multiplier, historical_profit]), 1.01);
			// //TAKE_PROFIT_MULTIPLIER = (rally_inc_pct * PREPUMP_TAKE_PROFIT_MULTIPLIER) + 1;
			// PREPUMP_TAKE_PROFIT_MULTIPLIER = Math.max(0.75, Math.min(3, ((new_take_profit - 1)/rally_inc_pct).toFixed(4)));
			// PREPUMP_STOP_LOSS_MULTIPLIER = PREPUMP_TAKE_PROFIT_MULTIPLIER/2;
			// // TODO: Find index of max historical, if before or near purchase, shorten opportunity time, if after then make it longer
			// RALLY_TIME = purchase.gain > 1 ? Math.max(MIN_RALLY_TIME, RALLY_TIME - 1) : Math.min(MAX_RALLY_TIME, RALLY_TIME + 1);
			if (purchase.gain > 1) {
				// DECREASE UPPER_BB_PCT && INCREASE LOSER_BB_PCT
				UPPER_BB_PCT = Math.max(PREPUMP_MIN_UPPER_BB_PCT, Math.min(PREPUMP_MAX_UPPER_BB_PCT, UPPER_BB_PCT - 0.1));
				LOWER_BB_PCT = Math.max(PREPUMP_MIN_LOWER_BB_PCT, Math.min(PREPUMP_MAX_LOWER_BB_PCT, LOWER_BB_PCT + 0.1));
			} else {
				// INCREASE UPPER_BB_PCT && DECREASE LOWER_BB_PCT
				UPPER_BB_PCT = Math.max(PREPUMP_MIN_UPPER_BB_PCT, Math.min(PREPUMP_MAX_UPPER_BB_PCT, UPPER_BB_PCT + 0.1));
				LOWER_BB_PCT = Math.max(PREPUMP_MIN_LOWER_BB_PCT, Math.min(PREPUMP_MAX_LOWER_BB_PCT, LOWER_BB_PCT - 0.1));
			}
		}, TIME_BEFORE_NEW_BUY);
	});
}

/////////////////////////// HELPER FUNCTIONS DURING BUY/SELL ///////////////////////////

function initializeQs() {
	if (q.length == 0) {
		// small digits is to prevent bug in asciichart library if all values are the same
		historical_prices = getPricesForCoin(coinpair, QUEUE_SIZE * ONE_SEC / SYMBOLS_PRICE_CHECK_TIME);
		if (!historical_prices.length) {
			q = new Array(QUEUE_SIZE).fill(latestPrice); // for graph visualization
			means = new Array(QUEUE_SIZE).fill(latestPrice + 0.0000000001);
			lowstd = new Array(QUEUE_SIZE).fill(latestPrice - 0.0001);
			highstd = new Array(QUEUE_SIZE).fill(latestPrice + 0.0001);
			mabuy = new Array(QUEUE_SIZE).fill(latestPrice + 0.00000001);
			masell = new Array(QUEUE_SIZE).fill(latestPrice - 0.0000001);
		} else {
			averageHistorical = average(historical_prices);
			stdevHistorical = getStandardDeviation(historical_prices);
			q = new Array(QUEUE_SIZE).fill(averageHistorical);
			historical_prices.forEach(v => {
				fillWith = new Array(SYMBOLS_PRICE_CHECK_TIME/ONE_SEC).fill(v);
				q.push(...fillWith);
			});
			q = q.slice(-QUEUE_SIZE);
			mabuy = new Array(QUEUE_SIZE).fill(averageHistorical + 0.00000001);
			masell = new Array(QUEUE_SIZE).fill(averageHistorical - 0.0000001);
			means = new Array(QUEUE_SIZE).fill(averageHistorical);
			lowstd =  new Array(QUEUE_SIZE).fill(averageHistorical + LOWER_BB_PCT * stdevHistorical);
			highstd =  new Array(QUEUE_SIZE).fill(averageHistorical + UPPER_BB_PCT * stdevHistorical);
		}
		
	}
}

async function tick(buying) {
	await sleep(POLL_INTERVAL);
	//lastDepth = await getMarketDepth(coinpair);
	bidask = await getBidAsk(coinpair);
	latestPrice = buying ? parseFloat(bidask.askPrice) : parseFloat(bidask.bidPrice); //await getLatestPriceAsync(coinpair);
	pushToLookback(latestPrice);
	initializeQs();
	BUY_TS++;
	SELL_TS++;
	q.push(latestPrice);
	stdev = getStandardDeviation([...Array(Math.floor(QUEUE_SIZE/60)).keys()].map(v => average(q.slice(v * 60, (v + 1) * 60))));
	mean = average(q);
	means.push(mean);
	lowstd.push(mean + LOWER_BB_PCT * stdev);
	highstd.push(mean + UPPER_BB_PCT * stdev);
	mabuy.push(average(lookback.slice(-BB_BUY)));
	masell.push(average(lookback.slice(-BB_SELL)));
	q.shift() != 0 && lowstd.shift() != 0 && highstd.shift() != 0 && means.shift() != 0 && mabuy.shift() != 0 && masell.shift() != 0;
	return [mean, stdev]
}

function pushToLookback(latestPrice) {
	lookback.push(latestPrice);
	if (lookback.length > LOOKBACK_SIZE) {
		lookback.shift();
	}
}

function isUptrend(q2, buffer = 0, kinda = true, stdev = 0) {
	// if (stdev == 0) {
	// 	stdev = getLastStdev();
	// }
	return q2.slice(0, q2.length-1).filter(v => v > q2[q2.length-1]).length <= buffer
		&& q2.slice(1-q2.length).filter(v => v < q2[0]).length <= buffer * (kinda ? 3 : 1)
		&& q2[q2.length-1] - q2[0] > MIN_TREND_STDEV_MULTIPLIER * stdev;
}

function isDowntrend(q2, buffer = 0, kinda = true, stdev = 0) {
	// if (stdev == 0) {
	// 	stdev = getLastStdev();
	// }
	return q2.slice(0, q2.length-1).filter(v => v < q2[q2.length-1]).length <= buffer
		&& q2.slice(1-q2.length).filter(v => v > q2[0]).length <= buffer * (kinda ? 3 : 1)
		&& q2[0] - q2[q2.length-1] > MIN_TREND_STDEV_MULTIPLIER * stdev;
}

////////////////////// BALANCE AND BLACKLISTS AND EXCHANGE STUFF //////////////////////////////////////
async function waitUntilFetchPricesAsync() {
	while(Date.now() < fetchMarketDataTime) {
		await sleep(0.1 * ONE_SEC);
	}
	if (!client) {
		await fetchAllPricesAsync();
	} else {
		while (!price_data_received) {
			await sleep(0.1 * ONE_SEC);
		}
		price_data_received = false;
	}
	if (server) {
		server.broadcast(JSON.stringify({prices: serverPrices, timestamp: Date.now(), interval: SYMBOLS_PRICE_CHECK_TIME}));
	}
	parseServerPrices();
	++prices_data_points_count;
	++time_elapsed_since_rally;
	fetchMarketDataTime = Date.now() + SYMBOLS_PRICE_CHECK_TIME;
	if (client) {
		fetchMarketDataTime -= ONE_SEC;
	}
}

function parseServerPrices() {
	while (prices.length >= PRICES_HISTORY_LENGTH) {
		prices.shift();
	}
	newPrices = {};
	serverPrices.forEach(v => {
		if (!v || !v.symbol || (!server && !v.symbol.endsWith(DEFAULT_BASE_CURRENCY))) {
			return;
		}
		if (v.symbol.endsWith("BTC") && v.askPrice < MIN_COIN_VAL_IN_BTC) {
			return;
		}
		if (!detection_mode) {
			if (!futures && (v.symbol.includes("DOWNUSDT") || v.symbol.includes("UPUSDT"))) {
				return;
			}
			if (futures && !v.symbol.includes("DOWNUSDT") && !v.symbol.includes("UPUSDT")) {
				return;
			}
		}
		newPrices[v.symbol] = v.askPrice;
	});
	prices.push(newPrices);
}

function getPricesForCoin(sym, timeframe) {
	recent_prices = prices.slice(-timeframe);
	res = [];
	for (i = 0; i < recent_prices.length; i++) {
		res.push(parseFloat(recent_prices[i][sym]));
	}
	return res.filter(a => a);
}

async function fetchAllPricesAsyncIfReady() {
	return new Promise(async (resolve) => {
		await waitUntilFetchPricesAsync();
		resolve();
	});
}

async function fetchAllPricesAsync() {
	await getAllPrices().catch((err) => console.error(err));
}

async function getAllPrices() {
	return new Promise((resolve, reject) => {
		binance.bookTickers((error, ticker) => {
			if (error) {
				while (++fail_counter >= 100) {
					console.log("TOO MANY FAILS GETTING PRICES");
					process.exit(1);
				}
				reject();
				return;
			}
			fail_counter = 0;
			serverPrices = ticker;
			resolve();
		});
	});
	
}

async function getPrevDay() {
	binance.prevDay(false, (error, pd) => {
		if (error || !pd) {
			// TODO: Better error handling
			return;
		}
		for ( let obj of pd ) {
		    let symbol = obj.symbol;
		    prevDay[symbol] = obj.priceChangePercent;
		}
		//setMultiplersFromPreviousDayBTCPrices();
	});
}

function setMultiplersFromPreviousDayBTCPrices() {
	if (prevDay['BTCUSDT']) {
		prevDayBTC = prevDay['BTCUSDT'];
		if (parseFloat(prevDayBTC) > 0) {
			if (PREPUMP_TAKE_PROFIT_MULTIPLIER == PREPUMP_BEAR_PROFIT_MULTIPLIER) {
				PREPUMP_TAKE_PROFIT_MULTIPLIER = PREPUMP_BULL_PROFIT_MULTIPLIER;
			}
			if (PREPUMP_STOP_LOSS_MULTIPLIER == PREPUMP_BEAR_LOSS_MULTIPLIER) {
				PREPUMP_STOP_LOSS_MULTIPLIER = PREPUMP_BULL_LOSS_MULTIPLIER;
			}
			if (RALLY_TIME == PREPUMP_BEAR_RALLY_TIME) {
				RALLY_TIME = PREPUMP_BULL_RALLY_TIME;
			}
		} else {
			if (PREPUMP_TAKE_PROFIT_MULTIPLIER == PREPUMP_BULL_PROFIT_MULTIPLIER) {
				PREPUMP_TAKE_PROFIT_MULTIPLIER = PREPUMP_BEAR_PROFIT_MULTIPLIER;
			}
			if (PREPUMP_STOP_LOSS_MULTIPLIER == PREPUMP_BULL_LOSS_MULTIPLIER) {
				PREPUMP_STOP_LOSS_MULTIPLIER = PREPUMP_BEAR_LOSS_MULTIPLIER;
			}
			if (RALLY_TIME == PREPUMP_BULL_RALLY_TIME) {
				RALLY_TIME = PREPUMP_BEAR_RALLY_TIME;
			}
		}
	}
}

// DEPRECATED
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
		await sleep(0.1 * ONE_SEC);
		return await getLatestPriceAsync(coinpair);
	}
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

// this never resolves
async function loopGetBalanceAndPrevDayAsync() {
	return new Promise(async (resolve) => {
		while (true) {
			while (Date.now() < fetch_balance_time) {
				await sleep(ONE_MIN);
			}
			getPrevDay();
			fetching_balance = true;
			binance.balance((error, b) => {
				if ( error ) {
					fetching_balance = false;
					fetch_balance_time = Date.now() + ONE_MIN;
					console.log(error);
					return;
				}
				balances = b;
				updateBlacklistFromBalance();
				fetching_balance = false;
				fetch_balance_time = Date.now() + FETCH_BALANCE_INTERVAL;
			});
			while (fetching_balance) {
				await sleep(ONE_MIN);
			}
		}
		
	});
}

async function prepopulate30mData() {
	if (!coinsInfo) {
		return;
	}
	let newPrices = {};
	promises = Object.keys(coinsInfo).map(async k => {
		if (coinsInfo[k].status != "TRADING") {
			return;
		}
		if (k.endsWith("USDT") || k.endsWith("BTC")) {
			binance.candlesticks(k, "1m", (error, ticks, symbol) => {
				//console.info("candlesticks()", ticks);
				if (error) {
					console.log(error);
					finished = true;
					return;
				}
				if (!newPrices[k]) {
					newPrices[k] = [];
				}
				ticks.forEach(([time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored]) => {
					newPrices[k].push(open/2 + close/2);
				})
			}, {limit: 30, endTime: Date.now()});
		}
	});
	await sleep(10 * ONE_SEC)
	newPricesArray = [];
	for (i = 0; i < 30; i++) {
		newPrices10s = {};
		Object.keys(newPrices).forEach(k => {
			newPrices10s[k] = newPrices[k][i];
		});
		newPricesArray.push(...(Array(6).fill(newPrices10s)));
	}
	prices = newPricesArray.concat(prices).slice(-PRICES_HISTORY_LENGTH);
}

function updateBlacklistFromBalance() {
	Object.keys(balances).forEach(key => {
		if (key != "USDT" && parseFloat(balances[key].available) > 0 && !blacklist.includes(key)) {
			blacklist.push(key)
		}
	});
	if (server) {
		synchronizeBlacklist();
	}
}

function removeFromBlacklistLater(coin) {
	setTimeout(() => {
		blacklist = blacklist.filter(i => i !== coin);
		synchronizeBlacklist();
	}, (buy_good_buys ? 60 * ONE_MIN : 5 * ONE_MIN));
}

function synchronizeBlacklist() {
	if (server) {
		server.broadcast(JSON.stringify({blacklist: blacklist}));
	}
	if (client) {
		client.send(JSON.stringify({blacklist: blacklist}));
	}
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

function readCoinInfo() {
	fs.readFile("minimums.json", function(err, data){
		if (err) {
			getExchangeInfo();
			console.log("minimums.json read error, fetching data");
			return;
		}
		coinsInfo = JSON.parse(data);
		coinInfo = coinsInfo[coinpair];
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

/////////////////////////////// MATH /////////////////////////////////////////////////

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

/////////////////////////////// GRAPHING /////////////////////////////////////////////////

function formatGraph(x, i) {
	return ("" + x + GRAPH_PADDING).slice (0, GRAPH_PADDING.length);
}

function plot(buying) {
	if (AUTO_ADJUST_GRAPH) {
		GRAPH_HEIGHT = process.stdout.rows - TERMINAL_HEIGHT_BUFFER;
		PLOT_DATA_POINTS = process.stdout.columns - TERMINAL_WIDTH_BUFFER;
	}
	num_points_to_plot = Math.min(lookback.length, PLOT_DATA_POINTS);
	if (GRAPH_HEIGHT < 5 || num_points_to_plot < 5) {
		return;
	}
	points = [highstd.slice(-num_points_to_plot), lowstd.slice(-num_points_to_plot), means.slice(-num_points_to_plot), (buying ? mabuy : masell).slice(-num_points_to_plot), q.slice(-num_points_to_plot)];
	console.log (
	asciichart.plot(points, 
	{
		format: formatGraph, 
		colors: [
	        buying ? asciichart.red : asciichart.green,
	        buying ? asciichart.green : asciichart.red,
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

/////////////////////////////// MISC /////////////////////////////////////////////////

function colorText(color, str) {
	return asciichart[color] + str + asciichart.reset;
}

function everyNthElement(array, n) {
	return array.filter((_, i) => i % (n) == 0);
}

function msToTime(duration) {
	if (duration < 0) {
		return 0;
	}
	var seconds = Math.floor((duration / ONE_SEC) % 60), minutes = Math.floor((duration / (ONE_MIN))),
	seconds = (seconds < 10) ? "0" + seconds : seconds;
	return minutes + ":" + seconds;
}

function beep() {
	if (!silent) {
		console.log("\007");
	}
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
} 

init();
