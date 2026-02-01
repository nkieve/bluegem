// Global Asset Manager for preloading and caching
class AssetManager {
    constructor() {
        this.imageCache = new Map();
        this.audioCache = new Map();
        this.audioBuffers = new Map();
    }

    loadImage(src) {
        if (this.imageCache.has(src)) {
            return Promise.resolve(this.imageCache.get(src));
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.imageCache.set(src, img);
                resolve(img);
            };
            img.onerror = () => reject(`Failed to load: ${src}`);
            img.src = src;
        });
    }

    getImage(src) {
        return this.imageCache.get(src);
    }

    loadAudio(src) {
        if (this.audioCache.has(src)) {
            return Promise.resolve(this.audioCache.get(src));
        }

        return new Promise((resolve) => {
            const audio = new Audio();
            audio.preload = 'auto';
            audio.addEventListener('canplaythrough', () => {
                this.audioCache.set(src, audio);
                resolve(audio);
            }, { once: true });
            audio.src = src;
        });
    }

    getAudio(src) {
        const cached = this.audioCache.get(src);
        if (cached) {
            // Clone for independent playback
            const clone = cached.cloneNode();
            clone.volume = cached.volume;
            return clone;
        }
        return null;
    }

    async preloadAll(assets) {
        const imagePromises = (assets.images || []).map(src => this.loadImage(src));
        const audioPromises = (assets.audio || []).map(src => this.loadAudio(src));
        
        await Promise.all([...imagePromises, ...audioPromises]);
    }

    clearCache() {
        this.imageCache.clear();
        this.audioCache.clear();
        this.audioBuffers.clear();
    }
}

// Global singleton instance
const assetManager = new AssetManager();

class TitleScreen {
    constructor() {
        this.assetsLoaded = 0;
        this.totalAssets = 6;
        this.assets = {
            frame: this.loadImage('public/frame.svg'),
            logo: this.loadImage('public/logo.svg'),
            startButton: this.loadImage('public/start_button.svg'),
            startButtonHover: this.loadImage('public/start_hover.svg'),
            configButton: this.loadImage('public/config_button.svg'),
            configButtonHover: this.loadImage('public/config_hover.svg')
        };

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioBuffer = null;
        this.audioSource = null;
        this.hoverState = { startButton: false, configButton: false };

        this.loadAudio('public/titlescreen_novella.mp3');
    }

    loadImage(src) {
        const cached = assetManager.getImage(src);
        if (cached) {
            this.assetsLoaded++;
            return cached;
        }
        
        const img = new Image();
        img.src = src;
        img.onload = () => {
            this.assetsLoaded++;
            assetManager.imageCache.set(src, img);
        };
        img.onerror = () => console.error(`Failed to load image: ${src}`);
        return img;
    }

    loadAudio(src) {
        fetch(src)
            .then(response => response.arrayBuffer())
            .then(data => this.audioContext.decodeAudioData(data))
            .then(buffer => {
                this.audioBuffer = buffer;
                console.log('Audio buffer loaded successfully');
                this.startAudio();
            })
            .catch(error => console.error('Failed to load audio:', error));
    }

