'use strict';
const Discord = require('eris');
const Mongo = require('mongodb');
const Winston = require('winston');

const codes = require('./codes.js');

var config = require('./config.js');
var db;
// Setup winston logging
var log = new Winston.Logger({
	transports: [
		new Winston.transports.Console({
			handleExceptions: true,
			level: config.consoleDebugLevel === undefined ? 'info' : config.consoleDebugLevel,
		}),
		new Winston.transports.File({
			filename: '../logs/musicBot.log',
			handleExceptions: true,
			level: config.fileDebugLevel === undefined ? 'debug' : config.fileDebugLevel,
		}),
	],
	exitOnError: false,
});

// Make the owner an admin
log.debug('Adding owner to adminUsers');
config.adminUsers.push(config.ownerID);

log.debug('Creating commands array');
var commands = [
	[
		'Ping',
		'Pong!',
		{
			description: 'Replies "Pong!"',
		},
	],
	[
		'SetPrefix',
		(msg, args) => {
			if (args.length <= 1) {
				let prefix = null;
				if (args.length === 1) {
					prefix = args[0];
				}
				db.collection('guildData')
					.update({
						_id: msg.channel.guild.id,
					}, {
						$set: {
							prefix: prefix,
						},
					}, {
						upsert: true,
					})
					.then(result => {
						if (result.writeError) {
							log.error(`Issue setting bot prefix for guildID ${msg.channel.guild.id}`, {
								ReportedError: result.writeError.errmsg,
							});
							bot.createMessage(msg.channel.id, 'There was an error saving settings for this guild.');
						} else {
							bot.registerGuildPrefix(msg.channel.guild.id, prefix === null ? config.cmdPrefix : prefix);
							log.debug(`Succesfully set bot prefix for guildID ${msg.channel.guild.id}`);
							bot.createMessage(msg.channel.id, `Succesfully set command prefix to ${prefix === null ? config.cmdPrefix : prefix}`);
						}
					});
			} else {
				log.debug('Bad Syntax. Prefix not set');
				return 'Please supply one word or character to use as the command prefix';
			}
		},
		{
			aliases: ['Prefix', 'cmdPrefix', '~'],
			description: 'Set the command prefix',
			fullDescription: 'Sets the prefix used before commands for this bot, only on this guild.\n Set it to "@mention" to use the bots mention as the prefix. e.g., "@musicBot Help"',
			usage: 'SetPrefix <prefix>',
			guildOnly: true,
			requirements: {
				permissions: {
					administrator: true,
				},
			},
		},
	],
	[
		'GetLink',
		config.inviteLink === undefined || config.inviteLink === '' ? 'Sorry, an invite link has not been configured by the bot owner.' : config.inviteLink,
		{
			aliases: ['Link', 'AddURL', '&'],
			description: 'Add me to a guild',
			fullDescription: 'Return a link which you can use to add me to your own guild.',
		},
	],
	[
		'Shutdown',
		(msg, args) => {
			bot.createMessage(msg.channel.id, 'Shutting down, bye.')
				.then(() => {
					process.kill(process.pid, 'SIGINT');
				});
		},
		{
			aliases: ['kill', 'x-x'],
			description: 'Shutdown the bot',
			fullDescription: 'Stops the bot process.',
			requirements: {
				userIDs: [config.botOwner],
			},
		},
	],
	[
		'Balance',
		(msg, args) => {
			db.collection('users')
				.findOne({
					_id: msg.author.id,
				}, (err, result) => {
					if (err) {
						log.error('There was an error checking balance of user.', {
							UserID: msg.author.id,
							reportedError: err,
						});
						return bot.createMessage(msg.channel.id, 'Error retrieving balance');
					}
					bot.createMessage(msg.channel.id, `Your current balance is ${result.balance}`);
				});
		},
		{
			aliases: ['Money', 'Ammount', 'Tokens'],
			description: 'Check your current balance',
			fullDescription: 'Return how many CasinoBot Tokens you currently own.',
		},
	],
	[
		'Give',
		(msg, args) => {
			let amt = parseInt(args[0]),
				users = msg.mentions;
			if (args.length < 2 || isNaN(amt) || amt < 1 || users.length !== 1) {
				return 'Syntax error, please refer to "Help Give" for information on how to use this command.';
			}
			db.collection('users')
				.update({
					_id: msg.author.id,
					balance: {
						$gte: amt,
					},
				}, {
					$inc: {
						balance: -amt,
					},
				})
				.then(result => {
					if (result.writeError) {
						log.error(`Issue setting user balance for (ID: ${users[0].id})`, {
							ReportedError: result.writeError.errmsg,
						});
						bot.createMessage(msg.channel.id, 'There was an error updating that users balance.');
					} else {
						db.collection('users')
							.update({
								_id: users[0].id,
							}, {
								$setOnInsert: {
									balance: 0,
								},
								$inc: {
									balance: amt,
								},
							}, {
								upsert: true,
							})
							.then(result2 => {
								if (result2.writeError) {
									log.error(`Issue setting user balance for (ID: ${users[0].id})`, {
										ReportedError: result2.writeError.errmsg,
									});
									bot.createMessage(msg.channel.id, 'There was an error updating that users balance.');
								} else {
									log.debug(`${msg.author.id} succesfully gave \`${amt}\` tokens to ${users[0].id}`);
									bot.createMessage(msg.channel.id, `Succesfully gave \`${amt}\` tokens to ${users[0].username}`);
								}
							});
					}
				});
		},
		{
			aliases: ['Transfer', 'GiveTokens'],
			description: 'Give your tokens to someone else',
			fullDescription: 'Give the specified ammount of tokens from your account to the mentioned users account.',
			usage: 'Give <ammount> <@user>',
		},
	],
	[
		'CreateTokens',
		(msg, args) => {
			// For now this only works with one user, maybe more later
			let amt = parseInt(args[0]),
				users = msg.mentions;
			if (args.length < 2 || isNaN(amt) || users.length !== 1) {
				return 'Syntax error, please refer to "Help CreateTokens" for information on how to use this command.';
			}
			db.collection('users')
				.updateOne({
					_id: users[0].id,
				}, {
					$setOnInsert: {
						balance: 0,
					},
					$inc: {
						balance: amt,
					},
				}, {
					upsert: true,
				})
				.then(result => {
					if (result.writeError) {
						log.error(`Issue setting user balance for (ID: ${users[0].id})`, {
							ReportedError: result.writeError.errmsg,
						});
						bot.createMessage(msg.channel.id, 'There was an error updating that users balance.');
					} else {
						log.debug(`Succesfully added \`${amt}\` tokens to ${users[0].id}`);
						bot.createMessage(msg.channel.id, `Succesfully added \`${amt}\` tokens to ${users[0].username}'s account`);
					}
				});
		},
		{
			aliases: ['Create', 'NewTokens'],
			description: 'Add tokens to a users account',
			fullDescription: 'Add a specified ammount of CasinoBot Tokens to a mentioned user. \nOnly use whole numbers; Token ammount will be rounded down to nearest whole number.',
			usage: 'CreateTokens <ammount> <@user>',
			argsRequired: true,
			requirements: {
				userIDs: config.adminUsers,
				roleIDs: config.adminRoles,
			},
		},
	],
	[
		'Play',
		(msg, args) => {
			// Eventually I might create a house account thing
		},
		{
			aliases: ['Game', 'Gamble', 'Bet', 'P'],
			description: 'Play a game',
			fullDescription: 'Gamble some tokens in a game to try and win more.',
			usage: 'Play <game> <ammount> <gameOptions>',
			argsRequired: true,
		},
		[
			[
				'Dice',
				(msg, args) => {
					let amt = parseInt(args[0]),
						num = parseInt(args[1]);
					if (args.length !== 2 || isNaN(amt) || amt < 1 || num < 1 || num > 6) {
						return 'Incorrect syntax, please refer to "Help Play Dice" to learn how to play';
					}
					db.collection('users')
						.findOne({
							_id: msg.author.id,
						}, {
							balance: 1,
						}, (err, result) => {
							if (err) {
								log.error('There was an error retrieving user balance', {
									userID: msg.author.id,
									ReportedError: err,
								});
								return bot.createMessage(msg.channel.id, 'There was an error retrieving your balance');
							}
							if (result.balance < amt) {
								return bot.createMessage(msg.channel.id, 'You can\'t bet that much');
							}
							let roll = Math.floor((Math.random() * 6) + 1);
							bot.createMessage(msg.channel.id, `You rolled a ${roll}`);
							db.collection('users')
								.update({
									_id: msg.author.id,
								}, {
									$inc: {
										balance: roll === num ? 5 * amt : -amt,
									},
								})
								.then(result2 => {
									if (result2.writeError) {
										log.error(`Issue setting user balance for (ID: ${msg.author.id})`, {
											ReportedError: result2.writeError.errmsg,
										});
										bot.createMessage(msg.channel.id, 'There was an error updating your balance. You have not lost anything.');
									} else if (roll === num) {
										log.debug(`${msg.author.id} succesfully won ${5 * amt} tokens by playing Dice (Roll: ${roll}, Guess: ${num})`);
										bot.createMessage(msg.channel.id, `Congratulations, you won \`${5 * amt}\` Tokens`);
									} else {
										log.debug(`${msg.author.id} succesfully lost ${amt} tokens by playing Dice (Roll: ${roll}, Guess: ${num})`);
										bot.createMessage(msg.channel.id, `Better luck next time.`);
									}
								});
						});
				},
				{
					aliases: ['Roll', 'D'],
					description: 'Play a game of dice',
					fullDescription: 'Choose a number between 1 and 6 then roll a die, if your chosen number is rolled, you win.',
					usage: 'Play Dice <ammount> <number>',
					argsRequired: true,
				},
			],
			[
				'Roulette',
				(msg, args) => {
					let spin = Math.floor((Math.random() * 50) + 1),
						bet = 0,
						wins = 0,
						winamt = 0;
					for (let i = 0; i < args.length; i++) {
						let code = args[i].split('@')[0].toLowerCase(),
							amt = parseInt(args[i].split('@')[1]);
						if (!codes.includes(code) || isNaN(amt) || amt < 1) {
							return 'Invalid code detected, try again';
						}
						bet += amt;
						if (codes[code][1](spin)) {
							wins++;
							winamt += codes[code][0] * amt;
						}
					}
					db.collection('users')
						.findOne({
							_id: msg.author.id,
						}, {
							balance: 1,
						}, (err, result) => {
							if (err) {
								log.error('There was an error retrieving user balance', {
									userID: msg.author.id,
									ReportedError: err,
								});
								return bot.createMessage(msg.channel.id, 'There was an error retrieving your balance');
							}
							if (result.balance < bet) {
								return bot.createMessage(msg.channel.id, 'You can\'t bet that much');
							}
							if (spin === 37) spin = '0';
							else if (spin === 38) spin = '00';
							bot.createMessage(msg.channel.id, `You spun the wheel and it landed on ${spin}`);
							db.collection('users')
								.update({
									_id: msg.author.id,
								}, {
									$inc: {
										balance: winamt - bet,
									},
								})
								.then(result2 => {
									if (result2.writeError) {
										log.error(`Issue setting user balance for (ID: ${msg.author.id})`, {
											ReportedError: result2.writeError.errmsg,
										});
										bot.createMessage(msg.channel.id, 'There was an error updating your balance. You have not lost anything.');
									} else if (wins > 0) {
										log.debug(`${msg.author.id} succesfully won ${winamt} tokens by playing roulette (totalBet: ${bet}, Spun:${spin})`);
										bot.createMessage(msg.channel.id, `Congratulations, you bet \`${bet}\` tokens and won \`${winamt}\` tokens. \`${wins}/${args.length} bets won\``);
									} else {
										log.debug(`${msg.author.id} succesfully lost ${bet} tokens by playing roulette (Spun: ${spin})`);
										bot.createMessage(msg.channel.id, `You didn't win, better luck next time.`);
									}
								});
						});
				},
				{
					aliases: ['Spin', 'R'],
					description: 'Play a game of roulette',
					fullDescription: 'Place bets on certain results of a roulette spin using defined codes (shown below) @ an ammount. You can enter multiple "code@ammount"s.\nExample: "Play Roulette 16@10" to bet 10 tokens on 16.\nAll numbers codes are simply their number. Use "red" or "black" for colours. Use "odd" or "even" for odd or even numbers. Use "low" or "high" for each half. Use "112", "212" or "312" for each set of 12. Use "121", "221" or "321" for each respective 2 to 1.',
					usage: 'Play Roullete <code@ammount>...',
					argsRequired: true,
				},
			],
		],
	],
];

