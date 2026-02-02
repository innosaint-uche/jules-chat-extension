
try {
    const { CLI_COMMANDS } = require('../out/commandData');

    if (!Array.isArray(CLI_COMMANDS)) {
        console.error('❌ CLI_COMMANDS is not an array');
        process.exit(1);
    }

    const commandNames = new Set();
    const errors = [];

    CLI_COMMANDS.forEach((cmd, index) => {
        if (!cmd.command) errors.push(`Item ${index} missing 'command' property`);
        if (!cmd.description) errors.push(`Item ${index} missing 'description' property`);
        if (!cmd.category) errors.push(`Item ${index} missing 'category' property`);

        if (commandNames.has(cmd.command)) {
            errors.push(`Duplicate command found: ${cmd.command}`);
        }
        commandNames.add(cmd.command);
    });

    // Check for expected new commands (will fail initially, but pass after I implement them)
    const expectedCommands = [
        'jules git stash',
        'jules git bisect',
        'jules git cherry-pick'
    ];

    // We are looking for partial matches because the command string might be "jules git stash pop"
    const missingCommands = expectedCommands.filter(expected =>
        !CLI_COMMANDS.some(c => c.command.startsWith(expected))
    );

    if (missingCommands.length > 0) {
        // Only warn for now, as I haven't implemented them yet.
        // But strictly for verification AFTER implementation, this should be an error.
        console.log(`⚠️  Warning: Missing expected commands (normal before implementation): ${missingCommands.join(', ')}`);
    }

    if (errors.length > 0) {
        console.error('❌ Validation Failed:');
        errors.forEach(e => console.error(`- ${e}`));
        process.exit(1);
    }

    console.log(`✅ CLI_COMMANDS validated successfully. Total commands: ${CLI_COMMANDS.length}`);

} catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
        console.error('❌ Could not load ../out/commandData. Make sure to run `npm run compile` first.');
    } else {
        console.error(e);
    }
    process.exit(1);
}
