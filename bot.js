const { Client: DiscordClient, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

// 1. Bot Resmi (Untuk panel tombol & interaksi)
const botClient = new DiscordClient({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 2. Akun Pribadi (Self-bot untuk ngetik command game gh, gb, guse)
const userClient = new SelfClient();

// ================= PENGATURAN =================
const BOT_TOKEN = process.env.BOT_TOKEN;   // Token Bot Resmi dari Railway
const USER_TOKEN = process.env.USER_TOKEN; // User Token Akun Pribadi dari Railway

const CHANNEL_IDS = [
    "1511280356802957414", // Channel Satu
    "1530264991813468313", // Channel Dua
    "1542280484929802380"  // Channel Tiga
]; 

const GOD_BOT_ID = "1549264427000406040"; 

const FARMING_DURATION = 3 * 60 * 1000; // 3 Menit per channel
const SHORT_DELAY = 3000;               // Jeda antar command
const FULL_CYCLE_CD = 15000;            // Cooldown siklus

let isFarmingActive = false;
let currentChannelIndex = 0;
let activeInterval = null;
let currentTimeout = null;

let activeGems = "guse 85 78 71 57"; 
// ==============================================

// Event saat Bot Resmi Ready
botClient.once('ready', () => {
    console.log(`[BOT] Berhasil login sebagai bot: ${botClient.user.tag}`);
});

// Event saat Akun Pribadi Ready
userClient.once('ready', () => {
    console.log(`[USER] Self-bot aktif menggunakan akun: ${userClient.user.tag}`);
});

// Command !panel untuk memunculkan tombol di Discord
botClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!panel') {
        await message.reply({ 
            embeds: [getControlPanelEmbed()], 
            components: getControlPanelComponents() 
        });
    }
});

// Handle klik tombol dari panel bot
botClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'start_farming') {
        if (isFarmingActive) {
            return interaction.reply({ content: '⚠️ Bot farming sudah dalam keadaan aktif!', ephemeral: true });
        }
        isFarmingActive = true;
        startFarmingCycle();
        
        await interaction.update({ 
            content: '🚀 Bot farming berhasil **DIJALANKAN** (Akun pribadi mulai otomatis ngetik)!', 
            embeds: [getControlPanelEmbed()], 
            components: getControlPanelComponents() 
        });
    } 
    else if (interaction.customId === 'stop_farming') {
        if (!isFarmingActive) {
            return interaction.reply({ content: '⚠️ Bot farming memang sedang mati!', ephemeral: true });
        }
        isFarmingActive = false;
        stopAllTimers();
        
        await interaction.update({ 
            content: '🛑 Bot farming berhasil **DIHENTIKAN**!', 
            embeds: [getControlPanelEmbed()], 
            components: getControlPanelComponents() 
        });
    }
    else if (interaction.customId === 'gems_fable') {
        activeGems = "guse 85 78 71 57";
        await interaction.reply({ content: '✨ Gems diubah ke tier **Fable** (`guse 85 78 71 57`)!', ephemeral: true });
    }
    else if (interaction.customId === 'gems_rare') {
        activeGems = "guse 81 74 67 53";
        await interaction.reply({ content: '✨ Gems diubah ke tier **Rare** (`guse 81 74 67 53`)!', ephemeral: true });
    }
});

function getControlPanelEmbed() {
    return new EmbedBuilder()
        .setTitle('🎮 GodBot Auto-Farming & Gems Control Panel')
        .setDescription(`Status Bot: **${isFarmingActive ? '🟢 AKTIF (Jalan)' : '🔴 MATI (Berhenti)'}**\nGems Aktif: \`${activeGems}\``)
        .setColor(isFarmingActive ? 0x00FF00 : 0xFF0000)
        .setTimestamp();
}

function getControlPanelComponents() {
    const rowControl = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('start_farming').setLabel('▶️ Start Farming').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('stop_farming').setLabel('⏹️ Stop Farming').setStyle(ButtonStyle.Danger)
        );

    const rowGems = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId('gems_fable').setLabel('💎 Fable').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gems_rare').setLabel('💎 Rare').setStyle(ButtonStyle.Secondary)
        );

    return [rowControl, rowGems];
}

// Fungsi rotasi channel & eksekusi pakai akun pribadi (userClient)
async function startFarmingCycle() {
    if (!isFarmingActive) return;

    const channelId = CHANNEL_IDS[currentChannelIndex];
    const channel = await userClient.channels.fetch(channelId).catch(() => null);

    if (!channel) {
        console.log(`[ERROR] Channel ID ${channelId} tidak ditemukan oleh akun pribadi!`);
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
            await sleep(SHORT_DELAY);

            if (!isFarmingActive || !isRunningInChannel) return;
            await channel.send("gb");
            await sleep(SHORT_DELAY);

            if (!isFarmingActive || !isRunningInChannel) return;
            await channel.send("gs all");
        } catch (err) {
            console.error("Gagal kirim command:", err.message);
        }

        if (isFarmingActive && isRunningInChannel) {
            currentTimeout = setTimeout(runCommands, FULL_CYCLE_CD);
        }
    }

    runCommands();
}

// Auto-detect gems habis dari GodBot
userClient.on('messageCreate', async (message) => {
    if (!isFarmingActive || message.author.id !== GOD_BOT_ID) return;

    const text = message.content.toLowerCase();
    if (text.includes("broke") || (text.includes("gem") && text.includes("no longer"))) {
        console.log(`⚠️ Gems habis! Akun pribadi mengirim ulang: ${activeGems}`);
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

// Login kedua bot secara bersamaan di Railway
botClient.login(BOT_TOKEN);
userClient.login(USER_TOKEN);