log.debug('Creating bot');
var bot = new Discord.CommandClient(
	config.botToken, {
		// Bot Options
	}, {
		// Command Options
		description: 'A bot to play games and waste money',
		owner: 'Mr Hero#6252',
		defaultCommandOptions: {
			caseInsensitive: true,
			deleteCommand: true,
			cooldownMessage: 'You\'re using this command faster than I can cool down.',
			permissionMessage: 'You don\'t have permissions for that command.',
			errorMessage: '[ERROR] Something went wrong processing that command, try again later and if errors persist contact your administrator.',
		},
	}
);

log.debug('Creating bot event listeners');
bot
	.on('error', err => {
		log.error(`ERIS Error`, {
			ReportedError: err,
		});
	})
	.on('warn', err => {
		log.warn(`ERIS Warning`, {
			ReportedError: err,
		});
	})
	.on('messageCreate', msg => {
		if (msg.command) {
			log.verbose('Command Recieved', {
				author: `"${msg.author.username}#${msg.author.discriminator}"`,
				msg: msg.content,
			});
		}
	})
	.on('guildAvailable', guild => {
		log.debug('Added to new guild, checking for data.');
		db.collection('guildData')
			.find({
				_id: guild.id,
			})
			.toArray((err, data) => {
				if (err) {
					return log.error(`Failed to retrieve Guild Data from database.`, {
						ReportedError: err,
					});
				}
				if (data[0] !== undefined) {
					bot.registerGuildPrefix(guild.id, data[0].prefix === undefined ? config.cmdPrefix : data[0].prefix);
				}
				log.debug('New guild data retrieved');
			});
	})
	.on('ready', () => {
		// Set the botPrefix on server that have previously used the SetPrefix command
		log.debug('Setting up saved guild Data');
		let guilds = {};
		db.collection('guildData')
			.find({})
			.toArray((err, data) => {
				if (err) {
					return log.error(`Failed to retrieve Guild Data from database.`, {
						ReportedError: err,
					});
				}
				for (let i = 0; i < data.length; i++) {
					guilds[data._id] = data[i];
				}
				bot.guilds.forEach((guild) => {
					bot.registerGuildPrefix(guild.id, guilds[guild.id] === undefined || guilds[guild.id].prefix === undefined ? config.cmdPrefix : guilds[guild.id].prefix);
				});
				log.debug('Guild data retrieved set');
			});
		log.info('Bot ready');
	});

