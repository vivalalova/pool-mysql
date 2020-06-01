const mysql = require('mysql')

class Base {
	// eslint-disable-next-line no-unused-vars
	static validate(value) {
		return true
	}
}

class PK {
	static validate() {
		return true
	}
}

class Point {
	static validate(value) {

		const isValidString = typeof value === 'string'
			&& value.replace(/ /g, '').match(/[0-9]{1,3},[0-9]{1,3}/)

		const isValidObject = typeof value === 'object'
			&& typeof value.x === 'number'
			&& typeof value.y === 'number'
			&& value.x >= 0
			&& value.x <= 180
			&& value.y >= 0
			&& value.y <= 180

		return isValidString || isValidObject
	}

	static inputMapper(value) {
		if (!Point.validate(value)) {
			throw 'invalid'
		}

		if (typeof value === 'string') {
			return mysql.raw(`POINT(${value})`)
		} else if (typeof value === 'object') {
			return mysql.raw(`POINT(${mysql.escape(Number(value.x))}, ${mysql.escape(Number(value.y))})`)
		}

		return ''
	}
}

class ENUM {
	static cases(...cases) {
		const instance = new this()
		instance._cases = cases
		return instance
	}

	static validate() {
		return true
	}
}


class Str extends String {
	static validate(string) {
		return typeof string === 'string'
	}
}

class JSONString extends Str {

	static validate(str) {
		if (!super.validate(str)) {
			return false
		}


		try {
			if (!str) {
				return false
			}

			JSON.parse(str)
			return true
		} catch (e) {
			return false
		}
	}
}

class Email extends String {
	static validate(string) {
		if (!string) {
			return false
		}

		const lowerCased = string.toLowerCase()

		// eslint-disable-next-line no-control-regex
		const regex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/
		return (lowerCased.match(regex) == lowerCased)
	}
}

class URL extends Str {
	static validate(string) {
		if (!super.validate(string)) {
			return false
		}

		const lowerCased = string.toLowerCase()

		return lowerCased.match(/(^https?:\/\/)/) ? true : false
	}
}

class Num extends Number {
	static validate(number) {
		return !isNaN(number) && typeof number === 'number'
	}
}

class NumberString extends Str {
	static validate(string) {
		if (!super.validate(string)) {
			return false
		}

		return !isNaN(string) && Number(string) == string
	}
}

module.exports = {
	Base, // for extends
	PK,
	Point,
	ENUM,
	Num,
	Str,
	JSONString,
	NumberString,
	Email,
	URL
}
