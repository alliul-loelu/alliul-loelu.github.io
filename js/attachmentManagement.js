'use strict';

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        if (file.type.startsWith('image/')) {
            // Diminution de la taille de l'image
            const MAX_SIZE = 800;

            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    let width = img.width;
                    let height = img.height;

                    // Maintain aspect ratio
                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 80% quality
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
            };
        } else {
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        }
    });
}

document
    .getElementById('attachmentsInput')
    .addEventListener('change', (event) => {
        const attachmentsContainer = document.getElementById(
            'attachments-container',
        );
        for (const file of event.target.files) {
            fileToDataUrl(file).then((dataUrl) => {
                const attachment = document.createElement('file-attachment');
                attachment.file = {
                    type: file.type,
                    name: file.name,
                    size: file.size,
                    dataUrl: dataUrl,
                };

                const attachmentImage = document.createElement('img');
                attachmentImage.slot = 'attachment-image';
                if (file.type.startsWith('image/')) {
                    attachmentImage.src = dataUrl;
                } else {
                    attachmentImage.src = 'img/icon_pdf_file.svg';
                }

                attachment.appendChild(attachmentImage);
                attachmentsContainer.appendChild(attachment);
            });
        }
        event.target.value = '';
    });
