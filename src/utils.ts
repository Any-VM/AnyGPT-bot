import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';


export async function apikey(name: string) {
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

export function readUserIds() {
    if (fs.existsSync('db.json')) {
        const data = fs.readFileSync('db.json', 'utf-8');
        return JSON.parse(data);
    } else {
        return {};
    }
}

export function writeUserIds(userIds: any) {
    const data = JSON.stringify(userIds, null, 2);
    fs.writeFileSync('db.json', data, 'utf-8');
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

export function saveUserData(userId: string, apiKey: string, selectedModel: string) {
    const userIds = readUserIds();
    userIds[userId] = {
        apiKey: apiKey,
        model: selectedModel
    };
    writeUserIds(userIds);
}

export async function sendmessage(message: string, model: string, apiKey: string, userId: string, historyId: string) {
    const url = 'https://gpt.anyvm.tech/v1/chat/completions';
    
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    let messages = [
        {
            role: 'user',
            content: message
        }
    ];

    const data = {
        model: model,
        messages: messages
    };

    try {
        const response = await axios.post(url, data, { headers });
        const responseData = response.data;

        const assistantMessage = responseData.choices[0].message;

        messages.push({
            role: assistantMessage.role,
            content: assistantMessage.content
        });

        
        
        let messageHistory: { [key: string]: any } = {};
        const messageHistoryFilePath = path.join('src/history', `${userId}_${historyId}.json`);
        if (!fs.existsSync(messageHistoryFilePath)) {
            fs.mkdirSync('src/history');
        }
        if (fs.existsSync(messageHistoryFilePath)) {
            const fileContent = fs.readFileSync(messageHistoryFilePath, 'utf-8');
            messageHistory = JSON.parse(fileContent);
        }

        if (!messageHistory[userId]) {
            messageHistory[userId] = [];
        }
        messageHistory[userId].push(...messages);

        fs.writeFileSync(messageHistoryFilePath, JSON.stringify(messageHistory, null, 2));

        return responseData;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
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

    if (!fs.existsSync('src/history')) {
        fs.mkdirSync('src/history');
    }

    fs.writeFileSync(messageHistoryFilePath, JSON.stringify({ [userId]: [] }, null, 2));
    saveDB(messageHistoryFilePath, message); 
    message.reply(`History ID set to: ${historyId}`);
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
export function showHistory(message: any, historyId?: string): void {
    const userId: string = message.author.id;
    let userHistoryFilePath: string;
    let extractedHistoryId: string | undefined;

    const dbFilePath = path.join('src', 'db.json');
    if (!fs.existsSync(dbFilePath)) {
        message.reply('No history ID provided and db.json file not found.');
        return;
    }

    const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
    const db = JSON.parse(dbContent);
    const userRecord = db[userId];

    if (!userRecord) {
        message.reply('User record not found in db.json.');
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
                message.reply('Invalid history file path format in db.json.');
                return;
            }
        } else {
            message.reply('No history ID provided and no default history file path found in db.json.');
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
        message.reply(`${status} history ID is ${historyId || extractedHistoryId}\nContents of the file:\n${historyContent}`);
    } else {
        message.reply('No history found for the given history ID.');
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
        fs.writeFileSync(userHistoryFilePath, JSON.stringify([]));
        message.reply('History cleared.');
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
    try {
        const dbFilePath = path.join('src', 'db.json');

        await checkDatabaseFile(dbFilePath, message);

        const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
        const db = JSON.parse(dbContent);

        // Extract userId from the message object
        const userId = message.author.id;

        if (!db[userId]) {
            db[userId] = {};
        }

        // Extract the file name from MessageHistoryFilePath
        const fileName = path.basename(MessageHistoryFilePath);
        db[userId].historyFilePath = fileName;

        fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('Error in saveDB:', error);
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
