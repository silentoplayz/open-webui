import { Node, mergeAttributes } from '@tiptap/core';

export const Abbreviation = Node.create({
  name: 'abbreviation',

  group: 'inline',

  content: 'text*',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'abbr',
        getAttrs: (dom) => {
          const title = dom.getAttribute('title');
          return title ? { title: title } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['abbr', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});
