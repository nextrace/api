const router = require('express').Router()
const { knex } = require('./utils.js')

// list all countries
router.get('/', async (req, res) => {
	const fields = ['code', 'code3', 'name', 'continent', 'capital']
	const countries = knex('country')

	if (req.query.q && req.query.q.length > 1) {
		countries
			.where('code', 'LIKE', req.query.q)
			.orWhere('code3', 'LIKE', req.query.q)
			.orWhere('name', 'LIKE', `${req.query.q}%`)
			.orWhere('capital', 'LIKE', `${req.query.q}%`)
	}

	res.json(await countries.select(fields))
})

// get one country
router.get('/:code', async (req, res) => {
	const country = await knex('country')
						.select('code', 'code3', 'name', 'continent', 'capital')
						.where('code', req.params.code).orWhere('code3', req.params.code).orWhere('name', req.params.code)
						.first()

	if (country) {
		res.json(country)
	} else {
		res.status(404).json({ message: 'Country code not found' })
	}
})

module.exports = router
