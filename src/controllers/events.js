const router = require('express').Router()
const { Storage } = require('@google-cloud/storage')
const storage = new Storage()
const fs  = require('fs')
const multer  = require('multer')
const upload = multer({ dest: '/tmp/' })
const sharp = require('sharp')
const moment = require('moment-timezone')
const { knex, categoryFields, raceFields } = require('../utils.js')
const querystring = require('querystring')
const slugify = require('slugify')
const {request} = require('gaxios')

// data cache
const cacheCategoryIds = {}

const eventFields = ['event.name', 'event.slug', 'event.date', 'event.date_end', 'event.timezone', 'event.links', 'event.location_name', 'event.location_street', 'event.location_locality', 'event.location_county_state', {location_country: 'country.code'}, {location_country_name: 'country.name'}, 'event.location_lat_lng', 'event.category_tags']

const processEventLinks = event => {
	event.category_tags = JSON.parse(event.category_tags)
	event.links = JSON.parse(event.links)

	for (const link in event.links) {
		if (event.links[link]) {
			event.links[link] = `https://api.nextrace.cloud/events/${event.slug}/link/${link}`
		} else {
			delete event.links[link]
		}
	}

	return event.links
}

// list all events, with search too
router.get('/', async (req, res) => {

	// Require auth
	if (!req.auth) {
		console.warn('unauthorised request')
		res.set('WWW-Authenticate', 'Bearer realm="See https://nextrace.org/developers/api-authentication"')

		return res.status(401).json('Authentication required')
	}

	const filters = {
		status:			'public',
		country:		req.query.country || 'ES',	// only filter avoided to be `all`
		countyState:	req.query.countyState || 'all',
		category:		req.query.category || 'all',
		tag:			req.query.tag || 'all',
		organizer:		req.query.organizer || 'all',
		distance:		req.query.distance || 'all',
		date:			req.query.date || 'all',
		q:				req.query.q || '',
		featured:		req.query.featured === '1',
	}

	// Fix, sometimes the category is sent as `$category_$tag`
	if (filters.category.includes('_')) {
		[filters.category, filters.tag] = filters.category.split('_')
	}

	const pag = {
		total:		0,
		pages:		0,
		page:		Math.min(Math.max(parseInt(req.query.page) || 1, 1), 10),		// restrict to max page 10 atm
		perPage:	Math.min(Math.max(parseInt(req.query.perPage) || 50, 5), 100),	// max 100 results
	}

	const eventsQuery = knex('event')
						.innerJoin('country', 'event.location_country_id', 'country.id')
						.innerJoin('event_category', 'event.id', 'event_category.event_id')
						.where('event.status', filters.status)

	// Country filter
	if (filters.country !== 'all') {
		eventsQuery.andWhere('country.code', filters.country)
	}

	// CountyState filter
	if (filters.countyState !== 'all') {
		eventsQuery.andWhere('event.location_county_state', filters.countyState)
	}

	// Category filter
	if (filters.category !== 'all') {
		if (!cacheCategoryIds[filters.category]) {
			const category = await knex('category').select('id').where('slug', filters.category).first()
			cacheCategoryIds[filters.category] = category ? category.id : null
		}

		if (cacheCategoryIds[filters.category]) {
			eventsQuery.andWhere('event_category.category_id', cacheCategoryIds[filters.category])
		} else {
			return res.status(400).json({ message: 'Not a valid category' })
		}
	}

	// Category Tag filter
	if (filters.tag !== 'all') {
		eventsQuery.andWhere('event.category_tags', 'LIKE', `%${filters.tag}%`)
	}

	// Organizer filter
	if (filters.organizer !== 'all') {
		eventsQuery.innerJoin('event_organizer', 'event.id', 'event_organizer.event_id')
		eventsQuery.andWhere('event_organizer.organizer_id', filters.organizer)
	}

	// Distance filter
	if (filters.distance !== 'all') {
		let [min, max] = filters.distance.split(',').map(d => parseInt(d, 10))
		eventsQuery.andWhere('event.distance_min', '>=', min || 0).andWhere('event.distance_max', '<=', (max || 9999) + .5)
	}

	// Date filter
	if (filters.date === 'weekend') {
		const endOfWeek = moment().endOf('week')
		eventsQuery.andWhere('event.date', '>=', endOfWeek.subtract(1, 'day').format()).andWhere('event.date', '<=', endOfWeek.add(2, 'days').format())
	} else if (filters.date === 'nextweekend') {
		const nextWeekend = moment().endOf('week').add(6, 'days')
		eventsQuery.andWhere('event.date', '>=', nextWeekend.format()).andWhere('event.date', '<=', nextWeekend.add(2, 'days').format())
	} else if (filters.date === 'month') {
		const month = moment().startOf('month')
		eventsQuery.andWhere('event.date', '>=', month.format()).andWhere('event.date', '<=', month.endOf('month').format())
	} else if (filters.date === 'nextmonth') {
		const nextMonth = moment().endOf('month').add(1, 'day')
		eventsQuery.andWhere('event.date', '>=', nextMonth.format()).andWhere('event.date', '<=', nextMonth.endOf('month').format())
	} else if (filters.date.includes(',')) {
		let [dateStart, dateEnd] = filters.date.split(',')

		if (moment(dateStart).isValid()) {
			eventsQuery.andWhere('event.date', '>=', moment(dateStart).format())
		}

		if (moment(dateEnd).isValid()) {
			eventsQuery.andWhere('event.date', '<=', moment(dateEnd).format())
		}
	} else {
		eventsQuery.andWhere('event.date', '>=', moment().subtract(2, 'days').format())
	}

	// Words filter
	if (filters.q.length) {
		eventsQuery.andWhere(q => {
			q.where('event.name', 'LIKE', `%${filters.q}%`).orWhere('event.location_locality', 'LIKE', `%${filters.q}%`).orWhere('event.location_name', 'LIKE', `%${filters.q}%`)
		})
	}

	// Featured filter
	if (filters.featured) {
		eventsQuery.andWhere('event.featured', 1)
	}

	// Query total number of events
	const totalQuery = eventsQuery.clone().count({ total: 'event.id' }).first()
	pag.total = (await totalQuery).total
	pag.pages = Math.ceil(pag.total / pag.perPage)

	// Select needed fields
	eventsQuery
		.distinct('event.id')
		.select(eventFields)

	// Order & pagination
	eventsQuery.orderBy('event.date', 'ASC').offset((pag.page - 1) * pag.perPage).limit(pag.perPage)

	// Get events & related data
	let events = await eventsQuery
	const eventIds = events.map(event => event.id)
	let races = events.length ? await knex('race').select(raceFields).whereIn('event_id', eventIds) : []
	let categories = events.length ? await knex('category').select([...categoryFields, 'event_id']).join('event_category', 'event_category.category_id', 'category.id').whereIn('event_id', eventIds) : []

	events = events.map(event => {
		event.links = processEventLinks(event)
		event.categories = categories.filter(category => category.event_id === event.id)
		event.races = races.filter(race => race.event_id === event.id)

		return event
	})

	// build Links
	const links = {
		self:	`/events?${querystring.stringify({ ...req.query, ...{perPage: pag.perPage, page: pag.page} })}`,
	}

	if (pag.page > 1) {
		links.prev = `/events?${querystring.stringify({ ...req.query, ...{perPage: pag.perPage, page: pag.page - 1} })}`
	}

	if (pag.page < pag.pages) {
		links.next = `/events?${querystring.stringify({ ...req.query, ...{perPage: pag.perPage, page: pag.page + 1} })}`
		links.last = `/events?${querystring.stringify({ ...req.query, ...{perPage: pag.perPage, page: pag.pages} })}`
	}

	return res.set({
		'Cache-Control':	'public, max-age=7200',
		'X-Total': 			pag.total,
	}).links(links).json(events)
})


