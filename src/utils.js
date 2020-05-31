const knex = require('knex')
const { IncomingWebhook } = require('@slack/webhook')

const knexConn = knex({
	client: 'mysql',
	connection: process.env.DATABASE_URL,
	pool: {
		min: 0,
		max: 10,
		afterCreate(conn, done) {
			console.log('Knex', 'threadId:', conn.threadId, 'uid:', conn.__knexUid)
			done(false, conn)
		}
	},
})


// debug SQL queries
if (process.env.NODE_ENV || 'dev' === 'dev') {
	let queries = {}

	knexConn.on('query', (query) => {
		queries[query.__knexQueryUid] = {
			order:	Object.keys(queries).length,
			sql:	query.sql,
			time:	process.hrtime.bigint(),
		}
	}).on('query-response', (response, query) => {
		queries[query.__knexQueryUid].time = Number(process.hrtime.bigint() - queries[query.__knexQueryUid].time) / 1e9

		console.log(queries[query.__knexQueryUid]);
	})
}


exports.knex = knexConn
exports.slack = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL)

exports.categoryFields = ['id', 'slug', 'name', 'name_short', 'color', 'emoji', 'priority', 'tags']
exports.raceFields = ['event_id', 'id', 'name', 'category_id', 'category_tag', 'grouping', 'date', 'time_limit', 'distance', {ascent: 'elevation'}, 'max_participants', 'link']
