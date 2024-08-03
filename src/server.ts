import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv'; 
import fs from 'fs';
import axios from 'axios';
dotenv.config();
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
function readUserIds() {
    if (fs.existsSync('userids.json')) {
        const data = fs.readFileSync('db.json', 'utf-8');
        return JSON.parse(data);
    } else {
        return {};
    }
}
async function apikey(name: string) {
    try {
        const response = await axios.post(
            'https://gpt.anyvm.tech/v1/admin/create',
            { name },
            {
                headers: {
                    Authorization: 'Bearer (key-noshow)'
                }
            }
        );
        console.log( response.data);
        return response.data;
    } catch (error) {
        console.error(error);
    }
}
function writeUserIds(userIds: any) {
    const data = JSON.stringify(userIds);
    fs.writeFileSync('db.json', data, 'utf-8');
}
client.once('ready', async () => {
    console.log('online');
    await registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const userId = interaction.user.id;
    const userIds = readUserIds();

    if (interaction.commandName === 'userid') {
        await interaction.deferReply({ ephemeral: true });

        userIds[userId] = apikey(userId); 
        writeUserIds(userIds);

        await interaction.followUp({ content: userId, ephemeral: true });
    }
});