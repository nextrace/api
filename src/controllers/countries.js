const router = require('express').Router()
const { knex } = require('../utils.js')

const countryFields = ['code', 'code3', 'name', 'continent', 'capital', 'timezones']

const processCountry = country => {

	country.timezones = JSON.parse(country.timezones)

	return country
}

// list all countries
router.get('/', async (req, res) => {
	
	let countries = knex('country')

	if (req.query.q && req.query.q.length > 1) {
		countries
			.where('code', 'LIKE', req.query.q)
			.orWhere('code3', 'LIKE', req.query.q)
			.orWhere('name', 'LIKE', `${req.query.q}%`)
			.orWhere('capital', 'LIKE', `${req.query.q}%`)
	}

	countries = await countries.select(countryFields)
	countries = countries.map(processCountry)

	res.json(countries)
})

// get one country
router.get('/:code', async (req, res) => {
	let country = await knex('country')
						.select(countryFields)
						.where('code', req.params.code).orWhere('code3', req.params.code).orWhere('name', req.params.code)
						.first()

	if (!country) {
		res.status(404).json({ message: 'Country code not found' })
	}

	country = processCountry(country)

	return res.json(country)
})

module.exports = router