// Get a list of countyState for a specific Country
router.post('/', async (req, res) => {
	const country = await knex('country').where('code', req.body.location_country).first()

	let event = {
		name: req.body.name,
		slug: slugify(req.body.name + '-' + req.body.date.split('-').shift(), { lower: true }),
		date: req.body.date,
		date_end: req.body.date_end,
		timezone: '',
		status: 'draft',
		featured: 0,
		description: req.body.description,
		editor_comment: req.body.editor_comment,
		links: JSON.stringify(req.body.links),
		location_country_id: country.id,
		location_county_state: req.body.location_county_state,
		location_lat_lng: req.body.location_lat_lng,
		location_locality: req.body.location_locality,
		location_name: req.body.location_name,
		location_postal: req.body.location_postal,
		location_street: req.body.location_street,
		stat_views: 0,
		stat_impressions: 0,
		created_by_id: req.body.created_by_id,
		meta: JSON.stringify({organizers: 0}),
	}

	const inserted = await knex('event').insert(event, 'id')
	event.id = inserted[0]

	await knex('event_category').insert(req.body.categories.map(eventCategoryId => {
		return {
			event_id: event.id,
			category_id: eventCategoryId,
		}
	}))

	return res.json(event)
})


// Get a list of countyState for a specific Country
router.put('/:id([0-9]+)', async (req, res) => {
	const event = await knex('event').where('id', req.params.id).first()
	const country = await knex('country').where('code', req.body.location_country).first()

	// generate meta info for event
	event.meta = JSON.parse(event.meta)
	event.meta.races = req.body.races.length

	let category_tags = []
	let distance_min = false
	let distance_max = false

	req.body.races.forEach(race => {
		if (!category_tags.includes(race.category_tag)) {
			category_tags.push(race.category_tag)
		}

		if (!distance_min || race.distance < distance_min) {
			distance_min = race.distance
		}

		if (!distance_max || race.distance > distance_max) {
			distance_max = race.distance
		}
	})

	// update event in db
	await knex('event').update({
		name: req.body.name,
		date: req.body.date,
		date_end: req.body.date_end,
		timezone: req.body.timezone,
		description: req.body.description,
		editor_comment: req.body.editor_comment,
		links: JSON.stringify(req.body.links),
		location_country_id: country.id,
		location_county_state: req.body.location_county_state,
		location_lat_lng: req.body.location_lat_lng,
		location_locality: req.body.location_locality,
		location_name: req.body.location_name,
		location_postal: req.body.location_postal,
		location_street: req.body.location_street,
		meta: JSON.stringify(event.meta),
		category_tags: JSON.stringify(category_tags),
		distance_min,
		distance_max,
	}).where('id', event.id)

	// add or update races in db
	if (req.body.races && req.body.races.length) {
		const existingRaceIds = req.body.races.filter(r => 'id' in r).map(r => r.id)

		await knex('race').whereNotIn('id', existingRaceIds).andWhere('event_id', event.id).del()
		const racesInDb = await knex('race').where('event_id', event.id)
		let racesToSave = []

		req.body.races.forEach(race => {

			// TODO completely rename 'elevation' to 'ascent'
			if (race.ascent) {
				race.elevation = race.ascent
				delete race.ascent
			}

			delete race.time

			race.date = moment.tz(race.date, event.timezone).utc().toDate()

			if (race.id) {
				let raceDb = racesInDb.find(r => r.id == race.id)
				racesToSave.push(knex('race').update({
					...raceDb,
					...race,
				}).where('id', race.id))
			} else {
				racesToSave.push(knex('race').insert({
					event_id: event.id,
					meta: '{}',
					featured: 0,
					...race,
				}))
			}
		})

		await Promise.all(racesToSave)
	}

	return res.json(event)
})


