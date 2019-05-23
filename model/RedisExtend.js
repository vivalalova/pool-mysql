

module.exports = (client) => {
	if (!client) {
		return
	}

	if (!client.getJSONAsync) {
		client.getJSONAsync = async (...args) => {
			const result = await this.redisClient.getAsync(...args)
			return JSON.parse(result)
		}
	}

	if (!client.setJSONAsync) {
		client.setJSONAsync = async (...args) => {
			args[1] = JSON.stringify(args[1])
			return await this.redisClient.setAsync(...args)
		}
	}
}
