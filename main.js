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
const skmeans = require("skmeans");
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
	POLL_INTERVAL,
	LOOP,
	DEFAULT_BASE_CURRENCY,
	FETCH_BALANCE_INTERVAL,
	CLIENT_DISCONNECT_SELL_TIMEOUT,

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
	PRICE_DROP_NEW_OPPORTUNITY_MULTIPLER,
	GOOD_BUYS_OPPORTUNITY_EXPIRE_WINDOW,
	BUY_LOCAL_MIN,
	BUY_INDICATOR_INC,
	SELL_INDICATOR_INC_BASE,
	SELL_INDICATOR_INC_MULTIPLIER,
	TIME_TO_CHANGE_PROFIT_LOSS,
	TAKE_PROFIT_CHANGE_PCT,
	STOP_LOSS_CHANGE_PCT,
	PROFIT_LOSS_CHECK_TIME,
	SELL_RIDE_PROFITS,
	SELL_RIDE_PROFITS_PCT,
	FOLLOW_BTC_MIN_BUY_MEDIAN,
	BUFFER_ADD,
	BUFFER_SUBTRACT,

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
	PREPUMP_MAX_PROFIT_MULTIPLIER,
	PREPUMP_MIN_PROFIT_MULTIPLIER,
	PREPUMP_MAX_LOSS_MULTIPLIER,
	PREPUMP_MIN_LOSS_MULTIPLIER,
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
	MIN_24H_BTC,
	MIN_24H_USDT,
	GOOD_BUY_SEED_MAX,
	GOOD_BUY_SEED,
	GOOD_BUY_PROFIT_MULTIPLIER,
	GOOD_BUY_LOSS_MULTIPLIER,
	GOOD_BUY_BUFFER_ADD,
	GOOD_BUY_BUFFER_SUBTRACT,
	REMOVE_FROM_BLACKLIST_TIMER,
	NUMBER_OF_CLUSTERS,
	NUMBER_OF_CLUSTER_ITERATIONS,
	CLUSTER_SUPPORT_BUY_LEVEL,
	CLUSTER_RESISTANCE_SELL_LEVEL_INC,

	// DONT TOUCH THESE GLOBALS
	dump_count,
	latestPrice,
	websocketTicker,
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
	BUY_TS,
	SELL_TS,
	auto,
	histogram,
	detection_mode,
	buy_good_buys,
	buy_clusters,
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
	TRANSACTION_COMPLETE,
	prices,
	prevDay,
	serverPrices,
	blacklist,
	candlestickCache,
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
	coin,
	follows_btc, 
	follows_btc_history,
	init_complete,
	test_and_quit,
} = require("./const.js");

