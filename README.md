# binance-bot

# Install:

Figure out how to get node working on your computer. On Mac: install homebrew and run `brew install nodejs` and `brew install npm`
On Windows: https://www.youtube.com/watch?v=AuCuHvgOeBY

Download code by clicking code dropdown and selecting Download Zip (or use git clone if you know how to do so). Extract zip to destination folder.

# Use:
Before you run the program, make sure to rename `rename_to_secrets_dot_js.js` to `secrets.js` and add your API key and secret from Binance. To do so, log into binance and go to https://www.binance.com/en/my/settings/api-management and click `Create API`.

Feel free to play around with the constants and variables at the top of `main.js`. Make sure to set `MAX_OVERRIDE_BTC` and `MAX_OVERRIDE_USDT` to numbers you are comfortable with testing. 

You should have BNB in your account (around 1/10 the amount you are trading should be fine) to prevent Binance from docking transaction fees and messing up the algorithm.

It's best to use USDT as the base currency since if a coin is too little, then one satoshi difference could mean fluctuating up to 1.5%, which will mess up the rally detection algorithm.

It is best to run several instances of this bot at once to reduce variance. It has protections to make sure the same coin is not purchased by multiple bots.

To run: `node main prepump [optional price check timeframe in seconds]` e.g `node main prepump` or `node main prepump 20` (free to play around with this value) or `node main [COINPAIR]` e.g `node main BTCUSDT` (NOT RECOMMENDED).

The bot starts in auto mode, which means it will automatically buy and sell when it detects an opportunity. To toggle, press `a`. To manually buy and sell, press `b` or `s` respectively.

Press `q` to exit the buy graph screen and look for other opportunities. Press `e` to extend the opportunity window for a particular coin.

Run with option `--base=BTC` for BTC. e.g `node main prepump --base=BTC`

Run with option `--detect` to only detect rallying coins.

To run multiple synchronized bots, run one bot with the option `--server` and the others with the option `--client`. They should synchronize prices and blacklists. You can restart any amount of clients and they will receive the historical price data when they start.

![alt text](https://i.imgur.com/L0sbmi7.png)

Feel free to reach out to me on discord and I'd be happy to help you. https://discord.gg/BTh9wuaPxD

If you would like to contribute:

BTC: 3AWjCiHXhQGTC4aFJHnTGhhANhpyxiYdMz

ETH: 0xA57F4C5966F5aBcd26A43AeB16F341B7437Fb587

DOGE: DMzKeW3uQwC9m1hfmhqdkmV5Y6D57q7sn5

