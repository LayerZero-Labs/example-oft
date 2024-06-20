import * as commander from 'commander'

export const command = new commander.Command()
command
    .name('oft-ops')
    .version('0.0.1')
    .description('cli for oft operation')
    .showHelpAfterError()
    .showSuggestionAfterError()
