const router = require('express').Router()
const { knex } = require('./utils.js')

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
	//console.log('Time: ', Date.now())
	next()
})

// list all categories
router.get('/', async (req, res) => {
	const categories = await knex('category').select('id', 'slug', 'name', 'priority', 'color', 'emoji')

	// Categories don't change often, 1 month cache is ok
	res.set('Cache-Control', 'public, max-age=2628000')

	return res.json(categories)
})

// get one category
router.get('/:category', async (req, res) => {
	const category = await knex('category')
						.select('id', 'slug', 'name', 'priority', 'color', 'emoji')
						.where('id', req.params.category)
						.orWhere('slug', req.params.category)
						.first()

	// Categories don't change often, 1 month cache is ok
	res.set('Cache-Control', 'public, max-age=2628000')

	if (category) {
		return res.json(category)
	} else {
		return res.status(404).json({ message: 'Category not found' })
	}
})

module.exports = router
