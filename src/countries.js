const router = require('express').Router()
const { dbQuery } = require('./db.js')

// list all countries
router.get('/', async (req, res) => {
	let sql = 'SELECT code, code3, name, continent, capital FROM country'
	let sqlInserts = []

	if (req.query.q && req.query.q.length > 1) {
		sql += ' WHERE code LIKE ? OR code3 LIKE ? OR name LIKE ? OR capital LIKE ?'
		sqlInserts.push(req.query.q, req.query.q, `${req.query.q}%`, `${req.query.q}%`)
	}

	const countries = await dbQuery(sql, sqlInserts)

	res.json(countries)
})

// get one country
router.get('/:code', async (req, res) => {
	const countries = await dbQuery('SELECT code, code3, name, continent, capital FROM country WHERE code = ? OR code3 = ?', [req.params.code, req.params.code])

	if (countries.length) {
		res.json(countries[0])
	} else {
		res.status(404).json({ message: 'Country code not found' })
	}
})

module.exports = router
