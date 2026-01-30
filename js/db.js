'use strict';

const DB_NAME = 'MedicIA';
const DB_VERSION = 1;
const STORE_NAME = 'messages';
const ATTACHMENTS_STORE = 'attachments';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;

            // Messages
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    autoIncrement: true,
                });
                store.createIndex('conversationId', 'conversationId');
                store.createIndex('timestamp', 'timestamp');
            }

            // Attachments
            if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) {
                const store = db.createObjectStore(ATTACHMENTS_STORE, {
                    autoIncrement: true,
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveMessage(message, attachments = []) {
    // Save attachments first
    if (attachments.length > 0) {
        message.attachments = await saveAttachments(attachments);
    }

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(message);

    return tx.complete;
}

async function loadConversation(conversationId) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('conversationId');

    return new Promise((resolve) => {
        const request = index.getAll(conversationId);
        request.onsuccess = () =>
            resolve(request.result.sort((a, b) => a.timestamp - b.timestamp));
    });
}

async function saveAttachments(attachments) {
    const db = await openDB();
    const tx = db.transaction(ATTACHMENTS_STORE, 'readwrite');
    const store = tx.objectStore(ATTACHMENTS_STORE);

    const ids = [];

    for (const attachment of attachments) {
        const request = store.add(attachment);
        ids.push(
            await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }),
        );
    }

    await tx.complete;
    return ids;
}

async function loadAttachments(ids) {
    const db = await openDB();
    const tx = db.transaction(ATTACHMENTS_STORE, 'readonly');
    const store = tx.objectStore(ATTACHMENTS_STORE);

    const attachments = [];
    for (const id of ids) {
        const request = store.get(id);
        attachments.push(
            await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            }),
        );
    }

    return attachments;
}

async function buildInputFromDatabase(conversationId) {
    const history = await loadConversation(conversationId);
    const input = [];

    for (const message of history) {
        const content = [
            {
                type:
                    message.role === 'assistant' ? 'output_text' : 'input_text',
                text: message.content,
            },
        ];

        if (message.attachments) {
            const attachments = await loadAttachments(message.attachments);

            for (const attachment of attachments) {
                const contentType = attachment.type.startsWith('image/')
                    ? 'input_image'
                    : 'input_file';
                content.push({
                    type: contentType,
                    ...(contentType === 'input_image'
                        ? {
                              image_url: attachment.dataUrl,
                          }
                        : {
                              filename: attachment.name,
                              file_data: attachment.dataUrl,
                          }),
                });
            }
        }

        input.push({
            role: message.role,
            content,
        });
    }

    return input;
}
