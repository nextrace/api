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
