const router = require('express').Router()
const { uniq } = require('lodash')
const OpenAI = require("openai")
const axios = require('axios')
const UAparser = require('ua-parser-js')

const { knex } = require('../utils.js')

const openai = new OpenAI();

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

router.get('/fill-infos', async (req, res) => {
	const answers = await knex('coach_answers').whereNull('ip_info').limit(5)

	while (answers.length) {
		const answer = answers.pop()

		const { data } = await axios(`https://ipinfo.io/${answer.ip}?token=7b43d163b6da95`)

		const ua = UAparser(answer.from_useragent)

		const toUpdate = {
			ip_location: data.bogon ? '-' : uniq([data.country, data.region, data.city].filter(Boolean)).join(', '),
			ip_info: JSON.stringify(data),
			ua_text: [ua.device.vendor, ua.device.model, ua.browser.name, ua.os.name].filter(Boolean).join(' / ')
		}

		//console.log(data)
		//console.log(ua)

		await knex('coach_answers').update(toUpdate).where('id', answer.id)

		//console.log(toUpdate)
	}

	return res.json('done')
})

module.exports = router
