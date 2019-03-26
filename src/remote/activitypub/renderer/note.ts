import renderDocument from './document';
import renderHashtag from './hashtag';
import renderMention from './mention';
import renderEmoji from './emoji';
import config from '../../../config';
import toHtml from '../misc/get-note-html';
import { Note } from '../../../models/entities/note';
import { DriveFile } from '../../../models/entities/drive-file';
import { DriveFiles, Notes, Users, Emojis } from '../../../models';
import { In } from 'typeorm';
import { Emoji } from '../../../models/entities/emoji';

export default async function renderNote(note: Note, dive = true): Promise<any> {
	const promisedFiles: Promise<DriveFile[]> = note.fileIds.length > 1
		? DriveFiles.find({ id: In(note.fileIds) })
		: Promise.resolve([]);

	let inReplyTo;
	let inReplyToNote: Note;

	if (note.replyId) {
		inReplyToNote = await Notes.findOne(note.replyId);

		if (inReplyToNote !== null) {
			const inReplyToUser = await Users.findOne(inReplyToNote.userId);

			if (inReplyToUser !== null) {
				if (inReplyToNote.uri) {
					inReplyTo = inReplyToNote.uri;
				} else {
					if (dive) {
						inReplyTo = await renderNote(inReplyToNote, false);
					} else {
						inReplyTo = `${config.url}/notes/${inReplyToNote.id}`;
					}
				}
			}
		}
	} else {
		inReplyTo = null;
	}

	let quote;

	if (note.renoteId) {
		const renote = await Notes.findOne(note.renoteId);

		if (renote) {
			quote = renote.uri ? renote.uri : `${config.url}/notes/${renote.id}`;
		}
	}

	const user = await Users.findOne({
		id: note.userId
	});

	const attributedTo = `${config.url}/users/${user.id}`;

	const mentions = note.mentionedRemoteUsers && note.mentionedRemoteUsers.length > 0
		? note.mentionedRemoteUsers.map(x => x.uri)
		: [];

	let to: string[] = [];
	let cc: string[] = [];

	if (note.visibility == 'public') {
		to = ['https://www.w3.org/ns/activitystreams#Public'];
		cc = [`${attributedTo}/followers`].concat(mentions);
	} else if (note.visibility == 'home') {
		to = [`${attributedTo}/followers`];
		cc = ['https://www.w3.org/ns/activitystreams#Public'].concat(mentions);
	} else if (note.visibility == 'followers') {
		to = [`${attributedTo}/followers`];
		cc = mentions;
	} else {
		to = mentions;
	}

	const mentionedUsers = note.mentions.length > 0 ? await Users.find({
		id: In(note.mentions)
	}) : [];

	const hashtagTags = (note.tags || []).map(tag => renderHashtag(tag));
	const mentionTags = mentionedUsers.map(u => renderMention(u));

	const files = await promisedFiles;

	let text = note.text;

	let question: string;
	if (note.poll != null) {
		if (text == null) text = '';
		const url = `${config.url}/notes/${note.id}`;
		// TODO: i18n
		text += `\n[リモートで結果を表示](${url})`;

		question = `${config.url}/questions/${note.id}`;
	}

	let apText = text;
	if (apText == null) apText = '';

	// Provides choices as text for AP
	if (note.poll != null) {
		const cs = note.poll.choices.map(c => `${c.id}: ${c.text}`);
		apText += '\n----------------------------------------\n';
		apText += cs.join('\n');
		apText += '\n----------------------------------------\n';
		apText += '番号を返信して投票';
	}

	if (quote) {
		apText += `\n\nRE: ${quote}`;
	}

	const summary = note.cw === '' ? String.fromCharCode(0x200B) : note.cw;

	const content = toHtml(Object.assign({}, note, {
		text: apText
	}));

	const emojis = await getEmojis(note.emojis);
	const apemojis = emojis.map(emoji => renderEmoji(emoji));

	const tag = [
		...hashtagTags,
		...mentionTags,
		...apemojis,
	];

	const {
		choices = [],
		expiresAt = null,
		multiple = false
	} = note.poll || {};

	const asPoll = note.poll ? {
		type: 'Question',
		content: toHtml(Object.assign({}, note, {
			text: text
		})),
		_misskey_fallback_content: content,
		[expiresAt && expiresAt < new Date() ? 'closed' : 'endTime']: expiresAt,
		[multiple ? 'anyOf' : 'oneOf']: choices.map(({ text, votes }) => ({
			type: 'Note',
			name: text,
			replies: {
				type: 'Collection',
				totalItems: votes
			}
		}))
	} : {};

	return {
		id: `${config.url}/notes/${note.id}`,
		type: 'Note',
		attributedTo,
		summary,
		content,
		_misskey_content: text,
		_misskey_quote: quote,
		_misskey_question: question,
		published: note.createdAt.toISOString(),
		to,
		cc,
		inReplyTo,
		attachment: files.map(renderDocument),
		sensitive: files.some(file => file.isSensitive),
		tag,
		...asPoll
	};
}

export async function getEmojis(names: string[]): Promise<Emoji[]> {
	if (names == null || names.length === 0) return [];

	const emojis = await Promise.all(
		names.map(name => Emojis.findOne({
			name,
			host: null
		}))
	);

	return emojis.filter(emoji => emoji != null);
}
