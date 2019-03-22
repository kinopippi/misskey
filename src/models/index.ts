import { getRepository } from 'typeorm';
import { Note } from './note';
import { User } from './user';
import { Instance } from './instance';
import { DriveFile } from './drive-file';
import { DriveFolder } from './drive-folder';
import { Following } from './following';
import { Emoji } from './emoji';
import { App } from './app';
import { NoteReaction } from './note-reaction';
import { PollVote } from './poll-vote';
import { Notification } from './notification';
import { Meta } from './meta';

export const Apps = getRepository(App);
export const Notes = getRepository(Note);
export const NoteReactions = getRepository(NoteReaction);
export const PollVotes = getRepository(PollVote);
export const Users = getRepository(User);
export const Followings = getRepository(Following);
export const Instances = getRepository(Instance);
export const Emojis = getRepository(Emoji);
export const DriveFiles = getRepository(DriveFile);
export const DriveFolders = getRepository(DriveFolder);
export const Notifications = getRepository(Notification);
export const Metas = getRepository(Meta);