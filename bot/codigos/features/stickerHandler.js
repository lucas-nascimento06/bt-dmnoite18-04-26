import { downloadMediaMessage } from '@whiskeysockets/baileys';
import Jimp from 'jimp';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Handler para criar stickers a partir de imagens/vídeos com texto opcional
 * Comando: #stickerdamas [texto]
 */
async function stickerHandler(sock, msg, quotedMsg, texto = '') {
    try {
        console.log('🎯 Iniciando stickerHandler...');

        if (!quotedMsg || !quotedMsg.message) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Por favor, responda a uma imagem ou vídeo com o comando #stickerdamas\n\n📝 Exemplos:\n#stickerdamas\n#stickerdamas leozinho'
            }, { quoted: msg });
            return;
        }

        const hasImage = quotedMsg.message.imageMessage ||
            quotedMsg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

        const hasVideo = quotedMsg.message.videoMessage ||
            quotedMsg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

        console.log('🖼️ Tem imagem?', hasImage ? 'SIM' : 'NÃO');
        console.log('🎬 Tem vídeo?', hasVideo ? 'SIM' : 'NÃO');

        if (!hasImage && !hasVideo) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ A mensagem respondida precisa ser uma imagem ou vídeo!'
            }, { quoted: msg });
            return;
        }

        const mediaType = hasVideo ? 'vídeo' : 'imagem';
        await sock.sendMessage(msg.key.remoteJid, {
            text: `⏳ Criando sticker de ${mediaType}... Aguarde!`
        }, { quoted: msg });

        let stickerBuffer;

        if (hasVideo) {
            console.log('🎬 Baixando vídeo...');
            const buffer = await downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
            console.log(`📦 Buffer de vídeo baixado: ${buffer.length} bytes`);
            stickerBuffer = await createVideoSticker(buffer, texto);
        } else {
            console.log('📥 Baixando imagem...');
            const buffer = await downloadMediaMessage(
                quotedMsg,
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            );
            console.log(`📦 Buffer baixado: ${buffer.length} bytes`);
            stickerBuffer = texto.trim()
                ? await createStickerWithText(buffer, texto)
                : await createSimpleSticker(buffer);
        }

        if (!stickerBuffer) throw new Error('Falha ao processar mídia');

        console.log('📤 Enviando sticker...');
        await sock.sendMessage(msg.key.remoteJid, {
            sticker: stickerBuffer,
            mimetype: 'image/webp',
            fileName: 'sticker.webp'
        }, {
            packname: '👑 Damas da Night',
            author: '🎉 Bot Exclusivo',
            categories: ['🔥']
        });

        console.log('✅ Sticker criado e enviado com sucesso!');

        // ─── DELETAR MÍDIA ORIGINAL ───────────────────────────────────────────
        try {
            console.log('🗑️ Deletando mídia original...');

            // Deleta o comando (#stickerdamas ...) enviado pelo usuário
            await sock.sendMessage(msg.key.remoteJid, {
                delete: msg.key
            });

            // Deleta a mídia original (mensagem citada)
            await sock.sendMessage(msg.key.remoteJid, {
                delete: quotedMsg.key
            });

            console.log('✅ Mídia original e comando deletados com sucesso!');
        } catch (deleteError) {
            // Não interrompe o fluxo caso a deleção falhe (ex: sem permissão em grupos)
            console.warn('⚠️ Não foi possível deletar a(s) mensagem(ns):', deleteError.message);
        }
        // ─────────────────────────────────────────────────────────────────────

    } catch (error) {
        console.error('❌ Erro ao criar sticker:', error);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Erro ao criar sticker. Tente novamente ou verifique se a mídia é válida.'
        }, { quoted: msg });
    }
}

/**
 * Gera máscara PNG 512x512 com bordas arredondadas usando Jimp
 */
async function generateRoundedMask(maskPath, radius = 60) {
    const size = 512;
    const mask = new Jimp(size, size, 0x00000000);

    mask.scan(0, 0, size, size, function (x, y, idx) {
        let inside = true;

        if (x < radius && y < radius) {
            const dx = radius - x, dy = radius - y;
            inside = Math.sqrt(dx * dx + dy * dy) <= radius;
        } else if (x > size - radius && y < radius) {
            const dx = x - (size - radius), dy = radius - y;
            inside = Math.sqrt(dx * dx + dy * dy) <= radius;
        } else if (x < radius && y > size - radius) {
            const dx = radius - x, dy = y - (size - radius);
            inside = Math.sqrt(dx * dx + dy * dy) <= radius;
        } else if (x > size - radius && y > size - radius) {
            const dx = x - (size - radius), dy = y - (size - radius);
            inside = Math.sqrt(dx * dx + dy * dy) <= radius;
        }

        const v = inside ? 255 : 0;
        this.bitmap.data[idx]     = v;
        this.bitmap.data[idx + 1] = v;
        this.bitmap.data[idx + 2] = v;
        this.bitmap.data[idx + 3] = v;
    });

    await mask.writeAsync(maskPath);
    console.log(`✅ Máscara gerada: ${maskPath}`);
}

