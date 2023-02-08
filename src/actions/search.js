const crypto = require('crypto')
const { format } = require('date-fns')
const { uniq } = require('lodash')

const { knex, meilisearch } = require('../utils.js')

const indexPeople = async (limit = 100) => {
	console.log('[search index]', `start db query for ${limit} people`)
	let people = await knex('user')
						.where('search_indexed', 0)
						.where('meta', 'not like', '%new-email%') // exclude accounts with unverified email
						.limit(limit)

	console.log('[search index]', `found ${people.length} people`)

	if (people.length) {
		const peopleIds = people.map(p => p.id)
		const countries = await knex('country').select('id', 'code', 'name').whereIn('code', people.map(p => p.country_code))

		people = people.map(person => {
			const meta = JSON.parse(person.meta)
			let image = null

			if (person.picture_url) {
				image = person.picture_url

				if (!image.startsWith('https://')) {
					image = `https://files.nextrace.co/${image}`
				}
			} else {
				const hash = crypto.createHash('md5').update(person.email.trim().toLowerCase()).digest('hex')
				image = `https://www.gravatar.com/avatar/${hash}?s=100&d=https://files.layered.market/neutral-2.png`
			}

			return {
				id: `id_${person.id}`,
				name: person.name,
				slug: person.handle,
				status: person.visibility,
				number: person.followers,
				location: uniq([meta.city, countries.find(c => c.code == person.country_code).name]).filter(Boolean).map(s => s.trim()).join(', '),
				image,

				// person specific fields
				verified: person.verified,
			}
		})

		const searchIndex = meilisearch.index('search')

		console.log('[search index]', `sending ${people.length} documents to MeiliSearch`)
		const response = await searchIndex.addDocuments(people)
		console.log('[search index]', `sent ${people.length} documents to MeiliSearch "${response.indexUid}", Uid = ${response.taskUid}`)

		await knex('user').update('search_indexed', 1).whereIn('id', peopleIds)
		console.log('[search index]', `marked ${people.length} people as search indexed`)
	}

	return people
}

const indexEvents = async (limit = 100) => {
	console.log('[search index]', `start db query for ${limit} events`)
	let events = await knex('event').where('search_indexed', 0).whereIn('status', ['public', 'canceled']).limit(limit)

	console.log('[search index]', `found ${events.length} events`)

	if (events.length) {
		const eventsIds = events.map(p => p.id)
		const countries = await knex('country').select('id', 'name').whereIn('id', events.map(e => e.location_country_id))

		events = events.map(event => {
			return {
				id: `ev_${event.id}`,
				name: event.name,
				slug: event.slug,
				status: event.status,
				number: event.stat_views,
				location: uniq([event.location_name, event.location_locality, event.location_county_state, countries.find(c => c.id == event.location_country_id).name]).filter(Boolean).join(', '),
				image: `https://files.nextrace.co/events/${event.slug}-md.webp`,

				// event specific fields
				date: format(event.date, 'yyyy-MM-dd'),
				races: uniq([event.distance_min, event.distance_max]).map(d => `${d}km`).join(' - '),
				categories: JSON.parse(event.category_tags || '[]').join(', '),
			}
		})

		const searchIndex = meilisearch.index('search')

		console.log('[search index]', `sending ${events.length} documents to MeiliSearch`)
		const response = await searchIndex.addDocuments(events)
		console.log('[search index]', `sent ${events.length} documents to MeiliSearch "${response.indexUid}", Uid = ${response.taskUid}`)

		await knex('event').update('search_indexed', 1).whereIn('id', eventsIds)
		console.log('[search index]', `marked ${events.length} events as search indexed`)
	}

	return events
}

const indexOrganizers = async (limit = 100) => {
	console.log('[search index]', `start db query for ${limit} organizers`)
	let organizers = await knex('organizer').where('search_indexed', 0).whereIn('status', ['public', 'archived']).limit(limit)

	console.log('[search index]', `found ${organizers.length} organizers`)

	if (organizers.length) {
		const organizersIds = organizers.map(p => p.id)
		const countries = await knex('country').select('id', 'name').whereIn('id', organizers.map(e => e.country_id).filter(Boolean))

		organizers = organizers.map(organizer => {
			return {
				id: `og_${organizer.id}`,
				name: organizer.name,
				slug: organizer.slug,
				status: organizer.status,
				number: organizer.upcoming_events_count,
				location: organizer.country_id ? countries.find(c => c.id == organizer.country_id).name : '',
				image: organizer.logo_url ? `https://files.nextrace.co/${organizer.logo_url}` : 'https://nextrace.co/assets/icon-organizer.png',

				// organizer specific fields
				verified: organizer.verified,
			}
		})

		const searchIndex = meilisearch.index('search')

		console.log('[search index]', `sending ${organizers.length} documents to MeiliSearch`)
		const response = await searchIndex.addDocuments(organizers)
		console.log('[search index]', `sent ${organizers.length} documents to MeiliSearch "${response.indexUid}", Uid = ${response.taskUid}`)

		await knex('organizer').update('search_indexed', 1).whereIn('id', organizersIds)
		console.log('[search index]', `marked ${organizers.length} organizers as search indexed`)
	}

	return organizers
}

module.exports = {
	indexEvents,
	indexOrganizers,
	indexPeople,
}