    setupHoverListeners(canvas, ctx) {
        const scaleFactor = 0.8;
        const resumeAudioContext = () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(error => console.error('Failed to resume audio context:', error));
            }
            canvas.removeEventListener('click', resumeAudioContext);
            canvas.removeEventListener('keydown', resumeAudioContext);
        };

        canvas.addEventListener('click', resumeAudioContext);
        canvas.addEventListener('keydown', resumeAudioContext);

        canvas.addEventListener('mousemove', (event) => {
            const { left, top } = canvas.getBoundingClientRect();
            const mouseX = event.clientX - left;
            const mouseY = event.clientY - top;

            const buttonWidth = this.assets.startButton.width * scaleFactor;
            const buttonHeight = this.assets.startButton.height * scaleFactor;
            const startButtonX = (canvas.width / 2) - buttonWidth - 20;
            const buttonY = canvas.height / 2 + 120;
            const configButtonX = (canvas.width / 2) + 20;

            this.hoverState.startButton = this.isMouseOver(mouseX, mouseY, startButtonX, buttonY, buttonWidth, buttonHeight);
            this.hoverState.configButton = this.isMouseOver(mouseX, mouseY, configButtonX, buttonY, buttonWidth, buttonHeight);
        });

        canvas.addEventListener('click', (event) => {
            const { left, top } = canvas.getBoundingClientRect();
            const mouseX = event.clientX - left;
            const mouseY = event.clientY - top;

            const buttonWidth = this.assets.startButton.width * scaleFactor;
            const buttonHeight = this.assets.startButton.height * scaleFactor;
            const startButtonX = (canvas.width / 2) - buttonWidth - 20;
            const buttonY = canvas.height / 2 + 120;
            const configButtonX = (canvas.width / 2) + 20;

            if (this.isMouseOver(mouseX, mouseY, startButtonX, buttonY, buttonWidth, buttonHeight)) {
                this.stopAudio();
                const newCanvas = canvas.cloneNode(true);
                canvas.replaceWith(newCanvas);
                const newCtx = newCanvas.getContext('2d');
                new NovelScene().loadScene(newCtx, newCanvas);
            }

            if (this.isMouseOver(mouseX, mouseY, configButtonX, buttonY, buttonWidth, buttonHeight)) {
                this.stopAudio();
                const newCanvas = canvas.cloneNode(true);
                canvas.replaceWith(newCanvas);
                const newCtx = newCanvas.getContext('2d');
                const creditsScene = new CreditsScene();
                creditsScene.start(newCtx, newCanvas);
            }
        });
    }

    isMouseOver(mouseX, mouseY, x, y, width, height) {
        return mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height;
    }

    draw(ctx, canvas) {
        if (!this.cachedBackground) {
            if (this.assets.frame.complete && this.assets.frame.naturalWidth !== 0 &&
                this.assets.logo.complete && this.assets.logo.naturalWidth !== 0) {

                this.cachedBackground = document.createElement('canvas');
                this.cachedBackground.width = canvas.width;
                this.cachedBackground.height = canvas.height;
                const bctx = this.cachedBackground.getContext('2d');

                this.drawImage(bctx, this.assets.frame, 0, 0, canvas.width, canvas.height);
                this.drawImage(bctx, this.assets.logo, (canvas.width - this.assets.logo.width * 2.4) / 2, (canvas.height - this.assets.logo.height * 2.4) / 2 - 90, this.assets.logo.width * 2.4, this.assets.logo.height * 2.4);
            }
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (this.cachedBackground) {
            ctx.drawImage(this.cachedBackground, 0, 0);
        } else {
            this.drawImage(ctx, this.assets.frame, 0, 0, canvas.width, canvas.height);
            this.drawImage(ctx, this.assets.logo, (canvas.width - this.assets.logo.width * 2.4) / 2, (canvas.height - this.assets.logo.height * 2.4) / 2 - 90, this.assets.logo.width * 2.4, this.assets.logo.height * 2.4);
        }

        const scaleFactor = 0.8;
        const buttonWidth = this.assets.startButton.width * scaleFactor;
        const buttonHeight = this.assets.startButton.height * scaleFactor;
        const startButtonX = (canvas.width / 2) - buttonWidth - 20;
        const buttonY = canvas.height / 2 + 120;
        const configButtonX = (canvas.width / 2) + 20;

        this.drawButton(ctx, this.hoverState.startButton ? this.assets.startButtonHover : this.assets.startButton, startButtonX, buttonY, buttonWidth, buttonHeight);
        this.drawButton(ctx, this.hoverState.configButton ? this.assets.configButtonHover : this.assets.configButton, configButtonX, buttonY, buttonWidth, buttonHeight);
    }

    drawImage(ctx, img, x, y, width, height) {
        if (img.complete && img.naturalWidth !== 0) {
            ctx.drawImage(img, x, y, width, height);
        }
    }

    drawButton(ctx, img, x, y, width, height) {
        this.drawImage(ctx, img, x, y, width, height);
    }

    startAudio() {
        if (!this.audioBuffer) return;
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource.disconnect();
        }
        this.audioSource = this.audioContext.createBufferSource();
        this.audioSource.buffer = this.audioBuffer;
        this.audioSource.connect(this.audioContext.destination);
        this.audioSource.loop = true;
        this.audioSource.start(0);
    }

    stopAudio() {
        if (this.audioSource) {
            this.audioSource.stop();
            this.audioSource.disconnect();
            this.audioSource = null;
        }
    }

    initialize(ctx, canvas) {
        this.startAudio();
        this.setupHoverListeners(canvas, ctx);
        this.draw(ctx, canvas);
    }
}

class NovelScene {
    constructor() {
        this.FRAME_SRC = 'public/frame.svg';
        this.EMBLEM_SRC = 'public/emblem.png';

        this.frame = new Image();
        this.frame.src = this.FRAME_SRC;

        this.emblem = new Image();
        this.emblem.src = this.EMBLEM_SRC;

        this.bg = new Image();
        this.characters = [];
        this.textBox = new Image();
        this.audio = [];
        this.currentAudio = null;

        this.assetsLoaded = 0;
        this.totalAssets = 3;

        this.scenes = [];
        this.currentSceneIndex = 0;
        this.currentLineIndex = 0;
        this.audioPlayed = [];

        this.hoverState = {
            emblem: false
        };


        this.loadingAfterSceneIds = new Set([6, 7, 8, 11, 22]);
        this.loadingOverlay = new LoadingOverlay();

        // NEW: Auto mode state (does not change constructor signature)
        this.autoMode = false;
        this.autoAdvanceDelayMs = 1700; // tweak timing here
        this._autoTimer = null;
        this._autoCtx = null;
        this._autoCanvas = null;
    }