function getAvailableFontPath() {
    const isWindows = os.platform() === 'win32';
    const homeDir   = os.homedir();

    const candidates = isWindows
        ? [
            'C:\\Windows\\Fonts\\arialbd.ttf',
            'C:\\Windows\\Fonts\\arial.ttf',
            'C:\\Windows\\Fonts\\calibrib.ttf',
            'C:\\Windows\\Fonts\\calibri.ttf',
            'C:\\Windows\\Fonts\\verdanab.ttf',
            'C:\\Windows\\Fonts\\verdana.ttf',
            'C:\\Windows\\Fonts\\tahomabd.ttf',
            'C:\\Windows\\Fonts\\tahoma.ttf',
        ]
        : [
            `${homeDir}/../usr/share/fonts/TTF/DejaVuSans-Bold.ttf`,
            `${homeDir}/../usr/share/fonts/TTF/DejaVuSans.ttf`,
            '/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
            '/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans.ttf',
            '/data/data/com.termux/files/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
            '/data/data/com.termux/files/usr/share/fonts/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            console.log(`🔤 Fonte encontrada: ${p}`);
            return p;
        }
    }

    if (isWindows) {
        throw new Error('Nenhuma fonte TTF encontrada em C:\\Windows\\Fonts. Verifique se as fontes padrão do Windows estão instaladas.');
    }
    const isTermux = homeDir.includes('com.termux') || fs.existsSync('/data/data/com.termux');
    if (isTermux) {
        throw new Error('Nenhuma fonte TTF encontrada no Termux. Instale com: pkg install font-dejavu');
    }
    throw new Error('Nenhuma fonte TTF encontrada no sistema. Instale com: apt-get install fonts-dejavu');
}

/**
 * Cria sticker animado a partir de vídeo compatível com WhatsApp
 */
