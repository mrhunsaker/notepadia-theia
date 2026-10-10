import { Container, ContainerModule } from '@theia/core/shared/inversify';
import { bindCommonLogger } from '@theia/core/lib/common/logger-binding';
import { ILogger, Logger, LoggerFactory, LoggerName } from '@theia/core/lib/common/logger';
import { ILoggerServer } from '@theia/core/lib/common/logger-protocol';
import { ConsoleLoggerServer } from '@theia/core/lib/node/console-logger-server';
import { LogLevelCliContribution } from '@theia/core/lib/node/logger-cli-contribution';
import { RpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import { ElectronConnectionHandler } from '@theia/core/lib/electron-main/messaging/electron-connection-handler';
import { ElectronMainApplication } from '@theia/core/lib/electron-main/electron-main-application';
import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { NotepadiaElectronMainApplication } from './notepadia-electron-main-application';
import { NotepadiaUpdater } from './notepadia-updater';
import { NotepadiaUpdaterPath, NotepadiaUpdaterService } from '../common/notepadia-updater-protocol';
import { NotepadiaRunServer } from './notepadia-run-server';
import { NotepadiaRunPath, NotepadiaRunService } from '../common/notepadia-run-protocol';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    rebind(ElectronMainApplication).to(NotepadiaElectronMainApplication).inSingletonScope();

    // The Theia Electron main container does not bind a logger by default; the
    // updates backend (NotepadiaUpdater) injects ILogger, so provide the same
    // console-backed stack the node backend uses (minus its IPC/client wiring).
    bindCommonLogger(bind);
    bind(ILoggerServer).to(ConsoleLoggerServer).inSingletonScope();
    bind(LogLevelCliContribution).toSelf().inSingletonScope();
    bind(LoggerFactory).toFactory(ctx => (name: string) => {
        const child = new Container({ defaultScope: 'Singleton' });
        child.parent = ctx.container;
        child.bind(ILogger).to(Logger).inTransientScope();
        child.bind(LoggerName).toConstantValue(name);
        return child.get(ILogger);
    });

    bind(NotepadiaUpdater).toSelf().inSingletonScope();
    bind(ElectronMainApplicationContribution).toService(NotepadiaUpdater);
    bind(ElectronConnectionHandler).toDynamicValue(context =>
        new RpcConnectionHandler<NotepadiaUpdaterService>(
            NotepadiaUpdaterPath,
            () => context.container.get(NotepadiaUpdater)
        )
    ).inSingletonScope();

    // C5 - the Run menu's desktop half, over its own channel. `ElectronConnectionHandler`
    // is a root contribution provider, so a second binding is collected alongside the
    // updater's rather than replacing it.
    bind(NotepadiaRunServer).toSelf().inSingletonScope();
    bind(ElectronConnectionHandler).toDynamicValue(context =>
        new RpcConnectionHandler<NotepadiaRunService>(
            NotepadiaRunPath,
            () => context.container.get(NotepadiaRunServer)
        )
    ).inSingletonScope();
});