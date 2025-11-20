'use strict';

function displayError(userMessage, consoleMessage) {
	console.error(consoleMessage);

	const errorMessagePanel = document.getElementById('error-message-panel').content;

	errorMessagePanel.getElementById('error-message').textContent = userMessage; 

	document.body.classList.add('error-panel');
	document.body.replaceChildren(errorMessagePanel);
}

document.getElementById('allow-camera-button').addEventListener('click', () => {
	// Une fois la caméra activé, le message demandant de l’autoriser peut être retiré.
	document.getElementById('allow-camera-panel').remove();

	const sendFps = 1;

	navigator.mediaDevices.getUserMedia({
		video: {
			facingMode: 'environment',
			frameRate: sendFps,  // Nous envoyons le flux vidéo à la vitesse de sendFps images par secondes, donc nous n’avons pas besoin de plus. Donner cette valeur au navigateur lui permet de choisir la meilleur caméra pour la tâche.
		},
		audio: false,
	})
		.catch(error => {
			displayError('Impossible de se connecter à une caméra. Avez-vous accepté de la partager\u{202F}?', error);
		})
		.then(stream => {
			const video = document.createElement('video');

			video.srcObject = stream;
			video.play()
				.catch(error => {
					displayError('Une erreur inattendue s’est produite.', error);
				})
				.then(() => {
				const canvasCtx = new OffscreenCanvas(250, 250).getContext('2d', {
					alpha: false,
					willReadFrequently: true,
				});

				setInterval((canvas, canvasCtx, video, output) => {
					// Récupère la valeur du pixel immédiatement en haut à gauche du point central (les dimensions d’une caméra sont paires, donc il n’y a pas de pixel central). 
					canvasCtx.drawImage(video, Math.trunc(video.videoWidth/2), Math.trunc(video.videoHeight/2), 1, 1, 0, 0, canvas.width, canvas.height);
					const colorRgb = canvasCtx.getImageData(0, 0, canvas.width, canvas.height, { colorSpace: 'srgb', pixelFormat: 'rgba-unorm8' }).data.slice(0, 3);

					document.body.style.backgroundColor = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;

					output.textContent += `${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}\n`;
				}, sendFps * 1000, canvasCtx.canvas, canvasCtx, video, document.getElementById('output'));
			});
		});
});
