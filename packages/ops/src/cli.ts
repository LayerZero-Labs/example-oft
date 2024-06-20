#!/usr/bin/env -S npx ts-node
import * as path from 'path'

import * as commander from 'commander'
import { globSync } from 'glob'

interface ModuleInfo {
    filename: string
    dirname: string
    relative: string
    module: any
}

function listFiles(root: string, pattern: string): string[] {
    return globSync(pattern, {
        cwd: root,
        // nosort: true,
    })
}

async function importModules(root: string, files: string[]): Promise<ModuleInfo[]> {
    return Promise.all(
        files.map(async (file) => {
            const filename = path.normalize(path.join(root, file))
            const relative = path.relative(root, filename)
            const dirname = path.dirname(relative)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const module = await import(filename)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            return { filename, dirname, relative, module }
        })
    )
}

function findCommand(parent: commander.Command, name: string): commander.Command | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return parent.commands.find((cmd) => {
        cmd.name() === name || cmd.aliases().includes(name)
    })
}

function buildCommandFamily(
    commands: ModuleInfo[],
    family: { [key: string]: ModuleInfo }
): { [key: string]: ModuleInfo } {
    for (const moduleInfo of commands) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { filename, dirname, relative, module } = moduleInfo
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { command } = module
        if (command === undefined) {
            throw new Error(`${filename} does not contain valid command`)
        }

        const modulePath = relative === 'cmd.ts' || relative.endsWith('/cmd.ts') ? dirname : relative
        family[modulePath] = moduleInfo

        if (modulePath === '.') {
            continue
        }

        const parentModule = path.dirname(modulePath)
        const parentCommandInfo = family[parentModule]

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        const parent = parentCommandInfo.module.command
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const child = findCommand(parent, command.name())
        if (child !== undefined) {
            const childCommandInfo = Object.values(family).find(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                (item: ModuleInfo) => item.module.command === child
            )

            // @ts-ignore
            throw new Error(`${filename} has duplicate command, previous is ${childCommandInfo.filename}`)
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        parent.addCommand(command)
    }
    return family
}

async function main(): Promise<void> {
    const root = __dirname

    const family: { [key: string]: ModuleInfo } = {}
    {
        const files = listFiles(root, '**/cmd.ts')
        const moduleInfos = await importModules(root, files)
        buildCommandFamily(moduleInfos, family)
    }

    {
        const files = listFiles(root, '**/*.cmd.ts')
        const moduleInfos = await importModules(root, files)
        buildCommandFamily(moduleInfos, family)
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const rootCommand = family['.'].module.command
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
    rootCommand.parse(process.argv)
}

main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
