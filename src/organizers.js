const router = require('express').Router()
const { knex } = require('./utils.js')

// list all organizers
router.get('/', async (req, res) => {
	
	let organizers = knex('organizer')

	if (req.query.q) {
		organizers.where('name', 'LIKE', `%${req.query.q}%`)
	}

	organizers = await organizers.select('*')

	res.json(organizers)
})

// get one country
router.get('/:slug', async (req, res) => {
	const organizer = await knex('organizer').where('slug', req.params.slug).first()

	if (organizer) {
		res.json(organizer)
	} else {
		res.status(404).json({ message: 'Organizer not found' })
	}
})

module.exports = router
