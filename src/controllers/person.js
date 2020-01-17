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

	const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), 10)			// restrict to max page 10 atm
	const perPage = Math.min(Math.max(parseInt(req.query.perPage) || 50, 5), 100)	// max 100 results
	const order = req.query.order || 'desc'

	let user = await knex('user').where('handle', req.params.handle).first()

	if (!user) {
		return res.status(404).json('Person not found')
	}

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

	let raceCalendar = await knex('event_person')
						.select(['event_person.*', ...eventFields])
						.innerJoin('event', 'event_person.event_id', 'event.id')
						.where('user_id', user.id)
						.andWhere(builder => {
							// Upcoming events
							builder.where(builder => {
								builder.where('type', 'IN', ['going', 'interested', 'spectator'])
								builder.andWhere('event.date', '>', new Date)
							})
							// Past events
							builder.orWhere(builder => {
								builder.where('type', 'IN', ['going'])
								builder.andWhere('event.date', '<=', new Date)
							})
						})
						.offset((page - 1) * perPage).limit(perPage)
						.orderBy('event.date', order)

	const eventIds = raceCalendar.map(ev => ev.event_id)
	const categories = await knex('event_category').where('event_id', 'IN', eventIds)
	// TODO return only Race IDs, and let the client request Race details
	const races = await knex('race').where('event_id', 'IN', eventIds)

	raceCalendar = raceCalendar.map(ev => {
		ev.event = {}

		for (const key in ev) {
			if (key.startsWith('event_')) {
				label = key.replace(`event_`, '')
				ev.event[label] = ev[key]
				delete ev[key]
			}
		}

		ev.event.categories = categories.filter(eventCategory => eventCategory.event_id === ev.event.id).map(category => category.category_id)
		ev.event.races = races.filter(race => race.event_id === ev.event.id)

		return ev
	})

	return res.json(raceCalendar)
})

module.exports = router
