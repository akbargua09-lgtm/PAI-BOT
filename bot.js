const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ================= PENGATURAN =================
// Masukkan Bot Token resmi lu di sini (diambil dari Discord Developer Portal)
const BOT_TOKEN = "MASUKKAN_BOT_TOKEN_RESMI_DI_SINI"; 

const CHANNEL_IDS = [
    "1511280356802957414", // Channel Satu
    "1530264991813468313", // Channel Dua
    "1542280484929802380"  // Channel Tiga
]; 

const GOD_BOT_ID = "1549264427000406040"; 

// Durasi farming per channel (3 Menit)
const FARMING_DURATION = 3 * 60 * 1000;
const SHORT_DELAY = 3000; // Jeda antar command (gh -> gb -> gs all)
const FULL_CYCLE_CD = 15000; // Cooldown setelah gs all

let isFarmingActive = false;
let currentChannelIndex = 0;
let activeInterval = null;
let currentTimeout = null;

// Default Gems aktif (bisa diganti via tombol panel)
let activeGems = "guse 85 78 71 57"; 
// ==============================================

client.once('ready', () => {
    console.log(`Bot panel resmi berhasil login sebagai ${client.user.tag}!`);
    console.log('🤖 Panel kontrol tombol interaktif siap digunakan.');
});

// Command untuk memunculkan Panel Tombol (Ketik !panel di chat)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!panel') {
        sendControlPanel(message);
    }
});

// Fungsi untuk mengirim / update tampilan panel tombol
async function sendControlPanel(target) {
    // Baris 1: Tombol Start & Stop
    const rowControl = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('start_farming')
                .setLabel('▶️ Start Farming')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('stop_farming')
                .setLabel('⏹️ Stop Farming')
                .setStyle(ButtonStyle.Danger)
        );

    // Baris 2: Tombol Pilihan Gems Langsung Klik
    const rowGems = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('gems_fable')
                .setLabel('💎 Fable (85 78 71 57)')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('gems_rare')
                .setLabel('💎 Rare (81 74 67 53)')
                .setStyle(ButtonStyle.Secondary)
        );

    const embed = new EmbedBuilder()
        .setTitle('🎮 GodBot Auto-Farming & Gems Control Panel')
        .setDescription(`Status Bot: **${isFarmingActive ? '🟢 AKTIF (Jalan)' : '🔴 MATI (Berhenti)'}**\nGems Aktif Saat Ini: \`${activeGems}\``)
        .setColor(isFarmingActive ? 0x00FF00 : 0xFF0000)
        .setTimestamp();

    if (target.reply) {
        await target.reply({ embeds: [embed], components: [rowControl, rowGems] });
    } else if (target.update) {
        await target.update({ embeds: [embed], components: [rowControl, rowGems] });
    }
}

// Handle klik tombol interaktif
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'start_farming') {
        if (isFarmingActive) {
            return interaction.reply({ content: '⚠️ Bot farming sudah dalam keadaan aktif!', ephemeral: true });
        }
        isFarmingActive = true;
        await interaction.reply({ content: '🚀 Bot farming berhasil **DIALANKAN**!', ephemeral: true });
        startFarmingCycle();
        sendControlPanel(interaction);
    } 
    else if (interaction.customId === 'stop_farming') {
        if (!isFarmingActive) {
            return interaction.reply({ content: '⚠️ Bot farming memang sedang mati!', ephemeral: true });
        }
        isFarmingActive = false;
        stopAllTimers();
        await interaction.reply({ content: '🛑 Bot farming berhasil **DIHENTIKAN**!', ephemeral: true });
        sendControlPanel(interaction);
    }
    else if (interaction.customId === 'gems_fable') {
        activeGems = "guse 85 78 71 57";
        await interaction.reply({ content: '✨ Gems berhasil diubah ke tier **Fable** (`guse 85 78 71 57`)!', ephemeral: true });
    }
    else if (interaction.customId === 'gems_rare') {
        activeGems = "guse 81 74 67 53";
        await interaction.reply({ content: '✨ Gems berhasil diubah ke tier **Rare** (`guse 81 74 67 53`)!', ephemeral: true });
    }
});

// Fungsi utama rotasi channel & command
async function startFarmingCycle() {
    if (!isFarmingActive) return;

    const channelId = CHANNEL_IDS[currentChannelIndex];
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel) {
        console.log(`[ERROR] Channel ID ${channelId} tidak ditemukan!`);
        return;
    }

    console.log(`📌 Mulai farming di channel: #${channel.name || channelId}`);

    try {
        await channel.send(activeGems);
        await sleep(3000);
    } catch (err) {
        console.error("Gagal kirim gems:", err.message);
    }

    let isRunningInChannel = true;

    activeInterval = setTimeout(() => {
        if (!isFarmingActive) return;
        isRunningInChannel = false;
        if (currentTimeout) clearTimeout(currentTimeout);

        console.log(`⌛ Waktu 3 menit habis. Pindah channel...`);
        currentChannelIndex = (currentChannelIndex + 1) % CHANNEL_IDS.length;
        startFarmingCycle();
    }, FARMING_DURATION);

    async function runCommands() {
        if (!isFarmingActive || !isRunningInChannel) return;

        try {
            await channel.send("gh");
            console.log(`[SENT] gh ke #${channel.name}`);
            await sleep(SHORT_DELAY);

            if (!isFarmingActive || !isRunningInChannel) return;

            await channel.send("gb");
            console.log(`[SENT] gb ke #${channel.name}`);
            await sleep(SHORT_DELAY);

            if (!isFarmingActive || !isRunningInChannel) return;

            await channel.send("gs all");
            console.log(`[SENT] gs all ke #${channel.name} (Siklus selesai)`);
        } catch (err) {
            console.error("Gagal kirim command:", err.message);
        }

        if (isFarmingActive && isRunningInChannel) {
            currentTimeout = setTimeout(runCommands, FULL_CYCLE_CD);
        }
    }

    runCommands();
}

// Auto-detect gems habis dari bot game
client.on('messageCreate', async (message) => {
    if (!isFarmingActive || message.author.id !== GOD_BOT_ID) return;

    const text = message.content.toLowerCase();
    if (text.includes("broke") || (text.includes("gem") && text.includes("no longer"))) {
        console.log(`⚠️ Gems habis terdeteksi! Mengirim ulang: ${activeGems}`);
        try {
            await message.channel.send(activeGems);
        } catch (err) {
            console.error("Gagal auto-use gems:", err.message);
        }
    }
});

function stopAllTimers() {
    if (activeInterval) clearTimeout(activeInterval);
    if (currentTimeout) clearTimeout(currentTimeout);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

client.login(BOT_TOKEN);
