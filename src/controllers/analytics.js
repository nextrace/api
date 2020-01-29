const router = require('express').Router()
const { PubSub } = require('@google-cloud/pubsub')

// record impressions for Events
router.get('/event-impressions', async (req, res) => {

	if (req.query.events) {
		const pubsub = new PubSub()
		const payload = { events: req.query.events.map(id => parseInt(id, 10)) }
		const dataBuffer = Buffer.from(JSON.stringify(payload))

		pubsub.topic('event-impressions').publish(dataBuffer)
		return res.json(true)
	}

	return res.status(400).json(false)
})

// record impressions for Events
router.post('/event-impressions', async (req, res) => {
	const pubsub = new PubSub()

	const dataBuffer = Buffer.from(JSON.stringify({ events: req.body }))
	pubsub.topic('event-impressions').publish(dataBuffer)

	res.json(true)
})

module.exports = router
