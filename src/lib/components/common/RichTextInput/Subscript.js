import Subscript from '@tiptap/extension-subscript';
import { InputRule } from '@tiptap/core';

export const CustomSubscript = Subscript.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /~([^~]+)~/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const { from, to } = range;
          const content = match[1];

          tr.replaceWith(from, to, state.schema.text(content));
          tr.addMark(from, from + content.length, state.schema.marks.subscript.create());
        },
      }),
    ];
  },
});
