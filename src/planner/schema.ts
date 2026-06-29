// The tool definition used to force Claude to emit one well-formed action.
// Tool-use with `tool_choice: {type:'tool'}` guarantees the model returns
// validated JSON matching this schema - no free-text parsing needed.

export const ACTION_TOOL = {
  name: 'resolve_action',
  description:
    'Translate a single natural-language test step into exactly one concrete browser action with a robust locator.',
  input_schema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['goto', 'click', 'fill', 'expectText', 'expectVisible'],
        description:
          'goto: navigate to a URL. click: click an element. fill: type into an input. expectText: assert some text is visible. expectVisible: assert an element is visible.',
      },
      url: {
        type: 'string',
        description: 'Absolute or relative URL. Required when kind=goto.',
      },
      text: {
        type: 'string',
        description:
          'For kind=fill, the value to type. For kind=expectText, the text to assert is visible.',
      },
      locator: {
        type: 'object',
        description:
          'How to find the target element. Omit for goto. Prefer role+name or visible text over brittle css/testid selectors.',
        properties: {
          strategy: {
            type: 'string',
            enum: ['role', 'text', 'label', 'placeholder', 'testid', 'css'],
          },
          value: {
            type: 'string',
            description:
              "For role: the ARIA role ('button', 'link', 'textbox'). For text/label/placeholder: the string. For testid: the data-testid value. For css: a CSS selector.",
          },
          name: {
            type: 'string',
            description: 'Accessible name, used with strategy=role (e.g. the button label).',
          },
        },
        required: ['strategy', 'value'],
      },
    },
    required: ['kind'],
  },
} as const;
