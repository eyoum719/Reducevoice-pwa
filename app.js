const audioFile = document.getElementById('audioFile');
const processBtn = document.getElementById('processBtn');
const status = document.getElementById('status');
const outputFormat = document.getElementById('outputFormat');
const downloadLink = document.getElementById('downloadLink');
const downloadBtn = document.getElementById('downloadBtn');

// Initialisation de FFmpeg.js (VERSION SIMPLIFIÉE pour éviter erreurs de chemin)
const ffmpeg = FFmpeg.createWorker({
    log: false
});

// --- CORRECTION 1 : Gestion universelle des formats (y compris audio/webm du magnétophone) ---
async function loadAudioFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const context = new (window.AudioContext || window.webkitAudioContext)();
                // Décode ANY audio format (AAC, MP4, WebM, WAV)
                const audioBuffer = await context.decodeAudioData(e.target.result);
                resolve(audioBuffer);
            } catch (err) {
                reject(new Error(`Impossible de charger le fichier : ${err.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
        reader.readAsArrayBuffer(file);
    });
}

// --- CORRECTION 2 : Amélioration de la réduction de bruit (plus stable) ---
async function reduceNoise(audioBuffer) {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createBufferSource();
    const biquadFilter = context.createBiquadFilter();
    const gainNode = context.createGain();

    // Paramètres de filtre optimisés (supprime bruit de fond sans détruire le signal)
    biquadFilter.type = 'highpass';
    biquadFilter.frequency.value = 80; // Seuil adapté aux bruits ambiants
    biquadFilter.Q.value = 0.7; // Lissage pour éviter distorsions

    // Connexion du graphe audio
    source.buffer = audioBuffer;
    source.connect(biquadFilter);
    biquadFilter.connect(gainNode);
    gainNode.connect(context.destination);

    // Enregistrement du signal nettoyé (FORMAT WAV pour conversion ultérieure)
    return new Promise((resolve) => {
        const mediaRecorder = new MediaRecorder(context.destination.stream, {
            mimeType: 'audio/wav; codecs=1'
        });
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const cleanBlob = new Blob(chunks, { type: 'audio/wav' });
            resolve(cleanBlob);
        };

        source.start();
        mediaRecorder.start();
        // Arrêt précis après la durée du fichier
        setTimeout(() => {
            mediaRecorder.stop();
            source.stop();
        }, audioBuffer.duration * 1000 + 100); // +100ms pour éviter coupures
    });
}

// --- CORRECTION 3 : Conversion stable avec FFmpeg ---
async function convertAudio(cleanBlob, targetFormat) {
    const inputName = 'input.wav';
    const outputName = `output.${targetFormat}`;
    const outputMimeType = {
        mp3: 'audio/mpeg',
        mp4: 'audio/mp4',
        wav: 'audio/wav'
    }[targetFormat];

    try {
        await ffmpeg.load();
        // Écriture du fichier nettoyé dans FFmpeg
        await ffmpeg.writeFile(inputName, new Uint8Array(await cleanBlob.arrayBuffer()));

        // Commande de conversion adaptée à chaque format
        switch (targetFormat) {
            case 'mp3':
                await ffmpeg.run('-i', inputName, '-codec:a', 'libmp3lame', '-qscale:a', '2', outputName);
                break;
            case 'mp4':
                await ffmpeg.run('-i', inputName, '-codec:a', 'aac', '-b:a', '192k', outputName);
                break;
            case 'wav':
                await ffmpeg.run('-i', inputName, '-codec:a', 'pcm_s16le', outputName);
                break;
        }

        // Récupération du fichier converti
        const data = await ffmpeg.readFile(outputName);
        return new Blob([data], { type: outputMimeType });
    } finally {
        await ffmpeg.terminate();
    }
}

// --- CORRECTION 4 : Flux de traitement complet (avec feedback utilisateur) ---
processBtn.addEventListener('click', async () => {
    if (!audioFile.files[0]) {
        status.textContent = 'Veuillez charger un fichier audio ou enregistrer via magnétophone !';
        status.className = 'status error';
        return;
    }

    const file = audioFile.files[0];
    processBtn.disabled = true;
    downloadLink.style.display = 'none';

    try {
        // Étape 1 : Chargement du fichier (galerie ou magnétophone)
        status.textContent = 'Chargement du fichier...';
        status.className = 'status loading';
        const audioBuffer = await loadAudioFile(file);

        // Étape 2 : Réduction de bruit
        status.textContent = 'Réduction du bruit en cours...';
        const cleanBlob = await reduceNoise(audioBuffer);

        // Étape 3 : Conversion
        status.textContent = `Conversion en ${outputFormat.value}...`;
        const convertedBlob = await convertAudio(cleanBlob, outputFormat.value);

        // Étape 4 : Préparation du téléchargement
        status.textContent = 'Traitement terminé avec succès !';
        status.className = 'status success';
        const downloadUrl = URL.createObjectURL(convertedBlob);
        downloadBtn.href = downloadUrl;
        downloadBtn.download = `audio_clean_${new Date().getTime()}.${outputFormat.value}`;
        downloadLink.style.display = 'block';

    } catch (err) {
        status.textContent = `Erreur : ${err.message}`;
        status.className = 'status error';
    } finally {
        processBtn.disabled = false;
    }
});
