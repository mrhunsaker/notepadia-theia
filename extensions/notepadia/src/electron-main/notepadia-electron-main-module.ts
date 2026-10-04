import { ContainerModule } from '@theia/core/shared/inversify';
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