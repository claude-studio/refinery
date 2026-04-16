export default {
  'apps/backend/**/*.+(ts|tsx)': [() => 'tsc -p apps/backend/tsconfig.json --noEmit'],
  'apps/frontend/**/*.+(ts|tsx)': [() => 'tsc -p apps/frontend/tsconfig.json --noEmit'],
  'apps/agent/**/*.+(ts|tsx)': [() => 'tsc -p apps/agent/tsconfig.json --noEmit'],
  'packages/shared/**/*.+(ts|tsx)': [() => 'tsc -p packages/shared/tsconfig.json --noEmit'],
  'packages/ui/**/*.+(ts|tsx)': [() => 'tsc -p packages/ui/tsconfig.json --noEmit'],
  '**/*.+(ts|tsx|js|jsx|mjs|cjs)': ['eslint --fix --cache', 'prettier --write'],
}
