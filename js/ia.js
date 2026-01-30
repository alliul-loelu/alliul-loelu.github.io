'use strict';

const API_URL = 'https://api.openai.com';
const conversationId = getConversationId();

const mdParser = new commonmark.Parser();
const mdRenderer = new commonmark.HtmlRenderer();

const sessionPlanningElement = document.getElementById('sessionPlanning');
const availableToolsElement = document.getElementById('availableTools');
const medicalSpecialtyElement = document.getElementById('medicalSpecialty');
const outputElement = document.getElementById('output');

for (const input of [
    sessionPlanningElement,
    availableToolsElement,
    medicalSpecialtyElement,
]) {
    // Restauration de la valeur sauvegardée des champs de configuration
    restoreInput(input);

    // Lorsque l'utilisateur quitte le champ, on sauvegarde son contenu dans le local storage
    // FIXME: ne pas envoyer de nouveau message de prompt si le contenu n’a pas changé ?
    input.addEventListener('focusout', (event) => {
        saveInput(event.currentTarget);
        saveAPromptMessage(conversationId);
    });
}

// FIXME: Safari a ajouté le support pour cet évènement dans sa version du 12/12/2025. Ajouter une solution de contournement ?
window.addEventListener('scrollend', () => {
    // Vérifie si la page est défilée jusqu’en bas, sinon on affiche un bouton pour le faire
    document.getElementById('scrollDownButton').style.visibility =
        window.scrollY + window.innerHeight >= document.body.scrollHeight
            ? 'hidden'
            : 'visible';
});

