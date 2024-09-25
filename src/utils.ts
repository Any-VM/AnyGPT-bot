import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv'; 
dotenv.config();
const apiKey = process.env.API_KEY
const DISCORD_MAX_MESSAGE_LENGTH = 2000;
export function readUserIds() {
    const dbFilePath = path.join('src', 'db.json');
    if (fs.existsSync(dbFilePath)) {
        const data = fs.readFileSync(dbFilePath, 'utf-8');
        return JSON.parse(data);
    } else {
        throw new Error(`File not found: ${dbFilePath}`);
    }
}

export function writeUserIds(userIds: any) {
    const dbDirPath = path.join('src');
    const dbFilePath = path.join(dbDirPath, 'db.json');

    if (!fs.existsSync(dbDirPath)) {
        fs.mkdirSync(dbDirPath, { recursive: true });
    }

    const data = JSON.stringify(userIds, null, 2);
    fs.writeFileSync(dbFilePath, data, 'utf-8');
}
export async function readModels() {
    if (fs.existsSync('src/models.json')) {
        const data = fs.readFileSync('src/models.json', 'utf-8');
        const models = JSON.parse(data);
        return models.data.map((model: any) => model.id);
    } else {
        return [];
    }
}
export async function key(name: string) {
    try {
        const response = await axios.post(
            `${process.env.URL}`,
            { name },
            {
                headers: {
                    Authorization: `Bearer ${process.env.ADMIN_KEY}`
                }
            }
        );
        const key = response.data.result.key;
        console.log(key);
        return key;
    } catch (error) {
        console.error(error);
    }
}

function splitMessage(message: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < message.length) {
        let end = start + maxLength;
        if (end >= message.length) {
            chunks.push(message.slice(start));
            break;
        }

        let lastSentenceEnd = message.lastIndexOf('.', end);
        if (lastSentenceEnd === -1 || lastSentenceEnd < start) {
            lastSentenceEnd = message.lastIndexOf('!', end);
        }
        if (lastSentenceEnd === -1 || lastSentenceEnd < start) {
            lastSentenceEnd = message.lastIndexOf('?', end);
        }
        if (lastSentenceEnd === -1 || lastSentenceEnd < start) {
            lastSentenceEnd = message.lastIndexOf('\n', end);
        }

        if (lastSentenceEnd !== -1 && lastSentenceEnd >= start) {
            end = lastSentenceEnd + 1;
        }

        chunks.push(message.slice(start, end).trim());
        start = end;
    }

    return chunks;
}


