import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronMainApplication } from '@theia/core/lib/electron-main/electron-main-application';
import { NotepadiaElectronMainApplication } from './notepadia-electron-main-application';

export default new ContainerModule((_bind, _unbind, _isBound, rebind) => {
    rebind(ElectronMainApplication).to(NotepadiaElectronMainApplication).inSingletonScope();
});