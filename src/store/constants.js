export const ENTRY_KINDS = Object.freeze(['capture', 'reflect', 'thought']);
export const TEXT_CONTENT_KINDS = Object.freeze(['capture', 'reflect', 'thought', 'annotation', 'evolution']);
export const SESSION_KINDS = Object.freeze(['reflect_session', 'brainstorm_session']);
export const BUCKET_PERIODS = Object.freeze(['hour', 'day', 'week']);

export const GRAPH_NAME = 'think';
export const REFLECT_PROMPT_TYPES = ['challenge', 'constraint', 'sharpen'];

// Node prefixes
export const ENTRY_PREFIX = 'entry:';
export const THOUGHT_PREFIX = 'thought:';
export const SESSION_PREFIX = 'session:';
export const ARTIFACT_PREFIX = 'artifact:';
export const REFLECT_SESSION_PREFIX = 'reflect:';
export const LEGACY_BRAINSTORM_SESSION_PREFIX = 'brainstorm:';
export const TOPIC_PREFIX = 'topic:';
export const KEYWORD_PREFIX = 'keyword:';
export const CLASSIFICATION_PREFIX = 'classification:';
export const ENTITY_PREFIX = 'entity:';
export const ANNOTATION_PREFIX = 'annotation:';
export const LINK_PREFIX = 'link:';
export const EVOLUTION_PREFIX = 'evolution:';
export const PIPELINE_RUN_PREFIX = 'pipeline_run:';
export const GRAPH_META_ID = 'meta:graph';

// Standing classification node IDs
export const CLASSIFICATIONS = Object.freeze([
  'question',
  'decision',
  'observation',
  'action_item',
  'idea',
  'reference',
  'unclassified',
]);

export const TEXT_MIME = 'text/plain; charset=utf-8';
export const MAX_REFLECT_STEPS = 3;
export const SESSION_IDLE_GAP_MS = 5 * 60 * 1000;
export const DERIVER_NAME = 'think';
export const DERIVER_VERSION = '1';
export const SCHEMA_VERSION = '1';
export const GRAPH_MODEL_VERSION = 4;
export const CHECKPOINT_POLICY = { every: 20 };
export const PRODUCT_READ_LENS = {
  match: [
    GRAPH_META_ID,
    `${ENTRY_PREFIX}*`,
    `${THOUGHT_PREFIX}*`,
    `${SESSION_PREFIX}*`,
    `${ARTIFACT_PREFIX}*`,
    `${REFLECT_SESSION_PREFIX}*`,
    `${LEGACY_BRAINSTORM_SESSION_PREFIX}*`,
    `${TOPIC_PREFIX}*`,
    `${KEYWORD_PREFIX}*`,
    `${CLASSIFICATION_PREFIX}*`,
    `${ENTITY_PREFIX}*`,
    `${ANNOTATION_PREFIX}*`,
    `${LINK_PREFIX}*`,
    `${EVOLUTION_PREFIX}*`,
    `${PIPELINE_RUN_PREFIX}*`,
  ],
};
export const CHALLENGE_PROMPTS = [
  'What assumption is hiding here?',
  'What would make this false in practice?',
  'What part of this is probably wishful thinking?',
];
export const CONSTRAINT_PROMPTS = [
  'What if this had to work offline?',
  'What is the smallest shippable version of this?',
  'What if this had to be explained in one sentence?',
];
export const SHARPEN_PROMPTS = [
  'What is the actual core claim here?',
  'What is the smallest concrete next move?',
  'What should be cut from this idea?',
];
export const REFLECT_MARKERS = [
  /\?/,
  /\b(i wonder|maybe|should|could|would|what if|how might|want to|need to|problem|question|decision|tradeoff|constraint|risk)\b/,
];
