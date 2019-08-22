const router = require('express').Router()
const { dbQuery } = require('./db.js')

// middleware that is specific to this router
router.use(function timeLog (req, res, next) {
	//console.log('Time: ', Date.now())
	next()
})

// list all categories
router.get('/', async (req, res) => {
	const categories = await dbQuery('SELECT slug, name, priority, color FROM `category`')

	res.json(categories)
})

// get one category
router.get('/:slug', async (req, res) => {
	const categories = await dbQuery('SELECT slug, name, priority, color FROM category WHERE slug = ?', [req.params.slug])

	if (categories.length) {
		res.json(categories[0])
	} else {
		res.status(404).json({ message: 'Category not found' })
	}
})

module.exports = router
