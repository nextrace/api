const router = require('express').Router()
const { knex } = require('./utils.js')

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
	//console.log('Time: ', Date.now())
	next()
})

// list all categories
router.get('/', async (req, res) => {
	const categories = await knex('category').select('slug', 'name', 'priority', 'color', 'emoji')

	res.json(categories)
})

// get one category
router.get('/:slug', async (req, res) => {
	const category = await knex('category').select('slug', 'name', 'priority', 'color', 'emoji').where('slug', req.params.slug).first()

	if (category) {
		res.json(category)
	} else {
		res.status(404).json({ message: 'Category not found' })
	}
})

module.exports = router