async function createVideoSticker(videoBuffer, texto = '') {
    const tempDir = os.tmpdir();
    const timestamp = Date.now() + Math.random().toString(36).substring(7);
    const inputPath  = path.join(tempDir, `sticker_video_input_${timestamp}.mp4`);
    const outputPath = path.join(tempDir, `sticker_video_output_${timestamp}.webp`);

    try {
        console.log('🎬 Processando vídeo para sticker animado...');
        fs.writeFileSync(inputPath, videoBuffer);
        console.log(`💾 Vídeo temporário salvo: ${inputPath}`);

        let textFilter = '';
        if (texto.trim()) {
            const textoUpper = texto.toUpperCase().replace(/'/g, "\\'").replace(/:/g, '\\:');
            console.log(`✍️ Adicionando texto ao vídeo: "${textoUpper}"`);

            const fontPath = getAvailableFontPath();
            const fontPathEscaped = os.platform() === 'win32'
                ? fontPath.replace(/\\/g, '/').replace(':', '\\:')
                : fontPath;

            textFilter =
                `,drawtext=text='${textoUpper}':fontsize=64:fontcolor=white:` +
                `borderw=3:bordercolor=black:` +
                `x=(w-text_w)/2:y=h-text_h-20:` +
                `fontfile='${fontPathEscaped}'`;
        }

        const vfFilter =
            `scale=512:512:force_original_aspect_ratio=increase,` +
            `crop=512:512:(iw-512)/2:(ih-512)/2,` +
            `fps=10,` +
            `format=yuv420p` +
            textFilter;

        const ffmpegCommand = [
            'ffmpeg', '-y',
            '-i', `"${inputPath}"`,
            '-vf', `"${vfFilter}"`,
            '-vcodec', 'libwebp',
            '-quality', '50',
            '-compression_level', '6',
            '-preset', 'default',
            '-loop', '0',
            '-an',
            '-t', '5',
            '-fs', '500K',
            `"${outputPath}"`
        ].join(' ');

        console.log('⚙️ Executando FFmpeg...');
        await execPromise(ffmpegCommand);

        const webpBuffer = fs.readFileSync(outputPath);
        console.log(`✅ WebP animado gerado: ${webpBuffer.length} bytes`);

        for (const f of [inputPath, outputPath]) {
            try { fs.unlinkSync(f); } catch (_) {}
        }

        return webpBuffer;

    } catch (error) {
        console.error('❌ Erro ao converter vídeo para WebP:', error.message);
        for (const f of [inputPath, outputPath]) {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
        }
        return null;
    }
}

/**
 * Compõe a imagem sobre canvas 512x512 transparente com bordas arredondadas
 */
async function composeOnTransparentCanvas(imageBuffer, size = 512, radius = 60) {
    let image = await Jimp.read(imageBuffer);
    const origW = image.getWidth();
    const origH = image.getHeight();
    console.log(`📐 Dimensões originais: ${origW}x${origH}`);

    const scale = Math.max(size / origW, size / origH);
    const newW  = Math.round(origW * scale);
    const newH  = Math.round(origH * scale);
    image.resize(newW, newH);

    const cropX = Math.floor((newW - size) / 2);
    const cropY = Math.floor((newH - size) / 2);
    image.crop(cropX, cropY, size, size);
    console.log(`✅ Crop centralizado: ${size}x${size}`);

    image = await applyRoundedCornersFullImage(image, radius);
    console.log('✅ Bordas arredondadas aplicadas');

    return image;
}

/**
 * Aplica bordas arredondadas à imagem (detecta bounds da área visível)
 */
async function applyRoundedCorners(image, radius) {
    const width  = image.getWidth();
    const height = image.getHeight();
    const data   = image.bitmap.data;

    let minX = width, maxX = 0, minY = height, maxY = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx + 3] > 10) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (minX >= maxX || minY >= maxY) return image;

    console.log(`🔍 Bounds da imagem real: (${minX},${minY}) → (${maxX},${maxY})`);

    const imgW = maxX - minX + 1;
    const imgH = maxY - minY + 1;

    image.scan(0, 0, width, height, function (x, y, idx) {
        if (x < minX || x > maxX || y < minY || y > maxY) return;

        const rx = x - minX;
        const ry = y - minY;
        let transparent = false;

        if (rx < radius && ry < radius) {
            const dx = radius - rx, dy = radius - ry;
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        } else if (rx > imgW - radius && ry < radius) {
            const dx = rx - (imgW - radius), dy = radius - ry;
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        } else if (rx < radius && ry > imgH - radius) {
            const dx = radius - rx, dy = ry - (imgH - radius);
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        } else if (rx > imgW - radius && ry > imgH - radius) {
            const dx = rx - (imgW - radius), dy = ry - (imgH - radius);
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        }

        if (transparent) this.bitmap.data[idx + 3] = 0;
    });

    return image;
}

/**
 * Aplica bordas arredondadas em uma imagem 512x512
 */
async function applyRoundedCornersFullImage(image, radius) {
    const width  = image.getWidth();
    const height = image.getHeight();

    image.scan(0, 0, width, height, function (x, y, idx) {
        let transparent = false;

        if (x < radius && y < radius) {
            const dx = radius - x, dy = radius - y;
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        } else if (x > width - radius && y < radius) {
            const dx = x - (width - radius), dy = radius - y;
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        } else if (x < radius && y > height - radius) {
            const dx = radius - x, dy = y - (height - radius);
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        } else if (x > width - radius && y > height - radius) {
            const dx = x - (width - radius), dy = y - (height - radius);
            if (Math.sqrt(dx * dx + dy * dy) > radius) transparent = true;
        }

        if (transparent) this.bitmap.data[idx + 3] = 0;
    });

    return image;
}

/**
 * Converte PNG para WebP usando FFmpeg
 */
