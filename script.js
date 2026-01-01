class TitleScreen {
    constructor() {
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
        const img = new Image();
        img.src = src;
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

            this.draw(ctx, canvas);
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.drawImage(ctx, this.assets.frame, 0, 0, canvas.width, canvas.height);
        this.drawImage(ctx, this.assets.logo, (canvas.width - this.assets.logo.width * 2.4) / 2, (canvas.height - this.assets.logo.height * 2.4) / 2 - 90, this.assets.logo.width * 2.4, this.assets.logo.height * 2.4);

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
    }

    async loadScene(ctx, canvas) {
        
        try {
            const response = await fetch('text.json');
            const data = await response.json();
            this.scenes = data.scenes;
        } catch (error) {
            console.error('Failed to load text JSON:', error);
            return;
        }


        this.loadCurrentScene(ctx, canvas);


        canvas.addEventListener('click', () => {
            this.advanceSceneOrText(ctx, canvas);
        });


        this.addReturnToTitleButton(canvas, ctx);
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
        volUpButton.style.left = 'calc(70% - 9%)'; // Move 5% more to the left
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


        [returnButton, muteButton, volUpButton, volDownButton].forEach((button) => {
            button.addEventListener('mouseenter', () => {
                button.style.textDecoration = 'underline';
            });
            button.addEventListener('mouseleave', () => {
                button.style.textDecoration = 'none';
            });
        });


        returnButton.addEventListener('click', () => {
            console.log('Return to Title Screen button clicked');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const titleScreen = new TitleScreen();
            titleScreen.setupHoverListeners(canvas, ctx);
            titleScreen.draw(ctx, canvas);
            returnButton.remove();
            muteButton.remove();
            volUpButton.remove();
            volDownButton.remove();
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

        console.log('Control buttons added to DOM');
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
            const audio = new Audio(src);
            audio.loop = src.includes('breeze') || src.includes('background'); // Loop only background audio
            return audio;
        });

        // Play the audio for the current scene
        if (this.audio.length > 0) {
            this.currentAudio = this.audio[0];
            this.audio.forEach((audio) => {
                audio.loop = true;
                audio.play();
            });
        }


        this.bg.src = currentScene.bg || "";
        this.characters = (currentScene.characters || []).map((src) => {
            const img = new Image();
            img.src = src;
            return img;
        });
        this.textBox.src = currentScene.textbox || "";

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

                const renderLoop = () => {
                    if (this.sceneLoaded) {
                        this.drawScene(ctx, canvas);
                        requestAnimationFrame(renderLoop);
                    }
                };
                renderLoop();
            } else {
                requestAnimationFrame(checkAssetsLoaded);
            }
        };

        checkAssetsLoaded();

        if (currentScene.id === 10) {
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
            const characterWidth = innerFrameWidth * 0.38;
            const characterHeight = character.height * (characterWidth / character.width);
            const characterX = innerFrameX + (innerFrameWidth - characterWidth) / (1.5 + index * 0.5);
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
        this.wrapText(ctx, currentText, textX, textY, maxWidth, 24);

        ctx.restore();
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let yOffset = 0;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && i > 0) {
                ctx.fillText(line, x, y + yOffset);
                line = words[i] + ' ';
                yOffset += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y + yOffset);
    }

    advanceSceneOrText(ctx, canvas) {
        const currentScene = this.scenes[this.currentSceneIndex];

        this.currentLineIndex++;
        if (this.currentLineIndex >= currentScene.lines.length) {
            this.currentSceneIndex++;
            if (currentScene.id === 21) {

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
            this.sceneLoaded = false;
            this.loadCurrentScene(ctx, canvas);
        } else {
            this.drawScene(ctx, canvas);
        }
    }

    startStrobeEffect(ctx, canvas, scene) {
        let strobeState = true;
        const strobeInterval = setInterval(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (strobeState) {

                const bgWidth = canvas.width;
                const bgHeight = canvas.height;
                ctx.drawImage(this.bg, 0, 0, bgWidth, bgHeight);


                scene.characters.forEach((character, index) => {
                    const charWidth = canvas.width * 0.3;
                    const charHeight = character.height * (charWidth / character.width);
                    const charX = (canvas.width - charWidth) / 2;
                    const charY = canvas.height * 0.5 - charHeight / 2;
                    ctx.drawImage(character, charX, charY, charWidth, charHeight);
                });
            }

            strobeState = !strobeState;
        }, 200);

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
                ctx.save();
                ctx.filter = 'invert(1)';
                ctx.drawImage(this.frame, 0, 0, canvas.width, canvas.height);
                ctx.restore();
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
