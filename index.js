require('dotenv').config({ path: './.env' })
const express = require('express')


const apiAuth = (req, res, next) => {
	const allowedOrigins = ['https://nextrace.co', 'https://app.nextrace.co', 'http://localhost', 'http://localhost:3000', 'http://localhost:8080', 'capacitor://localhost', 'https://nextrace-app.pages.dev', 'http://nextrace.test', 'https://trailrunningacademy.com']
	req.auth = false

	// API Key check for registered Apps
	// AccessToken check for users

	if (allowedOrigins.includes(req.get('origin'))) {
		res.set('Access-Control-Allow-Origin', req.get('origin'))
		res.set('Access-Control-Allow-Headers', 'content-type')
		res.set('Access-Control-Allow-Methods', 'GET,POST,HEAD,PUT,DELETE')
		req.auth = true
	} else if (req.hostname === 'localhost' || (req.query['serviceToken'] && process.env.SERVICE_TOKEN === req.query.serviceToken)) {
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
app.set('port', process.env.PORT || 8080)
app.use(apiAuth)
app.use(express.json())

app.get('/', (req, res) => {
	res.json('NextRace APIs')
})

app.use('/analytics', require('./src/controllers/analytics'))
app.use('/categories', require('./src/controllers/categories'))
app.use('/countries', require('./src/controllers/countries'))
app.use('/events', require('./src/controllers/events'))
app.use('/organizers', require('./src/controllers/organizers'))
app.use('/person', require('./src/controllers/person'))
app.use('/people', require('./src/controllers/people'))
app.use('/ask-kilian', require('./src/controllers/bot'))


app.listen(app.get('port'), () => {
	const url = `http://localhost:${app.get('port')}`
	console.log(`Next Race API started at ${url}`)
})
