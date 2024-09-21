// Import necessary libraries
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { exec } = require('child_process'); // For restarting the bot
require('dotenv').config(); // Load environment variables from .env file

// Channel and role IDs (replace with your IDs)
const logChannelId = '1287103715773382686';
const statusChannelId = '1287106730052026432';
const requiredRoleId = '1287110105359323136';

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Log commands to a specific channel
async function logCommand(command, user) {
  const logChannel = client.channels.cache.get(logChannelId);
  
  if (!logChannel) {
    console.error(`Log channel with ID ${logChannelId} not found.`);
    return;
  }

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const logMessage = `**${timestamp} EST** - Command: \`${command}\` executed by: **${user.tag}** (ID: ${user.id})`;
  
  await logChannel.send(logMessage);
}

// Send and delete confirmation messages
async function sendAndDeleteConfirmation(channel, content) {
  const confirmation = await channel.send(content);
  setTimeout(() => {
    confirmation.delete().catch(err => console.error('Failed to delete confirmation message:', err));
  }, 5000);
}

// Update the status channel with the bot's current status
async function updateStatus(status) {
  const statusChannel = client.channels.cache.get(statusChannelId);
  if (statusChannel) {
    await statusChannel.send(`Bot is currently **${status}**.`);
  } else {
    console.error(`Status channel with ID ${statusChannelId} not found.`);
  }
}

// Bot is ready
client.once('ready', () => {
  console.log('Bot is online!');
  updateStatus('online');
});

// Bot is offline
client.on('shardDisconnect', () => updateStatus('offline'));

