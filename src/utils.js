const knex = require('knex')
const { IncomingWebhook } = require('@slack/webhook')

exports.knex = knex(process.env.DATABASE_URL)
exports.slack = new IncomingWebhook(process.env.SLACK_WEBHOOK_URL)