///////////////////////// INITIALIZATION ///////////////////////////////////
async function init() {
	console.clear();
	checkValidArgs();
	await initArgumentVariables();
	await readCoinInfo();
	initKeybindings();
	loopGetBalance();
	test_and_quit && await testAndQuit();
	init_complete = true;
	if (prepump) {
		waitUntilPrepump();
		return;
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

async function initArgumentVariables() {
	coinpair = process.argv[2].toUpperCase();
	prepump = process.argv[2].toUpperCase() == "PREPUMP";
	if (!prepump) {
		coin = getCoin(coinpair);
		DEFAULT_BASE_CURRENCY = coinpair.includes("USDT") ? "USDT" : "BTC";
	}
	binance = new Binance().options({
	  APIKEY: API_KEY,
	  APISECRET: API_SECRET,
	  recvWindow: ONE_MIN,
	  test: process.argv.includes("--test")
	});
	await binance.useServerTime();
	if (binance.getOption("test")) {
		console.log("testing");
	}
	test_and_quit = process.argv.includes("--test-and-quit");
	if (prepump) {
		yolo = process.argv.includes("--yolo");
		futures = process.argv.includes("--futures");
		SYMBOLS_PRICE_CHECK_TIME = !!parseFloat(process.argv[3]) ? parseFloat(process.argv[3]) * ONE_SEC : SYMBOLS_PRICE_CHECK_TIME;
		DEFAULT_BASE_CURRENCY = process.argv.includes("--base=BTC") ? "BTC" : process.argv.includes("--base=USDT") ? "USDT" : DEFAULT_BASE_CURRENCY;
		buy_rallys = process.argv.includes("--rallys");
		buy_good_buys = process.argv.includes("--goodbuys") && !buy_rallys;
		buy_clusters = !buy_rallys && !buy_good_buys;
		
		if (buy_good_buys || buy_clusters) {
			PREPUMP_TAKE_PROFIT_MULTIPLIER = GOOD_BUY_PROFIT_MULTIPLIER;
			PREPUMP_STOP_LOSS_MULTIPLIER = GOOD_BUY_LOSS_MULTIPLIER;
			OPPORTUNITY_EXPIRE_WINDOW = GOOD_BUYS_OPPORTUNITY_EXPIRE_WINDOW;
			BUFFER_ADD = GOOD_BUY_BUFFER_ADD;
			BUFFER_SUBTRACT = GOOD_BUY_BUFFER_SUBTRACT;
		}
		detection_mode = process.argv.includes("--detect");
	}
	LOOP = !process.argv.includes("--only-buy-once");
	auto = process.argv.includes("--auto") || prepump;
	SHOW_GRAPH = !process.argv.includes("--no-plot");
	silent = process.argv.includes("--silent");
	// TODO: Check if server is already started
	process.argv.includes("--server") && !process.argv.includes("--client") && await initServer();
	if (server && SYMBOLS_PRICE_CHECK_TIME != DEFAULT_SYMBOL_PRICE_CHECK_TIME) {
		console.warn("Servers must have default symbol price check time. Configure this in const.js");
		SYMBOLS_PRICE_CHECK_TIME = DEFAULT_SYMBOL_PRICE_CHECK_TIME;
	}
	!process.argv.includes("--server") && process.argv.includes("--client") && await initClient();
}

function initKeybindings() {
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdin.on('keypress', (str, key) => {
		if (key.ctrl) {
			switch (key.name) {
				case 'c': 
					if (server) {
						writeTransactionLogFileAndExit();
					} else {
						process.exit(0);
					}
					break;
				case "b":
					// b is for buy
					manual_buy = true;
					break;
				case "s":
					// s is for sell
					manual_sell = true;
					break;
				default:
					break;
			}
		} else {
			switch (str) {
				case "a":
					// a is to toggle auto
					auto = !auto;
					break;
				case "l":
					// l is to clear blacklist
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
				case "g":
					SHOW_GRAPH = !SHOW_GRAPH;
					break;
				default:
					break;
			}
		}
	});
}

async function initServer() {
	server = SocketModel.createServer( { socketFile: SOCKETFILE, sendConnectMessage: true} );
	server.onMessage(function(obj) {
		if (obj.message) {
			let message = obj.message
			if (message.blacklist) {
				if (Math.abs(message.blacklist.length - blacklist.length) == 1) {
					blacklist = message.blacklist;
				} else {
					blacklist.push(...message.blacklist);
					blacklist = _.uniq(blacklist);
				}
				synchronizeBlacklist();
			}
			if (message.bought) {
				server.transactionHistory[message.sym] = message;
				server.transactionLog.push(message);
			}
			if (message.sold) {
				delete server.transactionHistory[message.sym];
				server.transactionLog.push(message);
			}
			if (message.connect) {
				let transaction = server.transactionHistory[Object.keys(_.pickBy(server.transactionHistory, (value, key) => value && _.isEqual(value.args, message.args) && value.reconnected === false)).pop()];
				if (transaction) {
					transaction.id = message.id;
					console.log(colorText("green", `Client has reconnected and will continue to sell ${transaction.sym}`));
					server.getWriter().send({transaction: transaction}, server.getClients().filter(o => o.id === message.id).pop());
					transaction.reconnected = true;
				}
			}
		}
	});

	server.transactionHistory = {};
	server.transactionLog = [];
	server.onClientConnection((socket) => {
		server.getWriter().send({historicalPrices: prices, blacklist: blacklist}, socket);
	});

	server.onClientDisconnect((connection) => {
		let sym = Object.keys(_.pickBy(server.transactionHistory, (value, key) => value && value.id == connection.id)).pop();
		let transaction = server.transactionHistory[sym];
		if (transaction) {
			transaction.reconnected = false;
			console.log(colorText("red", `Client has disconnected after buying ${sym}. Reconnect within ${CLIENT_DISCONNECT_SELL_TIMEOUT/ONE_MIN} minutes to avoid server from automatically selling`));
			let p1 = sleep(CLIENT_DISCONNECT_SELL_TIMEOUT);
			let p2 = new Promise(async resolve => {
				while (!server.transactionHistory[sym] || !server.transactionHistory[sym].reconnected) {
					await sleep(ONE_SEC);
				}
				resolve();
			});
			Promise.race([p1, p2]).then(() => {
				transaction = server.transactionHistory[sym];
				if (transaction && !transaction.reconnected) {
					console.log(colorText("red", `Client has not reconnected, selling ${transaction.quantity} ${sym} at market price`));
					ndump(transaction.take_profit, transaction.buy_price, transaction.stop_loss, transaction.quantity, true, transaction.sym);
					delete server.transactionHistory[sym];
					//TODO: push market sell object to transaction history
				}
			});
		}
	});

	server.start();
	await getExchangeInfo();
	await prepopulate30mData();
}

async function initClient() {
	client = SocketModel.createClient( { socketFile: SOCKETFILE, sendWelcomeMessage: true } );
	client.onMessage(async (obj) => {
		if (obj.message) {
			let message = obj.message
			if (message.prices && message.timestamp && message.interval) {
				if (!fetchMarketDataTime || parseInt(message.timestamp) >= fetchMarketDataTime) {
					serverPrices = message.prices;
					price_data_received = true;
				}
			}
			if (message.blacklist) {
				if (!_.isEqual(message.blacklist.sort(), blacklist.sort())) {
					if (!blacklist.includes(coin) && message.blacklist.includes(coin) && auto && !TRANSACTION_COMPLETE) {
						quit_buy = true;
					}
					blacklist = message.blacklist;
					console.log(`Updated Blacklist: ${blacklist}`);
				}
			}
			if (message.historicalPrices) {
				prices = everyNthElement(message.historicalPrices, SYMBOLS_PRICE_CHECK_TIME/DEFAULT_SYMBOL_PRICE_CHECK_TIME);
				prices_data_points_count = prices.length;
			}
			if (message.yourid) {
				client.connectionID = message.yourid;
			}
			if (message.transaction) {
				while (!init_complete) {
					await sleep(ONE_SEC);
				}
				quit_buy = true;
				await sleep(5 * ONE_SEC);
				transaction = message.transaction;
				coinpair = transaction.sym;
				latestPrice = getPricesForCoin(coinpair).pop();
				setCoinFromCoinpair();
				clearQs();
				ndump(transaction.take_profit, transaction.buy_price, transaction.stop_loss, transaction.quantity, false, transaction.sym);
			}
		}
	});
	client.start();
	while (!prices_data_points_count) {
		await sleep(ONE_SEC);
	}
}

///////////////////////////// BEFORE BUY ////////////////////////////////////////

async function waitUntilPrepump() {
	coinpair = "";
	if (futures) {
		RALLY_MAX_DELTA = FUTURES_RALLY_MAX_DELTA;
	}
	UPPER_BB_PCT = PREPUMP_MIN_UPPER_BB_PCT;
	LOWER_BB_PCT = PREPUMP_MIN_LOWER_BB_PCT;

	detection_mode && (console.clear() || console.log("Detection Mode Active"));
	while (true) {
		if (TRANSACTION_COMPLETE) {
			await waitUntilFetchPricesAsync();
			if (server) {
				console.clear();
				console.log(`Server has ${server.getClients().length} clients connected. Current Transactions: ${JSON.stringify(server.transactionHistory, null, 2)}`);
				continue;
			}
			if (!detection_mode && TRANSACTION_COMPLETE) {
				console.clear();
				console.log(`Waiting for pullbacks, Data points: ${prices_data_points_count}`);
				console.log("Your Base currency is " + DEFAULT_BASE_CURRENCY);
				console.log(`Current time is ${new Date(Date.now()).toLocaleTimeString("en-US")}`);
				console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)} from ${purchases.length} purchases`);
				console.log(`Rally Time: ${msToTime(RALLY_TIME * SYMBOLS_PRICE_CHECK_TIME)}, Profit Multiplier: ${colorText("green", PREPUMP_TAKE_PROFIT_MULTIPLIER)}, Rally Stop Loss Multiplier: ${colorText("red", PREPUMP_STOP_LOSS_MULTIPLIER)}`);
				last_purchase_obj = purchases.slice(-1).pop();
				recent_purchases = purchases.slice(-(process.stdout.rows - 7)/(last_purchase_obj ? (Object.keys(last_purchase_obj).length + 2) : 1));
				console.log(`Last ${recent_purchases.length} Purchases: ${JSON.stringify(recent_purchases, null, 4)}`);
			}
			rally = null;
			if (buy_rallys) {
				rally = await getRally();
			} else if (buy_good_buys) {
				rally = await maybeGetGoodBuys(false);
			} else if (buy_clusters) {
				rally = await maybeGetGoodBuys(true);
			}
			if (rally && Date.now() > dont_buy_before) {
				if (!yolo) {
					// This avoids the race condition if we're waiting to buy anyways
					await sleep(10 * ONE_SEC * Math.random() + 2 * ONE_SEC);
				}
				if (getPricesForCoin(rally.sym).length < PRICES_HISTORY_LENGTH) {
					console.log("not enough data to purchase " + rally.sym);
					continue;
				}
				if (blacklist.includes(getCoin(rally.sym))) {
					continue;
				}
				coinpair = rally.sym;
				setCoinFromCoinpair();
				clearQs();
				blacklist.push(coin);
				synchronizeBlacklist();
				await readCoinInfo();
				beep();
				opportunity_expired_time = Date.now() + OPPORTUNITY_EXPIRE_WINDOW;
				rally_inc_pct = rally.gain - 1;
				TAKE_PROFIT_MULTIPLIER = Math.max(PREPUMP_MIN_PROFIT_MULTIPLIER, Math.min(PREPUMP_MAX_PROFIT_MULTIPLIER, (rally_inc_pct * PREPUMP_TAKE_PROFIT_MULTIPLIER) + 1));
				STOP_LOSS_MULTIPLIER = Math.min(PREPUMP_MAX_LOSS_MULTIPLIER, Math.max(PREPUMP_MIN_LOSS_MULTIPLIER, 1/((rally_inc_pct * PREPUMP_STOP_LOSS_MULTIPLIER) + 1)));
				latestPrice = rally.last;
				pump();
			}
		} else {
			await sleep(10 * ONE_SEC);
		}
	}
}

//TODO: Better code pathing once cluster code is finalized
async function maybeGetGoodBuys(clusters = false) {
	if (prices_data_points_count % GOOD_BUY_SEED_MAX == GOOD_BUY_SEED) {
		return await getGoodBuys(clusters);
	}
}

async function getGoodBuys(clusters = false) {
	goodBuys = await scanForGoodBuys(clusters);
	if (detection_mode) {
		console.clear();
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

async function scanForGoodBuys(clusters = false) {
	let goodCoins = [];
	let promises = Object.keys(coinsInfo).map(async k => {
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
			// This is to prevent spamming and getting a HTTP/427 Not sure how to batch requests without using websockets
			await sleep(Math.random() * 10 * ONE_SEC);
			goodCoin = clusters ? await isAGoodBuyFrom1hGraphForClusters(k) : await isAGoodBuyFrom1hGraph(k);
			if (goodCoin) {
				goodCoins.push(goodCoin);
			}
		}
	});
	await Promise.raceAll(promises, 15 * ONE_SEC);
	return goodCoins.sort((a, b) => a.volume - b.volume);
}

async function isAGoodBuyFrom1hGraphForClusters(sym) {
	let [ticker, closes, opens, gains, highs, lows, volumes, totalVolume] = await fetchCandlestickGraph(sym, "1h", 48);
	if (!ticker.length) {
		return false; 
	}
	let last30mins = getPricesForCoin(sym);
	let last = last30mins.slice(-1).pop();
	let resHigh = skmeans(highs, NUMBER_OF_CLUSTERS, null, NUMBER_OF_CLUSTER_ITERATIONS);
	let resLow = skmeans(lows, NUMBER_OF_CLUSTERS, null, NUMBER_OF_CLUSTER_ITERATIONS);
	let sortedHigh = Array.from(Array(NUMBER_OF_CLUSTERS).keys()).sort((a, b) => resHigh.centroids[a] - resHigh.centroids[b]);
	let sortedLow = Array.from(Array(NUMBER_OF_CLUSTERS).keys()).sort((a, b) => resLow.centroids[a] - resLow.centroids[b]);
	resHigh.idxs = resHigh.idxs.map(i => sortedHigh.indexOf(i));
	resLow.idxs =  resLow.idxs.map(i => sortedLow.indexOf(i));
	//let currentHighCluster = sortedHigh.indexOf(resHigh.test(last).idx)
	let previousLowClusters = resLow.idxs.slice(-6);
	let currentLowCluster = sortedLow.indexOf(resLow.test(Math.min(...last30mins)).idx);
	//let isFreefall = resLow.idxs.slice(-24, -8).filter(x => x <= Math.max(0, CLUSTER_SUPPORT_BUY_LEVEL - 1)).length <= 1;
	let isBuyableClusterSupport = (currentLowCluster >= CLUSTER_SUPPORT_BUY_LEVEL) && (previousLowClusters.filter(x => x < CLUSTER_SUPPORT_BUY_LEVEL).length == previousLowClusters.length); //TODO: Validate
	//let gain = Math.min(...highs.map((v, k) => resHigh.idxs[k] == currentHighCluster + CLUSTER_RESISTANCE_SELL_LEVEL_INC ? v : Infinity))/last;
	let gain =  Math.abs(Math.min(...lows.slice(-10))/last - 1) * 2 + 1.01;
	let gainInTargetRange = gain >= GOOD_BUY_MIN_GAIN && gain <= GOOD_BUY_MAX_GAIN;
	let reachesMin24hVolume = totalVolume > (DEFAULT_BASE_CURRENCY == "USDT" ? MIN_24H_USDT * 2 : MIN_24H_BTC * 2);
	if (isBuyableClusterSupport && gainInTargetRange && reachesMin24hVolume) {
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

async function pump(sym = coinpair) {
	console.log("Buying " + coinpair);
	beginTransaction(sym);
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
		endTransaction(sym);
		removeFromBlacklistLater(coin);
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
	override = DEFAULT_BASE_CURRENCY == "USDT" ? MAX_OVERRIDE_USDT : MAX_OVERRIDE_BTC
	let quantity = ((override > 0 ? override : PCT_BUY * getBalance(DEFAULT_BASE_CURRENCY)) / latestPrice).toFixed(4);
	quantity = quantity - quantity % coinInfo.stepSize
	quantity = parseFloat(quantity.toPrecision(4));
	console.log(`Buying ${quantity} ${coin}`);
	binance.marketBuy(coinpair, quantity, async (error, response) => {
		if (error) {
			console.log(`PUMP ERROR: ${error.body}`);
			process.exit(1);
		}
		beep();
		console.log("Buy is successful")
		console.info("Market Buy response", response);
		console.info("order id: " + response.orderId);
		BUY_TS = 0;
		buy_price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		lastBuy = buy_price * response.executedQty;
		actualquantity = response.executedQty;
		take_profit = (buy_price * TAKE_PROFIT_MULTIPLIER).toPrecision(4);
		stop_loss = (buy_price * STOP_LOSS_MULTIPLIER).toPrecision(4);
		if (client) {
			client.send({id: client.connectionID, bought: true, ts: new Date(Date.now()), sym: coinpair, quantity: actualquantity, buy_price: buy_price, take_profit: take_profit, stop_loss: stop_loss, args: process.argv});
		}
		ndump(take_profit, buy_price, stop_loss, actualquantity);
	});
}

async function waitUntilTimeToBuy() {
	ready = false;
	previousTrend = "None"
	buy_indicator_reached = false;
	buy_indicator_almost_reached = false;
	buy_indicator_check_time = 0;
	buy_indicator_buffer_add = BUFFER_ADD;
	buy_indicator_buffer = buy_indicator_buffer_add;
	starting_price = 0;
	while (true) {
		var [mean, stdev] = await tick(true);
		console.clear();
		if (manual_buy) {
			return latestPrice;
		}
		if (quit_buy) {
			return 0;
		}
		if (!starting_price) {
			starting_price = latestPrice;
		}
		meanTrend = isDowntrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO"): colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText("green", latestPrice)}, Following BTC: ${follows_btc}, ${prepump ? `Opportunity Expires: ${colorText(buy_indicator_reached ? "green" : "red", msToTime(opportunity_expired_time - Date.now()))}, ` : ""}BBHigh: ${colorText("red", highstd.slice(-1).pop().toPrecision(4))}, BBLow: ${colorText("green", lowstd.slice(-1).pop().toPrecision(4))}, Buy Window: ${buy_indicator_almost_reached ? colorText( buy_indicator_reached ? "green" : "yellow", msToTime(buy_indicator_check_time - Date.now())) : colorText("red", "N/A")}${(!ready && auto) ? colorText("red", " GATHERING DATA") : ""}`);
		if (Date.now() > dont_buy_before && auto) {
			switch (BUY_SELL_STRATEGY) {
				case 7:
					if ((!prices_data_points_count && lookback.length < QUEUE_SIZE) || prices_data_points_count * SYMBOLS_PRICE_CHECK_TIME / ONE_SEC < QUEUE_SIZE) {
						break;
					}
					if (prepump && (Date.now() > opportunity_expired_time || latestPrice < starting_price * PRICE_DROP_NEW_OPPORTUNITY_MULTIPLER)) {
						return 0;
					}
					lastLowstd =  lowstd.slice(-1).pop();
					ready = true;
					if (!buy_indicator_reached && !buy_indicator_almost_reached && latestPrice < lastLowstd) {
						buy_indicator_almost_reached = true;
						buy_indicator_check_time = Date.now() + BUY_INDICATOR_INC + buy_indicator_buffer;
						if (buy_indicator_buffer) {
							buy_indicator_buffer_add = Math.max(0, buy_indicator_buffer_add - BUFFER_SUBTRACT) ;
						}
						buy_indicator_buffer = 0;
					}
					if (!buy_indicator_reached && !buy_indicator_almost_reached && latestPrice > mean) {
						buy_indicator_buffer = buy_indicator_buffer_add;
					}
					if (buy_indicator_almost_reached && !buy_indicator_reached && Date.now() > buy_indicator_check_time) {
						if (latestPrice > lastLowstd && latestPrice <= mean ) {
							buy_indicator_reached = true;
							buy_indicator_check_time = Date.now() + BUY_INDICATOR_INC;
						} else {
							buy_indicator_almost_reached = false;
						}
					}
					if (buy_indicator_reached && Date.now() > buy_indicator_check_time) {
						if (latestPrice > lastLowstd && latestPrice <= mean ) {
							return latestPrice;
						}
						buy_indicator_reached = false;
						buy_indicator_almost_reached = false;
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

//////////////////////////////////////////// SELL ///////////////////////////////////////////////

async function ndump(take_profit, buy_price, stop_loss, quantity, immediately = false, sym = coinpair) {
	beginTransaction(sym);
	if (!immediately) {
		lastSellLocalMax = 0;
		buy_time = Date.now();
		manual_sell = false;
		latestPrice = await waitUntilTimeToSell(parseFloat(take_profit), parseFloat(stop_loss), parseFloat(buy_price));
		manual_sell = false;
		console.log((latestPrice > take_profit || Math.abs(1-take_profit/latestPrice) < 0.005) ? "taking profit" : "stopping loss");
	}
	binance.marketSell(sym, quantity, (error, response) => {
		if (error) {
			console.log(`MARKET DUMP ERROR: ${error.body}`);
			console.log("Market sell error, please sell on Binance.com manually");
			return;
		}
		endTransaction(sym);
		
		sell_price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty;
		if (client) {
			client.send({id: client.connectionID, sold: true, ts: new Date(Date.now()), sym: sym, sell_price: sell_price, quantity: quantity, args: process.argv});
		}
		if (server && immediately) {
			server.transactionLog.push({id: "server market sell", sold: true, ts: new Date(Date.now()), sym: sym, sell_price: sell_price, quantity: quantity})
			return;
		}
		console.log("Sell is successful");
		console.log("Last sell is because " + lastSellReason);
		console.info("Market sell response", response);
		console.info("order id: " + response.orderId);
		SELL_TS = 0;
		lastBuy = buy_price * response.executedQty;
		lastSell = sell_price * response.executedQty;
		pnl += lastSell - lastBuy;
		pnl = Math.round(pnl*10000000)/10000000;
		if (LOOP) {
			beep();
			purchase = {
				sym: sym,
				buy: lastBuy,
				buyPrice: buy_price,
				buy_time: new Date(buy_time).toLocaleTimeString("en-US"),
				sell: lastSell,
				sellPrice: sell_price,
				sell_time: new Date(Date.now()).toLocaleTimeString("en-US"),
				maxPrice: lastSellLocalMax,
				sellReason: lastSellReason,
				gain: sell_price/buy_price
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
			pump();
			return;
		}
		console.log("Sell complete, exiting");
		process.exit(0);
	});
	return;
}

async function waitUntilTimeToSell(take_profit, stop_loss, buy_price) {
	start = Date.now();
	previousTrend = "None";
	timeBeforeSale = Date.now() + ONE_MIN;
	sell_indicator_reached = false;
	sell_indicator_almost_reached = false;
	sell_indicator_check_time = 0;
	sell_indicator_increment = SELL_INDICATOR_INC_BASE;
	ride_profits = false;
	take_profit_hit_check_time = 0;
	fetch_15m_candlestick_time = 0;
	mean15 = 0;
	while (!auto || (latestPrice >= stop_loss && latestPrice <= take_profit) || ride_profits) {
		var [mean, stdev] = await tick(false);
		console.clear();
		if (manual_sell) {
			lastSellReason = "manually sold";
			return latestPrice;
		}
		lastSellLocalMax = Math.max(latestPrice, lastSellLocalMax);
		meanTrend = isDowntrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO") : colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText(latestPrice > buy_price ? "green" : "red", latestPrice)} Profit: ${colorText("green", take_profit + " (" + ((take_profit/buy_price - 1) * 100).toFixed(3) + "%)")}, Buy: ${colorText("yellow", buy_price.toPrecision(4))} Stop Loss: ${colorText("red", stop_loss + " (" + ((1-stop_loss/buy_price) * -100).toFixed(3) + "%)")} Sell Window: ${sell_indicator_almost_reached ? colorText(sell_indicator_reached ? "green" : "yellow", msToTime(sell_indicator_check_time - Date.now())) : colorText("red", "N/A")}`);
		if (auto && Date.now() > timeBeforeSale) {
			switch (BUY_SELL_STRATEGY) {
				case 7:
					if (latestPrice >= take_profit && !ride_profits && SELL_RIDE_PROFITS) {
						ride_profits = true;
						take_profit_hit_check_time = Date.now() + 2 * ONE_MIN;
					}
					if (ride_profits && Date.now() > take_profit_hit_check_time) {
						if (latestPrice < (take_profit * SELL_RIDE_PROFITS_PCT)) {
							lastSellReason = "sold because take profit is reached";
							return latestPrice;
						}
					}
					if (new Date(Date.now()).getMinutes() % 15 == 14 && Date.now() > fetch_15m_candlestick_time + ONE_MIN) {
						fetch_15m_candlestick_time = Date.now();
						fetchCandlestickGraph(coinpair, "15m", 20, true).then(([ticker]) => mean15 = average(ticker));
					}
					if (ride_profits && latestPrice < mean15) {
						lastSellReason = "sold because it dropped below mean15 after hitting take profit";
						return latestPrice;
					}
					// if (ride_profits && latestPrice > take_profit) {
					// 	if (!sell_indicator_reached && !sell_indicator_almost_reached && latestPrice > mean) {
					// 		sell_indicator_almost_reached = true;
					// 		sell_indicator_check_time = Date.now() + BUY_INDICATOR_INC; // This is intentional. Srry for naming confusion
					// 	}
					// 	if (!sell_indicator_reached && sell_indicator_almost_reached && Date.now() > sell_indicator_check_time) {
					// 		if (latestPrice < mean) {
					// 			sell_indicator_reached = true;
					// 			sell_indicator_check_time = Date.now() + sell_indicator_increment;
					// 			sell_indicator_increment *= SELL_INDICATOR_INC_MULTIPLIER;
					// 		} else {
					// 			sell_indicator_almost_reached = false;
					// 		}
					// 	}
					// 	if (sell_indicator_reached && Date.now() > sell_indicator_check_time) {
					// 		if (latestPrice < mean) {
					// 			return latestPrice;
					// 		}
					// 		sell_indicator_almost_reached = false;
					// 		sell_indicator_reached = false;
					// 	}
					// }
					break;
				default:
					break;
			}
		}
		if (SHOW_GRAPH) {
			plot(false);
		}
		previousTrend = (meanTrend.includes("Up") || meanTrend.includes("Down")) ? meanTrend : previousTrend;
	}
	lastSellReason = "Sold because stop loss was hit";
	return latestPrice
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

function clearQs() {
	lookback = [];
	q = [];
	means = [];
	lowstd = [];
	highstd = [];
	mabuy = [];
	masell = [];
}

async function tick(buying) {
	if ((client || server) && !fetching_prices_from_graph_mode) {
		fetching_prices_from_graph_mode = true;
		fetchAllPricesAsyncIfReady().catch().finally(() => { 
			symbolFollowsBTCUSDT(coinpair);
			fetching_prices_from_graph_mode = false;
		});
	}
	while (!websocketTicker.bestAsk) {
		await sleep(POLL_INTERVAL);
	}
	await sleep(POLL_INTERVAL);
	bidask = {askPrice: websocketTicker.bestAsk, bidPrice: websocketTicker.bestBid};
	latestPrice = buying ? parseFloat(bidask.askPrice) : parseFloat(bidask.bidPrice);
	initializeQs();
	pushToLookback(latestPrice);
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
	return q2.slice(0, q2.length-1).filter(v => v > q2[q2.length-1]).length <= buffer
		&& q2.slice(1-q2.length).filter(v => v < q2[0]).length <= buffer * (kinda ? 3 : 1);
}

function isDowntrend(q2, buffer = 0, kinda = true, stdev = 0) {
	return q2.slice(0, q2.length-1).filter(v => v < q2[q2.length-1]).length <= buffer
		&& q2.slice(1-q2.length).filter(v => v > q2[0]).length <= buffer * (kinda ? 3 : 1);
}

function symbolFollowsBTCUSDT(sym) {
	if (q.length < 30) {
		return false;
	}
	btcHistorical = getPricesForCoin("BTCUSDT");
	lastBTC = btcHistorical.slice(-3);
	last_btc_q_index = q.length - 1 - Math.floor(2 * SYMBOLS_PRICE_CHECK_TIME/ONE_SEC);
	if ((q[last_btc_q_index] < q[q.length-1] && lastBTC[0] < lastBTC[lastBTC.length-1]) || (q[last_btc_q_index] > q[q.length-1] && lastBTC[0] > lastBTC[lastBTC.length-1])) {
		follows_btc_history.push(1);
	} else {
		follows_btc_history.push(0);
	}
	follows_btc_history.shift();
	follows_btc = average(follows_btc_history) >= 0.7;
	return follows_btc;
}

////////////////////// BALANCE AND BLACKLISTS AND EXCHANGE STUFF //////////////////////////////////////
function beginTransaction(sym) {
	TRANSACTION_COMPLETE = false;
	initializeTickerWebsocket(sym);
}

function endTransaction(sym) {
	terminateTickerWebsocket(sym);
	clearQs();
	sleep(ONE_MIN).then(() => TRANSACTION_COMPLETE = true);
}

async function initializeTickerWebsocket(sym) {
	let endpoint = sym.toLowerCase() + "@bookTicker";
	if (!Object.keys(binance.websockets.subscriptions()).includes(endpoint)) {
		binance.websockets.bookTickers(sym, (ticker) => websocketTicker = ticker);
	}
}

function terminateTickerWebsocket(sym) {
	let endpoint = sym.toLowerCase() + "@bookTicker";
	if (Object.keys(binance.websockets.subscriptions()).includes(endpoint)) {
		binance.websockets.terminate(endpoint);
	}
}

async function fetchCandlestickGraph(sym, interval, segments, force = false, cache = true) {
	let key = sym+"-"+interval+"-"+segments;
	let t = parseInt(interval.substring(0,interval.length-1))
	let i = interval.substring(interval.length-1);
	i = i == "m" ? ONE_MIN : i == "h" ? 60 * ONE_MIN : i == "d" ? 24 * 60 * ONE_MIN : 0;
	if (i == 0) {
		console.log("Invalid Interval");
		return;
	}
	if (!force && candlestickCache[key] && Date.now() - candlestickCache[key].time < t * i) {
		return candlestickCache[key].data;
	}
	let finished = false;
	let ticker = [], closes = [], opens = [], gains = [], highs = [], lows = [], volumes = [], totalVolume = 0;
	binance.candlesticks(sym, interval, (error, ticks, symbol) => {
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
			volumes.push(parseFloat(volume));
			totalVolume += parseFloat(volume) * (open/2 + close/2);
		})
		finished = true;
	}, {limit: segments, endTime: Date.now()});
	while (!finished) {
		await sleep(ONE_SEC)
	}
	if (cache) {
		candlestickCache[key] = {data: [ticker, closes, opens, gains, highs, lows, volumes, totalVolume], time: Date.now()};
	}
	return [ticker, closes, opens, gains, highs, lows, volumes, totalVolume];
} 

async function waitUntilFetchPricesAsync() {
	while(Date.now() < fetchMarketDataTime) {
		await sleep(ONE_SEC);
	}
	if (!client) {
		await fetchAllPricesAsync();
	} else {
		while (!price_data_received) {
			await sleep(ONE_SEC);
		}
		price_data_received = false;
	}
	if (server) {
		server.broadcast({prices: serverPrices, timestamp: Date.now(), interval: SYMBOLS_PRICE_CHECK_TIME});
	}
	parseServerPrices();
	++prices_data_points_count;
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

function getPricesForCoin(sym, timeframe = PRICES_HISTORY_LENGTH) {
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
		try {
			binance.bookTickers((error, ticker) => {
				if (error) {
					while (++fail_counter >= 100) {
						console.log("TOO MANY FAILS GETTING PRICES");
						process.exit(1);
					}
					reject(error);
					return;
				}
				fail_counter = 0;
				serverPrices = ticker;
				resolve();
			});
		} catch (e) {
			while (++fail_counter >= 100) {
				console.log("TOO MANY FAILS GETTING PRICES");
				process.exit(1);
			}
			reject(e);
			return;
		}
	});
}

// TODO: DEPRECATE THIS
async function getLatestPriceAsync(coinpair) {
	try {
		let ticker = await binance.prices(coinpair);
		fail_counter = 0;
		return ticker[coinpair];
	} catch (e) {
		console.log("Failure getting latest price", e);
		if (++fail_counter >= 100) {
			console.log(`Too many fails fetching price of ${coinpair}, exiting`);
			process.exit(1);
		}
		await sleep(ONE_SEC);
		return await getLatestPriceAsync(coinpair);
	}
}

// this never resolves
async function loopGetBalance() {
	return new Promise(async (resolve) => {
		while (true) {
			await sleep(Math.max(ONE_MIN, fetch_balance_time - Date.now()));
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
		console.log("Need to fetch exchangeInfo");
		process.exit(1);
	}
	let newPrices = {};
	let promises = Object.keys(coinsInfo).map(async k => {
		return new Promise(async (resolve) => {
			if (coinsInfo[k].status != "TRADING") {
				resolve();
				return;
			}
			await(Math.random() * 10 * ONE_SEC);
			if (k.endsWith("USDT") || k.endsWith("BTC")) {
				let [ticks] = await fetchCandlestickGraph(k, "1m", 30, true, false);
				newPrices[k] = ticks;
			}
		});
	});
	await Promise.raceAll(promises, 15 * ONE_SEC);
	newPricesArray = [];
	for (i = 0; i < 30; i++) {
		newPrices10s = {};
		Object.keys(newPrices).forEach(k => {
			newPrices10s[k] = newPrices[k][i];
		});
		newPricesArray.push(...(Array(6).fill(newPrices10s)));
	}
	prices = newPricesArray.concat(prices).slice(-PRICES_HISTORY_LENGTH);
	prices_data_points_count = prices.length;
	if (server) {
		server.broadcast({historicalPrices: prices, blacklist: blacklist});
	}
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
	}, REMOVE_FROM_BLACKLIST_TIMER);
}

function synchronizeBlacklist() {
	if (server) {
		server.broadcast({blacklist: blacklist});
	}
	if (client) {
		client.send({id: client.connectionID, blacklist: blacklist});
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

function setCoinFromCoinpair() {
	coin = getCoin(coinpair);
}

async function readCoinInfo() {
	return new Promise(async (resolve) => {
		if (coinsInfo) {
			coinInfo = coinsInfo[coinpair];
			resolve();
			return;
		}
		fs.readFile("minimums.json", async (err, data) => {
			if (err) {
				if (++fail_counter >= 100) {
					console.log("Too many failures getting coin info");
					process.exit(1);
				}
				await getExchangeInfo();
				await readCoinInfo();
				resolve();
				return;
			}
			coinsInfo = JSON.parse(data);
			coinInfo = coinsInfo[coinpair];
			if (coinInfo != null) {
				console.log(coinInfo);
			}
		});
		while (!coinsInfo) {
			await sleep(ONE_SEC);
		}
		fail_counter = 0;
		resolve();
	}); 
}

async function getExchangeInfo() {
	finished = false;
	binance.exchangeInfo(async (error, data) => {
		let minimums = {};
		if (error) {
			console.log("Error fetching exchange Info");
			process.exit(1);
		}
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
			filters.orderTypes = obj.orderTypes;
			filters.icebergAllowed = obj.icebergAllowed;
			minimums[obj.symbol] = filters;
		}
		fs.writeFile("minimums.json", JSON.stringify(minimums, null, 4), async (err) => {
			await readCoinInfo();
			finished = true;
		});
	});
	while (!finished) {
		await sleep(ONE_SEC);
	}
}

function writeTransactionLogFileAndExit() {
	logFile = "logs/log_" + Date.now() + ".csv";
	buySellPair = [];
	buys = [];
	server.transactionLog.forEach((item) => {
		if (item.bought) {
			buys.push(item);
			return;
		}
		if (item.sold) {
			buy = buys.filter(i => i.sym === item.sym && i.quantity === item.quantity).pop();
			if (!buy) {
				return;
			}
			buys = buys.filter(i => i.sym !== item.sym || i.quantity !== item.quantity);
			buySellPair.push({
				sym: item.sym,
				time_bought: buy.ts,
				buy_price: buy.buy_price,
				quantity: item.quantity,
				take_profit: buy.take_profit,
				stop_loss: buy.stop_loss, 
				time_sold: item.ts,
				sell_price: item.sell_price,
				gain: parseFloat(item.sell_price)/parseFloat(buy.buy_price),
				link: "https://www.binance.com/en/trade/" + item.sym,
				args: "\"" + buy.args + "\"",
			});
		}
	});
	if (!buySellPair.length) {
		console.log(`No transactions have taken place`);
		process.exit(0);
	}
	str = Object.keys(buySellPair[0]).join(",");
	buySellPair.forEach(row => str += "\n" + Object.values(row).join(","));
	fs.writeFile(logFile, str, async (err) => {
		console.log(`Transaction log of all clients written to ${logFile}`);
		process.exit(0);
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
		asciichart.plot(points, {
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
		})
	);
}

////////////////////////////////////////////////////////DEPRECATED/////////////////////////////////////////////////////

async function getRally() {
	rallies = await detectCoinRallies();
	if (detection_mode) {
		console.clear();
		console.log("Detection Mode Active");
		console.log(`Current time is ${new Date(Date.now()).toLocaleTimeString("en-US")}`);
		console.log(`Blacklist: ${blacklist}`);
		rallies && rallies.length && console.log(`Rallies: ${JSON.stringify(rallies.filter(v => v.goodBuy), null, 4)}`);
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
		historical_vals = getPricesForCoin(sym).slice(0, -RALLY_TIME);
		recent_historical_vals = historical_vals.slice(-2.5 * RALLY_TIME, -RALLY_TIME);
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
			&& max_historical/min_historical > gain) {
			rallies.push({
				sym: sym,
				min: min,
				max: max,
				gain: gain,
				first: first,
				last: last,
				goodBuy: await isAGoodBuyFrom1hGraphForRally(sym),
			});
		} else if (test_count > 6 && detection_mode) {
			rallies.push({sym: sym, first: first, last: last, goodBuy: await isAGoodBuyFrom1hGraphForRally(sym), gain: gain, fail: fail_reasons});
		}
	}
	return rallies.sort((a, b) => a.gain - b.gain);
}

async function isAGoodBuyFrom1hGraphForRally(sym) {
	let [ticker, closes, opens, gains, highs, lows, volumes, totalVolume] = await fetchCandlestickGraph(sym, "1h", 48);
	if (!ticker.length) {
		return false;
	}
	let mean = average(ticker);
	let std = getStandardDeviation(ticker);
	let increasingCloses = isUptrend(closes.slice(-4), 0, false);
	let opensBelowMeanPlusStdev = (opens.slice(-4).filter(v => v > (mean + std)).length == 0);
	let last3VolumesGreaterThanPrevious3Volumes = volumes.slice(-3).reduce((sum, val) => sum + val, 0) > volumes.slice(-6, -3).reduce((sum, val) => sum + val, 0);
	if (increasingCloses && opensBelowMeanPlusStdev && last3VolumesGreaterThanPrevious3Volumes) {
		return true;
	}
	return false;
}

async function isAGoodBuyFrom1hGraph(sym) {
	let [ticker, closes, opens, gains, highs, lows, volumes, totalVolume] = await fetchCandlestickGraph(sym, "1h", 48);
	if (!ticker.length) {
		return false;
	}
	let mean = average(ticker.slice(-21));
	let std = getStandardDeviation(ticker.slice(-21));
	let last3gains = gains.slice(-3);
	let last = getPricesForCoin(sym, 1).pop();
	let gain = Math.min(last3gains.reduce((sum, val) => sum + Math.abs(1-val), 1.01), Math.max(...closes.slice(-21)) * 0.99 / last);
	let opensBelowMean = (opens.slice(-3).filter(v => v > (mean)).length == 0);
	let lastWickIsShorterThanBody = (closes.slice(-1).shift() - opens.slice(-1).shift()) > (highs.slice(-1).shift() - closes.slice(-1).shift());
	let increasingCloses = isUptrend(closes.slice(-3), 0, false);
	let startOfRally = !isUptrend(opens.slice(-4), 0, false);
	let gainInTargetRange = gain >= GOOD_BUY_MIN_GAIN && gain <= GOOD_BUY_MAX_GAIN;
	let reachesMin24hVolume = totalVolume > (DEFAULT_BASE_CURRENCY == "USDT" ? MIN_24H_USDT * 2 : MIN_24H_BTC * 2);
	let thirdGainLessThanPrevious2Combined = Math.abs(1-last3gains[0]) < Math.abs(1-last3gains[1]) + Math.abs(1-last3gains[2]);
	let last2VolumesGreaterThanPrevious2Volumes = volumes.slice(-2).reduce((sum, val) => sum + val, 0) > 1.5 * volumes.slice(-5, -3).reduce((sum, val) => sum + val, 0);
	let lastWickGreaterThanSecondLastWick = highs.slice(-1).shift() > highs.slice(-2).shift();
	if (opensBelowMean && increasingCloses && startOfRally && gainInTargetRange && reachesMin24hVolume && thirdGainLessThanPrevious2Combined && last2VolumesGreaterThanPrevious2Volumes && lastWickIsShorterThanBody && lastWickGreaterThanSecondLastWick) {
		return {
			sym: sym,
			gain: gain,
			last: last,
			volume: totalVolume,
		};
	}
	return false;
}

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

function analyzeDecisionForPrepump(sym, rally_inc_pct, purchase, old_profit_multiplier) {
	if (!purchase || !purchase.sym ||  !purchase.sym == sym) {
		return;
	}
	return new Promise((_) => {
		// Currently this does nothing
		setTimeout(() => {
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
	});
}


async function getBidAsk(coinpair) {
	try {
		bidask = await binance.bookTickers(coinpair);
		fail_counter = 0;
		return bidask
	} catch (e) {
		console.log("Failure getting bid ask", e);
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
		console.log("Failure getting market depth", e);
		if (++fail_counter >= 100) {
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


/////////////////////////////// MISC /////////////////////////////////////////////////
Promise.raceAll = function(promises, timeoutTime) {
    return Promise.all(promises.map(p => Promise.race([p, sleep(timeoutTime)])));
}

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

async function testAndQuit() {
	process.exit(0);
}

init();
