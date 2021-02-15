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
	a = await binance.bookTickers('BNBBTC');
	console.log(a.askPrice);
}



function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

init();