const router = require('express').Router()
const { PubSub } = require('@google-cloud/pubsub')

// record impressions for Events
router.post('/event-impressions', async (req, res) => {
	const pubsub = new PubSub()

	const dataBuffer = Buffer.from(JSON.stringify({ events: req.body }))
	pubsub.topic('event-impressions').publish(dataBuffer)

	res.json(true)
})

module.exports = router
