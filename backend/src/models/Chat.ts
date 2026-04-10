import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  sender: mongoose.Types.ObjectId;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface IChat extends Document {
  participants: mongoose.Types.ObjectId[];
  messages: IMessage[];
  lastMessage?: {
    content: string;
    sender: mongoose.Types.ObjectId;
    createdAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const chatSchema = new Schema<IChat>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    messages: [messageSchema],
    lastMessage: {
      content: String,
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      createdAt: Date,
    },
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

const Chat = mongoose.model<IChat>('Chat', chatSchema);
export default Chat;
