import { Command, Message, Middleware, CommandDecorators, Time } from 'yamdbf';
import { TextChannel } from 'discord.js';
import { ModClient } from '../../lib/ModClient';
import { LockdownManager } from '../../lib/mod/managers/LockdownManager';
import { modOnly } from '../../lib/Util';

const { resolveArgs, expect } = Middleware;
const { using } = CommandDecorators;

export default class extends Command<ModClient>
{
	public constructor(client: ModClient)
	{
		super(client, {
			name: 'lockdown',
			description: 'Lock down a channel for a set time',
			usage: '<prefix>lockdown <duration|\'clear\'> [#channel]',
			extraHelp: 'Uses duration shorthand to determine duration. Examples:\n\n\t30s\n\t10m\n\t5h\n\t1d\n\nUse `lockdown clear` to remove the channel lockdown.\n\nCalling the lockdown command when a channel is already locked down will restart the lockdown with the new duration.',
			group: 'mod',
			guildOnly: true
		});
	}

	@modOnly
	@using(resolveArgs({ '<duration|clear>': 'String', '[#channel]': 'Channel' }))
	@using(expect({ '<duration|clear>': 'String' }))
	public async action(message: Message, [durationOrClear, channel]: [string, TextChannel]): Promise<any>
	{
		if (!(await message.guild.fetchMember(this.client.user)).permissions.has('MANAGE_ROLES_OR_PERMISSIONS'))
			return message.channel.send(`I need to have \`Manage Roles\` permissions to do that on this server.`);

		const lockdownManager: LockdownManager = this.client.mod.managers.lockdown;

		if (!channel) channel = <TextChannel> message.channel;
		if (channel.guild.id !== message.guild.id)
			return message.channel.send('You may not lock down channels in other guilds.');

		if (durationOrClear !== 'clear')
		{
			const duration: number = Time.parseShorthand(durationOrClear);
			if (!duration) return message.channel.send(
				'You must provide a valid lockdown duration. Use the help command for more information');

			const durationString: string = Time.duration(duration).toString();

			await channel.send(`***This channel is locked down. (${durationString})***`);
			await lockdownManager.set(channel, duration);
			console.log(`Locked down channel '${channel.name}' in guild '${message.guild.name}'`);

			if (message.channel.id !== channel.id)
				message.channel.send(`***Locked down ${channel}. (${durationString})***`);
		}
		else
		{
			if (!lockdownManager.isLockedDown(channel))
				return message.channel.send('The channel is not locked down.');

			if (await lockdownManager.getRemaining(channel) < 10e3)
				return message.channel.send(
					'The lockdown on the channel is about to expire. Just wait it out.');

			await lockdownManager.remove(channel);
			try { await channel.send('**The lockdown on this channel has ended.**'); }
			catch (err) { message.author.send('Failed to send lockdown end message to the channel.'); }
		}
	}
}
