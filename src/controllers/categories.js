const router = require('express').Router()
const { knex, categoryFields } = require('../utils.js')

const processCategory = category => {
	category.tags = JSON.parse(category.tags) || []

	return category
}

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
	//console.log('Time: ', Date.now())
	next()
})

// list all categories
router.get('/', async (req, res) => {
	let categories = await knex('category').select(categoryFields).orderBy('priority', 'asc')
	categories = categories.map(processCategory)

	// Categories don't change often, 1 month cache is ok
	res.set('Cache-Control', 'public, max-age=2628000')

	return res.json(categories)
})

// get one category
router.get('/:category', async (req, res) => {
	let category = await knex('category')
						.select(categoryFields)
						.where('id', req.params.category)
						.orWhere('slug', req.params.category)
						.first()

	// Categories don't change often, 1 month cache is ok
	res.set('Cache-Control', 'public, max-age=2628000')

	if (!category) {
		return res.status(404).json({ message: 'Category not found' })
	}

	category = processCategory(category)

	return res.json(category)
})

module.exports = router
