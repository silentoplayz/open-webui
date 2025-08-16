import { Mark, mergeAttributes } from '@tiptap/core';

export const Spoiler = Mark.create({
  name: 'spoiler',

  addAttributes() {
    return {
      'data-spoiler': {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-spoiler]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-spoiler': true }), 0];
  },

  addCommands() {
    return {
      toggleSpoiler: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
    };
  },
});
