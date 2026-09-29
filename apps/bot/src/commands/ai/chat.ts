/**
 * AI Command - chat / summarize / translate / explain
 *
 * Free AI backend via Pollinations (no API key needed).
 * Memory + personality feed into /ai chat.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/command';
import { aiAsk, aiChat, getMemory, pushMemory, personalityPrompt, type ChatMessage } from '../../utils/ai';

function aiEmbed(title: string, answer: string, user: { tag: string; displayAvatarURL(): string }): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(title)
        .setDescription(answer.slice(0, 4000))
        .setFooter({ text: `Asked by ${user.tag} • Powered by AI`, iconURL: user.displayAvatarURL() })
        .setTimestamp();
}

export const chat: Command = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('AI assistant commands')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('chat')
                .setDescription('Chat with the AI')
                .addStringOption(o => o.setName('prompt').setDescription('Your message').setRequired(true).setMaxLength(2000))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('summarize')
                .setDescription('Summarize text')
                .addStringOption(o => o.setName('text').setDescription('Text to summarize').setRequired(true).setMaxLength(4000))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('translate')
                .setDescription('Translate text to any language')
                .addStringOption(o => o.setName('text').setDescription('Text to translate').setRequired(true).setMaxLength(2000))
                .addStringOption(o => o.setName('language').setDescription('Target language (e.g. Hindi, Spanish)').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('explain')
                .setDescription('Explain something simply (ELI5)')
                .addStringOption(o => o.setName('topic').setDescription('What to explain').setRequired(true).setMaxLength(2000))
        ),
    category: 'ai',

    async execute(interaction) {
        if (!interaction.guild) return;

        const sub = interaction.options.getSubcommand();
        await interaction.deferReply();

        try {
            if (sub === 'chat') {
                const prompt = interaction.options.getString('prompt', true);
                const memory = getMemory(interaction.user.id);

                const messages: ChatMessage[] = [
                    { role: 'system', content: personalityPrompt(memory.personality) },
                    ...(memory.enabled ? memory.history : []),
                    { role: 'user', content: prompt },
                ];

                const answer = await aiChat(messages);
                if (memory.enabled) pushMemory(interaction.user.id, prompt, answer);

                const embed = aiEmbed('🤖 AI Chat', answer, interaction.user)
                    .addFields({ name: 'You asked', value: `> ${prompt.slice(0, 500)}` });
                if (memory.enabled) embed.setFooter({ text: `Memory on • ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
                await interaction.editReply({ embeds: [embed] });

            } else if (sub === 'summarize') {
                const text = interaction.options.getString('text', true);
                const answer = await aiAsk('Summarize the following text concisely. Keep key points.', text);
                await interaction.editReply({ embeds: [aiEmbed('📝 Summary', answer, interaction.user)] });

            } else if (sub === 'translate') {
                const text = interaction.options.getString('text', true);
                const language = interaction.options.getString('language', true);
                const answer = await aiAsk(`Translate the text to ${language}. Reply with ONLY the translation.`, text);
                await interaction.editReply({ embeds: [aiEmbed(`🌐 Translation → ${language}`, answer, interaction.user)] });

            } else if (sub === 'explain') {
                const topic = interaction.options.getString('topic', true);
                const answer = await aiAsk('Explain this simply, like to a 10-year-old. Use an analogy if helpful.', topic);
                await interaction.editReply({ embeds: [aiEmbed('💡 Explanation', answer, interaction.user)] });
            }
        } catch (error: any) {
            console.error('ai command error:', error);
            await interaction.editReply({ content: `❌ AI request failed: ${error.message ?? 'Unknown error'}` });
        }
    },
};
