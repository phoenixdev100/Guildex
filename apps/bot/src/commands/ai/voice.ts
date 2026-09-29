/**
 * Voice Command
 *
 * AI text-to-speech - turns text into an audio message.
 * (Bots can't capture voice input, so this generates speech instead.)
 */

import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../../types/command';
import { aiTts } from '../../utils/ai';

export const voice: Command = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Convert text to speech (AI voice)')
        .setDMPermission(false)
        .addStringOption(o => o.setName('text').setDescription('Text to speak (max 200 chars)').setRequired(true).setMaxLength(200))
        .addStringOption(o =>
            o.setName('language').setDescription('Voice language').setRequired(false)
                .addChoices(
                    { name: 'English', value: 'en' },
                    { name: 'Hindi', value: 'hi' },
                    { name: 'Spanish', value: 'es' },
                    { name: 'French', value: 'fr' },
                    { name: 'German', value: 'de' },
                    { name: 'Japanese', value: 'ja' },
                )
        ),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const text = interaction.options.getString('text', true);
        const lang = interaction.options.getString('language') ?? 'en';

        await interaction.deferReply();

        try {
            const audio = await aiTts(text, lang);
            const attachment = new AttachmentBuilder(audio, { name: 'ai-voice.mp3' });

            await interaction.editReply({
                content: `🔊 *"${text.slice(0, 150)}"*`,
                files: [attachment],
            });
        } catch (error: any) {
            console.error('voice error:', error);
            await interaction.editReply({ content: `❌ Speech generation failed: ${error.message ?? 'Unknown error'}` });
        }
    },
};