export async function sendmessage(args: string, userId: string, message: any) {
    const dbFilePath = path.join('src', 'db.json');
    const dbContent = await fs.promises.readFile(dbFilePath, 'utf-8');
    const db = JSON.parse(dbContent);

    if (!db[userId]) {
        db[userId] = {
            historyFilePath: await setHistory(message, 'default'),
            apiKey: await key(userId),
            model: 'gpt-3.5-turbo'
        };
    } else {
        if (!db[userId].historyFilePath || db[userId].historyFilePath === undefined) {
            setHistory(message, 'default');
            message.reply("retry again to get response or !mem set <name>");
            return;
        }
        if (!db[userId].apiKey || db[userId].apiKey === undefined) {
            db[userId].apiKey = await key(userId);
        }

        if (!db[userId].model) {
            db[userId].model = 'gpt-3.5-turbo';
            fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2));
        }
    }

    console.log(db[userId].historyFilePath, "shuh");

    let userApiKey = apiKey;
    if (!apiKey) {
        userApiKey = db[userId].apiKey;
    }
    const model = db[userId].model;

    const url = process.env.URL;
    if (!url) {
        throw new Error('URL is not defined in the environment variables');
    }

    const headers = {
        'Authorization': `Bearer ${userApiKey}`,
        'Content-Type': 'application/json'
    };

    let messageHistory: { messages: { role: string, content: string }[] } = { messages: [] };

    const messageHistoryFilePath = path.join('src', 'history', db[userId].historyFilePath);

    if (!fs.existsSync(path.join('src', 'history'))) {
        fs.mkdirSync(path.join('src', 'history'), { recursive: true });
    }

    if (fs.existsSync(messageHistoryFilePath)) {
        const fileContent = fs.readFileSync(messageHistoryFilePath, 'utf-8');
        messageHistory = JSON.parse(fileContent);
        if (!Array.isArray(messageHistory.messages)) {
            messageHistory.messages = [];
        }
    }

    messageHistory.messages.push({
        role: 'user',
        content: args
    });

    const data = {
        model: model,
        messages: messageHistory.messages
    };

    try {
        const response = await axios.post(url, data, { headers });
        const responseData = response.data;

        const assistantMessage = responseData.choices[0].message;

        messageHistory.messages.push({
            role: assistantMessage.role,
            content: assistantMessage.content
        });

        fs.writeFileSync(messageHistoryFilePath, JSON.stringify(messageHistory, null, 2));

        const chunks = splitMessage(assistantMessage.content, DISCORD_MAX_MESSAGE_LENGTH);
        for (const chunk of chunks) {
            await message.reply(chunk);
        }
    } catch (error: string | any) {
        console.error('Error sending message:', error);

        const errorMessage = String(error);

        if (error.response && error.response.data && error.response.data.message) {
            message.reply(`Error: ${error.response.data.message}`);
        } else if (error.message) {
            message.reply(`Error: ${error.message}`);
        } else {
            message.reply(`An unknown error occurred: ${errorMessage}`);
        }
    }
}
export async function loadHistory(message: any, historyId: string): Promise<void> {
    const userId: string = message.author.id;
    let messageHistoryFilePath: string;
        messageHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);
    
    if (fs.existsSync(messageHistoryFilePath)) {
        const fileContent: string = fs.readFileSync(messageHistoryFilePath, 'utf-8');
        const messageHistory: any = JSON.parse(fileContent);
        saveDB(messageHistoryFilePath, message);
        message.reply(`Loaded history: ${JSON.stringify(messageHistory, null, 2)}`);
    } else {
        message.reply(`No history found for ID: ${historyId}`);
    }
}
export async function loadPublic(message: any, historyId: string): Promise<void> {
    const userId: string = "public";
    let messageHistoryFilePath: string;
    messageHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);

    if (fs.existsSync(messageHistoryFilePath)) {
        const fileContent: string = fs.readFileSync(messageHistoryFilePath, 'utf-8');
        const messageHistory: any = JSON.parse(fileContent);
        saveDB(messageHistoryFilePath, message);
        message.reply(`Loaded history: ${JSON.stringify(messageHistory, null, 2)}`);
    } else {
        message.reply(`No public history found for ID: ${historyId}`);
    }
}
export function setHistory(message: any, historyId: string): void {
    const userId: string = message.author.id;
    const messageHistoryFilePath: string = path.join('src/history', `${userId}_${historyId}.json`);
    console.log(messageHistoryFilePath, "bruh");

    if (!fs.existsSync('src/history')) {
        fs.mkdirSync('src/history');
    }

    if (!fs.existsSync(messageHistoryFilePath)) {
        fs.writeFileSync(messageHistoryFilePath, JSON.stringify({ messages: [] }, null, 2));
         saveDB(messageHistoryFilePath, message);
        console.log(messageHistoryFilePath, "file path");
    } else {
         saveDB(messageHistoryFilePath, message);
        console.log(`File ${messageHistoryFilePath} already exists.`);
    }

    if (message) {
        message.reply(`History ID set to: ${historyId}`);
    }
}

