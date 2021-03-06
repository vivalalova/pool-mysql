const Event = require("../Logger/Event")

module.exports = class Combine {
	constructor() {
		this.isQuering = {}
		this.waitingCallbacks = {}
	}

	// if query is exists
	isQuerying(key) {
		return this.isQuering[key]
	}

	// sign up query
	bind(key) {
		this.isQuering[key] = true
	}

	// sign off query
	end(key) {
		delete this.isQuering[key]
	}

	// waiting for someone query results
	async subscribe(key) {
		if (!this.waitingCallbacks[key]) {
			this.waitingCallbacks[key] = []
		}

		return new Promise((resolve, reject) => {
			const publisher = (err, results) => {
				if (err) {
					return reject(err)
				}
				resolve(results)
			}

			this.waitingCallbacks[key].push(publisher)
		})
	}

	// offer results to other query which subscribed
	publish(key, err, result) {
		return new Promise(resolve => {
			resolve()

			const arr = this.waitingCallbacks[key] || []

			while (arr.length) {
				try {
					const callback = arr.shift()
					callback(err, result)
				} catch (error) {
					Event.emit('err', 'Combine Publish', error)
				}
			}

			this.end(key)
		})
	}
}