// Get a list of countyState for a specific Country
router.get('/countyState/:country', async (req, res) => {
	const country = await knex('country').where('code', req.params.country).first()

	const countyStates = await knex('event').select({countyState: 'location_county_state'}).count({ total: 'location_county_state' }).where({
		location_country_id:	country.id,
		status:					'public',
	}).whereNotNull('location_county_state').groupBy('location_county_state').orderBy('location_county_state', 'asc')

	return res.json(countyStates)
})


router.get('/:event/timeline', async (req, res) => {

	if (!req.auth) {
		console.warn('unauthorised request')
		res.set('WWW-Authenticate', 'Bearer realm="See https://nextrace.org/developers/api-authentication"')

		return res.status(401).json({
			type: null,
			title: 'Authentication required',
		})
	}

	const eventFields = ['id', 'name', 'slug', 'date', 'status', 'previous_event_id']
	let checkFuture = true

	const events = await knex('event').select(eventFields).where('slug', req.params.event)

	if (!events.length) {
		return res.status(404).json({
			type: null,
			title: 'Not Found',
		})
	}

	// past events
	while (events[events.length - 1].previous_event_id) {
		events.push(await knex('event').select(eventFields).where('id', events[events.length - 1].previous_event_id).first())
	}

	// next events
	while (checkFuture) {
		const next = await knex('event').select(eventFields).where('previous_event_id', events[0].id).first()

		if (next) {
			events.unshift(next)
		} else {
			checkFuture = false
		}
	}

	return res.set({
		'Cache-Control':	'public, max-age=7200',
	}).json(events)
})


