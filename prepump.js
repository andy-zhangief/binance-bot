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

const BUY_LIMIT = 0.001;
const FAIL_EXIT = 100;
const CHECK_TIME = 60 * 1000;
const ANOMOLY_PCT = 1.015;

failures = 0;
priceFetch = false;
prices = {};
serverPrices = [];

async function init() {
	waitUntilPrepump();
}

async function waitUntilPrepump() {
	while (true) {
		priceFetch = true;
		await getAllPrices();
		while (priceFetch) {
			await sleep(100);
		}
		anomolies = parseServerPrices();
		maxAnomoly = "";
		maxPct = 0;
		anomolies.forEach(([k,v]) => {
			console.log(k,v)
			if (v > maxPct) {
				maxPct = v;
				maxAnomoly = k;
			}
		})
		console.log(`Coin: ${maxAnomoly}, increase: ${maxPct}`);
		await sleep(CHECK_TIME)
	}
}

function parseServerPrices() {
	anomolies = [];
	serverPrices.forEach(v => {
		if (!v.symbol.endsWith("BTC")) {
			return;
		}
		if (prices[v.symbol] == null) {
			prices[v.symbol] = v.askPrice;
		} else {
			previousPrice = prices[v.symbol];
			prices[v.symbol] = v.askPrice;
			pctGain = v.askPrice/previousPrice;
			if (pctGain > ANOMOLY_PCT) {
				anomolies.push([v.symbol, pctGain]);
			}
		}
	});
	return anomolies;
}

async function getAllPrices() {
	binance.bookTickers((error, ticker) => {
		if (error) {
			while (++failures >= FAIL_EXIT) {
				console.log("TOO MANY FAILS GETTING PRICES");
				process.exit(1);
			}
			return;
		}
		failures = 0;
		priceFetch = false;
		serverPrices = ticker;
	});
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

init();