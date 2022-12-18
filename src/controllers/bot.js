const router = require('express').Router()
const { Configuration, OpenAIApi } = require("openai")

const { knex } = require('../utils.js')

const openaiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

// kilian bot
router.post('/', async (req, res) => {
	const question = req.query.q || req.body.q

	if (!question) {
		return res.sendStatus(400)
	}

	let answer = `I can't answer this one..`

	try {
		const response = await openai.createCompletion({
			model: "text-davinci-003",
			prompt: `act as a running coach who's a mix of David Goggins + Usain Bolt and give a witty funny and mostly wrong response to someone saying "${question}". Show only the response.`,
			temperature: 0.7,
			max_tokens: 100,
		});

		console.log(response.data)

		if (response.data.choices?.length) {
			answer = response.data.choices[0].text?.trim()
		}

		knex('coach_answers').insert({
			question,
			answer,
			opeanai: JSON.stringify(response.data),
			ip: req.ip,
			referer: req.get('referer') || req.get('origin') || '-',
			from_useragent: req.get('user-agent'),
			created_at: new Date(),
		}).then(() => {})

	} catch (error) {

		knex('coach_answers').insert({
			question,
			answer,
			opeanai: JSON.stringify(error.message),
			ip: req.ip,
			referer: req.get('referer') || req.get('origin') || '-',
			from_useragent: req.get('user-agent'),
			created_at: new Date(),
		}).then(() => {})

		return res.status(400).json({message: error.message})
	}

	return res.json({ question, answer })
})

module.exports = router
