const Token = artifacts.require('Token')

contract('Token', accounts =>
{
	// var
	let contract
	const Await = {
		TotalSupply	: 1000000,
		Name		: 'DAPP Token',
		Symbol		: 'DAPT',
		Standard	: 'DAPP token v 1.0.0'
	}
	const Test = {
		Transfer	: 100,
		Approve		: 100
	}
	const handle = promise => {
		return promise
			.then(data => [data, null])
			.catch(err => [null,  err])
	}

	// at test start
	before(async() => {
		contract = await Token.deployed()
	})

	// tests
	it ('initialize contract with correct values', async () =>
	{
		const name = await contract.name()
		const symbol = await contract.symbol()
		const standard = await contract.standard()
		
		assert.equal(name	 , Await.Name	 , 'sets the correct NAME')
		assert.equal(symbol	 , Await.Symbol	 , 'sets the correct SYMBOL')
		assert.equal(standard, Await.Standard, 'sets the correct STANDARD')
	})

	it ('allocates initial supply upon deployment', async () =>
	{
		const totalSupply = await contract.totalSupply()
		const balanceOf = await contract.balanceOf(accounts[0])
		
		assert.equal(totalSupply.toNumber(), Await.TotalSupply, `total supply = ${Await.TotalSupply}`)
		assert.equal(balanceOf.toNumber(), Await.TotalSupply,`creator balance = ${Await.TotalSupply}`)
	})

	it ('transfers token ownership', async () =>
	{
		// var
		callData = [ accounts[1], Test.Transfer, {from: accounts[0]} ]

		// returned value
		const success = await contract.transfer.call(...callData)
		assert.equal(success, true, `transfer function returns TRUE`)

		// event
		const receipt = await contract.transfer(...callData)

		assert.equal(receipt.logs.length		 , 1			   , `triggers one event`)
		assert.equal(receipt.logs[0].event		 , 'Transfer'	   , `should be the "Transfer" event`)
		assert.equal(receipt.logs[0].args._from  , accounts[0]	   , `account FROM`)
		assert.equal(receipt.logs[0].args._to 	 , accounts[1]	   , `account TO`)
		assert.equal(receipt.logs[0].args._value , Test.Transfer   , `tokens transfered`)

		// balances after transfer
		const balanceOf_0 	 = await contract.balanceOf(accounts[0])
		const balanceOf_1 	 = await contract.balanceOf(accounts[1])
		const afterBalance_0 = Await.TotalSupply - Test.Transfer
		const afterBalance_1 = Test.Transfer

		assert.equal(balanceOf_0.toNumber(), afterBalance_0, `balance subtracted`)
		assert.equal(balanceOf_1.toNumber(), afterBalance_1, `balance added`)

		// test reqires
		const balanceData = [ accounts[1], balanceOf_0 + 1, {from: accounts[0]} ]
		const [, errorBalance] = await handle(contract.transfer(...balanceData))
		assert.notEqual(errorBalance, null, "transaction revert since balance is exceeded")
	})

	it ('approves tokens for delegated transfer', async () =>
	{
		// var
		const callData = [ accounts[1], Test.Approve, {from: accounts[0]} ]

		// returned value
		const success = await contract.approve.call(...callData)
		assert.equal(success, true, `approve function returns TRUE`)

		// event
		const receipt = await contract.approve(...callData)

		assert.equal(receipt.logs.length		  , 1			   , `triggers one event`)
		assert.equal(receipt.logs[0].event		  , 'Approval'	   , `should be the "Approval" event`)
		assert.equal(receipt.logs[0].args._owner  , accounts[0]	   , `account FROM`)
		assert.equal(receipt.logs[0].args._spender, accounts[1]	   , `account TO`)
		assert.equal(receipt.logs[0].args._value  , Test.Approve   , `tokens approved`)

		// allowance 
		const allowance = await contract.allowance(accounts[0], accounts[1])
		assert.equal(allowance.toNumber(), Test.Approve, `allowance appointed`)

		// test reqires
		const balanceOf_0 = await contract.balanceOf(accounts[0])
		const balanceData = [ accounts[1], balanceOf_0 + 1, {from: accounts[0]} ]
		const [, errorBalance] = await handle(contract.approve(...balanceData))
		assert.notEqual(errorBalance, null, "transaction revert since balance is exceeded")
	})

	it ('handles delegatet transfer', async () =>
	{
		// var
		const account_FROM	  	= accounts[0]
		const account_TO	  	= accounts[2]
		const account_SPENDER 	= accounts[1]
		const callData			= [ account_FROM, account_TO, Test.Approve, {from: account_SPENDER} ]

		const wasBalanceOf_FROM	= await contract.balanceOf(account_FROM)

		// returned value
		const success = await contract.transferFrom.call(...callData)
		assert.equal(success, true, `transferFrom function returns TRUE`)

		// event
		const receipt = await contract.transferFrom(...callData)

		assert.equal(receipt.logs.length		 , 1			   , `triggers one event`)
		assert.equal(receipt.logs[0].event		 , 'Transfer'	   , `should be the "Transfer" event`)
		assert.equal(receipt.logs[0].args._from  , account_FROM	   , `account FROM`)
		assert.equal(receipt.logs[0].args._to 	 , account_TO	   , `account TO`)
		assert.equal(receipt.logs[0].args._value , Test.Approve    , `tokens transfered`)

		// allowance
		const allowance = await contract.allowance(account_FROM, account_TO)
		assert.equal(allowance.toNumber(), 0, `allowance spent`)

		// balances after transferFrom
		const balanceOf_FROM 	= await contract.balanceOf(account_FROM)
		const balanceOf_TO 	 	= await contract.balanceOf(account_TO)
		const afterBalance_FROM = wasBalanceOf_FROM - Test.Approve
		const afterBalance_TO 	= Test.Approve

		assert.equal(balanceOf_FROM.toNumber(), afterBalance_FROM, `balance subtracted`)
		assert.equal(balanceOf_TO.toNumber()  , afterBalance_TO  , `balance added`)

		// test reqires
		const balanceData = [account_FROM, account_TO, balanceOf_FROM + 1, {from: account_SPENDER}]
		const [, errorBalance] = await handle(contract.transferFrom(...balanceData))
		assert.notEqual(errorBalance, null, "transaction revert since balance is exceeded")

		const approvedData = [account_FROM, account_TO, Test.Approve + 1, {from: account_SPENDER}]
		const [, errorApproved] = await handle(contract.transferFrom(...approvedData))
		assert.notEqual(errorApproved, null, "transaction revert since approved balance is exceeded")
	})
})