    async loadScene(ctx, canvas) {

        try {
            const response = await fetch('text.json');
            const data = await response.json();
            this.scenes = data.scenes;
            
            // Preload all unique assets from all scenes
            await this.preloadAllSceneAssets();
        } catch (error) {
            console.error('Failed to load text JSON:', error);
            return;
        }


        this.loadCurrentScene(ctx, canvas);


        canvas.addEventListener('click', () => {

            if (this.loadingOverlay?.isActive) return;


            if (this.autoMode) {
                this.disableAuto();
                return;
            }

            this.advanceSceneOrText(ctx, canvas);
        });

        this.addReturnToTitleButton(canvas, ctx);
    }

    async preloadAllSceneAssets() {
        const uniqueImages = new Set([this.FRAME_SRC, this.EMBLEM_SRC]);
        const uniqueAudio = new Set();

        this.scenes.forEach(scene => {
            if (scene.bg) uniqueImages.add(scene.bg);
            if (scene.textbox) uniqueImages.add(scene.textbox);
            if (scene.characters) {
                scene.characters.forEach(char => uniqueImages.add(char));
            }
            if (scene.audio) {
                scene.audio.forEach(audio => uniqueAudio.add(audio));
            }
        });

        console.log(`Preloading ${uniqueImages.size} images and ${uniqueAudio.size} audio files...`);
        
        await assetManager.preloadAll({
            images: Array.from(uniqueImages),
            audio: Array.from(uniqueAudio)
        });
        
        console.log('All assets preloaded!');
    }