// upload image for event
// TODO require auth
router.post('/:eventId/uploadImage', upload.single('image'), async (req, res) => {

	if (!req.auth) {
		console.warn('unauthorised request')
		res.set('WWW-Authenticate', 'Bearer realm="See https://nextrace.org/developers/api-authentication"')

		return res.status(401).json('Authentication required')
	}

	const bucket = storage.bucket('cdn.nextrace.cloud')

	const opts = {
		resumable:		false,
		metadata:		{
			cacheControl:	'public, max-age=604800, stale-while-revalidate=43200'
		}
	}
	const file1 = bucket.file(`events/${req.body.slug}-lg.jpg`).createWriteStream(opts)
	const file2 = bucket.file(`events/${req.body.slug}-lg.webp`).createWriteStream(opts)
	const file3 = bucket.file(`events/${req.body.slug}-md.jpg`).createWriteStream(opts)
	const file4 = bucket.file(`events/${req.body.slug}-md.webp`).createWriteStream(opts)

	const promiseForStream = stream => {
		return new Promise((resolve, reject) => {
			stream.once('error', reject)
			stream.once('finish', resolve)
		})
	}

	const pipeline = sharp().resize(1280, 720)
	const s1 = pipeline.clone().jpeg({ quality: 90 }).pipe(file1)
	const s2 = pipeline.clone().webp({ quality: 90 }).pipe(file2)
	const s3 = pipeline.clone().resize(560, 315).jpeg({ quality: 90 }).pipe(file3)
	const s4 = pipeline.clone().resize(560, 315).webp({ quality: 90 }).pipe(file4)

	Promise.all([promiseForStream(s1), promiseForStream(s2), promiseForStream(s3), promiseForStream(s4)]).then(() => {
		console.log(`[EVENTS - Image Upload] uploaded images for ${req.body.slug} to GCS`)
		res.json('done')
	})

	console.log('[EVENTS - Image Upload] start file upload', req.params)

	if (req.body.url) {
		console.log('[EVENTS - Image Upload] by url', req.body.url)
		request({
			url: req.body.url,
			responseType: 'stream',
		}).then(response => {
			response.data.pipe(pipeline)
		})
	} else if (req.file) {
		console.log('[EVENTS - Image Upload] by uploaded file', req.file.originalname)
		fs.createReadStream(req.file.path).pipe(pipeline)
	} else {
		return res.status(404).json({ message: 'Invalid image upload' })
	}
})

router.get('/:event', async (req, res) => {
	let singleEventFields = ['event.id', ...eventFields, 'event.description']

	if (req.query.editing) {
		singleEventFields.push('event.status', 'event.editor_comment')
	}

	const event = await knex('event')
						.select(singleEventFields)
						.innerJoin('country', 'event.location_country_id', 'country.id')
						.where('slug', slugify(req.params.event, { lower: true }))
						.first()

	if (!event) {
		return res.status(404).json({
			type:	null,
			title:	'Not Found',
		})
	}

	event.date = moment(event.date).format('YYYY-MM-DD')

	if (req.query.editing) {
		event.links = JSON.parse(event.links)
	} else {
		event.links = processEventLinks(event)
	}

	event.categories = await knex('category').select(categoryFields).join('event_category', 'event_category.category_id', 'category.id').where('event_id', event.id)
	event.races = await knex('race').select(raceFields).where('event_id', event.id)

	return res.json(event)
})

module.exports = router
