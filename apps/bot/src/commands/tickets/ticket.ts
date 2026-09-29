import { SlashCommandBuilder, EmbedBuilder, ChannelType, TextChannel, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command';
import { apiClient } from '../../utils/api-client';

export const ticket: Command = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage support tickets')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new support ticket')
                .addStringOption(option =>
                    option
                        .setName('subject')
                        .setDescription('What is your ticket about?')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close the current ticket')
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for closing')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a user to the ticket')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to add')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a user from the ticket')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to remove')
                        .setRequired(true)
                )
        ),
    category: 'tickets',
    async execute(interaction) {
        if (!interaction.guild) return;

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'create') {
                const subject = interaction.options.getString('subject', true);

                await interaction.deferReply({ flags: MessageFlags.Ephemeral });

                // Create the ticket channel (bot-side - the API can't create channels)
                let category = interaction.guild.channels.cache.find(
                    c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'tickets'
                );

                if (!category) {
                    category = await interaction.guild.channels.create({
                        name: 'Tickets',
                        type: ChannelType.GuildCategory,
                    });
                }

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.roles.everyone.id,
                            deny: ['ViewChannel'],
                        },
                        {
                            id: interaction.user.id,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                        },
                        {
                            id: interaction.client.user.id,
                            allow: ['ViewChannel', 'SendMessages', 'ManageChannels'],
                        },
                    ],
                });

                // Persist the ticket via the API
                await apiClient.post(
                    `/guilds/${interaction.guild.id}/tickets`,
                    {
                        channelId: ticketChannel.id,
                        userId: interaction.user.id,
                        subject
                    }
                );

                // Welcome message inside the ticket channel
                const ticketEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🎫 Support Ticket')
                    .setDescription(`**Subject:** ${subject}\n\n${interaction.user}, a staff member will assist you shortly.\nUse \`/ticket close\` when your issue is resolved.`)
                    .setTimestamp();

                await ticketChannel.send({ content: `${interaction.user}`, embeds: [ticketEmbed] });

                const embed = new EmbedBuilder()
                    .setColor('#2ECC71')
                    .setTitle('🎫 Ticket Created!')
                    .setDescription(`Your ticket has been created: ${ticketChannel}`)
                    .addFields({ name: 'Subject', value: subject })
                    .setFooter({ text: 'A staff member will assist you shortly' })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'close') {
                const reason = interaction.options.getString('reason') || 'No reason provided';

                if (interaction.channel?.type !== ChannelType.GuildText) {
                    await interaction.reply({
                        content: '❌ This command can only be used in ticket channels!',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await apiClient.post(
                    `/guilds/${interaction.guild.id}/tickets/${interaction.channel.id}/close`,
                    {
                        closedBy: interaction.user.id,
                        reason
                    }
                );

                const embed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle('🔒 Ticket Closed')
                    .setDescription(`This ticket has been closed by ${interaction.user}`)
                    .addFields({ name: 'Reason', value: reason })
                    .setFooter({ text: 'This channel will be deleted in 10 seconds' })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

                setTimeout(async () => {
                    await (interaction.channel as TextChannel).delete();
                }, 10000);

            } else if (subcommand === 'add') {
                const user = interaction.options.getUser('user', true);

                if (interaction.channel?.type !== ChannelType.GuildText) {
                    await interaction.reply({
                        content: '❌ This command can only be used in ticket channels!',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await (interaction.channel as TextChannel).permissionOverwrites.create(user, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await interaction.reply({
                    content: `✅ Added ${user} to the ticket.`
                });

            } else if (subcommand === 'remove') {
                const user = interaction.options.getUser('user', true);

                if (interaction.channel?.type !== ChannelType.GuildText) {
                    await interaction.reply({
                        content: '❌ This command can only be used in ticket channels!',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await (interaction.channel as TextChannel).permissionOverwrites.delete(user);

                await interaction.reply({
                    content: `✅ Removed ${user} from the ticket.`
                });
            }
        } catch (error: any) {
            const content = '❌ ' + (error.response?.data?.error || error.response?.data?.message || 'Failed to process ticket command!');
            if (interaction.deferred) {
                await interaction.editReply({ content });
            } else {
                await interaction.reply({ content, flags: MessageFlags.Ephemeral });
            }
        }
    },
};
