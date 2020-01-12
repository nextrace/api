const router = require('express').Router()
const { knex } = require('../utils.js')

// Person's profile
router.get('/:handle', async (req, res) => {

	// Require auth
	if (!req.auth) {
		console.warn('unauthorised request')
		res.set('WWW-Authenticate', 'Bearer realm="See https://nextrace.org/developers/api-authentication"')
		return res.status(401).json('Authentication required')
	}

	let person = await knex('user').select(['name', 'handle', 'country_code', 'language', 'meta', 'created_at']).where('handle', req.params.handle).first()

	if (!person) {
		return res.status(404).json('Person not found')
	}

	person.meta = JSON.parse(person.meta)
	person.bio = person.meta.bio || ''
	person.url = person.meta.url || ''
	person.city = person.meta.city || ''
	delete person.meta

	return res.json(person)
})

// Person's Race Calendar
router.get('/:handle/race-calendar', async (req, res) => {

	// Require auth
	if (!req.auth) {
		console.warn('unauthorised request')
		res.set('WWW-Authenticate', 'Bearer realm="See https://nextrace.org/developers/api-authentication"')
		return res.status(401).json('Authentication required')
	}

	let user = await knex('user').where('handle', req.params.handle).first()

	if (!user) {
		return res.status(404).json('Person not found')
	}

	let raceCalendar = []
	const eventFields = [
		{event_name: 'event.name'},
		{event_slug: 'event.slug'},
		{event_date: 'event.date'},
		{event_date: 'event.date'},
		{event_date_end: 'event.date_end'},
		{event_description: 'event.description'},
		{event_location_name: 'event.location_name'},
		{event_location_street: 'event.location_street'},
		{event_location_street: 'event.location_street'},
		{event_location_locality: 'event.location_locality'},
		{event_location_county_state: 'event.location_county_state'},
		{event_location_country_id: 'event.location_country_id'},
		{event_location_lat_lng: 'event.location_lat_lng'},
		{event_previous_event_id: 'event.previous_event_id'},
	]

	let upcoming = await knex('event_person')
						.select(['event_person.*', ...eventFields])
						.innerJoin('event', 'event_person.event_id', 'event.id')
						.where('user_id', user.id)
						.andWhere('type', 'IN', ['going', 'interested', 'spectator'])
						.andWhere('event.date', '>', new Date)
						.orderBy('event.date', 'DESC')

	let completed = await knex('event_person')
						.select(['event_person.*', ...eventFields])
						.innerJoin('event', 'event_person.event_id', 'event.id')
						.where('user_id', user.id)
						.andWhere('type', 'IN', ['going'])
						.andWhere('event.date', '<=', new Date)
						.orderBy('event.date', 'DESC')

	raceCalendar.push(...upcoming, ...completed)
	raceCalendar = raceCalendar.map(event => {
		event.event = {}

		for (const key in event) {
			if (key.startsWith('event_')) {
				label = key.replace(`event_`, '')
				event.event[label] = event[key]
				delete event[key]
			}
		}

		return event
	})

	return res.json(raceCalendar)
})

module.exports = router
