const { CLI_COMMANDS } = require('../out/commandData');
const assert = require('assert');

console.log('Verifying CLI_COMMANDS...');

if (!Array.isArray(CLI_COMMANDS) || CLI_COMMANDS.length === 0) {
    console.error('CLI_COMMANDS is empty or not an array');
    process.exit(1);
}

const requiredCommands = [
    'jules git stash',
    'jules git clean -n',
    'jules git restore',
    'jules git bisect start',
    'jules git cherry-pick',
    'jules git submodule add',
    'jules git diff --stat'
];

let missing = 0;
requiredCommands.forEach(cmd => {
    const found = CLI_COMMANDS.find(c => c.command === cmd || c.usage?.startsWith(cmd.replace('jules ', '')));
    // Note: c.command has 'jules ' prefix in my data? Let's check commandData.ts content again.
    // In commandData.ts: command: 'jules git stash'
    // So exact match on command property should work.

    if (CLI_COMMANDS.find(c => c.command === cmd)) {
        console.log(`✅ Found: ${cmd}`);
    } else {
        console.error(`❌ Missing: ${cmd}`);
        missing++;
    }
});

if (missing > 0) {
    console.error(`Verification Failed: ${missing} commands missing.`);
    process.exit(1);
}

console.log(`Total commands: ${CLI_COMMANDS.length}`);
console.log('Verification Passed!');