    addReturnToTitleButton(canvas, ctx) {
        const returnButton = document.createElement('div');
        returnButton.innerText = '>> Return to Title Screen <<';
        returnButton.style.position = 'absolute';
        returnButton.style.top = `calc(${canvas.getBoundingClientRect().bottom}px + 10%)`;
        returnButton.style.left = 'calc(50% - 9%)';
        returnButton.style.transform = 'translateX(-50%)';
        returnButton.style.fontFamily = 'Arial, sans-serif';
        returnButton.style.fontSize = '18px';
        returnButton.style.color = 'black';
        returnButton.style.cursor = 'pointer';
        returnButton.style.textAlign = 'center';
        returnButton.style.textShadow = '1px 1px 2px black';


        const muteButton = document.createElement('div');
        muteButton.innerText = '>> Mute <<';
        muteButton.style.position = 'absolute';
        muteButton.style.top = `calc(${canvas.getBoundingClientRect().bottom}px + 10%)`;
        muteButton.style.left = 'calc(30% - 9%)';
        muteButton.style.transform = 'translateX(-50%)';
        muteButton.style.fontFamily = 'Arial, sans-serif';
        muteButton.style.fontSize = '18px';
        muteButton.style.color = 'black';
        muteButton.style.cursor = 'pointer';
        muteButton.style.textAlign = 'center';
        muteButton.style.textShadow = '1px 1px 2px black';


        const volUpButton = document.createElement('div');
        volUpButton.innerText = '>> Vol + <<';
        volUpButton.style.position = 'absolute';
        volUpButton.style.top = `calc(${canvas.getBoundingClientRect().bottom}px + 10%)`;
        volUpButton.style.left = 'calc(70% - 9%)';
        volUpButton.style.transform = 'translateX(-50%)';
        volUpButton.style.fontFamily = 'Arial, sans-serif';
        volUpButton.style.fontSize = '18px';
        volUpButton.style.color = 'black';
        volUpButton.style.cursor = 'pointer';
        volUpButton.style.textAlign = 'center';
        volUpButton.style.textShadow = '1px 1px 2px black';


        const volDownButton = document.createElement('div');
        volDownButton.innerText = '>> Vol - <<';
        volDownButton.style.position = 'absolute';
        volDownButton.style.top = `calc(${canvas.getBoundingClientRect().bottom}px + 10%)`;
        volDownButton.style.left = 'calc(90% - 9%)';
        volDownButton.style.transform = 'translateX(-50%)';
        volDownButton.style.fontFamily = 'Arial, sans-serif';
        volDownButton.style.fontSize = '18px';
        volDownButton.style.color = 'black';
        volDownButton.style.cursor = 'pointer';
        volDownButton.style.textAlign = 'center';
        volDownButton.style.textShadow = '1px 1px 2px black';



        const autoButton = document.createElement('div');
        autoButton.innerText = 'AUTO';
        autoButton.style.position = 'fixed';
        autoButton.style.top = '12px';
        autoButton.style.left = '12px';
        autoButton.style.transform = 'none';
        autoButton.style.zIndex = '99999';
        autoButton.style.fontFamily = 'Arial, sans-serif';
        autoButton.style.fontSize = '14px';
        autoButton.style.color = '#111';
        autoButton.style.cursor = 'pointer';
        autoButton.style.textAlign = 'center';
        autoButton.style.textShadow = 'none';

        // simple grey pill look
        autoButton.style.background = '#d0d0d0';
        autoButton.style.border = '1px solid #9a9a9a';
        autoButton.style.borderRadius = '6px';
        autoButton.style.padding = '6px 10px';
        autoButton.style.userSelect = 'none';

        const syncAutoButtonStyle = () => {

            autoButton.innerText = 'AUTO';

            if (this.autoMode) {

                autoButton.style.border = '1px solid #2b78ff';
                autoButton.style.boxShadow = '0 0 10px rgba(43, 120, 255, 0.95)';
                autoButton.style.background = '#cfcfcf';
            } else {

                autoButton.style.border = '1px solid #9a9a9a';
                autoButton.style.boxShadow = 'none';
                autoButton.style.background = '#d0d0d0';
            }
        };
        syncAutoButtonStyle();

        autoButton.addEventListener('click', () => {
            if (this.autoMode) {
                this.disableAuto();
            } else {
                this.enableAuto(ctx, canvas);
            }
            syncAutoButtonStyle();
        });


        autoButton.addEventListener('mouseenter', () => {
            autoButton.style.filter = 'brightness(0.95)';
        });
        autoButton.addEventListener('mouseleave', () => {
            autoButton.style.filter = 'none';
        });


        [returnButton, muteButton, volUpButton, volDownButton].forEach((button) => {
            button.addEventListener('mouseenter', () => {
                button.style.textDecoration = 'underline';
            });
            button.addEventListener('mouseleave', () => {
                button.style.textDecoration = 'none';
            });
        });

        returnButton.addEventListener('click', () => {

            this.disableAuto();

            console.log('Return to Title Screen button clicked');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const titleScreen = new TitleScreen();
            titleScreen.setupHoverListeners(canvas, ctx);
            titleScreen.draw(ctx, canvas);

            returnButton.remove();
            muteButton.remove();
            volUpButton.remove();
            volDownButton.remove();
            autoButton.remove(); // NEW
        });

        muteButton.addEventListener('click', () => {
            if (this.currentAudio) {
                this.currentAudio.muted = !this.currentAudio.muted;
                console.log(`Audio ${this.currentAudio.muted ? 'muted' : 'unmuted'}`);
            }
        });


        volUpButton.addEventListener('click', () => {
            if (this.currentAudio && this.currentAudio.volume < 1) {
                this.currentAudio.volume = Math.min(1, this.currentAudio.volume + 0.1);
                console.log(`Volume increased to ${this.currentAudio.volume}`);
            }
        });


        volDownButton.addEventListener('click', () => {
            if (this.currentAudio && this.currentAudio.volume > 0) {
                this.currentAudio.volume = Math.max(0, this.currentAudio.volume - 0.1);
                console.log(`Volume decreased to ${this.currentAudio.volume}`);
            }
        });


        document.body.appendChild(returnButton);
        document.body.appendChild(muteButton);
        document.body.appendChild(volUpButton);
        document.body.appendChild(volDownButton);
        document.body.appendChild(autoButton); // NEW

        console.log('Control buttons added to DOM');
    }

    // NEW: Auto mode helpers
    enableAuto(ctx, canvas) {
        this.autoMode = true;
        this._autoCtx = ctx;
        this._autoCanvas = canvas;
        this._clearAutoTimer();
        this._scheduleAutoStep();
    }

    disableAuto() {
        this.autoMode = false;
        this._clearAutoTimer();
    }

    _clearAutoTimer() {
        if (this._autoTimer) {
            clearTimeout(this._autoTimer);
            this._autoTimer = null;
        }
    }

