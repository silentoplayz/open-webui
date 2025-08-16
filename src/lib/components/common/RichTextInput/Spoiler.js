import { Mark, mergeAttributes, InputRule } from '@tiptap/core';

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

  addInputRules() {
    return [
      new InputRule({
        find: /\|\|(.+?)\|\|/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const { from, to } = range;
          const content = match[1];

          tr.replaceWith(from, to, state.schema.text(content));
          tr.addMark(from, from + content.length, state.schema.marks.spoiler.create());
        },
      }),
    ];
  },
});
