const crypto = require('crypto')
const router = require('express').Router()
const { knex } = require('../utils.js')

// Person profile
router.get('/:id', async (req, res) => {
	let person = await knex('user').select(['name', 'email', 'handle', 'country_code', 'language', 'meta', 'created_at'])
				.where('id', req.params.id).orWhere('handle', req.params.id).first()

	if (!person) {
		return res.sendStatus(404)
	}

	person.email_hash = crypto.createHash('md5').update(person.email).digest('hex')
	person.meta = JSON.parse(person.meta)
	person.bio = person.meta.bio || ''
	person.url = person.meta.url || ''
	person.city = person.meta.city || ''

	delete person.email
	delete person.meta

	return res.json(person)
})

module.exports = router
