const util = require('util')
const mysql = require('mysql')

const dbConnection = mysql.createConnection(process.env.DATABASE_URL)

dbConnection.connect(err => {
	if (err) {
		console.error('[DB] error connecting: ' + err.stack)
		return;
	}

	console.log('[DB] connected as id ' + dbConnection.threadId)
})

exports.dbConnection = dbConnection
exports.dbQuery = util.promisify(dbConnection.query.bind(dbConnection))
