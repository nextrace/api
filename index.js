require('dotenv').config({ path: './.env' })
const express = require('express')


const Countries = require('./src/countries')
const Categories = require('./src/categories')
const Events = require('./src/events')
const Organizers = require('./src/organizers')


const apiAuth = (req, res, next) => {
	const allowedOrigins = ['https://nextrace.org', 'http://localhost']
	req.auth = false

	// API key checking & CORS
	if (allowedOrigins.includes(req.get('origin'))) {
		res.set('Access-Control-Allow-Origin', req.get('origin'))
		req.auth = true
	} else if (req.hostname === 'localhost') {
		req.auth = true
	} else {
		console.warn('unauthorised request', {
			referer:	req.get('referer'),
			origin:		req.get('origin'),
		})
		res.set('WWW-Authenticate', 'Bearer realm="See https://nextrace.org/developers/api-authentication"')

		//return res.status(401).json('Authentication required')
	}

	next()
}


// App
const app = express()
app.use(apiAuth)

app.get('/', (req, res) => {
	res.json('NextRace APIs')
})

app.use('/categories', Categories)
app.use('/countries', Countries)
app.use('/events', Events)
app.use('/organizers', Organizers)


app.listen(process.env.PORT || 8080, () => {
	console.log('Next Race API started')
})