    _scheduleAutoStep() {
        if (!this.autoMode) return;
        if (this._autoTimer) return;

        // Don’t advance while overlay is active or while assets aren’t loaded yet
        if (this.loadingOverlay?.isActive) return;
        if (!this.sceneLoaded) return;

        this._autoTimer = setTimeout(() => {
            this._autoTimer = null;

            if (!this.autoMode) return;
            if (this.loadingOverlay?.isActive) return;

            // Advance one line/scene
            this.advanceSceneOrText(this._autoCtx, this._autoCanvas);

            // Schedule next
            this._scheduleAutoStep();
        }, this.autoAdvanceDelayMs);
    }

    drawText(ctx, canvas) {
        const textBoxWidth = canvas.width * 0.8;
        const textBoxHeight = this.textBox.height * (textBoxWidth / this.textBox.width);
        const textBoxX = (canvas.width - textBoxWidth) / 2;
        const textBoxY = canvas.height - textBoxHeight - 20;

        ctx.font = '20px "MS Gothic"';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const padding = 20;
        const textX = textBoxX + padding + textBoxWidth * 0.1;
        const textY = textBoxY + padding;
        const maxWidth = textBoxWidth - 2 * padding;


        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const currentScene = this.scenes[this.currentSceneIndex];
        const currentText = currentScene.lines[this.currentLineIndex];

        const cacheKey = `${this.currentSceneIndex}-${this.currentLineIndex}`;
        if (this.lastTextCacheKey !== cacheKey) {
            this.cachedWrappedLines = this.calculateWrappedLines(ctx, currentText, maxWidth);
            this.lastTextCacheKey = cacheKey;
        }

        let yOffset = 0;
        const lineHeight = 24;
        this.cachedWrappedLines.forEach(line => {
            ctx.fillText(line, textX, textY + yOffset);
            yOffset += lineHeight;
        });

        ctx.restore?.();


        this._scheduleAutoStep();
    }

    calculateWrappedLines(ctx, text, maxWidth) {
        const words = text.split(' ');
        let line = '';
        const lines = [];

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && i > 0) {
                lines.push(line);
                line = words[i] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        return lines;
    }

    loadCurrentScene(ctx, canvas) {
        const currentScene = this.scenes[this.currentSceneIndex];


        if (this.audio.length > 0) {
            this.audio.forEach((audio) => {
                audio.pause();
                audio.currentTime = 0;
            });
        }


        const sceneAudio = currentScene.audio || [];

        this.audio = sceneAudio.map((src) => {
            const audio = assetManager.getAudio(src) || new Audio(src);
            audio.loop = src.includes('breeze') || src.includes('background');
            return audio;
        });


        if (this.audio.length > 0) {
            this.currentAudio = this.audio[0];
            this.audio.forEach((audio) => {
                audio.loop = true;
                audio.play();
            });
        }


        // Use cached images or load new ones
        this.bg = assetManager.getImage(currentScene.bg) || (() => {
            const img = new Image();
            img.src = currentScene.bg || "";
            return img;
        })();
        
        this.characters = (currentScene.characters || []).map((src) => {
            return assetManager.getImage(src) || (() => {
                const img = new Image();
                img.src = src;
                return img;
            })();
        });
        
        this.textBox = assetManager.getImage(currentScene.textbox) || (() => {
            const img = new Image();
            img.src = currentScene.textbox || "";
            return img;
        })();

        this.currentLineIndex = 0;
        this.audioPlayed = new Array(this.audio.length).fill(false);

        const checkAssetsLoaded = () => {
            if (
                this.bg.complete &&
                this.textBox.complete &&
                this.characters.every((img) => img.complete) &&
                this.emblem.complete &&
                this.frame.complete
            ) {
                this.sceneLoaded = true;

                this.drawScene(ctx, canvas);

                if (this.loadingOverlay?.isActive) {
                    this.loadingOverlay.setUnderlayFromCanvas(canvas);
                }

                // NEW: if auto is on, resume scheduling once scene is ready
                this._scheduleAutoStep();
            } else {
                requestAnimationFrame(checkAssetsLoaded);
            }
        };

        checkAssetsLoaded();

        if (currentScene.id === 11) {
            this.startStrobeEffect(ctx, canvas, currentScene);
        }
    }


    playSoundEffects() {
        this.soundEffects.forEach((effect, index) => {
            const clonedEffect = effect.cloneNode();
            clonedEffect.currentTime = 0;

            clonedEffect.addEventListener('canplaythrough', () => {
                clonedEffect.play().catch((error) => {
                    if (error.name !== 'AbortError') {
                        console.error(`Failed to play sound effect ${index}:`, error);
                    }
                });
            }, { once: true });

            clonedEffect.addEventListener('ended', () => {
                clonedEffect.remove();
            });

            if (clonedEffect.readyState >= 4) {
                clonedEffect.play().catch((error) => {
                    if (error.name !== 'AbortError') {
                        console.error(`Failed to play sound effect ${index}:`, error);
                    }
                });
            } else {
                console.warn(`Sound effect ${index} is not ready. Waiting for it to load.`);
            }
        });
    }

