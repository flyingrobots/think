import { headerBox, markdown, select } from '@flyingrobots/bijou';
import { initDefaultContext } from '@flyingrobots/bijou-node';

export function normalizeForPicker(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

export function pickReflectMode() {
  const ctx = initDefaultContext();
  ctx.io.write(`${renderInteractiveModeIntro(ctx)  }\n`);

  return select({
    title: 'Pressure mode',
    maxVisible: 4,
    options: [
      {
        value: 'challenge',
        label: 'Challenge',
        description: 'Test assumptions and failure modes',
      },
      {
        value: 'constraint',
        label: 'Constraint',
        description: 'Force practical limits and scope',
      },
      {
        value: 'sharpen',
        label: 'Sharpen',
        description: 'Clarify the core claim or next move',
      },
    ],
    defaultValue: 'challenge',
    ctx,
  });
}

export function promptForGraphMigration(command, status) {
  const scriptedDecision = process.env.THINK_TEST_CONFIRM_MIGRATION;
  if (scriptedDecision === 'upgrade' || scriptedDecision === 'cancel') {
    return scriptedDecision;
  }

  const ctx = initDefaultContext();
  ctx.io.write(`${renderGraphMigrationIntro(command, status, ctx)  }\n`);

  return select({
    title: 'Graph upgrade',
    maxVisible: 3,
    options: [
      {
        value: 'upgrade',
        label: 'Upgrade now',
        description: 'Migrate the local thought graph and continue.',
      },
      {
        value: 'cancel',
        label: 'Cancel',
        description: 'Leave the repo unchanged and stop this command.',
      },
    ],
    defaultValue: 'upgrade',
    ctx,
  });
}

export function formatIneligibleSeedMessage(eligibility, suggestedSeeds) {
  const lines = [
    eligibility.text,
    eligibility.suggestion,
  ];

  if (suggestedSeeds.length > 0) {
    lines.push('');
    lines.push('Try one of these instead:');
    for (const seed of suggestedSeeds) {
      lines.push(`- ${seed.text}`);
    }
  }

  return lines.join('\n');
}

export function renderInteractiveSeedIntro(ctx) {
  const header = headerBox('Choose a thought to reflect on', { ctx });
  const body = markdown('**Pick one recent capture that looks like an idea, question, or decision to reflect on.**', { ctx });
  return `${header}\n${body}`;
}

export function renderInteractiveModeIntro(ctx) {
  const header = headerBox('Choose how to reflect', { ctx });
  const body = markdown('**Choose how you want to push the seed thought.**', { ctx });
  return `${header}\n${body}`;
}

export function renderInteractiveReflectIntro(session, ctx = initDefaultContext()) {
  const header = headerBox('Reflect', { ctx });
  const sections = [
    '## Seed',
    session.seedEntry.text,
    '',
    '## Mode',
    `**${capitalize(session.promptType)}**`,
    '',
    '## Why This Question',
    session.selectionReason.text,
    '',
    '## Question',
    `**${session.question}**`,
  ];

  return `${header}\n${markdown(sections.join('\n'), { ctx })}`;
}

export function renderInteractiveReflectSkipped(ctx = initDefaultContext()) {
  return `${headerBox('Reflect skipped', { ctx })}\n${markdown('**No reflect response was saved.**', { ctx })}`;
}

export function renderGraphMigrationIntro(command, status, ctx = initDefaultContext()) {
  const header = headerBox('Upgrade thought graph', { ctx });
  const body = markdown(
    [
      '**Your thought graph uses an older model.**',
      '',
      `\`${command}\` needs graph model version ${status.requiredGraphModelVersion} before it can continue.`,
      '',
      `Current graph model version: ${status.currentGraphModelVersion}`,
    ].join('\n'),
    { ctx }
  );

  return `${header}\n${body}`;
}

export function renderGraphMigrationProgress({ command, phase, progress }, ctx = initDefaultContext()) {
  const header = headerBox('Upgrading thought graph', { ctx });
  const body = markdown(
    [
      `**Continuing into \`${command}\` once migration finishes.**`,
      '',
      `Progress: \`${renderProgressBar(progress)}\``,
      `Current phase: **${phase}**`,
    ].join('\n'),
    { ctx }
  );

  return `${header}\n${body}`;
}

function renderProgressBar(progress) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const width = 10;
  const filled = Math.round(clamped * width);
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`;
}

function capitalize(value) {
  const text = String(value || '');
  if (text.length === 0) {
    return text;
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}
