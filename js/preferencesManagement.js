'use strict';

const dialog = document.getElementById('settingsDialog');
const apiKeyInput = document.getElementById('apiKey');

if (window.location.hash) {
    apiKeyInput.value = window.location.hash.slice(1);
    window.location.hash = '';
    saveInput(apiKeyInput);
} else {
    restoreInput(apiKeyInput);
}

document.getElementById('settingsOpenButton').addEventListener('click', () => {
    dialog.showModal();
});

dialog.addEventListener('submit', () => {
    saveInput(apiKeyInput);
    window.location.reload(); // FIXME: trigger a new /v1/conversations conversation fetch instead, to get a new conversation id instead of reloading the page
});