    drawScene(ctx, canvas) {

        ctx.clearRect(0, 0, canvas.width, canvas.height);


        const innerFrameX = canvas.width * 0.05;
        const innerFrameY = canvas.height * 0.05;
        const innerFrameWidth = canvas.width * 0.9;
        const innerFrameHeight = canvas.height * 0.9;


        const bgWidth = innerFrameWidth * 0.9;
        const bgHeight = innerFrameHeight * 0.9;
        const bgX = innerFrameX + (innerFrameWidth - bgWidth) / 2;
        const bgY = innerFrameY + (innerFrameHeight - bgHeight) / 2;
        ctx.drawImage(this.bg, bgX, bgY, bgWidth, bgHeight);

        this.characters.forEach((character, index) => {
            const isScene3 = this.scenes[this.currentSceneIndex]?.id === 3;
            const isLyraCG5 = character.src.includes("lyra_cg5.png");
            const scaleFactor = isScene3 ? 1.4 : isLyraCG5 ? 0.7 : 1;

            const characterWidth = innerFrameWidth * 0.38 * scaleFactor;
            const characterHeight = character.height * (characterWidth / character.width);
            const characterX = isScene3
                ? innerFrameX + (innerFrameWidth - characterWidth) / (1.5 + index * 0.5) - innerFrameWidth * 0.1
                : innerFrameX + (innerFrameWidth - characterWidth) / (1.5 + index * 0.5);
            const characterY = innerFrameY + (innerFrameHeight - characterHeight) / 1.2;

            ctx.drawImage(character, characterX, characterY, characterWidth, characterHeight);
        });


        const textBoxWidth = innerFrameWidth * 0.8;
        const textBoxHeight = this.textBox.height * (textBoxWidth / this.textBox.width);
        const textBoxX = innerFrameX + (innerFrameWidth - textBoxWidth) / 2;
        const textBoxY = innerFrameY + innerFrameHeight - textBoxHeight - 70;
        ctx.drawImage(this.textBox, textBoxX, textBoxY, textBoxWidth, textBoxHeight);


        const emblemWidth = (innerFrameWidth * 0.1) * 0.8;
        const emblemHeight = this.emblem.height * (emblemWidth / this.emblem.width);
        const emblemX = innerFrameX + innerFrameWidth * 0.1;
        const emblemY = innerFrameY + innerFrameHeight * 0.1;

        if (this.hoverState.emblem) {

            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.drawImage(this.emblem, emblemX, emblemY, emblemWidth, emblemHeight);
            ctx.restore();


            ctx.font = '16px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.fillText('Go back to Title Screen', emblemX + emblemWidth / 2, emblemY - 10);
        } else {
            ctx.drawImage(this.emblem, emblemX, emblemY, emblemWidth, emblemHeight);
        }


        ctx.drawImage(this.frame, 0, 0, canvas.width, canvas.height);


        this.drawText(ctx, canvas);
    }

    advanceSceneOrText(ctx, canvas) {
        const currentScene = this.scenes[this.currentSceneIndex];

        this.currentLineIndex++;
        if (this.currentLineIndex >= currentScene.lines.length) {
            this.currentSceneIndex++;

            if (currentScene.id === 21) {
                // NEW: stop auto when going to credits
                this.disableAuto();

                if (this.audio.length > 0) {
                    this.audio.forEach((audio) => {
                        audio.pause();
                        audio.currentTime = 0;
                    });
                }

                this.sceneLoaded = false;
                const creditsScene = new CreditsScene();
                creditsScene.start(ctx, canvas);
                return;
            }

            if (this.currentSceneIndex >= this.scenes.length) {
                this.currentSceneIndex = 0;
            }

            const shouldShowLoading = this.loadingAfterSceneIds.has(currentScene.id);
            this.sceneLoaded = false;

            if (shouldShowLoading) {
                this.loadingOverlay.start(ctx, canvas, {
                    message: '',
                    isDone: () => this.sceneLoaded === true,
                    minDurationMs: 2000,
                    frameImg: this.frame
                });
            }

            this.loadCurrentScene(ctx, canvas);
        } else {
            this.drawScene(ctx, canvas);
        }
    }

    startStrobeEffect(ctx, canvas, scene) {
        let strobeState = true;
        const strobeInterval = setInterval(() => {
            
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.globalAlpha = strobeState ? 0.95 : 0;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            strobeState = !strobeState;
        }, 100);

        setTimeout(() => {
            clearInterval(strobeInterval);
        }, 5000);
    }

