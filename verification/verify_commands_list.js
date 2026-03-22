const { CLI_COMMANDS } = require('../out/commandData');

console.log('🔍 Verifying CLI_COMMANDS list...');

if (!Array.isArray(CLI_COMMANDS)) {
    console.error('❌ CLI_COMMANDS is not an array!');
    process.exit(1);
}

console.log(`✅ CLI_COMMANDS is an array with ${CLI_COMMANDS.length} entries.`);

if (CLI_COMMANDS.length < 50) {
    console.error('❌ Expected an extensive list (> 50 commands), but found fewer.');
    process.exit(1);
}

const commands = new Set();
const actionIds = new Set();
let errors = 0;

CLI_COMMANDS.forEach((cmd, index) => {
    if (!cmd.command) {
        console.error(`❌ Entry ${index} missing 'command' property.`);
        errors++;
    } else if (commands.has(cmd.command)) {
        console.error(`❌ Duplicate command found: "${cmd.command}"`);
        errors++;
    } else {
        commands.add(cmd.command);
    }

    if (!cmd.description) {
        console.error(`❌ Command "${cmd.command}" missing 'description'.`);
        errors++;
    }

    if (!cmd.category) {
        console.error(`❌ Command "${cmd.command}" missing 'category'.`);
        errors++;
    }

    if (cmd.actionId) {
        if (actionIds.has(cmd.actionId)) {
            console.error(`❌ Duplicate actionId found: "${cmd.actionId}"`);
            errors++;
        } else {
            actionIds.add(cmd.actionId);
        }
    }
});

if (errors > 0) {
    console.error(`❌ Verification failed with ${errors} errors.`);
    process.exit(1);
}

console.log('✅ All commands verified successfully!');
process.exit(0);
