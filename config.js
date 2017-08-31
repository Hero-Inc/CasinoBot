module.exports = {

	// The secret token the bot uses to login
	botToken: ``,

	// The character placed before commands
	cmdPrefix: `>`,

	// The ID of the bot's owner, they have full access
	ownerID: ``,

	// The link sent when the 'GetLink' command is used
	inviteLink: 'www.example.com/invite?id=092735472813',

	// The URL for the mongoDB database to use
	connectionString: 'mongodb://localhost:27017/MrHeroBots',

	// The level of debug messages to show in the console
	consoleDebugLevel: 'info',

	// The level of debug messages shown in the log file
	fileDebugLevel: 'debug',

	// IDs of users who have admin permissions
	adminUsers: [
		'12345678',
		'09876556',
	],

	// IDs of roles who have admin permissions
	adminRoles: [
		'67929844',
		'09375322',
	],
};