export async function copyHistory(message: any, historyId: string): Promise<void> {
    const userId: string = message.author.id;
    const dbFilePath: string = path.join('src', 'db.json');

    try {
        const dbContent = await fs.promises.readFile(dbFilePath, 'utf-8');
        const db = JSON.parse(dbContent);

        if (db[userId] && db[userId].historyFilePath) {
            const originalHistoryFilePath: string = path.join('src', 'history', db[userId].historyFilePath);

            if (!fs.existsSync(originalHistoryFilePath)) {
                message.reply(`Original history file does not exist.`);
                return;
            }

            const newHistoryFilePath: string = path.join('src', 'history', `${userId}_${historyId}.json`);

            if (fs.existsSync(newHistoryFilePath)) {
                message.reply(`History ID ${historyId} already exists. Change ID to save.`);
                return;
            }

            if (!fs.existsSync('src/history')) {
                fs.mkdirSync('src/history');
            }

            const originalContent = await fs.promises.readFile(originalHistoryFilePath, 'utf-8');
            await fs.promises.writeFile(newHistoryFilePath, originalContent);

            db[userId].historyFilePath = newHistoryFilePath;
            await fs.promises.writeFile(dbFilePath, JSON.stringify(db, null, 2));

            saveDB(newHistoryFilePath, message);
            message.reply(`History ID set to: ${historyId}`);
        } else {
            message.reply(`No history file path found for user ID ${userId} in db.json.`);
        }
    } catch (error) {
        console.error('Error reading db.json:', error);
        message.reply('An error occurred while accessing the database.');
    }
}
export async function showHistory(message: any, historyId?: string): Promise<void> {
    const userId: string = message.author.id;
    let userHistoryFilePath: string;
    let extractedHistoryId: string | undefined;

    const dbFilePath = path.join('src', 'db.json');
    if (!fs.existsSync(dbFilePath)) {
        await message.reply('No history ID provided and db.json file not found.');
        return;
    }

    const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
    const db = JSON.parse(dbContent);
    const userRecord = db[userId];

    if (!userRecord) {
        await message.reply('User record not found in db.json.');
        return;
    }

    if (!historyId) {
        if (userRecord.historyFilePath) {
            userHistoryFilePath = path.join('src/history', userRecord.historyFilePath);
            const fileName = path.basename(userHistoryFilePath, '.json');
            const parts = fileName.split('_');
            if (parts.length === 2 && (parts[0] === 'public' || parts[0] === userId)) {
                extractedHistoryId = parts[1];
            } else {
                await message.reply('Invalid history file path format in db.json.');
                return;
            }
        } else {
            await message.reply('No history ID provided and no default history file path found in db.json.');
            return;
        }
    } else {
        if (userRecord.historyFilePath && userRecord.historyFilePath.includes('public')) {
            userHistoryFilePath = path.join('src/history', `public_${historyId}.json`);
        } else {
            userHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);
        }
    }

    let status = '';
    if (db[userId] && db[userId].historyFilePath) {
        const historyFilePath = db[userId].historyFilePath;
        if (/public/.test(historyFilePath)) {
            status = 'public';
        } else if (/\d/.test(historyFilePath)) {
            status = 'private';
        }
    }

    if (fs.existsSync(userHistoryFilePath)) {
        const historyContent = fs.readFileSync(userHistoryFilePath, 'utf-8');
        const replyMessage = `${status} history ID is ${historyId || extractedHistoryId}\nContents of the file:\n${historyContent}`;
        if (replyMessage.length > DISCORD_MAX_MESSAGE_LENGTH) {
            await message.reply('Max character limit reached.');
        } else {
            await message.reply(replyMessage);
        }
    } else {
        await message.reply('No history found for the given history ID.');
    }
}
export function clearHistory(message: any, historyId?: string): void {
    const userId: string = message.author.id;
    const dbFilePath: string = path.join('src', 'db.json');

    if (!fs.existsSync(dbFilePath)) {
        message.reply('Database file not found.');
        return;
    }

    const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
    const db = JSON.parse(dbContent);

    if (!historyId) {
        if (!db[userId] || !db[userId].historyFilePath) {
            message.reply('No history found for the given userId.');
            return;
        }
        historyId = db[userId].historyFilePath.split('_').pop()?.replace('.json', '') || '';
    }

    const userHistoryFilePath: string = path.join('src/history', `${userId}_${historyId}.json`);

    if (fs.existsSync(userHistoryFilePath)) {
        fs.unlinkSync(userHistoryFilePath);
        message.reply('History file deleted.');
    } else {
        message.reply('No history found for the given historyId.');
    }
}
 async function checkDatabaseFile(dbFilePath: string, message: any): Promise<void> {
    try {
        await fs.promises.access(dbFilePath);
    } catch (error) {
        message.reply('Database file not found.');
        return;
    }
}
async function saveDB(MessageHistoryFilePath: string, message: any): Promise<void> {
    console.log(MessageHistoryFilePath, "MessageHistoryFilePath");
    try {
        console.log(`saveDB`);
        const dbFilePath = path.join('src', 'db.json');

        await checkDatabaseFile(dbFilePath, message);

        const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
        const db = JSON.parse(dbContent);

        const userId = message.author.id;

        if (!db[userId]) {
            db[userId] = {};
        }

        const fileName = path.basename(MessageHistoryFilePath);
        console.log(fileName, "fileName");
        db[userId].historyFilePath = fileName;
console.log(fileName, "fileName");
        fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2));
        console.log(db[userId].historyFilePath, "db[userId].historyFilePath");
    } catch (error) {
        message.reply('Error in saveDB:', error);
    }
}
export async function setPublic(message: any, historyId?: string): Promise<void> {
    const userId = message.author.id;
    const dbFilePath = path.join('src', 'db.json');
    let dbData;

    try {
        dbData = JSON.parse(await fs.promises.readFile(dbFilePath, 'utf8'));
    } catch (error) {
        console.error('Error reading db.json:', error);
        message.reply('An error occurred while reading the database.');
        return;
    }

    if (!historyId) {
        if (!dbData[userId] || !dbData[userId].historyFilePath) {
            message.reply(`No history file path found for user ID ${userId}.`);
            return;
        }
        historyId = dbData[userId].historyFilePath;
    }

    const sourceHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);
    const historyIdPart = historyId ? historyId.split('_').pop()?.replace('.json', '') : undefined; 
    const publicHistoryFilePath = path.join('src/history', `public_${historyIdPart}.json`);
    console.log(sourceHistoryFilePath);
    if (!fs.existsSync(sourceHistoryFilePath)) {
        message.reply(`Source history file ${historyId} does not exist.`);
        return;
    }
    
    if (fs.existsSync(publicHistoryFilePath)) {
        message.reply(`Public history ID ${historyIdPart} already exists. Change ID to save.`);
        return;
    }
    
    try {
        await fs.promises.rename(sourceHistoryFilePath, publicHistoryFilePath);
        message.reply(`Public history ID set to: ${historyIdPart}`);
    } catch (error) {
        console.error('Error renaming file:', error);
        message.reply('An error occurred while renaming the file.');
    }
}
export async function list(message: any): Promise<void> {
    const userId = message.author.id;
    const historyDir = path.join('src', 'history');

    try {
        const files = await fs.promises.readdir(historyDir);
        const userFiles = files.filter(file => file.startsWith(`${userId}_`));

        if (userFiles.length === 0) {
            message.reply(`No history files found for user ID ${userId}.`);
            return;
        }

        const historyIds = userFiles.map(file => file.replace(`${userId}_`, '').replace('.json', ''));
        const fileList = historyIds.join('\n');
        message.reply(`History IDs for user ID ${userId}:\n${fileList}`);
    } catch (error) {
        console.error('Error reading history directory:', error);
        message.reply('An error occurred while listing the history files.');
    }
}

export async function publiclist(message: any): Promise<void> {
    const userId = "public";
    const historyDir = path.join('src', 'history');

    try {
        const files = await fs.promises.readdir(historyDir);
        const userFiles = files.filter(file => file.startsWith(`${userId}_`));

        if (userFiles.length === 0) {
            message.reply(`No history files found for user ID ${userId}.`);
            return;
        }

        const historyIds = userFiles.map(file => file.replace(`${userId}_`, '').replace('.json', ''));
        const fileList = historyIds.join('\n');
        message.reply(`History IDs for user ID ${userId}:\n${fileList}`);
    } catch (error) {
        console.error('Error reading history directory:', error);
        message.reply('An error occurred while listing the history files.');
    }
}