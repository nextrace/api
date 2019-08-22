require('dotenv').config({ path: './.env' })
const fs = require('fs')
const express = require('express')


const Countries = require('./src/countries')
const Categories = require('./src/categories')
const Events = require('./src/events')


const apiAuth = (req, res, next) => {

	const allowedOrigins = ['https://nextrace.org', 'http://localhost']

	// API key checking & CORS
	if (allowedOrigins.includes(req.get('origin'))) {
		res.set('Access-Control-Allow-Origin', req.get('origin'))
	}

	next()
}

// App
const app = express()
app.use(apiAuth)

app.get('/', (req, res) => {
	res.json('Next Race APIs')
})

app.use('/categories', Categories)
app.use('/countries', Countries)
app.use('/events', Events)


app.listen(process.env.PORT || 8080, () => {
	console.log('Next Race API started')
})
