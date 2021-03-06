const App = {
	// var
	web3: null,
	account: 0x0,
	tokenPrice: 0,
	totalTokens: 0,
	canPurchase: false,
	contracts: {
		Token	 : null,
		TokenSale: null
	},


	// constructor
	init: async function ()
	{
		await this.init_WEB_3()
		if (this.account === undefined) {
			this.request_WALLET()
			return
		}
		await this.init_CONTRACT()
		await this.render()
		this.subscribe_EVENTS()
	},


	// subscribe to contract events
	subscribe_EVENTS: function ()
	{
		// subscribe for sell event
		this.contracts.TokenSale.events
			.Sell({})
			.on('data', async (event) => { this.render() })
	},


	// get web3 provider
	init_WEB_3: async function ()
	{
		const _provider = (typeof web3 !== 'undefined')
			? window.ethereum
			: new Web3.providers.HttpProvider('http://localhost:7545')

		this.web3 = await new Web3(_provider);

		[this.account] = await this.web3.eth.getAccounts()

		// request metamask to plug on some accounts
		if (this.account === undefined)
			this.web3.eth.requestAccounts()

		// conversion functions
		const that = this

		const hex_f = function( ) { return that.web3.utils.toHex(this.valueOf()) }
		const wei_f = function(u) { return that.web3.utils.toWei(this.valueOf().toString(), u) }
		const eth_f = function(u) { return that.web3.utils.fromWei(this.valueOf().toString(), u) }
		const poi_f = function( ) { return this.valueOf().toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1.") }

		Number.prototype.toETH = eth_f; String.prototype.toETH = eth_f
		Number.prototype.toWEI = wei_f;	String.prototype.toWEI = wei_f
		Number.prototype.toHEX = hex_f;	String.prototype.toHEX = hex_f
		Number.prototype.toPOI = poi_f;	String.prototype.toPOI = poi_f
	},


	// create contract instance
	init_CONTRACT: async function ()
	{
		this.contracts.Token = await this.read_CONTRACT('Token.json')
		this.contracts.TokenSale = await this.read_CONTRACT('TokenSale.json')
	},

	read_CONTRACT: async function (file)
	{
		const { abi: _abi, networks: _networks } = await this.getJSON(file)
		const _address = _networks[Object.keys(_networks)[0]].address
		return new this.web3.eth.Contract(_abi, _address)
	},


	// request wallet if it is not connected to website
	request_WALLET: function ()
	{
		this.id('.main-content').empty()
		this.id('.main-notice').html('Please require your ETH wallet and then reload the page')
	},


	// render the page
	render: async function ()
	{
		// var
		//await this.contracts.Token.methods.transfer(this.contracts.TokenSale.options.address, 750000).send({ from: this.account })

		const [_tokenBalance] = await this.handle(this.contracts.Token.methods.balanceOf(this.account).call())

		const _TokenSellAddress = this.contracts.TokenSale.options.address
		const [_price] 		= await this.handle(this.contracts.TokenSale.methods.token_Price().call())
		const [_soldTokens] = await this.handle(this.contracts.TokenSale.methods.token_Sold().call())
		const [_leftTokens] = await this.handle(this.contracts.Token.methods.balanceOf(_TokenSellAddress).call())
		const _totalTokens  = +_leftTokens + +_soldTokens

		// we need to transfer initial tokens to TokenSale contract
		if (_totalTokens === 0) {
			await this.contracts.Token.methods
				.transfer(this.contracts.TokenSale.options.address, 7500)
				.send({ from: this.account })

			this.render()
		}


		// since we've got token price and amount here - save it for future purchasing
		this.tokenPrice  = _price
		this.totalTokens = _totalTokens

		if (_tokenBalance === null) {
			// wallet reqired but not connected to the correct network
			const notice = this.id('.notice')
			notice.html(`<b>NOTICE:</b> Your wallet is not connected to the correct network. Please connect it to <b>HTTP://localhost:7545</b> and reload page`)
			notice.classList.add('error')
		} else {
			// normal page render
			if (_totalTokens === 0) this.toggle_STATE(false, 'tokens sold out')
			else this.toggle_STATE(true, 'purchase tokens')

			this.id('.your-account').html(this.account)

			this.id('.token-price').html(_price.toETH())
			this.id('.token-amount').html(_tokenBalance.toPOI())

			this.id('.token-sold').html(_soldTokens.toPOI())
			this.id('.token-total').html(_totalTokens.toPOI())

			setTimeout(()=> {
				this.id('.sell-meter-fill').css(`width: ${_soldTokens / _totalTokens * 100}%;`)
			}, 500)

			this.id('.button').addEventListener('click', () => { this.purchaseTokens() })
		}

		this.id('.main-content').css('opacity: 1;')
	},


	// purchase tokens
	purchaseTokens: async function ()
	{
		// var
		const _tokensToBuy = this.id('.tokens-to-buy').val()

		// check for reqirenments
		if (this.canPurchase === false) {
			return
		}
		if (_tokensToBuy > this.totalTokens) {

			return
		}
		
		// html animation
		this.toggle_STATE(false, 'purchasing ...')

		// purchase
		await this.contracts.TokenSale.methods
			.buyTokens(_tokensToBuy)
			.send({
				from  : this.account,
				value : _tokensToBuy * this.tokenPrice,
				gas   : 500000
			})
	},
	
	toggle_STATE: function (_canPurchase, _text = null)
	{
		this.canPurchase = _canPurchase

		const button = this.id('.button')
		button.classList[_canPurchase ? 'remove' : 'add']('loading')
		if (_text !== null) button.html(_text)
	},


	// end sales
	end_SALE: function ()
	{
		this.contracts.TokenSale.methods
			.endSale()
			.send({ from: this.account })
	},


	// system functions
	handle: promise =>
	{
		return promise
			.then(data => [data, null])
			.catch(err => [null,  err])
	},

	getJSON: async function (url)
	{
		let response = await fetch(url)
		let data = await response.json()
		return data
	},

	id: function (selector)
	{
		const elem = document.querySelectorAll(selector)

		for (let i = 0; i < elem.length; i++)
		{
			const el = elem[i]

			el.css	  = (s) => { if (s) el.setAttribute('style', s); else el.removeAttribute('style') }
			el.html   = (h) => { el.innerHTML = h }
			el.hide   = ()  => { el.style.display = 'none' }
			el.show   = ()  => { el.style.display = '' }
			el.val 	  = ()  => { return el.value }
			el.empty  = ()  => { while (el.firstChild) el.removeChild(el.firstChild) }
			el.append = (h) => { el.insertAdjacentHTML('beforeend', h); }
		}

		return elem.length === 1 ? elem[0] : elem;
	}
}

// initialize page
document.addEventListener('DOMContentLoaded', () => { App.init() })