async function ask(conversationId, answerElement) {
    let textResponse = '';

    try {
        const requestBody = {
            model: 'gpt-4o-mini',
            input: await buildInputFromDatabase(conversationId),
            stream: true,
        };

        // Appel de l'API
        const response = await fetch(`${API_URL}/v1/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getApiKey()}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const json = await response.json();
            throw new Error(
                `API error: ${json?.error?.message || `HTTP ${response.status}`}`,
            );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let isDelta = false;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line) continue;

                if (line.startsWith('event: ')) {
                    isDelta = line.slice(7) == 'response.output_text.delta';
                } else if (line.startsWith('data: ') && isDelta) {
                    try {
                        const delta = JSON.parse(line.slice(6)).delta;
                        textResponse += delta;
                        // FIXME: improve performance by calling the Markdown parser less frequently?
                        answerElement.innerHTML = mdRenderer.render(
                            mdParser.parse(textResponse),
                        );
                    } catch (error) {
                        throw new Error(
                            `An error occurred while parsing the API response: ${error}`,
                        );
                    }
                }
            }
        }
    } catch (error) {
        console.error(error);
        answerElement.innerHTML =
            '<i>Une erreur inattendue s’est produite. Veuillez réessayer.</i>';
    }

    if (textResponse) {
        // Enregistrement de la réponse dans la base de données.
        await saveMessage({
            conversationId: conversationId,
            role: 'assistant',
            content: textResponse,
            timestamp: Date.now(),
        });
    }
}

function appendUserQuestion(output, content) {
    const question = document.createElement('div');
    question.classList.add('message', 'question');
    question.innerHTML = content;
    output.appendChild(question);
    question.scrollIntoView();
}

function exportAnswer(answerContent) {
    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title lang="fr">Réponse exportée</title>
</head>
<body>
    ${answerContent.innerHTML}
    <script>
        window.print();
        window.close();
    </script>
</body>
</html>
`);
    printWindow.document.close();
}

function appendAssistantAnswer(output, content) {
    const answer = document.createElement('div');
    answer.classList.add('message', 'answer');

    const answerContent = document.createElement('div');
    if (content) answerContent.innerHTML = content;

    const exportButtonFragment = document.importNode(
        document.getElementById('exportButton-template').content,
        true,
    );
    exportButtonFragment
        .querySelector('.export-button')
        .addEventListener('click', () => {
            exportAnswer(answerContent);
        });

    answer.append(answerContent, exportButtonFragment);
    output.appendChild(answer);
    answer.previousSibling?.scrollIntoView();

    return answer;
}

function appendAttachments(output, files) {
    const attachmentsDisplay = document.createElement('div');
    attachmentsDisplay.classList.add('message', 'question', 'attachments');

    for (const file of files) {
        const image = document.createElement('img');
        image.src = file.type.startsWith('image/')
            ? file.dataUrl
            : 'img/icon_pdf_file.svg';
        image.title = file.name;

        image.addEventListener('click', () => {
            const modal = document.getElementById('attachmentViewer');
            const iframe = modal.querySelector('iframe');

            iframe.src = file.dataUrl;
            modal.showModal();
        });

        attachmentsDisplay.appendChild(image);
    }

    output.appendChild(attachmentsDisplay);
}

async function saveAPromptMessage(conversationId) {
    const promptText = `Nouvelles instructions :
Vous êtes kinésithérapeute, médecin rééducateur, ostéopathe. Votre spécialité est :
${medicalSpecialty.value.trim()}

Je vais vous donner une série d’indications concernant un patient afin que vous réalisiez des bilans de kinésithérapie.

Je vous fournirai une photo de la prescription, éventuellement d’autres documents comme des radiographies ou examens médicaux, la situation douloureuse, ainsi que les restrictions articulaires.

Vous devrez déduire et rédiger un rapport kinésithérapique, en évaluant la situation et en proposant un traitement de kinésithérapie.

Une séance avec un patient est organisée de la façon suivante :
${sessionPlanningElement.value.trim()}

Vous disposez des outils suivants :
${availableToolsElement.value.trim()}

Lors de la réception d’une prescription (image ou texte), extraire et répéter :
	- Nom
	- Date de naissance (la demander si elle est manquante)
	- Date de prescription
`;

    if (promptText) {
        await saveMessage({
            conversationId: conversationId,
            role: 'system',
            content: promptText,
            timestamp: Date.now(),
        });
    }
}

// L'utilisateur doit avoir configuré une clef d'API, sinon on affiche les paramètres
// FIXME: check if the API key is valid?
// FIXME: handle the Esc key (that closes the modal by default, even if the form is not completed).
if (!getApiKey()) {
    document.getElementById('settingsDialog').showModal();
}

// Récupération des messages précédents
loadConversation(conversationId).then(async (conversation) => {
    // Ajout du prompt initial
    if (conversation.length == 0) {
        await saveAPromptMessage(conversationId);
    }

    for (const message of conversation) {
        switch (message.role) {
            case 'user':
                appendUserQuestion(outputElement, message.content);
                if (message.attachments?.length > 0) {
                    appendAttachments(
                        outputElement,
                        await loadAttachments(message.attachments),
                    );
                }
                break;
            case 'assistant':
                appendAssistantAnswer(
                    outputElement,
                    mdRenderer.render(mdParser.parse(message.content)),
                );
                break;
            case 'system':
                if (message?.isNewSessionMessage)
                    outputElement.append(document.createElement('hr'));
                break;
            default:
                console.warn('Unknown message role:', message);
                break;
        }
    }

    document
        .getElementById('newSessionButton')
        .addEventListener('click', async () => {
            // Nouvelle session, on renvoie le prompt
            await saveMessage({
                conversationId: conversationId,
                role: 'system',
                content: `Nouvelle séance, ${new Date().toLocaleString('fr')}. Les messages suivants concernent désormais cette nouvelle séance.`,
                timestamp: Date.now(),
                isNewSessionMessage: true,
            });
            outputElement.append(document.createElement('hr'));
            await saveAPromptMessage(conversationId);

            const answerElement =
                appendAssistantAnswer(outputElement).querySelector('div');
            ask(conversationId, answerElement);
        });

    // Fonctionnalité d'envoi d'un nouveau message
    document
        .getElementById('form')
        .addEventListener('submit', async (event) => {
            event.preventDefault();

            // Récupération de la saisie de l'utilisateur
            const promptField = document.getElementById('prompt');
            const promptText = promptField.value.trim();
            const attachments = Array.from(
                document.querySelectorAll(
                    '#attachments-container > file-attachment',
                ),
            ).map((e) => e.file);

            // Affichage du message dans la conversation
            appendUserQuestion(
                outputElement,
                mdRenderer.render(mdParser.parse(promptText)),
            );

            // Affichage des pièces jointes dans la conversation
            if (attachments.length > 0) {
                appendAttachments(outputElement, attachments);
            }

            // Affichage de la réponse
            const answerElement =
                appendAssistantAnswer(outputElement).querySelector('div');

            // La taille maximale des pièces jointes est de 50 Mo pour ChatGPT.
            // https://platform.openai.com/docs/guides/pdf-files#:~:text=File%20size%20limitations
            const totalSize = attachments.reduce(
                (sum, file) => sum + file.size,
                0,
            );
            if (totalSize <= 50000000) {
                await saveMessage(
                    {
                        conversationId: conversationId,
                        role: 'user',
                        content: promptText,
                        timestamp: Date.now(),
                    },
                    attachments,
                );

                ask(conversationId, answerElement);

                // Remise à zéro du formulaire
                promptField.value = '';
                document
                    .getElementById('attachments-container')
                    .replaceChildren();
            } else {
                answerElement.innerHTML =
                    '<i>Fichiers joints trop lourds. La taille totale des pièces jointes doit être inférieure ou égale à 50 Mo.</i>';
            }
        });

    document.getElementById('submitButton').disabled = false;
});