async function convertToWebP(inputBuffer) {
    const tempDir = os.tmpdir();
    const timestamp = Date.now() + Math.random().toString(36).substring(7);
    const inputPath  = path.join(tempDir, `sticker_input_${timestamp}.png`);
    const outputPath = path.join(tempDir, `sticker_output_${timestamp}.webp`);

    try {
        console.log('🔄 Convertendo para WebP...');
        fs.writeFileSync(inputPath, inputBuffer);
        console.log(`💾 PNG temporário salvo: ${inputPath}`);

        const ffmpegCommand = [
            'ffmpeg', '-y',
            '-i', `"${inputPath}"`,
            '-vcodec', 'libwebp',
            '-filter:v', '"format=rgba"',
            '-quality', '90',
            '-compression_level', '3',
            '-loop', '0',
            '-an',
            '-vsync', '0',
            `"${outputPath}"`
        ].join(' ');

        console.log('⚙️ Executando FFmpeg...');
        await execPromise(ffmpegCommand);

        const webpBuffer = fs.readFileSync(outputPath);
        console.log(`✅ WebP gerado: ${webpBuffer.length} bytes`);

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        return webpBuffer;

    } catch (error) {
        console.error('❌ Erro ao converter para WebP:', error.message);
        try {
            if (fs.existsSync(inputPath))  fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (_) {}
        return null;
    }
}

/**
 * Cria sticker simples sem texto
 */
async function createSimpleSticker(imageBuffer) {
    try {
        console.log('🖼️ Processando imagem para sticker simples...');

        let image = await Jimp.read(imageBuffer);
        console.log(`📐 Dimensões originais: ${image.getWidth()}x${image.getHeight()}`);

        image.contain(512, 512, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
        console.log('✅ Redimensionado: 512x512');

        image = await applyRoundedCorners(image, 60);
        console.log('✅ Bordas arredondadas aplicadas');

        const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        console.log(`✅ PNG gerado: ${pngBuffer.length} bytes`);

        const webpBuffer = await convertToWebP(pngBuffer);
        if (!webpBuffer) {
            console.log('⚠️ Falha ao converter para WebP, enviando PNG...');
            return pngBuffer;
        }

        return webpBuffer;

    } catch (error) {
        console.error('❌ Erro ao criar sticker simples:', error);
        return null;
    }
}

/**
 * Cria sticker com texto
 */
async function createStickerWithText(imageBuffer, texto) {
    try {
        console.log('🖼️ Processando imagem para sticker com texto...');

        let image = await Jimp.read(imageBuffer);
        console.log(`📐 Dimensões originais: ${image.getWidth()}x${image.getHeight()}`);

        image.contain(512, 512, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
        console.log('✅ Redimensionado: 512x512');

        image = await applyRoundedCorners(image, 60);
        console.log('✅ Bordas arredondadas aplicadas');

        const textoUpper = texto.toUpperCase();
        console.log(`✍️ Adicionando texto: "${textoUpper}"`);

        const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const fontBlack = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);

        const textWidth = Jimp.measureText(fontWhite, textoUpper);
        const textX = Math.floor((512 - textWidth) / 2);
        const textY = 420;

        console.log(`📝 Texto na posição: (${textX}, ${textY})`);

        for (let offsetX = -3; offsetX <= 3; offsetX++) {
            for (let offsetY = -3; offsetY <= 3; offsetY++) {
                if (offsetX !== 0 || offsetY !== 0) {
                    image.print(fontBlack, textX + offsetX, textY + offsetY, textoUpper);
                }
            }
        }
        image.print(fontWhite, textX, textY, textoUpper);

        const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        console.log(`✅ PNG com texto gerado: ${pngBuffer.length} bytes`);

        const webpBuffer = await convertToWebP(pngBuffer);
        if (!webpBuffer) {
            console.log('⚠️ Falha ao converter para WebP, enviando PNG...');
            return pngBuffer;
        }

        return webpBuffer;

    } catch (error) {
        console.error('❌ Erro ao criar sticker com texto:', error);
        return null;
    }
}

/**
 * Função para processar o comando
 */
export async function handleStickerCommand(sock, msg) {
    try {
        console.log('🚀 handleStickerCommand iniciado');

        const messageText = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text || '';

        console.log('💬 Texto da mensagem:', messageText);

        const parts   = messageText.split(' ');
        const comando = parts[0].toLowerCase();
        const texto   = parts.slice(1).join(' ').trim();

        console.log('🔧 Comando:', comando);
        console.log('📝 Texto extraído:', texto);

        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

        if (!contextInfo || !contextInfo.quotedMessage) {
            console.log('❌ Não há mensagem citada');
            await sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Por favor, responda a uma imagem ou vídeo com o comando #stickerdamas\n\n📝 Exemplos:\n#stickerdamas\n#stickerdamas leozinho'
            }, { quoted: msg });
            return;
        }

        console.log('✅ Mensagem citada encontrada');
        console.log('📦 QuotedMessage keys:', Object.keys(contextInfo.quotedMessage));

        const quotedMsg = {
            key: {
                remoteJid:   msg.key.remoteJid,
                fromMe:      false,
                id:          contextInfo.stanzaId,
                participant: contextInfo.participant
            },
            message: contextInfo.quotedMessage
        };

        await stickerHandler(sock, msg, quotedMsg, texto);

    } catch (error) {
        console.error('❌ Erro no handleStickerCommand:', error);
        console.error('Stack trace:', error.stack);
    }
}

export { stickerHandler };