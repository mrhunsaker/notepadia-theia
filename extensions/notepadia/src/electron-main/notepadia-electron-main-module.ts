import { ContainerModule } from '@theia/core/shared/inversify';
import { RpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import { ElectronConnectionHandler } from '@theia/core/lib/electron-main/messaging/electron-connection-handler';
import { ElectronMainApplication } from '@theia/core/lib/electron-main/electron-main-application';
import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { NotepadiaElectronMainApplication } from './notepadia-electron-main-application';
import { NotepadiaUpdater } from './notepadia-updater';
import { NotepadiaUpdaterPath, NotepadiaUpdaterService } from '../common/notepadia-updater-protocol';

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
});