// Respond to messages
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore bot messages

  const commandHandlers = {
    '!cmds': async () => {
      if (!message.member.roles.cache.has(requiredRoleId)) {
        return message.reply('You do not have the required role to use this command.');
      }

      const commandsEmbed = new EmbedBuilder()
        .setColor(0xeb0101)
        .setTitle('📜 Available Commands')
        .setDescription('Here are the commands you can use:')
        .addFields(
          { name: '!exchange', value: 'Triggers the exchange embed message with payment options.' },
          { name: '!clear <number>', value: 'Clears a specified number of messages (1-100).' },
          { name: '!purge', value: 'Purges all messages in the channel.' },
          { name: '!restart', value: 'Restarts the bot (admin only).' },
          { name: '!sync', value: 'Syncs the code and restarts the bot (admin only).' },
          { name: '!cmds', value: 'Displays this list of commands.' }
        )
        .setTimestamp();

      await message.channel.send({ embeds: [commandsEmbed] });
      await logCommand('!cmds', message.author);
    },

    '!exchange': async () => {
      const paymentOptions = new StringSelectMenuBuilder()
        .setCustomId('exchange_select')
        .setPlaceholder('Select Option')
        .addOptions([
          {
            label: 'PayPal',
            description: '10% Fee',
            value: 'paypal',
          },
          {
            label: 'Cashapp',
            description: '7-10% Fee',
            value: 'cashapp',
          },
          {
            label: 'Visa Giftcard',
            description: '15% Fee',
            value: 'visa_giftcard',
          },
          {
            label: 'Cryptocurrency',
            description: '5% Fee',
            value: 'crypto',
          },
        ]);

      const row = new ActionRowBuilder().addComponents(paymentOptions);

      const embed = new EmbedBuilder()
        .setColor(0xeb0101)
        .setTitle('💱 Yen Exchange - Request an Exchange')
        .setDescription('Easily request an exchange by selecting the appropriate payment option below. Follow the instructions provided and ensure all fields are correctly filled.')
        .addFields(
          { name: '📜 **Terms of Service**', value: 'Please read our [terms-of-service](https://discord.com/channels/1280756986669174825/1287095676441722940) before proceeding with any exchange to understand our policies.' },
          { name: '💵 **Minimum Fees**', value: 'Our minimum service fee is **$5.00 USD**. This fee applies to every exchange and is non-negotiable.' },
          { name: '📝 **How It Works**', value: '1. Select a payment option below.\n2. Provide the required details.\n3. Wait for confirmation.' }
        )
        .setTimestamp()
        .setFooter({
          text: 'Yen Exchange - Providing seamless currency exchanges.',
          iconURL: 'https://path-to-logo.png',
        });

      await message.channel.send({ embeds: [embed], components: [row] });
      await logCommand('!exchange', message.author);
      await message.delete(); // Delete the user's command message
    },

    '!clear': async () => {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.reply('You do not have permission to use this command.');
      }

      const args = message.content.split(' ');
      const amount = parseInt(args[1]);

      if (isNaN(amount) || amount < 1 || amount > 100) {
        return message.reply('Please provide a number between 1 and 100 for the number of messages to delete.');
      }

      try {
        const deletedMessages = await message.channel.bulkDelete(amount, true);
        await sendAndDeleteConfirmation(message.channel, `Successfully deleted ${deletedMessages.size} messages.`);
        await logCommand(`!clear ${amount}`, message.author);
      } catch (err) {
        console.error(err);
        message.reply('There was an error trying to clear messages in this channel!');
      }
    },

    '!purge': async () => {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.reply('You do not have permission to use this command.');
      }

      let deleted;
      do {
        deleted = await message.channel.bulkDelete(100, true).catch(err => {
          console.error(err);
          message.reply('There was an error trying to purge messages in this channel!');
        });
      } while (deleted.size !== 0);

      await sendAndDeleteConfirmation(message.channel, 'All messages have been purged!');
      await logCommand('!purge', message.author);
    },

    '!restart': async () => {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('You do not have permission to use this command.');
      }

      const statusChannel = client.channels.cache.get(statusChannelId);
      if (statusChannel) {
        await statusChannel.send('Bot is going offline for a restart...');
      }

      await updateStatus('offline'); // Update status before restarting
      await sendAndDeleteConfirmation(message.channel, 'Restarting the bot...');

      exec('node your-bot-file.js', (error, stdout) => {
        if (error) {
          console.error(`Error restarting the bot: ${error}`);
          return message.channel.send('There was an error restarting the bot.');
        }
        console.log(`Bot restarted:\n${stdout}`);
      });

      process.exit();
    },

    '!sync': async () => {
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('You do not have permission to use this command.');
      }

      const statusChannel = client.channels.cache.get(statusChannelId);
      if (statusChannel) {
        await statusChannel.send('Bot is syncing code and restarting...');
      }

      await sendAndDeleteConfirmation(message.channel, 'Syncing code...');

      exec('git pull && npm install', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error syncing code: ${error}`);
          return message.channel.send('There was an error syncing the code.');
        }
        console.log(`Sync output:\n${stdout}`);
        if (stderr) console.error(`Sync stderr:\n${stderr}`);
        
        // Restart the bot after syncing
        exec('node your-bot-file.js', (restartError, restartStdout) => {
          if (restartError) {
            console.error(`Error restarting the bot: ${restartError}`);
            return message.channel.send('There was an error restarting the bot.');
          }
          console.log(`Bot restarted:\n${restartStdout}`);
        });

        process.exit();
      });
    }
  };

  // Execute the command if it exists
  const command = message.content.split(' ')[0];
  if (commandHandlers[command]) {
    await commandHandlers[command]();
  }
});

// Listen to interactionCreate for handling dropdowns
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'exchange_select') {
    const selectedOption = interaction.values[0]; // Get the selected option

    let responseEmbed;
    let receiveOptions = [];

    // Check if they selected 'crypto'
    if (selectedOption === 'crypto') {
      // Set the custom message for selecting crypto
      responseEmbed = new EmbedBuilder()
        .setColor(0xeb0101)
        .setTitle('Sending Crypto')
        .setDescription('You have selected **Cryptocurrency** as your sending payment. What crypto will you be sending?')
        .setTimestamp();

      // Define the options for specific cryptocurrencies
      receiveOptions = [
        {
          label: 'BTC (Bitcoin)',
          description: '5% Fee',
          value: 'btc',
        },
        {
          label: 'LTC (Litecoin)',
          description: '5% Fee',
          value: 'ltc',
        },
        {
          label: 'ETH (Ethereum)',
          description: '5% Fee',
          value: 'eth',
        },
      ];
    } else {
      // Default response for other payment methods
      responseEmbed = new EmbedBuilder()
        .setColor(0xeb0101)
        .setTitle('Receiving Payment')
        .setDescription(`You have selected **${selectedOption}** as your sending payment. What would you like to **receive**?`)
        .setTimestamp();

      // Define the receiving options based on the selected payment
      if (selectedOption === 'paypal') {
        receiveOptions = [
          {
            label: 'CashApp',
            description: '6-10% Fee',
            value: 'CashApp',
          },
          {
            label: 'Crypto',
            description: '8-11% Fee',
            value: 'Crypto',
          },
        ];
      } else if (selectedOption === 'cashapp') {
        receiveOptions = [
          {
            label: 'Paypal',
            description: '10% Fee',
            value: 'Paypal',
          },
          {
            label: 'Crypto',
            description: '8-11% Fee',
            value: 'Crypto',
          },
        ];
      } else if (selectedOption === 'visa_giftcard') {
        receiveOptions = [
          {
            label: 'Paypal',
            description: '10% Fee',
            value: 'Paypal',
          },
          {
            label: 'CashApp',
            description: '8% Fee',
            value: 'cashapp',
          },
          {
            label: 'Crypto',
            description: '8-11% Fee',
            value: 'Crypto',
          },
        ];
      }
    }

    // Create the select menu for the user to choose the receiving payment
    const receiveMenu = new StringSelectMenuBuilder()
      .setCustomId('receive_select')
      .setPlaceholder('Select Receiving Option')
      .addOptions(receiveOptions);

    const row = new ActionRowBuilder().addComponents(receiveMenu);

    // Send the response to the user
    await interaction.reply({ 
      embeds: [responseEmbed], 
      components: [row], 
      ephemeral: true, // Ensures only the user sees the message
    });
  }
});

// Log in the bot
client.login(process.env.BOT_TOKEN);