    drawSceneContent(ctx, canvas) {

        ctx.drawImage(this.bg, 0, 0, canvas.width, canvas.height);


        this.characters.forEach((character, index) => {
            const charWidth = canvas.width * 0.3;
            const charHeight = character.height * (charWidth / character.width);
            const charX = (canvas.width - charWidth) / 2;
            const charY = canvas.height * 0.5 - charHeight / 2;
            ctx.drawImage(character, charX, charY, charWidth, charHeight);
        });


        ctx.drawImage(this.textBox, 0, canvas.height * 0.8, canvas.width, canvas.height * 0.2);
    }
}

class TransitionScene {
    constructor() {
        this.duration = 800;
        this.startTime = null;
        this.isActive = false;
        this.type = 'fade';
        this.currentColor = 'black';
        this.callback = null;
        this.callbackParams = null;
    }

    start(type = 'fade', color = 'black', callback = null, callbackParams = null) {
        this.type = type;
        this.currentColor = color;
        this.startTime = Date.now();
        this.isActive = true;
        this.callback = callback;
        this.callbackParams = callbackParams;
    }

    update(ctx, canvas) {
        if (!this.isActive) return false;

        const elapsed = Date.now() - this.startTime;
        const progress = Math.min(elapsed / this.duration, 1);

        ctx.clearRect(0, 0, canvas.width, canvas.height);


        if (progress < 0.5) {
            const alpha = progress * 2;
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            const alpha = (progress - 0.5) * 2;
            ctx.fillStyle = this.currentColor;
            ctx.globalAlpha = 1 - alpha;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
        }

        if (progress >= 1) {
            this.isActive = false;
            if (this.callback) {
                this.callback(...this.callbackParams);
            }
            return true;
        }

        return false;
    }

    isTransitioning() {
        return this.isActive;
    }
}

class CreditsScene {
    constructor() {
        this.credits = [];
        this.audio = new Audio('public/audio5_gibby.wav');
        this.audio.loop = true;
        this.audio.volume = 0.5;
        this.frame = new Image();
        this.frame.src = 'public/frame.svg';
        this.loadCredits();
    }

    loadCredits() {
        fetch('credits.json')
            .then(response => response.json())
            .then(data => {
                this.credits = data.credits;
            })
            .catch(error => console.error('Failed to load credits:', error));
    }

    start(ctx, canvas) {

        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }

        this.audio.play();
        this.scrollPosition = canvas.height;
        this.renderLoop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);


            if (this.frame.complete && this.frame.naturalWidth !== 0) {
                if (!this.invertedFrameCanvas) {
                    this.invertedFrameCanvas = document.createElement('canvas');
                    this.invertedFrameCanvas.width = canvas.width;
                    this.invertedFrameCanvas.height = canvas.height;
                    const ictx = this.invertedFrameCanvas.getContext('2d');

                    ictx.save();
                    ictx.filter = 'invert(1)';
                    ictx.drawImage(this.frame, 0, 0, canvas.width, canvas.height);
                    ictx.restore();
                }
                ctx.drawImage(this.invertedFrameCanvas, 0, 0);
            }


            const innerFrameX = canvas.width * 0.1;
            const innerFrameY = canvas.height * 0.1;
            const innerFrameWidth = canvas.width * 0.8;
            const innerFrameHeight = canvas.height * 0.8;

            ctx.font = 'bold 24px MS Gothic';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';

            this.credits.forEach((credit, index) => {
                const y = this.scrollPosition + index * 40;
                if (y > innerFrameY && y < innerFrameY + innerFrameHeight) {
                    ctx.fillText(credit, canvas.width / 2, y);
                }
            });

            this.scrollPosition -= 1;
            if (this.scrollPosition < -this.credits.length * 40) {
                this.scrollPosition = canvas.height;
            }

            requestAnimationFrame(this.renderLoop);
        };
        this.renderLoop();
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
    }
}


class LoadingOverlay {
    constructor() {
        this.isActive = false;
        this._raf = null;
        this._startedAt = 0;
        this._minDurationMs = 2000;
        this._isDone = null;
        this._message = '';


        this._overlayAlpha = 1;
        this._logoAlpha = 0;
        this._textAlpha = 0;


        this._roseImg = new Image();
        this._roseImg.src = 'public/rose_anim.svg';

        this._logoImg = new Image();
        this._logoImg.src = 'public/logo.svg';


        this._roses = [];
        this._tl = null;
        this._fadingOut = false;
        this._animation_finished = false;
    }

