const { format } = require('date-fns')

const eventFields = ['event.name', 'event.slug', 'event.date', 'event.date_end', 'event.timezone', 'event.links', 'event.location_name', 'event.location_street', 'event.location_locality', 'event.location_county_state', {location_country: 'country.code'}, {location_country_name: 'country.name'}, 'event.location_lat_lng', 'event.category_tags']
const raceFields = ['event_id', 'id', 'name', 'category_id', 'category_tag', 'grouping', 'date', 'time_limit', 'distance', {ascent: 'elevation'}, 'max_participants', 'link', 'registration_url']

const processEvent = (event, mode) => {
	event.category_tags = JSON.parse(event.category_tags)
	event.links = JSON.parse(event.links)
	event.date = format(event.date, 'yyyy-MM-dd')

	if (mode !== 'edit') {
		for (const link in event.links) {
			if (event.links[link]) {
				event.links[link] = `https://api.nextrace.co/events/${event.slug}/link/${link}`
			} else {
				delete event.links[link]
			}
		}
	}

	return event
}

module.exports = {
	eventFields,
	raceFields,
	processEvent,
}