function initialise() {
	log.verbose('Initialising bot instance');
	process.on('SIGINT', () => {
		log.info('Shutting Down');
		bot.disconnect();
		db.close(false, () => {
			process.exit();
		});
	});
	log.debug('Registering commands');
	for (let i = 0; i < commands.length; i++) {
		let cmd = bot.registerCommand(commands[i][0], commands[i][1], commands[i][2]);
		if (commands[i][3]) {
			for (let j = 0; j < commands[i][3].length; j++) {
				cmd.registerSubCommand(commands[i][3][j][0], commands[i][3][j][1], commands[i][3][j][2]);
			}
		}
	}
	commands = null;
	log.debug('Connecting to Discord.');
	bot.connect();
}

log.verbose('Connecting to MongoDB', {
	link: config.connectionString,
});
Mongo.MongoClient.connect(config.connectionString, (err, database) => {
	if (err) {
		log.error('MongoDB connection failed. Retrying ...', {
			ReportedError: err,
		});
		// Wait 3 seconds to try again
		setTimeout(
			Mongo.MongoClient.connect.bind(null, config.connectionString, (err2, database2) => {
				if (err) {
					log.error('MongoDB connection failed. Retrying ...', {
						ReportedError: err2,
					});
					// Wait 3 seconds to try again
					setTimeout(
						Mongo.MongoClient.connect.bind(null, config.connectionString, (err3, database3) => {
							if (err) {
								return log.error('MongoDB connection failed. Please check connectionString in config and try again.', {
									ReportedError: err3,
								});
							}
							log.verbose('Connected to Mongodb');
							db = database3;
							initialise();
						}),
						3000
					);
					return;
				}
				log.verbose('Connected to Mongodb');
				db = database2;
				initialise();
			}),
			3000
		);
		return;
	}
	log.verbose('Connected to Mongodb');
	db = database;
	initialise();
});
