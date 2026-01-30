'use strict';

window.customElements.define(
    'file-attachment',
    class extends HTMLElement {
        constructor() {
            super();

            /* Objet contenant la pièce jointe :
                {
                    type,       // Type MIME
                    name,       // Nom du ficher
                    size,       // Taille en octets
                    dataUrl,    // Contenu sous forme d'URL data:
                };
            */
            this.file = null;

            let templateContent = document.getElementById(
                'attachment-template',
            ).content;

            this.attachShadow({
                mode: 'open',
            });
            this.shadowRoot.appendChild(
                document.importNode(templateContent, true),
            );
        }

        connectedCallback() {
            function toggleHover(event) {
                event.currentTarget.classList.toggle('hover');
            }

            // Utilisation d'une fonction fléchée pour que this reste une référence vers la classe (une fonction classique remplace this par une référence à elle-même)
            const removeIfCloseButtonShown = (event) => {
                if (event.currentTarget.classList.contains('hover')) {
                    this.remove();
                } else {
                    toggleHover(event);
                    setTimeout(toggleHover, 2000, {
                        currentTarget: event.currentTarget,
                    }); // Quand toggleHover sera lancé, event n’existera plus. On passe à la place une référence vers l’élément.
                }
            };

            const container = this.shadowRoot.getElementById('container');

            container.addEventListener('mouseenter', toggleHover);
            container.addEventListener('mouseleave', toggleHover);
            container.addEventListener('touchend', (event) => {
                removeIfCloseButtonShown(event);
                event.preventDefault(); // Évite que les évenements mouseenter et click soient déclenchés à la suite
            });

            container.addEventListener('click', (event) => {
                removeIfCloseButtonShown(event);
            });
        }
    },
);

function saveInput(input) {
    window.localStorage.setItem(input.id, input.value);
}

function restoreInput(input) {
    const value = window.localStorage.getItem(input.id);
    if (value) {
        input.value = value;
    }
}

function getApiKey() {
    return document.getElementById('apiKey').value;
}

function getConversationId() {
    let conversationId = window.localStorage.getItem('conversation_id');
    if (!conversationId) {
		// Nécessite une origine sécurisée : HTTPS ou localhost
        conversationId = crypto.randomUUID();
        window.localStorage.setItem('conversation_id', conversationId);
    }
    return conversationId;
}
