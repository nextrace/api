const knex = require('knex')
const { IncomingWebhook } = require('@slack/webhook')

exports.knex = knex({
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

exports.slack = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL)

exports.categoryFields = ['id', 'slug', 'name', 'name_short', 'color', 'emoji', 'priority']
exports.raceFields = ['event_id', 'id', 'name', 'category_id', 'grouping', 'date', 'time_limit', 'distance', {ascent: 'elevation'}, 'max_participants', 'link']
