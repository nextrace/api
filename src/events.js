const router = require('express').Router()
const { dbQuery } = require('./db.js')
const { Storage } = require('@google-cloud/storage')
const storage = new Storage()
const fs  = require('fs')
const multer  = require('multer')
const upload = multer({ dest: '/tmp/' })
const sharp = require('sharp')
const moment = require('moment')


// list all events, with search too
router.get('/', async (req, res) => {

	// Require auth
	if (!req.auth) {
		console.warn('unauthorised request')
		res.set('WWW-Authenticate', 'Bearer realm="See https://nextrace.org/developers/api-authentication"')

		return res.status(401).json('Authentication required')
	}

	let filters = {
		status:		'public',
		country:	req.query.country || 'ES',	// only filter avoided to be `all`
		category:	req.query.category || 'all',
		distance:	req.query.distance || 'all',
		date:		req.query.date || 'all',
		q:			req.query.q || '',
		featured:	req.query.featured === '1',
	}

	const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), 10)			// restrict to max page 10 atm
	const perPage = Math.min(Math.max(parseInt(req.query.perPage) || 50, 5), 100)	// max 100 results

	let sql = 'SELECT distinct(e.id), e.name, e.slug, e.date, e.date_end, e.links, e.location_name, e.location_locality, e.location_county_state, \
					co.name AS location_country_name, co.code AS location_country_code, co.code3 AS location_country_code3 \
				FROM `event` `e` \
				INNER JOIN `race` `r` ON r.event_id = e.id \
				INNER JOIN `event_category` `ec` ON ec.event_id = e.id \
				INNER JOIN `country` `co` ON co.id = e.location_country_id \
				WHERE e.`status` = ?';
	let sqlInserts = [ filters.status ]

	// Country filter
	if (filters.country !== 'all') {
		let country = await dbQuery('SELECT id FROM `country` WHERE `code` = ?', [filters.country])

		if (country.length) {
			sql += ' AND `location_country_id` = ?'
			sqlInserts.push(country[0].id)
		} else {
			return res.status(400).json({ message: 'Not a valid country code' })
		}
	}

	// Category filter
	if (filters.category !== 'all') {
		let category = await dbQuery('SELECT id FROM `category` WHERE `slug` = ?', [filters.category])

		if (category.length) {
			sql += ' AND ec.`category_id` = ?'
			sqlInserts.push(category[0].id)
		} else {
			return res.status(400).json({ message: 'Not a valid category' })
		}
	}

	// Distance filter
	if (filters.distance !== 'all') {
		let [min, max] = filters.distance.split(',').map(d => parseInt(d, 10))
		sql += ' AND r.`distance` >= ? AND r.`distance` <= ?'
		sqlInserts.push(min || 0, (max || 9999) + .5)
	}

	// Date filter
	if (filters.date === 'weekend') {
		const endOfWeek = moment().endOf('week')
		sql += ' AND e.`date` >= ? AND e.`date` <= ?'
		sqlInserts.push(endOfWeek.subtract(1, 'day').format(), endOfWeek.add(2, 'days').format())
	} else if (filters.date === 'nextweekend') {
		const nextWeekend = moment().endOf('week').add(6, 'days')
		sql += ' AND e.`date` >= ? AND e.`date` <= ?'
		sqlInserts.push(nextWeekend.format(), nextWeekend.add(2, 'days').format())
	} else if (filters.date === 'month') {
		const month = moment().startOf('month')
		sql += ' AND e.`date` >= ? AND e.`date` <= ?'
		sqlInserts.push(month.format(), month.endOf('month').format())
	} else if (filters.date === 'nextmonth') {
		const nextMonth = moment().endOf('month').add(1, 'day')
		sql += ' AND e.`date` >= ? AND e.`date` <= ?'
		sqlInserts.push(nextMonth.format(), nextMonth.endOf('month').format())
	} else if (filters.date.includes(',')) {
		let [dateStart, dateEnd] = filters.date.split(',')

		if (moment(dateStart).isValid()) {
			sql += ' AND e.`date` >= ?'
			sqlInserts.push(moment(dateStart).format())
		}

		if (moment(dateEnd).isValid()) {
			sql += ' AND e.`date` <= ?'
			sqlInserts.push(moment(dateEnd).format())
		}
	} else {
		sql += ' AND e.`date` >= ?'
		sqlInserts.push(moment().subtract(2, 'days').format())
	}

	// Words filter
	if (filters.q.length) {
		sql += ' AND (e.`name` LIKE ? OR e.`location_locality` LIKE ? OR e.`location_name` LIKE ?)'
		sqlInserts.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`)
	}

	// Words filter
	if (filters.featured) {
		sql += ' AND e.featured = ?'
		sqlInserts.push(1)
	}

	// order
	sql += ' ORDER BY e.`date` ASC'

	// limit
	sql += ' LIMIT ?, ?'
	sqlInserts.push((page - 1) * perPage, perPage)

	let events = await dbQuery(sql, sqlInserts)
	const eventIds = events.map(event => event.id)
	let races = events.length ? await dbQuery('SELECT event_id, id, name, category_id, grouping, date, time_limit, distance, elevation AS ascent, max_participants, link FROM race WHERE event_id IN (?)', [eventIds]) : []
	let categories = events.length ? await dbQuery('SELECT event_id, id, slug, name, name_short, color, emoji FROM category, event_category WHERE id = category_id AND event_id IN (?)', [eventIds]) : []

	events = events.map(event => {
		event.links = JSON.parse(event.links)

		event.location_country = {
			name:	event.location_country_name,
			code:	event.location_country_code,
			code3:	event.location_country_code3
		}

		delete event.location_country_name
		delete event.location_country_code
		delete event.location_country_code3

		event.categories = categories.filter(category => category.event_id === event.id)
		event.races = races.filter(race => race.event_id === event.id)

		return event
	})

	res.json(events)
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
		contentType:	'auto',
		resumable:		false,
		metadata:		{
			cacheControl:	'public, max-age=604800, stale-while-revalidate=43200'
		}
	}
	const file1 = bucket.file(`events/${req.body.slug}-1280x720.jpg`).createWriteStream(opts)
	const file2 = bucket.file(`events/${req.body.slug}-560x315.jpg`).createWriteStream(opts)


	const promiseForStream = stream => {
		return new Promise((resolve, reject) => {
			stream.once('error', reject)
			stream.once('finish', resolve)
		})
	}

	const pipeline = sharp().resize(1280, 720)
	const s1 = pipeline.clone().jpeg({ quality: 90 }).pipe(file1)
	const s2 = pipeline.clone().resize(560, 315).jpeg({ quality: 90 }).pipe(file2)

	Promise.all([promiseForStream(s1), promiseForStream(s2)]).then(() => {
		console.log(`[EVENTS - Image Upload] uploaded images for ${req.body.slug} to GCS`)
		res.json('done')
	})

	console.log('[EVENTS - Image Upload] start file upload', req.params)
	fs.createReadStream(req.file.path).pipe(pipeline)
})

module.exports = router
