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
	let filters = {
		status:		'public',
		country:	req.query.country || 'ES',	// only filter avoided to be `all`
		category:	req.query.category || 'all',
		distance:	req.query.distance || 'all',
		date:		req.query.date || 'all'
	}

	const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), 10)			// restrict to max page 10 atm
	const perPage = Math.min(Math.max(parseInt(req.query.perPage) || 32, 5), 100)	// max 100 results

	let sql = 'SELECT id, category_id, name, slug, date, date_end, links, location_name, location_locality, location_county_state, location_country_id FROM `event` WHERE `status` = ?';
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
			sql += ' AND `category_id` = ?'
			sqlInserts.push(category[0].id)
		} else {
			return res.status(400).json({ message: 'Not a valid category' })
		}
	}

	// Date filter
	if (filters.date === 'weekend') {
		const endOfWeek = moment().endOf('week')
		sql += ' AND `date` >= ? AND `date` <= ?'
		sqlInserts.push(endOfWeek.subtract(1, 'day').format(), endOfWeek.add(2, 'days').format())
	} else if (filters.date === 'nextweekend') {
		const nextWeekend = moment().endOf('week').add(6, 'days')
		sql += ' AND `date` >= ? AND `date` <= ?'
		sqlInserts.push(nextWeekend.format(), nextWeekend.add(2, 'days').format())
	} else if (filters.date === 'month') {
		const month = moment().startOf('month')
		sql += ' AND `date` >= ? AND `date` <= ?'
		sqlInserts.push(month.format(), month.endOf('month').format())
	} else if (filters.date === 'nextmonth') {
		const nextMonth = moment().endOf('month').add(1, 'day')
		sql += ' AND `date` >= ? AND `date` <= ?'
		sqlInserts.push(nextMonth.format(), nextMonth.endOf('month').format())
	} else if (filters.date === 'all') {
		sql += ' AND `date` >= ?'
		sqlInserts.push(moment().subtract(2, 'days').format())
	}

	// order
	sql += ' ORDER BY `date` ASC'

	// limit
	sql += ' LIMIT ?, ?'
	sqlInserts.push((page - 1) * perPage, perPage)

	let events = await dbQuery(sql, sqlInserts)
	let races = events.length ? await dbQuery('SELECT event_id, name, date, time_limit, distance, elevation, max_participants, link FROM race WHERE event_id IN (?)', [events.map(event => event.id)]) : []


	events = events.map(event => {
		event.links = JSON.parse(event.links)
		event.races = races.filter(race => race.event_id === event.id)

		return event
	})


	// Distance filter
	if (filters.distance !== 'all') {
		let [min, max] = filters.distance.split(',').map(d => parseInt(d, 10))
		min = min || 0
		max = (max || 9999) + .5

		events = events.filter(event => {
			let ok = false

			event.races.forEach(race => {
				if (race.distance && race.distance >= min && race.distance <= max) {
					ok = true
				}
			})

			return ok
		})
	}


	res.json(events)
})

// upload image for event
// TODO require auth
router.post('/:eventId/uploadImage', upload.single('image'), async (req, res) => {
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
