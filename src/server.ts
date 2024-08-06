import { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, CommandInteractionOptionResolver, ComponentType, Message } from 'discord.js';
import dotenv from 'dotenv'; 
import fs from 'fs';
dotenv.config();
import { apikey, readUserIds, writeUserIds, readModels, clearHistory, setHistory, loadHistory, sendmessage, checkHistory, loadPublic, setPublic, copyHistory } from './utils';
import path from 'path';
const commands = JSON.parse(fs.readFileSync('src/commands.json', 'utf-8'));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});


client.login(process.env.TOKEN);
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}
client.once('ready', async () => {
    console.log('online');
    await registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const userId = interaction.user.id;
    const userIds = readUserIds();
   
   

    if (interaction.commandName === 'apikey') {
        await interaction.deferReply({ ephemeral: true });

        if (Object.keys(userIds).includes(userId)) {
            const existingApiKey = userIds[userId].apiKey;
            await interaction.followUp({ content: `Bearer ${existingApiKey}`, ephemeral: true });
        } else {
            const apiKey = await apikey(userId);
            userIds[userId] = { apiKey: apiKey, model: '' };
            writeUserIds(userIds);
            await interaction.followUp({ content: `Bearer ${apiKey}`, ephemeral: true });
        }
    } else if (interaction.commandName === 'models') {
        await interaction.deferReply({ ephemeral: true });
    
        if (!Object.keys(userIds).includes(userId)) {
            const apiKey = await apikey(userId);
            userIds[userId] = { apiKey: apiKey, model: '' };
            await writeUserIds(userIds);
            await interaction.followUp({ content: `API key created: Bearer ${apiKey}`, ephemeral: true });
        }
    
        const options = interaction.options as CommandInteractionOptionResolver;
        const selectedModel = options.getString('model');
    
        if (selectedModel) {
            userIds[userId].model = selectedModel;
            await writeUserIds(userIds);
            await interaction.followUp({ content: `Model ${selectedModel} selected.`, ephemeral: true });
        } else {
            const models = await readModels();
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(interaction.id)
                .setPlaceholder('Select a model')
                .addOptions(
                    models.map((model: string) => 
                        new StringSelectMenuOptionBuilder()
                            .setLabel(model)
                            .setValue(model)
                    )
                );
    
            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    
            await interaction.editReply({
                content: 'Please select a model:',
                components: [row],
            });
    
            const collector = interaction.channel?.createMessageComponentCollector({ 
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === userId && i.customId === interaction.id,
                time: 60000
            });
    
            if (collector) {
                collector.on('collect', async i => {
                    const selectedModel = i.values[0];
                    userIds[userId].model = selectedModel;
                    await writeUserIds(userIds);
                    await i.update({ content: `Model ${selectedModel} selected.`, components: [] });
                });
            } else {
                await interaction.followUp({ content: 'No model selected.', ephemeral: true });
            }
        }
    }
    else if (interaction.commandName === 'custom') {
        await interaction.deferReply({ ephemeral: true });
    
        if (!Object.keys(userIds).includes(userId)) {
            const apiKey = await apikey(userId);
            userIds[userId] = { apiKey: apiKey, model: '' };
            await writeUserIds(userIds);
            await interaction.followUp({ content: `API key created: Bearer ${apiKey}`, ephemeral: true });
        }
    
        const options = interaction.options as CommandInteractionOptionResolver;
        const customModel = options.getString('model');
    
        if (customModel) {
            userIds[userId].model = customModel;
            await writeUserIds(userIds);
            await interaction.followUp({ content: `Custom model ${customModel} selected.`, ephemeral: true });
        } else {
            await interaction.followUp({ content: 'Please provide a custom model name.', ephemeral: true });
        }
    }

});

client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const prefix = '!';
    const botMention = `<@${client.user?.id}>`;

    if (message.content.startsWith(prefix)) {
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();

        if (command === 'mem') {
            const subCommand = args.shift()?.toLowerCase();

            if (subCommand === 'load') {
                const historyId = args[0];
                if (!historyId) {
                    message.reply('Please provide a history ID.');
                    return;
                }
                loadHistory(message, historyId);
            } else if (subCommand === 'set') {
                const historyId = args[0];
                if (!historyId) {
                    message.reply('Please provide a history ID.');
                    return;
                }
                setHistory(message, historyId);
            } else if (subCommand === 'clear') {
                clearHistory(message);
            } else if (subCommand === 'check') {
                checkHistory(userId, message);
            } else if (subCommand === 'save') {
                const historyId = args[0];
                if (!historyId) {
                    message.reply('Please provide a history ID.');
                    return;
                }
                setHistory(message, historyId);
            } else if (subCommand === 'copy') {
                let historyId = args[0];
                if (!historyId) {
                    const dbFilePath = path.join('src', 'db.json');
                    try {
                        const dbContent = await fs.promises.readFile(dbFilePath, 'utf-8');
                        const db = JSON.parse(dbContent);
                        if (db[userId] && db[userId].historyFilePath) {
                            historyId = db[userId].historyFilePath;
                        } else {
                            message.reply('No history file path found for user ID in db.json.');
                            return;
                        }
                    } catch (error) {
                        console.error('Error reading db.json:', error);
                        message.reply('An error occurred while accessing the database.');
                        return;
                    }
                }
                copyHistory(message, historyId);
            } else if (subCommand === 'setpublic') {
                let historyId = args[0];
                if (!historyId) {
                    const dbFilePath = path.join('src', 'db.json');
                    try {
                        const dbContent = await fs.promises.readFile(dbFilePath, 'utf-8');
                        const db = JSON.parse(dbContent);
                        if (db[userId] && db[userId].historyFilePath) {
                            historyId = db[userId].historyFilePath;
                        } else {
                            message.reply('No history file path found for user ID in db.json.');
                            return;
                        }
                    } catch (error) {
                        console.error('Error reading db.json:', error);
                        message.reply('An error occurred while accessing the database.');
                        return;
                    }
                }
                setPublic(message, historyId);
            } else if (subCommand === 'loadpublic') {
                const historyId = args[0];
                if (!historyId) {
                    message.reply('Please provide a history ID.');
                    return;
                }
                loadPublic(message, historyId);
            } else {
                message.reply('Unknown subcommand. Use `!mem load <historyid>`, `!mem set <historyid>`, `!mem clear`, `!mem check`, `!mem save <historyid>`, `!mem copy <sourceHistoryId> <targetHistoryId>`, `!mem public <historyid>`, or `!mem loadpublic <historyid>`.');
            }
        }
    } else if (message.content.includes(botMention)) {
        const args = message.content.split(/ +/).slice(1);
        // Handle bot mention logic here
    }
});