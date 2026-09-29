/**
 * AIImage Command
 *
 * Generate an AI image from a text prompt (Pollinations - free, no key).
 */

import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../../types/command';
import { aiImage } from '../../utils/ai';

export const image: Command = {
    data: new SlashCommandBuilder()
        .setName('aiimage')
        .setDescription('Generate AI image')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('prompt').setDescription('Image description').setRequired(true).setMaxLength(500)
        ),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const prompt = interaction.options.getString('prompt', true);
        await interaction.deferReply();

        try {
            // Generation takes 5–30s - download it ourselves and upload as
            // an attachment (Discord's image proxy times out on embed URLs)
            const imageBuffer = await aiImage(prompt);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'ai-image.png' });

            const embed = new EmbedBuilder()
                .setColor(0x9b59b6)
                .setTitle('🎨 AI Image')
                .setDescription(`> ${prompt}`)
                .setImage('attachment://ai-image.png')
                .setFooter({ text: `Generated for ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], files: [attachment] });
        } catch (error: any) {
            console.error('aiimage error:', error);
            await interaction.editReply({ content: `❌ Image generation failed: ${error.message ?? 'Unknown error'}` });
        }
    },
};