    start(ctx, canvas, { message = '', isDone, minDurationMs = 2000, frameImg = null } = {}) {
        this.stop(true);

        this.isActive = true;


        this._underlayCanvas = null;

        this._startedAt = performance.now();
        this._minDurationMs = minDurationMs;
        this._isDone = typeof isDone === 'function' ? isDone : (() => false);
        this._message = message;

        this._overlayAlpha = 1;
        this._logoAlpha = 0;
        this._textAlpha = 0;
        this._fadingOut = false;
        this._animation_finished = false;


        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const roseCount = 20;
        this._roses = Array.from({ length: roseCount }, (_, i) => {
            const angle = (Math.PI * 2 * i) / roseCount + (Math.random() - 0.5) * 0.4;
            const dist = Math.max(canvas.width, canvas.height) * (0.55 + Math.random() * 0.25);

            return {
                x: cx + (Math.random() - 0.5) * 50,
                y: cy + (Math.random() - 0.5) * 50,
                rot: Math.random() * 360,
                s: 0.45 + Math.random() * 0.35,
                a: 1,
                tx: cx + Math.cos(angle) * dist,
                ty: cy + Math.sin(angle) * dist,
                trot: (Math.random() * 360) + 360
            };
        });


        this._tl = gsap.timeline({
            defaults: { ease: 'none' },
            onComplete: () => {
                this._animation_finished = true;
            }
        });


        this._roses.forEach((r) => {
            this._tl.to(r, { x: r.tx, y: r.ty, rot: r.rot + r.trot, duration: 2 }, 0);
            this._tl.to(r, { a: 0, duration: 2 }, 0);
        });


        this._tl.to(this, { _logoAlpha: 1, duration: 0.7, ease: 'power1.out' }, 0.25);

        const tick = (t) => {
            if (!this.isActive) return;


            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (this._underlayCanvas) {
                ctx.drawImage(this._underlayCanvas, 0, 0, canvas.width, canvas.height);
            }


            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = this._overlayAlpha;


            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);


            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const r1 = Math.max(canvas.width, canvas.height) * 0.7;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r1);
            g.addColorStop(0, 'rgba(200, 200, 200, 0.9)');
            g.addColorStop(0.45, 'rgba(235, 235, 235, 0.55)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (this._roseImg.complete && this._roseImg.naturalWidth !== 0) {
                this._roses.forEach((r) => {
                    const w = 120 * r.s;
                    const h = 120 * r.s;
                    ctx.save();
                    ctx.globalAlpha = r.a;
                    ctx.translate(r.x, r.y);
                    ctx.rotate((r.rot * Math.PI) / 180);
                    ctx.drawImage(this._roseImg, -w / 2, -h / 2, w, h);
                    ctx.restore();
                });
            }

            if (this._logoImg.complete && this._logoImg.naturalWidth !== 0 && this._logoAlpha > 0) {
                const baseLogoW = Math.min(canvas.width * 0.42, 520);
                const logoW = Math.min(baseLogoW * 2, canvas.width * 0.9);

                const logoH = this._logoImg.height * (logoW / this._logoImg.width);
                const logoX = (canvas.width - logoW) / 2;
                const logoY = (canvas.height - logoH) / 2;

                ctx.save();

                ctx.globalAlpha = this._overlayAlpha * this._logoAlpha;
                ctx.drawImage(this._logoImg, logoX, logoY, logoW, logoH);
                ctx.restore();
            }

            ctx.restore();

            const elapsed = t - this._startedAt;
            const minTimeMet = elapsed >= this._minDurationMs;
            const assetsDone = !!this._isDone();
            const animDone = this._animation_finished;

            if (!this._fadingOut && minTimeMet && animDone && assetsDone) {
                this._fadingOut = true;

                gsap.to(this, {
                    _overlayAlpha: 0,
                    duration: 2,
                    ease: 'power1.out',
                    onComplete: () => this.stop()
                });
            }

            this._raf = requestAnimationFrame(tick);
        };

        this._raf = requestAnimationFrame(tick);
    }


    setUnderlayFromCanvas(sourceCanvas) {
        if (!sourceCanvas) return;

        const c = document.createElement('canvas');
        c.width = sourceCanvas.width;
        c.height = sourceCanvas.height;

        const cctx = c.getContext('2d');
        cctx.drawImage(sourceCanvas, 0, 0);

        this._underlayCanvas = c;
    }

    stop(silent = false) {
        if (!this.isActive && !silent) return;

        this.isActive = false;

        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;

        if (this._tl) {
            this._tl.kill();
            this._tl = null;
        }

        this._roses = [];
        this._isDone = null;
        this._fadingOut = false;
        this._animation_finished = false;

        this._overlayAlpha = 1;
        this._logoAlpha = 0;
        this._textAlpha = 0;
        this._message = '';
        this._frameImg = null;
    }
}


