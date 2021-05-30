require('dotenv').config({ path: '.env' })
process.env.NODE_ENV = 'TESTING'

const { assert } = require('chai')

const pool = require('../src/Pool')

describe('test recycle', () => {
	it('recycle', (done) => {


		const c = pool.connection()
		c.q('select 1').then(console.log).catch(console.error)
		c.q('select 2').then(console.log).catch(console.error)
		c.q('select 3').then(console.log).catch(console.error)
		c.q('select 4').then(console.log).catch(console.error)
		c.q('select 5').then(console.log).catch(console.error)
		c.q('select 6').then(console.log).catch(console.error)
		c.q('select 7').then(console.log).catch(console.error)
		c.q('select 8').then(console.log).catch(console.error)

		assert.equal(1, Object.keys(pool._mysqlConnectionManager._readerPool.using.default).length)
		done()
	})

})
