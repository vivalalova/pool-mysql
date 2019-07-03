const pool = require('./Pool')
const Types = require('./Types')
const mysql = require('mysql')

module.exports = class Base {
	constructor(dict) {
		if (dict) {
			for (const key in dict) {
				this[key] = dict[key]
			}
		} else {
			this._populadtes = []
			this._q = []
		}
	}

	static async native(outSideConnection, sql, values) {
		if (!sql) {
			throw 'sql command needed'
		}

		this._connection = outSideConnection || await pool.createConnection()

		try {
			return await this._connection.q(sql, values)
		} catch (error) {
			throw error
		} finally {
			if (!outSideConnection) {
				this._connection.release()
			}
		}
	}

	static get KEYS() {
		const object = new this()
		const columns = object.columns

		const keys = []
		for (const key in columns) {
			const value = columns[key]
			if (value && !(value instanceof Array) && !(typeof value == 'object')) {
				keys.push(`${object.constructor.name}.${key}`)
			}
		}

		return keys
	}

	// EXPLAIN() {
	// 	this._q.push({ type: 'EXPLAIN', command: null, value: null })
	// 	return this
	// }

	static SELECT(...columns) {
		const object = new this()
		return object.SELECT(columns)
	}

	SELECT(columns = []) {
		if (columns.length && columns[0].includes('?')) {
			this._q.push({ type: 'SELECT', command: columns[0], value: columns[1] })
		}
		else if (columns.length && columns.length == 1) {
			this._q.push({ type: 'SELECT', command: columns })
		} else if (columns.length) {
			const fields = columns.join(',').split(',').map(c => {
				if (c.includes('.')) {
					return c
				}

				return `${this.constructor.name}.${c}`
			}).join(', ')
			this._q.push({ type: 'SELECT', command: fields })
		} else {
			const keys = this.columns
				? Object.keys(this.columns)
					.filter(column => !(this.columns[column] instanceof Array) && !(typeof this.columns[column] == 'object'))
					.map(column => `${this.constructor.name}.${column}`)
					.join(', ')
				: '*'

			this._q.push({ type: 'SELECT', command: `${keys}`, customed: true })
		}

		return this
	}

	FROM(table = this.constructor.name) {
		this._q.push({ type: 'FROM', command: `${table}` })
		return this
	}

	JOIN(whereCaluse, whereCaluse2) {
		const tableName = whereCaluse.split(' ')[0]
		for (const q of this._q) {
			if (q.type == 'SELECT') {
				if (q.customed) {
					q.command += `, ${tableName}.*`
				}
				break
			}
		}
		return addQuery.bind(this)('JOIN', whereCaluse, whereCaluse2, false)
	}

	LEFTJOIN(whereCaluse, whereCaluse2) {
		const tableName = whereCaluse.split(' ')[0]

		for (const q of this._q) {
			if (q.type == 'SELECT') {
				if (q.customed) {
					q.command += `, ${tableName}.*`
				}
				break
			}
		}
		return addQuery.bind(this)('LEFT JOIN', whereCaluse, whereCaluse2, false)
	}

	WHERE(whereCaluse, whereCaluse2) { return addQuery.bind(this)('WHERE', whereCaluse, whereCaluse2) }

	AND(whereCaluse, whereCaluse2, { isExec = true } = {}) {
		if (isExec) {
			return addQuery.bind(this)('AND', whereCaluse, whereCaluse2)
		}
		return this
	}

	OR(whereCaluse, whereCaluse2, { isExec = true } = {}) {
		if (isExec) {
			return addQuery.bind(this)('OR', whereCaluse, whereCaluse2)
		}

		return this
	}

	HAVING(...column) { return addQuery.bind(this)('HAVING', column.join(' AND '), null) }
	GROUP_BY(...column) { return addQuery.bind(this)('GROUP BY', column.join(', '), null, false) }
	ORDER_BY(column, sort = 'ASC') { return addQuery.bind(this)('ORDER BY ', `${column} ${sort}`, null, false) }

	LIMIT(numbers, defaultValue = 20) {
		const limit = numbers ? parseInt(numbers) : defaultValue
		return addQuery.bind(this)('LIMIT', limit, null)
	}

	OFFSET(numbers, defaultValue = 0) {
		const limit = numbers ? parseInt(numbers) : defaultValue
		return addQuery.bind(this)('OFFSET', limit, null)
	}

	POPULATE(...fileds) {
		this._populadtes = fileds
		return this
	}

	INSERT(ignore = false) {
		const ig = ignore ? 'IGNORE' : ''
		this._q.push({ type: `INSERT`, command: ig })
		return this
	}

	static INSERT(ignore = false) {
		const object = new this()
		return object.INSERT(ignore)
	}

	INTO(table = this.constructor.name) {
		this._q.push({ type: 'INTO', command: `${table}` })
		return this
	}

	static DELETE() {
		const object = new this()
		return object.DELETE()
	}

	DELETE() {
		this._q.push({ type: 'DELETE' })
		return this
	}

	PRINT(options) {
		if (options == false) {
			this._print = false
			return this
		}

		this._print = true
		return this
	}

	WRITER() {
		this._forceWriter = true
		return this
	}

	NESTTABLES() {
		this._nestTables = true
		return this
	}

	MAP(mapCallback) {
		this._mapCallback = mapCallback
		return this
	}

	NESTED() {
		this._nested = true
		return this
	}

	EX(expireSecond, cacheKey) {
		this._EX = { key: cacheKey, EX: expireSecond }
		return this
	}

	FORMATTED(formatted = true) {
		const pre = this._pre || ''
		delete this._pre

		const after = this._after || ''
		delete this._after

		const query = {
			sql: pre + this._q.map(q => `${q.type || ''} ${q.command || ''}`).join(' ') + after,
			nestTables: this._nestTables || this._nested
		}

		const values = this._q
			.filter(q => ((q.command && q.command.includes('?')) || q.value))
			.map(q => q.value)
			.reduce((q, b) => q.concat(b), [])


		return {
			query,
			values,
			formatted: formatted
				? mysql.format(query.sql, values)
				: null
		}
	}

	async exec(outSideConnection = null) {
		this._connection = outSideConnection || await pool.createConnection()
		try {
			let results

			this._connection.useWriter = this._forceWriter
			this._forceWriter = false

			const {
				query,
				values,
				formatted,
				mapCallback,
				nested,
				print,
				filter,
				getFirst,
				updated,
				changedRows,
				affectedRows
			} = this._options()

			const ex = this._EX || {}
			ex.redisPrint = print
			this._EX = {}

			if (print) {
				results = await this._connection.print.q(query, values, ex)
			} else {
				results = await this._connection.q(query, values, ex)
			}


			// check changedRows && affectedRows
			const ch = updated ? results[1] : results
			if (changedRows != undefined && changedRows != ch.changedRows) {
				throw Error(`changedRows did set to ${changedRows}, but ${ch.changedRows}, SQL: ${formatted}`)
			} else if (affectedRows != undefined && affectedRows != ch.affectedRows) {
				throw Error(`affectedRows did set to ${affectedRows}, but ${ch.affectedRows}, SQL: ${formatted}`)
			}

			if (this._connection.isSelect(query.sql)) {
				//populate
				if (this._populadtes.length && results.length) {

					for (let i = 0; i < this._populadtes.length; i++) {
						const column = this._populadtes[i]
						const populateType = this.columns[column]
						if (populateType instanceof Array) {//coupons: [Coupons]
							const type = populateType[0]

							const tColumn = Object.keys(type.columns).filter(c => type.columns[c].name == this.constructor.name)[0]

							const PKColumn = Object.keys(this.columns).filter(column => this.columns[column] == Base.Types.PK)[0]
							const ids = results.map(result => result[PKColumn])
							const populates = await type.SELECT().FROM().WHERE(`${tColumn} in (${ids})`).PRINT(print || false).exec(this._connection)

							results.forEach(result => {
								result[column] = populates.filter(p => p[tColumn] == result[PKColumn])
							})
						} else {// coupon: Coupons
							let ids
							let refType = populateType
							let refColumn = column

							if (results instanceof Array) {
								if (typeof populateType == 'object') {
									// {
									// 	ref: require('...')
									// 	column:...
									// }
									refColumn = populateType.column
									refType = populateType.ref
									ids = results.filter(result => result[refColumn]).map(result => result[refColumn])
								} else {
									ids = results.filter(result => result[refColumn]).map(result => result[refColumn])
								}

								if (!ids.length) {
									continue
								}
							} else if (results && results[refColumn]) {
								ids = [results[refColumn]]
								if (!ids) {
									continue
								}
							} else {
								continue
							}

							const PKColumn = Object.keys(refType.columns).filter(column => refType.columns[column] == Base.Types.PK)[0]
							const populates = await refType.SELECT().FROM().WHERE(`${PKColumn} IN (${ids})`).PRINT(print || false).exec(this._connection)

							results = results.map(result => {
								if (result[refColumn]) {
									result[column] = populates.filter(populate => result[refColumn] == populate[PKColumn])[0] || result[refColumn]
								}
								return result
							})
						}
					}
				}

				//for MAP()
				if (mapCallback) {
					results = results.map(mapCallback)
				}

				if (nested) {
					results = results.map(result => {
						const r = result[this.constructor.name]
						for (const key in result) {
							if (key == this.constructor.name) {
								continue
							}
							r[key] = result[key]
						}
						return new this.constructor(r)
					})
				} else {
					results = results.map(result => new this.constructor(result))
				}

				if (filter) {
					results = results.filter(filter)
				}

				if (getFirst) {
					return results[0]
				}
			}
			//select with query
			else if (updated) {
				if (results[1].affectedRows == 0) {
					return []
				}

				const updated = results.reverse()[0][0]
				let updatedResults = []

				for (const key in updated) {
					const arr = updated[key].replace(/,$/, '').split(',')
					for (let i = 0; i < arr.length; i++) {
						if (!updatedResults[i]) {
							updatedResults[i] = {}
						}

						updatedResults[i][key] = arr[i]
					}
				}

				if (filter) {
					updatedResults = updatedResults.filter(filter)
				}

				if (getFirst) {
					return updatedResults[0]
				}

				return updatedResults
			}

			return results
		} catch (error) {
			throw error
		} finally {
			if (!outSideConnection) {
				this._connection.release()
			}
		}
	}

	get JSON() {
		return this
	}

	get PRIVATE() {
		return this
	}

	static get columns() {
		const instance = new this()
		if (instance.columns) {
			return instance.columns
		}
		return {}
	}

	static get Types() { return Types }

	//////////////////////////////Base.js
	//UPDATE
	static UPDATE() {
		const object = new this()
		return object.UPDATE()
	}

	UPDATE() {
		if (!this._q) {
			this._q = []
		}

		this._q.push({ type: 'UPDATE', command: this.constructor.name })
		return this
	}

	SET(whereCaluse, whereCaluse2, { passUndefined = false } = {}) {
		function passUndefinedIfNeeded(passUndefined, value) {
			if (!passUndefined || !(value instanceof Object)) {
				return value
			}

			const result = JSON.parse(JSON.stringify(value))
			for (const key in Object.keys(result)) {
				if (result[key] === undefined) {
					delete result[key]
				}
			}
			return result
		}

		if (whereCaluse instanceof Object) {
			const value = passUndefinedIfNeeded(passUndefined, whereCaluse)
			this._q.push({ type: 'SET', command: '?', value })
			return this
		}

		const value = passUndefinedIfNeeded(passUndefined, whereCaluse2)
		return addQuery.bind(this)('SET', whereCaluse, value, false)
	}

	DUPLICATE(whereCaluse, whereCaluse2) {
		if (whereCaluse instanceof Object) {
			this._q.push({ type: 'ON DUPLICATE KEY', command: 'UPDATE ?', value: whereCaluse })
			return this
		}

		return addQuery.bind(this)('ON DUPLICATE KEY UPDATE', whereCaluse, whereCaluse2, false)
	}

	FIRST() {
		this._getFirst = true
		addQuery.bind(this)('LIMIT', 1, null)
		return this
	}

	static FIND(...whereCaluse) {
		const object = new this()
		return object.SELECT().FROM().WHERE(...arguments)
	}

	static FIND_PK(pk) {
		if (!this.columns) {
			throw Error(`${this.constructor.name} columns not defined`)
		}

		let find
		for (const key in this.columns) {
			const value = this.columns[key]
			if (value == Base.Types.PK) {
				find = key
			}
		}

		if (!find) {
			throw Error(`${this.constructor.name}.PK columns not defined`)
		}

		return this.SELECT().FROM().WHERE(`${find} = ?`, pk).FIRST()
	}

	FILTER(callback) {
		this._filter = callback
		return this
	}

	async save() {
		const pk = this._pk

		const value = JSON.parse(JSON.stringify(this))
		delete value[pk]

		const where = {}
		where[pk] = this[pk]

		await this.UPDATE().SET(value).WHERE(where).exec()
	}

	get _pk() {
		if (!this.columns) {
			throw Error(`${this.constructor.name} columns not defined`)
		}

		let pk
		for (const key in this.columns) {
			const value = this.columns[key]
			if (value == Base.Types.PK) {
				pk = key
			}
		}

		if (!pk) {
			throw Error(`${this.constructor.name}.PK columns not defined`)
		}

		return pk
	}

	_PRE(command) {
		this._pre = command + ';'
		return this
	}

	_AFTER(command) {
		this._after = ';' + command
		return this
	}

	UPDATED(...variables) {
		this._updated = true

		let obj = this

		for (const i in variables) {
			const variable = variables[i]
			obj = obj.AND(`SELECT @${variable} := CONCAT_WS(',', ${variable}, @${variable})`)
		}

		const preParams = variables.map(r => `@${r} := ''`).join(',')
		obj = obj._PRE(`SET ${preParams}`)

		const queryParams = variables.map(r => `@${r} ${r}`).join(',')
		return obj._AFTER(`SELECT ${queryParams}`)
	}

	CHANGED_ROWS(changedRows) {
		this._changedRows = changedRows
		return this
	}

	AFFECTED_ROWS(affectedRows) {
		this._affectedRows = affectedRows
		return this
	}

	_options() {
		const options = {}

		const formatted = this.FORMATTED()
		options.query = formatted.query
		options.values = formatted.values
		options.formatted = formatted.formatted

		delete this._nestTables

		options.mapCallback = this._mapCallback
		delete this._mapCallback

		options.nested = this._nested
		this._nested = false

		options.print = this._print
		this._print = false

		options.filter = this._filter
		delete this._filter

		options.getFirst = this._getFirst
		delete this._getFirst

		options.updated = this._updated
		delete this._updated

		options.changedRows = this._changedRows
		delete this._changedRows

		options.affectedRows = this._affectedRows
		delete this._affectedRows

		return options
	}
}

function addQuery(reservedWord, whereCaluse, whereCaluse2, inBrackets = true) {
	if (!whereCaluse) {
		return this
	}

	if (typeof whereCaluse == 'string') {
		if (inBrackets) {
			this._q.push({ type: reservedWord, command: `(${whereCaluse})`, value: whereCaluse2 })
		} else {
			this._q.push({ type: reservedWord, command: `${whereCaluse}`, value: whereCaluse2 })
		}
	} else if (typeof whereCaluse == 'object') {
		this._q.push({ type: reservedWord, command: `(?)`, value: whereCaluse })
	} else {
		this._q.push({ type: reservedWord, command: `?`, value: whereCaluse })
	}

	return this
}
